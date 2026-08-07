import { useCallback, useEffect, useState } from 'react';
import type { Route } from './types';

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  const [name, a, b] = parts;

  switch (name) {
    case 'create':
      return { name: 'create' };
    case 'join':
      return { name: 'join' };
    case 'room':
      if (!a) return { name: 'home' };
      if (b === 'fees') return { name: 'fees', code: a };
      if (b === 'close') return { name: 'close', code: a };
      if (b === 'person' && parts[3]) return { name: 'person', code: a, participantId: parts[3] };
      if (b === 'setup') return { name: 'room', code: a, setup: true };
      if (b === 'item' && parts[3]) return { name: 'item', code: a, itemId: parts[3] };
      if (b === 'item') return { name: 'item', code: a };
      return { name: 'room', code: a };
    case 'history':
      return { name: 'history' };
    case 'profile':
      return { name: 'profile' };
    case 'settings':
      return { name: 'settings' };
    case 'info':
      return { name: 'info' };
    default:
      return { name: 'home' };
  }
}

export function navigate(route: Route | string): void {
  if (typeof route === 'string') {
    window.location.hash = route.startsWith('#') ? route : `#/${route}`;
    return;
  }
  switch (route.name) {
    case 'home':
      window.location.hash = '#/';
      break;
    case 'create':
      window.location.hash = '#/create';
      break;
    case 'join':
      window.location.hash = '#/join';
      break;
    case 'room':
      window.location.hash = `#/room/${route.code}${route.setup ? '/setup' : ''}`;
      break;
    case 'item':
      window.location.hash = `#/room/${route.code}/item${route.itemId ? `/${route.itemId}` : ''}`;
      break;
    case 'fees':
      window.location.hash = `#/room/${route.code}/fees`;
      break;
    case 'person':
      window.location.hash = `#/room/${route.code}/person/${route.participantId}`;
      break;
    case 'close':
      window.location.hash = `#/room/${route.code}/close`;
      break;
    case 'history':
      window.location.hash = '#/history';
      break;
    case 'profile':
      window.location.hash = '#/profile';
      break;
    case 'settings':
      window.location.hash = '#/settings';
      break;
    case 'info':
      window.location.hash = '#/info';
      break;
  }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((r: Route | string) => navigate(r), []);
  return { ...route, go } as Route & { go: (r: Route | string) => void };
}
