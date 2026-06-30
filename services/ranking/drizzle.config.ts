import { defineConfig } from 'drizzle-kit';

const DB_HOST = process.env.RANKING_DB_HOST ?? '127.0.0.1';
const DB_PORT = process.env.RANKING_DB_PORT ?? '5432';
const DB_USER = process.env.RANKING_DB_USER ?? 'ranking';
const DB_PASSWORD = process.env.RANKING_DB_PASSWORD ?? 'ranking';
const DB_NAME = process.env.RANKING_DB_NAME ?? 'ranking';

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
