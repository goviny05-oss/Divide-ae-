// ============================================================
// Bill — cálculo completo da conta a partir de um Room.
// Regra de negócio: a soma das parcelas individuais é SEMPRE
// exatamente igual ao total da conta (verificado por testes).
// ============================================================

import type { BillItem, BillSummary, PersonShare, Room } from '../types';
import { equalSplit, fairSplit, splitItemCost } from './split';

/** Custo do item em centavos (inteiro exato). */
export function itemTotalInt(item: BillItem): number {
  return Math.round(item.unitPrice * item.qty);
}

/**
 * Quanto cada participante deve por UM item.
 * - 'single': o dono paga tudo.
 * - 'shared': proporcional à quantidade consumida (somado = total exato).
 */
export function itemShareMap(
  item: BillItem,
  participantIds: string[],
): Record<string, number> {
  const total = itemTotalInt(item);
  if (item.splitType === 'single') {
    const map: Record<string, number> = {};
    for (const pid of participantIds) map[pid] = 0;
    if (item.ownerId && participantIds.includes(item.ownerId)) {
      map[item.ownerId] = total;
    }
    return map;
  }
  const quantities = item.shares
    .filter((s) => participantIds.includes(s.participantId) && s.qty > 0)
    .map((s) => ({ participantId: s.participantId, qty: s.qty }));
  const map: Record<string, number> = {};
  for (const pid of participantIds) map[pid] = 0;
  Object.assign(map, splitItemCost(total, quantities));
  return map;
}

export function roomSubtotal(room: Room): number {
  return room.items.reduce((acc, item) => acc + itemTotalInt(item), 0);
}

/**
 * Calcula o resumo completo da conta.
 * Ordem: subtotal → desconto → cupom → taxa de serviço → couvert.
 */
export function computeBill(room: Room): BillSummary {
  const participants = room.participants.map((p) => p.id);
  const subtotal = roomSubtotal(room);

  // Total consumido por pessoa (itens).
  const perPersonItems: Record<string, number> = {};
  for (const pid of participants) perPersonItems[pid] = 0;
  const itemShares: Record<string, Record<string, number>> = {};
  for (const item of room.items) {
    const map = itemShareMap(item, participants);
    itemShares[item.id] = map;
    for (const pid of participants) perPersonItems[pid] += map[pid] ?? 0;
  }

  // Desconto e cupom (sobre o subtotal de itens).
  const fees = room.fees;
  let discountTotal = 0;
  if (fees.discount) {
    discountTotal =
      fees.discount.type === 'percent'
        ? Math.round((subtotal * fees.discount.value) / 100)
        : Math.min(fees.discount.value, subtotal);
  }
  let couponTotal = 0;
  if (fees.couponPct && fees.couponPct > 0) {
    couponTotal = Math.round((subtotal * fees.couponPct) / 100);
  }
  if (discountTotal + couponTotal > subtotal) {
    // Não deixar a conta negativa: ajusta proporcionalmente.
    const over = discountTotal + couponTotal - subtotal;
    const cut = Math.min(over, discountTotal);
    discountTotal -= cut;
  }

  const afterDiscount = subtotal - discountTotal - couponTotal;

  // Taxa de serviço: % sobre o valor já com desconto/cupom.
  let serviceFeeTotal = 0;
  if (fees.serviceFeePct && fees.serviceFeePct > 0) {
    serviceFeeTotal = Math.round((afterDiscount * fees.serviceFeePct) / 100);
  }

  // Couvert: valor fixo por participante.
  const couvertTotal = (fees.couvertPerPerson ?? 0) * participants.length;

  const grandTotal = afterDiscount + serviceFeeTotal + couvertTotal;

  // Distribuição por pessoa (tudo exato).
  const weights = participants.map((pid) => Math.max(0, perPersonItems[pid]));
  const discountParts = distributeBy(participants, weights, discountTotal);
  const couponParts = distributeBy(participants, weights, couponTotal);
  const feeBasis = participants.map(
    (pid) => Math.max(0, perPersonItems[pid] - discountParts[pid] - couponParts[pid]),
  );
  const feeParts = distributeBy(participants, feeBasis, serviceFeeTotal);
  const couvertParts = distributeBy(participants, participants.map(() => 1), couvertTotal);

  const perPerson: PersonShare[] = participants.map((pid) => {
    const itemsTotal = perPersonItems[pid];
    const total =
      itemsTotal - discountParts[pid] - couponParts[pid] + feeParts[pid] + couvertParts[pid];
    return {
      participantId: pid,
      itemsTotal,
      serviceFee: feeParts[pid],
      couvert: couvertParts[pid],
      discount: discountParts[pid],
      coupon: couponParts[pid],
      total,
    };
  });

  const sumPerson = perPerson.reduce((a, p) => a + p.total, 0);
  if (import.meta.env.DEV && sumPerson !== grandTotal) {
    // Invariante crítica: jamais permitir divergência silenciosa.
    console.error('[bill] Soma individual != total da conta', { sumPerson, grandTotal });
  }

  return {
    subtotal,
    discount: discountTotal,
    coupon: couponTotal,
    serviceFee: serviceFeeTotal,
    couvert: couvertTotal,
    total: grandTotal,
    perPerson,
    itemShares,
  };
}

function distributeBy(
  participantIds: string[],
  weights: number[],
  total: number,
): Record<string, number> {
  const map: Record<string, number> = {};
  participantIds.forEach((pid) => (map[pid] = 0));
  if (total <= 0) return map;
  const parts =
    weights.every((w) => w <= 0) || weights.length === 0
      ? equalSplit(total, participantIds.length)
      : fairSplit(total, weights);
  participantIds.forEach((pid, i) => (map[pid] = parts[i] ?? 0));
  return map;
}
