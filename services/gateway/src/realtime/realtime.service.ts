import type {
    DebateStartedPayload,
    LeaderboardUpdatedPayload,
    MessageCreatedPayload,
    PrepStartedPayload,
    RealtimeConnectedPayload,
    RealtimeEvent,
    RealtimeEventBase,
    ResultPublishedPayload,
    RoomReadyPayload,
    SidesAssignedPayload,
    TopicRevealedPayload,
    VotePayload,
} from '@contracts/realtime';
import type { SpectatorVoteResponse } from '@contracts/scoring';
import { Injectable, type MessageEvent } from '@nestjs/common';
import type { Subscriber } from 'rxjs';
import { Observable } from 'rxjs';

const HEARTBEAT_INTERVAL_MS = 30_000;

type ChannelScope = 'room' | 'debate' | 'user' | 'leaderboard';

interface Channel {
    scope: ChannelScope;
    id: string;
}

type EventDraft<TEvent extends RealtimeEvent> = Omit<TEvent, 'occurredAt'> & {
    occurredAt?: string;
};

@Injectable()
export class RealtimeService {
    private readonly subscribersByChannel = new Map<
        string,
        Set<Subscriber<MessageEvent>>
    >();
    private nextEventId = 0;

    streamRoom(roomId: string, userId: string): Observable<MessageEvent> {
        return this.createStream(
            [
                { scope: 'room', id: roomId },
                { scope: 'user', id: userId },
            ],
            {
                stream: 'room',
                streamId: roomId,
            },
            { roomId, userId },
        );
    }

    streamDebate(debateId: string, userId: string): Observable<MessageEvent> {
        return this.createStream(
            [
                { scope: 'debate', id: debateId },
                { scope: 'user', id: userId },
            ],
            {
                stream: 'debate',
                streamId: debateId,
            },
            { userId },
        );
    }

    streamCurrentUser(userId: string): Observable<MessageEvent> {
        return this.createStream(
            [{ scope: 'user', id: userId }],
            {
                stream: 'user',
                streamId: userId,
            },
            { userId },
        );
    }

    streamLeaderboard(userId: string): Observable<MessageEvent> {
        return this.createStream(
            [
                { scope: 'leaderboard', id: 'global' },
                { scope: 'user', id: userId },
            ],
            {
                stream: 'leaderboard',
                streamId: 'leaderboard',
            },
            { userId },
        );
    }

    // TODO: wire these publish* hooks from the future room/topic/message/result
    // services once those domain modules exist in the monorepo.
    publishRoomReady(input: {
        roomId: string;
        debateId?: string;
        participantCount?: number;
        occurredAt?: string;
    }): RealtimeEventBase<'room.ready', RoomReadyPayload> {
        const event = this.withOccurredAt<
            RealtimeEventBase<'room.ready', RoomReadyPayload>
        >({
            type: 'room.ready',
            roomId: input.roomId,
            payload: {
                roomId: input.roomId,
                debateId: input.debateId,
                participantCount: input.participantCount,
            },
            occurredAt: input.occurredAt,
        });
        this.publishToChannels([{ scope: 'room', id: input.roomId }], event);
        return event;
    }

    publishTopicRevealed(input: {
        roomId: string;
        payload: TopicRevealedPayload;
        occurredAt?: string;
    }): RealtimeEventBase<'topic.revealed', TopicRevealedPayload> {
        return this.publishRoomEvent<
            RealtimeEventBase<'topic.revealed', TopicRevealedPayload> & {
                roomId: string;
            }
        >({
            type: 'topic.revealed',
            roomId: input.roomId,
            payload: input.payload,
            occurredAt: input.occurredAt,
        });
    }

    publishSidesAssigned(input: {
        roomId: string;
        payload: SidesAssignedPayload;
        occurredAt?: string;
    }): RealtimeEventBase<'sides.assigned', SidesAssignedPayload> {
        return this.publishRoomEvent<
            RealtimeEventBase<'sides.assigned', SidesAssignedPayload> & {
                roomId: string;
            }
        >({
            type: 'sides.assigned',
            roomId: input.roomId,
            payload: input.payload,
            occurredAt: input.occurredAt,
        });
    }

