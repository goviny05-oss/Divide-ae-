import { useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Button, Field, Input, GlassCard } from '../components/ui';
import { navigate } from '../router';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { validateRoomCreate } from '../domain/validate';
import { newRoomCode, uid } from '../domain/id';
import { roomsStorage } from '../services/storage';
import { emitSync } from '../services/sync';
import { haptics } from '../services/haptics';
import type { Fees, Room } from '../types';

const EMPTY_FEES: Fees = {
  serviceFeePct: null,
  couvertPerPerson: null,
  discount: null,
  couponPct: null,
};

export function CreateRoomScreen() {
  const settings = useStore(settingsStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);

  const [tableName, setTableName] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [participants, setParticipants] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const timersRef = useRef<number[]>([]);

  // Limpa os timers do feedback visual se o usuário sair da tela.
  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phase !== 'idle') return;
    const qty = participants.trim() === '' ? undefined : Number(participants.replace(',', '.'));
    const errs = validateRoomCreate(tableName, qty);
    if (errs.length > 0) {
      const map: Record<string, string> = {};
      errs.forEach((x) => (map[x.field] = x.message));
      setErrors(map);
      haptics.error();
      return;
    }
    setErrors({});
    setPhase('loading');

    // Código único: regenera até não colidir com salas conhecidas.
    let code = newRoomCode();
    const known = roomsStorage.codes();
    while (known.has(code)) code = newRoomCode();

    const room: Room = {
      id: uid(),
      code,
      tableName: tableName.trim(),
      restaurant: restaurant.trim() || undefined,
      participants: [],
      items: [],
      fees: { ...EMPTY_FEES },
      status: 'open',
      currency: settings.currency,
      createdAt: Date.now(),
      createdBy: undefined,
    };
    roomsStorage.save(room);
    emitSync({ type: 'room:upsert', room });
    haptics.success();

    // Feedback visível: LOADING → SUCCESS → transição para a sala.
    timersRef.current.push(window.setTimeout(() => setPhase('done'), 340));
    timersRef.current.push(window.setTimeout(() => navigate({ name: 'room', code, setup: true }), 820));
  };

  return (
    <div className="page">
      <TopBar
        title={t('create.title')}
        subtitle={t('create.subtitle')}
        onBack={() => navigate({ name: 'home' })}
      />

      <form className="stack form-card" onSubmit={submit} noValidate>
        <GlassCard className="form-card__body" data-entrance>
          <Field label={t('create.tableName')} error={errors.tableName}>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={t('create.tableName.ph')}
              maxLength={40}
              autoFocus
              invalid={!!errors.tableName}
            />
          </Field>

          <Field label={t('create.restaurant')}>
            <Input
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              placeholder={t('create.restaurant.ph')}
              maxLength={60}
            />
          </Field>

          <Field label={t('create.participants')} error={errors.participants}>
            <Input
              value={participants}
              onChange={(e) => setParticipants(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('create.participants.ph')}
              inputMode="numeric"
              maxLength={2}
              invalid={!!errors.participants}
            />
          </Field>
        </GlassCard>

        <Button
          type="submit"
          size="lg"
          full
          icon={phase === 'done' ? undefined : 'zap'}
          loading={phase === 'loading'}
          variant={phase === 'done' ? 'success' : 'primary'}
          disabled={phase === 'loading'}
        >
          {phase === 'loading' ? t('create.loading') : phase === 'done' ? t('create.success') : t('create.submit')}
        </Button>
      </form>
    </div>
  );
}
