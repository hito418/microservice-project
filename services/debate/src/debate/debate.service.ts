import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RoomResponse } from '@contracts/debate';
import { DebateState, isValidTransition } from './debate-state';
import { RoomRepository } from './room.repository';
import type { RoomRow } from '../db/database.types';

@Injectable()
export class DebateService {
    constructor(@Inject(RoomRepository) private readonly repo: RoomRepository) {}

    async createRoom(debateId: string): Promise<RoomResponse> {
        const room = await this.repo.create(debateId);
        return toRoomResponse(room);
    }

    async getRoom(roomId: string): Promise<RoomResponse> {
        const room = await this.requireRoom(roomId);
        return toRoomResponse(room);
    }

    async transition(roomId: string, to: DebateState): Promise<RoomResponse> {
        const room = await this.requireRoom(roomId);
        const from = room.state as DebateState;

        if (from === to) return toRoomResponse(room);

        if (!isValidTransition(from, to)) {
            throw new BadRequestException(`Invalid transition: ${from} → ${to}`);
        }

        const updated = await this.repo.transitionState(roomId, from, to);
        return toRoomResponse(updated);
    }

    private async requireRoom(roomId: string): Promise<RoomRow> {
        const room = await this.repo.findById(roomId);
        if (!room) throw new NotFoundException(`Room ${roomId} not found`);
        return room;
    }
}

function toRoomResponse(room: RoomRow): RoomResponse {
    return {
        id: room.id,
        debateId: room.debate_id,
        state: room.state,
        question: '',
        participants: [],
        createdAt: room.created_at.toISOString(),
        updatedAt: room.updated_at.toISOString(),
    };
}
