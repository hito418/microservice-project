import { Injectable } from '@nestjs/common';
import type { DebateResponse, UpsertDebateRequest } from '@contracts/scoring';
import type { DebateRow } from '../db/database.types';
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
}

function toResponse(debate: DebateRow): DebateResponse {
    return {
        id: debate.id,
        status: debate.status,
    };
}
