import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DebateStatus } from '../debates/debate.model';
import {
    DuplicateSpectatorVoteError,
    SCORING_REPOSITORY,
} from '../scoring/scoring.repository';
import type { ScoringRepository } from '../scoring/scoring.repository';
import {
    SpectatorVoteSide,
    isSpectatorVoteSide,
} from './spectator-vote.model';
import type { SpectatorVote } from './spectator-vote.model';

const VOTABLE_STATUSES = new Set<DebateStatus>([
    DebateStatus.Running,
    DebateStatus.Voting,
]);

export type CreateSpectatorVoteCommand = {
    debateId: string;
    userId: string;
    side: string | undefined;
};

@Injectable()
export class SpectatorVotesService {
    constructor(
        @Inject(SCORING_REPOSITORY)
        private readonly scoringRepository: ScoringRepository,
    ) {}

    async createVote(command: CreateSpectatorVoteCommand): Promise<SpectatorVote> {
        const debateId = command.debateId.trim();
        const userId = command.userId.trim();

        if (debateId.length === 0) {
            throw new BadRequestException('debateId is required');
        }

        if (!command.side || !isSpectatorVoteSide(command.side)) {
            throw new BadRequestException(
                `side must be one of: ${SpectatorVoteSide.For}, ${SpectatorVoteSide.Against}`,
            );
        }

        const debate = await this.scoringRepository.findDebateById(debateId);
        if (!debate) {
            throw new NotFoundException(`Debate ${debateId} was not found`);
        }

        if (!VOTABLE_STATUSES.has(debate.status)) {
            throw new ConflictException(
                `Debate ${debateId} is not open for spectator votes`,
            );
        }

        const existingVote = await this.scoringRepository.findVoteByDebateAndUser(
            debateId,
            userId,
        );
        if (existingVote) {
            throw new ConflictException(`User ${userId} already voted on debate ${debateId}`);
        }

        try {
            return await this.scoringRepository.createSpectatorVote({
                debateId,
                userId,
                side: command.side,
            });
        } catch (error) {
            if (error instanceof DuplicateSpectatorVoteError) {
                throw new ConflictException(`User ${userId} already voted on debate ${debateId}`);
            }
            throw error;
        }
    }
}
