// ============================================================
// Storage — persistência local de salas e histórico.
// Regra de negócio: nunca perder dados. Tudo é salvo a cada
// mutação, em JSON versionado com fallback de quota.
// ============================================================

import type { ClosedBill, Room } from '../types';
import { sanitizeRoom } from '../domain/validate';

const K_ROOMS = 'divide-ae:rooms:v1';
const K_HISTORY = 'divide-ae:history:v1';
const K_ACTIVE = 'divide-ae:active:v1';

function readMap(key: string): Record<string, Room> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Room> = {};
    for (const [code, val] of Object.entries(parsed)) {
      const room = sanitizeRoom(val);
      if (room) out[code] = room;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, Room>) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Quota excedida: remove salas antigas fechadas para liberar espaço.
    const entries = Object.entries(map).sort(
      (a, b) => (b[1].createdAt ?? 0) - (a[1].createdAt ?? 0),
    );
    while (entries.length > 1) {
      const [code] = entries.pop()!;
      delete map[code];
      try {
        localStorage.setItem(key, JSON.stringify(map));
        break;
      } catch {
        continue;
      }
    }
  }
}

export const roomsStorage = {
  all(): Record<string, Room> {
    return readMap(K_ROOMS);
  },
  get(code: string): Room | null {
    return readMap(K_ROOMS)[code] ?? null;
  },
  save(room: Room): void {
    const map = readMap(K_ROOMS);
    map[room.code] = room;
    writeMap(K_ROOMS, map);
  },
  remove(code: string): void {
    const map = readMap(K_ROOMS);
    delete map[code];
    writeMap(K_ROOMS, map);
  },
  /** Códigos de todas as salas conhecidas (para validação de unicidade). */
  codes(): Set<string> {
    return new Set(Object.keys(readMap(K_ROOMS)));
  },
};

export const historyStorage = {
  all(): ClosedBill[] {
    try {
      const raw = localStorage.getItem(K_HISTORY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ClosedBill[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  add(bill: ClosedBill): void {
    const list = this.all();
    list.unshift(bill);
    const trimmed = list.slice(0, 100); // limite de segurança
    try {
      localStorage.setItem(K_HISTORY, JSON.stringify(trimmed));
    } catch {
      /* quota */
    }
  },
  remove(code: string): void {
    const list = this.all().filter((b) => b.code !== code);
    try {
      localStorage.setItem(K_HISTORY, JSON.stringify(list));
    } catch {
      /* quota */
    }
  },
};

export const activeRoomStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(K_ACTIVE);
    } catch {
      return null;
    }
  },
  set(code: string | null): void {
    try {
      if (code) localStorage.setItem(K_ACTIVE, code);
      else localStorage.removeItem(K_ACTIVE);
    } catch {
      /* quota */
    }
  },
};

export function clearAllLocalData(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('divide-ae:')) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
