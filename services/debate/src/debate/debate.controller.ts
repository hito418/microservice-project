import { Controller } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import type { CreateRoomRequest, GetReplayRequest, GetRoomRequest, JoinRoomRequest, MessageResponse, ReplayResponse, RoomResponse, SendMessageRequest, TransitionRequest } from '@contracts/debate';
import { createRoomSchema, getReplaySchema, getRoomSchema, joinRoomSchema, sendMessageSchema, transitionSchema } from '@contracts/debate';
import { GrpcUser, type GrpcPrincipal } from '@repo/common/grpc';
import { ZodRpcValidationPipe } from '@repo/common/pipes';
import { DebateService } from './debate.service';
import { DebateState } from './debate-state';

@Controller()
export class DebateController {
    constructor(private readonly svc: DebateService) {}

    @GrpcMethod('DebateService', 'createRoom')
    createRoom(
        @Payload(new ZodRpcValidationPipe(createRoomSchema))
        request: CreateRoomRequest,
    ): Promise<RoomResponse> {
        return this.svc.createRoom(request.debateId);
    }

    @GrpcMethod('DebateService', 'getRoom')
    getRoom(
        @Payload(new ZodRpcValidationPipe(getRoomSchema))
        request: GetRoomRequest,
    ): Promise<RoomResponse> {
        return this.svc.getRoom(request.roomId);
    }

    @GrpcMethod('DebateService', 'transition')
    transition(
        @Payload(new ZodRpcValidationPipe(transitionSchema))
        request: TransitionRequest,
    ): Promise<RoomResponse> {
        return this.svc.transition(request.roomId, request.to as DebateState);
    }

    @GrpcMethod('DebateService', 'joinRoom')
    joinRoom(
        @Payload(new ZodRpcValidationPipe(joinRoomSchema))
        request: JoinRoomRequest,
        @GrpcUser() user: GrpcPrincipal,
    ): Promise<RoomResponse> {
        return this.svc.joinRoom(request.roomId, user.id);
    }

    @GrpcMethod('DebateService', 'sendMessage')
    sendMessage(
        @Payload(new ZodRpcValidationPipe(sendMessageSchema))
        request: SendMessageRequest,
        @GrpcUser() user: GrpcPrincipal,
    ): Promise<MessageResponse> {
        return this.svc.sendMessage(request.roomId, user.id, request.content);
    }

    @GrpcMethod('DebateService', 'getReplay')
    getReplay(
        @Payload(new ZodRpcValidationPipe(getReplaySchema))
        request: GetReplayRequest,
    ): Promise<ReplayResponse> {
        return this.svc.getReplay(request.roomId);
    }
}
