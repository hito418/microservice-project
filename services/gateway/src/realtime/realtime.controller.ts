import { Controller, Param, Sse, UseGuards } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthUserGuard } from '../auth/auth-user.guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { RealtimeService } from './realtime.service';

@Controller()
@UseGuards(AuthUserGuard)
export class RealtimeController {
    constructor(private readonly realtime: RealtimeService) {}

    @Sse('rooms/:roomId/realtime')
    streamRoom(
        @Param('roomId') roomId: string,
        @CurrentUser() user: AuthenticatedUser,
    ): Observable<MessageEvent> {
        return this.realtime.streamRoom(roomId, user.id);
    }

    @Sse('debates/:debateId/realtime')
    streamDebate(
        @Param('debateId') debateId: string,
        @CurrentUser() user: AuthenticatedUser,
    ): Observable<MessageEvent> {
        return this.realtime.streamDebate(debateId, user.id);
    }

    @Sse('users/me/realtime')
    streamCurrentUser(
        @CurrentUser() user: AuthenticatedUser,
    ): Observable<MessageEvent> {
        return this.realtime.streamCurrentUser(user.id);
    }

    @Sse('leaderboard/realtime')
    streamLeaderboard(
        @CurrentUser() user: AuthenticatedUser,
    ): Observable<MessageEvent> {
        return this.realtime.streamLeaderboard(user.id);
    }
}
