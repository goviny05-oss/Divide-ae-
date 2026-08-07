import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { TopBar } from '../components/TopBar';
import { Avatar, Button, EmptyState, GlassCard, SpotlightCard } from '../components/ui';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { navigate } from '../router';
import { useRoom } from '../hooks/useRoom';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { computeBill, itemShareMap } from '../domain/bill';
import { formatMoney } from '../domain/money';
import { getDeviceId } from '../session';
import type { BillItem } from '../types';

export function PersonSummaryScreen({ code, participantId }: { code: string; participantId: string }) {
  const settings = useStore(settingsStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);
  const { room } = useRoom(code);
  const selfId = getDeviceId();
  const reduce = useReducedMotion() ?? false;

  const [selectedId, setSelectedId] = useState(participantId || selfId);

  const summary = useMemo(() => (room ? computeBill(room) : null), [room]);
  const selected = room?.participants.find((p) => p.id === selectedId);

  if (!room || !summary || !selected) {
    return (
      <div className="page">
        <TopBar title="…" onBack={() => navigate({ name: 'room', code })} />
        <p className="page__muted">{t('join.codeNotFound')}</p>
      </div>
    );
  }

  const money = (c: number) => formatMoney(c, room.currency);
  const me = summary.perPerson.find((p) => p.participantId === selectedId)!;
  const pct = summary.total > 0 ? Math.round((me.total / summary.total) * 100) : 0;

  // Itens do participante com os valores exatos.
  const ownItems: { item: BillItem; value: number }[] = [];
  const sharedItems: { item: BillItem; value: number }[] = [];
  for (const item of room.items) {
    const map = itemShareMap(item, room.participants.map((x) => x.id));
    const value = map[selectedId] ?? 0;
    if (value <= 0) continue;
    if (item.splitType === 'single') ownItems.push({ item, value });
    else sharedItems.push({ item, value });
  }

  const rows = [
    { label: t('person.subtotal'), value: me.itemsTotal, bold: false },
    { label: t('person.discount'), value: -me.discount, bold: false, muted: me.discount === 0 },
    { label: t('person.coupon'), value: -me.coupon, bold: false, muted: me.coupon === 0 },
    { label: t('person.serviceFee'), value: me.serviceFee, bold: false, muted: me.serviceFee === 0 },
    { label: t('person.couvert'), value: me.couvert, bold: false, muted: me.couvert === 0 },
  ];

  return (
    <div className="page">
      <TopBar
        title={t('person.title')}
        subtitle={selected.name}
        onBack={() => navigate({ name: 'room', code })}
      />

      {/* Seletor de participantes */}
      <div className="person-switch" role="tablist" aria-label={t('room.participants')}>
        {room.participants.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === selectedId}
            className={`person-switch__item ${p.id === selectedId ? 'person-switch__item--active' : ''}`}
            onClick={() => setSelectedId(p.id)}
          >
            <Avatar name={p.name} color={p.color} size="sm" />
          </button>
        ))}
      </div>

      <SpotlightCard className="person-hero" data-entrance>
        <Avatar name={selected.name} color={selected.color} photo={undefined} size="lg" />
        <div className="person-hero__text">
          <h2>
            {selected.name}
            {selected.id === selfId && <span className="person-hero__you"> · {t('room.you')}</span>}
          </h2>
          <p>
            {t('close.eachPays')}:{' '}
            <strong>
              <AnimatedNumber value={me.total} format={(n) => money(n)} />
            </strong>
          </p>
          <div className="person-hero__pct">
            <strong>{t('person.pct', { pct })}</strong>
          </div>
          <div className="person-hero__bar" aria-hidden="true">
            <div
              className="person-hero__bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </div>
      </SpotlightCard>

      <div className="stack">
        {ownItems.length > 0 && (
          <section className="person-section">
            <h3 className="section-title">{t('person.ownItems')}</h3>
            {ownItems.map(({ item, value }, i) => (
              <motion.div
                key={item.id}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 380, damping: 30 }}
              >
                <GlassCard className="person-item" hoverable>
                  <span className="person-item__name">{item.name}</span>
                  <span className="person-item__value">{money(value)}</span>
                </GlassCard>
              </motion.div>
            ))}
          </section>
        )}

        {sharedItems.length > 0 && (
          <section className="person-section">
            <h3 className="section-title">{t('person.sharedItems')}</h3>
            {sharedItems.map(({ item, value }, i) => (
              <motion.div
                key={item.id}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 380, damping: 30 }}
              >
                <GlassCard className="person-item" hoverable>
                  <div className="person-item__main">
                    <span className="person-item__name">{item.name}</span>
                    <span className="person-item__qty">
                      {item.qty} × {money(item.unitPrice)}
                    </span>
                  </div>
                  <span className="person-item__value">{money(value)}</span>
                </GlassCard>
              </motion.div>
            ))}
          </section>
        )}

        {ownItems.length === 0 && sharedItems.length === 0 && (
          <EmptyState icon="receipt" title={t('person.empty')} />
        )}

        <GlassCard className="person-total" data-entrance>
          {rows.map((r) => (
            <div
              key={r.label}
              className={`person-total__row ${r.muted ? 'person-total__row--muted' : ''}`}
            >
              <span>{r.label}</span>
              <span>{r.value === 0 ? '—' : money(r.value)}</span>
            </div>
          ))}
          <div className="person-total__row person-total__row--grand">
            <span>{t('person.total')}</span>
            <strong>
              <AnimatedNumber value={me.total} format={(n) => money(n)} />
            </strong>
          </div>
        </GlassCard>

        {selectedId !== selfId && (
          <Button
            variant="outline"
            full
            icon="user"
            onClick={() => setSelectedId(selfId)}
          >
            {t('person.title')} · {t('room.you')}
          </Button>
        )}
      </div>
    </div>
  );
}
