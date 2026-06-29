import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
    return <div className="state state-loading">{label}...</div>;
}

export function ErrorState({ message }: { message: string }) {
    return <div className="state state-error">{message}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
    return <div className="state state-empty">{children}</div>;
}

export function Badge({
    children,
    tone = 'neutral',
}: {
    children: ReactNode;
    tone?: 'neutral' | 'for' | 'against' | 'win' | 'warn';
}) {
    return <span className={`badge badge-${tone}`}>{children}</span>;
}
