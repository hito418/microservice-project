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
import {
    Badge,
    EmptyState,
    ErrorState,
    LoadingState,
    SuccessState,
} from './components/Status';
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
const LAST_DEBATE_ID_KEY = 'ai-debate-last-debate-id';
const LAST_USER_ID_KEY = 'ai-debate-last-user-id';

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
        saveLastUserId(next.userId);
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
            saveLastUserId(result.id);
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
                    <SuccessState>
                        Account created. User id: <code>{createdUserId}</code>
                    </SuccessState>
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
    const [manualDebateId, setManualDebateId] = useState(
        readStorage(LAST_DEBATE_ID_KEY),
    );
    const [manualUserId, setManualUserId] = useState(
        session?.userId ?? readStorage(LAST_USER_ID_KEY),
    );
    const [manualResultId, setManualResultId] = useState(
        readStorage(LAST_DEBATE_ID_KEY),
    );
    const [launchMessage, setLaunchMessage] = useState<string | null>(null);

    function openDebate(mode: 'player' | 'spectator') {
        const debateId = manualDebateId.trim();
        if (!debateId) {
            setLaunchMessage(
                'Matchmaking HTTP endpoint is not available in gateway yet. Enter a debate id from backend logs or scoring seed data for the demo.',
            );
            return;
        }
        saveLastDebateId(debateId);
        navigate(`/debates/${encodeURIComponent(debateId)}?mode=${mode}`);
    }

    function openResults() {
        const debateId = manualResultId.trim() || manualDebateId.trim();
        if (!debateId) {
            setLaunchMessage('Enter a debate id to inspect final score and AI feedback.');
            return;
        }
        saveLastDebateId(debateId);
        navigate(`/results/${encodeURIComponent(debateId)}`);
    }

    function openProfile() {
        const nextUserId = manualUserId.trim();
        if (!nextUserId) {
            setLaunchMessage('Enter a user id or login before opening profile stats.');
            return;
        }
        saveLastUserId(nextUserId);
        navigate(`/profile/${encodeURIComponent(nextUserId)}`);
    }

    return (
        <div className="page-grid">
            <section className="hero-panel">
                <p className="eyebrow">Demo control room</p>
                <h1>AI Debate Arena</h1>
                <p>
                    Run the tomorrow demo from one place: enter known ids, open the
                    room, cast audience votes, inspect scoring, and show rankings.
                </p>
                <div className="cta-grid">
                    <button className="btn btn-primary" onClick={() => openDebate('player')}>
                        Launch debate
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate('/vote')}
                    >
                        Vote on a recent debate
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate('/leaderboard')}
                    >
                        Leaderboard
                    </button>
                    <button className="btn btn-secondary" onClick={openProfile}>
                        Profile stats
                    </button>
                    <button className="btn btn-secondary" onClick={openResults}>
                        View debate results
                    </button>
                </div>
                {launchMessage && <ErrorState message={launchMessage} />}
            </section>
            <section className="card">
                <div className="section-title">
                    <div>
                        <p className="eyebrow">Fast paths</p>
                        <h2>Manual demo inputs</h2>
                    </div>
                    <Badge tone={session ? 'win' : 'neutral'}>
                        {session ? 'Logged in' : 'Guest'}
                    </Badge>
                </div>
                <div className="form">
                    <TextInput
                        label="Debate id"
                        value={manualDebateId}
                        onChange={setManualDebateId}
                        placeholder="debate-1"
                    />
                    <TextInput
                        label="User id"
                        value={manualUserId}
                        onChange={setManualUserId}
                        placeholder="11111111-1111-1111-1111-111111111111"
                    />
                    <TextInput
                        label="Results debate id"
                        value={manualResultId}
                        onChange={setManualResultId}
                        placeholder="same debate id, or another one"
                    />
                    <div className="button-row">
                        <button
                            className="btn btn-secondary"
                            onClick={() => openDebate('player')}
                        >
                            Open as player
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => openDebate('spectator')}
                        >
                            Open as spectator
                        </button>
                        <button className="btn btn-secondary" onClick={openResults}>
                            Open results
                        </button>
                    </div>
                </div>
                <div className="session-box">
                    <span>Current user</span>
                    <strong>{session?.userId ?? 'Not logged in'}</strong>
                </div>
            </section>
            <section className="card full-width">
                <div className="demo-steps">
                    <Metric label="1. Room" value="Player or spectator view" />
                    <Metric label="2. Vote" value="FOR / AGAINST audience flow" />
                    <Metric label="3. Results" value="Score + AI feedback" />
                    <Metric label="4. Ranking" value="Leaderboard + profile stats" />
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

    useEffect(() => {
        saveLastDebateId(debateId);
    }, [debateId]);

    return (
        <div className="page-stack">
            <section className="card">
                <div className="section-title">
                    <div>
                        <p className="eyebrow">Debate room</p>
                        <h1>{debateId}</h1>
                    </div>
                    <div className="title-actions">
                        <Badge tone={readonly ? 'info' : 'win'}>
                            {readonly ? 'Spectator' : 'Player'}
                        </Badge>
                        <Badge tone="warn">Realtime pending</Badge>
                    </div>
                </div>
                <div className="room-board">
                    <div className="question-panel">
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
                    <div className="message-placeholder">
                        <span className="message-avatar">FOR</span>
                        <div>
                            <strong>Argument stream placeholder</strong>
                            <p>
                                Messages and live events are not exposed by the gateway
                                yet. The interface is ready to render turns once the
                                realtime runner is connected.
                            </p>
                        </div>
                    </div>
                    <div className="message-placeholder muted-card">
                        <span className="message-avatar against">AG</span>
                        <div>
                            <strong>Opponent response placeholder</strong>
                            <p>
                                For tomorrow, drive the room with known debate ids and use
                                voting/results to show the completed flow.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="button-row">
                    <button
                        className="btn btn-secondary"
                        onClick={() =>
                            navigate(`/debates/${encodeURIComponent(debateId)}?mode=player`)
                        }
                    >
                        Player mode
                    </button>
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
            {readonly ? (
                <VotePanel debateId={debateId} />
            ) : (
                <section className="card">
                    <EmptyState>
                        Spectator voting is one click away. Switch to spectator mode to
                        open the audience vote panel for this debate.
                    </EmptyState>
                </section>
            )}
        </div>
    );
}

