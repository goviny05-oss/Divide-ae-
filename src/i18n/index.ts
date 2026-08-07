// ============================================================
// i18n — função de tradução com interpolação simples {param}.
// ============================================================

import { STRINGS, type Dict, type Lang } from './strings';

export { STRINGS } from './strings';
export type { Lang } from './strings';

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dict: Dict = STRINGS[lang] ?? STRINGS['pt-BR'];
  let text = dict[key];
  if (text === undefined) {
    text = STRINGS['pt-BR'][key] ?? key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
