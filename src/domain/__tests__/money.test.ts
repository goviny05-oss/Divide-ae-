import { describe, expect, it } from 'vitest';
import { parseCents, parseQty, centsToInput } from '../money';

describe('parseCents', () => {
  it('parseia formato brasileiro com vírgula', () => {
    expect(parseCents('12,34')).toBe(1234);
    expect(parseCents('0,99')).toBe(99);
    expect(parseCents('120')).toBe(12000);
  });

  it('parseia formato internacional com ponto', () => {
    expect(parseCents('12.34')).toBe(1234);
    expect(parseCents('0.5')).toBe(50);
  });

  it('parseia separador de milhar pt-BR', () => {
    expect(parseCents('1.234,56')).toBe(123456);
  });

  it('aceita símbolo de moeda e espaços', () => {
    expect(parseCents('R$ 45,90')).toBe(4590);
  });

  it('rejeita valores inválidos ou negativos', () => {
    expect(parseCents('')).toBeNull();
    expect(parseCents('-5')).toBeNull();
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('-1,00')).toBeNull();
  });

  it('converte cents para input pt-BR', () => {
    expect(centsToInput(1234)).toBe('12,34');
    expect(centsToInput(5)).toBe('0,05');
    expect(centsToInput(0)).toBe('0,00');
  });
});

describe('parseQty', () => {
  it('aceita inteiros e fracionários', () => {
    expect(parseQty('3')).toBe(3);
    expect(parseQty('1.5')).toBe(1.5);
    expect(parseQty('1,5')).toBe(1.5);
    expect(parseQty('2.25')).toBe(2.25);
  });

  it('rejeita zero, negativos, vazio e excesso de casas', () => {
    expect(parseQty('0')).toBeNull();
    expect(parseQty('-1')).toBeNull();
    expect(parseQty('')).toBeNull();
    expect(parseQty('0.001')).toBeNull();
  });
});
