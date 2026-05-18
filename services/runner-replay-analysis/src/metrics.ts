import { DebateMessage, Side } from './debate.repository';

export interface LocalMetrics {
    argCount: number;
    avgLength: number;
    avgResponseTimeMs: number;
    repetitions: number;
    volumeChars: number;
    balance: number;
}

export function groupBySide(messages: DebateMessage[]): Record<Side, DebateMessage[]> {
    const out: Record<Side, DebateMessage[]> = { POUR: [], CONTRE: [] };
    for (const m of messages) out[m.side].push(m);
    return out;
}

export function computeLocalMetrics(messages: DebateMessage[]): LocalMetrics {
    const argCount = messages.length;
    const volumeChars = messages.reduce((s, m) => s + m.content.length, 0);
    const avgLength = argCount > 0 ? volumeChars / argCount : 0;

    let avgResponseTimeMs = 0;
    if (argCount > 1) {
        let total = 0;
        for (let i = 1; i < messages.length; i++) {
            total += messages[i].sentAt - messages[i - 1].sentAt;
        }
        avgResponseTimeMs = total / (argCount - 1);
    }

    const seen = new Map<string, number>();
    for (const m of messages) {
        const key = normalize(m.content);
        seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    let repetitions = 0;
    for (const count of seen.values()) if (count > 1) repetitions += count - 1;

    const balance = argCount === 0 ? 0 : repetitions / argCount;

    return { argCount, avgLength, avgResponseTimeMs, repetitions, volumeChars, balance };
}

function normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
