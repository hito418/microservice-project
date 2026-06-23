import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthUserGuard } from '../auth/auth-user.guard';
import { ConfigModule } from '../config/config.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';

@Module({
    imports: [ConfigModule, JwtModule.register({})],
    controllers: [RealtimeController],
    providers: [AuthUserGuard, RealtimeService],
    exports: [RealtimeService],
})
export class RealtimeModule {}
