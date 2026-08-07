import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { TopBar } from '../components/TopBar';
import { Button, EmptyState, GlassCard } from '../components/ui';
import { Icon } from '../components/Icon';
import { springTap } from '../lib/anim';
import { navigate } from '../router';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { formatMoney } from '../domain/money';
import { historyStorage } from '../services/storage';
import { haptics } from '../services/haptics';
import type { ClosedBill } from '../types';

export function HistoryScreen() {
  const settings = useStore(settingsStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);
  const [bills, setBills] = useState<ClosedBill[]>(() => historyStorage.all());
  const reduce = useReducedMotion() ?? false;

  const remove = (bill: ClosedBill) => {
    if (!window.confirm(t('item.deleteConfirm'))) return;
    historyStorage.remove(bill.code);
    setBills(historyStorage.all());
    haptics.medium();
  };

  return (
    <div className="page">
      <TopBar title={t('history.title')} onBack={() => navigate({ name: 'home' })} />

      {bills.length === 0 ? (
        <EmptyState
          icon="history"
          title={t('history.empty')}
          action={
            <Button icon="zap" onClick={() => navigate({ name: 'create' })}>
              {t('home.createRoom')}
            </Button>
          }
        />
      ) : (
        <ul className="history-list" data-entrance>
          {bills.map((bill, i) => (
            <motion.li
              key={bill.code}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 380, damping: 30 }}
            >
              <GlassCard className="history-card" hoverable>
                <button className="history-card__main" onClick={() => navigate({ name: 'close', code: bill.code })}>
                  <span className="history-card__emoji" aria-hidden="true">
                    {bill.restaurant ? '🍽️' : '🥂'}
                  </span>
                  <span className="history-card__info">
                    <strong>{bill.tableName}</strong>
                    <span>
                      {bill.restaurant ? `${bill.restaurant} · ` : ''}
                      {new Date(bill.createdAt).toLocaleDateString(settings.lang, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span>
                      {bill.participants.length} {t('history.participants')} · {bill.items.length}{' '}
                      {bill.items.length === 1 ? t('room.itemCount') : t('room.itemsCount')}
                    </span>
                  </span>
                  <span className="history-card__total">
                    {formatMoney(bill.summary?.total ?? 0, bill.currency)}
                  </span>
                </button>
                <div className="history-card__actions">
                  <button
                    className="icon-btn"
                    onClick={() => navigate({ name: 'close', code: bill.code })}
                    aria-label={t('history.reopen')}
                    title={t('history.reopen')}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <motion.button
                    className="icon-btn icon-btn--danger"
                    onClick={() => remove(bill)}
                    aria-label={t('item.delete')}
                    whileTap={{ scale: 0.88 }}
                    transition={springTap}
                  >
                    <Icon name="trash" size={16} />
                  </motion.button>
                </div>
              </GlassCard>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
