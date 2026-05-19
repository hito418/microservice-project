import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { UsersRepository } from '../users/users.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
    imports: [DatabaseModule],
    controllers: [AuthController],
    providers: [AuthService, UsersRepository],
})
export class AuthModule {}
