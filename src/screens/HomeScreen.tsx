import { useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';
import { navigate } from '../router';
import { useStore, settingsStore } from '../store/appStore';
import { translate } from '../i18n';
import { Button } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { HeroArt } from '../components/HeroArt';
import { springTap } from '../lib/anim';
import { haptics } from '../services/haptics';
import { roomsStorage } from '../services/storage';

const STEPS = [
  { num: '01', title: 'home.step1.title', desc: 'home.step1.desc' },
  { num: '02', title: 'home.step2.title', desc: 'home.step2.desc' },
  { num: '03', title: 'home.step3.title', desc: 'home.step3.desc' },
] as const;

export function HomeScreen() {
  const settings = useStore(settingsStore);
  const t = (k: string, p?: Record<string, string | number>) => translate(settings.lang, k, p);
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<{ rx?: ReturnType<typeof gsap.quickTo>; ry?: ReturnType<typeof gsap.quickTo> }>({});
  const reduce = useReducedMotion() ?? false;

  // Contexto real do hero: quantas salas estão abertas agora.
  const activeRooms = useMemo(
    () => Object.values(roomsStorage.all()).filter((r) => r.status === 'open').length,
    [],
  );

  // Timeline de entrada coordenada (status → headline → descrição → objeto →
  // CTAs → navegação discreta) + vida do objeto (floating, tilt 3D, glow) +
  // parallax de scroll. Cleanup automático via useGSAP.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const root = rootRef.current;

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('.home__status', { y: -12, opacity: 0, duration: 0.4 }, 0.05)
          .from('.home__headline-line', { y: 30, opacity: 0, stagger: 0.09, duration: 0.55 }, '-=0.24')
          .from('.home__desc', { y: 12, opacity: 0, duration: 0.4 }, '-=0.32')
          .from(
            '.hero-art',
            { y: 26, opacity: 0, scale: 0.94, duration: 0.62, ease: 'back.out(1.4)' },
            '-=0.2',
          )
          .from(
            '.hero-art__scene .receipt',
            { scaleY: 0.86, opacity: 0, transformOrigin: '50% 0%', duration: 0.5, ease: 'power2.out' },
            '-=0.42',
          )
          .from('.hero-chip', { scale: 0.3, opacity: 0, stagger: 0.06, duration: 0.42, ease: 'back.out(2.2)' }, '-=0.34')
          .from('.home__ctas > *', { y: 16, opacity: 0, stagger: 0.09, duration: 0.4 }, '-=0.24')
          .from('.home__quicknav > *', { y: 10, opacity: 0, stagger: 0.05, duration: 0.3 }, '-=0.22')
          .from(
            '.home__footer, .home__footnote',
            { y: 8, opacity: 0, stagger: 0.05, duration: 0.3 },
            '-=0.18',
          );

        // Vida do objeto — floating quase imperceptível + respiração do glow.
        if (sceneRef.current) {
          gsap.to(sceneRef.current, { y: -6, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1 });
          tiltRef.current.rx = gsap.quickTo(sceneRef.current, 'rotationX', { duration: 0.7, ease: 'power3.out' });
          tiltRef.current.ry = gsap.quickTo(sceneRef.current, 'rotationY', { duration: 0.7, ease: 'power3.out' });
        }
        gsap.to('.hero-chip--1', { y: -8, duration: 3.8, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.2 });
        gsap.to('.hero-chip--2', { y: -6, duration: 4.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.6 });
        gsap.to('.hero-chip--3', { y: -9, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 2 });
        gsap.to('.hero-art__glow', { opacity: 0.9, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });

        // Cleanup do tilt: o tween do quickTo nasce na primeira chamada (dentro
        // do handler, fora do contexto) — matá-lo aqui evita tween órfão
        // segurando o nó da cena após o unmount.
        return () => {
          tiltRef.current.rx?.tween?.kill();
          tiltRef.current.ry?.tween?.kill();
        };

        // Parallax de scroll — o bloco editorial desacelera, blobs acompanham.
        if (root) {
          gsap.to('.home__hero', {
            yPercent: 14,
            opacity: 0.6,
            ease: 'none',
            scrollTrigger: { trigger: root, start: 'top top', end: 'bottom 55%', scrub: true },
          });
          const blobs = [
            document.querySelector<HTMLElement>('.app__blob--1'),
            document.querySelector<HTMLElement>('.app__blob--2'),
          ];
          if (blobs[0]) {
            gsap.to(blobs[0], {
              yPercent: 28,
              ease: 'none',
              scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
            });
          }
          if (blobs[1]) {
            gsap.to(blobs[1], {
              yPercent: -20,
              ease: 'none',
              scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
            });
          }
        }
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(
          [
            '.home__status',
            '.home__headline-line',
            '.home__desc',
            '.hero-art',
            '.hero-art__scene .receipt',
            '.hero-chip',
            '.home__ctas > *',
            '.home__quicknav > *',
            '.home__footer',
            '.home__footnote',
          ],
          { opacity: 1, y: 0, scale: 1, scaleY: 1 },
        );
      });
    },
    { scope: rootRef },
  );

  // Tilt 3D que acompanha o cursor (desktop/pointer). No touch, apenas o
  // floating ambiente anima o objeto.
  const onHeroMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = sceneRef.current;
    const tilt = tiltRef.current;
    if (!el || !tilt.rx || !tilt.ry) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    tilt.rx(ny * -8);
    tilt.ry(nx * 10);
  };

  const onHeroLeave = () => {
    tiltRef.current.rx?.(0);
    tiltRef.current.ry?.(0);
  };

  return (
    <div className="home page" ref={rootRef}>
      <header className="home__hero">
        {/* Status / contexto — dado real do app, não protagonista. */}
        <div className="home__status">
          <span className="home__status-orb" aria-hidden="true">
            <Icon name="receipt" size={11} />
          </span>
          <span className="home__status-name">{t('app.name')}</span>
          <span className="home__status-sep" aria-hidden="true" />
          <span className="home__status-live" aria-hidden="true" />
          <span className="home__status-count">
            {activeRooms === 1 ? t('home.statusOne') : t('home.status', { count: activeRooms })}
          </span>
        </div>

        {/* Headline editorial — frase curta + linha de destaque. */}
        <h1 className="home__headline">
          <span className="home__headline-line">{t('home.headline1')}</span>
          <span className="home__headline-line home__headline-line--em">{t('home.headline2')}</span>
        </h1>
        <p className="home__desc">{t('home.desc')}</p>

        {/* Objeto visual principal — integrado ao texto, iluminação própria. */}
        <div className="hero-art-wrap" onMouseMove={onHeroMove} onMouseLeave={onHeroLeave}>
          <HeroArt sceneRef={sceneRef} splitLabel={t('home.art.split', { n: 3, per: 'R$ 28,00' })} />
        </div>
      </header>

      <div className="home__ctas">
        <motion.button
          type="button"
          className="home-cta home-cta--primary"
          onClick={() => {
            haptics.light();
            navigate({ name: 'create' });
          }}
          whileHover={reduce ? undefined : { y: -2 }}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={springTap}
        >
          <span className="home-cta__label">{t('home.createRoom')}</span>
          <span className="home-cta__icon" aria-hidden="true">
            <Icon name="plus" size={17} />
          </span>
        </motion.button>
        <Button
          size="lg"
          full
          variant="outline"
          icon="users"
          className="home__cta--secondary"
          onClick={() => navigate({ name: 'join' })}
        >
          {t('home.joinRoom')}
        </Button>
      </div>

      {/* Navegação discreta — sem disputar espaço com o hero. */}
      <div className="home__quicknav">
        <HomeShortcut icon="history" label={t('home.history')} onClick={() => navigate({ name: 'history' })} />
        <HomeShortcut icon="user" label={t('home.profile')} onClick={() => navigate({ name: 'profile' })} />
        <HomeShortcut icon="settings" label={t('home.settings')} onClick={() => navigate({ name: 'settings' })} />
      </div>

      <section className="home__steps" aria-label={t('home.steps.title')}>
        <motion.h2
          className="home__steps-title"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-28px' }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {t('home.steps.title')}
        </motion.h2>
        <div className="home-steps">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              className="home-step"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-28px' }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: i * 0.09 }}
            >
              <span className="home-step__num" aria-hidden="true">
                {step.num}
              </span>
              <div>
                <p className="home-step__title">{t(step.title)}</p>
                <p className="home-step__desc">{t(step.desc)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <nav className="home__footer" aria-label="Links">
        <button onClick={() => navigate({ name: 'info' })}>{t('home.howItWorks')}</button>
        <span className="home__dot">·</span>
        <button onClick={() => navigate({ name: 'info' })}>{t('home.feedback')}</button>
        <span className="home__dot">·</span>
        <button onClick={() => navigate({ name: 'info' })}>{t('home.privacy')}</button>
      </nav>
      <p className="home__footnote">{t('home.footer')}</p>
    </div>
  );
}

function HomeShortcut({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className="home-quick"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.94 }}
      transition={springTap}
    >
      <span className="home-quick__icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="home-quick__label">{label}</span>
    </motion.button>
  );
}
