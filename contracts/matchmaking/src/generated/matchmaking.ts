import type { Observable } from 'rxjs';

export const MATCHMAKING_V1_PACKAGE_NAME = 'matchmaking.v1';
export const MATCHMAKING_SERVICE_NAME = 'MatchmakingService';

export interface LaunchDebateRequest {}

export interface GetMatchStatusRequest {}

export interface CancelMatchmakingRequest {}

export interface MatchResponse {
  userId: string;
  /** One of: WAITING | MATCHED | CANCELLED | NOT_IN_QUEUE */
  status: string;
  /** Populated when status is MATCHED */
  debateRoomId: string;
  debateId: string;
  /** Unix epoch in milliseconds */
  queuedAt: number;
}

export interface CancelMatchmakingResponse {
  cancelled: boolean;
}

export interface MatchmakingServiceClient {
  launchDebate(request: LaunchDebateRequest, ...rest: unknown[]): Observable<MatchResponse>;
  getMatchStatus(request: GetMatchStatusRequest, ...rest: unknown[]): Observable<MatchResponse>;
  cancelMatchmaking(request: CancelMatchmakingRequest, ...rest: unknown[]): Observable<CancelMatchmakingResponse>;
}

export interface MatchmakingServiceController {
  launchDebate(request: LaunchDebateRequest, ...rest: unknown[]): Promise<MatchResponse> | Observable<MatchResponse> | MatchResponse;
  getMatchStatus(request: GetMatchStatusRequest, ...rest: unknown[]): Promise<MatchResponse> | Observable<MatchResponse> | MatchResponse;
  cancelMatchmaking(request: CancelMatchmakingRequest, ...rest: unknown[]): Promise<CancelMatchmakingResponse> | Observable<CancelMatchmakingResponse> | CancelMatchmakingResponse;
}
