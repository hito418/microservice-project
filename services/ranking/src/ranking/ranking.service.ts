import type {
    ListUserPerformanceHistoryRequest,
    ListUserPerformanceHistoryResponse,
    PerformanceHistoryItem,
    RecordPerformanceRequest,
} from '@contracts/ranking';
import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { RankingPerformanceRow } from '../db/database.types';
import {
    DuplicatePerformanceError,
    RankingRepository,
} from './ranking.repository';

@Injectable()
export class RankingService {
    constructor(private readonly rankingRepository: RankingRepository) {}

    async recordPerformance(
        request: RecordPerformanceRequest,
    ): Promise<PerformanceHistoryItem> {
        try {
            const row = await this.rankingRepository.recordPerformance({
                userId: request.userId,
                debateId: request.debateId,
                side: request.side,
                result: request.result,
                finalScore: request.finalScore,
                opponentScore: request.opponentScore ?? null,
                xpDelta: request.xpDelta,
                eloDelta: request.eloDelta,
            });
            return toPerformanceHistoryItem(row);
        } catch (error) {
            if (error instanceof DuplicatePerformanceError) {
                throw new RpcException({
                    code: status.ALREADY_EXISTS,
                    message: error.message,
                });
            }
            throw error;
        }
    }

    async listUserPerformanceHistory(
        request: ListUserPerformanceHistoryRequest,
    ): Promise<ListUserPerformanceHistoryResponse> {
        const limit = request.limit ?? 20;
        const offset = request.offset ?? 0;
        const [items, total] = await Promise.all([
            this.rankingRepository.listUserPerformanceHistory({
                userId: request.userId,
                limit,
                offset,
            }),
            this.rankingRepository.countUserPerformanceHistory(request.userId),
        ]);

        return {
            items: items.map(toPerformanceHistoryItem),
            total,
        };
    }
}

function toPerformanceHistoryItem(
    row: RankingPerformanceRow,
): PerformanceHistoryItem {
    return {
        id: row.id,
        userId: row.user_id,
        debateId: row.debate_id,
        side: row.side,
        result: row.result,
        finalScore: row.final_score,
        opponentScore: row.opponent_score ?? undefined,
        xpDelta: row.xp_delta,
        eloDelta: row.elo_delta,
        createdAt: row.created_at.toISOString(),
    };
}
