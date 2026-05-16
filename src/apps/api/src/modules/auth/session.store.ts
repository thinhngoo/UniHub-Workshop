import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export const SESSION_TTL_SEC = 30 * 24 * 60 * 60;

@Injectable()
export class SessionStore {
  constructor(private readonly redis: RedisService) {}

  private key(sessionId: string): string {
    return `session:${sessionId}`;
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