function RandomVotePage({ navigate }: { navigate: (path: string) => void }) {
    const [loading, setLoading] = useState(false);
    const [debate, setDebate] = useState<RandomRecentDebate | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualDebateId, setManualDebateId] = useState(
        readStorage(LAST_DEBATE_ID_KEY),
    );

    async function findDebate() {
        setLoading(true);
        setError(null);
        setDebate(null);
        try {
            const nextDebate = await api.getRandomRecentDebate();
            saveLastDebateId(nextDebate.debateId);
            setManualDebateId(nextDebate.debateId);
            setDebate(nextDebate);
        } catch (err) {
            setError(
                readError(
                    err,
                    'No recent debate available. Enter a debate id manually if you have one.',
                ),
            );
        } finally {
            setLoading(false);
        }
    }

    function openManualVote() {
        const debateId = manualDebateId.trim();
        if (!debateId) {
            setError('Enter a debate id to open spectator voting.');
            return;
        }
        saveLastDebateId(debateId);
        navigate(`/debates/${encodeURIComponent(debateId)}?mode=spectator`);
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
                            <span>{debate.voteCount} votes</span>
                        </div>
                        <Badge tone="info">{debate.status}</Badge>
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
                {!loading && !debate && !error && (
                    <EmptyState>
                        Use the picker or enter a known debate id from the backend demo
                        data.
                    </EmptyState>
                )}
            </section>
            <section className="card">
                <div className="section-title">
                    <div>
                        <p className="eyebrow">Manual fallback</p>
                        <h2>Open voting by debate id</h2>
                    </div>
                </div>
                <form className="inline-form" onSubmit={(event) => {
                    event.preventDefault();
                    openManualVote();
                }}>
                    <TextInput
                        label="Debate id"
                        value={manualDebateId}
                        onChange={setManualDebateId}
                        placeholder="debate-1"
                    />
                    <button className="btn btn-primary">Open voting</button>
                </form>
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
                <div className="title-actions">
                    <Badge tone="neutral">Top 20</Badge>
                    <Badge tone="info">Elo desc / XP desc</Badge>
                </div>
            </div>
            {loading && <LoadingState />}
            {error && <ErrorState message={error} />}
            {!loading && !error && items.length === 0 && (
                <EmptyState>
                    No ranked players yet. Close a debate through the ranking flow to
                    populate this board.
                </EmptyState>
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
                                <th>W / L / D</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.userId}>
                                    <td>
                                        <span className="rank-cell">#{item.rankPosition}</span>
                                    </td>
                                    <td><code>{item.userId}</code></td>
                                    <td>{item.elo}</td>
                                    <td>{item.xp}</td>
                                    <td>
                                        <Badge tone={tierTone(item.rankTier)}>
                                            {item.rankTier}
                                        </Badge>
                                    </td>
                                    <td>{item.winrate}%</td>
                                    <td>{item.debatesCount}</td>
                                    <td>
                                        {item.wins} / {item.losses} / {item.draws}
                                    </td>
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
    const [userId, setUserId] = useState(
        initialUserId ?? readStorage(LAST_USER_ID_KEY),
    );
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
            const nextUserId = userId.trim();
            const nextStats = await api.getPlayerStats(nextUserId);
            saveLastUserId(nextUserId);
            setStats(nextStats);
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
                        onChange={(value) => {
                            setUserId(value);
                            if (value.trim()) saveLastUserId(value.trim());
                        }}
                        placeholder="11111111-1111-1111-1111-111111111111"
                    />
                    <button className="btn btn-primary" disabled={loading}>
                        Load profile
                    </button>
                </form>
                {loading && <LoadingState />}
                {error && <ErrorState message={error} />}
            </section>
            {!loading && !error && !stats && (
                <section className="card">
                    <EmptyState>
                        Enter a user id to load XP, Elo, tier and debate record for the
                        demo.
                    </EmptyState>
                </section>
            )}
            {stats && (
                <section className="card">
                    <div className="section-title">
                        <h2><code>{stats.userId}</code></h2>
                        <Badge tone={tierTone(stats.rankTier)}>{stats.rankTier}</Badge>
                    </div>
                    <div className="stats-grid">
                        <Metric label="XP" value={stats.xp} />
                        <Metric label="Elo" value={stats.elo} />
                        <Metric label="Winrate" value={`${stats.winrate}%`} />
                        <Metric label="Debates" value={stats.debatesCount} />
                    </div>
                    <div className="record-strip">
                        <Metric label="Wins" value={stats.wins} />
                        <Metric label="Losses" value={stats.losses} />
                        <Metric label="Draws" value={stats.draws} />
                    </div>
                    <p className="muted-line">
                        Last update: {formatDate(stats.updatedAt)}
                    </p>
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
    const [lookupDebateId, setLookupDebateId] = useState(debateId);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError(null);
            setWarnings([]);
            setLookupDebateId(debateId);
            setFinalScore(null);
            setAnalysis(null);
            setSummary(null);
            saveLastDebateId(debateId);
            const results = await Promise.allSettled([
                api.getFinalScore(debateId),
                api.getAiAnalysis(debateId),
                api.getVoteSummary(debateId),
            ]);
            if (results[0].status === 'fulfilled') setFinalScore(results[0].value);
            if (results[1].status === 'fulfilled') setAnalysis(results[1].value);
            if (results[2].status === 'fulfilled') setSummary(results[2].value);
            setWarnings(
                results
                    .map((result, index) =>
                        result.status === 'rejected'
                            ? `${['Final score', 'AI analysis', 'Vote summary'][index]}: ${readError(result.reason, 'Unavailable.')}`
                            : null,
                    )
                    .filter((item): item is string => item !== null),
            );
            if (results.every((result) => result.status === 'rejected')) {
                setError('No result data is available for this debate yet.');
            }
            setLoading(false);
        }
        void load();
    }, [debateId]);

    function openResults(event: FormEvent) {
        event.preventDefault();
        const nextDebateId = lookupDebateId.trim();
        if (!nextDebateId) {
            setError('Enter a debate id to load results.');
            return;
        }
        saveLastDebateId(nextDebateId);
        navigate(`/results/${encodeURIComponent(nextDebateId)}`);
    }

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
                <form className="inline-form compact-form" onSubmit={openResults}>
                    <TextInput
                        label="Change debate id"
                        value={lookupDebateId}
                        onChange={setLookupDebateId}
                        placeholder="debate-1"
                    />
                    <button className="btn btn-primary">Load results</button>
                </form>
                {loading && <LoadingState label="Loading results" />}
                {error && <ErrorState message={error} />}
                {!loading && warnings.length > 0 && (
                    <div className="warning-list">
                        {warnings.map((warning) => (
                            <div className="state state-warning" key={warning}>
                                {warning}
                            </div>
                        ))}
                    </div>
                )}
                {finalScore && (
                    <>
                        <div className="scoreboard">
                            <ScoreCard label="FOR" score={finalScore.finalForScore} />
                            <div className="winner">
                                <span>Winner</span>
                                <Badge tone={winnerTone(finalScore.winnerSide)}>
                                    {finalScore.winnerSide}
                                </Badge>
                            </div>
                            <ScoreCard
                                label="AGAINST"
                                score={finalScore.finalAgainstScore}
                            />
                        </div>
                        <div className="stats-grid result-breakdown">
                            <Metric label="AI FOR" value={finalScore.aiForScore} />
                            <Metric label="AI AGAINST" value={finalScore.aiAgainstScore} />
                            <Metric
                                label="Audience FOR"
                                value={finalScore.audienceForScore}
                            />
                            <Metric
                                label="Audience AGAINST"
                                value={finalScore.audienceAgainstScore}
                            />
                        </div>
                    </>
                )}
            </section>
            <section className="grid-two">
                <div className="card">
                    <div className="section-title">
                        <div>
                            <p className="eyebrow">Audience</p>
                            <h2>Voting summary</h2>
                        </div>
                    </div>
                    {summary ? (
                        <div className="vote-summary">
                            <Metric label="Votes" value={summary.totalVotes} />
                            <AudienceLine
                                label="FOR"
                                votes={summary.forVotes}
                                score={summary.forScore}
                                total={summary.totalVotes}
                            />
                            <AudienceLine
                                label="AGAINST"
                                votes={summary.againstVotes}
                                score={summary.againstScore}
                                total={summary.totalVotes}
                            />
                        </div>
                    ) : (
                        <EmptyState>Audience summary is not available.</EmptyState>
                    )}
                </div>
                <div className="card">
                    <div className="section-title">
                        <div>
                            <p className="eyebrow">AI judge</p>
                            <h2>Feedback</h2>
                        </div>
                        {analysis && (
                            <Badge tone={analysis.status === 'COMPLETED' ? 'win' : 'warn'}>
                                {analysis.status}
                            </Badge>
                        )}
                    </div>
                    {analysis ? (
                        <div className="feedback">
                            {analysis.status !== 'COMPLETED' && (
                                <div className="state state-warning">
                                    AI analysis is not completed. Showing the best
                                    available fallback data.
                                </div>
                            )}
                            <div className="feedback-summary">
                                <h3>Summary</h3>
                                <p>
                                    {analysis.summary ??
                                        analysis.errorMessage ??
                                        'No AI summary returned.'}
                                </p>
                            </div>
                            <div className="feedback-grid">
                                <div className="feedback-side for-side">
                                    <Badge tone="for">FOR</Badge>
                                    <p>{analysis.forFeedback ?? 'No FOR feedback.'}</p>
                                </div>
                                <div className="feedback-side against-side">
                                    <Badge tone="against">AGAINST</Badge>
                                    <p>
                                        {analysis.againstFeedback ??
                                            'No AGAINST feedback.'}
                                    </p>
                                </div>
                            </div>
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

function AudienceLine({
    label,
    votes,
    score,
    total,
}: {
    label: 'FOR' | 'AGAINST';
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

function readStorage(key: string): string {
    return localStorage.getItem(key) ?? '';
}

function saveLastDebateId(debateId: string) {
    localStorage.setItem(LAST_DEBATE_ID_KEY, debateId);
}

function saveLastUserId(userId: string) {
    localStorage.setItem(LAST_USER_ID_KEY, userId);
}

function tierTone(rankTier: string): 'neutral' | 'win' | 'info' {
    const tier = rankTier.toLowerCase();
    if (tier.includes('gold') || tier.includes('diamond') || tier.includes('master')) {
        return 'win';
    }
    if (tier.includes('silver') || tier.includes('bronze')) return 'info';
    return 'neutral';
}

function winnerTone(winnerSide: string): 'for' | 'against' | 'neutral' {
    if (winnerSide === 'FOR') return 'for';
    if (winnerSide === 'AGAINST') return 'against';
    return 'neutral';
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
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
    if (err instanceof ApiError) return `${fallback} HTTP ${err.status}: ${err.message}`;
    if (err instanceof Error) return `${fallback} ${err.message}`;
    return fallback;
}
