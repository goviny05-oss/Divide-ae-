// ============================================================
// Validation — regras de negócio de entrada de dados.
// ============================================================

import type { BillItem, Fees, Room } from '../types';

export interface FieldError {
  field: string;
  message: string;
}

export function validateRoomCreate(tableName: string, participants?: number): FieldError[] {
  const errors: FieldError[] = [];
  if (!tableName.trim()) {
    errors.push({ field: 'tableName', message: 'O nome da mesa é obrigatório.' });
  } else if (tableName.trim().length > 40) {
    errors.push({ field: 'tableName', message: 'O nome da mesa deve ter no máximo 40 caracteres.' });
  }
  if (participants !== undefined && participants !== null && !Number.isNaN(participants)) {
    if (!Number.isInteger(participants) || participants < 1) {
      errors.push({ field: 'participants', message: 'A quantidade de participantes deve ser um número inteiro positivo.' });
    } else if (participants > 50) {
      errors.push({ field: 'participants', message: 'Máximo de 50 participantes por mesa.' });
    }
  }
  return errors;
}

export function validateItem(
  name: string,
  unitPriceCents: number,
  qty: number,
  shares: { participantId: string; qty: number }[],
  participantIds: string[],
): FieldError[] {
  const errors: FieldError[] = [];
  if (!name.trim()) {
    errors.push({ field: 'name', message: 'Informe o nome do item.' });
  } else if (name.trim().length > 60) {
    errors.push({ field: 'name', message: 'Nome do item muito longo (máx. 60 caracteres).' });
  }
  if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
    errors.push({ field: 'unitPrice', message: 'O preço deve ser maior que zero.' });
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    errors.push({ field: 'qty', message: 'A quantidade deve ser maior que zero.' });
  }
  const totalShareQty = shares.reduce((a, s) => a + s.qty, 0);
  if (shares.length === 0) {
    errors.push({ field: 'shares', message: 'Selecione ao menos um participante para dividir.' });
  }
  if (totalShareQty <= 0) {
    errors.push({ field: 'shares', message: 'A soma das quantidades consumidas deve ser maior que zero.' });
  }
  for (const s of shares) {
    if (!participantIds.includes(s.participantId)) {
      errors.push({ field: 'shares', message: 'Participante inválido nesta divisão.' });
    }
    if (s.qty < 0) {
      errors.push({ field: 'shares', message: 'Quantidade negativa não é permitida.' });
    }
  }
  return errors;
}

export function validateFees(fees: Fees): FieldError[] {
  const errors: FieldError[] = [];
  if (fees.serviceFeePct !== null && (fees.serviceFeePct < 0 || fees.serviceFeePct > 100)) {
    errors.push({ field: 'serviceFeePct', message: 'A taxa de serviço deve estar entre 0% e 100%.' });
  }
  if (fees.couvertPerPerson !== null && fees.couvertPerPerson < 0) {
    errors.push({ field: 'couvertPerPerson', message: 'Couvert não pode ser negativo.' });
  }
  if (fees.discount && fees.discount.value < 0) {
    errors.push({ field: 'discount', message: 'Desconto não pode ser negativo.' });
  }
  if (fees.discount?.type === 'percent' && fees.discount.value > 100) {
    errors.push({ field: 'discount', message: 'Desconto percentual máximo é 100%.' });
  }
  if (fees.couponPct !== null && (fees.couponPct < 0 || fees.couponPct > 100)) {
    errors.push({ field: 'couponPct', message: 'O cupom deve estar entre 0% e 100%.' });
  }
  return errors;
}

export function validateJoinCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code.trim().toUpperCase());
}

export function validateParticipantName(name: string): boolean {
  const n = name.trim();
  return n.length >= 1 && n.length <= 24;
}

/** Integridade estrutural de um Room carregado de storage/rede. */
export function sanitizeRoom(raw: unknown): Room | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Room>;
  if (
    typeof r.id !== 'string' ||
    typeof r.code !== 'string' ||
    typeof r.tableName !== 'string' ||
    !Array.isArray(r.participants) ||
    !Array.isArray(r.items)
  ) {
    return null;
  }
  return {
    id: r.id,
    code: r.code,
    tableName: r.tableName,
    restaurant: r.restaurant || undefined,
    participants: r.participants.filter(
      (p) => p && typeof p.id === 'string' && typeof p.name === 'string',
    ),
    items: (r.items as BillItem[]).filter((i) => i && typeof i.id === 'string'),
    fees: {
      serviceFeePct: normalizeNullableNumber(r.fees?.serviceFeePct),
      couvertPerPerson: normalizeNullableNumber(r.fees?.couvertPerPerson),
      discount: r.fees?.discount || null,
      couponPct: normalizeNullableNumber(r.fees?.couponPct),
    },
    status: r.status === 'closed' ? 'closed' : 'open',
    currency: typeof r.currency === 'string' ? r.currency : 'BRL',
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    closedAt: r.closedAt,
    createdBy: r.createdBy,
  };
}

function normalizeNullableNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
