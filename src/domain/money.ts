// ============================================================
// Money — matemática monetária com precisão exata (centavos).
// NUNCA use float para dinheiro: tudo é inteiro em centavos.
// ============================================================

export const ZERO = 0;

/** Interpreta "12,34" | "12.34" | "12" | "R$ 12,34" | "1.234,56" → centavos. null se inválido. */
export function parseCents(input: string): number | null {
  if (!input) return null;
  let s = input.trim().replace(/[R$\s]/gi, '');
  if (!s) return null;
  // Detecta formato pt-BR: ponto como separador de milhar e vírgula decimal.
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let normalized: string;
  if (hasComma && hasDot) {
    // "1.234,56" → remove pontos de milhar, troca vírgula por ponto.
    if (/\.\d{3}(?:\.|,)/.test(s)) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = s.replace(',', '.');
    }
  } else if (hasComma) {
    normalized = s.replace(',', '.');
  } else {
    normalized = s;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Converte centavos em string decimal para inputs (sem símbolo). */
export function centsToInput(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const cent = abs % 100;
  const body = `${reais},${String(cent).padStart(2, '0')}`;
  return (negative ? '-' : '') + body;
}

/** Formata centavos com a moeda corrente (Intl — sem arredondamento, já é inteiro). */
export function formatMoney(cents: number, currency: string): string {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat(localeFor(currency), {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

function localeFor(currency: string): string {
  switch (currency) {
    case 'BRL':
      return 'pt-BR';
    case 'USD':
      return 'en-US';
    case 'EUR':
      return 'de-DE';
    case 'GBP':
      return 'en-GB';
    case 'MXN':
      return 'es-MX';
    case 'ARS':
      return 'es-AR';
    default:
      return 'pt-BR';
  }
}

/** Interpreta quantidade "1" | "1.5" | "1,5" → número com até 2 casas. null se inválido. */
export function parseQty(input: string): number | null {
  if (!input) return null;
  const s = input.trim().replace(',', '.');
  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Máximo 2 casas decimais para evitar imprecisão.
  const [int, frac = ''] = s.split('.');
  if (frac.length > 2) return null;
  if (int.length > 6) return null;
  return Math.round(value * 100) / 100;
}

