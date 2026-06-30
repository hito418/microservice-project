export type Side = 'FOR' | 'AGAINST';

export interface AuthSession {
    userId: string;
    role: string;
    expiresIn: number;
}

export interface SignupResponse {
    id: string;
    email: string;
    createdAt: string;
}

export interface AudienceVoteSummary {
    debateId: string;
    totalVotes: number;
    forVotes: number;
    againstVotes: number;
    forScore: number;
    againstScore: number;
}

export interface SpectatorVote {
    id: string;
    debateId: string;
    userId: string;
    side: Side;
    createdAt: string;
}

export interface RandomRecentDebate {
    debateId: string;
    status: string;
    voteCount: number;
    referenceTime: string;
}

export interface PlayerStats {
    userId: string;
    xp: number;
    elo: number;
    debatesCount: number;
    wins: number;
    losses: number;
    draws: number;
    winrate: number;
    rankTier: string;
    createdAt: string;
    updatedAt: string;
}

export interface LeaderboardItem {
    userId: string;
    elo: number;
    xp: number;
    rankTier: string;
    winrate: number;
    debatesCount: number;
    wins: number;
    losses: number;
    draws: number;
    rankPosition: number;
}

export interface LeaderboardResponse {
    items: LeaderboardItem[];
}

export interface FinalDebateScore {
    debateId: string;
    aiForScore: number;
    aiAgainstScore: number;
    audienceForScore: number;
    audienceAgainstScore: number;
    finalForScore: number;
    finalAgainstScore: number;
    winnerSide: string;
    createdAt: string;
    updatedAt: string;
}

export interface AiAnalysisResult {
    debateId: string;
    status: string;
    summary?: string;
    forScore?: number;
    againstScore?: number;
    forFeedback?: string;
    againstFeedback?: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
}
