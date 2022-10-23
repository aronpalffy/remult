
import { queryConfig, Remult } from "../context";
import { DataApi } from "../data-api";
import { InMemoryDataProvider } from "../data-providers/in-memory-database";
import { Entity, EntityBase, Fields } from "../remult3";
import { actionInfo } from "../server-action";
import { createData } from "../tests/createData";
import { createMockHttpDataProvider } from "../tests/testHelper.spec";
import { LiveQueryClient, liveQueryMessage, MessageHandler, streamUrl } from "./LiveQuerySubscriber";
import { LiveQueryPublisher, ServerEventMessage } from "./LiveQueryPublisher";

const joc = jasmine.objectContaining;

@Entity("event-test", { allowApiCrud: true })
export class eventTestEntity {
    @Fields.integer()
    id = 0;
    @Fields.string()
    title: string;
    @Fields.string((o, remult) => o.serverExpression = () => remult.user.name)
    selectUser = '';
}


async function setup1() {
    const mem = new InMemoryDataProvider()
    const serverRemult = new Remult(mem);
    serverRemult.user = ({ id: 'server', name: 'server', roles: [] });
    const serverRepo = serverRemult.repo(eventTestEntity);
    const items = [
        { id: 1, title: 'noam' },
        { id: 2, title: 'yael' },
        { id: 3, title: 'yoni' },
        { id: 4, title: 'maayan' },
        { id: 5, title: 'itamar' },
        { id: 6, title: 'ofri' }
    ];
    await serverRepo.insert(items);
    const remult = new Remult(mem);
    remult.user = ({ id: clientId1, name: clientId1, roles: [] });
    const clientRepo = remult.repo(eventTestEntity);
    const messages: ServerEventMessage[] = [];
    const qm = new LiveQueryPublisher({ sendQueryMessage: m => messages.push(m), sendChannelMessage: undefined });
    let p = new PromiseResolver(qm);

    serverRemult._changeListener = qm;
    const queryId = qm.subscribe(clientRepo, clientId1, {}, remult, items.map(x => x.id));
    expect(messages.length).toBe(0);
    return { serverRepo, messages, flush: () => p.flush() };
}

const clientId1 = "clientId1";
describe("Live Query", () => {
    beforeEach(() => { actionInfo.runningOnServer = true });
    afterEach(() => { actionInfo.runningOnServer = false })
    it("test that data is sent with correct remult user", async () => {

        const { serverRepo, messages, flush } = await setup1();
        const row = await serverRepo.findId(1);
        row.title += '1';
        await serverRepo.save(row);
        await flush();
        expect(messages).toEqual([joc({
            message: joc({
                type: 'replace',
                data: joc({
                    oldId: 1,
                    item: joc({ selectUser: clientId1 })
                })
            })
        })])
    });
    it("test that id change is supported", async () => {
        const { serverRepo, messages, flush } = await setup1();
        const row = await serverRepo.findId(1);
        row.id = 99;
        await serverRepo.save(row);
        await flush();
        expect(messages).toEqual([joc({
            message: joc({
                type: 'replace',
                data: joc({
                    oldId: 1,
                    item: joc({
                        id: 99,
                        selectUser: clientId1
                    })
                })
            })
        })])
    });
    it("new row is reported", async () => {
        const { serverRepo, messages, flush } = await setup1();
        const row = await serverRepo.insert([{ id: 9, title: 'david' }]);
        await flush();
        expect(messages).toEqual([joc({
            message: joc({
                type: 'add',
                data: joc({
                    item: joc({
                        id: 9,
                        selectUser: clientId1
                    })
                })
            })
        })])
    });
    it("removed row is reported", async () => {
        const { serverRepo, messages, flush } = await setup1();
        await serverRepo.delete((await serverRepo.findFirst({ id: 1 })));
        await flush();
        expect(messages).toEqual([joc({
            message: joc({
                type: 'remove',
                data: { id: 1 }
            })
        })])
    });
});

