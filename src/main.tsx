import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { settingsStore } from './store/appStore';
import { applyMotionPreference } from './services/motionPref';
import './styles/global.css';

// Registra o service worker (PWA): instalação na tela inicial + cache offline.
// autoUpdate garante que os usuários recebam sempre a versão mais recente.
registerSW({ immediate: true });

// Aplica a preferência de animação ANTES do React montar: GSAP
// (gsap.matchMedia) e Motion (useReducedMotion) leem o matchMedia
// no mount dos componentes, então o patch precisa estar ativo antes.
applyMotionPreference(settingsStore.get().animations ?? true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
