import type { OpenRouterMessage } from './openrouter.types';

export const REPLAY_ANALYSIS_PROMPT_VERSION = 'replay-analysis-v1';

export type DebateReplaySide = 'FOR' | 'AGAINST';

export type DebateReplaySideContext = {
    label: DebateReplaySide;
    participantId?: string;
    participantName?: string;
};

export type DebateReplayMessage = {
    senderSide: DebateReplaySide;
    senderId?: string;
    content: string;
    sentAt?: string;
};

export type DebateReplayMetrics = {
    forArgumentCount?: number;
    againstArgumentCount?: number;
    forAverageMessageLength?: number;
    againstAverageMessageLength?: number;
    forAverageResponseTimeSeconds?: number;
    againstAverageResponseTimeSeconds?: number;
};

export type DebateReplayAnalysisInput = {
    debateId: string;
    question: string;
    sides: {
        for: DebateReplaySideContext & { label: 'FOR' };
        against: DebateReplaySideContext & { label: 'AGAINST' };
    };
    messages: DebateReplayMessage[];
    metrics?: DebateReplayMetrics;
};

export type ReplayAnalysisResult = {
    summary: string;
    forScore: number;
    againstScore: number;
    forFeedback: string;
    againstFeedback: string;
};

export type ReplayAnalysisOutputParseErrorCode =
    | 'markdown_not_allowed'
    | 'invalid_json'
    | 'invalid_shape';

export class ReplayAnalysisOutputParseError extends Error {
    constructor(
        public readonly code: ReplayAnalysisOutputParseErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'ReplayAnalysisOutputParseError';
    }
}

const EXPECTED_OUTPUT_KEYS = [
    'summary',
    'forScore',
    'againstScore',
    'forFeedback',
    'againstFeedback',
] as const;

export function buildReplayAnalysisMessages(
    input: DebateReplayAnalysisInput,
): OpenRouterMessage[] {
    return [
        {
            role: 'system',
            content: systemPrompt(),
        },
        {
            role: 'user',
            content: userPrompt(input),
        },
    ];
}

