import {
    type ComputeFinalDebateScoreRequest,
    type FinalDebateScoreResponse,
    SCORING_SERVICE_NAME,
    type ScoringServiceClient,
} from '@contracts/scoring';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

export const SCORING_CLIENT = 'SCORING_CLIENT';

/**
 * Promise-returning facade over the scoring gRPC client so the processor never
 * touches RxJS. Only the methods this runner needs are exposed.
 */
@Injectable()
export class ScoringClient implements OnModuleInit {
    private scoring!: ScoringServiceClient;

    constructor(@Inject(SCORING_CLIENT) private readonly client: ClientGrpc) {}

    onModuleInit(): void {
        this.scoring =
            this.client.getService<ScoringServiceClient>(SCORING_SERVICE_NAME);
    }

    computeFinalDebateScore(
        request: ComputeFinalDebateScoreRequest,
    ): Promise<FinalDebateScoreResponse> {
        return lastValueFrom(this.scoring.computeFinalDebateScore(request));
    }
}
