import type { Request } from 'express';

const ACCESS_COOKIE = 'unihub_access';

/**
 * Resolves an `Authorization` header value from a request.
 * Falls back to the session access cookie used by browser session clients.
 */
export function authorizationFromRequest(req: Request): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  if (cookieToken) return `Bearer ${cookieToken}`;

  return undefined;
}
