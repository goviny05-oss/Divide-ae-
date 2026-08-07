/** Feedback tátil em dispositivos compatíveis (navegadores mobile). */
export function vibrate(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* sem suporte */
  }
}

export const haptics = {
  light: () => vibrate(8),
  medium: () => vibrate([10, 40, 10]),
  success: () => vibrate([12, 50, 22]),
  error: () => vibrate([40, 30, 40]),
};
