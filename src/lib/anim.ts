import { useReducedMotion, type Variants } from 'motion/react';

/** Entrada suave padrão (usada por EmptyState e reveals). */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/** Spring compartilhado para microinterações de tap (botões, chips, steppers). */
export const springTap = { type: 'spring' as const, stiffness: 500, damping: 28, mass: 0.6 };

/** Hook único para respeitar prefers-reduced-motion em todos os componentes Motion. */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
