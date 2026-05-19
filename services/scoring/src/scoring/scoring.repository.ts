import { Debate } from '../debates/debate.model';
import { SpectatorVote, SpectatorVoteSide } from '../votes/spectator-vote.model';

export const SCORING_REPOSITORY = Symbol('SCORING_REPOSITORY');

export class DuplicateSpectatorVoteError extends Error {
    constructor(debateId: string, userId: string) {
        super(`User ${userId} already voted on debate ${debateId}`);
    }
}

export type CreateSpectatorVoteRecord = {
    debateId: string;
    userId: string;
    side: SpectatorVoteSide;
};

export type UpsertDebateRecord = {
    debateId: string;
    status: Debate['status'];
};

export interface ScoringRepository {
    findDebateById(debateId: string): Promise<Debate | undefined>;
    upsertDebate(input: UpsertDebateRecord): Promise<Debate>;
    findVoteByDebateAndUser(
        debateId: string,
        userId: string,
    ): Promise<SpectatorVote | undefined>;
    findVotesByDebateId(debateId: string): Promise<SpectatorVote[]>;
    createSpectatorVote(input: CreateSpectatorVoteRecord): Promise<SpectatorVote>;
}