    publishPrepStarted(input: {
        roomId: string;
        payload: PrepStartedPayload;
        occurredAt?: string;
    }): RealtimeEventBase<'prep.started', PrepStartedPayload> {
        return this.publishRoomEvent<
            RealtimeEventBase<'prep.started', PrepStartedPayload> & {
                roomId: string;
            }
        >({
            type: 'prep.started',
            roomId: input.roomId,
            payload: input.payload,
            occurredAt: input.occurredAt,
        });
    }

    publishDebateStarted(input: {
        roomId: string;
        payload: DebateStartedPayload;
        occurredAt?: string;
    }): RealtimeEventBase<'debate.started', DebateStartedPayload> {
        const event = this.publishRoomEvent<
            RealtimeEventBase<'debate.started', DebateStartedPayload> & {
                roomId: string;
            }
        >({
            type: 'debate.started',
            roomId: input.roomId,
            payload: input.payload,
            occurredAt: input.occurredAt,
        });
        if (input.payload.debateId) {
            this.publishToChannels(
                [{ scope: 'debate', id: input.payload.debateId }],
                event,
            );
        }
        return event;
    }

    publishMessageCreated(input: {
        roomId: string;
        payload: MessageCreatedPayload;
        occurredAt?: string;
    }): RealtimeEventBase<'message.created', MessageCreatedPayload> {
        return this.publishRoomEvent<
            RealtimeEventBase<'message.created', MessageCreatedPayload> & {
                roomId: string;
            }
        >({
            type: 'message.created',
            roomId: input.roomId,
            userId: input.payload.authorUserId,
            payload: input.payload,
            occurredAt: input.occurredAt,
        });
    }

    publishVoteCreated(
        vote: SpectatorVoteResponse,
    ): RealtimeEventBase<'vote.created', VotePayload> {
        const event = this.withOccurredAt<
            RealtimeEventBase<'vote.created', VotePayload>
        >({
            type: 'vote.created',
            userId: vote.userId,
            payload: {
                voteId: vote.id,
                debateId: vote.debateId,
                userId: vote.userId,
                side: vote.side,
                createdAt: vote.createdAt,
            },
            occurredAt: vote.createdAt,
        });
        this.publishToChannels(
            [
                { scope: 'debate', id: vote.debateId },
                { scope: 'user', id: vote.userId },
            ],
            event,
        );
        return event;
    }

    publishVoteUpdated(input: {
        payload: VotePayload;
        occurredAt?: string;
    }): RealtimeEventBase<'vote.updated', VotePayload> {
        const event = this.withOccurredAt<
            RealtimeEventBase<'vote.updated', VotePayload>
        >({
            type: 'vote.updated',
            userId: input.payload.userId,
            payload: input.payload,
            occurredAt: input.occurredAt,
        });
        this.publishToChannels(
            [
                { scope: 'debate', id: input.payload.debateId },
                { scope: 'user', id: input.payload.userId },
            ],
            event,
        );
        return event;
    }

    publishResultPublished(input: {
        roomId?: string;
        payload: ResultPublishedPayload;
        occurredAt?: string;
    }): RealtimeEventBase<'result.published', ResultPublishedPayload> {
        const event = this.withOccurredAt<
            RealtimeEventBase<'result.published', ResultPublishedPayload>
        >({
            type: 'result.published',
            roomId: input.roomId,
            payload: input.payload,
            occurredAt: input.occurredAt,
        });
        this.publishToChannels(this.resultChannels(input.roomId, input.payload), event);
        return event;
    }

    publishLeaderboardUpdated(input: {
        roomId?: string;
        payload: LeaderboardUpdatedPayload;
        occurredAt?: string;
    }): RealtimeEventBase<'leaderboard.updated', LeaderboardUpdatedPayload> {
        const event = this.withOccurredAt<
            RealtimeEventBase<'leaderboard.updated', LeaderboardUpdatedPayload>
        >({
            type: 'leaderboard.updated',
            roomId: input.roomId,
            payload: input.payload,
            occurredAt: input.occurredAt,
        });
        const channels: Channel[] = [{ scope: 'leaderboard', id: 'global' }];
        if (input.roomId) {
            channels.push({ scope: 'room', id: input.roomId });
        }
        this.publishToChannels(channels, event);
        return event;
    }

