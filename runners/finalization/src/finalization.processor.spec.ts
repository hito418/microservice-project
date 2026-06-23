import type { FinalizationJob } from '@repo/queue';
import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { FinalizationProcessor } from './finalization.processor';
import type { ScoringClient } from './scoring-client.service';

function makeScoringMock(): ScoringClient {
    return {
        computeFinalDebateScore: vi.fn().mockResolvedValue({
            debateId: 'debate-1',
            winnerSide: 'FOR',
            finalForScore: 70,
            finalAgainstScore: 30,
        }),
    } as unknown as ScoringClient;
}

function makeJob(data: FinalizationJob): Job<FinalizationJob> {
    return { id: `finalize:${data.debateId}`, data } as unknown as Job<FinalizationJob>;
}

describe('FinalizationProcessor', () => {
    it('computes the final score for the job debate', async () => {
        const scoring = makeScoringMock();
        const processor = new FinalizationProcessor(scoring);

        await processor.process(
            makeJob({ debateId: 'debate-1', roomId: 'room-1', closedAt: 0 }),
        );

        expect(scoring.computeFinalDebateScore).toHaveBeenCalledOnce();
        expect(scoring.computeFinalDebateScore).toHaveBeenCalledWith({
            debateId: 'debate-1',
        });
    });

    it('rethrows scoring errors so BullMQ can retry', async () => {
        const scoring = makeScoringMock();
        vi.mocked(scoring.computeFinalDebateScore).mockRejectedValue(
            new Error('3 FAILED_PRECONDITION: AI analysis result is required'),
        );
        const processor = new FinalizationProcessor(scoring);

        await expect(
            processor.process(
                makeJob({ debateId: 'debate-1', roomId: 'room-1', closedAt: 0 }),
            ),
        ).rejects.toThrow('FAILED_PRECONDITION');
    });
});
