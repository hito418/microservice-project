import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Debate } from '../debates/debate.model';
import { SpectatorVote } from '../votes/spectator-vote.model';
import {
    CreateSpectatorVoteRecord,
    DuplicateSpectatorVoteError,
    ScoringRepository,
    UpsertDebateRecord,
} from './scoring.repository';

@Injectable()
export class InMemoryScoringRepository implements ScoringRepository {
    private readonly debates = new Map<string, Debate>();
    private readonly votes = new Map<string, SpectatorVote>();

    async findDebateById(debateId: string): Promise<Debate | undefined> {
        return this.debates.get(debateId);
    }

    async upsertDebate(input: UpsertDebateRecord): Promise<Debate> {
        const debate: Debate = {
            id: input.debateId,
            status: input.status,
        };
        this.debates.set(input.debateId, debate);
        return debate;
    }

    async findVoteByDebateAndUser(
        debateId: string,
        userId: string,
    ): Promise<SpectatorVote | undefined> {
        return this.votes.get(this.voteKey(debateId, userId));
    }

    async createSpectatorVote(input: CreateSpectatorVoteRecord): Promise<SpectatorVote> {
        const key = this.voteKey(input.debateId, input.userId);

        if (this.votes.has(key)) {
            throw new DuplicateSpectatorVoteError(input.debateId, input.userId);
        }

        const vote: SpectatorVote = {
            id: randomUUID(),
            debateId: input.debateId,
            userId: input.userId,
            side: input.side,
            createdAt: new Date(),
        };
        this.votes.set(key, vote);
        return vote;
    }

    seedDebate(debate: Debate): void {
        this.debates.set(debate.id, debate);
    }

    private voteKey(debateId: string, userId: string): string {
        return `${debateId}:${userId}`;
    }
}
