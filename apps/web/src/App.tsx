import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, api } from './api/client';
import type {
    AiAnalysisResult,
    AudienceVoteSummary,
    AuthSession,
    FinalDebateScore,
    LeaderboardItem,
    PlayerStats,
    RandomRecentDebate,
} from './api/types';
import { Badge, EmptyState, ErrorState, LoadingState } from './components/Status';
import { VotePanel } from './components/VotePanel';

type Route =
    | { name: 'home' }
    | { name: 'login' }
    | { name: 'signup' }
    | { name: 'debate'; debateId: string; mode: 'player' | 'spectator' }
    | { name: 'vote' }
    | { name: 'leaderboard' }
    | { name: 'profile'; userId?: string }
    | { name: 'results'; debateId: string };

const SESSION_KEY = 'ai-debate-session';

export function App() {
    const [locationKey, setLocationKey] = useState(window.location.href);
    const route = useMemo(() => parseRoute(), [locationKey]);
    const [session, setSession] = useState<AuthSession | null>(readSession());

    useEffect(() => {
        const onPopState = () => setLocationKey(window.location.href);
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    function navigate(path: string) {
        window.history.pushState(null, '', path);
        setLocationKey(window.location.href);
    }

    function onLogin(next: AuthSession) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(next));
        setSession(next);
        navigate('/');
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        navigate('/login');
    }

    return (
        <div className="app-shell">
            <Header session={session} navigate={navigate} logout={logout} />
            <main className="container">
                {route.name === 'home' && (
                    <HomePage session={session} navigate={navigate} />
                )}
                {route.name === 'login' && <LoginPage onLogin={onLogin} />}
                {route.name === 'signup' && <SignupPage navigate={navigate} />}
                {route.name === 'debate' && (
                    <DebateRoomPage
                        debateId={route.debateId}
                        mode={route.mode}
                        navigate={navigate}
                    />
                )}
                {route.name === 'vote' && <RandomVotePage navigate={navigate} />}
                {route.name === 'leaderboard' && <LeaderboardPage />}
                {route.name === 'profile' && (
                    <ProfilePage initialUserId={route.userId ?? session?.userId} />
                )}
                {route.name === 'results' && (
                    <ResultPage debateId={route.debateId} navigate={navigate} />
                )}
            </main>
        </div>
    );
}

function Header({
    session,
    navigate,
    logout,
}: {
    session: AuthSession | null;
    navigate: (path: string) => void;
    logout: () => void;
}) {
    return (
        <header className="topbar">
            <button className="brand" onClick={() => navigate('/')}>
                AI Debate Arena
            </button>
            <nav>
                <button onClick={() => navigate('/vote')}>Vote</button>
                <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
                <button onClick={() => navigate('/profile')}>Profile</button>
                {session ? (
                    <button onClick={logout}>Logout</button>
                ) : (
                    <>
                        <button onClick={() => navigate('/login')}>Login</button>
                        <button className="nav-primary" onClick={() => navigate('/signup')}>
                            Signup
                        </button>
                    </>
                )}
            </nav>
        </header>
    );
}

function LoginPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setLoading(true);
        setError(null);
        try {
            onLogin(await api.login(email, password));
        } catch (err) {
            setError(readError(err, 'Login failed.'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthCard title="Login" subtitle="Use your demo account to enter the arena.">
            <form className="form" onSubmit={(event) => void submit(event)}>
                <TextInput label="Email" value={email} onChange={setEmail} type="email" />
                <TextInput
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    type="password"
                />
                {error && <ErrorState message={error} />}
                <button className="btn btn-primary" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </AuthCard>
    );
}

function SignupPage({ navigate }: { navigate: (path: string) => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdUserId, setCreatedUserId] = useState<string | null>(null);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setCreatedUserId(null);
        try {
            const result = await api.signup(email, password);
            setCreatedUserId(result.id);
        } catch (err) {
            setError(readError(err, 'Signup failed.'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <AuthCard title="Create account" subtitle="Signup only needs email and password.">
            <form className="form" onSubmit={(event) => void submit(event)}>
                <TextInput label="Email" value={email} onChange={setEmail} type="email" />
                <TextInput
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    type="password"
                    hint="Minimum 8 characters"
                />
                {error && <ErrorState message={error} />}
                {createdUserId && (
                    <div className="state state-success">
                        Account created. User id: <code>{createdUserId}</code>
                    </div>
                )}
                <div className="button-row">
                    <button className="btn btn-primary" disabled={loading}>
                        {loading ? 'Creating...' : 'Create account'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => navigate('/login')}
                    >
                        Go to login
                    </button>
                </div>
            </form>
        </AuthCard>
    );
}

function HomePage({
    session,
    navigate,
}: {
    session: AuthSession | null;
    navigate: (path: string) => void;
}) {
    const [manualDebateId, setManualDebateId] = useState('');
    const [launchMessage, setLaunchMessage] = useState<string | null>(null);

    function openDebate(mode: 'player' | 'spectator') {
        const debateId = manualDebateId.trim();
        if (!debateId) {
            setLaunchMessage(
                'Matchmaking HTTP endpoint is not available in gateway yet. Enter a debate id from backend logs or scoring seed data for the demo.',
            );
            return;
        }
        navigate(`/debates/${encodeURIComponent(debateId)}?mode=${mode}`);
    }

    return (
        <div className="page-grid">
            <section className="hero-panel">
                <p className="eyebrow">Microservices MVP</p>
                <h1>AI Debate Arena</h1>
                <p>
                    Launch a debate, spectate voting, inspect results, and demo the
                    ranking flow from one React UI.
                </p>
                <div className="button-row">
                    <button className="btn btn-primary" onClick={() => openDebate('player')}>
                        Launch debate
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate('/vote')}
                    >
                        Find vote
                    </button>
                </div>
                {launchMessage && <ErrorState message={launchMessage} />}
            </section>
            <section className="card">
                <h2>Demo controls</h2>
                <TextInput
                    label="Debate id"
                    value={manualDebateId}
                    onChange={setManualDebateId}
                    placeholder="debate-1"
                />
                <div className="button-row">
                    <button className="btn btn-secondary" onClick={() => openDebate('player')}>
                        Open as player
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => openDebate('spectator')}
                    >
                        Open as spectator
                    </button>
                </div>
                <div className="session-box">
                    <span>Current user</span>
                    <strong>{session?.userId ?? 'Not logged in'}</strong>
                </div>
            </section>
        </div>
    );
}

function DebateRoomPage({
    debateId,
    mode,
    navigate,
}: {
    debateId: string;
    mode: 'player' | 'spectator';
    navigate: (path: string) => void;
}) {
    const readonly = mode === 'spectator';

    return (
        <div className="page-stack">
            <section className="card">
                <div className="section-title">
                    <div>
                        <p className="eyebrow">Debate room</p>
                        <h1>{debateId}</h1>
                    </div>
                    <Badge tone={readonly ? 'neutral' : 'win'}>
                        {readonly ? 'Spectator' : 'Player'}
                    </Badge>
                </div>
                <div className="room-board">
                    <div>
                        <span className="muted">Question</span>
                        <strong>Waiting for debate data</strong>
                        <p>
                            Gateway does not expose room/message endpoints yet. This
                            panel is ready for question, side, status and timer data.
                        </p>
                    </div>
                    <div className="stats-grid compact">
                        <Metric label="Status" value="Pending data" />
                        <Metric label="Side" value={readonly ? 'Read only' : 'TBD'} />
                        <Metric label="Timer" value="--:--" />
                    </div>
                </div>
                <div className="messages">
                    <EmptyState>
                        Messages endpoint is not available yet. During the demo, use this
                        room together with the voting and results panels.
                    </EmptyState>
                </div>
                <div className="button-row">
                    <button
                        className="btn btn-secondary"
                        onClick={() =>
                            navigate(`/debates/${encodeURIComponent(debateId)}?mode=spectator`)
                        }
                    >
                        Spectator mode
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate(`/results/${encodeURIComponent(debateId)}`)}
                    >
                        Results
                    </button>
                </div>
            </section>
            <VotePanel debateId={debateId} />
        </div>
    );
}

