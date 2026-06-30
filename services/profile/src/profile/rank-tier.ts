export const RANK_TIERS = [
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'DIAMOND',
    'MASTER',
] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export function deriveRankTierFromElo(elo: number): RankTier {
    if (elo >= 2000) return 'MASTER';
    if (elo >= 1800) return 'DIAMOND';
    if (elo >= 1600) return 'PLATINUM';
    if (elo >= 1400) return 'GOLD';
    if (elo >= 1200) return 'SILVER';
    return 'BRONZE';
}
