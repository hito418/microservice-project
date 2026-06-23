import {
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
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import type { Database } from './database.types';

export const PG_POOL = Symbol('PG_POOL');
export const KYSELY = Symbol('KYSELY');

const MIGRATIONS_FOLDER = join(__dirname, 'migrations');

@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: PG_POOL,
            inject: [ConfigService],
            useFactory: (config: ConfigService) =>
                new Pool({
                    host: config.dbHost,
                    port: config.dbPort,
                    user: config.dbUser,
                    password: config.dbPassword,
                    database: config.dbName,
                }),
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

    constructor(
        @Inject(PG_POOL) private readonly pool: Pool,
        private readonly config: ConfigService,
    ) {}

    async onModuleInit(): Promise<void> {
        if (this.config.skipMigrations) return;
        this.logger.log('Running database migrations…');
        const db = drizzle(this.pool);
        await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
        this.logger.log('Migrations complete.');
    }

    async onApplicationShutdown(): Promise<void> {
        await this.pool.end();
    }
}
