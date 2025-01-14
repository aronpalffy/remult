import { queuedJobInfoResponse } from '../src/server-action';
import { DataProvider } from '../src/data-interfaces';
import { Remult, UserInfo } from '../src/context';
import { ClassType } from '../classType';
import { Repository } from '../src/remult3';
import { IdEntity } from '../src/id-entity';
import { LiveQueryStorage, SubscriptionServer } from '../src/live-query/SubscriptionServer';
export interface RemultServerOptions<RequestType extends GenericRequest> {
    /** Sets a database connection for Remult.
     *
     * @see [Connecting to a Database](https://remult.dev/docs/databases.html).
    */
    dataProvider?: DataProvider | Promise<DataProvider> | (() => Promise<DataProvider | undefined>);
    queueStorage?: QueueStorage;
    liveQueryStorage?: LiveQueryStorage;
    subscriptionServer?: SubscriptionServer;
    initRequest?: (request: RequestType, options: InitRequestOptions) => Promise<void>;
    requestSerializer?: {
        toJson: (request: RequestType) => any;
        fromJson: (request: any) => RequestType;
    };
    /** Will create tables and columns in supporting databases. default: true
     *
     * @description
     * when set to true, it'll create entities that do not exist, and add columns that are missing.
    */
    ensureSchema?: boolean;
    getUser?: (request: RequestType) => Promise<UserInfo | undefined>;
    initApi?: (remult: Remult) => void | Promise<void>;
    logApiEndPoints?: boolean;
    defaultGetLimit?: number;
    entities?: ClassType<any>[];
    controllers?: ClassType<any>[];
    rootPath?: string;
}
export interface InitRequestOptions {
    liveQueryStorage: LiveQueryStorage;
    readonly remult: Remult;
}
export declare function createRemultServerCore<RequestType extends GenericRequest = GenericRequest>(options?: RemultServerOptions<RequestType>): RemultServer;
export declare type GenericRequestHandler = (req: GenericRequest, res: GenericResponse, next: VoidFunction) => void;
export interface ServerHandleResponse {
    data?: any;
    statusCode: number;
}
export interface RemultServer {
    getRemult(req: GenericRequest): Promise<Remult>;
    openApiDoc(options: {
        title: string;
        version?: string;
    }): any;
    registerRouter(r: GenericRouter): void;
    handle(req: GenericRequest, gRes?: GenericResponse): Promise<ServerHandleResponse | undefined>;
    withRemult(req: GenericRequest, res: GenericResponse, next: VoidFunction): any;
}
export declare type GenericRouter = {
    route(path: string): SpecificRoute;
};
export declare type SpecificRoute = {
    get(handler: GenericRequestHandler): SpecificRoute;
    put(handler: GenericRequestHandler): SpecificRoute;
    post(handler: GenericRequestHandler): SpecificRoute;
    delete(handler: GenericRequestHandler): SpecificRoute;
};
export interface GenericRequest {
    url?: string;
    method?: any;
    body?: any;
    query?: any;
    params?: any;
}
export interface GenericResponse {
    json(data: any): any;
    status(statusCode: number): GenericResponse;
    end(): any;
}
export declare class RemultAsyncLocalStorage {
    private readonly remultObjectStorage;
    static enable(): void;
    static disable(): void;
    constructor(remultObjectStorage: import('async_hooks').AsyncLocalStorage<Remult>);
    run(remult: Remult, callback: VoidFunction): void;
    getRemult(): Remult;
    static instance: RemultAsyncLocalStorage;
}
export interface queuedJobInfo {
    info: queuedJobInfoResponse;
    userId: string;
    setErrorResult(error: any): void;
    setResult(result: any): void;
    setProgress(progress: number): void;
}
export interface QueueStorage {
    createJob(url: string, userId: string): Promise<string>;
    getJobInfo(queuedJobId: string): Promise<queuedJobInfo>;
}
export declare class EntityQueueStorage implements QueueStorage {
    private repo;
    constructor(repo: Repository<JobsInQueueEntity>);
    sync: Promise<any>;
    doSync<T>(what: () => Promise<T>): Promise<any>;
    getJobInfo(queuedJobId: string): Promise<queuedJobInfo>;
    createJob(url: string, userId: string): Promise<string>;
}
export declare class JobsInQueueEntity extends IdEntity {
    userId: string;
    url: string;
    submitTime: Date;
    doneTime: Date;
    result: string;
    done: boolean;
    error: boolean;
    progress: number;
}
