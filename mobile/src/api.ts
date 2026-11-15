import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const env = process.env.EXPO_PUBLIC_API_URL;
export const API_URL: string =
  env ?? (Platform.OS === 'web'
    ? (typeof location !== 'undefined' && location.hostname === 'localhost' && location.port !== '' && location.port !== '4000' ? 'http://localhost:4000' : '')
    : 'http://localhost:4000');

const TOKEN_KEY = 'perigee.session';
let memToken: string | null = null;

export async function getToken() {
  if (Platform.OS === 'web') return null; // web uses the httpOnly cookie
  if (memToken) return memToken;
  memToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return memToken;
}
export async function setToken(t: string | null) {
  if (Platform.OS === 'web') return;
  memToken = t;
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee' };
  if (Platform.OS !== 'web') {
    headers['X-Client'] = 'native';
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Cannot reach the HMSC server. Check your connection.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}
