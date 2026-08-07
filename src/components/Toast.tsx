import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from './Icon';
import { vibrate } from '../services/haptics';
import { useStore, settingsStore } from '../store/appStore';

export type ToastType = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  type: ToastType;
  icon?: IconName;
  onClick?: () => void;
  time?: string;
}

interface NotifyOptions {
  /** Linha principal da notificação. */
  title: string;
  /** Linha secundária (detalhe/valor). */
  description?: string;
  type?: ToastType;
  /** Sobrescreve o ícone padrão do estado. */
  icon?: IconName;
  /** Ao tocar, executa a ação e dispensa a notificação. */
  onClick?: () => void;
  /** Exibe um horário discreto (HH:MM). */
  showTime?: boolean;
}

interface ToastContextValue {
  /** Toast simples (mensagem única). Compatível com o uso atual. */
  showToast: (message: string, type?: ToastType) => void;
  /** Notificação rica, estilo smartphone. */
  notify: (options: NotifyOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}

const ICONS: Record<ToastType, IconName> = {
  info: 'bell',
  success: 'check',
  error: 'info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const settings = useStore(settingsStore);
  const reduce = useReducedMotion() ?? false;
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());

  // Limpa timers pendentes ao desmontar (evita setState em componente morto).
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      idRef.current += 1;
      const id = idRef.current;
      // A mais recente entra pelo TOPO da pilha; as anteriores descem.
      setToasts((prev) => [{ id, ...item }, ...prev.slice(0, 3)]);
      if (item.type === 'success') vibrate([12, 50, 22]);
      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        dismiss(id);
      }, 4200);
      timersRef.current.add(timer);
    },
    [dismiss],
  );

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      push({ title: message, type });
    },
    [push],
  );

  const notify = useCallback(
    (opts: NotifyOptions) => {
      const { title, description, type = 'info', icon, onClick, showTime } = opts;
      const time = showTime
        ? new Date().toLocaleTimeString(settings.lang, { hour: '2-digit', minute: '2-digit' })
        : undefined;
      push({ title, description, type, icon, onClick, time });
    },
    [push, settings.lang],
  );

  const value = useMemo(() => ({ showToast, notify }), [showToast, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              className={`toast toast--${item.type} ${item.onClick ? 'toast--action' : ''}`}
              onClick={() => {
                item.onClick?.();
                dismiss(item.id);
              }}
              aria-label={item.description ? `${item.title} — ${item.description}` : item.title}
              layout={!reduce}
              // Entra de cima, como uma notificação de sistema: fora da
              // viewport → desce → assenta com um pequeno overshoot.
              initial={reduce ? false : { y: '-130%', opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={reduce ? undefined : { y: -24, opacity: 0, scale: 0.97 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.9 }}
            >
              <span className="toast__icon">
                <Icon name={item.icon ?? ICONS[item.type]} size={16} />
              </span>
              <span className="toast__body">
                <span className="toast__title">{item.title}</span>
                {item.description && <span className="toast__desc">{item.description}</span>}
              </span>
              {item.time && <span className="toast__time">{item.time}</span>}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
