import { Module } from '@nestjs/common';
import { InMemoryScoringRepository } from './scoring/in-memory-scoring.repository';
import { ScoringController } from './scoring/scoring.controller';
import { SCORING_REPOSITORY } from './scoring/scoring.repository';
import { SpectatorVotesService } from './votes/spectator-votes.service';

@Module({
    controllers: [ScoringController],
    providers: [
        SpectatorVotesService,
        {
            provide: SCORING_REPOSITORY,
            useClass: InMemoryScoringRepository,
        },
    ],
})
export class AppModule {}
