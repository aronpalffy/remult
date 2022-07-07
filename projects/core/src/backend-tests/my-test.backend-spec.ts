import { IdEntity, SqlDatabase } from "../..";
import { Remult } from "../context";
import { Entity, Field } from "../remult3";
import { KnexDataProvider } from '../../remult-knex';
import * as Knex from 'knex';
import { config } from 'dotenv';
import { testKnexPGSqlImpl, testMongo, testPostgresImplementation } from "./backend-database-test-setup.backend-spec";
import { entityWithValidations } from "../shared-tests/entityWithValidations";
import { PostgresDataProvider } from "../../postgres";
import { MongoDataProvider } from "../../remult-mongo";
config();



testPostgresImplementation("sql filter", async ({ createEntity }) => {
    let s = await entityWithValidations.create4RowsInDp(createEntity);
    expect((await s.find({
        where: SqlDatabase.customFilter(async build => {
            build.sql = s.metadata.fields.myId.options.dbName + ' in (1,3)';
        })
    })).length).toBe(2);
}, false);
testPostgresImplementation("sql filter2", async ({ createEntity }) => {
    let s = await entityWithValidations.create4RowsInDp(createEntity);
    expect((await s.find({
        where:
        {
            $or: [
                SqlDatabase.customFilter(async build => {
                    build.sql = s.metadata.fields.myId.options.dbName + ' in (1,3)';
                })
                , {
                    myId: 2
                }]
        }
    })).length).toBe(3);
}, false);
testKnexPGSqlImpl("knex filter", async ({ createEntity }) => {
    let s = await entityWithValidations.create4RowsInDp(createEntity);
    expect((await s.find({
        where: KnexDataProvider.customFilter(async () => {
            return build => build.whereIn(s.metadata.fields.myId.options.dbName, [1, 3])
        })
    })).length).toBe(2);
}, false);
testKnexPGSqlImpl("knex filter2", async ({ createEntity }) => {
    let s = await entityWithValidations.create4RowsInDp(createEntity);
    expect((await s.find({
        where: {
            $or: [KnexDataProvider.customFilter(async () => {
                return build => build.whereIn(s.metadata.fields.myId.options.dbName, [1, 3])
            }), {
                myId: 4
            }]
        }
    })).length).toBe(3);
}, false);



testPostgresImplementation("work with native sql", async ({ remult, createEntity }) => {
    const repo = await entityWithValidations.create4RowsInDp(createEntity);
    const sql = SqlDatabase.getRawDb(remult);
    const r =
        await sql.execute("select count(*) as c from " + repo.metadata.options.dbName!);
    expect(r.rows[0].c).toBe('4');
}, false);
testPostgresImplementation("work with native sql2", async ({ remult, createEntity }) => {
    const repo = await entityWithValidations.create4RowsInDp(createEntity);
    const sql = PostgresDataProvider.getRawDb(remult);
    const r =
        await sql.query("select count(*) as c from " + repo.metadata.options.dbName!);
    expect(r.rows[0].c).toBe('4');
}, false);
testPostgresImplementation("work with native sql3", async ({ remult, createEntity }) => {
    const repo = await entityWithValidations.create4RowsInDp(createEntity);
    await SqlDatabase.getRawDb(remult)._getSourceSql().transaction(async x => {
        const sql = PostgresDataProvider.getRawDb(new Remult(new SqlDatabase(x)));
        const r =
            await sql.query("select count(*) as c from " + repo.metadata.options.dbName!);
        expect(r.rows[0].c).toBe('4');
    });

}, false);

testKnexPGSqlImpl("work with native knex", async ({ remult, createEntity }) => {
    const repo = await entityWithValidations.create4RowsInDp(createEntity);
    const knex = KnexDataProvider.getRawDb(remult);
    const r = await knex(repo.metadata.options.dbName!).count()
    expect(r[0].count).toBe('4');
}, false);
testKnexPGSqlImpl("work with native knex2", async ({ remult, createEntity }) => {
    const repo = await entityWithValidations.create4RowsInDp(createEntity);
    await (remult._dataSource).transaction(async db => {
        const sql = KnexDataProvider.getRawDb(new Remult(db));
        const r = await sql(repo.metadata.options.dbName!).count()
        expect(r[0].count).toBe('4');
    });

}, false);

testMongo("work with native mongo", async ({ remult, createEntity }) => {
    const repo = await entityWithValidations.create4RowsInDp(createEntity);
    const mongo = MongoDataProvider.getRawDb(remult);
    const r = await (await mongo.collection(repo.metadata.options.dbName!)).countDocuments();
    expect(r).toBe(4);
}, false);
