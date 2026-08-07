import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Button, GlassCard, Modal, Segmented, Select, Field, Switch } from '../components/ui';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { navigate } from '../router';
import { settingsStore, useStore, type ThemePref } from '../store/appStore';
import { setRemoteSyncEnabled, useRemoteSyncStatus } from '../services/sync';
import { applyMotionPreference } from '../services/motionPref';
import { LANGS, translate } from '../i18n';
import { CURRENCIES } from '../services/currency';
import { clearAllLocalData } from '../services/storage';
import { haptics } from '../services/haptics';

export function SettingsScreen() {
  const settings = useStore(settingsStore);
  const t = (k: string) => translate(settings.lang, k);
  const { showToast } = useToast();
  const [clearOpen, setClearOpen] = useState(false);
  const remoteStatus = useRemoteSyncStatus();

  const set = (patch: Partial<typeof settings>) => {
    settingsStore.update((s) => ({ ...s, ...patch }));
    haptics.light();
  };

  const setRemoteSync = (value: boolean) => {
    set({ remoteSync: value });
    setRemoteSyncEnabled(value);
  };

  const setAnimations = (value: boolean) => {
    set({ animations: value });
    // Aplica na hora (restaura o original ao desligar) e recarrega para
    // que GSAP/Motion releiam a preferência no mount dos componentes.
    applyMotionPreference(value);
    window.setTimeout(() => window.location.reload(), 80);
  };

  const clearData = () => {
    clearAllLocalData();
    setClearOpen(false);
    haptics.medium();
    showToast(t('settings.cleared'), 'success');
    navigate({ name: 'home' });
  };

  return (
    <div className="page">
      <TopBar title={t('settings.title')} onBack={() => navigate({ name: 'home' })} />

      <div className="stack">
        <GlassCard className="form-card__body" data-entrance>
          <fieldset className="field">
            <legend className="field__label">
              <span className="setting-row__icon">
                <Icon name={settings.theme === 'dark' ? 'moon' : 'sun'} size={15} />
              </span>
              {t('settings.theme')}
            </legend>
            <Segmented
              options={[
                { value: 'light', label: t('settings.theme.light') },
                { value: 'dark', label: t('settings.theme.dark') },
                { value: 'system', label: t('settings.theme.system') },
              ]}
              value={settings.theme}
              onChange={(v) => set({ theme: v as ThemePref })}
            />
          </fieldset>
        </GlassCard>

        <GlassCard className="form-card__body" data-entrance>
          <fieldset className="field">
            <legend className="field__label">
              <span className="setting-row__icon">
                <Icon name="globe" size={15} />
              </span>
              {t('settings.language')}
            </legend>
            <Segmented
              options={LANGS.map((l) => ({ value: l.code, label: l.code }))}
              value={settings.lang}
              onChange={(v) => set({ lang: v as typeof settings.lang })}
            />
          </fieldset>
        </GlassCard>

        <GlassCard className="form-card__body" data-entrance>
          <Field label={t('settings.currency')} hint={t('settings.currency.desc')}>
            <Select value={settings.currency} onChange={(e) => set({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </GlassCard>

        <GlassCard className="form-card__body" data-entrance>
          <div className="setting-row">
            <span className="setting-row__icon">
              <Icon name="zap" size={15} />
            </span>
            <div>
              <strong>{t('settings.offline')}</strong>
              <p>{t('settings.offline.desc')}</p>
            </div>
          </div>
          <div className="setting-row setting-row--switch">
            <span className="setting-row__icon">
              <Icon name="refresh" size={15} />
            </span>
            <div className="setting-row__main">
              <strong>{t('settings.remoteSync')}</strong>
              <p>{t('settings.remoteSync.desc')}</p>
            </div>
            <Switch
              checked={settings.remoteSync ?? true}
              onChange={setRemoteSync}
              label={t('settings.remoteSync')}
            />
          </div>
          <div className="remote-status">
            <span className={`remote-status__dot remote-status__dot--${remoteStatus}`} aria-hidden="true" />
            <span>{t(`settings.remote.${remoteStatus}`)}</span>
          </div>
        </GlassCard>

        <GlassCard className="form-card__body" data-entrance>
          <div className="setting-row setting-row--switch">
            <span className="setting-row__icon">
              <Icon name="zap" size={15} />
            </span>
            <div className="setting-row__main">
              <strong>{t('settings.animations')}</strong>
              <p>{t('settings.animations.desc')}</p>
            </div>
            <Switch
              checked={settings.animations ?? true}
              onChange={setAnimations}
              label={t('settings.animations')}
            />
          </div>
        </GlassCard>

        <Button variant="danger" full icon="trash" onClick={() => setClearOpen(true)} data-entrance>
          {t('settings.clear')}
        </Button>
      </div>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title={t('settings.clear')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setClearOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" icon="trash" onClick={clearData}>
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <p className="modal__text">{t('settings.clearConfirm')}</p>
      </Modal>
    </div>
  );
}
