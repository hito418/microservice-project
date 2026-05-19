import { BadRequestException, Controller, HttpException, Inject } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { isDebateStatus } from '../debates/debate.model';
import type { Debate } from '../debates/debate.model';
import { SCORING_REPOSITORY } from './scoring.repository';
import type { ScoringRepository } from './scoring.repository';
import type { SpectatorVote } from '../votes/spectator-vote.model';
import { SpectatorVotesService } from '../votes/spectator-votes.service';
import type { CreateSpectatorVoteCommand } from '../votes/spectator-votes.service';

type UpsertDebateCommand = {
    debateId?: string;
    status?: string;
};

@Controller()
export class ScoringController {
    constructor(
        private readonly spectatorVotes: SpectatorVotesService,
        @Inject(SCORING_REPOSITORY)
        private readonly scoringRepository: ScoringRepository,
    ) {}

    @MessagePattern({ cmd: 'scoring.spectator-vote.create' })
    async createSpectatorVote(
        @Payload() payload: CreateSpectatorVoteCommand,
    ): Promise<SpectatorVote> {
        try {
            return await this.spectatorVotes.createVote(payload);
        } catch (error) {
            if (error instanceof HttpException) {
                throw new RpcException({
                    statusCode: error.getStatus(),
                    message: this.getHttpExceptionMessage(error),
                });
            }
            throw error;
        }
    }

    @MessagePattern({ cmd: 'scoring.debate.upsert' })
    async upsertDebate(@Payload() payload: UpsertDebateCommand | undefined): Promise<Debate> {
        try {
            const debateId = payload?.debateId?.trim();

            if (!debateId) {
                throw new BadRequestException('debateId is required');
            }

            if (!payload?.status || !isDebateStatus(payload.status)) {
                throw new BadRequestException('status is invalid');
            }

            return await this.scoringRepository.upsertDebate({
                debateId,
                status: payload.status,
            });
        } catch (error) {
            if (error instanceof HttpException) {
                throw new RpcException({
                    statusCode: error.getStatus(),
                    message: this.getHttpExceptionMessage(error),
                });
            }
            throw error;
        }
    }

    private getHttpExceptionMessage(error: HttpException): string {
        const response = error.getResponse();

        if (typeof response === 'string') {
            return response;
        }

        if (
            typeof response === 'object' &&
            response !== null &&
            'message' in response
        ) {
            const message = response.message;

            if (Array.isArray(message)) {
                return message.join(', ');
            }

            if (typeof message === 'string') {
                return message;
            }
        }

        return error.message;
    }
}
