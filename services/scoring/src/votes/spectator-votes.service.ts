import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type {
    CreateSpectatorVoteRequest,
    SpectatorVoteResponse,
} from '@contracts/scoring';
import type { SpectatorVoteRow } from '../db/database.types';
import {
    DuplicateSpectatorVoteError,
    ScoringRepository,
} from '../scoring/scoring.repository';

const VOTABLE_STATUSES = new Set<string>(['RUNNING', 'VOTING']);

@Injectable()
export class SpectatorVotesService {
    constructor(private readonly scoringRepository: ScoringRepository) {}

    async createVote(
        request: CreateSpectatorVoteRequest,
        userId: string,
    ): Promise<SpectatorVoteResponse> {
        const { debateId, side } = request;

        const debate = await this.scoringRepository.findDebateById(debateId);
        if (!debate) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `Debate ${debateId} was not found`,
            });
        }

        if (!VOTABLE_STATUSES.has(debate.status)) {
            throw new RpcException({
                code: status.FAILED_PRECONDITION,
                message: `Debate ${debateId} is not open for spectator votes`,
            });
        }

        const existingVote = await this.scoringRepository.findVoteByDebateAndUser(
            debateId,
            userId,
        );
        if (existingVote) {
            throw new RpcException({
                code: status.ALREADY_EXISTS,
                message: `User ${userId} already voted on debate ${debateId}`,
            });
        }

        try {
            const vote = await this.scoringRepository.createSpectatorVote({
                debateId,
                userId,
                side,
            });
            return toResponse(vote);
        } catch (error) {
            if (error instanceof DuplicateSpectatorVoteError) {
                throw new RpcException({
                    code: status.ALREADY_EXISTS,
                    message: `User ${userId} already voted on debate ${debateId}`,
                });
            }
            throw error;
        }
    }
}

function toResponse(vote: SpectatorVoteRow): SpectatorVoteResponse {
    return {
        id: vote.id,
        debateId: vote.debate_id,
        userId: vote.user_id,
        side: vote.side,
        createdAt: vote.created_at.toISOString(),
    };
}
