import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setToken } from './api';

export type User = { id: number; name: string; email: string; dob: string; role: string; admin?: boolean; leader?: boolean; demo?: boolean; mission: string; environment: string; missionYears: number | null; heightCm?: number | null; weightKg?: number | null; missionGoal?: { dest: string | null; tasks: string[] } | null; passwordless: boolean; createdAt: string };
export type CodePurpose = 'signup' | 'login' | 'doctor';
type Ctx = {
  user: User | null; ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: Record<string, unknown>) => Promise<void>;
  requestCode: (email: string, purpose: CodePurpose) => Promise<{ devCode?: string }>;
  verifyCode: (email: string, purpose: CodePurpose, code: string, profile?: Record<string, unknown>) => Promise<User>;
  demoLogin: (as: 'astronaut' | 'doctor' | 'leader') => Promise<User>;
  logout: () => Promise<void>;
  faceLogin: (email: string, descriptor: number[]) => Promise<User>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try { setUser((await api<{ user: User }>('/api/auth/me')).user); } catch { setUser(null); }
  }, []);
  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);

  const done = async (r: { user: User; token?: string }) => { if (r.token) await setToken(r.token); setUser(r.user); return r.user; };
  const login = async (email: string, password: string) => { await done(await api('/api/auth/login', { body: { email, password } })); };
  const register = async (body: Record<string, unknown>) => { await done(await api('/api/auth/register', { body })); };
  const requestCode = (email: string, purpose: CodePurpose) => api<{ devCode?: string }>('/api/auth/code', { body: { email, purpose } });
  const verifyCode = async (email: string, purpose: CodePurpose, code: string, profile?: Record<string, unknown>) =>
    done(await api('/api/auth/code/verify', { body: { email, purpose, code, profile } }));
  const faceLogin = async (email: string, descriptor: number[]) => done(await api('/api/auth/face/login', { body: { email, descriptor, live: true } }));
  const demoLogin = async (as: 'astronaut' | 'doctor' | 'leader') => done(await api('/api/demo/login', { body: { as } }));
  const logout = async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} await setToken(null); setUser(null); };

  return <AuthCtx.Provider value={{ user, ready, login, register, requestCode, verifyCode, demoLogin, logout, faceLogin, refresh, setUser }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
