// app/src/store/flowStoreSessions.ts
import { SessionListItem, SessionSnapshot } from './types';

export const SESSION_INDEX_KEY = 'sanskrit-keyboard.session-index.v2';
export const INITIAL_SESSION_ID = 'session-initial';
export const INITIAL_SESSION_NAME = 'Current Session';

export const getSessionStorageKey = (sessionId: string) => `sanskrit-keyboard.session.v2.${sessionId}`;

export const readStoredSessionSnapshot = (sessionId: string): SessionSnapshot | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(getSessionStorageKey(sessionId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionSnapshot;
  } catch (error) {
    console.error(`Failed to parse session ${sessionId}:`, error);
    return null;
  }
};

const sortSessionList = (sessions: SessionListItem[]) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

export const readSessionIndex = (): SessionListItem[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(SESSION_INDEX_KEY);
  if (!raw) return [];

  try {
    return sortSessionList(JSON.parse(raw) as SessionListItem[]);
  } catch {
    return [];
  }
};

export const writeSessionIndex = (items: SessionListItem[]) => {
  if (typeof window === 'undefined') return items;
  const nextItems = sortSessionList(items).slice(0, 25);
  window.localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(nextItems));
  return nextItems;
};

export const createSessionId = () => `session-${Date.now()}`;

export const createDefaultSessionName = () => {
  const now = new Date();
  return `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
