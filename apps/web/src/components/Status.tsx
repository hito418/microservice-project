import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
    return (
        <div className="state state-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            {label}...
        </div>
    );
}

export function ErrorState({
    message,
    title = 'Request failed',
}: {
    message: string;
    title?: string;
}) {
    return (
        <div className="state state-error" role="alert">
            <strong>{title}</strong>
            <span>{message}</span>
        </div>
    );
}

export function EmptyState({ children }: { children: ReactNode }) {
    return <div className="state state-empty">{children}</div>;
}

export function SuccessState({ children }: { children: ReactNode }) {
    return <div className="state state-success">{children}</div>;
}

export function Badge({
    children,
    tone = 'neutral',
}: {
    children: ReactNode;
    tone?: 'neutral' | 'for' | 'against' | 'win' | 'warn' | 'danger' | 'info';
}) {
    return <span className={`badge badge-${tone}`}>{children}</span>;
}
