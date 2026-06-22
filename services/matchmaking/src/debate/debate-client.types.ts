import type { Observable } from 'rxjs';

export const DEBATE_V1_PACKAGE_NAME = 'debate.v1';
export const DEBATE_SERVICE_NAME = 'DebateService';

export interface CreateRoomRequest {
    debateId: string;
}

export interface JoinRoomRequest {
    roomId: string;
}

export interface RoomResponse {
    id: string;
    debateId: string;
    state: string;
}

export interface DebateServiceClient {
    createRoom(request: CreateRoomRequest, ...rest: unknown[]): Observable<RoomResponse>;
    joinRoom(request: JoinRoomRequest, ...rest: unknown[]): Observable<RoomResponse>;
}
