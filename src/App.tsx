import { useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { ToastProvider } from './components/Toast';
import { ScreenTransition } from './components/ScreenTransition';
import { useHashRoute } from './router';
import { settingsStore, useStore } from './store/appStore';
import { setRemoteSyncEnabled } from './services/sync';
import { HomeScreen } from './screens/HomeScreen';
import { CreateRoomScreen } from './screens/CreateRoomScreen';
import { JoinRoomScreen } from './screens/JoinRoomScreen';
import { SetupScreen } from './screens/SetupScreen';
import { RoomScreen } from './screens/RoomScreen';
import { AddItemScreen } from './screens/AddItemScreen';
import { FeesScreen } from './screens/FeesScreen';
import { PersonSummaryScreen } from './screens/PersonSummaryScreen';
import { CloseBillScreen } from './screens/CloseBillScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { InfoScreen } from './screens/InfoScreen';

export default function App() {
  const route = useHashRoute();
  const settings = useStore(settingsStore);

  // Aplica tema e idioma globalmente.
  useEffect(() => {
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.lang = settings.lang;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0a0a10' : '#f7f6f3');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (settingsStore.get().theme === 'system') apply();
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [settings]);

  // Inicializa (ou desliga) o transporte remoto conforme a preferência.
  useEffect(() => {
    setRemoteSyncEnabled(settings.remoteSync ?? true);
  }, [settings.remoteSync]);

  let screen: React.ReactNode;
  switch (route.name) {
    case 'create':
      screen = <CreateRoomScreen />;
      break;
    case 'join':
      screen = <JoinRoomScreen />;
      break;
    case 'room':
      screen = route.setup ? <SetupScreen code={route.code} /> : <RoomScreen code={route.code} />;
      break;
    case 'item':
      screen = <AddItemScreen code={route.code} itemId={route.itemId} />;
      break;
    case 'fees':
      screen = <FeesScreen code={route.code} />;
      break;
    case 'person':
      screen = <PersonSummaryScreen code={route.code} participantId={route.participantId} />;
      break;
    case 'close':
      screen = <CloseBillScreen code={route.code} />;
      break;
    case 'history':
      screen = <HistoryScreen />;
      break;
    case 'profile':
      screen = <ProfileScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'info':
      screen = <InfoScreen />;
      break;
    default:
      screen = <HomeScreen />;
  }

  return (
    <ToastProvider>
      <div className="app">
        <div className="app__blob app__blob--1" aria-hidden="true" />
        <div className="app__blob app__blob--2" aria-hidden="true" />
        <div className="app__blob app__blob--3" aria-hidden="true" />
        <main>
          {/* mode="wait": a tela atual sai suavemente antes da próxima entrar. */}
          <AnimatePresence mode="wait" initial={false}>
            <ScreenTransition key={screenKey(route)}>{screen}</ScreenTransition>
          </AnimatePresence>
        </main>
      </div>
    </ToastProvider>
  );
}

function screenKey(route: ReturnType<typeof useHashRoute>): string {
  switch (route.name) {
    case 'room':
      return `room-${route.code}${route.setup ? '-setup' : ''}`;
    case 'item':
      return `item-${route.code}-${route.itemId ?? 'new'}`;
    case 'person':
      return `person-${route.code}-${route.participantId}`;
    default:
      return route.name;
  }
}
