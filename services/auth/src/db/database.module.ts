import {
    Global,
    Inject,
    Logger,
    Module,
    type OnApplicationShutdown,
    type OnModuleInit,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { join } from 'node:path';
import type { Database } from './database.types';

export const PG_POOL = Symbol('PG_POOL');
export const KYSELY = Symbol('KYSELY');

const MIGRATIONS_FOLDER = join(__dirname, 'migrations');

function buildPool(): Pool {
    return new Pool({
        host: process.env.AUTH_DB_HOST ?? '127.0.0.1',
        port: Number(process.env.AUTH_DB_PORT ?? 5432),
        user: process.env.AUTH_DB_USER ?? 'auth',
        password: process.env.AUTH_DB_PASSWORD ?? 'auth',
        database: process.env.AUTH_DB_NAME ?? 'auth',
    });
}

@Global()
@Module({
    providers: [
        {
            provide: PG_POOL,
            useFactory: buildPool,
        },
        {
            provide: KYSELY,
            inject: [PG_POOL],
            useFactory: (pool: Pool) =>
                new Kysely<Database>({
                    dialect: new PostgresDialect({ pool }),
                }),
        },
    ],
    exports: [KYSELY, PG_POOL],
})
export class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(DatabaseModule.name);

    constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

    async onModuleInit(): Promise<void> {
        if (process.env.AUTH_SKIP_MIGRATIONS === 'true') return;
        this.logger.log('Running database migrations…');
        const db = drizzle(this.pool);
        await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
        this.logger.log('Migrations complete.');
    }

    async onApplicationShutdown(): Promise<void> {
        await this.pool.end();
    }
}
