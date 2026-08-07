// ============================================================
// ID — geração de identificadores e códigos de sala.
// ============================================================

/** Alfabeto seguro para códigos (sem 0/O/1/I para evitar confusão). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newRoomCode(): string {
  let code = '';
  const rand = new Uint32Array(6);
  crypto.getRandomValues(rand);
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[rand[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** Paleta de cores de avatar (nome → cor determinística). */
export const AVATAR_COLORS = [
  '#7aa5ff',
  '#a78bfa',
  '#5eead4',
  '#f9a8d4',
  '#fbbf24',
  '#60a5fa',
  '#fb7185',
  '#34d399',
  '#c084fc',
  '#f97316',
];

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
