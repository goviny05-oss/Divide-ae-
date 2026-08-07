import { describe, expect, it } from 'vitest';
import { fairSplit, equalSplit, splitItemCost, sumParts } from '../split';

describe('fairSplit — soma exata', () => {
  it('distribui proporcionalmente sem perder centavos', () => {
    // 100 centavos entre 3 pesos iguais -> 34, 33, 33 (soma 100)
    const parts = fairSplit(100, [1, 1, 1]);
    expect(sumParts(parts)).toBe(100);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('funciona com quantidades fracionárias', () => {
    // Batata: qtd 3, João 1, Maria 2 => 1/3 e 2/3 de 3000
    const parts = fairSplit(3000, [100, 200]);
    expect(sumParts(parts)).toBe(3000);
    expect(parts[1] - parts[0]).toBeCloseTo(1000, 0);
  });

  it('distribui pesos desiguais com resto ao maior resto', () => {
    const parts = fairSplit(1000, [100, 300, 600]);
    expect(sumParts(parts)).toBe(1000);
  });

  it('pesos zerados → divisão igualitária', () => {
    const parts = fairSplit(500, [0, 0, 0]);
    expect(sumParts(parts)).toBe(500);
    expect(new Set(parts)).toEqual(new Set([167, 167, 166]));
  });

  it('mantém soma exata para vários totais ímpares', () => {
    for (const total of [1, 3, 7, 99, 101, 1234, 9999]) {
      for (const n of [2, 3, 5, 8]) {
        const parts = fairSplit(total, Array.from({ length: n }, () => 1));
        expect(sumParts(parts), `total=${total} n=${n}`).toBe(total);
      }
    }
  });

  it('divide item por quantidade com soma exata', () => {
    const map = splitItemCost(12000, [
      { participantId: 'a', qty: 1 },
      { participantId: 'b', qty: 2 },
      { participantId: 'c', qty: 1 },
    ]);
    expect(map.a + map.b + map.c).toBe(12000);
    // Proporções: a=25%, b=50%, c=25%
    expect(map.b).toBe(map.a * 2);
    expect(map.c).toBe(map.a);
  });

  it('equalSplit distribui resto nos primeiros', () => {
    expect(equalSplit(10, 3)).toEqual([4, 3, 3]);
  });
});
