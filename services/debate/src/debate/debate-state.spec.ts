import { describe, expect, it } from 'vitest';
import { ALLOWED_TRANSITIONS, DebateState, isValidTransition } from './debate-state';

describe('DebateState', () => {
    it('defines all four states', () => {
        expect(Object.values(DebateState)).toEqual([
            'PREPARATION',
            'RUNNING',
            'VOTING',
            'CLOSED',
        ]);
    });
});

describe('isValidTransition', () => {
    it.each([
        [DebateState.PREPARATION, DebateState.RUNNING],
        [DebateState.RUNNING, DebateState.VOTING],
        [DebateState.VOTING, DebateState.CLOSED],
    ])('%s → %s is allowed', (from, to) => {
        expect(isValidTransition(from, to)).toBe(true);
    });

    it.each([
        [DebateState.PREPARATION, DebateState.VOTING],
        [DebateState.PREPARATION, DebateState.CLOSED],
        [DebateState.RUNNING, DebateState.PREPARATION],
        [DebateState.RUNNING, DebateState.CLOSED],
        [DebateState.VOTING, DebateState.RUNNING],
        [DebateState.CLOSED, DebateState.VOTING],
    ])('%s → %s is forbidden', (from, to) => {
        expect(isValidTransition(from, to)).toBe(false);
    });

    it('CLOSED has no allowed transitions', () => {
        expect(ALLOWED_TRANSITIONS[DebateState.CLOSED]).toHaveLength(0);
    });
});
