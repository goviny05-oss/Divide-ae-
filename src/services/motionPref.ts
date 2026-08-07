// ============================================================
// MotionPref — preferência global de animação.
//
// O app respeita `prefers-reduced-motion` por acessibilidade,
// mas o usuário pode optar por SEMPRE mostrar as animações
// (settings.animations). Nesse modo, patcheamos `window.matchMedia`
// ANTES do React montar, para que tanto o GSAP (gsap.matchMedia)
// quanto o Motion (useReducedMotion) vejam 'no-preference' — sem
// precisar tocar em cada componente que anima.
//
// O CSS continua avaliando a mídia real do navegador; por isso o
// atributo `data-force-animations` no <html> é usado para escopar
// as regras de `prefers-reduced-motion` do global.css.
//
// Contrato: ao desativar em runtime, o matchMedia original é
// restaurado; mesmo assim o toggle em Configurações recarrega o
// app para que GSAP/Motion releiam a preferência no mount.
// ============================================================

let originalMatchMedia: ((query: string) => MediaQueryList) | null = null;

/** Marca o <html> e, se necessário, patcha o matchMedia. */
export function applyMotionPreference(force: boolean): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const html = document.documentElement;

  if (force) {
    html.dataset.forceAnimations = 'true';
    try {
      if (originalMatchMedia) return; // já patcheado nesta sessão
      const orig = window.matchMedia.bind(window);
      originalMatchMedia = orig;
      window.matchMedia = (query: string): MediaQueryList => {
        const m = orig(query);
        // ATENÇÃO: 'prefers-reduced-motion' contém a substring 'reduce' em
        // 'prefers-reduced' — por isso checamos a QUERY de entrada, não a mídia.
        if (query.includes('prefers-reduced-motion')) {
          // NÃO use Object.create(MediaQueryList.prototype): os métodos nativos
          // (addListener/addEventListener) lançam 'Illegal invocation' em um
          // objeto fake — o GSAP e o Motion chamam esses métodos. Retornamos um
          // objeto comum com stubs: o valor é forçado, então reações a mudanças
          // do sistema não são necessárias (queremos no-preference sempre).
          return {
            media: m.media,
            matches: query.includes('no-preference'),
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
          } as unknown as MediaQueryList;
        }
        return m;
      };
    } catch {
      originalMatchMedia = null;
    }
  } else {
    delete html.dataset.forceAnimations;
    try {
      if (originalMatchMedia) {
        window.matchMedia = originalMatchMedia;
        originalMatchMedia = null;
      }
    } catch {
      originalMatchMedia = null;
    }
  }
}
