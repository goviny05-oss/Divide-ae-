import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Button, Field, Input, GlassCard, Avatar } from '../components/ui';
import { navigate } from '../router';
import { useStore, settingsStore, profileStore } from '../store/appStore';
import { translate } from '../i18n';
import { AVATAR_COLORS } from '../domain/id';
import { validateParticipantName } from '../domain/validate';
import { roomsStorage } from '../services/storage';
import { emitSync } from '../services/sync';
import { getDeviceId } from '../session';
import { useToast } from '../components/Toast';
import { haptics } from '../services/haptics';

export function SetupScreen({ code }: { code: string }) {
  const settings = useStore(settingsStore);
  const profile = useStore(profileStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);
  const { showToast } = useToast();

  const room = roomsStorage.get(code);
  const [name, setName] = useState(profile.name || '');
  const [color, setColor] = useState(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  if (!room) {
    return (
      <div className="page">
        <TopBar title="…" onBack={() => navigate({ name: 'home' })} />
        <p className="page__muted">{t('join.codeNotFound')}</p>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateParticipantName(name)) {
      setError(t('room.nameRequired'));
      haptics.error();
      return;
    }
    setError('');
    setJoining(true);

    const deviceId = getDeviceId();
    const exists = room.participants.some((p) => p.id === deviceId);
    const updated = {
      ...room,
      participants: exists
        ? room.participants.map((p) => (p.id === deviceId ? { ...p, name: name.trim(), color } : p))
        : [...room.participants, { id: deviceId, name: name.trim(), color, joinedAt: Date.now() }],
    };
    roomsStorage.save(updated);
    emitSync({ type: 'room:upsert', room: updated });

    // Pré-preenche o perfil para a próxima vez.
    profileStore.update((p) => ({ ...p, name: name.trim() }));

    haptics.success();
    showToast(t('notify.joined', { name: name.trim() }), 'success');
    navigate({ name: 'room', code });
  };

  return (
    <div className="page">
      <TopBar title={room.tableName} subtitle={room.restaurant} onBack={() => navigate({ name: 'home' })} />

      <form className="stack" onSubmit={submit} noValidate>
        <GlassCard className="form-card__body" data-entrance>
          <div className="setup__preview" aria-hidden="true">
            <Avatar name={name || '?'} color={color} size="lg" />
          </div>

          <Field label={t('room.enterYourName')} error={error}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder={t('room.name.ph')}
              maxLength={24}
              autoFocus
              invalid={!!error}
            />
          </Field>

          <fieldset className="field">
            <legend className="field__label">{t('room.chooseColor')}</legend>
            <div className="color-palette" role="radiogroup" aria-label={t('room.chooseColor')}>
              {AVATAR_COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  className={`color-swatch ${color === c ? 'color-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => {
                    setColor(c);
                    haptics.light();
                  }}
                  aria-label={`${t('room.chooseColor')} ${i + 1}`}
                />
              ))}
            </div>
          </fieldset>
        </GlassCard>

        <Button type="submit" size="lg" full loading={joining} icon="logOut">
          {joining ? t('room.joining') : t('room.enter')}
        </Button>
      </form>
    </div>
  );
}
