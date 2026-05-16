import type { Request } from 'express';
import { SESSION_COOKIE } from '../../constant';

export function extractAccessToken(req: Request): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header !== 'string') return undefined;
  const trimmed = header.trim();
  const match = /^Bearer\s+(\S+)/i.exec(trimmed);
  return match?.[1];
}

export function extractSessionId(req: Request): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header === 'string' && header.trim().length > 0) {
    const trimmed = header.trim();
    if (!/^Bearer\s+/i.test(trimmed)) {
      return trimmed;
    }
  }

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];
  if (cookieToken) return cookieToken;

  return undefined;
}
