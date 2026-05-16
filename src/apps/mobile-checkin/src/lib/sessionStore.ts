import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'unihub.checkin.sessionId';

let cached: string | null | undefined;

export async function loadSessionId(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    cached = await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    cached = null;
  }
  return cached;
}

export async function persistSessionId(sessionId: string): Promise<void> {
  cached = sessionId;
  await SecureStore.setItemAsync(SESSION_KEY, sessionId);
}

export async function clearSessionId(): Promise<void> {
  cached = null;
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    /* key may already be absent */
  }
}
