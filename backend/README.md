# ☁️ Backend remoto (Firebase) — Divide Aê!

O app foi projetado com **local-first** (nunca perde dados, funciona offline). A sincronização em tempo real entre abas/janelas do mesmo navegador é feita por `BroadcastChannel` + `localStorage` — **zero configuração**.

Para sincronização **entre dispositivos diferentes** (celular ↔ celular), conecte o Firestore. A interface de transporte vive em `src/services/sync.ts`:

```ts
emitSync(event: SyncEvent): void            // publica uma mutação
subscribeSync(listener: (e: SyncEvent) => void): () => void   // recebe mutações
```

## Como plugar o Firestore (adaptador de referência)

```ts
// src/services/sync.firestore.ts — adaptador de referência
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { SyncEvent } from '../types';
import { roomsStorage } from './storage';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
});

const db = getFirestore(app);
const listeners = new Set<(e: SyncEvent) => void>();

export function emitSyncRemote(event: SyncEvent) {
  if (event.type === 'room:upsert' && event.room) {
    setDoc(doc(db, 'rooms', event.room.code), event.room); // upsert
  }
}

export function subscribeRoomRemote(code: string) {
  return onSnapshot(doc(db, 'rooms', code), (snap) => {
    const room = snap.data();
    if (!room) return;
    roomsStorage.save(room as never); // persiste localmente (offline-first)
    listeners.forEach((l) => l({ type: 'room:upsert', room: room as never }));
  });
}
```

Na inicialização do app, use `emitSyncRemote`/`subscribeRoomRemote` no lugar (ou em adição) ao transporte local — a arquitetura não muda.

## Arquivos deste diretório

| Arquivo | Conteúdo |
|---|---|
| `firestore.rules` | Regras de segurança: somente participantes da sala leem/escrevem; validação de campos |
| `functions/` | Cloud Functions de referência (cálculo da conta no servidor + notificações) |
| `README.md` | Este documento |

## Por que Cloud Functions?

- **Cálculos no servidor**: `computeBill` pode rodar como função HTTP para clientes que não queiram/possam calcular localmente (ex.: integrações com sistemas de PDV).
- **Notificações push**: ao fechar a conta, a função dispara notificações para os participantes.
- **Limpeza**: remoção automática de salas abertas há mais de 24h (TTL) para evitar custos.
