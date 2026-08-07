import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';
import { TopBar } from '../components/TopBar';
import { Avatar, Button, EmptyState, Modal, SpotlightCard } from '../components/ui';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Icon, type IconName } from '../components/Icon';
import { useToast } from '../components/Toast';
import { springTap } from '../lib/anim';
import { navigate } from '../router';
import { useRoom } from '../hooks/useRoom';
import { useStore, settingsStore } from '../store/appStore';
import { translate, type Lang } from '../i18n';
import { computeBill, itemShareMap, itemTotalInt } from '../domain/bill';
import { formatMoney } from '../domain/money';
import { copyText } from '../services/clipboard';
import { qrDataUrl, roomShareUrl } from '../services/qr';
import { roomsStorage } from '../services/storage';
import { getDeviceId } from '../session';
import { haptics } from '../services/haptics';
import type { BillItem, Category, Room } from '../types';

const CATEGORY_ICONS: Record<Category, IconName> = {
  food: 'utensils',
  drink: 'zap',
  dessert: 'receipt',
  other: 'tag',
};

const CATEGORY_LABELS: Record<Category, string> = {
  food: 'item.cat.food',
  drink: 'item.cat.drink',
  dessert: 'item.cat.dessert',
  other: 'item.cat.other',
};

export function RoomScreen({ code }: { code: string }) {
  const settings = useStore(settingsStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);
  const { room, closed, lastSummary, update } = useRoom(code);
  const [shareOpen, setShareOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;

  const summary = useMemo(() => (room ? computeBill(room) : null), [room]);
  const { showToast } = useToast();

  useRoomNotifications(room, settings.lang);

  // Entrada da tela da sala em sequência: header → resumo → taxas →
  // pedidos → ações. Só roda quando a sala existe (deps em room === null).
  useGSAP(
    () => {
      const root = pageRef.current;
      if (!root?.querySelector('.topbar')) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('.topbar', { y: -12, opacity: 0, duration: 0.34 })
          .from('.room-stats', { y: 18, opacity: 0, duration: 0.42 }, '-=0.18');
        if (root.querySelector('.fees-row')) {
          tl.from('.fees-row', { y: 12, opacity: 0, duration: 0.3 }, '-=0.24');
        }
        tl.from('.items', { y: 16, opacity: 0, duration: 0.36 }, '-=0.18');
        if (root.querySelector('.room-bottom')) {
          tl.from('.room-bottom', { y: 14, opacity: 0, duration: 0.32 }, '-=0.14');
        }
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        const targets = ['.topbar', '.room-stats', '.items'];
        if (root.querySelector('.fees-row')) targets.push('.fees-row');
        if (root.querySelector('.room-bottom')) targets.push('.room-bottom');
        gsap.set(targets, { opacity: 1, y: 0 });
      });
    },
    { scope: pageRef, dependencies: [room === null] },
  );

  const copyCode = async () => {
    const ok = await copyText(room?.code ?? '');
    if (ok) {
      haptics.success();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
    showToast(ok ? t('room.copied') : t('error.generic'), ok ? 'success' : 'error');
  };

  if (!room) {
    return (
      <div className="page">
        <TopBar title="…" onBack={() => navigate({ name: 'home' })} />
        <EmptyState icon="info" title={t('join.codeNotFound')} />
      </div>
    );
  }

  const selfId = getDeviceId();
  const self = room.participants.find((p) => p.id === selfId);
  const money = (c: number) => formatMoney(c, room.currency);

  const leave = () => {
    const without = {
      ...room,
      participants: room.participants.filter((p) => p.id !== selfId),
    };
    roomsStorage.save(without);
    update(() => without);
    setLeaveOpen(false);
    haptics.medium();
    navigate({ name: 'home' });
  };

  const feeChips: string[] = [];
  if (room.fees.serviceFeePct) feeChips.push(`${t('fees.service')} ${room.fees.serviceFeePct}%`);
  if (room.fees.couvertPerPerson) feeChips.push(t('fees.couvert'));
  if (room.fees.discount) feeChips.push(t('fees.discount'));
  if (room.fees.couponPct) feeChips.push(`${t('fees.coupon')} ${room.fees.couponPct}%`);

  return (
    <div className="page page--room" ref={pageRef}>
      <TopBar
        title={room.tableName}
        subtitle={room.restaurant}
        onBack={() => navigate({ name: 'home' })}
        actions={
          <>
            <motion.button
              className={`chip chip--code ${copied ? 'chip--code--copied' : ''}`}
              onClick={copyCode}
              title={t('room.copyCode')}
              aria-label={t('room.copyCode')}
              whileTap={reduce ? undefined : { scale: 0.94 }}
              transition={springTap}
            >
              <Icon name={copied ? 'check' : 'qr'} size={14} />
              {copied ? t('room.copied') : room.code}
            </motion.button>
            <motion.button
              className="icon-btn"
              onClick={() => setShareOpen(true)}
              aria-label={t('room.share')}
              whileTap={reduce ? undefined : { scale: 0.88 }}
              transition={springTap}
            >
              <Icon name="share" size={20} />
            </motion.button>
            <motion.button
              className="icon-btn"
              onClick={() => setLeaveOpen(true)}
              aria-label={t('room.leave')}
              whileTap={reduce ? undefined : { scale: 0.88 }}
              transition={springTap}
            >
              <Icon name="logOut" size={20} />
            </motion.button>
          </>
        }
      />

      <AnimatePresence>
        {closed && (
          <motion.div
            className="banner banner--closed"
            initial={reduce ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <Icon name="check" size={18} />
            <span>{t('close.done')}</span>
            {lastSummary && (
              <button className="banner__action" onClick={() => navigate({ name: 'close', code })}>
                {t('close.open')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SpotlightCard className="room-stats">
        <div className="room-stats__total">
          <span className="room-stats__label">{t('room.total')}</span>
          <span className="room-stats__value" aria-live="polite">
            {summary ? (
              <AnimatedNumber value={summary.total} format={(n) => money(n)} />
            ) : (
              money(0)
            )}
          </span>
        </div>
        <div className="room-stats__divider" />
        <button className="room-stats__cell" onClick={() => navigate({ name: 'close', code })}>
          <AnimatedNumber value={room.items.length} format={(n) => String(n)} className="room-stats__count" />
          <span>{room.items.length === 1 ? t('room.itemCount') : t('room.itemsCount')}</span>
        </button>
        <button
          className="room-stats__cell room-stats__cell--people"
          onClick={() => navigate({ name: 'person', code, participantId: selfId })}
        >
          <span className="room-stats__avatars">
            <AnimatePresence initial={false}>
              {room.participants.slice(0, 4).map((p) => (
                <motion.span
                  key={p.id}
                  className="avatar-wrap"
                  layout={!reduce}
                  initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduce ? undefined : { scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                >
                  <Avatar name={p.name} color={p.color} size="sm" />
                </motion.span>
              ))}
            </AnimatePresence>
          </span>
          <span>
            <AnimatedNumber
              value={room.participants.length}
              format={(n) => String(n)}
              className="room-stats__count"
            />{' '}
            {t('room.connected')}
          </span>
        </button>
      </SpotlightCard>

      {feeChips.length > 0 && (
        <button className="fees-row" onClick={() => navigate({ name: 'fees', code })}>
          <Icon name="percent" size={15} />
          {feeChips.join(' · ')}
          <Icon name="arrowLeft" size={14} className="icon--flip" />
        </button>
      )}

      <section className="items" aria-label={t('room.orders')}>
        <div className="section-title">
          <h2>{t('room.orders')}</h2>
          <span className="section-title__count">
            {room.items.length} {room.items.length === 1 ? t('room.itemCount') : t('room.itemsCount')}
          </span>
        </div>

        {room.items.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={t('room.empty')}
            action={
              <Button icon="plus" onClick={() => navigate({ name: 'item', code })}>
                {t('room.addItem')}
              </Button>
            }
          />
        ) : (
          <ul className="item-list">
            <AnimatePresence mode="popLayout">
              {room.items.map((item, idx) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  index={idx}
                  room={room}
                  money={money}
                  lang={settings.lang}
                  onOpen={() => navigate({ name: 'item', code, itemId: item.id })}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {self && (
        <div className="room-bottom">
          <Button size="lg" icon="plus" onClick={() => navigate({ name: 'item', code })}>
            {t('room.addItem')}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            icon="check"
            onClick={() => navigate({ name: 'close', code })}
          >
            {t('room.closeBill')}
          </Button>
        </div>
      )}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        room={room}
        lang={settings.lang}
      />

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={t('room.leave')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" icon="logOut" onClick={leave}>
              {t('room.leave')}
            </Button>
          </>
        }
      >
        <p className="modal__text">{t('room.leaveConfirm')}</p>
      </Modal>
    </div>
  );
}

function ItemCard({
  item,
  index,
  room,
  money,
  lang,
  onOpen,
}: {
  item: BillItem;
  index: number;
  room: Room;
  money: (c: number) => string;
  lang: Lang;
  onOpen: () => void;
}) {
  const t = (k: string, p?: Record<string, string | number>) => translate(lang, k, p);
  const shares = useMemo(() => itemShareMap(item, room.participants.map((x) => x.id)), [item, room]);
  const participants = room.participants.filter((p) => (shares[p.id] ?? 0) > 0);
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.li
      className="item-card glass"
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, x: -18, scale: 0.96 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 30,
        delay: reduce ? 0 : Math.min(index, 8) * 0.045,
      }}
    >
      <button className="item-card__main" onClick={onOpen}>
        <span className="item-card__icon">
          <Icon name={CATEGORY_ICONS[item.category]} size={18} />
        </span>
        <span className="item-card__info">
          <span className="item-card__name">{item.name}</span>
          {item.notes && <span className="item-card__notes">{item.notes}</span>}
          <span className="item-card__meta">
            {item.qty} × {money(item.unitPrice)}
          </span>
        </span>
        <span className="item-card__total">
          <AnimatedNumber value={itemTotalInt(item)} format={money} duration={0.5} />
        </span>
      </button>

      <div className="item-card__split">
        {item.splitType === 'single' ? (
          <span className="item-card__splitline">
            <Icon name="user" size={13} />
            {t('item.payAlone')}:{' '}
            <strong>{room.participants.find((p) => p.id === item.ownerId)?.name ?? '?'}</strong>
          </span>
        ) : (
          <div className="item-card__shared">
            {participants.slice(0, 4).map((p) => (
              <span key={p.id} className="mini-person">
                <Avatar name={p.name} color={p.color} size="sm" />
                <span>{money(shares[p.id] ?? 0)}</span>
              </span>
            ))}
            {participants.length > 4 && <span className="mini-person__more">+{participants.length - 4}</span>}
          </div>
        )}
        <span className="item-card__cat">{t(CATEGORY_LABELS[item.category])}</span>
      </div>
    </motion.li>
  );
}

// ------------------------------------------------------------
// Notificações em tempo real (diff de snapshots)
// ------------------------------------------------------------

function useRoomNotifications(room: Room | null, lang: Lang) {
  const { notify } = useToast();
  const prevRef = useRef<Room | null>(null);
  const t = (k: string, p?: Record<string, string | number>) => translate(lang, k, p);

  useEffect(() => {
    if (!room) return;
    const prev = prevRef.current;
    prevRef.current = room;
    if (!prev) return;

    const joined = room.participants.filter(
      (p) => !prev.participants.some((q) => q.id === p.id),
    );
    const left = prev.participants.filter((p) => !room.participants.some((q) => q.id === p.id));
    const added = room.items.filter((i) => !prev.items.some((j) => j.id === i.id));
    const removed = prev.items.filter((i) => !room.items.some((j) => j.id === i.id));
    const edited = room.items.filter((i) => {
      const before = prev.items.find((j) => j.id === i.id);
      return before && (before.name !== i.name || before.unitPrice !== i.unitPrice || before.qty !== i.qty);
    });

    const nameOf = (id?: string) => room.participants.find((p) => p.id === id)?.name ?? '';
    const money = (c: number) => formatMoney(c, room.currency);

    joined.forEach((p) =>
      notify({
        title: t('notify.joined', { name: p.name }),
        description: `${room.participants.length} ${t('room.connected')}`,
        type: 'success',
        icon: 'users',
        showTime: true,
      }),
    );
    left.forEach((p) =>
      notify({
        title: t('notify.left', { name: p.name }),
        type: 'info',
        icon: 'logOut',
        showTime: true,
      }),
    );
    added.forEach((i) =>
      notify({
        title: t('notify.itemAdded', { name: nameOf(i.createdBy), item: i.name }),
        description: money(itemTotalInt(i)),
        type: 'info',
        icon: 'receipt',
        onClick: () => navigate({ name: 'item', code: room.code, itemId: i.id }),
        showTime: true,
      }),
    );
    edited.forEach((i) =>
      notify({
        title: t('notify.itemEdited', { name: nameOf(i.createdBy), item: i.name }),
        description: money(itemTotalInt(i)),
        type: 'info',
        icon: 'edit',
        onClick: () => navigate({ name: 'item', code: room.code, itemId: i.id }),
        showTime: true,
      }),
    );
    removed.forEach((i) =>
      notify({
        title: t('notify.itemDeleted', { name: nameOf(i.createdBy), item: i.name }),
        type: 'info',
        icon: 'trash',
        showTime: true,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
}

// ------------------------------------------------------------
// Compartilhamento (QR + código + link)
// ------------------------------------------------------------

function ShareSheet({
  open,
  onClose,
  room,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  room: Room;
  lang: Lang;
}) {
  const t = (k: string) => translate(lang, k);
  const { showToast } = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setQr(null);
    qrDataUrl(roomShareUrl(room.code)).then((url) => {
      if (alive) setQr(url);
    });
    return () => {
      alive = false;
    };
  }, [open, room.code]);

  const copy = async (text: string, okMsg: string) => {
    const ok = await copyText(text);
    showToast(ok ? okMsg : t('error.generic'), ok ? 'success' : 'error');
    if (ok) haptics.success();
  };

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `divide-ae-${room.code}.png`;
    a.click();
    showToast(t('room.qrSaved'), 'success');
    haptics.success();
  };

  const shareLink = async () => {
    const url = roomShareUrl(room.code);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${t('app.name')} — ${room.tableName}`, url });
        return;
      } catch {
        /* cancelado */
      }
    }
    const ok = await copyText(url);
    showToast(ok ? t('room.copied') : t('error.generic'), ok ? 'success' : 'error');
  };

  return (
    <Modal open={open} onClose={onClose} title={t('room.share')}>
      <div className="share">
        <SpotlightCard className="share__qr" glareClassName="spotlight__glare--qr">
          {qr ? (
            <motion.img
              key="qr"
              src={qr}
              alt={t('room.yourCode')}
              initial={reduce ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          ) : (
            <span className="shimmer" aria-hidden="true" />
          )}
        </SpotlightCard>
        <div className="share__code">
          <span className="share__code-label">{t('room.yourCode')}</span>
          <strong>{room.code}</strong>
        </div>
        <div className="share__actions">
          <Button icon="copy" onClick={() => copy(room.code, t('room.copied'))} full>
            {t('room.copyCode')}
          </Button>
          <Button variant="outline" icon="image" onClick={downloadQr} full>
            {t('room.downloadQr')}
          </Button>
          <Button variant="outline" icon="link" onClick={shareLink} full>
            {t('room.copyQr')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
