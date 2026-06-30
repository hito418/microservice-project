import type {
    AiAnalysisResult,
    AudienceVoteSummary,
    AuthSession,
    FinalDebateScore,
    LeaderboardResponse,
    PlayerStats,
    RandomRecentDebate,
    Side,
    SignupResponse,
    SpectatorVote,
} from './types';

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly details?: unknown,
    ) {
        super(message);
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    const text = await response.text();
    const data = text ? safeJson(text) : undefined;
    if (!response.ok) {
        const message = readApiMessage(data, response.statusText);
        throw new ApiError(message, response.status, data);
    }
    return data as T;
}

function readApiMessage(data: unknown, fallback: string): string {
    if (typeof data === 'object' && data !== null && 'message' in data) {
        const { message } = data as { message?: unknown };
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.join(', ');
    }
    if (typeof data === 'string' && data.trim()) return data;
    return fallback || 'Unexpected API error';
}

function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function query(params: Record<string, string | number | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const value = search.toString();
    return value ? `?${value}` : '';
}

export const api = {
    signup: (email: string, password: string) =>
        request<SignupResponse>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),
    login: (email: string, password: string) =>
        request<AuthSession>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),
    createVote: (debateId: string, side: Side) =>
        request<SpectatorVote>(`/debates/${encodeURIComponent(debateId)}/votes`, {
            method: 'POST',
            body: JSON.stringify({ side }),
        }),
    getVoteSummary: (debateId: string) =>
        request<AudienceVoteSummary>(
            `/debates/${encodeURIComponent(debateId)}/votes/summary`,
        ),
    getRandomRecentDebate: () =>
        request<RandomRecentDebate>('/debates/random-for-voting'),
    getPlayerStats: (userId: string) =>
        request<PlayerStats>(`/profiles/${encodeURIComponent(userId)}/stats`),
    getLeaderboard: (limit = 20) =>
        request<LeaderboardResponse>(`/leaderboard${query({ limit })}`),
    getFinalScore: (debateId: string) =>
        request<FinalDebateScore>(
            `/debates/${encodeURIComponent(debateId)}/final-score`,
        ),
    getAiAnalysis: (debateId: string) =>
        request<AiAnalysisResult>(
            `/debates/${encodeURIComponent(debateId)}/ai-analysis`,
        ),
};
