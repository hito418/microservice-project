import { Injectable } from '@nestjs/common';
import type {
    AiAnalysisResultResponse,
    ComputeFinalDebateScoreRequest,
    DebateResponse,
    FinalDebateScoreResponse,
    FinalScoreWinnerSide,
    GetAiAnalysisResultRequest,
    GetFinalDebateScoreRequest,
    GetRandomRecentDebateForVotingRequest,
    RandomRecentDebateForVotingResponse,
    StoreAiAnalysisResultRequest,
    UpsertDebateRequest,
} from '@contracts/scoring';
import {
    DEFAULT_RANDOM_DEBATE_CANDIDATE_POOL_SIZE,
    DEFAULT_RANDOM_DEBATE_MAX_AGE_MINUTES,
} from '@contracts/scoring';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import type {
    DebateAiAnalysisResultRow,
    DebateFinalScoreRow,
    DebateRow,
} from '../db/database.types';
import { ScoringRepository } from './scoring.repository';

const MAX_RANDOM_DEBATE_AGE_MINUTES = 1440;
const MAX_RANDOM_DEBATE_CANDIDATE_POOL_SIZE = 100;
const VOTABLE_DEBATE_STATUSES = ['RUNNING', 'VOTING'] as const;
const MILLIS_PER_MINUTE = 60_000;

@Injectable()
export class ScoringService {
    constructor(private readonly scoringRepository: ScoringRepository) {}

    async upsertDebate(
        request: UpsertDebateRequest,
    ): Promise<DebateResponse> {
        const debate = await this.scoringRepository.upsertDebate({
            debateId: request.debateId,
            status: request.status,
        });
        return toResponse(debate);
    }

    async storeAiAnalysisResult(
        request: StoreAiAnalysisResultRequest,
    ): Promise<AiAnalysisResultResponse> {
        const debate = await this.scoringRepository.findDebateById(request.debateId);
        if (!debate) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `Debate ${request.debateId} was not found`,
            });
        }

        const result = await this.scoringRepository.upsertAiAnalysisResult({
            debateId: request.debateId,
            status: request.status,
            summary: request.summary,
            forScore: request.forScore,
            againstScore: request.againstScore,
            forFeedback: request.forFeedback,
            againstFeedback: request.againstFeedback,
            errorMessage: request.errorMessage,
        });

        return toAiAnalysisResponse(result);
    }

    async getAiAnalysisResult(
        request: GetAiAnalysisResultRequest,
    ): Promise<AiAnalysisResultResponse> {
        const result = await this.scoringRepository.findAiAnalysisResultByDebateId(
            request.debateId,
        );
        if (!result) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `AI analysis result for debate ${request.debateId} was not found`,
            });
        }

        return toAiAnalysisResponse(result);
    }

    async computeFinalDebateScore(
        request: ComputeFinalDebateScoreRequest,
    ): Promise<FinalDebateScoreResponse> {
        const debate = await this.scoringRepository.findDebateById(request.debateId);
        if (!debate) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `Debate ${request.debateId} was not found`,
            });
        }

        const aiAnalysis =
            await this.scoringRepository.findAiAnalysisResultByDebateId(
                request.debateId,
            );
        if (!aiAnalysis) {
            throw new RpcException({
                code: status.FAILED_PRECONDITION,
                message: `AI analysis result for debate ${request.debateId} is required before final scoring`,
            });
        }

        if (aiAnalysis.status !== 'COMPLETED') {
            throw new RpcException({
                code: status.FAILED_PRECONDITION,
                message: `AI analysis result for debate ${request.debateId} is not completed`,
            });
        }

        if (aiAnalysis.for_score === null || aiAnalysis.against_score === null) {
            throw new RpcException({
                code: status.FAILED_PRECONDITION,
                message: `AI analysis result for debate ${request.debateId} has no scores`,
            });
        }

        const audienceSummary = await this.getAudienceScores(request.debateId);
        const finalForScore = weightedScore(
            aiAnalysis.for_score,
            audienceSummary.forScore,
        );
        const finalAgainstScore = weightedScore(
            aiAnalysis.against_score,
            audienceSummary.againstScore,
        );

        const finalScore = await this.scoringRepository.upsertFinalDebateScore({
            debateId: request.debateId,
            aiForScore: aiAnalysis.for_score,
            aiAgainstScore: aiAnalysis.against_score,
            audienceForScore: audienceSummary.forScore,
            audienceAgainstScore: audienceSummary.againstScore,
            finalForScore,
            finalAgainstScore,
            winnerSide: winnerSide(finalForScore, finalAgainstScore),
        });

        return toFinalDebateScoreResponse(finalScore);
    }

    async getFinalDebateScore(
        request: GetFinalDebateScoreRequest,
    ): Promise<FinalDebateScoreResponse> {
        const result = await this.scoringRepository.findFinalDebateScoreByDebateId(
            request.debateId,
        );
        if (!result) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: `Final score for debate ${request.debateId} was not found`,
            });
        }

        return toFinalDebateScoreResponse(result);
    }

    async getRandomRecentDebateForVoting(
        request: GetRandomRecentDebateForVotingRequest,
    ): Promise<RandomRecentDebateForVotingResponse> {
        const maxAgeMinutes = boundedInteger(
            request.maxAgeMinutes,
            DEFAULT_RANDOM_DEBATE_MAX_AGE_MINUTES,
            MAX_RANDOM_DEBATE_AGE_MINUTES,
            'maxAgeMinutes',
        );
        const candidatePoolSize = boundedInteger(
            request.candidatePoolSize,
            DEFAULT_RANDOM_DEBATE_CANDIDATE_POOL_SIZE,
            MAX_RANDOM_DEBATE_CANDIDATE_POOL_SIZE,
            'candidatePoolSize',
        );
        const cutoff = new Date(Date.now() - maxAgeMinutes * MILLIS_PER_MINUTE);

        const candidates = await this.scoringRepository.findRecentDebatesForVoting({
            cutoff,
            limit: candidatePoolSize,
            statuses: VOTABLE_DEBATE_STATUSES,
        });
        if (candidates.length === 0) {
            throw new RpcException({
                code: status.NOT_FOUND,
                message: 'No recent debate is available for voting',
            });
        }

        const candidate =
            candidates[Math.floor(Math.random() * candidates.length)] ??
            candidates[0];

        return {
            debateId: candidate.debateId,
            status: candidate.status,
            voteCount: candidate.voteCount,
            referenceTime: candidate.referenceTime.toISOString(),
        };
    }

    private async getAudienceScores(
        debateId: string,
    ): Promise<{ forScore: number; againstScore: number }> {
        const counts = await this.scoringRepository.countSpectatorVotesBySide(debateId);
        const forVotes = countSide(counts, 'FOR');
        const againstVotes = countSide(counts, 'AGAINST');
        const totalVotes = forVotes + againstVotes;

        return {
            forScore: percentageScore(forVotes, totalVotes),
            againstScore: percentageScore(againstVotes, totalVotes),
        };
    }
}

