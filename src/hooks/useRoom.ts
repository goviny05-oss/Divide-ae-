// ============================================================
// useRoom — estado reativo da sala com sincronização e persistência.
// Cada mutação: atualiza estado → salva em localStorage → emite
// evento de sync para as outras abas/dispositivos.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BillSummary, Room } from '../types';
import { roomsStorage } from '../services/storage';
import { emitSync, subscribeRoomRemote, subscribeSync } from '../services/sync';
import { sanitizeRoom } from '../domain/validate';

export interface RoomState {
  room: Room | null;
  closed: boolean;
  lastSummary: BillSummary | null;
  update: (fn: (room: Room) => Room) => void;
  close: (summary: BillSummary, closedBy: string) => void;
}

export function useRoom(code: string): RoomState {
  const normalized = code.toUpperCase();
  const [room, setRoom] = useState<Room | null>(() => roomsStorage.get(normalized));
  const [closed, setClosed] = useState<boolean>(() => roomsStorage.get(normalized)?.status === 'closed');
  const [lastSummary, setLastSummary] = useState<BillSummary | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    setRoom(roomsStorage.get(normalized));
    setClosed(false);
    setLastSummary(null);
  }, [normalized]);

  // Transporte remoto (Firestore): acompanha a sala entre dispositivos.
  useEffect(() => {
    return subscribeRoomRemote(normalized);
  }, [normalized]);

  useEffect(() => {
    return subscribeSync((event) => {
      if (event.type === 'storage:changed') {
        // Fallback: outra aba salvou no localStorage sem BroadcastChannel.
        const fresh = roomsStorage.get(normalized);
        if (fresh && fresh !== roomRef.current) {
          setRoom(fresh);
          setClosed(fresh.status === 'closed');
        }
        return;
      }
      if (event.type === 'room:upsert') {
        if (!event.room || event.room.code !== normalized) return;
        const clean = sanitizeRoom(event.room);
        if (!clean) return;
        setRoom(clean);
        setClosed(clean.status === 'closed');
        roomsStorage.save(clean);
      } else if (event.type === 'room:close') {
        if (!event.room || event.room.code !== normalized) return;
        const clean = sanitizeRoom(event.room);
        if (clean) {
          setRoom(clean);
          roomsStorage.save(clean);
        }
        setLastSummary(event.summary);
        setClosed(true);
      }
    });
  }, [normalized]);

  const update = useCallback(
    (fn: (room: Room) => Room) => {
      const current = roomRef.current;
      if (!current) return;
      const next = fn(current);
      next.code = normalized;
      roomRef.current = next;
      setRoom(next);
      roomsStorage.save(next);
      emitSync({ type: 'room:upsert', room: next });
    },
    [normalized],
  );

  const close = useCallback(
    (summary: BillSummary, closedBy: string) => {
      const current = roomRef.current;
      if (!current) return;
      const closedRoom: Room = {
        ...current,
        status: 'closed',
        closedAt: Date.now(),
      };
      roomRef.current = closedRoom;
      setRoom(closedRoom);
      setLastSummary(summary);
      setClosed(true);
      roomsStorage.save(closedRoom);
      emitSync({ type: 'room:close', room: closedRoom, summary, closedBy });
    },
    [normalized],
  );

  return { room, closed, lastSummary, update, close };
}
