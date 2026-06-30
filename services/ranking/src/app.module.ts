import { Module } from '@nestjs/common';
import { RankingModule } from './ranking/ranking.module';

@Module({
    imports: [RankingModule],
})
export class AppModule {}
