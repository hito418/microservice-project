import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    type OnApplicationShutdown,
} from '@nestjs/common';
import type { MessageResponse, ParticipantInfo, ReplayResponse, RoomResponse, TransitionRecord } from '@contracts/debate';
import { PARTICIPANT_SIDES } from '@contracts/debate';
import { Queue } from 'bullmq';
import {
    FINALIZATION_DELAY_MS,
    QUEUE_NAMES,
    redisConnectionFromEnv,
    type FinalizationJob,
    type ReplayAnalysisJob,
} from '@repo/queue';
import type { MessageRow, ParticipantRow, RoomRow, RoomTransitionRow } from '../db/database.types';
import { DebateState, isValidTransition } from './debate-state';
import { RoomRepository } from './room.repository';

const PREP_DURATION_MS = 60_000;
const RUNNING_DURATION_MS = 300_000;

@Injectable()
export class DebateService implements OnApplicationShutdown {
    private readonly logger = new Logger(DebateService.name);

    private readonly replayQueue = new Queue<ReplayAnalysisJob>(QUEUE_NAMES.REPLAY_ANALYSIS, {
        connection: redisConnectionFromEnv(),
    });
    private readonly finalizationQueue = new Queue<FinalizationJob>(QUEUE_NAMES.FINALIZATION, {
        connection: redisConnectionFromEnv(),
    });

    private readonly prepTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly debateTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(@Inject(RoomRepository) private readonly repo: RoomRepository) {}

    async createRoom(debateId: string): Promise<RoomResponse> {
        const room = await this.repo.create(debateId);
        return this.buildResponse(room);
    }

    async getRoom(roomId: string): Promise<RoomResponse> {
        const room = await this.requireRoom(roomId);
        return this.buildResponse(room);
    }

    async transition(roomId: string, to: DebateState): Promise<RoomResponse> {
        const room = await this.requireRoom(roomId);
        const from = room.state as DebateState;

        if (from === to) return this.buildResponse(room);

        if (!isValidTransition(from, to)) {
            throw new BadRequestException(`Invalid transition: ${from} → ${to}`);
        }

        const updated = await this.repo.transitionState(roomId, from, to);

        if (to === DebateState.RUNNING) {
            this.scheduleDebateTimer(roomId, updated.debate_id);
        }

        if (to === DebateState.VOTING) {
            this.clearDebateTimer(roomId);
            await this.enqueueReplayJobs(roomId, updated.debate_id);
        }

        if (to === DebateState.CLOSED) {
            this.clearPrepTimer(roomId);
            this.clearDebateTimer(roomId);
        }

        return this.buildResponse(updated);
    }

    async joinRoom(roomId: string, userId: string): Promise<RoomResponse> {
        const room = await this.requireRoom(roomId);

        if (room.state !== DebateState.PREPARATION) {
            throw new BadRequestException(`Cannot join room in state ${room.state}`);
        }

        const currentParticipants = await this.repo.getParticipants(roomId);

        if (currentParticipants.some((p) => p.user_id === userId)) {
            return this.buildResponse(room, currentParticipants);
        }

        if (currentParticipants.length >= PARTICIPANT_SIDES.length) {
            throw new BadRequestException('Room is already full');
        }

        const takenSides = new Set(currentParticipants.map((p) => p.side));
        const side = PARTICIPANT_SIDES.find((s) => !takenSides.has(s));
        if (!side) throw new BadRequestException('No available side');

        const newParticipant = await this.repo.addParticipant(roomId, userId, side);
        const participants = [...currentParticipants, newParticipant];

        if (participants.length === PARTICIPANT_SIDES.length) {
            const question = await this.repo.randomQuestion();
            if (question) {
                await this.repo.setQuestion(roomId, question.id);
                room.question_id = question.id;
            }
            this.schedulePrepTimer(roomId, room.debate_id);
        }

        return this.buildResponse(room, participants);
    }

    async sendMessage(roomId: string, userId: string, content: string): Promise<MessageResponse> {
        const room = await this.requireRoom(roomId);

        if (room.state !== DebateState.RUNNING) {
            throw new BadRequestException(`Cannot send message in room state ${room.state}`);
        }

        const participants = await this.repo.getParticipants(roomId);
        const participant = participants.find((p) => p.user_id === userId);
        if (!participant) {
            throw new BadRequestException('User is not a participant in this room');
        }

        const msg = await this.repo.saveMessage(roomId, userId, content);
        return toMessageResponse(msg, participant.side);
    }

