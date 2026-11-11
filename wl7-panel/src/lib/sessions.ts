const sessions = new Set<string>();

export function createSession(token: string) { sessions.add(token); }
export function isValidSession(token: string | undefined): boolean { return !!token && sessions.has(token); }
