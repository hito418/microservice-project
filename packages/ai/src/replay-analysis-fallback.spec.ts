import { describe, expect, it } from 'vitest';

import {
    buildReplayAnalysisFallback,
    mapOpenRouterFallbackToReplayAnalysisFallback,
    sanitizeFallbackErrorMessage,
    toStoreAiAnalysisFallbackPayload,
} from './replay-analysis-fallback';
import type { AiFallbackReason } from './replay-analysis-fallback';

const FALLBACK_REASONS: AiFallbackReason[] = [
    'timeout',
    'network',
    'rate_limit',
    'server_error',
    'invalid_json',
    'missing_content',
    'missing_api_key',
    'unknown',
];

describe('buildReplayAnalysisFallback', () => {
    it.each(FALLBACK_REASONS)('builds neutral fallback for %s', (reason) => {
        const result = buildReplayAnalysisFallback({
            debateId: 'debate-1',
            reason,
            errorMessage: `${reason} failure`,
        });

        expect(result).toMatchObject({
            forScore: 0,
            againstScore: 0,
            fallbackUsed: true,
            fallbackReason: reason,
        });
        expect(result.summary).toContain('AI analysis could not be completed');
        expect(result.forFeedback).toContain('AI feedback is unavailable');
        expect(result.againstFeedback).toContain('AI feedback is unavailable');
    });

    it('is transparent and does not claim an AI evaluation was performed', () => {
        const result = buildReplayAnalysisFallback({
            debateId: 'debate-1',
            reason: 'timeout',
        });

        expect(result.summary).toContain('could not be completed');
        expect(result.summary).not.toContain('AI evaluated');
        expect(result.forFeedback).not.toContain('strong argument');
        expect(result.againstFeedback).not.toContain('weak argument');
    });

    it('does not invent debate-specific content', () => {
        const result = buildReplayAnalysisFallback({
            debateId: 'urban-cars-debate',
            reason: 'network',
        });

        expect(JSON.stringify(result)).not.toContain('urban-cars-debate');
        expect(JSON.stringify(result)).not.toContain('pollution');
        expect(JSON.stringify(result)).not.toContain('transit');
    });

    it('sanitizes the optional error message', () => {
        const result = buildReplayAnalysisFallback({
            debateId: 'debate-1',
            reason: 'network',
            errorMessage:
                'Authorization failed: Bearer sk-or-real-secret-token-1234567890abcdef',
        });

        expect(result.errorMessage).toBe(
            'Authorization failed: Bearer [redacted]',
        );
        expect(result.errorMessage).not.toContain('sk-or-real-secret');
    });
});

describe('toStoreAiAnalysisFallbackPayload', () => {
    it('returns a StoreAiAnalysisResult-shaped COMPLETED payload', () => {
        const payload = toStoreAiAnalysisFallbackPayload({
            debateId: 'debate-1',
            reason: 'server_error',
            errorMessage: 'OpenRouter request failed with HTTP 500',
        });

        expect(payload).toEqual({
            debateId: 'debate-1',
            status: 'COMPLETED',
            summary:
                'AI analysis could not be completed. The final result should rely on audience scoring or fallback rules.',
            forScore: 0,
            againstScore: 0,
            forFeedback:
                'AI feedback is unavailable for the FOR side because the analysis service failed.',
            againstFeedback:
                'AI feedback is unavailable for the AGAINST side because the analysis service failed.',
            errorMessage: 'OpenRouter request failed with HTTP 500',
        });
    });

    it('uses AI 0/0 so audience is the only non-zero final-score contributor under the current 50/50 formula', () => {
        const payload = toStoreAiAnalysisFallbackPayload({
            debateId: 'debate-1',
            reason: 'timeout',
        });

        expect(payload.forScore).toBe(0);
        expect(payload.againstScore).toBe(0);
        // This does not change scoring-service weighting to 100% audience.
    });
});