    async getReplay(roomId: string): Promise<ReplayResponse> {
        const room = await this.requireRoom(roomId);
        const [participants, messages, transitions] = await Promise.all([
            this.repo.getParticipants(roomId),
            this.repo.getMessages(roomId),
            this.repo.getTransitions(roomId),
        ]);

        const sideByUser = new Map(participants.map((p) => [p.user_id, p.side]));
        const question = room.question_id
            ? await this.repo.getQuestionById(room.question_id)
            : undefined;

        return {
            roomId: room.id,
            debateId: room.debate_id,
            state: room.state,
            question: question?.content ?? '',
            participants: participants.map(toParticipantInfo),
            messages: messages.map((m) => toMessageResponse(m, sideByUser.get(m.user_id) ?? '')),
            transitions: transitions.map(toTransitionRecord),
        };
    }

    async onApplicationShutdown(): Promise<void> {
        for (const t of this.prepTimers.values()) clearTimeout(t);
        for (const t of this.debateTimers.values()) clearTimeout(t);
        await Promise.all([this.replayQueue.close(), this.finalizationQueue.close()]);
    }

    private schedulePrepTimer(roomId: string, debateId: string): void {
        const timer = setTimeout(() => {
            this.prepTimers.delete(roomId);
            this.transition(roomId, DebateState.RUNNING).catch((err: unknown) =>
                this.logger.error(`Room ${roomId}: prep timer transition failed`, err),
            );
        }, PREP_DURATION_MS);
        this.prepTimers.set(roomId, timer);
        this.logger.log(`Room ${roomId} (debate ${debateId}): prep timer started`);
    }

    private scheduleDebateTimer(roomId: string, debateId: string): void {
        const timer = setTimeout(() => {
            this.debateTimers.delete(roomId);
            this.transition(roomId, DebateState.VOTING).catch((err: unknown) =>
                this.logger.error(`Room ${roomId}: debate timer transition failed`, err),
            );
        }, RUNNING_DURATION_MS);
        this.debateTimers.set(roomId, timer);
        this.logger.log(`Room ${roomId} (debate ${debateId}): debate timer started`);
    }

    private clearPrepTimer(roomId: string): void {
        const t = this.prepTimers.get(roomId);
        if (t) { clearTimeout(t); this.prepTimers.delete(roomId); }
    }

    private clearDebateTimer(roomId: string): void {
        const t = this.debateTimers.get(roomId);
        if (t) { clearTimeout(t); this.debateTimers.delete(roomId); }
    }

    private async enqueueReplayJobs(roomId: string, debateId: string): Promise<void> {
        const now = Date.now();
        await Promise.all([
            this.replayQueue.add(QUEUE_NAMES.REPLAY_ANALYSIS, { debateId, roomId, enqueuedAt: now }),
            this.finalizationQueue.add(
                QUEUE_NAMES.FINALIZATION,
                { debateId, roomId, closedAt: now },
                { delay: FINALIZATION_DELAY_MS },
            ),
        ]);
        this.logger.log(`Room ${roomId} (debate ${debateId}): enqueued replay + finalization jobs`);
    }

    private async buildResponse(room: RoomRow, participants?: ParticipantRow[]): Promise<RoomResponse> {
        const parts = participants ?? (await this.repo.getParticipants(room.id));
        const question = room.question_id
            ? await this.repo.getQuestionById(room.question_id)
            : undefined;

        return {
            id: room.id,
            debateId: room.debate_id,
            state: room.state,
            question: question?.content ?? '',
            participants: parts.map(toParticipantInfo),
            createdAt: room.created_at.toISOString(),
            updatedAt: room.updated_at.toISOString(),
        };
    }

    private async requireRoom(roomId: string): Promise<RoomRow> {
        const room = await this.repo.findById(roomId);
        if (!room) throw new NotFoundException(`Room ${roomId} not found`);
        return room;
    }
}

function toParticipantInfo(p: ParticipantRow): ParticipantInfo {
    return { userId: p.user_id, side: p.side, joinedAt: p.joined_at.toISOString() };
}

function toMessageResponse(m: MessageRow, side: string): MessageResponse {
    return {
        id: m.id,
        roomId: m.room_id,
        userId: m.user_id,
        side,
        content: m.content,
        sentAt: m.sent_at.toISOString(),
    };
}

function toTransitionRecord(t: RoomTransitionRow): TransitionRecord {
    return { from: t.from_state, to: t.to_state, at: t.transitioned_at.toISOString() };
}