function RandomVotePage({ navigate }: { navigate: (path: string) => void }) {
    const [loading, setLoading] = useState(false);
    const [debate, setDebate] = useState<RandomRecentDebate | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function findDebate() {
        setLoading(true);
        setError(null);
        setDebate(null);
        try {
            setDebate(await api.getRandomRecentDebate());
        } catch (err) {
            setError(readError(err, 'No recent debate available.'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page-stack">
            <section className="card">
                <div className="section-title">
                    <div>
                        <p className="eyebrow">Voting picker</p>
                        <h1>Find a recent debate</h1>
                    </div>
                    <button className="btn btn-primary" onClick={() => void findDebate()}>
                        Find debate to vote
                    </button>
                </div>
                {loading && <LoadingState label="Searching" />}
                {error && <ErrorState message={error} />}
                {debate && (
                    <div className="result-row">
                        <div>
                            <strong>{debate.debateId}</strong>
                            <span>
                                {debate.status} - {debate.voteCount} votes
                            </span>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() =>
                                navigate(
                                    `/debates/${encodeURIComponent(debate.debateId)}?mode=spectator`,
                                )
                            }
                        >
                            Go vote
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}

function LeaderboardPage() {
    const [items, setItems] = useState<LeaderboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const response = await api.getLeaderboard(20);
                setItems(response.items);
            } catch (err) {
                setError(
                    readError(
                        err,
                        'Leaderboard endpoint is not available. Merge the ranking leaderboard backend first.',
                    ),
                );
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, []);

    return (
        <section className="card">
            <div className="section-title">
                <div>
                    <p className="eyebrow">Ranking</p>
                    <h1>Leaderboard</h1>
                </div>
                <Badge tone="neutral">Top 20</Badge>
            </div>
            {loading && <LoadingState />}
            {error && <ErrorState message={error} />}
            {!loading && !error && items.length === 0 && (
                <EmptyState>No ranked players yet.</EmptyState>
            )}
            {items.length > 0 && (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>User</th>
                                <th>Elo</th>
                                <th>XP</th>
                                <th>Tier</th>
                                <th>Winrate</th>
                                <th>Debates</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.userId}>
                                    <td>{item.rankPosition}</td>
                                    <td><code>{item.userId}</code></td>
                                    <td>{item.elo}</td>
                                    <td>{item.xp}</td>
                                    <td><Badge tone="win">{item.rankTier}</Badge></td>
                                    <td>{item.winrate}%</td>
                                    <td>{item.debatesCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function ProfilePage({ initialUserId }: { initialUserId?: string }) {
    const [userId, setUserId] = useState(initialUserId ?? '');
    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function loadStats(event?: FormEvent) {
        event?.preventDefault();
        if (!userId.trim()) {
            setError('Enter a user id for the demo.');
            return;
        }
        setLoading(true);
        setError(null);
        setStats(null);
        try {
            setStats(await api.getPlayerStats(userId.trim()));
        } catch (err) {
            setError(
                readError(
                    err,
                    'Profile stats endpoint is not available or this user has no stats.',
                ),
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (initialUserId) void loadStats();
    }, [initialUserId]);

    return (
        <div className="page-stack">
            <section className="card">
                <div className="section-title">
                    <div>
                        <p className="eyebrow">Player profile</p>
                        <h1>Stats lookup</h1>
                    </div>
                </div>
                <form className="inline-form" onSubmit={(event) => void loadStats(event)}>
                    <TextInput
                        label="User id"
                        value={userId}
                        onChange={setUserId}
                        placeholder="11111111-1111-1111-1111-111111111111"
                    />
                    <button className="btn btn-primary" disabled={loading}>
                        Load profile
                    </button>
                </form>
                {loading && <LoadingState />}
                {error && <ErrorState message={error} />}
            </section>
            {stats && (
                <section className="card">
                    <div className="section-title">
                        <h2><code>{stats.userId}</code></h2>
                        <Badge tone="win">{stats.rankTier}</Badge>
                    </div>
                    <div className="stats-grid">
                        <Metric label="XP" value={stats.xp} />
                        <Metric label="Elo" value={stats.elo} />
                        <Metric label="Winrate" value={`${stats.winrate}%`} />
                        <Metric label="Debates" value={stats.debatesCount} />
                        <Metric label="Wins" value={stats.wins} />
                        <Metric label="Losses" value={stats.losses} />
                        <Metric label="Draws" value={stats.draws} />
                    </div>
                </section>
            )}
        </div>
    );
}

function ResultPage({
    debateId,
    navigate,
}: {
    debateId: string;
    navigate: (path: string) => void;
}) {
    const [finalScore, setFinalScore] = useState<FinalDebateScore | null>(null);
    const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
    const [summary, setSummary] = useState<AudienceVoteSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError(null);
            const results = await Promise.allSettled([
                api.getFinalScore(debateId),
                api.getAiAnalysis(debateId),
                api.getVoteSummary(debateId),
            ]);
            if (results[0].status === 'fulfilled') setFinalScore(results[0].value);
            if (results[1].status === 'fulfilled') setAnalysis(results[1].value);
            if (results[2].status === 'fulfilled') setSummary(results[2].value);
            if (results.every((result) => result.status === 'rejected')) {
                setError('No result data is available for this debate yet.');
            }
            setLoading(false);
        }
        void load();
    }, [debateId]);

    return (
        <div className="page-stack">
            <section className="card">
                <div className="section-title">
                    <div>
                        <p className="eyebrow">Debate results</p>
                        <h1>{debateId}</h1>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate(`/debates/${encodeURIComponent(debateId)}`)}
                    >
                        Back to room
                    </button>
                </div>
                {loading && <LoadingState label="Loading results" />}
                {error && <ErrorState message={error} />}
                {finalScore && (
                    <div className="scoreboard">
                        <ScoreCard label="FOR" score={finalScore.finalForScore} />
                        <div className="winner">
                            <span>Winner</span>
                            <Badge tone={finalScore.winnerSide === 'FOR' ? 'for' : finalScore.winnerSide === 'AGAINST' ? 'against' : 'neutral'}>
                                {finalScore.winnerSide}
                            </Badge>
                        </div>
                        <ScoreCard label="AGAINST" score={finalScore.finalAgainstScore} />
                    </div>
                )}
            </section>
            <section className="grid-two">
                <div className="card">
                    <h2>Audience</h2>
                    {summary ? (
                        <div className="stats-grid compact">
                            <Metric label="Votes" value={summary.totalVotes} />
                            <Metric label="FOR" value={`${summary.forVotes} (${summary.forScore})`} />
                            <Metric
                                label="AGAINST"
                                value={`${summary.againstVotes} (${summary.againstScore})`}
                            />
                        </div>
                    ) : (
                        <EmptyState>Audience summary is not available.</EmptyState>
                    )}
                </div>
                <div className="card">
                    <h2>AI feedback</h2>
                    {analysis ? (
                        <div className="feedback">
                            <Badge tone={analysis.status === 'COMPLETED' ? 'win' : 'warn'}>
                                {analysis.status}
                            </Badge>
                            <p>{analysis.summary ?? analysis.errorMessage ?? 'No AI summary.'}</p>
                            <h3>FOR feedback</h3>
                            <p>{analysis.forFeedback ?? 'No FOR feedback.'}</p>
                            <h3>AGAINST feedback</h3>
                            <p>{analysis.againstFeedback ?? 'No AGAINST feedback.'}</p>
                        </div>
                    ) : (
                        <EmptyState>AI feedback is not available.</EmptyState>
                    )}
                </div>
            </section>
        </div>
    );
}

function AuthCard({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <section className="auth-card">
            <p className="eyebrow">AI Debate Arena</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            {children}
        </section>
    );
}

function TextInput({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    hint,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    hint?: string;
}) {
    return (
        <label className="field">
            <span>{label}</span>
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
            />
            {hint && <small>{hint}</small>}
        </label>
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

function ScoreCard({ label, score }: { label: string; score: number }) {
    return (
        <div className={`score-card ${label === 'FOR' ? 'for' : 'against'}`}>
            <span>{label}</span>
            <strong>{score}</strong>
        </div>
    );
}

function parseRoute(): Route {
    const url = new URL(window.location.href);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] === 'login') return { name: 'login' };
    if (segments[0] === 'signup') return { name: 'signup' };
    if (segments[0] === 'vote') return { name: 'vote' };
    if (segments[0] === 'leaderboard') return { name: 'leaderboard' };
    if (segments[0] === 'profile') {
        return { name: 'profile', userId: segments[1] };
    }
    if (segments[0] === 'results' && segments[1]) {
        return { name: 'results', debateId: decodeURIComponent(segments[1]) };
    }
    if (segments[0] === 'debates' && segments[1]) {
        return {
            name: 'debate',
            debateId: decodeURIComponent(segments[1]),
            mode: url.searchParams.get('mode') === 'spectator' ? 'spectator' : 'player',
        };
    }
    return { name: 'home' };
}

function readSession(): AuthSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AuthSession;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

function readError(err: unknown, fallback: string): string {
    if (err instanceof ApiError) return `${fallback} ${err.message}`;
    if (err instanceof Error) return `${fallback} ${err.message}`;
    return fallback;
}
