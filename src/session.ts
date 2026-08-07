import { uid } from './domain/id';

/** Identidade persistente por aba/janela — evita participante duplicado. */
export function getDeviceId(): string {
  try {
    let id = sessionStorage.getItem('divide-ae:device');
    if (!id) {
      id = uid();
      sessionStorage.setItem('divide-ae:device', id);
    }
    return id;
  } catch {
    return uid();
  }
}
