export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
    return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export type AuthenticatedUser = {
    id: string;
    role: Role;
};

// Claims minted by the auth service and verified here with the public key.
export type JwtAccessPayload = {
    sub: string;
    role: Role;
};

export type AuthenticatedRequest = {
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string | undefined>;
    user?: AuthenticatedUser;
};
