export enum SpectatorVoteSide {
    For = 'FOR',
    Against = 'AGAINST',
}

export type SpectatorVote = {
    id: string;
    debateId: string;
    userId: string;
    side: SpectatorVoteSide;
    createdAt: Date;
};

export function isSpectatorVoteSide(value: string): value is SpectatorVoteSide {
    return value === SpectatorVoteSide.For || value === SpectatorVoteSide.Against;
}
