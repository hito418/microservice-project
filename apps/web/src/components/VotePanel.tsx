import { useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';
import type { AudienceVoteSummary, Side } from '../api/types';
import { Badge, EmptyState, ErrorState, LoadingState, SuccessState } from './Status';

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
                <div>
                    <p className="eyebrow">Audience vote</p>
                    <h2>Cast a side vote</h2>
                </div>
                <div className="title-actions">
                    <Badge tone="info">{debateId}</Badge>
                    <button
                        className="btn btn-ghost"
                        disabled={loadingSummary}
                        onClick={() => void refreshSummary()}
                    >
                        Refresh
                    </button>
                </div>
            </div>
            <div className="vote-actions">
                <button
                    className="vote-card vote-for"
                    disabled={!debateId || submitting !== null}
                    onClick={() => void vote('FOR')}
                >
                    <span>Vote FOR</span>
                    <strong>{submitting === 'FOR' ? 'Submitting...' : 'Support'}</strong>
                </button>
                <button
                    className="vote-card vote-against"
                    disabled={!debateId || submitting !== null}
                    onClick={() => void vote('AGAINST')}
                >
                    <span>Vote AGAINST</span>
                    <strong>{submitting === 'AGAINST' ? 'Submitting...' : 'Challenge'}</strong>
                </button>
            </div>
            {message && <SuccessState>{message}</SuccessState>}
            {error && <ErrorState message={error} />}
            {loadingSummary ? (
                <LoadingState label="Loading vote summary" />
            ) : summary ? (
                <div className="vote-summary">
                    <Metric label="Total votes" value={summary.totalVotes} />
                    <VoteBar
                        label="FOR"
                        votes={summary.forVotes}
                        score={summary.forScore}
                        total={summary.totalVotes}
                    />
                    <VoteBar
                        label="AGAINST"
                        votes={summary.againstVotes}
                        score={summary.againstScore}
                        total={summary.totalVotes}
                    />
                </div>
            ) : (
                <EmptyState>
                    Vote summary is empty or not exposed yet. Voting still works once
                    the debate vote endpoint is available.
                </EmptyState>
            )}
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

function VoteBar({
    label,
    votes,
    score,
    total,
}: {
    label: Side;
    votes: number;
    score: number;
    total: number;
}) {
    const percent = total > 0 ? Math.round((votes / total) * 100) : 0;
    return (
        <div className="vote-bar">
            <div>
                <strong>{label}</strong>
                <span>
                    {votes} votes - score {score}
                </span>
            </div>
            <div className="meter" aria-label={`${label} ${percent}%`}>
                <span
                    className={label === 'FOR' ? 'meter-for' : 'meter-against'}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <b>{percent}%</b>
        </div>
    );
}

function readError(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return `${fallback} HTTP ${err.status}: ${err.message}`;
    if (err instanceof Error) return `${fallback} ${err.message}`;
    return fallback;
}
