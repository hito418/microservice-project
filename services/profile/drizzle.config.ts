import { defineConfig } from 'drizzle-kit';

const DB_HOST = process.env.PROFILE_DB_HOST ?? '127.0.0.1';
const DB_PORT = process.env.PROFILE_DB_PORT ?? '5432';
const DB_USER = process.env.PROFILE_DB_USER ?? 'profile';
const DB_PASSWORD = process.env.PROFILE_DB_PASSWORD ?? 'profile';
const DB_NAME = process.env.PROFILE_DB_NAME ?? 'profile';

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
