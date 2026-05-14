import { randomUUID } from 'expo-crypto';

export function newUuid(): string {
  return randomUUID();
}
