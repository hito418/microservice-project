import { defineConfig } from 'drizzle-kit';

const DB_HOST = process.env.DEBATE_DB_HOST ?? '127.0.0.1';
const DB_PORT = process.env.DEBATE_DB_PORT ?? '5432';
const DB_USER = process.env.DEBATE_DB_USER ?? 'debate';
const DB_PASSWORD = process.env.DEBATE_DB_PASSWORD ?? 'debate';
const DB_NAME = process.env.DEBATE_DB_NAME ?? 'debate';

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dbCredentials: {
        host: DB_HOST,
        port: Number(DB_PORT),
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: false,
    },
});
