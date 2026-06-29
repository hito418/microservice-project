import { useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';
import type { AudienceVoteSummary, Side } from '../api/types';
import { Badge, ErrorState, LoadingState } from './Status';

export function VotePanel({ debateId }: { debateId: string }) {
    const [summary, setSummary] = useState<AudienceVoteSummary | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [submitting, setSubmitting] = useState<Side | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function refreshSummary() {
        if (!debateId) return;
        setLoadingSummary(true);
        setError(null);
        try {
            setSummary(await api.getVoteSummary(debateId));
        } catch (err) {
            setError(readError(err, 'Vote summary is not available yet.'));
        } finally {
            setLoadingSummary(false);
        }
    }

    useEffect(() => {
        void refreshSummary();
    }, [debateId]);

    async function vote(side: Side) {
        setSubmitting(side);
        setMessage(null);
        setError(null);
        try {
            await api.createVote(debateId, side);
            setMessage(`Vote submitted for ${side}.`);
            await refreshSummary();
        } catch (err) {
            setError(readError(err, 'Vote failed.'));
        } finally {
            setSubmitting(null);
        }
    }

    return (
        <section className="card">
            <div className="section-title">
                <h2>Voting</h2>
                <Badge tone="neutral">{debateId}</Badge>
            </div>
            <div className="button-row">
                <button
                    className="btn btn-for"
                    disabled={!debateId || submitting !== null}
                    onClick={() => void vote('FOR')}
                >
                    {submitting === 'FOR' ? 'Submitting...' : 'Vote FOR'}
                </button>
                <button
                    className="btn btn-against"
                    disabled={!debateId || submitting !== null}
                    onClick={() => void vote('AGAINST')}
                >
                    {submitting === 'AGAINST' ? 'Submitting...' : 'Vote AGAINST'}
                </button>
            </div>
            {message && <div className="state state-success">{message}</div>}
            {error && <ErrorState message={error} />}
            {loadingSummary ? (
                <LoadingState label="Loading vote summary" />
            ) : summary ? (
                <div className="stats-grid compact">
                    <Metric label="Total" value={summary.totalVotes} />
                    <Metric label="FOR" value={`${summary.forVotes} (${summary.forScore})`} />
                    <Metric
                        label="AGAINST"
                        value={`${summary.againstVotes} (${summary.againstScore})`}
                    />
                </div>
            ) : null}
        </section>
    );
}

function Metric({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function readError(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return `${fallback} ${err.message}`;
    if (err instanceof Error) return `${fallback} ${err.message}`;
    return fallback;
}
