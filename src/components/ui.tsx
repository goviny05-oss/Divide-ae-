import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from './Icon';
import { haptics } from '../services/haptics';
import { colorForId } from '../domain/id';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { fadeUp, springTap } from '../lib/anim';

// ------------------------------------------------------------
// Button — microinterações com Motion (tap/hover), shine via CSS
// ------------------------------------------------------------

// Omit: eventos que colidem com a tipagem de drag/animação do Motion.
type ButtonHTML = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>;

interface ButtonProps extends ButtonHTML {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle' | 'success';
  size?: 'lg' | 'md' | 'sm';
  full?: boolean;
  icon?: IconName;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  full,
  icon,
  loading,
  children,
  disabled,
  onClick,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  // Estado de sucesso: ícone ✓ automático, superfície verde (ação concluída).
  const effectiveIcon: IconName | undefined = icon ?? (variant === 'success' ? 'check' : undefined);
  return (
    <motion.button
      className={`btn btn--${variant} btn--${size} ${full ? 'btn--full' : ''} ${className}`}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : { scale: 0.965, y: 1 }}
      transition={springTap}
      onClick={(e) => {
        haptics.light();
        onClick?.(e);
      }}
      {...rest}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : effectiveIcon ? (
        <Icon name={effectiveIcon} size={size === 'sm' ? 15 : 18} />
      ) : null}
      {children && <span>{children}</span>}
    </motion.button>
  );
}

// ------------------------------------------------------------
// GlassCard
// ------------------------------------------------------------

type DivHTML = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>;

interface GlassCardProps extends DivHTML {
  /** Eleva suavemente no hover (padrão Origin UI em cards). */
  hoverable?: boolean;
}

export function GlassCard({ children, className = '', onClick, hoverable, ...rest }: GlassCardProps) {
  if (hoverable) {
    return (
      <motion.div
        className={`glass glass--hover ${className}`}
        onClick={onClick}
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div className={`glass ${className}`} onClick={onClick} {...rest}>
      {children}
    </div>
  );
}

// ------------------------------------------------------------
// SpotlightCard — glare que segue o cursor (efeito Skiper premium)
// ------------------------------------------------------------

interface SpotlightCardProps extends DivHTML {
  glareClassName?: string;
}

export function SpotlightCard({ children, className = '', glareClassName = '', ...rest }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <div ref={ref} className={`spotlight ${className}`} onMouseMove={onMove} {...rest}>
      {children}
      <span className={`spotlight__glare ${glareClassName}`} aria-hidden="true" />
    </div>
  );
}

// ------------------------------------------------------------
// Field / Input
// ------------------------------------------------------------

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">{children}</div>
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className = '', ...rest }: InputProps) {
  return <input className={`input ${invalid ? 'input--invalid' : ''} ${className}`} {...rest} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input input--area" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input input--select" {...props} />;
}

// ------------------------------------------------------------
// Modal — AnimatePresence com entrada/saída animadas
// ------------------------------------------------------------

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const settings = useStore(settingsStore);
  const t = (k: string) => translate(settings.lang, k);
  const modalRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const container = modalRef.current;
    const focusables = () =>
      Array.from(
        container?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute('disabled'));
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          onClick={onClose}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <motion.div
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? false : { y: 64, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {title && (
              <div className="modal__head">
                <h2 className="modal__title">{title}</h2>
                <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
                  <Icon name="x" size={18} />
                </button>
              </div>
            )}
            <motion.div
              className="modal__body"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.25, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
            {footer && <div className="modal__foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------
// Avatar
// ------------------------------------------------------------

interface AvatarProps {
  name: string;
  color?: string;
  photo?: string | null;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

export function Avatar({ name, color, photo, size = 'md', online }: AvatarProps) {
  const bg = color ?? colorForId(name || '?');
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className={`avatar avatar--${size}`} style={{ background: bg }} aria-hidden="true">
      {photo ? <img src={photo} alt="" className="avatar__img" /> : initials}
      {online && <span className="avatar__dot" />}
    </span>
  );
}

// ------------------------------------------------------------
// Chips (seleção múltipla/única)
// ------------------------------------------------------------

interface ChipsProps {
  options: { value: string; label: string; icon?: IconName }[];
  selected: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
}

export function Chips({ options, selected, onChange, multiple = false }: ChipsProps) {
  return (
    <div className="chips" role="group">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <motion.button
            key={opt.value}
            type="button"
            className={`chip ${active ? 'chip--active' : ''}`}
            aria-pressed={active}
            whileTap={{ scale: 0.93 }}
            transition={springTap}
            onClick={() => {
              haptics.light();
              if (multiple) {
                onChange(active ? selected.filter((v) => v !== opt.value) : [...selected, opt.value]);
              } else {
                onChange([opt.value]);
              }
            }}
          >
            {opt.icon && <Icon name={opt.icon} size={14} />}
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------
// Segmented (abas inline) — pill deslizante com layoutId
// ------------------------------------------------------------

interface SegmentedProps {
  options: { value: string; label: string; desc?: string; icon?: IconName }[];
  value: string;
  onChange: (value: string) => void;
}

export function Segmented({ options, value, onChange }: SegmentedProps) {
  const pillId = useId();
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented__item ${active ? 'segmented__item--active' : ''}`}
            onClick={() => {
              haptics.light();
              onChange(opt.value);
            }}
          >
            {active && !reduce && (
              <motion.span
                className="segmented__pill"
                layoutId={pillId}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            {opt.icon && <Icon name={opt.icon} size={16} />}
            <span className="segmented__label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------
// Switch — toggle acessível com microinteração (motion)
// ------------------------------------------------------------

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'switch--on' : ''}`}
      disabled={disabled}
      onClick={() => {
        haptics.light();
        onChange(!checked);
      }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={springTap}
    >
      <span className="switch__knob" />
    </motion.button>
  );
}

// ------------------------------------------------------------
// QtyStepper
// ------------------------------------------------------------

interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  disabled,
}: QtyStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <span className={`stepper ${disabled ? 'stepper--disabled' : ''}`}>
      <motion.button
        type="button"
        className="stepper__btn"
        disabled={disabled || value <= min}
        aria-label="Diminuir"
        whileTap={disabled || value <= min ? undefined : { scale: 0.8 }}
        transition={springTap}
        onClick={() => onChange(clamp(value - step))}
      >
        <Icon name="minus" size={15} />
      </motion.button>
      <span key={value} className="stepper__value stepper__value--pop" aria-live="polite">
        {value}
      </span>
      <motion.button
        type="button"
        className="stepper__btn"
        disabled={disabled || value >= max}
        aria-label="Aumentar"
        whileTap={disabled || value >= max ? undefined : { scale: 0.8 }}
        transition={springTap}
        onClick={() => onChange(clamp(value + step))}
      >
        <Icon name="plus" size={15} />
      </motion.button>
    </span>
  );
}

// ------------------------------------------------------------
// EmptyState
// ------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  action,
}: {
  icon: IconName;
  title: string;
  action?: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      className="empty"
      variants={fadeUp}
      initial={reduce ? false : 'hidden'}
      animate="visible"
    >
      <span className="empty__icon">
        <Icon name={icon} size={28} />
      </span>
      <p>{title}</p>
      {action}
    </motion.div>
  );
}
