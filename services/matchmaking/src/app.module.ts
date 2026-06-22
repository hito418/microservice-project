import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';

@Module({
    imports: [ConfigModule, MatchmakingModule],
})
export class AppModule {}
