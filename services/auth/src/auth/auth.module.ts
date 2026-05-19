import { Module } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
    controllers: [AuthController],
    providers: [AuthService, UsersRepository],
})
export class AuthModule {}
