import { Module } from '@nestjs/common';
import { DebateJobsModule } from '../jobs/debate-jobs.module';
import { VotesModule } from '../votes/votes.module';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';
import { ScoringRepositoryModule } from './scoring-repository.module';

@Module({
    imports: [ScoringRepositoryModule, VotesModule, DebateJobsModule],
    controllers: [ScoringController],
    providers: [ScoringService],
})
export class ScoringModule {}
