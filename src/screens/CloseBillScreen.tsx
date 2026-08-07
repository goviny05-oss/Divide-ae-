import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';
import { TopBar } from '../components/TopBar';
import { Button, GlassCard, Modal, SpotlightCard } from '../components/ui';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Icon } from '../components/Icon';
import { springTap } from '../lib/anim';
import { useToast } from '../components/Toast';
import { navigate } from '../router';
import { useRoom } from '../hooks/useRoom';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { computeBill } from '../domain/bill';
import { formatMoney } from '../domain/money';
import { historyStorage } from '../services/storage';
import {
  exportPdf,
  renderBillImage,
  renderMiniReceipt,
  downloadBlob,
  shareImageBlob,
  shareSummary,
} from '../services/export';
import { getDeviceId } from '../session';
import { haptics } from '../services/haptics';
import type { ClosedBill } from '../types';

export function CloseBillScreen({ code }: { code: string }) {
  const settings = useStore(settingsStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);
  const { room, closed, close } = useRoom(code);
  const { showToast } = useToast();
  const selfId = getDeviceId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(closed);
  const [busy, setBusy] = useState<'image' | 'pdf' | null>(null);
  const [closing, setClosing] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const reduce = useReducedMotion() ?? false;
  const doneRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Revoga o object URL da prévia ao trocar de imagem ou desmontar.
  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const summary = useMemo(() => (room ? computeBill(room) : null), [room]);
  const heroRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Barras proporcionais crescem e as linhas entram em cascata (GSAP).
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const scope = heroRef.current;
      const hasRows = !!scope?.querySelector('.close-row');
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (!hasRows) return;
        gsap.fromTo(
          '.close-row__bar',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.85, ease: 'power3.out', stagger: 0.07 },
        );
        gsap.from('.close-row', { y: 14, opacity: 0, duration: 0.42, ease: 'power2.out', stagger: 0.05 });
        gsap.from('.close-fees', { y: 12, opacity: 0, duration: 0.4, ease: 'power2.out', delay: 0.18 });
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        if (!hasRows) return;
        gsap.set('.close-row__bar', { scaleX: 1 });
        gsap.set('.close-row', { opacity: 1, y: 0 });
      });
    },
    { scope: heroRef, dependencies: [summary?.perPerson.length ?? 0] },
  );

  // Sincroniza com fechamento vindo de outra aba.
  useEffect(() => {
    if (closed) setDone(true);
  }, [closed]);

  // Fecha a conta de verdade — guardado contra execução dupla/desmonte.
  const finishClose = () => {
    if (doneRef.current || !mountedRef.current) return;
    if (!room || !summary) return;
    doneRef.current = true;
    const closedBill: ClosedBill = {
      ...room,
      status: 'closed',
      closedAt: Date.now(),
      closedBy: selfId,
      summary,
    };
    historyStorage.add(closedBill);
    close(summary, selfId);
    haptics.success();
    showToast(
      t('notify.billClosed', { name: room.participants.find((p) => p.id === selfId)?.name ?? '' }),
      'success',
    );
    setReceipt(null);
    setDone(true);
    setClosing(false);
  };

  // Sequência do fechamento: total pulsa → mini-recibo "imprime" → conta fechada.
  useGSAP(
    () => {
      if (!receipt) return;
      if (reduce) {
        // Acessibilidade: pula o momento visual e fecha direto.
        finishClose();
        return;
      }
      const root = heroRef.current;
      const totalEl = root?.querySelector('.close-hero__value');
      const paper = receiptRef.current?.querySelector('.print-receipt__paper');
      const sheen = receiptRef.current?.querySelector('.print-receipt__sheen');
      if (!paper || !receiptRef.current) {
        finishClose();
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' }, onComplete: finishClose });
      // O backdrop entra junto com o pulse do total (posição 0).
      tl.set(receiptRef.current, { display: 'flex' }, 0);
      // 1) O total pisca com destaque (glow + micro scale).
      if (totalEl) {
        tl.fromTo(
          totalEl,
          { scale: 1, textShadow: '0 0 0px rgba(139,124,232,0)' },
          { scale: 1.05, textShadow: '0 0 26px rgba(139,124,232,0.9)', duration: 0.14, repeat: 3, yoyo: true },
          0,
        );
      }
      // 2) O recibo "imprime": papel desce do topo + brilho varrendo.
      // O '-=0.18' ancora no fim do pulse (~0,98s) → impressão em ~0,80s.
      tl.fromTo(
        paper,
        { scaleY: 0, opacity: 0, transformOrigin: '50% 0%' },
        { scaleY: 1, opacity: 1, duration: 0.55, ease: 'power3.inOut' },
        '-=0.18',
      );
      if (sheen) {
        tl.fromTo(sheen, { yPercent: -130 }, { yPercent: 290, duration: 0.55, ease: 'power1.inOut' }, '<');
      }
      // 3) Segura o momento e sobe suavemente antes da conta fechada.
      tl.to(paper, { y: -20, scale: 0.97, opacity: 0, duration: 0.26, ease: 'power2.in' }, '+=0.5');
    },
    { dependencies: [receipt] },
  );

  if (!room || !summary) {
    return (
      <div className="page">
        <TopBar title="…" onBack={() => navigate({ name: 'room', code })} />
        <p className="page__muted">{t('join.codeNotFound')}</p>
      </div>
    );
  }

  const money = (c: number) => formatMoney(c, room.currency);
  const maxTotal = Math.max(...summary.perPerson.map((p) => p.total), 1);

  const confirmClose = async () => {
    if (closing) return;
    setConfirmOpen(false);
    setClosing(true);
    try {
      // Gera o mini-recibo antes de animar (document.fonts.ready é o custo).
      const dataUrl = await renderMiniReceipt(room, summary, settings.lang);
      if (!mountedRef.current) return;
      if (dataUrl) {
        setReceipt(dataUrl);
      } else {
        // Sem recibo: fecha com um pequeno beat de loading.
        window.setTimeout(() => finishClose(), 260);
      }
    } catch {
      window.setTimeout(() => finishClose(), 260);
    }
  };

  // PDF: executa direto (diálogo de impressão) e confirma com toast.
  const exportPdfFlow = () => {
    if (busy) return;
    setBusy('pdf');
    try {
      exportPdf(room, summary, settings.lang);
      haptics.medium();
      showToast(t('close.exportPdf'), 'success');
    } catch {
      showToast(t('error.generic'), 'error');
    } finally {
      setBusy(null);
    }
  };

  // PNG: gera → prévia → usuário salva/compartilha.
  const exportPngFlow = async () => {
    if (busy) return;
    setBusy('image');
    try {
      const blob = await renderBillImage(room, summary, settings.lang);
      if (!blob) throw new Error('render');
      // O object URL anterior é revogado pelo efeito de cleanup abaixo.
      setPreview({ url: URL.createObjectURL(blob), blob });
      haptics.success();
      showToast(t('close.previewReady'), 'success');
    } catch {
      showToast(t('error.generic'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const closePreview = () => {
    // O cleanup do efeito revoga o object URL.
    setPreview(null);
  };

  const savePreview = () => {
    if (!preview) return;
    downloadBlob(preview.blob, `conta-${room.code}.png`);
    haptics.medium();
    showToast(t('close.saved'), 'success');
  };

  const sharePreview = async () => {
    if (!preview) return;
    const result = await shareImageBlob(
      preview.blob,
      `conta-${room.code}.png`,
      `${t('app.name')} — ${room.tableName}`,
    );
    if (result === 'shared') showToast(t('close.billShared'), 'success');
    else if (result === 'downloaded') showToast(t('close.saved'), 'success');
    else showToast(t('error.generic'), 'error');
  };

  return (
    <div className="page page--close" ref={heroRef}>
      <TopBar
        title={done ? t('close.done') : t('close.title')}
        subtitle={room.tableName}
        onBack={() => navigate(done ? { name: 'home' } : { name: 'room', code })}
      />

      <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <motion.div
          key="done"
          className="stack"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="close-done">
            <span className="close-done__check">
              <Icon name="check" size={34} />
            </span>
            <h2>{t('close.done')}</h2>
            <p>
              {t('close.total')}: <strong>{money(summary.total)}</strong>
            </p>
          </div>
          <ExportBar
            busy={busy}
            onPdf={exportPdfFlow}
            onImage={exportPngFlow}
            onShare={async () => {
              const r = await shareSummary(room, summary, settings.lang);
              showToast(
                r === 'shared' || r === 'copied' ? t('room.copied') : t('error.generic'),
                r === 'failed' ? 'error' : 'success',
              );
            }}
          />
          <Button variant="ghost" full icon="history" onClick={() => navigate({ name: 'history' })}>
            {t('home.history')}
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="open"
          className="stack"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <SpotlightCard className="close-hero" data-entrance>
            <span className="close-hero__label">{t('close.total')}</span>
            <strong className="close-hero__value" aria-live="polite">
              <AnimatedNumber value={summary.total} format={(n) => money(n)} />
            </strong>
            <div className="close-hero__meta">
              <span>
                {room.items.length} {room.items.length === 1 ? t('room.itemCount') : t('room.itemsCount')}
              </span>
              <span>·</span>
              <span>
                {room.participants.length} {t('room.participants')}
              </span>
            </div>
          </SpotlightCard>

          <section aria-label={t('close.eachPays')} data-entrance>
            <h2 className="section-title">{t('close.eachPays')}</h2>
            <div className="close-list">
              {summary.perPerson.map((p) => {
                const participant = room.participants.find((x) => x.id === p.participantId);
                return (
                  <GlassCard key={p.participantId} className="close-row">
                    <div
                      className="close-row__bar"
                      style={{ width: `${Math.max(4, (p.total / maxTotal) * 100)}%`, background: participant?.color }}
                      aria-hidden="true"
                    />
                    <span className="close-row__name">{participant?.name ?? '?'}</span>
                    <span className="close-row__value">{money(p.total)}</span>
                  </GlassCard>
                );
              })}
            </div>
          </section>

          <GlassCard className="close-fees" data-entrance>
            {[
              { label: t('person.subtotal'), value: summary.subtotal },
              { label: t('person.discount'), value: -summary.discount, muted: summary.discount === 0 },
              { label: t('person.coupon'), value: -summary.coupon, muted: summary.coupon === 0 },
              { label: t('person.serviceFee'), value: summary.serviceFee, muted: summary.serviceFee === 0 },
              { label: t('person.couvert'), value: summary.couvert, muted: summary.couvert === 0 },
            ].map((l) => (
              <div key={l.label} className={`close-fees__row ${l.muted ? 'close-fees__row--muted' : ''}`}>
                <span>{l.label}</span>
                <span>{l.value === 0 ? '—' : money(l.value)}</span>
              </div>
            ))}
          </GlassCard>

          <ExportBar
            busy={busy}
            onPdf={exportPdfFlow}
            onImage={exportPngFlow}
            onShare={async () => {
              const r = await shareSummary(room, summary, settings.lang);
              showToast(
                r === 'shared' || r === 'copied' ? t('room.copied') : t('error.generic'),
                r === 'failed' ? 'error' : 'success',
              );
            }}
          />

          <Button size="lg" full icon="check" onClick={() => setConfirmOpen(true)} loading={closing && !receipt}>
            {t('close.confirm')}
          </Button>
        </motion.div>
      )}
      </AnimatePresence>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('close.confirm')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" icon="check" onClick={confirmClose} loading={closing} disabled={closing}>
              {t('close.confirm')}
            </Button>
          </>
        }
      >
        <p className="modal__text">{t('close.confirmText')}</p>
      </Modal>

      {/* Momento do fechamento: o mini-recibo "imprime" antes da conta fechada. */}
      <AnimatePresence>
        {receipt && (
          <motion.div
            key="print-overlay"
            className="print-overlay"
            role="status"
            aria-label={t('close.done')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="print-receipt" ref={receiptRef}>
              <img className="print-receipt__paper" src={receipt} alt="" aria-hidden="true" />
              <span className="print-receipt__sheen" aria-hidden="true" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prévia da conta exportada — PNG gerado por canvas. */}
      <Modal
        open={!!preview}
        onClose={closePreview}
        title={t('close.preview')}
        footer={
          <>
            <Button variant="ghost" onClick={closePreview}>
              {t('common.cancel')}
            </Button>
            <Button variant="outline" icon="download" onClick={savePreview}>
              {t('close.save')}
            </Button>
            <Button icon="share" onClick={sharePreview}>
              {t('room.share')}
            </Button>
          </>
        }
      >
        <div className="export-preview">
          {preview && <img src={preview.url} alt={t('close.preview')} />}
        </div>
      </Modal>
    </div>
  );
}

function ExportBar({
  busy,
  onPdf,
  onImage,
  onShare,
}: {
  busy: 'image' | 'pdf' | null;
  onPdf: () => void;
  onImage: () => void;
  onShare: () => void;
}) {
  return (
    <div className="export-bar" data-entrance>
      <motion.button
        className="export-btn"
        onClick={onPdf}
        disabled={!!busy}
        whileHover={busy ? undefined : { y: -3 }}
        whileTap={busy ? undefined : { scale: 0.94 }}
        transition={springTap}
      >
        {busy === 'pdf' ? <span className="spinner" aria-hidden="true" /> : <Icon name="fileText" size={20} />}
        <span>PDF</span>
      </motion.button>
      <motion.button
        className="export-btn"
        onClick={onImage}
        disabled={!!busy}
        whileHover={busy ? undefined : { y: -3 }}
        whileTap={busy ? undefined : { scale: 0.94 }}
        transition={springTap}
      >
        {busy === 'image' ? <span className="spinner" aria-hidden="true" /> : <Icon name="image" size={20} />}
        <span>PNG</span>
      </motion.button>
      <motion.button
        className="export-btn"
        onClick={onShare}
        disabled={!!busy}
        whileHover={busy ? undefined : { y: -3 }}
        whileTap={busy ? undefined : { scale: 0.94 }}
        transition={springTap}
      >
        <Icon name="share" size={20} />
        <span>Link</span>
      </motion.button>
    </div>
  );
}