export function parseReplayAnalysisOutput(content: string): ReplayAnalysisResult {
    const trimmed = content.trim();
    if (trimmed.startsWith('```')) {
        throw new ReplayAnalysisOutputParseError(
            'markdown_not_allowed',
            'Replay analysis output must be strict JSON without Markdown fences',
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        throw new ReplayAnalysisOutputParseError(
            'invalid_json',
            'Replay analysis output must be valid JSON',
        );
    }

    return validateReplayAnalysisResult(parsed);
}

function systemPrompt(): string {
    return [
        `Prompt version: ${REPLAY_ANALYSIS_PROMPT_VERSION}.`,
        'You analyze competitive debate replays for AI Debate Arena.',
        'Evaluate the argumentative quality of each side, not whether you personally agree with the side.',
        'Judge the FOR and AGAINST sides independently, even if a participant argues a position they may not personally hold.',
        'Reward clarity, relevance, evidence, examples, structure, direct responses to the opposing side, coherence, and nuance.',
        'Penalize repetition, off-topic claims, missing arguments, personal attacks, aggression, contradictions, and unsupported assertions.',
        'Write a neutral debate summary and concise, actionable, non-insulting feedback for each side.',
        'Do not declare a final winner. Final winner selection is handled later by scoring-service with audience votes.',
        'Return only strict JSON. Do not include Markdown, code fences, comments, prose outside JSON, or extra fields.',
        'The JSON object must contain exactly these fields: summary, forScore, againstScore, forFeedback, againstFeedback.',
        'forScore and againstScore must be integers from 0 to 100.',
    ].join('\n');
}

function userPrompt(input: DebateReplayAnalysisInput): string {
    return [
        'Analyze this debate replay by side.',
        '',
        `Debate ID: ${input.debateId}`,
        `Question: ${input.question}`,
        '',
        'Side context:',
        formatSideContext(input.sides.for),
        formatSideContext(input.sides.against),
        '',
        'Replay messages:',
        formatMessages(input.messages),
        '',
        'Metrics:',
        formatMetrics(input.metrics),
        '',
        'Return exactly this JSON shape:',
        JSON.stringify(
            {
                summary: 'neutral summary',
                forScore: 0,
                againstScore: 0,
                forFeedback: 'synthetic feedback for FOR',
                againstFeedback: 'synthetic feedback for AGAINST',
            },
            null,
            2,
        ),
    ].join('\n');
}

function formatSideContext(side: DebateReplaySideContext): string {
    const participant = [
        side.participantId ? `participantId=${side.participantId}` : undefined,
        side.participantName
            ? `participantName=${side.participantName}`
            : undefined,
    ]
        .filter((value): value is string => value !== undefined)
        .join(', ');

    return `- ${side.label}${participant ? ` (${participant})` : ''}`;
}

function formatMessages(messages: DebateReplayMessage[]): string {
    if (messages.length === 0) return '- No replay messages were provided.';

    return messages
        .map((message, index) => {
            const metadata = [
                `side=${message.senderSide}`,
                message.senderId ? `senderId=${message.senderId}` : undefined,
                message.sentAt ? `sentAt=${message.sentAt}` : undefined,
            ]
                .filter((value): value is string => value !== undefined)
                .join(', ');

            return `${index + 1}. [${metadata}] ${message.content}`;
        })
        .join('\n');
}

function formatMetrics(metrics: DebateReplayMetrics | undefined): string {
    if (!metrics) return '- No aggregate metrics were provided.';

    const entries: Array<readonly [string, number | undefined]> = [
        ['forArgumentCount', metrics.forArgumentCount],
        ['againstArgumentCount', metrics.againstArgumentCount],
        ['forAverageMessageLength', metrics.forAverageMessageLength],
        ['againstAverageMessageLength', metrics.againstAverageMessageLength],
        [
            'forAverageResponseTimeSeconds',
            metrics.forAverageResponseTimeSeconds,
        ],
        [
            'againstAverageResponseTimeSeconds',
            metrics.againstAverageResponseTimeSeconds,
        ],
    ];

    const lines = entries
        .filter((entry): entry is readonly [string, number] => {
            return typeof entry[1] === 'number';
        })
        .map(([key, value]) => `- ${key}: ${value}`);

    return lines.length > 0
        ? lines.join('\n')
        : '- No aggregate metrics were provided.';
}

function validateReplayAnalysisResult(parsed: unknown): ReplayAnalysisResult {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw invalidShape('Replay analysis output must be a JSON object');
    }

    const record = parsed as Record<string, unknown>;
    const keys = Object.keys(record);
    const unexpectedKey = keys.find(
        (key) => !EXPECTED_OUTPUT_KEYS.includes(key as ExpectedOutputKey),
    );
    if (unexpectedKey) {
        throw invalidShape(`Unexpected replay analysis field: ${unexpectedKey}`);
    }

    for (const key of EXPECTED_OUTPUT_KEYS) {
        if (!(key in record)) {
            throw invalidShape(`Missing replay analysis field: ${key}`);
        }
    }

    return {
        summary: requiredText(record.summary, 'summary'),
        forScore: score(record.forScore, 'forScore'),
        againstScore: score(record.againstScore, 'againstScore'),
        forFeedback: requiredText(record.forFeedback, 'forFeedback'),
        againstFeedback: requiredText(record.againstFeedback, 'againstFeedback'),
    };
}

type ExpectedOutputKey = (typeof EXPECTED_OUTPUT_KEYS)[number];

function requiredText(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw invalidShape(`${fieldName} must be a non-empty string`);
    }
    return value.trim();
}

function score(value: unknown, fieldName: string): number {
    if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 100
    ) {
        throw invalidShape(`${fieldName} must be an integer from 0 to 100`);
    }
    return value;
}

function invalidShape(message: string): ReplayAnalysisOutputParseError {
    return new ReplayAnalysisOutputParseError('invalid_shape', message);
}
