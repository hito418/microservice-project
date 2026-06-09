import { Module } from '@nestjs/common';
import { ScoringRepositoryModule } from '../scoring/scoring-repository.module';
import { SpectatorVotesService } from './spectator-votes.service';

@Module({
    imports: [ScoringRepositoryModule],
    providers: [SpectatorVotesService],
    exports: [SpectatorVotesService],
})
export class VotesModule {}
