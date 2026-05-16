import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const ExtractToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const h = req.headers['authorization'];
    if (typeof h === 'string' && h.trim().length > 0) return h.trim();
    return undefined;
  },
);
