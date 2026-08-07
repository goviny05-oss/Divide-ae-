import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Button, GlassCard, Segmented, Textarea } from '../components/ui';
import { useToast } from '../components/Toast';
import { navigate } from '../router';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { haptics } from '../services/haptics';

type Tab = 'how' | 'feedback' | 'privacy';

const STEPS = [
  { emoji: '🚀', key: 'create.title' },
  { emoji: '🔗', key: 'home.joinRoom' },
  { emoji: '🍕', key: 'room.addItem' },
  { emoji: '🎉', key: 'close.done' },
];

export function InfoScreen() {
  const settings = useStore(settingsStore);
  const t = (k: string) => translate(settings.lang, k);
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('how');
  const [feedback, setFeedback] = useState('');

  const sendFeedback = () => {
    if (feedback.trim().length < 3) {
      showToast(t('error.required'), 'error');
      return;
    }
    try {
      const list = JSON.parse(localStorage.getItem('divide-ae:feedback') ?? '[]') as string[];
      list.unshift(`${new Date().toISOString()} :: ${feedback.trim()}`);
      localStorage.setItem('divide-ae:feedback', JSON.stringify(list.slice(0, 200)));
    } catch {
      /* storage indisponível */
    }
    setFeedback('');
    haptics.success();
    showToast(t('info.feedback.thanks'), 'success');
  };

  return (
    <div className="page">
      <TopBar title={t('app.name')} onBack={() => navigate({ name: 'home' })} />

      <div className="stack">
        <Segmented
          options={[
            { value: 'how', label: t('home.howItWorks') },
            { value: 'feedback', label: t('home.feedback') },
            { value: 'privacy', label: t('home.privacy') },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />

        {tab === 'how' && (
          <GlassCard className="info-card" data-entrance>
            <h2>{t('info.how.title')}</h2>
            <p className="info-card__lead">{t('info.how.steps')}</p>
            <ol className="info-steps">
              {STEPS.map((s) => (
                <li key={s.key}>
                  <span className="info-steps__emoji" aria-hidden="true">
                    {s.emoji}
                  </span>
                  <span>{t(s.key)}</span>
                </li>
              ))}
            </ol>
          </GlassCard>
        )}

        {tab === 'feedback' && (
          <GlassCard className="info-card" data-entrance>
            <h2>{t('info.feedback.title')}</h2>
            <label className="field__label" htmlFor="fb">
              {t('info.feedback.label')}
            </label>
            <Textarea
              id="fb"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={5}
              maxLength={600}
              placeholder="✨"
            />
            <Button full icon="zap" onClick={sendFeedback} className="mt-1">
              {t('info.feedback.send')}
            </Button>
          </GlassCard>
        )}

        {tab === 'privacy' && (
          <GlassCard className="info-card" data-entrance>
            <h2>{t('info.privacy.title')}</h2>
            <p>{t('info.privacy.body')}</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
