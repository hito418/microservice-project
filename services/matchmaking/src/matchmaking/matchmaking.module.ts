import { Module } from '@nestjs/common';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingRepository } from './matchmaking.repository';
import { MatchmakingService } from './matchmaking.service';
import { RedisModule } from './redis.module';

@Module({
    imports: [RedisModule],
    controllers: [MatchmakingController],
    providers: [MatchmakingService, MatchmakingRepository],
})
export class MatchmakingModule {}
