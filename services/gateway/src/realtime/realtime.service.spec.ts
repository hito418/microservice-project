import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RealtimeEvent } from '@contracts/realtime';
import type { MessageEvent } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

function eventData(message: MessageEvent): RealtimeEvent {
    return message.data as RealtimeEvent;
}

describe('RealtimeService', () => {
    it('emits a connected event and cleans up subscriptions on unsubscribe', () => {
        const service = new RealtimeService();
        const messages: MessageEvent[] = [];

        const subscription = service
            .streamRoom('room-1', 'user-1')
            .subscribe((message) => messages.push(message));

        assert.equal(service.getSubscriberCount('room', 'room-1'), 1);
        assert.equal(service.getSubscriberCount('user', 'user-1'), 1);
        assert.equal(messages.length, 1);
        assert.equal(messages[0]?.type, 'realtime.connected');
        assert.deepEqual(eventData(messages[0]).payload, {
            stream: 'room',
            streamId: 'room-1',
        });

        subscription.unsubscribe();

        assert.equal(service.getSubscriberCount('room', 'room-1'), 0);
        assert.equal(service.getSubscriberCount('user', 'user-1'), 0);
    });

    it('broadcasts room events only to subscribers for that room', () => {
        const service = new RealtimeService();
        const roomMessages: MessageEvent[] = [];
        const otherRoomMessages: MessageEvent[] = [];

        const roomSubscription = service
            .streamRoom('room-1', 'user-1')
            .subscribe((message) => roomMessages.push(message));
        const otherRoomSubscription = service
            .streamRoom('room-2', 'user-2')
            .subscribe((message) => otherRoomMessages.push(message));

        const event = service.publishTopicRevealed({
            roomId: 'room-1',
            payload: { topicId: 'topic-1', title: 'AI in schools' },
            occurredAt: '2026-01-01T00:00:00.000Z',
        });

        assert.equal(event.type, 'topic.revealed');
        assert.equal(roomMessages.length, 2);
        assert.equal(otherRoomMessages.length, 1);
        assert.equal(roomMessages[1]?.type, 'topic.revealed');
        assert.deepEqual(eventData(roomMessages[1]).payload, {
            topicId: 'topic-1',
            title: 'AI in schools',
        });
        assert.equal(
            eventData(roomMessages[1]).occurredAt,
            '2026-01-01T00:00:00.000Z',
        );

        roomSubscription.unsubscribe();
        otherRoomSubscription.unsubscribe();
    });

    it('publishes vote.created to debate and user channels without duplicates', () => {
        const service = new RealtimeService();
        const debateMessages: MessageEvent[] = [];
        const otherDebateMessages: MessageEvent[] = [];

        const debateSubscription = service
            .streamDebate('debate-1', 'user-1')
            .subscribe((message) => debateMessages.push(message));
        const otherDebateSubscription = service
            .streamDebate('debate-2', 'user-2')
            .subscribe((message) => otherDebateMessages.push(message));

        const event = service.publishVoteCreated({
            id: 'vote-1',
            debateId: 'debate-1',
            userId: 'user-1',
            side: 'FOR',
            createdAt: '2026-01-01T00:00:00.000Z',
        });

        assert.equal(event.type, 'vote.created');
        assert.equal(debateMessages.length, 2);
        assert.equal(otherDebateMessages.length, 1);
        assert.equal(debateMessages[1]?.type, 'vote.created');
        assert.deepEqual(eventData(debateMessages[1]).payload, {
            voteId: 'vote-1',
            debateId: 'debate-1',
            userId: 'user-1',
            side: 'FOR',
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        assert.equal(
            eventData(debateMessages[1]).occurredAt,
            '2026-01-01T00:00:00.000Z',
        );

        debateSubscription.unsubscribe();
        otherDebateSubscription.unsubscribe();
    });
});
