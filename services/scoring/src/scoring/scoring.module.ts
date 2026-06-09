import { Module } from '@nestjs/common';
import { VotesModule } from '../votes/votes.module';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';
import { ScoringRepositoryModule } from './scoring-repository.module';

@Module({
    imports: [ScoringRepositoryModule, VotesModule],
    controllers: [ScoringController],
    providers: [ScoringService],
})
export class ScoringModule {}
