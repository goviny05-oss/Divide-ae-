import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ------------------------------------------------------------
// Ambiente node: mockamos os globals de browser mínimos.
// O módulo tem estado (originalMatchMedia), então usamos
// vi.resetModules() + import dinâmico para cada teste começar limpo.
// ------------------------------------------------------------

let applyMotionPreference: (force: boolean) => void;
let dataset: Record<string, string>;
let matchMediaMock: ReturnType<typeof vi.fn>;

function makeMql(media: string, matches: boolean) {
  return {
    media,
    matches,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  };
}

function getMatchMedia(): (q: string) => { matches: boolean; media: string } {
  return (globalThis as unknown as { window: { matchMedia: (q: string) => { matches: boolean; media: string } } })
    .window.matchMedia;
}

beforeEach(async () => {
  vi.resetModules();
  dataset = {};
  (globalThis as unknown as { document: unknown }).document = {
    documentElement: { dataset },
  };
  matchMediaMock = vi.fn((query: string) => {
    // Simula um sistema com 'reduce' ativo.
    const isReduce = /\(prefers-reduced-motion:\s*reduce\)/.test(query);
    return makeMql(query, isReduce);
  });
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: matchMediaMock,
  };
  ({ applyMotionPreference } = await import('../motionPref'));
});

afterEach(() => {
  delete (globalThis as unknown as { document?: unknown }).document;
  delete (globalThis as unknown as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe('applyMotionPreference', () => {
  it('marca o <html> com data-force-animations quando forçado', () => {
    applyMotionPreference(true);
    expect(dataset.forceAnimations).toBe('true');
  });

  it('reporta reduce=false e no-preference=true quando forçado', () => {
    applyMotionPreference(true);
    // Substring trap: 'prefers-reduced-motion' contém 'reduce'.
    expect(getMatchMedia()('(prefers-reduced-motion: reduce)').matches).toBe(false);
    expect(getMatchMedia()('(prefers-reduced-motion: no-preference)').matches).toBe(true);
  });

  it('passa queries que não são de reduced-motion intactas (resposta do original)', () => {
    applyMotionPreference(true);
    // O mock original só "casa" a query de reduce; as demais retornam false
    // sem alteração — o patch não deve interferir.
    expect(getMatchMedia()('(prefers-color-scheme: dark)').matches).toBe(false);
    expect(getMatchMedia()('(min-width: 600px)').matches).toBe(false);
  });

  it('os stubs de listener não lançam (bug do Illegal invocation)', () => {
    applyMotionPreference(true);
    const mq = getMatchMedia()('(prefers-reduced-motion: reduce)') as MediaQueryList;
    expect(() => mq.addListener(() => undefined)).not.toThrow();
    expect(() => mq.addEventListener('change', () => undefined)).not.toThrow();
    expect(() => mq.removeListener(() => undefined)).not.toThrow();
    expect(() => mq.removeEventListener('change', () => undefined)).not.toThrow();
  });

  it('não patcha duas vezes na mesma sessão', () => {
    applyMotionPreference(true);
    const first = (globalThis as unknown as { window: { matchMedia: unknown } }).window.matchMedia;
    applyMotionPreference(true);
    const second = (globalThis as unknown as { window: { matchMedia: unknown } }).window.matchMedia;
    expect(second).toBe(first);
  });

  it('desativar remove o atributo e restaura o matchMedia original', () => {
    applyMotionPreference(true);
    applyMotionPreference(false);
    expect(dataset.forceAnimations).toBeUndefined();
    // De volta ao mock original: 'reduce' ativo no sistema.
    expect(getMatchMedia()('(prefers-reduced-motion: reduce)').matches).toBe(true);
    expect(getMatchMedia()('(prefers-reduced-motion: no-preference)').matches).toBe(false);
  });
});
