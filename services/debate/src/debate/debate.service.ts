import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MessageResponse, ParticipantInfo, RoomResponse } from '@contracts/debate';
import { PARTICIPANT_SIDES } from '@contracts/debate';
import type { MessageRow, ParticipantRow, RoomRow } from '../db/database.types';
import { DebateState, isValidTransition } from './debate-state';
import { RoomRepository } from './room.repository';

const PREP_DURATION_MS = 60_000;
const RUNNING_DURATION_MS = 300_000;

@Injectable()
export class DebateService {
    private readonly logger = new Logger(DebateService.name);

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
            this.schedulePrepTimer(roomId);
        }

        return this.buildResponse(room, participants);
    }

    private schedulePrepTimer(roomId: string): void {
        this.logger.log(`Room ${roomId}: prep timer started (${PREP_DURATION_MS / 1000}s)`);
        setTimeout(() => {
            this.advanceFromPrep(roomId).catch((err: unknown) =>
                this.logger.error(`Room ${roomId}: prep timer failed`, err),
            );
        }, PREP_DURATION_MS);
    }

    private async advanceFromPrep(roomId: string): Promise<void> {
        const room = await this.repo.findById(roomId);
        if (!room || room.state !== DebateState.PREPARATION) return;
        await this.repo.transitionState(roomId, DebateState.PREPARATION, DebateState.RUNNING);
        this.logger.log(`Room ${roomId}: PREPARATION → RUNNING`);
        this.scheduleDebateTimer(roomId);
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

    private scheduleDebateTimer(roomId: string): void {
        this.logger.log(`Room ${roomId}: debate timer started (${RUNNING_DURATION_MS / 1000}s)`);
        setTimeout(() => {
            this.advanceFromRunning(roomId).catch((err: unknown) =>
                this.logger.error(`Room ${roomId}: debate timer failed`, err),
            );
        }, RUNNING_DURATION_MS);
    }

    private async advanceFromRunning(roomId: string): Promise<void> {
        const room = await this.repo.findById(roomId);
        if (!room || room.state !== DebateState.RUNNING) return;
        await this.repo.transitionState(roomId, DebateState.RUNNING, DebateState.VOTING);
        this.logger.log(`Room ${roomId}: RUNNING → VOTING`);
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
