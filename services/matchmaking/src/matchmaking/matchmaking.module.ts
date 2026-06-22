import { Module } from '@nestjs/common';
import { DebateModule } from '../debate/debate.module';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingRepository } from './matchmaking.repository';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingTimeoutWorker } from './matchmaking-timeout.worker';
import { RedisModule } from './redis.module';

@Module({
    imports: [RedisModule, DebateModule],
    controllers: [MatchmakingController],
    providers: [MatchmakingService, MatchmakingRepository, MatchmakingTimeoutWorker],
})
export class MatchmakingModule {}
