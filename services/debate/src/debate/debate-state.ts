export enum DebateState {
    PREPARATION = 'PREPARATION',
    RUNNING = 'RUNNING',
    VOTING = 'VOTING',
    CLOSED = 'CLOSED',
}

export const ALLOWED_TRANSITIONS: Record<DebateState, DebateState[]> = {
    [DebateState.PREPARATION]: [DebateState.RUNNING],
    [DebateState.RUNNING]: [DebateState.VOTING],
    [DebateState.VOTING]: [DebateState.CLOSED],
    [DebateState.CLOSED]: [],
};

export function isValidTransition(from: DebateState, to: DebateState): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
