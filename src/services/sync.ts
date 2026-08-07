// ============================================================
// Sync — sincronização em tempo real.
// Camada de transporte plugável:
//  - LOCAL (sempre ativo): BroadcastChannel (abas/janelas do
//    mesmo navegador) + evento 'storage' como fallback.
//  - REMOTA (opcional): Firestore entre dispositivos diferentes.
//    Ativa quando configurada (VITE_FB_*) e habilitada nas
//    configurações; carregada sob demanda via dynamic import.
// ============================================================

import { useSyncExternalStore } from 'react';
import type { SyncEvent } from '../types';
import type { RemoteTransport } from './sync.remote';

export type RemoteSyncStatus = 'disabled' | 'notConfigured' | 'connecting' | 'connected' | 'error';

type SyncListener = (event: SyncEvent) => void;
type StatusListener = (status: RemoteSyncStatus) => void;

const CHANNEL_NAME = 'divide-ae:sync';

const listeners = new Set<SyncListener>();
const statusListeners = new Set<StatusListener>();

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

// Recebe eventos de outras abas/janelas do mesmo navegador.
if (channel) {
  channel.onmessage = (msg: MessageEvent<SyncEvent>) => {
    listeners.forEach((l) => l(msg.data));
  };
}

// --- Estado do transporte remoto ---------------------------------

let remoteEnabled = true;
// Vite define import.meta.env estaticamente; variável ausente vira `undefined`.
let remoteConfigured = !!import.meta.env.VITE_FB_PROJECT_ID;

let remoteStatus: RemoteSyncStatus = remoteConfigured ? 'disabled' : 'notConfigured';
let transport: RemoteTransport | null = null;
let transportPromise: Promise<RemoteTransport | null> | null = null;
let activeRoomCode: string | null = null;
let activeUnsub: (() => void) | null = null;
let lastRetryAt = 0;

function setStatus(status: RemoteSyncStatus) {
  if (remoteStatus === status) return;
  remoteStatus = status;
  statusListeners.forEach((l) => l(status));
}

function dispatchRemote(event: SyncEvent) {
  listeners.forEach((l) => l(event));
}

async function ensureRemoteTransport(): Promise<void> {
  if (!remoteEnabled) return;
  if (!remoteConfigured) {
    setStatus('notConfigured');
    return;
  }
  if (transport) {
    setStatus('connected');
    return;
  }
  setStatus('connecting');
  try {
    if (!transportPromise) {
      transportPromise = import('./sync.remote').then(async ({ createRemoteTransport }) =>
        createRemoteTransport(),
      );
    }
    const t = await transportPromise;
    transportPromise = null;
    // Corrida: o usuário pode ter desligado a sincronização enquanto o
    // transporte conectava. Se desligou, descarta o transporte recém-criado.
    if (!remoteEnabled) {
      await t?.disconnect();
      return;
    }
    if (t) {
      transport = t;
      setStatus('connected');
      // Re-observa a sala ativa após conectar (ex.: reconexão).
      if (activeRoomCode) activeUnsub = t.watchRoom(activeRoomCode, dispatchRemote);
    } else {
      setStatus('notConfigured');
    }
  } catch {
    transport = null;
    transportPromise = null;
    setStatus('error');
  }
}

function teardownRemote(): void {
  transport?.disconnect();
  transport = null;
  transportPromise = null;
  activeUnsub = null;
  setStatus('disabled');
}

// --- API pública ---------------------------------------------------

/** Liga/desliga o transporte remoto (chamado pelas configurações). */
export function setRemoteSyncEnabled(enabled: boolean): void {
  remoteEnabled = enabled;
  if (enabled) void ensureRemoteTransport();
  else teardownRemote();
}

/** Status atual do transporte remoto (para a UI). */
export function remoteSyncStatus(): RemoteSyncStatus {
  return remoteStatus;
}

/** Hook React: status reativo do transporte remoto. */
export function useRemoteSyncStatus(): RemoteSyncStatus {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => remoteStatus,
  );
}

/**
 * Acompanha uma sala no transporte remoto (no-op quando desativado).
 * Retorna função para cancelar. O `emitSync` local continua valendo
 * para abas do mesmo navegador.
 */
export function subscribeRoomRemote(code: string): () => void {
  activeRoomCode = code;
  if (transport) {
    activeUnsub?.();
    activeUnsub = transport.watchRoom(code, dispatchRemote);
  }
  return () => {
    if (activeRoomCode === code) {
      activeUnsub?.();
      activeUnsub = null;
      activeRoomCode = null;
    }
  };
}

/** Publica uma mutação: canal local (sempre) + Firestore (se conectado). */
export function emitSync(event: SyncEvent): void {
  if (channel) {
    try {
      channel.postMessage(event);
    } catch {
      /* canal indisponível */
    }
  }
  if (transport && (event.type === 'room:upsert' || event.type === 'room:close')) {
    void transport
      .emit(event)
      .catch(() => {
        // Falha de rede no Firestore: derruba o transporte e agenda uma
        // reconexão com backoff simples (máx. 1 tentativa a cada 15s).
        transport?.disconnect();
        transport = null;
        transportPromise = null;
        setStatus('error');
        const now = Date.now();
        if (remoteEnabled && now - lastRetryAt > 10000) {
          lastRetryAt = now;
          window.setTimeout(() => void ensureRemoteTransport(), 5000);
        }
      });
  }
}

// --- Fallback local: outra aba salvou no localStorage --------------

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('divide-ae:rooms')) {
      listeners.forEach((l) => l({ type: 'storage:changed' }));
    }
  });
}

/** Assina eventos de sincronização. Retorna função para cancelar. */
export function subscribeSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
