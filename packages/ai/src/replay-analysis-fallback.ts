import type {
    OpenRouterChatCompletionResult,
    OpenRouterErrorType,
} from './openrouter.types';

export type AiFallbackReason =
    | 'timeout'
    | 'network'
    | 'rate_limit'
    | 'server_error'
    | 'invalid_json'
    | 'missing_content'
    | 'missing_api_key'
    | 'unknown';

export type ReplayAnalysisFallbackInput = {
    debateId: string;
    reason: AiFallbackReason;
    errorMessage?: string;
};

export type ReplayAnalysisFallbackResult = {
    summary: string;
    forScore: 0;
    againstScore: 0;
    forFeedback: string;
    againstFeedback: string;
    fallbackUsed: true;
    fallbackReason: AiFallbackReason;
    errorMessage?: string;
};

export type StoreAiAnalysisFallbackPayload = {
    debateId: string;
    status: 'COMPLETED';
    summary: string;
    forScore: 0;
    againstScore: 0;
    forFeedback: string;
    againstFeedback: string;
    errorMessage?: string;
};

const FALLBACK_SUMMARY =
    'AI analysis could not be completed. The final result should rely on audience scoring or fallback rules.';

const FOR_FALLBACK_FEEDBACK =
    'AI feedback is unavailable for the FOR side because the analysis service failed.';

const AGAINST_FALLBACK_FEEDBACK =
    'AI feedback is unavailable for the AGAINST side because the analysis service failed.';

const MAX_ERROR_MESSAGE_LENGTH = 180;
const SECRET_REPLACEMENT = '[redacted]';

export function buildReplayAnalysisFallback(
    input: ReplayAnalysisFallbackInput,
): ReplayAnalysisFallbackResult {
    const errorMessage = sanitizeFallbackErrorMessage(input.errorMessage);

    return {
        summary: FALLBACK_SUMMARY,
        forScore: 0,
        againstScore: 0,
        forFeedback: FOR_FALLBACK_FEEDBACK,
        againstFeedback: AGAINST_FALLBACK_FEEDBACK,
        fallbackUsed: true,
        fallbackReason: input.reason,
        ...(errorMessage ? { errorMessage } : {}),
    };
}

export function toStoreAiAnalysisFallbackPayload(
    input: ReplayAnalysisFallbackInput,
): StoreAiAnalysisFallbackPayload {
    const fallback = buildReplayAnalysisFallback(input);

    // Current final scoring still applies 50% AI + 50% audience. Persisting
    // 0/0 means audience is the only non-zero contributor; it does not make
    // audience mathematically become a 100% weight.
    return {
        debateId: input.debateId,
        status: 'COMPLETED',
        summary: fallback.summary,
        forScore: fallback.forScore,
        againstScore: fallback.againstScore,
        forFeedback: fallback.forFeedback,
        againstFeedback: fallback.againstFeedback,
        ...(fallback.errorMessage ? { errorMessage: fallback.errorMessage } : {}),
    };
}

export function mapOpenRouterFallbackToReplayAnalysisFallback(
    result: OpenRouterChatCompletionResult,
    input: { debateId: string },
): ReplayAnalysisFallbackResult {
    return buildReplayAnalysisFallback({
        debateId: input.debateId,
        reason: mapOpenRouterErrorType(result.errorType, result.errorMessage),
        errorMessage: result.errorMessage,
    });
}

export function sanitizeFallbackErrorMessage(
    errorMessage: string | undefined,
): string | undefined {
    const trimmed = errorMessage?.trim();
    if (!trimmed) return undefined;

    const withoutBearer = trimmed.replace(
        /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
        `Bearer ${SECRET_REPLACEMENT}`,
    );
    const withoutOpenRouterKeys = withoutBearer.replace(
        /\bsk-or-[A-Za-z0-9._~+/=-]{8,}\b/g,
        SECRET_REPLACEMENT,
    );
    const withoutSecretLikeStrings = withoutOpenRouterKeys.replace(
        /\b[A-Za-z0-9_-]{32,}\b/g,
        SECRET_REPLACEMENT,
    );
    const singleLine = withoutSecretLikeStrings.replace(/\s+/g, ' ').trim();

    return singleLine.length > MAX_ERROR_MESSAGE_LENGTH
        ? `${singleLine.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`
        : singleLine;
}

function mapOpenRouterErrorType(
    errorType: OpenRouterErrorType | undefined,
    errorMessage: string | undefined,
): AiFallbackReason {
    switch (errorType) {
        case 'timeout':
            return 'timeout';
        case 'network':
            return 'network';
        case 'invalid_json':
            return 'invalid_json';
        case 'missing_content':
            return 'missing_content';
        case 'missing_api_key':
            return 'missing_api_key';
        case 'http':
            return httpFallbackReason(errorMessage);
        case 'invalid_payload':
        case undefined:
            return 'unknown';
    }
}

function httpFallbackReason(errorMessage: string | undefined): AiFallbackReason {
    const statusCode = errorMessage?.match(/\b([1-5][0-9]{2})\b/)?.[1];
    if (statusCode === '429') return 'rate_limit';
    if (statusCode?.startsWith('5')) return 'server_error';
    return 'unknown';
}
