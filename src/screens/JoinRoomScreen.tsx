import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Button, Field, Input, GlassCard, Modal } from '../components/ui';
import { QrScanner } from '../components/QrScanner';
import { navigate } from '../router';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { normalizeCode } from '../domain/id';
import { validateJoinCode } from '../domain/validate';
import { roomsStorage } from '../services/storage';
import { useToast } from '../components/Toast';
import { haptics } from '../services/haptics';

/** Extrai o código de um conteúdo de QR (aceita link profundo ou código puro). */
function extractCode(text: string): string {
  const m = text.match(/\/room\/([A-Z0-9]{6})/i) ?? text.match(/([A-Z0-9]{6})/i);
  return m ? m[1].toUpperCase() : '';
}

export function JoinRoomScreen() {
  const settings = useStore(settingsStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);
  const { showToast } = useToast();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

  const tryJoin = (rawCode: string) => {
    const normalized = normalizeCode(rawCode);
    if (!validateJoinCode(normalized)) {
      setError(t('join.codeNotFound'));
      haptics.error();
      return;
    }
    const room = roomsStorage.get(normalized);
    if (!room) {
      setError(t('join.codeNotFound'));
      haptics.error();
      return;
    }
    if (room.status === 'closed') {
      setError(t('join.codeClosed'));
      haptics.error();
      return;
    }
    setError('');
    haptics.success();
    navigate({ name: 'room', code: normalized, setup: true });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    tryJoin(code);
  };

  return (
    <div className="page">
      <TopBar
        title={t('join.title')}
        subtitle={t('join.subtitle')}
        onBack={() => navigate({ name: 'home' })}
      />

      <div className="stack">
        <GlassCard className="form-card__body" data-entrance>
          <form onSubmit={onSubmit} noValidate>
            <Field label={t('room.yourCode')} error={error} hint={t('join.tip')}>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder={t('join.code.ph')}
                className="input--code"
                autoFocus
                invalid={!!error}
                aria-label="Código da sala"
              />
            </Field>
            <Button type="submit" size="lg" full icon="logOut">
              {t('join.go')}
            </Button>
          </form>
        </GlassCard>

        <div className="join-divider" aria-hidden="true">
          <span>{t('common.or')}</span>
        </div>

        <Button
          variant="ghost"
          size="lg"
          full
          icon="qr"
          onClick={() => setScanOpen(true)}
        >
          {t('qr.openCamera')}
        </Button>
      </div>

      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title={t('qr.scan')}
      >
        <QrScanner
          lang={settings.lang}
          onResult={(text) => {
            setScanOpen(false);
            const c = extractCode(text);
            if (c) {
              tryJoin(c);
            } else {
              showToast(t('qr.notFound'), 'error');
            }
          }}
        />
      </Modal>
    </div>
  );
}
