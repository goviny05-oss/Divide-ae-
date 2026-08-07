import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { translate, type Lang } from '../i18n';

interface QrScannerProps {
  lang: Lang;
  onResult: (text: string) => void;
  onError?: (message: string) => void;
}

/**
 * Escaneia QR Codes pela câmera. Lê o primeiro QR válido e chama onResult.
 * Usa jsQR sobre frames de vídeo em um canvas offscreen.
 */
export function QrScanner({ lang, onResult, onError }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const t = (k: string) => translate(lang, k);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus('scanning');
        scanLoop();
      } catch {
        setStatus('error');
        onError?.(translate(lang, 'qr.cameraError'));
      }
    }

    function scanLoop() {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        raf = requestAnimationFrame(scanLoop);
        return;
      }
      const canvas = document.createElement('canvas');
      const { videoWidth: vw, videoHeight: vh } = video;
      if (vw > 0 && vh > 0) {
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, vw, vh);
          const image = ctx.getImageData(0, 0, vw, vh);
          const code = jsQR(image.data, vw, vh, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            onResult(code.data);
            doneRef.current = true;
            stop();
            return;
          }
        }
      }
      raf = requestAnimationFrame(scanLoop);
    }

    function stop() {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }

    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" muted playsInline />
      <div className="scanner__overlay" aria-hidden="true">
        <span className="scanner__frame" />
      </div>
      <p className="scanner__status">
        {status === 'starting' ? '…' : status === 'error' ? t('qr.cameraError') : t('qr.scanning')}
      </p>
    </div>
  );
}
