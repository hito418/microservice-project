export enum DebateStatus {
    Pending = 'PENDING',
    Running = 'RUNNING',
    Voting = 'VOTING',
    Closed = 'CLOSED',
}

export type Debate = {
    id: string;
    status: DebateStatus;
};

export function isDebateStatus(value: string): value is DebateStatus {
    return (
        value === DebateStatus.Pending ||
        value === DebateStatus.Running ||
        value === DebateStatus.Voting ||
        value === DebateStatus.Closed
    );
}
