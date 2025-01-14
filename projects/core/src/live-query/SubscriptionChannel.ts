import { EntityOrderBy, remult as defaultRemult, Remult, Repository, Sort } from '../../index';
import { LiveQueryChangeInfo } from '../remult3';
import { getId } from '../remult3/getId';
import { v4 as uuid } from 'uuid'
import { LiveQueryChangesListener } from './SubscriptionServer';
import { getLiveQueryChannel } from '../data-api';

export const streamUrl = 'stream';
//@internal
export class LiveQuerySubscriber<entityType> {
    sendDefaultState(onResult: (info: LiveQueryChangeInfo<entityType>) => void) {
        onResult(this.createReducerType(() => [...this.defaultQueryState], this.allItemsMessage(this.defaultQueryState)))
    }
    queryChannel: string;
    subscribeCode: () => void;
    unsubscribe: VoidFunction = () => { };
    async setAllItems(result: any[]) {
        const items = await Promise.all(result.map(item => this.repo.fromJson(item)));
        this.forListeners(listener => {
            listener(x => {
                return items;
            });
        }, this.allItemsMessage(items));
    }

    private allItemsMessage(items: entityType[]): LiveQueryChange[] {
        return [
            {
                type: "all",
                data: items
            }
        ];
    }

    forListeners(what: (listener: (((reducer: (prevState: entityType[]) => entityType[]) => void))) => void, changes: LiveQueryChange[]) {
        what(reducer => {
            this.defaultQueryState = reducer(this.defaultQueryState);
            if (changes.find(c => c.type === "add" || c.type === "replace")) {
                if (this.query.orderBy) {
                    const o = Sort.translateOrderByToSort(this.repo.metadata, this.query.orderBy);
                    this.defaultQueryState.sort((a: any, b: any) => o.compare(a, b));
                }
            }
        })

        for (const l of this.listeners) {
            what(reducer => {
                l.next(this.createReducerType(reducer, changes))
            })
        }
    }

    private createReducerType(applyChanges: (prevState: entityType[]) => entityType[], changes: LiveQueryChange[]): LiveQueryChangeInfo<entityType> {
        return {
            applyChanges,
            changes,
            items: this.defaultQueryState
        };
    }

    async handle(messages: LiveQueryChange[]) {
        for (const m of messages) {
            switch (m.type) {
                case "add":
                case "replace":
                    m.data.item = await this.repo.fromJson(m.data.item);
                    break;
                case "all":
                    this.setAllItems(m.data);
            }
        }

        this.forListeners(listener => {
            listener(items => {
                if (!items)
                    items = [];
                for (const message of messages) {
                    switch (message.type) {
                        case "all":
                            this.setAllItems(message.data);
                            break;
                        case "replace": {
                            items = items.map(x => getId(this.repo.metadata, x) === message.data.oldId ? message.data.item : x)
                            break;
                        }
                        case "add":
                            items = items.filter(x => getId(this.repo.metadata, x) !== getId(this.repo.metadata, message.data.item));
                            items.push(message.data.item);
                            break;
                        case "remove":
                            items = items.filter(x => getId(this.repo.metadata, x) !== message.data.id);
                            break;
                    };
                }
                return items;
            });
        }, messages);
    }

    defaultQueryState: entityType[] = [];
    listeners: SubscriptionListener<LiveQueryChangeInfo<entityType>>[] = [];
    id = uuid()
    constructor(private repo: Repository<entityType>, private query: SubscribeToQueryArgs<entityType>, userId: string) {
        this.queryChannel = getLiveQueryChannel(this.id, userId);
    }

}

export interface SubscriptionListener<type> {
    next(message: type): void;
    error(err: any): void
    complete(): void
}

export type Unsubscribe = VoidFunction;
export interface SubscriptionClientConnection {
    subscribe(channel: string, onMessage: (message: any) => void, onError: (err: any) => void): Promise<Unsubscribe>;
    close(): void;
}

export interface SubscriptionClient {
    openConnection(onReconnect: VoidFunction): Promise<SubscriptionClientConnection>;
}


export const liveQueryKeepAliveRoute = '_liveQueryKeepAlive';



interface SubscribeToQueryArgs<entityType = any> {
    entityKey: string,
    orderBy?: EntityOrderBy<entityType>
}
export declare type LiveQueryChange = {
    type: "all",
    data: any[]
} | {
    type: "add"
    data: any
} | {
    type: 'replace',
    data: {
        oldId: any,
        item: any
    }
} | {
    type: "remove",
    data: { id: any }
}
//@internal
export interface SubscribeResult {
    result: [],
    queryChannel: string
}


//@internal
export interface ServerEventChannelSubscribeDTO {
    clientId: string,
    channel: string
}
export class SubscriptionChannel<messageType> {


    constructor(public channelKey: string) {


    }
    publish(message: messageType, remult?: Remult) {
        remult = remult || defaultRemult;
        remult.subscriptionServer.publishMessage(this.channelKey, message);
    }
    subscribe(next: (message: messageType) => void, remult?: Remult)
    subscribe(listener: Partial<SubscriptionListener<messageType>>)
    //@internal
    subscribe(next: ((message: messageType) => void) | Partial<SubscriptionListener<messageType>>, remult?: Remult) {
        remult = remult || defaultRemult;

        let listener = next as Partial<SubscriptionListener<messageType>>;
        if (typeof (next) === "function") {
            listener = {
                next
            }
        }
        listener.error ??= () => { };
        listener.complete ??= () => { };

        return remult.liveQuerySubscriber.subscribeChannel(this.channelKey, listener as SubscriptionListener<messageType>);
    }
}




//TODO2 - consider moving the queued job mechanism into this.