// ============================================================
// Split — distribuição exata de centavos (método do maior resto).
// Garante que a soma das partes seja EXATAMENTE o total.
// ============================================================

/**
 * Distribui `totalCents` proporcionalmente aos pesos `weights`.
 * Cada parte é um inteiro >= 0 e a soma é exatamente `totalCents`.
 */
export function fairSplit(totalCents: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    // Sem pesos: divide igualmente.
    return equalSplit(totalCents, n);
  }
  const raw = weights.map((w) => (totalCents * w) / sumW);
  const floors = raw.map(Math.floor);
  let remaining = totalCents - floors.reduce((a, b) => a + b, 0);
  if (remaining < 0) remaining = 0;
  // Ordena por resto fracionário decrescente para dar os centavos restantes.
  const idx = raw
    .map((r, i) => ({ r: r - Math.floor(r), i }))
    .sort((a, b) => b.r - a.r);
  const result = [...floors];
  for (let k = 0; k < remaining && k < idx.length; k++) {
    result[idx[k].i] += 1;
  }
  return result;
}

/** Divide igualmente, distribuindo centavos restantes aos primeiros. */
export function equalSplit(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

/**
 * Soma garantida: soma as partes e devolve o total.
 * Usada em asserts/testes para provar a invariante.
 */
export function sumParts(parts: number[]): number {
  return parts.reduce((a, b) => a + b, 0);
}

/**
 * Distribui o custo de um item entre participantes por quantidade consumida.
 * Quantidades podem ser fracionárias; a soma é exata em centavos.
 * Retorna mapa participantId → centavos.
 */
export function splitItemCost(
  totalCents: number,
  quantities: { participantId: string; qty: number }[],
): Record<string, number> {
  const parts = fairSplit(
    totalCents,
    quantities.map((q) => Math.round(q.qty * 100)),
  );
  const map: Record<string, number> = {};
  quantities.forEach((q, i) => {
    map[q.participantId] = parts[i] ?? 0;
  });
  return map;
}