    getSubscriberCount(scope: ChannelScope, id: string): number {
        return this.subscribersByChannel.get(this.channelKey({ scope, id }))?.size ?? 0;
    }

    private createStream(
        channels: Channel[],
        connectedPayload: RealtimeConnectedPayload,
        context: { roomId?: string; userId?: string },
    ): Observable<MessageEvent> {
        return new Observable<MessageEvent>((subscriber) => {
            const uniqueChannels = this.uniqueChannels(channels);
            for (const channel of uniqueChannels) {
                this.addSubscriber(channel, subscriber);
            }

            subscriber.next(
                this.toMessage(
                    this.withOccurredAt<
                        RealtimeEventBase<'realtime.connected', RealtimeConnectedPayload>
                    >({
                        type: 'realtime.connected',
                        roomId: context.roomId,
                        userId: context.userId,
                        payload: connectedPayload,
                    }),
                ),
            );

            const heartbeat = setInterval(() => {
                subscriber.next(
                    this.toMessage(
                        this.withOccurredAt<
                            RealtimeEventBase<'realtime.ping', Record<string, never>>
                        >({
                            type: 'realtime.ping',
                            roomId: context.roomId,
                            userId: context.userId,
                            payload: {},
                        }),
                    ),
                );
            }, HEARTBEAT_INTERVAL_MS);
            heartbeat.unref?.();

            return () => {
                clearInterval(heartbeat);
                for (const channel of uniqueChannels) {
                    this.removeSubscriber(channel, subscriber);
                }
            };
        });
    }

    private publishRoomEvent<
        TEvent extends RealtimeEvent & { roomId: string },
    >(draft: EventDraft<TEvent>): TEvent {
        const event = this.withOccurredAt<TEvent>(draft);
        this.publishToChannels([{ scope: 'room', id: event.roomId }], event);
        return event;
    }

    private publishToChannels(channels: Channel[], event: RealtimeEvent): void {
        const message = this.toMessage(event);
        const delivered = new Set<Subscriber<MessageEvent>>();
        for (const channel of this.uniqueChannels(channels)) {
            const subscribers = this.subscribersByChannel.get(this.channelKey(channel));
            if (!subscribers) continue;
            for (const subscriber of subscribers) {
                if (delivered.has(subscriber)) continue;
                delivered.add(subscriber);
                subscriber.next(message);
            }
        }
    }

    private resultChannels(
        roomId: string | undefined,
        payload: ResultPublishedPayload,
    ): Channel[] {
        const channels: Channel[] = [];
        if (roomId) {
            channels.push({ scope: 'room', id: roomId });
        }
        if (payload.debateId) {
            channels.push({ scope: 'debate', id: payload.debateId });
        }
        return channels;
    }

    private addSubscriber(
        channel: Channel,
        subscriber: Subscriber<MessageEvent>,
    ): void {
        const key = this.channelKey(channel);
        const subscribers = this.subscribersByChannel.get(key) ?? new Set();
        subscribers.add(subscriber);
        this.subscribersByChannel.set(key, subscribers);
    }

    private removeSubscriber(
        channel: Channel,
        subscriber: Subscriber<MessageEvent>,
    ): void {
        const key = this.channelKey(channel);
        const subscribers = this.subscribersByChannel.get(key);
        if (!subscribers) return;
        subscribers.delete(subscriber);
        if (subscribers.size === 0) {
            this.subscribersByChannel.delete(key);
        }
    }

    private toMessage(event: RealtimeEvent): MessageEvent {
        return {
            id: `${Date.now()}-${++this.nextEventId}`,
            type: event.type,
            data: event,
        };
    }

    private withOccurredAt<TEvent extends RealtimeEvent>(
        draft: EventDraft<TEvent>,
    ): TEvent {
        return {
            ...draft,
            occurredAt: draft.occurredAt ?? new Date().toISOString(),
        } as TEvent;
    }

    private uniqueChannels(channels: Channel[]): Channel[] {
        const seen = new Set<string>();
        const result: Channel[] = [];
        for (const channel of channels) {
            const key = this.channelKey(channel);
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(channel);
        }
        return result;
    }

    private channelKey(channel: Channel): string {
        return `${channel.scope}:${channel.id}`;
    }
}
