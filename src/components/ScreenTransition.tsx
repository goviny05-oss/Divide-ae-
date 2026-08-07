import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';

/**
 * Transição de tela: entrada/saída suave do contêiner (Motion) + revelação
 * em cascata dos blocos com [data-entrance] (GSAP). O `mode="wait"` do
 * AnimatePresence em App.tsx faz a tela anterior sair antes da nova entrar,
 * criando continuidade entre as rotas.
 */
export function ScreenTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;

  useGSAP(
    () => {
      const root = ref.current;
      const entranceEls = root?.querySelectorAll<HTMLElement>('[data-entrance]') ?? [];
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (entranceEls.length > 0) {
          gsap.set(entranceEls, { opacity: 0, y: 12 });
          gsap.to(entranceEls, {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.06,
            delay: 0.1,
            ease: 'power3.out',
          });
        }
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        if (entranceEls.length > 0) gsap.set(entranceEls, { opacity: 1, y: 0 });
      });

      // Cada rota começa no topo (senão a tela nova herda o scroll da antiga).
      window.scrollTo({ top: 0 });
    },
    { scope: ref },
  );

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.996 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, y: -10, scale: 0.998 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
