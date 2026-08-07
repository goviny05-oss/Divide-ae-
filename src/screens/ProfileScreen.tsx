import { useRef, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Avatar, Button, Field, GlassCard, Input } from '../components/ui';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { navigate } from '../router';
import { profileStore, useStore } from '../store/appStore';
import { settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { validateParticipantName } from '../domain/validate';
import { haptics } from '../services/haptics';

export function ProfileScreen() {
  const settings = useStore(settingsStore);
  const profile = useStore(profileStore);
  const t = (k: string) => translate(settings.lang, k);
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile.name);
  const [photo, setPhoto] = useState<string | null>(profile.photo);
  const [error, setError] = useState('');

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('error.generic'), 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
        setPhoto(canvas.toDataURL('image/jpeg', 0.82));
        haptics.light();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!validateParticipantName(name)) {
      setError(t('room.nameRequired'));
      haptics.error();
      return;
    }
    profileStore.update((p) => ({ ...p, name: name.trim(), photo }));
    haptics.success();
    showToast(t('profile.saved'), 'success');
    navigate({ name: 'home' });
  };

  return (
    <div className="page">
      <TopBar title={t('profile.title')} onBack={() => navigate({ name: 'home' })} />

      <div className="stack">
        <GlassCard className="profile-card" data-entrance>
          <div className="profile-card__avatar">
            <Avatar name={name || '?'} color={undefined} photo={photo} size="lg" />
            <button
              className="profile-card__edit"
              onClick={() => fileRef.current?.click()}
              aria-label={t('profile.changePhoto')}
            >
              <Icon name="camera" size={16} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onFile}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <Field label={t('profile.name')} error={error}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder={t('room.name.ph')}
              maxLength={24}
              invalid={!!error}
            />
          </Field>

          <div className="row-2">
            {photo && (
              <Button
                variant="ghost"
                onClick={() => {
                  setPhoto(null);
                  haptics.light();
                }}
              >
                {t('profile.removePhoto')}
              </Button>
            )}
            <Button onClick={save} icon="check">
              {t('common.save')}
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
