import type { User } from '@unihub/types';

declare global {
  namespace Express {
    interface Request {
      /** Set by AuthGuard after successful authentication. */
      user?: User;
    }
  }
}

export {};
