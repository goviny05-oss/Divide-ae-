import { useMemo, useState } from 'react';
import { TopBar } from '../components/TopBar';
import {
  Avatar,
  Button,
  Chips,
  Field,
  GlassCard,
  Input,
  QtyStepper,
  Segmented,
  Textarea,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { useToast } from '../components/Toast';
import { navigate } from '../router';
import { useRoom } from '../hooks/useRoom';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { parseCents, parseQty, centsToInput } from '../domain/money';
import { validateItem } from '../domain/validate';
import { uid } from '../domain/id';
import { splitItemCost } from '../domain/split';
import { getDeviceId } from '../session';
import { haptics } from '../services/haptics';
import type { BillItem, Category } from '../types';

type WhoPays = 'single' | 'shared';

export function AddItemScreen({ code, itemId }: { code: string; itemId?: string }) {
  const settings = useStore(settingsStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);
  const { room, update } = useRoom(code);
  const { showToast } = useToast();
  const selfId = getDeviceId();

  const existing = useMemo(
    () => (itemId ? room?.items.find((i) => i.id === itemId) : undefined),
    [room, itemId],
  );

  const [name, setName] = useState(existing?.name ?? '');
  const [price, setPrice] = useState(existing ? centsToInput(existing.unitPrice) : '');
  const [qty, setQty] = useState(existing ? String(existing.qty) : '1');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'food');
  const [whoPays, setWhoPays] = useState<WhoPays>(existing?.splitType ?? 'shared');
  const [ownerId, setOwnerId] = useState<string>(existing?.ownerId ?? selfId);
  const [shares, setShares] = useState<Record<string, number>>(() => {
    if (!room) return {};
    const base: Record<string, number> = {};
    if (existing?.splitType === 'shared' && existing.shares.length > 0) {
      for (const s of existing.shares) base[s.participantId] = s.qty;
      return base;
    }
    for (const p of room.participants) base[p.id] = 0;
    return base;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!room) {
    return (
      <div className="page">
        <TopBar title="…" onBack={() => navigate({ name: 'room', code })} />
        <p className="page__muted">{t('join.codeNotFound')}</p>
      </div>
    );
  }

  const money = (c: number) =>
    new Intl.NumberFormat(
      settings.currency === 'BRL' ? 'pt-BR' : settings.currency === 'USD' ? 'en-US' : 'pt-BR',
      { style: 'currency', currency: settings.currency },
    ).format(c / 100);

  const priceCents = parseCents(price) ?? 0;
  const qtyValue = parseQty(qty) ?? 0;
  const itemTotal = Math.round(priceCents * qtyValue);

  // Preview ao vivo da divisão.
  const preview = useMemo(() => {
    if (whoPays === 'single') {
      const map: Record<string, number> = {};
      for (const p of room.participants) map[p.id] = 0;
      if (ownerId) map[ownerId] = itemTotal;
      return map;
    }
    const quantities = room.participants
      .filter((p) => (shares[p.id] ?? 0) > 0)
      .map((p) => ({ participantId: p.id, qty: shares[p.id] ?? 0 }));
    return splitItemCost(itemTotal, quantities);
  }, [whoPays, ownerId, shares, room.participants, itemTotal]);

  const selectedShares = room.participants.filter((p) => (shares[p.id] ?? 0) > 0);

  const setShareQty = (pid: string, q: number) => {
    setShares((prev) => ({ ...prev, [pid]: q }));
  };

  const splitEqual = () => {
    const active = room.participants.filter((p) => (shares[p.id] ?? 0) > 0);
    if (active.length === 0) return;
    const per = Math.round(qtyValue / active.length * 100) / 100;
    let rest = Math.round((qtyValue - per * active.length) * 100) / 100;
    const next = { ...shares };
    active.forEach((p, i) => {
      const q = per + (i === active.length - 1 ? rest : 0);
      rest = 0;
      next[p.id] = q;
    });
    setShares(next);
    haptics.light();
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const shareList = room.participants
      .map((p) => ({ participantId: p.id, qty: shares[p.id] ?? 0 }))
      .filter((s) => s.qty > 0);
    const errs = validateItem(
      name,
      priceCents,
      qtyValue,
      whoPays === 'single' ? (ownerId ? [{ participantId: ownerId, qty: 1 }] : []) : shareList,
      room.participants.map((p) => p.id),
    );
    if (errs.length > 0) {
      const map: Record<string, string> = {};
      errs.forEach((x) => (map[x.field] = x.message));
      setErrors(map);
      haptics.error();
      return;
    }
    setErrors({});
    setSaving(true);

    const item: BillItem = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      unitPrice: priceCents,
      qty: qtyValue,
      notes: notes.trim() || undefined,
      category,
      splitType: whoPays,
      ownerId: whoPays === 'single' ? ownerId : undefined,
      shares: whoPays === 'shared' ? shareList : [],
      createdAt: existing?.createdAt ?? Date.now(),
      createdBy: selfId,
    };

    update((r) => ({
      ...r,
      items: existing ? r.items.map((i) => (i.id === existing.id ? item : i)) : [...r.items, item],
    }));

    haptics.success();
    showToast(
      t(existing ? 'notify.itemEdited' : 'notify.itemAdded', {
        name: room.participants.find((p) => p.id === selfId)?.name ?? '',
        item: item.name,
      }),
      'success',
    );
    navigate({ name: 'room', code });
  };

  const removeItem = () => {
    if (!window.confirm(t('item.deleteConfirm'))) return;
    update((r) => ({ ...r, items: r.items.filter((i) => i.id !== itemId) }));
    haptics.medium();
    showToast(t('notify.itemDeleted', { name: '', item: existing?.name ?? '' }));
    navigate({ name: 'room', code });
  };

  return (
    <div className="page">
      <TopBar
        title={existing ? t('item.edit') : t('item.add')}
        subtitle={room.tableName}
        onBack={() => navigate({ name: 'room', code })}
        actions={
          existing ? (
            <button className="icon-btn icon-btn--danger" onClick={removeItem} aria-label={t('item.delete')}>
              <Icon name="trash" size={20} />
            </button>
          ) : null
        }
      />

      <form className="stack" onSubmit={save} noValidate>
        <GlassCard className="form-card__body" data-entrance>
          <Field label={t('item.name')} error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('item.name.ph')}
              maxLength={60}
              autoFocus
              invalid={!!errors.name}
            />
          </Field>

          <div className="grid-2">
            <Field label={t('item.price')} error={errors.unitPrice}>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                invalid={!!errors.unitPrice}
              />
            </Field>
            <Field label={t('item.qty')} error={errors.qty}>
              <Input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="1"
                inputMode="decimal"
                invalid={!!errors.qty}
              />
            </Field>
          </div>

          <Field label={t('item.notes')}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('item.notes.ph')}
              rows={2}
              maxLength={120}
            />
          </Field>

          <fieldset className="field">
            <legend className="field__label">{t('item.category')}</legend>
            <Chips
              options={[
                { value: 'food', label: t('item.cat.food') },
                { value: 'drink', label: t('item.cat.drink') },
                { value: 'dessert', label: t('item.cat.dessert') },
                { value: 'other', label: t('item.cat.other') },
              ]}
              selected={[category]}
              onChange={(vals) => setCategory(vals[0] as Category)}
            />
          </fieldset>
        </GlassCard>

        <GlassCard className="form-card__body" data-entrance>
          <div className="who-pays">
            <Segmented
              options={[
                { value: 'shared', label: t('item.split') },
                { value: 'single', label: t('item.payAlone') },
              ]}
              value={whoPays}
              onChange={(v) => {
                setWhoPays(v as WhoPays);
                haptics.light();
              }}
            />
            <p className="who-pays__desc">
              {whoPays === 'shared' ? t('item.split.desc') : t('item.payAlone.desc')}
            </p>
          </div>

          {whoPays === 'single' ? (
            <div className="person-pick">
              <span className="field__label">{t('item.selectPayer')}</span>
              <div className="person-pick__grid">
                {room.participants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`person-btn ${ownerId === p.id ? 'person-btn--active' : ''}`}
                    onClick={() => setOwnerId(p.id)}
                  >
                    <Avatar name={p.name} color={p.color} size="md" />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="person-pick">
              <div className="person-pick__head">
                <span className="field__label">{t('item.selectSplit')}</span>
                <button type="button" className="link-btn" onClick={splitEqual}>
                  {t('item.split')} = 
                </button>
              </div>
              <div className="person-pick__list">
                {room.participants.map((p) => {
                  const q = shares[p.id] ?? 0;
                  const active = q > 0;
                  return (
                    <div
                      key={p.id}
                      className={`share-row ${active ? 'share-row--active' : ''}`}
                    >
                      <button
                        type="button"
                        className="share-row__person"
                        onClick={() => setShareQty(p.id, active ? 0 : 1)}
                        aria-pressed={active}
                      >
                        <Avatar name={p.name} color={p.color} size="md" />
                        <span>{p.name}</span>
                        {active && <span className="share-row__check">✓</span>}
                      </button>
                      <div className="share-row__right">
                        <QtyStepper
                          value={q}
                          onChange={(v) => setShareQty(p.id, v)}
                          disabled={!active}
                          min={0}
                          max={99}
                        />
                        <span className="share-row__amount">{money(preview[p.id] ?? 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {errors.shares && <p className="field__error" role="alert">{errors.shares}</p>}
            </div>
          )}
        </GlassCard>

        <GlassCard className="form-card__body item-preview" data-entrance>
          <div className="item-preview__row">
            <span>{t('item.total')}</span>
            <strong>
              <AnimatedNumber value={itemTotal} format={money} duration={0.45} />
            </strong>
          </div>
          {whoPays === 'shared' && selectedShares.length > 1 && (
            <div className="item-preview__split">
              {selectedShares.map((p) => (
                <span key={p.id} className="mini-person">
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <span>
                    {money(preview[p.id] ?? 0)} · {shares[p.id]} {t('item.qtyFor')}
                  </span>
                </span>
              ))}
            </div>
          )}
        </GlassCard>

        <Button type="submit" size="lg" full loading={saving} icon="check">
          {saving ? t('item.saving') : t('item.save')}
        </Button>
      </form>
    </div>
  );
}
