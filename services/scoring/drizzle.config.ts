import { defineConfig } from 'drizzle-kit';

const DB_HOST = process.env.SCORING_DB_HOST ?? '127.0.0.1';
const DB_PORT = process.env.SCORING_DB_PORT ?? '5432';
const DB_USER = process.env.SCORING_DB_USER ?? 'scoring';
const DB_PASSWORD = process.env.SCORING_DB_PASSWORD ?? 'scoring';
const DB_NAME = process.env.SCORING_DB_NAME ?? 'scoring';

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
