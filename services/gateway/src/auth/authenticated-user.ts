export type AuthenticatedUser = {
    id: string;
};

export type AuthenticatedRequest = {
    headers: Record<string, string | string[] | undefined>;
    user?: AuthenticatedUser;
};
