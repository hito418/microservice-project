import { Injectable } from '@nestjs/common';
import type {
    AiAnalysisResultResponse,
    DebateResponse,
    GetAiAnalysisResultRequest,
    StoreAiAnalysisResultRequest,
    UpsertDebateRequest,
} from '@contracts/scoring';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import type { DebateAiAnalysisResultRow, DebateRow } from '../db/database.types';
import { ScoringRepository } from './scoring.repository';

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
