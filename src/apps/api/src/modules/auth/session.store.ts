import { Injectable } from '@nestjs/common';
import { SESSION_REDIS_KEY_PREFIX, SESSION_TTL_SEC } from '../../constant';
import { RedisService } from '../database/redis.service';

@Injectable()
export class SessionStore {
  constructor(private readonly redis: RedisService) {}

  private key(sessionId: string): string {
    return `${SESSION_REDIS_KEY_PREFIX}${sessionId}`;
  }

  async set(sessionId: string, userId: string): Promise<void> {
    await this.redis.client.set(
      this.key(sessionId),
      userId,
      'EX',
      SESSION_TTL_SEC,
    );
  }

  async getUserId(sessionId: string): Promise<string | null> {
    return this.redis.client.get(this.key(sessionId));
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.client.del(this.key(sessionId));
  }
}