class PromiseResolver {
    private promises: any[] = [];
    constructor(...who: { runPromise: (p: any) => void }[]) {
        for (const w of who) {
            w.runPromise = p => {
                this.promises.push(p);
                return p;
            };
        }
    }
    async flush() {
        while (this.promises.length > 0) {

            let p = this.promises;
            this.promises = [];
            await Promise.all(p);
        }
    }

}


describe("Live Query Client", () => {
    it("registers once", async () => {
        let open = 0;
        let get = 0;
        let sendMessage: MessageHandler;
        const lqc = new LiveQueryClient({
            async openStreamAndReturnCloseFunction(clientId, onMessage) {
                open++;
                sendMessage = onMessage;
                return () => {
                    open--;
                }
            },
        }, {
            get: async (url) => {
                get++;
                return {
                    id: '1',
                    result: [{
                        id: 1,
                        title: 'noam'
                    }]
                }
            },
            put: undefined,
            post: undefined,
            delete: undefined
        });
        let p = new PromiseResolver(lqc);
        const serverRemult = new Remult(new InMemoryDataProvider());
        serverRemult.liveQueryProvider = lqc;
        const serverRepo = serverRemult.repo(eventTestEntity);
        let closeSub1: VoidFunction;
        let closeSub2: VoidFunction;
        let result1: eventTestEntity[];
        let result2: eventTestEntity[];
        closeSub1 = serverRepo.query().subscribe(reducer => {
            result1 = reducer(result1);
        });
        closeSub2 = serverRepo.query().subscribe(reducer => {
            result2 = reducer(result2);
        });
        await p.flush();
        expect(open).toBe(1);
        expect(get).toBe(1);
        expect(result1[0].title).toBe("noam");
        expect(result2[0].title).toBe("noam");
        sendMessage({
            event: '1',
            data: {
                type: "replace",
                data: {
                    oldId: 1,
                    item: {
                        id: 1,
                        title: 'noam1'
                    }
                }
            } as liveQueryMessage
        });
        await p.flush();
        expect(result1[0].title).toBe("noam1");
        expect(result2[0].title).toBe("noam1");
        closeSub1();
        await p.flush();
        sendMessage({
            event: '1',
            data: {
                type: "replace",
                data: {
                    oldId: 1,
                    item: {
                        id: 1,
                        title: 'noam2'
                    }
                }
            } as liveQueryMessage
        });
        await p.flush();
        expect(result1[0].title).toBe("noam1");
        expect(result2[0].title).toBe("noam2");
        closeSub2();
        await p.flush();
        expect(open).toBe(0);
        get = 0;
        closeSub1 = lqc.subscribe(serverRepo, {}, reducer => {
            result1 = reducer(result1);
        });
        await p.flush();
        expect(open).toBe(1);
        expect(get).toBe(1);
        closeSub1();
        await p.flush();
        expect(open).toBe(0);
    })
});

