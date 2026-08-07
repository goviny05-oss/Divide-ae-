import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Icon } from './Icon';
import { springTap } from '../lib/anim';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
}

export function TopBar({ title, subtitle, onBack, actions }: TopBarProps) {
  const reduce = useReducedMotion() ?? false;
  return (
    <header className="topbar" data-entrance>
      {onBack ? (
        <motion.button
          className="icon-btn"
          onClick={onBack}
          aria-label="Voltar"
          whileHover={reduce ? undefined : { y: -1 }}
          whileTap={reduce ? undefined : { scale: 0.88 }}
          transition={springTap}
        >
          <Icon name="arrowLeft" size={20} />
        </motion.button>
      ) : (
        <span className="topbar__spacer" />
      )}
      <div className="topbar__titles">
        <h1 className="topbar__title">{title}</h1>
        {subtitle && <p className="topbar__subtitle">{subtitle}</p>}
      </div>
      <div className="topbar__actions">{actions}</div>
    </header>
  );
}
