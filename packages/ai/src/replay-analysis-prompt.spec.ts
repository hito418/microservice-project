import { describe, expect, it } from 'vitest';

import {
    buildReplayAnalysisMessages,
    parseReplayAnalysisOutput,
    ReplayAnalysisOutputParseError,
    REPLAY_ANALYSIS_PROMPT_VERSION,
} from './replay-analysis-prompt';
import type { DebateReplayAnalysisInput } from './replay-analysis-prompt';

const INPUT: DebateReplayAnalysisInput = {
    debateId: 'debate-1',
    question: 'Should cities ban private cars from downtown areas?',
    sides: {
        for: {
            label: 'FOR',
            participantId: 'user-for',
            participantName: 'Alex',
        },
        against: {
            label: 'AGAINST',
            participantId: 'user-against',
            participantName: 'Sam',
        },
    },
    messages: [
        {
            senderSide: 'FOR',
            senderId: 'user-for',
            content: 'Banning cars would reduce congestion and air pollution.',
            sentAt: '2026-06-22T12:00:00.000Z',
        },
        {
            senderSide: 'AGAINST',
            senderId: 'user-against',
            content: 'A ban would hurt workers who rely on cars for access.',
            sentAt: '2026-06-22T12:00:20.000Z',
        },
    ],
    metrics: {
        forArgumentCount: 3,
        againstArgumentCount: 2,
        forAverageMessageLength: 84,
        againstAverageMessageLength: 72,
        forAverageResponseTimeSeconds: 18,
        againstAverageResponseTimeSeconds: 25,
    },
};

describe('buildReplayAnalysisMessages', () => {
    it('builds one system message and one user message', () => {
        const messages = buildReplayAnalysisMessages(INPUT);

        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
    });

    it('includes the prompt version and debate question', () => {
        const combined = combinedPrompt(INPUT);

        expect(combined).toContain(REPLAY_ANALYSIS_PROMPT_VERSION);
        expect(combined).toContain(INPUT.question);
    });

    it('includes FOR and AGAINST side context and messages', () => {
        const combined = combinedPrompt(INPUT);

        expect(combined).toContain('FOR');
        expect(combined).toContain('AGAINST');
        expect(combined).toContain('participantId=user-for');
        expect(combined).toContain('participantName=Sam');
        expect(combined).toContain('Banning cars would reduce congestion');
        expect(combined).toContain('A ban would hurt workers');
    });

    it('includes metrics when they are provided', () => {
        const combined = combinedPrompt(INPUT);

        expect(combined).toContain('forArgumentCount: 3');
        expect(combined).toContain('againstAverageResponseTimeSeconds: 25');
    });

    it('uses an explicit fallback line when no metrics are provided', () => {
        const combined = combinedPrompt({ ...INPUT, metrics: undefined });

        expect(combined).toContain('No aggregate metrics were provided.');
    });

    it('asks for strict JSON and forbids Markdown', () => {
        const combined = combinedPrompt(INPUT);

        expect(combined).toContain('Return only strict JSON');
        expect(combined).toContain('Do not include Markdown');
        expect(combined).toContain('code fences');
    });

    it('states the evaluation criteria', () => {
        const combined = combinedPrompt(INPUT);

        expect(combined).toContain('Reward clarity, relevance, evidence');
        expect(combined).toContain('Penalize repetition, off-topic claims');
        expect(combined).toContain('not whether you personally agree');
    });

    it('does not ask the AI to choose the final winner', () => {
        const combined = combinedPrompt(INPUT);

        expect(combined).toContain('Do not declare a final winner');
        expect(combined).toContain('Final winner selection is handled later');
    });

    it('requests only fields compatible with StoreAiAnalysisResult', () => {
        const combined = combinedPrompt(INPUT);

        expect(combined).toContain('summary');
        expect(combined).toContain('forScore');
        expect(combined).toContain('againstScore');
        expect(combined).toContain('forFeedback');
        expect(combined).toContain('againstFeedback');
        expect(combined).not.toContain('confidence');
        expect(combined).not.toContain('perPlayerScores');
        expect(combined).not.toContain('participantScores');
    });
});

describe('parseReplayAnalysisOutput', () => {
    it('accepts a valid strict JSON response', () => {
        const result = parseReplayAnalysisOutput(
            JSON.stringify({
                summary: 'Both sides addressed transit access and emissions.',
                forScore: 82,
                againstScore: 76,
                forFeedback: 'Clear structure and strong examples.',
                againstFeedback: 'Good access concerns, but fewer rebuttals.',
            }),
        );

        expect(result).toEqual({
            summary: 'Both sides addressed transit access and emissions.',
            forScore: 82,
            againstScore: 76,
            forFeedback: 'Clear structure and strong examples.',
            againstFeedback: 'Good access concerns, but fewer rebuttals.',
        });
    });

    it('trims string fields in valid output', () => {
        const result = parseReplayAnalysisOutput(
            JSON.stringify({
                summary: '  Neutral summary.  ',
                forScore: 50,
                againstScore: 50,
                forFeedback: '  FOR feedback.  ',
                againstFeedback: '  AGAINST feedback.  ',
            }),
        );

        expect(result.summary).toBe('Neutral summary.');
        expect(result.forFeedback).toBe('FOR feedback.');
        expect(result.againstFeedback).toBe('AGAINST feedback.');
    });

    it('rejects invalid JSON', () => {
        expect(() => parseReplayAnalysisOutput('{ invalid json')).toThrow(
            ReplayAnalysisOutputParseError,
        );
    });

    it('rejects Markdown fenced JSON instead of cleaning it', () => {
        const content = [
            '```json',
            '{"summary":"ok","forScore":50,"againstScore":50,"forFeedback":"ok","againstFeedback":"ok"}',
            '```',
        ].join('\n');

        expect(() => parseReplayAnalysisOutput(content)).toThrow(
            /without Markdown fences/,
        );
    });

    it('rejects score below zero', () => {
        expectInvalidShape({
            summary: 'Summary',
            forScore: -1,
            againstScore: 50,
            forFeedback: 'Feedback',
            againstFeedback: 'Feedback',
        });
    });

    it('rejects score above one hundred', () => {
        expectInvalidShape({
            summary: 'Summary',
            forScore: 50,
            againstScore: 101,
            forFeedback: 'Feedback',
            againstFeedback: 'Feedback',
        });
    });

    it('rejects missing fields', () => {
        expectInvalidShape({
            summary: 'Summary',
            forScore: 50,
            againstScore: 50,
            forFeedback: 'Feedback',
        });
    });

    it('rejects invalid field types', () => {
        expectInvalidShape({
            summary: 'Summary',
            forScore: '80',
            againstScore: 50,
            forFeedback: 'Feedback',
            againstFeedback: 'Feedback',
        });
    });

    it('rejects extra fields not persisted by scoring-service', () => {
        expectInvalidShape({
            summary: 'Summary',
            forScore: 50,
            againstScore: 50,
            forFeedback: 'Feedback',
            againstFeedback: 'Feedback',
            winner: 'FOR',
        });
    });
});

function combinedPrompt(input: DebateReplayAnalysisInput): string {
    return buildReplayAnalysisMessages(input)
        .map((message) => message.content)
        .join('\n');
}

function expectInvalidShape(value: unknown): void {
    try {
        parseReplayAnalysisOutput(JSON.stringify(value));
    } catch (error) {
        expect(error).toBeInstanceOf(ReplayAnalysisOutputParseError);
        expect((error as ReplayAnalysisOutputParseError).code).toBe(
            'invalid_shape',
        );
        return;
    }

    throw new Error('Expected parseReplayAnalysisOutput to fail');
}
