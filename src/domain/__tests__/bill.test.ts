import { describe, expect, it } from 'vitest';
import { computeBill, itemShareMap, itemTotalInt } from '../bill';
import type { BillItem, Fees, Room } from '../../types';

const FEES: Fees = {
  serviceFeePct: null,
  couvertPerPerson: null,
  discount: null,
  couponPct: null,
};

function room(over: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    code: 'ABC123',
    tableName: 'Mesa 1',
    participants: [
      { id: 'a', name: 'Ana', color: '#f00', joinedAt: 1 },
      { id: 'b', name: 'Bia', color: '#0f0', joinedAt: 2 },
      { id: 'c', name: 'Cadu', color: '#00f', joinedAt: 3 },
    ],
    items: [],
    fees: FEES,
    status: 'open',
    currency: 'BRL',
    createdAt: 0,
    ...over,
  };
}

function item(over: Partial<BillItem> = {}): BillItem {
  return {
    id: 'i1',
    name: 'Pizza',
    unitPrice: 12000, // R$ 120,00
    qty: 1,
    category: 'food',
    splitType: 'shared',
    shares: [
      { participantId: 'a', qty: 1 },
      { participantId: 'b', qty: 1 },
      { participantId: 'c', qty: 1 },
    ],
    createdAt: 0,
    createdBy: 'a',
    ...over,
  };
}

describe('computeBill — invariante principal', () => {
  it('soma das parcelas individuais == total da conta (item dividido igual)', () => {
    const r = room({ items: [item()] });
    const s = computeBill(r);
    const personSum = s.perPerson.reduce((a, p) => a + p.total, 0);
    expect(personSum).toBe(s.total);
    expect(s.total).toBe(12000);
    expect(s.perPerson.every((p) => p.total === 4000)).toBe(true);
  });

  it('item pago sozinho pertence a apenas uma pessoa', () => {
    const r = room({
      items: [item({ splitType: 'single', ownerId: 'b', shares: [], unitPrice: 5000 })],
    });
    const s = computeBill(r);
    expect(s.perPerson.find((p) => p.participantId === 'b')!.total).toBe(5000);
    expect(s.perPerson.filter((p) => p.participantId !== 'b').every((p) => p.total === 0)).toBe(true);
    expect(s.total).toBe(5000);
  });

  it('quantidades parciais: João 1, Maria 2 de qtd 3', () => {
    const r = room({
      participants: [
        { id: 'a', name: 'João', color: '#1', joinedAt: 1 },
        { id: 'b', name: 'Maria', color: '#2', joinedAt: 2 },
      ],
      items: [
        item({
          name: 'Batata',
          unitPrice: 1000,
          qty: 3,
          shares: [
            { participantId: 'a', qty: 1 },
            { participantId: 'b', qty: 2 },
          ],
        }),
      ],
    });
    const s = computeBill(r);
    const joao = s.perPerson.find((p) => p.participantId === 'a')!.total;
    const maria = s.perPerson.find((p) => p.participantId === 'b')!.total;
    expect(joao + maria).toBe(3000);
    expect(maria).toBe(joao * 2);
  });

  it('taxa de serviço 10% recalculada e exata', () => {
    const r = room({
      items: [item()],
      fees: { ...FEES, serviceFeePct: 10 },
    });
    const s = computeBill(r);
    expect(s.serviceFee).toBe(1200);
    expect(s.total).toBe(13200);
    expect(s.perPerson.reduce((a, p) => a + p.total, 0)).toBe(s.total);
    expect(s.perPerson.every((p) => p.total === 4400)).toBe(true);
  });

  it('couvert por pessoa dividido igualmente com resto exato', () => {
    const r = room({
      participants: [
        { id: 'a', name: 'A', color: '#1', joinedAt: 1 },
        { id: 'b', name: 'B', color: '#2', joinedAt: 2 },
      ],
      items: [item({ unitPrice: 10000, shares: [{ participantId: 'a', qty: 1 }] })],
      fees: { ...FEES, couvertPerPerson: 500 },
    });
    const s = computeBill(r);
    expect(s.couvert).toBe(1000);
    expect(s.total).toBe(11000);
    expect(s.perPerson.reduce((a, p) => a + p.total, 0)).toBe(s.total);
  });

  it('desconto percentual distribuído proporcionalmente', () => {
    const r = room({
      items: [item({ unitPrice: 20000 })], // 3 pessoas dividem
      fees: { ...FEES, discount: { type: 'percent', value: 10 } },
    });
    const s = computeBill(r);
    expect(s.discount).toBe(2000);
    expect(s.total).toBe(18000);
    expect(s.perPerson.reduce((a, p) => a + p.total, 0)).toBe(s.total);
    // todos pagam igual: 18000/3
    expect(s.perPerson.every((p) => p.total === 6000)).toBe(true);
  });

  it('cupom + desconto + taxa + couvert combinados somam exato', () => {
    const r = room({
      items: [item({ unitPrice: 30000 })],
      fees: {
        serviceFeePct: 13,
        couvertPerPerson: 800,
        discount: { type: 'percent', value: 5 },
        couponPct: 5,
      },
    });
    const s = computeBill(r);
    expect(s.perPerson.reduce((a, p) => a + p.total, 0)).toBe(s.total);
    expect(s.total).toBeGreaterThan(0);
  });

  it('itens múltiplos com divisões mistas — invariante sempre vale', () => {
    const r = room({
      items: [
        item({ id: 'x', unitPrice: 9999, qty: 2, shares: [{ participantId: 'a', qty: 1 }] }),
        item({
          id: 'y',
          name: 'Chopp',
          unitPrice: 1200,
          qty: 4,
          shares: [
            { participantId: 'a', qty: 2 },
            { participantId: 'c', qty: 2 },
          ],
        }),
        item({ id: 'z', name: 'Sobremesa', unitPrice: 2500, splitType: 'single', ownerId: 'b', shares: [] }),
      ],
      fees: { serviceFeePct: 10, couvertPerPerson: 500, discount: { type: 'fixed', value: 1000 }, couponPct: null },
    });
    const s = computeBill(r);
    expect(s.perPerson.reduce((a, p) => a + p.total, 0)).toBe(s.total);
    // nenhum participante paga valor negativo
    expect(s.perPerson.every((p) => p.total >= 0)).toBe(true);
  });

  it('sala vazia → total zero', () => {
    const s = computeBill(room());
    expect(s.total).toBe(0);
    expect(s.perPerson.every((p) => p.total === 0)).toBe(true);
  });

  it('itemShareMap soma exatamente o total do item', () => {
    const r = room({ items: [item({ unitPrice: 7777, qty: 3 })] });
    const item0 = r.items[0];
    const map = itemShareMap(item0, r.participants.map((p) => p.id));
    const sum = Object.values(map).reduce((a, b) => a + b, 0);
    expect(sum).toBe(itemTotalInt(item0));
  });
});
