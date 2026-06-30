import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { DatabaseModule } from '../db/database.module';
import { ProfileClientModule } from '../profile/profile-client.module';
import { UsersRepository } from '../users/users.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
    imports: [
        ConfigModule,
        DatabaseModule,
        ProfileClientModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                privateKey: config.jwtPrivateKey,
                signOptions: {
                    algorithm: config.jwtAlgorithm,
                    expiresIn: `${config.jwtExpiresInSeconds}s`,
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        UsersRepository,
        AuthService,
    ],
})
export class AuthModule {}
