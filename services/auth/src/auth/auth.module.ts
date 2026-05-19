import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { DatabaseModule } from '../db/database.module';
import { UsersRepository } from '../users/users.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { resolveJwtConfig } from './jwt.config';

const jwtConfig = resolveJwtConfig();

@Module({
    imports: [
        DatabaseModule,
        JwtModule.register({
            secret: jwtConfig.secret,
            signOptions: { expiresIn: `${jwtConfig.expiresInSeconds}s` },
        }),
    ],
    controllers: [AuthController],
    providers: [
        UsersRepository,
        {
            provide: AuthService,
            inject: [UsersRepository, JwtService],
            useFactory: (users: UsersRepository, jwt: JwtService) =>
                new AuthService(users, jwt, jwtConfig.expiresInSeconds),
        },
    ],
})
export class AuthModule {}
