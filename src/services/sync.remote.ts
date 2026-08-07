// ============================================================
// Sync remoto — adaptador Firestore (dispositivos diferentes).
//
// Este módulo só entra no bundle quando o app detecta VITE_FB_*
// configurado E a sincronização remota está habilitada — o
// `sync.ts` o carrega via dynamic import (chunk separado).
//
// Referência: backend/README.md + backend/firestore.rules.
// O transporte publica mutações no documento `rooms/{code}` e
// acompanha o mesmo documento via onSnapshot; a persistência
// local (offline-first) continua sendo o armazenamento canônico.
// ============================================================

import type { Room, SyncEvent } from '../types';

export interface RemoteTransport {
  emit(event: SyncEvent): Promise<void>;
  watchRoom(code: string, onEvent: (e: SyncEvent) => void): () => void;
  disconnect(): void;
}

function firebaseConfig(): { apiKey: string; authDomain: string; projectId: string } | null {
  const apiKey = import.meta.env.VITE_FB_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FB_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FB_PROJECT_ID as string | undefined;
  if (!apiKey || !authDomain || !projectId) return null;
  return { apiKey, authDomain, projectId };
}

/**
 * Cria o transporte remoto. Retorna `null` quando o Firestore não
 * está configurado (sem VITE_FB_*) — o app segue local-only.
 * Lança erro se a conexão/auth falhar; o chamador converte em
 * status 'error' sem quebrar o transporte local.
 */
export async function createRemoteTransport(): Promise<RemoteTransport | null> {
  const cfg = firebaseConfig();
  if (!cfg) return null;

  const fb = await import('firebase/app');
  const fs = await import('firebase/firestore');
  const authMod = await import('firebase/auth');

  const app = fb.initializeApp(cfg);
  const db = fs.getFirestore(app);
  const auth = authMod.getAuth(app);
  // Auth anônima — exigida pelas regras de segurança (request.auth != null).
  await authMod.signInAnonymously(auth);

  let stopped = false;
  const watchers = new Set<() => void>();

  const emit = async (event: SyncEvent): Promise<void> => {
    if (event.type !== 'room:upsert' && event.type !== 'room:close') return;
    const roomRef = fs.doc(db, 'rooms', event.room.code);
    await fs.setDoc(roomRef, event.room, { merge: true });
    if (event.type === 'room:close') {
      await fs.setDoc(fs.doc(db, 'history', event.room.code), {
        ...event.room,
        summary: event.summary,
        closedBy: event.closedBy,
      });
    }
  };

  const watchRoom = (code: string, onEvent: (e: SyncEvent) => void): (() => void) => {
    let unsub: (() => void) | null = null;
    const subscribe = () => {
      unsub = fs.onSnapshot(
        fs.doc(db, 'rooms', code),
        (snap) => {
          if (stopped || !snap.exists()) return;
          const room = snap.data() as { code?: string } | undefined;
          if (room?.code) onEvent({ type: 'room:upsert', room: room as unknown as Room });
        },
        () => {
          // Perdeu a conexão com o Firestore (rede/auth). O listener é
          // descartado pelo SDK — re-assina com backoff curto.
          if (stopped || !unsub) return;
          watchers.delete(unsub);
          unsub = null;
          window.setTimeout(() => {
            if (!stopped) subscribe();
          }, 3000);
        },
      );
      if (unsub) watchers.add(unsub);
    };
    subscribe();
    return () => {
      if (unsub) {
        watchers.delete(unsub);
        unsub();
        unsub = null;
      }
    };
  };

  const disconnect = (): void => {
    stopped = true;
    watchers.forEach((u) => u());
    watchers.clear();
  };

  return { emit, watchRoom, disconnect };
}
