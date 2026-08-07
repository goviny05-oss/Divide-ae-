// ============================================================
// QR — geração e leitura de QR Codes.
// ============================================================

import QRCode from 'qrcode';

/** Gera um QR Code como data URL (PNG). */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 640,
    color: { dark: '#1e2233', light: '#ffffff' },
  });
}

/** Conteúdo de um QR Code de sala (link profundo). */
export function roomShareUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/room/${code}`;
}
