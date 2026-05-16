import type { Request } from 'express';

export const SESSION_COOKIE = 'unihub_session';

export function authorizationFromRequest(req: Request): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];
  if (cookieToken) return cookieToken;

  return undefined;
}
