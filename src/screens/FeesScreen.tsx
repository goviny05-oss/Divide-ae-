import { useMemo, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Button, Chips, Field, GlassCard, Input, Segmented } from '../components/ui';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { useToast } from '../components/Toast';
import { navigate } from '../router';
import { useRoom } from '../hooks/useRoom';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { parseCents } from '../domain/money';
import { validateFees } from '../domain/validate';
import { computeBill } from '../domain/bill';
import { haptics } from '../services/haptics';
import type { Fees } from '../types';

export function FeesScreen({ code }: { code: string }) {
  const settings = useStore(settingsStore);
  const t = (k: string) => translate(settings.lang, k);
  const { room, update } = useRoom(code);
  const { showToast } = useToast();

  const initial = room?.fees;
  const [servicePreset, setServicePreset] = useState(
    initial?.serviceFeePct ? String(initial.serviceFeePct) : '0',
  );
  const [serviceCustom, setServiceCustom] = useState('');
  const [couvert, setCouvert] = useState(initial?.couvertPerPerson ? centsToStr(initial.couvertPerPerson) : '');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(initial?.discount?.type ?? 'percent');
  const [discountValue, setDiscountValue] = useState(
    initial?.discount ? String(initial.discount.value) : '',
  );
  const [coupon, setCoupon] = useState(initial?.couponPct ? String(initial.couponPct) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const draft: Fees = useMemo(() => {
    const pct = servicePreset === 'custom' ? parseFloat(serviceCustom) : parseFloat(servicePreset);
    return {
      serviceFeePct: Number.isFinite(pct) && pct > 0 ? pct : null,
      couvertPerPerson: parseCents(couvert),
      discount:
        discountValue.trim() === ''
          ? null
          : {
              type: discountType,
              value:
                discountType === 'percent'
                  ? Math.min(100, Math.max(0, parseFloat(discountValue.replace(',', '.')) || 0))
                  : parseCents(discountValue) ?? 0,
            },
      couponPct:
        coupon.trim() === '' ? null : Math.min(100, Math.max(0, parseFloat(coupon.replace(',', '.')) || 0)),
    };
  }, [servicePreset, serviceCustom, couvert, discountType, discountValue, coupon]);

  const preview = useMemo(
    () => (room ? computeBill({ ...room, fees: draft }) : null),
    [room, draft],
  );

  if (!room) {
    return (
      <div className="page">
        <TopBar title="…" onBack={() => navigate({ name: 'room', code })} />
        <p className="page__muted">{t('join.codeNotFound')}</p>
      </div>
    );
  }

  const money = (c: number) =>
    new Intl.NumberFormat(settings.currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: settings.currency,
    }).format(c / 100);

  const apply = () => {
    const errs = validateFees(draft);
    if (errs.length > 0) {
      const map: Record<string, string> = {};
      errs.forEach((x) => (map[x.field] = x.message));
      setErrors(map);
      haptics.error();
      return;
    }
    update((r) => ({ ...r, fees: draft }));
    haptics.success();
    showToast(t('notify.feesUpdated'), 'success');
    navigate({ name: 'room', code });
  };

  const removeAll = () => {
    setServicePreset('0');
    setServiceCustom('');
    setCouvert('');
    setDiscountValue('');
    setCoupon('');
    haptics.light();
  };

  const feeLines = preview
    ? [
        { label: t('person.subtotal'), value: preview.subtotal, muted: false },
        { label: t('person.discount'), value: -preview.discount, muted: preview.discount === 0 },
        { label: t('person.coupon'), value: -preview.coupon, muted: preview.coupon === 0 },
        { label: t('person.serviceFee'), value: preview.serviceFee, muted: preview.serviceFee === 0 },
        { label: t('person.couvert'), value: preview.couvert, muted: preview.couvert === 0 },
      ]
    : [];

  return (
    <div className="page">
      <TopBar
        title={t('fees.title')}
        subtitle={t('fees.subtitle')}
        onBack={() => navigate({ name: 'room', code })}
      />

      <div className="stack">
        <GlassCard className="form-card__body" data-entrance>
          <fieldset className="field">
            <legend className="field__label">{t('fees.service')}</legend>
            <p className="field__hint">{t('fees.service.desc')}</p>
            <Chips
              options={[
                { value: '0', label: '—' },
                { value: '10', label: '10%' },
                { value: '13', label: '13%' },
                { value: '15', label: '15%' },
                { value: 'custom', label: t('fees.custom') },
              ]}
              selected={[servicePreset]}
              onChange={(vals) => setServicePreset(vals[0] ?? '0')}
            />
            {servicePreset === 'custom' && (
              <Input
                value={serviceCustom}
                onChange={(e) => setServiceCustom(e.target.value)}
                placeholder="10"
                inputMode="decimal"
                className="mt-1"
              />
            )}
          </fieldset>
        </GlassCard>

        <GlassCard className="form-card__body" data-entrance>
          <Field label={t('fees.couvert')} error={errors.couvertPerPerson}>
            <Input
              value={couvert}
              onChange={(e) => setCouvert(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </Field>
          <p className="field__hint">{t('fees.couvert.desc')}</p>
        </GlassCard>

        <GlassCard className="form-card__body" data-entrance>
          <fieldset className="field">
            <legend className="field__label">{t('fees.discount')}</legend>
            <Segmented
              options={[
                { value: 'percent', label: '%' },
                { value: 'fixed', label: currencySymbol(settings.currency) },
              ]}
              value={discountType}
              onChange={(v) => setDiscountType(v as 'percent' | 'fixed')}
            />
            <Input
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? '10' : '0,00'}
              inputMode="decimal"
              className="mt-1"
              invalid={!!errors.discount}
            />
          </fieldset>
        </GlassCard>

        <GlassCard className="form-card__body" data-entrance>
          <Field label={t('fees.coupon')} error={errors.couponPct}>
            <Input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="5"
              inputMode="decimal"
            />
          </Field>
          <p className="field__hint">{t('fees.coupon.desc')}</p>
        </GlassCard>

        {preview && (
          <GlassCard className="form-card__body preview-fees" data-entrance>
            <h3 className="preview-fees__title">{t('close.subtitle')}</h3>
            {feeLines.map((l) => (
              <div key={l.label} className={`preview-fees__row ${l.muted ? 'preview-fees__row--muted' : ''}`}>
                <span>{l.label}</span>
                <span>{l.value === 0 ? '—' : money(l.value)}</span>
              </div>
            ))}
            <div className="preview-fees__total">
              <span>{t('room.total')}</span>
              <strong>
                <AnimatedNumber value={preview.total} format={(n) => money(n)} />
              </strong>
            </div>
          </GlassCard>
        )}

        <div className="row-2">
          <Button variant="ghost" onClick={removeAll} icon="refresh">
            {t('fees.remove')}
          </Button>
          <Button onClick={apply} icon="check">
            {t('fees.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function currencySymbol(code: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code })
      .format(0)
      .replace(/[0-9.,\s]/g, '')
      .trim();
  } catch {
    return 'R$';
  }
}

function centsToStr(cents: number): string {
  const abs = Math.abs(cents);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}