describe("test live query full cycle", () => {
    beforeEach(() => {
        queryConfig.defaultPageSize = 100;
    });
    afterEach(() => {
        queryConfig.defaultPageSize = 2;
    });
    function setup2() {
        const mem = new InMemoryDataProvider();
        const remult = new Remult(mem);
        const repo = remult.repo(eventTestEntity);
        const remult2 = new Remult(mem);
        const repo2 = remult2.repo(eventTestEntity);

        const mh: ((m: ServerEventMessage) => void)[] = [];
        let messageCount = 0;
        mh.push(() => messageCount++);
        const qm = new LiveQueryPublisher({
            sendQueryMessage: m => mh.forEach(x => x(m)), sendChannelMessage: undefined
        });
        var dataApi = new DataApi(repo, remult, qm);
        const clientStatus = {
            connected: true,
            reconnect: () => { }
        }
        const buildLqc = () => {
            const p = createMockHttpDataProvider(dataApi);
            return new LiveQueryClient({
                async openStreamAndReturnCloseFunction(clientId, onMessage, onReconnect) {
                    clientStatus.connected = true;
                    clientStatus.reconnect = () => {
                        onReconnect();
                        clientStatus.connected = true;
                    };

                    mh.push(m => {
                        if (clientStatus.connected)
                            if (m.clientId === clientId)
                                onMessage({
                                    event: m.queryId,
                                    data: m.message
                                });
                    });
                    return () => {
                    };
                },
            }, {
                get: x => p.get(x),
                delete: x => p.delete(x)
                , post: async (url, data) => {
                    if (url === remult.apiClient.url + '/' + streamUrl) {
                        qm.unsubscribe(data);
                        return "";
                    }
                    return p.post(url, data);
                },
                put: (u, d) => p.put(u, d)

            });
        };
        const lqc1 = buildLqc();
        const lqc2 = buildLqc();

        var pm = new PromiseResolver(lqc1, lqc2, qm);
        remult.liveQueryProvider = lqc1;
        remult2.liveQueryProvider = lqc2;
        remult._changeListener = qm;
        remult2._changeListener = qm;
        return { repo, pm, repo2, messageCount: () => messageCount, clientStatus };
    }
    it("integration test 1", async () => {
        var { repo, pm, repo2 } = setup2();
        let result1: eventTestEntity[] = [];
        repo.query().subscribe(reducer => result1 = reducer(result1));
        await pm.flush();
        expect(result1.length).toBe(0);
        await repo.insert({ id: 1, title: "noam" });
        await repo2.insert({ id: 2, title: "yael" });
        await pm.flush();
        expect(result1.length).toBe(2);
        result1[0] = { ...result1[0], title: 'noam1' };
        await repo2.save({ ...result1[1], title: 'yael2' });
        await pm.flush();
        expect(result1.length).toBe(2);
        expect(result1[0].title).toBe('noam1');
        expect(result1[1].title).toBe('yael2');
        await repo.save(result1[0]);
    });
    it("test delete works", async () => {
        var { repo, pm, repo2 } = setup2();
        let result1: eventTestEntity[] = [];
        repo.query().subscribe(reducer => result1 = reducer(result1));
        await pm.flush();
        await repo.insert({ id: 1, title: "noam" });
        await repo2.insert({ id: 2, title: "yael" });
        await pm.flush();
        await repo.delete(result1[1]);
        await pm.flush();
        expect(result1.length).toBe(1);
    });
    it("test add works if item already in array", async () => {
        var { repo, pm, repo2 } = setup2();
        let result1: eventTestEntity[] = [];
        repo.query().subscribe(reducer => result1 = reducer(result1));
        await pm.flush();
        result1 = [await repo.insert({ id: 1, title: "noam" })];
        await pm.flush();
        expect(result1.length).toBe(1);
    });
    fit("test unsubscribe works", async () => {
        var { repo, pm, messageCount } = setup2();
        let result1: eventTestEntity[] = [];
        const unsubscribe = repo.query().subscribe(reducer => result1 = reducer(result1));
        await pm.flush();
        await repo.insert({ id: 1, title: "noam" });
        await pm.flush();
        expect(result1.length).toBe(1);
        expect(messageCount()).toBe(1);
        unsubscribe();
        await repo.insert({ id: 2, title: 'noam' });
        await pm.flush();
        expect(messageCount()).toBe(1);
    });
    fit("test disconnect and reconnect scenario", async () => {
        var { repo, pm, clientStatus } = setup2();
        let result1: eventTestEntity[] = [];
        repo.query().subscribe(reducer => result1 = reducer(result1));
        await pm.flush();
        await repo.insert({ id: 1, title: "noam" });
        await pm.flush();
        expect(result1.length).toBe(1);
        clientStatus.connected = false;
        await repo.insert({ id: 2, title: "yael" });
        await pm.flush();
        expect(result1.length).toBe(1);
        clientStatus.reconnect();
        expect(clientStatus.connected).toBe(true);
        await pm.flush();
        expect(result1.length).toBe(2);

    });
});
