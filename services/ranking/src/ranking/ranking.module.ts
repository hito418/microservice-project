import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { RankingController } from './ranking.controller';
import { RankingRepository } from './ranking.repository';
import { RankingService } from './ranking.service';

@Module({
    imports: [DatabaseModule],
    controllers: [RankingController],
    providers: [RankingRepository, RankingService],
})
export class RankingModule {}
