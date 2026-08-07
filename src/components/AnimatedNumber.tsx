import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';
import { usePrefersReducedMotion } from '../lib/anim';

interface AnimatedNumberProps {
  /** Valor alvo em centavos/unidade. */
  value: number;
  /** Formata o número para exibição (ex.: money). */
  format: (n: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Contador animado com GSAP: anima de 0 (ou do valor anterior) até o alvo.
 * Respeita prefers-reduced-motion (exibe o valor final instantaneamente).
 */
export function AnimatedNumber({ value, format, duration = 0.7, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<number | null>(null);
  const reduce = usePrefersReducedMotion();
  const formatRef = useRef(format);
  formatRef.current = format;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (reduce) {
        el.textContent = formatRef.current(value);
        prevRef.current = value;
        return;
      }
      // Primeiro render: conta de 0 até o valor (entrada); mudanças reais
      // também pulsam em escala. Nada anima sem mudança de fato.
      const firstRun = prevRef.current === null;
      const from = prevRef.current ?? 0;
      const changed = !firstRun && from !== value;
      prevRef.current = value;
      const obj = { v: from };
      gsap.to(obj, {
        v: value,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = formatRef.current(Math.round(obj.v));
        },
        onComplete: () => {
          el.textContent = formatRef.current(value);
        },
      });
      // Pulso sutil apenas em mudanças reais (contadores reagem).
      if (changed) {
        gsap.fromTo(el, { scale: 1.09 }, { scale: 1, duration: 0.4, ease: 'back.out(2.5)' });
      }
    },
    { dependencies: [value, reduce] },
  );

  // Sem aria-live: o texto muda a cada frame durante a contagem e
  // poderia sobrecarregar leitores de tela. O valor final fica no DOM.
  return (
    <span ref={ref} className={['num-pulse', className].filter(Boolean).join(' ')}>
      {format(value)}
    </span>
  );
}
