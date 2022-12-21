import { v4 as uuid } from 'uuid';
import { itemChange, SubServer } from '../context';
import { findOptionsFromJson, findOptionsToJson } from '../data-providers/rest-data-provider';
import { Repository, FindOptions } from '../remult3';

export class LiveQueryStorageInMemoryImplementation implements LiveQueryStorage {
  debugFileSaver = (x: any) => { };
  debug() {
    this.debugFileSaver(this.queries);
  }
  async keepAliveAndReturnUnknownIds(ids: string[]): Promise<string[]> {
    const result = [];
    for (const id of ids) {
      let q = this.queries.find(q => q.id === id);
      if (q) {
        q.lastUsed = new Date().toISOString()
      } else
        result.push(id);
    }
    this.debug();
    return result;
  }

  queries: (StoredQuery & { lastUsed: string })[] = [];

  constructor() {

  }
  store(query: StoredQuery) {
    this.queries.push({ ...query, lastUsed: new Date().toISOString() });
    this.debug();
  }
  remove(id: any) {
    this.queries = this.queries.filter(q => q.id !== id);
    this.debug();
  }
  async provideListeners(entityKey: string, handle: (args: {
    query: StoredQuery,
    setLastIds(ids: any[]): Promise<void>
  }) => Promise<void>) {
    let d = new Date();
    d.setMinutes(d.getMinutes() - 5);
    this.queries = this.queries.filter(x => x.lastUsed > d.toISOString());
    for (const q of this.queries) {
      if (q.entityKey === entityKey) {
        await handle({
          query: q,
          setLastIds: async ids => { q.lastIds = ids },
        })
      }
    }
    this.debug();
  }
}
/* @internal*/
export declare type PerformWithRequest = (serializedRequest: any, entityKey: string, what: (repo: Repository<any>) => Promise<void>) => Promise<void>;
/* @internal*/
export class LiveQueryPublisher implements LiveQueryChangesListener {

  constructor(public subServer: () => SubServer, public performWithRequest: PerformWithRequest) { }

  runPromise(p: Promise<any>) { }
  debugFileSaver = (x: any) => { };
  itemChanged(entityKey: string, changes: itemChange[]) {
    //TODO 2 - optimize so that the user will get their messages first. Based on user id
    this.runPromise(this.subServer().storage.provideListeners(entityKey,
      async ({ query, setLastIds }) => {
        await this.performWithRequest(query.requestJson, entityKey, async repo => {
          const messages = [];
          const currentItems = await repo.find(findOptionsFromJson(query.findOptionsJson, repo.metadata));
          const currentIds = currentItems.map(x => repo.getEntityRef(x).getId());
          for (const id of query.lastIds.filter(y => !currentIds.includes(y))) {
            let c = changes.find(c => c.oldId == id)
            if (c === undefined || id != c.oldId || !currentIds.includes(c.id))
              messages.push({
                type: "remove",
                data: {
                  id: id
                }
              })
          }
          for (const item of currentItems) {
            const itemRef = repo.getEntityRef(item);
            let c = changes.find(c => c.id == itemRef.getId())
            if (c !== undefined && query.lastIds.includes(c.oldId)) {
              messages.push({
                type: "replace",
                data: {
                  oldId: c.oldId,
                  item: itemRef.toApiJson()
                }
              });
            }
            else if (!query.lastIds.includes(itemRef.getId())) {
              messages.push({
                type: "add",
                data: { item: itemRef.toApiJson() }
              });
            }
          }
          this.debugFileSaver({
            query: query.id,
            currentIds,
            changes,
            lastIds: query.lastIds,
            messages
          });
          await setLastIds(currentIds);
          this.subServer().publisher.sendChannelMessage(query.id, messages);
        })

      }));
  }
}

/* @internal*/
export interface LiveQueryChangesListener {
  itemChanged(entityKey: string, changes: itemChange[]);
}



export interface MessagePublisher {
  sendChannelMessage<T>(channel: string, message: T): void;
}
// TODO2 - PUBNUB
export interface LiveQueryStorage {
  keepAliveAndReturnUnknownIds(ids: string[]): Promise<string[]>
  store(query: StoredQuery): void
  remove(id: any): void
  provideListeners(entityKey: string, handle: (args: {
    query: StoredQuery,
    setLastIds(ids: any[]): Promise<void>
  }) => Promise<void>): Promise<void>

}
interface StoredQuery {
  id: string,
  findOptionsJson: any,
  lastIds: any[],
  requestJson: any,
  entityKey: string
}