function toResponse(debate: DebateRow): DebateResponse {
    return {
        id: debate.id,
        status: debate.status,
    };
}

function toAiAnalysisResponse(
    row: DebateAiAnalysisResultRow,
): AiAnalysisResultResponse {
    return {
        debateId: row.debate_id,
        status: row.status,
        summary: row.summary ?? undefined,
        forScore: row.for_score ?? undefined,
        againstScore: row.against_score ?? undefined,
        forFeedback: row.for_feedback ?? undefined,
        againstFeedback: row.against_feedback ?? undefined,
        errorMessage: row.error_message ?? undefined,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

function toFinalDebateScoreResponse(
    row: DebateFinalScoreRow,
): FinalDebateScoreResponse {
    return {
        debateId: row.debate_id,
        aiForScore: row.ai_for_score,
        aiAgainstScore: row.ai_against_score,
        audienceForScore: row.audience_for_score,
        audienceAgainstScore: row.audience_against_score,
        finalForScore: row.final_for_score,
        finalAgainstScore: row.final_against_score,
        winnerSide: row.winner_side,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
    };
}

function countSide(
    counts: Array<{ side: string; votes: number }>,
    side: 'FOR' | 'AGAINST',
): number {
    return counts.find((count) => count.side === side)?.votes ?? 0;
}

function percentageScore(votes: number, totalVotes: number): number {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
}

function weightedScore(aiScore: number, audienceScore: number): number {
    return Math.round(aiScore * 0.5 + audienceScore * 0.5);
}

function winnerSide(
    finalForScore: number,
    finalAgainstScore: number,
): FinalScoreWinnerSide {
    if (finalForScore > finalAgainstScore) return 'FOR';
    if (finalAgainstScore > finalForScore) return 'AGAINST';
    return 'DRAW';
}

function boundedInteger(
    value: number | undefined,
    fallback: number,
    max: number,
    fieldName: string,
): number {
    const resolved = value ?? fallback;
    if (!Number.isInteger(resolved) || resolved < 1 || resolved > max) {
        throw new RpcException({
            code: status.INVALID_ARGUMENT,
            message: `${fieldName} must be an integer between 1 and ${max}`,
        });
    }
    return resolved;
}