describe('mapOpenRouterFallbackToReplayAnalysisFallback', () => {
    it('maps timeout fallback', () => {
        const fallback = mapOpenRouterFallbackToReplayAnalysisFallback(
            {
                content: '',
                fallbackUsed: true,
                errorType: 'timeout',
                errorMessage: 'OpenRouter request timed out',
            },
            { debateId: 'debate-1' },
        );

        expect(fallback.fallbackReason).toBe('timeout');
    });

    it('maps network fallback', () => {
        const fallback = mapOpenRouterFallbackToReplayAnalysisFallback(
            {
                content: '',
                fallbackUsed: true,
                errorType: 'network',
                errorMessage: 'OpenRouter network request failed',
            },
            { debateId: 'debate-1' },
        );

        expect(fallback.fallbackReason).toBe('network');
    });

    it('maps HTTP 429 fallback to rate_limit', () => {
        const fallback = mapOpenRouterFallbackToReplayAnalysisFallback(
            {
                content: '',
                fallbackUsed: true,
                errorType: 'http',
                errorMessage: 'OpenRouter request failed with HTTP 429',
            },
            { debateId: 'debate-1' },
        );

        expect(fallback.fallbackReason).toBe('rate_limit');
    });

    it('maps HTTP 5xx fallback to server_error', () => {
        const fallback = mapOpenRouterFallbackToReplayAnalysisFallback(
            {
                content: '',
                fallbackUsed: true,
                errorType: 'http',
                errorMessage: 'OpenRouter request failed with HTTP 503',
            },
            { debateId: 'debate-1' },
        );

        expect(fallback.fallbackReason).toBe('server_error');
    });

    it('maps invalid_json fallback', () => {
        const fallback = mapOpenRouterFallbackToReplayAnalysisFallback(
            {
                content: '',
                fallbackUsed: true,
                errorType: 'invalid_json',
                errorMessage: 'OpenRouter response was not valid JSON',
            },
            { debateId: 'debate-1' },
        );

        expect(fallback.fallbackReason).toBe('invalid_json');
    });

    it('maps missing_content fallback', () => {
        const fallback = mapOpenRouterFallbackToReplayAnalysisFallback(
            {
                content: '',
                fallbackUsed: true,
                errorType: 'missing_content',
                errorMessage: 'OpenRouter response did not include message content',
            },
            { debateId: 'debate-1' },
        );

        expect(fallback.fallbackReason).toBe('missing_content');
    });

    it('maps missing_api_key fallback', () => {
        const fallback = mapOpenRouterFallbackToReplayAnalysisFallback(
            {
                content: '',
                fallbackUsed: true,
                errorType: 'missing_api_key',
                errorMessage: 'OPENROUTER_API_KEY is required',
            },
            { debateId: 'debate-1' },
        );

        expect(fallback.fallbackReason).toBe('missing_api_key');
    });

    it('maps unknown technical fallback', () => {
        const fallback = mapOpenRouterFallbackToReplayAnalysisFallback(
            {
                content: '',
                fallbackUsed: true,
                errorType: 'invalid_payload',
                errorMessage: 'OpenRouter messages must contain at least one message',
            },
            { debateId: 'debate-1' },
        );

        expect(fallback.fallbackReason).toBe('unknown');
    });
});

describe('sanitizeFallbackErrorMessage', () => {
    it('removes bearer tokens and API keys', () => {
        const sanitized = sanitizeFallbackErrorMessage(
            'failed with Bearer sk-or-v1-abcdefghijklmnopqrstuvwxyz123456',
        );

        expect(sanitized).toBe('failed with Bearer [redacted]');
        expect(sanitized).not.toContain('sk-or-v1');
    });

    it('removes long secret-like strings', () => {
        const sanitized = sanitizeFallbackErrorMessage(
            'trace abcdefghijklmnopqrstuvwxyz1234567890 failed',
        );

        expect(sanitized).toBe('trace [redacted] failed');
    });

    it('truncates long messages instead of exposing raw response bodies', () => {
        const sanitized = sanitizeFallbackErrorMessage(
            Array.from({ length: 60 }, () => 'body').join(' '),
        );

        expect(sanitized).toHaveLength(183);
        expect(sanitized?.endsWith('...')).toBe(true);
    });

    it('omits blank messages', () => {
        expect(sanitizeFallbackErrorMessage('   ')).toBeUndefined();
    });
});
