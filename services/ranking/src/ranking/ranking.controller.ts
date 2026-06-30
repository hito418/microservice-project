import {
    type ComputeEloForDebateCloseRequest,
    type ComputeEloForDebateCloseResponse,
    computeEloForDebateCloseSchema,
    type ComputeXpForDebateCloseRequest,
    type ComputeXpForDebateCloseResponse,
    computeXpForDebateCloseSchema,
    type GetLeaderboardRequest,
    type GetLeaderboardResponse,
    getLeaderboardSchema,
    type ListUserPerformanceHistoryRequest,
    type ListUserPerformanceHistoryResponse,
    listUserPerformanceHistorySchema,
    type PerformanceHistoryItem,
    type RankingServiceController,
    RankingServiceControllerMethods,
    type RecordPerformanceRequest,
    recordPerformanceSchema,
} from '@contracts/ranking';
import { Controller } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { ZodRpcValidationPipe } from '@repo/common/pipes';
import { RankingService } from './ranking.service';

@Controller()
@RankingServiceControllerMethods()
export class RankingController implements RankingServiceController {
    constructor(private readonly rankingService: RankingService) {}

    recordPerformance(
        @Payload(new ZodRpcValidationPipe(recordPerformanceSchema))
        request: RecordPerformanceRequest,
    ): Promise<PerformanceHistoryItem> {
        return this.rankingService.recordPerformance(request);
    }

    listUserPerformanceHistory(
        @Payload(new ZodRpcValidationPipe(listUserPerformanceHistorySchema))
        request: ListUserPerformanceHistoryRequest,
    ): Promise<ListUserPerformanceHistoryResponse> {
        return this.rankingService.listUserPerformanceHistory(request);
    }

    computeXpForDebateClose(
        @Payload(new ZodRpcValidationPipe(computeXpForDebateCloseSchema))
        request: ComputeXpForDebateCloseRequest,
    ): Promise<ComputeXpForDebateCloseResponse> {
        return this.rankingService.computeXpForDebateClose(request);
    }

    computeEloForDebateClose(
        @Payload(new ZodRpcValidationPipe(computeEloForDebateCloseSchema))
        request: ComputeEloForDebateCloseRequest,
    ): Promise<ComputeEloForDebateCloseResponse> {
        return this.rankingService.computeEloForDebateClose(request);
    }

    getLeaderboard(
        @Payload(new ZodRpcValidationPipe(getLeaderboardSchema))
        request: GetLeaderboardRequest,
    ): Promise<GetLeaderboardResponse> {
        return this.rankingService.getLeaderboard(request);
    }
}
