// ============================================================
// AppStore — estado global reativo (perfil + preferências),
// persistido em localStorage. Usa um padrão pub/sub mínimo.
// ============================================================

import { useSyncExternalStore } from 'react';
import type { Lang } from '../i18n/strings';

export type ThemePref = 'light' | 'dark' | 'system';

export interface Settings {
  lang: Lang;
  currency: string;
  theme: ThemePref;
  lastRoomCode?: string;
  /** Sincronização remota entre dispositivos (Firestore). */
  remoteSync?: boolean;
  /** Sempre mostrar animações (ignora prefers-reduced-motion do sistema). */
  animations?: boolean;
}

export interface Profile {
  name: string;
  photo: string | null;
}

type Listener = () => void;

const LS_SETTINGS = 'divide-ae:settings';
const LS_PROFILE = 'divide-ae:profile';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage cheio/indisponível — ignora silenciosamente */
  }
}

class ReactiveStore<T> {
  private value: T;
  private listeners = new Set<Listener>();
  private persistKey?: string;

  constructor(initial: T, persistKey?: string) {
    this.persistKey = persistKey;
    this.value = persistKey ? load(persistKey, initial) : initial;
  }

  get(): T {
    return this.value;
  }

  set(next: T) {
    this.value = next;
    if (this.persistKey) save(this.persistKey, next);
    this.listeners.forEach((l) => l());
  }

  update(fn: (prev: T) => T) {
    this.set(fn(this.value));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const defaultSettings: Settings = {
  lang: 'pt-BR',
  currency: 'BRL',
  theme: 'system',
  remoteSync: true,
  animations: true,
};

export const settingsStore = new ReactiveStore<Settings>(defaultSettings, LS_SETTINGS);

export const profileStore = new ReactiveStore<Profile>(
  { name: '', photo: null },
  LS_PROFILE,
);

export function useStore<T>(store: ReactiveStore<T>): T {
  // React-friendly: força re-render ao mudar.
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.get(),
  );
}
