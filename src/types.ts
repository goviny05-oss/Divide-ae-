// ============================================================
// Divide Aê! — Tipos globais do domínio
// ============================================================

export type Category = 'food' | 'drink' | 'dessert' | 'other';

export type SplitType = 'single' | 'shared';

export interface Participant {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
}

/** Participação de um participante em um item: quantidade consumida. */
export interface Share {
  participantId: string;
  /** Quantidade consumida (pode ser fracionária, ex.: 0.5). */
  qty: number;
}

export interface BillItem {
  id: string;
  name: string;
  /** Preço unitário em centavos (inteiro — precisão exata). */
  unitPrice: number;
  qty: number;
  notes?: string;
  category: Category;
  splitType: SplitType;
  /** Dono quando splitType === 'single'. */
  ownerId?: string;
  /** Partilha quando splitType === 'shared'. */
  shares: Share[];
  createdAt: number;
  createdBy: string;
}

export type Discount = { type: 'percent' | 'fixed'; value: number };

export interface Fees {
  /** % de taxa de serviço (ex.: 10 => 10%). null = sem taxa. */
  serviceFeePct: number | null;
  /** Couvert artístico por pessoa, em centavos. null = sem couvert. */
  couvertPerPerson: number | null;
  /** Desconto (percentual ou fixo em centavos). */
  discount: Discount | null;
  /** Cupom: percentual em centavos de % (ex.: 500 => 5%). */
  couponPct: number | null;
}

export interface Room {
  id: string;
  code: string;
  tableName: string;
  restaurant?: string;
  participants: Participant[];
  items: BillItem[];
  fees: Fees;
  status: 'open' | 'closed';
  currency: string;
  createdAt: number;
  closedAt?: number;
  createdBy?: string;
}

export interface PersonShare {
  participantId: string;
  itemsTotal: number;
  serviceFee: number;
  couvert: number;
  discount: number;
  coupon: number;
  total: number;
}

export interface BillSummary {
  subtotal: number;
  discount: number;
  coupon: number;
  serviceFee: number;
  couvert: number;
  total: number;
  perPerson: PersonShare[];
  itemShares: Record<string, Record<string, number>>;
}

export interface ClosedBill extends Room {
  summary: BillSummary;
  closedBy: string;
}

/** Eventos de sincronização em tempo real entre abas/dispositivos. */
export type SyncEvent =
  | { type: 'room:upsert'; room: Room }
  | { type: 'room:close'; room: Room; summary: BillSummary; closedBy: string }
  | { type: 'storage:changed' }
  | { type: 'ping' };

export type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'join' }
  | { name: 'room'; code: string; setup?: boolean }
  | { name: 'item'; code: string; itemId?: string }
  | { name: 'fees'; code: string }
  | { name: 'person'; code: string; participantId: string }
  | { name: 'close'; code: string }
  | { name: 'history' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'info' };
