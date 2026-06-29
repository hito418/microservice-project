import type {
    ComputeEloForDebateCloseRequest,
    ComputeEloForDebateCloseResponse,
    ComputeXpForDebateCloseRequest,
    ComputeXpForDebateCloseResponse,
    ListUserPerformanceHistoryRequest,
    ListUserPerformanceHistoryResponse,
    PerformanceHistoryItem,
    RecordPerformanceRequest,
} from '@contracts/ranking';
import {
    SCORING_SERVICE_NAME,
    type FinalDebateScoreResponse,
    type ScoringServiceClient,
} from '@contracts/scoring';
import {
    PROFILE_SERVICE_NAME,
    type PlayerStatsResponse,
    type ProfileServiceClient,
} from '@contracts/profile';
import { status } from '@grpc/grpc-js';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { type ClientGrpc, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import type { RankingPerformanceRow } from '../db/database.types';
import {
    DuplicatePerformanceError,
    RankingRepository,
} from './ranking.repository';

@Injectable()
export class RankingService implements OnModuleInit {
    private scoring!: ScoringServiceClient;
    private profile!: ProfileServiceClient;

    constructor(
        private readonly rankingRepository: RankingRepository,
        @Inject('SCORING_CLIENT') private readonly scoringClient: ClientGrpc,
        @Inject('PROFILE_CLIENT') private readonly profileClient: ClientGrpc,
    ) {}

    onModuleInit(): void {
        this.scoring =
            this.scoringClient.getService<ScoringServiceClient>(SCORING_SERVICE_NAME);
        this.profile =
            this.profileClient.getService<ProfileServiceClient>(PROFILE_SERVICE_NAME);
    }

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

    async computeXpForDebateClose(
        request: ComputeXpForDebateCloseRequest,
    ): Promise<ComputeXpForDebateCloseResponse> {
        const finalScore = await this.getFinalScoreOrThrow(request.debateId);
        const forResult = resultForSide(finalScore.winnerSide, 'FOR');
        const againstResult = resultForSide(finalScore.winnerSide, 'AGAINST');
        const forXpDelta = computeXpDelta(forResult, finalScore.finalForScore);
        const againstXpDelta = computeXpDelta(
            againstResult,
            finalScore.finalAgainstScore,
        );

        await Promise.all([
            firstValueFrom(
                this.profile.applyPlayerStatsDelta({
                    userId: request.forUserId,
                    xpDelta: forXpDelta,
                    eloDelta: 0,
                    result: forResult,
                }),
            ),
            firstValueFrom(
                this.profile.applyPlayerStatsDelta({
                    userId: request.againstUserId,
                    xpDelta: againstXpDelta,
                    eloDelta: 0,
                    result: againstResult,
                }),
            ),
        ]);

        const performances = await Promise.all([
            this.recordPerformance({
                userId: request.forUserId,
                debateId: request.debateId,
                side: 'FOR',
                result: forResult,
                finalScore: finalScore.finalForScore,
                opponentScore: finalScore.finalAgainstScore,
                xpDelta: forXpDelta,
                eloDelta: 0,
            }),
            this.recordPerformance({
                userId: request.againstUserId,
                debateId: request.debateId,
                side: 'AGAINST',
                result: againstResult,
                finalScore: finalScore.finalAgainstScore,
                opponentScore: finalScore.finalForScore,
                xpDelta: againstXpDelta,
                eloDelta: 0,
            }),
        ]);

        return {
            debateId: request.debateId,
            winnerSide: finalScore.winnerSide,
            performances,
        };
    }

    async computeEloForDebateClose(
        request: ComputeEloForDebateCloseRequest,
    ): Promise<ComputeEloForDebateCloseResponse> {
        const finalScore = await this.getFinalScoreOrThrow(request.debateId);
        const [forStats, againstStats] = await Promise.all([
            this.getPlayerStatsOrThrow(request.forUserId),
            this.getPlayerStatsOrThrow(request.againstUserId),
        ]);
        const forResult = resultForSide(finalScore.winnerSide, 'FOR');
        const againstResult = resultForSide(finalScore.winnerSide, 'AGAINST');
        const forEloDelta = computeEloDelta(
            forStats.elo,
            againstStats.elo,
            scoreForResult(forResult),
        );
        const againstEloDelta = forEloDelta === 0 ? 0 : -forEloDelta;

        await Promise.all([
            firstValueFrom(
                this.profile.applyPlayerStatsDelta({
                    userId: request.forUserId,
                    xpDelta: 0,
                    eloDelta: forEloDelta,
                    result: forResult,
                }),
            ),
            firstValueFrom(
                this.profile.applyPlayerStatsDelta({
                    userId: request.againstUserId,
                    xpDelta: 0,
                    eloDelta: againstEloDelta,
                    result: againstResult,
                }),
            ),
        ]);

        const performances = await Promise.all([
            this.updatePerformanceEloOrThrow({
                userId: request.forUserId,
                debateId: request.debateId,
                eloDelta: forEloDelta,
            }),
            this.updatePerformanceEloOrThrow({
                userId: request.againstUserId,
                debateId: request.debateId,
                eloDelta: againstEloDelta,
            }),
        ]);

        return {
            debateId: request.debateId,
            winnerSide: finalScore.winnerSide,
            forEloDelta,
            againstEloDelta,
            performances,
        };
    }

    private async getFinalScoreOrThrow(
        debateId: string,
    ): Promise<FinalDebateScoreResponse> {
        try {
            return await firstValueFrom(
                this.scoring.getFinalDebateScore({ debateId }),
            );
        } catch (error) {
            const code = (error as { code?: unknown } | null)?.code;
            if (code === status.NOT_FOUND) {
                throw new RpcException({
                    code: status.FAILED_PRECONDITION,
                    message: `Final score for debate ${debateId} is required before XP computation`,
                });
            }
            throw error;
        }
    }

    private async getPlayerStatsOrThrow(
        userId: string,
    ): Promise<PlayerStatsResponse> {
        try {
            return await firstValueFrom(this.profile.getPlayerStats({ userId }));
        } catch (error) {
            const code = (error as { code?: unknown } | null)?.code;
            if (code === status.NOT_FOUND) {
                throw new RpcException({
                    code: status.FAILED_PRECONDITION,
                    message: `Player stats for user ${userId} are required before Elo computation`,
                });
            }
            throw error;
        }
    }

    private async updatePerformanceEloOrThrow(input: {
        userId: string;
        debateId: string;
        eloDelta: number;
    }): Promise<PerformanceHistoryItem> {
        const row = await this.rankingRepository.updatePerformanceEloDelta(input);
        if (!row) {
            throw new RpcException({
                code: status.FAILED_PRECONDITION,
                message: `Performance history for user ${input.userId} on debate ${input.debateId} is required before Elo computation`,
            });
        }
        return toPerformanceHistoryItem(row);
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

function resultForSide(
    winnerSide: string,
    side: 'FOR' | 'AGAINST',
): 'WIN' | 'LOSS' | 'DRAW' {
    if (winnerSide === 'DRAW') return 'DRAW';
    return winnerSide === side ? 'WIN' : 'LOSS';
}

function computeXpDelta(
    result: 'WIN' | 'LOSS' | 'DRAW',
    finalScore: number,
): number {
    const participation = 10;
    const resultBonus = result === 'WIN' ? 20 : result === 'DRAW' ? 10 : 0;
    return participation + resultBonus + Math.round(finalScore / 10);
}

function scoreForResult(result: 'WIN' | 'LOSS' | 'DRAW'): number {
    if (result === 'WIN') return 1;
    if (result === 'DRAW') return 0.5;
    return 0;
}

function computeEloDelta(
    playerElo: number,
    opponentElo: number,
    actualScore: number,
): number {
    const expectedScore = 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
    return Math.round(32 * (actualScore - expectedScore));
}
