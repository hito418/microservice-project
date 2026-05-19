import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './users/user.entity';

const DB_HOST = process.env.AUTH_DB_HOST ?? '127.0.0.1';
const DB_PORT = Number(process.env.AUTH_DB_PORT ?? 5432);
const DB_USER = process.env.AUTH_DB_USER ?? 'auth';
const DB_PASSWORD = process.env.AUTH_DB_PASSWORD ?? 'auth';
const DB_NAME = process.env.AUTH_DB_NAME ?? 'auth';

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: DB_HOST,
            port: DB_PORT,
            username: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            entities: [User],
            synchronize: process.env.NODE_ENV !== 'production',
        }),
        AuthModule,
    ],
})
export class AppModule {}
