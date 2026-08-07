// ============================================================
// Export — PDF, imagem PNG (recibo premium) e compartilhamento.
// ============================================================

import type { BillSummary, Room } from '../types';
import { formatMoney } from '../domain/money';
import { translate, type Lang } from '../i18n';
import { vibrate } from './haptics';

function t(lang: Lang, key: string, params?: Record<string, string | number>) {
  return translate(lang, key, params);
}

// ------------------------------------------------------------
// Utilitários de desenho
// ------------------------------------------------------------

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1);
  return out + '…';
}

function dashedH(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 10]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function initialsOf(name: string): string {
  return (
    (name || '?')
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function avatar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, name: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.24)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(r * 0.8)}px Sora, Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initialsOf(name), x, y + 1);
  ctx.restore();
}

/**
 * Caminho de cartão de recibo com borda inferior perfurada (zigzag),
 * no estilo do recibo do Hero da Home — usado pelo mini-recibo.
 */
function receiptCardPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  teeth = 14,
  depth = 9,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  const bottomY = y + h;
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  // Zigzag da borda inferior (da direita para a esquerda).
  let cx = x + w - rr;
  ctx.lineTo(cx, bottomY);
  let i = 0;
  while (cx > x + rr) {
    cx -= teeth;
    if (cx < x + rr) cx = x + rr;
    i += 1;
    ctx.lineTo(cx, i % 2 === 1 ? bottomY - depth : bottomY);
  }
  ctx.lineTo(x + rr, bottomY);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function sectionTitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = '#8b7ce8';
  ctx.font = '700 21px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

// ------------------------------------------------------------
// Renderer do recibo PNG (fundo escuro premium, altura dinâmica)
// ------------------------------------------------------------

const EXPORT_WIDTH = 1080;
const EXPORT_SCALE = 2;
const PAD = 84;
const INNER = 64;

type FeeRow = { label: string; value: number };

function buildLayout(room: Room, summary: BillSummary, lang: Lang) {
  const tr = (k: string, p?: Record<string, string | number>) => t(lang, k, p);
  const items = room.items.slice(0, 30);
  const extraItems = room.items.length - items.length;
  const people = summary.perPerson.slice(0, 24);
  const extraPeople = summary.perPerson.length - people.length;

  const fees: FeeRow[] = [];
  if (summary.discount) fees.push({ label: tr('person.discount'), value: -summary.discount });
  if (summary.coupon) fees.push({ label: tr('person.coupon'), value: -summary.coupon });
  if (summary.serviceFee) fees.push({ label: tr('person.serviceFee'), value: summary.serviceFee });
  if (summary.couvert) fees.push({ label: tr('person.couvert'), value: summary.couvert });

  return { items, extraItems, people, extraPeople, fees };
}

function drawBill(
  ctx: CanvasRenderingContext2D,
  room: Room,
  summary: BillSummary,
  lang: Lang,
  H: number,
): number {
  const tr = (k: string, p?: Record<string, string | number>) => t(lang, k, p);
  const money = (c: number) => formatMoney(c, room.currency);
  const { items, extraItems, people, extraPeople, fees } = buildLayout(room, summary, lang);

  const W = EXPORT_WIDTH;
  const CARD_X = PAD;
  const CARD_W = W - PAD * 2;
  const LEFT = CARD_X + INNER;
  const RIGHT = CARD_X + CARD_W - INNER;
  const CW = W / 2;

  // ---- Fundo escuro com iluminação ambiente ----
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0e0e18');
  bg.addColorStop(0.55, '#0a0a11');
  bg.addColorStop(1, '#0f0d17');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const ambient = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  ambient(W * 0.16, -140, 640, 'rgba(139,124,232,0.22)');
  ambient(W * 0.92, H * 0.32, 620, 'rgba(91,140,255,0.14)');
  ambient(W * 0.5, H + 140, 760, 'rgba(139,124,232,0.15)');

  // ---- Superfície do recibo ----
  roundRectPath(ctx, CARD_X, 0, CARD_W, H, 40);
  const cardGrad = ctx.createLinearGradient(0, 0, 0, H);
  cardGrad.addColorStop(0, '#171722');
  cardGrad.addColorStop(1, '#12121b');
  ctx.fillStyle = cardGrad;
  ctx.fill();

  // Hairline de luz no topo + borda violeta discreta.
  ctx.save();
  roundRectPath(ctx, CARD_X, 0, CARD_W, H, 40);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(CARD_X, 0, CARD_W, 2);
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, CARD_X, 0, CARD_W, H, 40);
  ctx.strokeStyle = 'rgba(167,155,242,0.26)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Marca d'água sutil.
  const wm = ctx.createRadialGradient(CW, H * 0.64, 0, CW, H * 0.64, 540);
  wm.addColorStop(0, 'rgba(139,124,232,0.06)');
  wm.addColorStop(1, 'rgba(139,124,232,0)');
  ctx.fillStyle = wm;
  ctx.fillRect(CARD_X, 0, CARD_W, H);

  let y = 0;

  // ---- Cabeçalho: marca + status + sala ----
  y += 48;
  roundRectPath(ctx, LEFT, y, 64, 64, 20);
  const markG = ctx.createLinearGradient(LEFT, y, LEFT + 64, y + 64);
  markG.addColorStop(0, '#7a6cf2');
  markG.addColorStop(1, '#5b8cff');
  ctx.fillStyle = markG;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(LEFT + 18, y + 22);
  ctx.lineTo(LEFT + 46, y + 22);
  ctx.moveTo(LEFT + 18, y + 34);
  ctx.lineTo(LEFT + 46, y + 34);
  ctx.moveTo(LEFT + 18, y + 46);
  ctx.lineTo(LEFT + 34, y + 46);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#f2f1ed';
  ctx.font = '800 30px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(tr('app.name'), LEFT + 88, y + 48);
  ctx.restore();

  // Status + data (direita)
  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8b7ce8';
  ctx.font = '700 20px Sora, Inter, sans-serif';
  ctx.fillText(tr('close.closed').toUpperCase(), RIGHT, y + 32);
  ctx.fillStyle = 'rgba(169,167,189,0.9)';
  ctx.font = '400 17px Inter, sans-serif';
  const dateStr = new Date(room.createdAt).toLocaleString(lang, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  ctx.fillText(dateStr, RIGHT, y + 62);
  ctx.restore();

  // Nome da mesa + estabelecimento
  y += 122;
  ctx.save();
  ctx.fillStyle = '#f2f1ed';
  ctx.font = '700 46px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(truncateText(ctx, room.tableName, 640), LEFT, y);
  ctx.restore();
  y += 46;
  const meta = [room.restaurant, `Código ${room.code}`].filter(Boolean).join('   ·   ');
  ctx.save();
  ctx.fillStyle = 'rgba(169,167,189,0.85)';
  ctx.font = '400 19px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(truncateText(ctx, meta, 720), LEFT, y);
  ctx.restore();

  // ---- Total — o protagonista ----
  y += 44;
  ctx.save();
  ctx.fillStyle = 'rgba(169,167,189,0.9)';
  ctx.font = '600 19px Sora, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tr('close.total').toUpperCase(), CW, y);
  ctx.restore();

  // Iluminação sutil atrás do valor.
  const glow = ctx.createRadialGradient(CW, y + 112, 10, CW, y + 112, 340);
  glow.addColorStop(0, 'rgba(139,124,232,0.3)');
  glow.addColorStop(1, 'rgba(139,124,232,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(CARD_X, y + 44, CARD_W, 200);

  ctx.save();
  ctx.font = '800 88px Sora, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const valStr = money(summary.total);
  const valGrad = ctx.createLinearGradient(CW - 320, 0, CW + 320, 0);
  valGrad.addColorStop(0, '#a79bf2');
  valGrad.addColorStop(0.5, '#8b7ce8');
  valGrad.addColorStop(1, '#7aa5ff');
  ctx.fillStyle = valGrad;
  ctx.fillText(valStr, CW, y + 138);
  ctx.restore();
  y += 170;

  // ---- Participantes ----
  if (people.length > 0) {
    y += 48;
    sectionTitle(ctx, tr('room.participants'), LEFT, y);
    y += 44;
    people.forEach((p, i) => {
      const participant = room.participants.find((x) => x.id === p.participantId);
      const color = participant?.color ?? '#8b7ce8';
      avatar(ctx, LEFT + 19, y + 19, 19, color, participant?.name ?? '?');
      ctx.save();
      ctx.fillStyle = '#f2f1ed';
      ctx.font = '500 22px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(truncateText(ctx, participant?.name ?? '?', 420), LEFT + 52, y + 25);
      ctx.restore();
      if (i < people.length - 1) dashedH(ctx, LEFT + 52, RIGHT, y + 46);
      y += 62;
    });
    if (extraPeople > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(169,167,189,0.85)';
      ctx.font = '500 20px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`+${extraPeople} ${tr('room.participants')}`, LEFT + 52, y + 22);
      ctx.restore();
      y += 40;
    }
  }

  // ---- Pedidos ----
  y += 48;
  sectionTitle(ctx, tr('room.orders'), LEFT, y);
  y += 46;
  items.forEach((item) => {
    // Badge de quantidade.
    roundRectPath(ctx, LEFT, y - 34, 42, 42, 12);
    ctx.fillStyle = '#20202e';
    ctx.fill();
    ctx.save();
    ctx.fillStyle = '#8b7ce8';
    ctx.font = '700 20px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(item.qty), LEFT + 21, y - 13);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#f2f1ed';
    ctx.font = '600 23px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(truncateText(ctx, item.name, 430), LEFT + 60, y + 2);
    if (item.notes) {
      ctx.fillStyle = 'rgba(169,167,189,0.75)';
      ctx.font = '400 17px Inter, sans-serif';
      ctx.fillText(truncateText(ctx, item.notes, 420), LEFT + 60, y + 28);
    }
    ctx.restore();

    ctx.save();      ctx.fillStyle = '#f2f1ed';
      ctx.font = '700 26px Sora, Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(money(item.qty * item.unitPrice), RIGHT, y + 2);
      ctx.restore();


    y += item.notes ? 74 : 64;
  });
  if (extraItems > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(169,167,189,0.85)';
    ctx.font = '500 19px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`+${extraItems} ${tr('room.itemsCount')}`, LEFT, y);
    ctx.restore();
    y += 40;
  }

  // Subtotal
  dashedH(ctx, LEFT, RIGHT, y + 16);
  y += 40;
  ctx.save();
  ctx.fillStyle = 'rgba(169,167,189,0.9)';
  ctx.font = '500 21px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tr('person.subtotal'), LEFT, y);
  ctx.fillStyle = '#f2f1ed';
  ctx.font = '600 24px Sora, Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(money(summary.subtotal), RIGHT, y);
  ctx.restore();
  y += 44;

  // ---- Divisão individual ----
  if (people.length > 0) {
    y += 44;
    sectionTitle(ctx, tr('close.eachPays'), LEFT, y);
    y += 46;
    people.forEach((p, i) => {
      const participant = room.participants.find((x) => x.id === p.participantId);
      const color = participant?.color ?? '#8b7ce8';
      ctx.save();
      ctx.beginPath();
      ctx.arc(LEFT + 7, y - 7, 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#f2f1ed';
      ctx.font = '500 22px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(truncateText(ctx, participant?.name ?? '?', 420), LEFT + 24, y);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#f2f1ed';
      ctx.font = '700 30px Sora, Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(money(p.total), RIGHT, y);
      ctx.restore();
      if (i < people.length - 1) dashedH(ctx, LEFT + 24, RIGHT, y + 34);
      y += 60;
    });
    if (extraPeople > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(169,167,189,0.85)';
      ctx.font = '500 20px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`+${extraPeople} ${tr('room.participants')}`, LEFT + 24, y + 20);
      ctx.restore();
      y += 40;
    }
  }

  // ---- Taxas e descontos ----
  if (fees.length > 0) {
    y += 44;
    sectionTitle(ctx, tr('fees.title'), LEFT, y);
    y += 46;
    fees.forEach((row, i) => {
      ctx.save();
      ctx.fillStyle = 'rgba(169,167,189,0.95)';
      ctx.font = '500 21px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(row.label, LEFT, y);
      ctx.fillStyle = '#f2f1ed';
      ctx.font = '600 23px Sora, Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(money(row.value), RIGHT, y);
      ctx.restore();
      if (i < fees.length - 1) dashedH(ctx, LEFT, RIGHT, y + 30);
      y += 52;
    });
  }

  // ---- Total final ----
  y += 40;
  dashedH(ctx, LEFT, RIGHT, y);
  y += 42;
  ctx.save();
  ctx.fillStyle = '#f2f1ed';
  ctx.font = '600 22px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tr('close.total'), LEFT, y);
  ctx.font = '800 46px Sora, Inter, sans-serif';
  ctx.fillStyle = '#a79bf2';
  ctx.textAlign = 'right';
  ctx.fillText(money(summary.total), RIGHT, y);
  ctx.restore();
  y += 64;

  // ---- Assinatura ----
  y += 26;
  dashedH(ctx, LEFT, RIGHT, y);
  y += 48;
  ctx.save();
  const sig = tr('close.signature');
  ctx.font = '700 26px Sora, Inter, sans-serif';
  const sigW = ctx.measureText(sig).width;
  const startX = CW - (38 + 16 + sigW) / 2;
  roundRectPath(ctx, startX, y - 30, 38, 38, 12);
  const sigGrad = ctx.createLinearGradient(startX, y - 30, startX + 38, y + 8);
  sigGrad.addColorStop(0, '#7a6cf2');
  sigGrad.addColorStop(1, '#5b8cff');
  ctx.fillStyle = sigGrad;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX + 9, y - 19);
  ctx.lineTo(startX + 29, y - 19);
  ctx.moveTo(startX + 9, y - 12);
  ctx.lineTo(startX + 29, y - 12);
  ctx.moveTo(startX + 9, y - 5);
  ctx.lineTo(startX + 20, y - 5);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#a79bf2';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(sig, startX + 38 + 16, y - 11);
  ctx.restore();

  y += 52;
  ctx.save();
  ctx.fillStyle = 'rgba(169,167,189,0.75)';
  ctx.font = '400 17px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(truncateText(ctx, tr('app.slogan'), 700), CW, y);
  ctx.restore();
  y += 40;

  return y;
}

/**
 * Renderiza a conta fechada como PNG premium (recibo escuro).
 * Retorna o Blob da imagem — a UI decide salvar/compartilhar.
 */
export async function renderBillImage(room: Room, summary: BillSummary, lang: Lang): Promise<Blob | null> {
  try {
    await document.fonts.ready;
  } catch {
    /* segue com as fontes de fallback */
  }

  const W = EXPORT_WIDTH;

  // Passada de medição: descobre a altura real do conteúdo sem recortar nada.
  const probe = document.createElement('canvas');
  probe.width = W * EXPORT_SCALE;
  probe.height = 6000 * EXPORT_SCALE;
  const pctx = probe.getContext('2d');
  if (!pctx) return null;
  pctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  const endY = drawBill(pctx, room, summary, lang, 6000);
  const height = Math.ceil(endY + 30);

  const canvas = document.createElement('canvas');
  canvas.width = W * EXPORT_SCALE;
  canvas.height = height * EXPORT_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  drawBill(ctx, room, summary, lang, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/** Baixa um Blob como arquivo. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Compartilha um Blob de imagem (nativo quando possível, senão baixa). */
export async function shareImageBlob(
  blob: Blob,
  filename: string,
  title: string,
): Promise<'shared' | 'downloaded' | 'failed'> {
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return 'shared';
    }
  } catch {
    return 'failed';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

// ------------------------------------------------------------
// Mini-recibo (papel cream) — momento de impressão no fechamento
// ------------------------------------------------------------

const MINI_W = 520;
const MINI_SCALE = 2;
const MINI_PAD = 40;

function drawMiniReceipt(
  ctx: CanvasRenderingContext2D,
  room: Room,
  summary: BillSummary,
  lang: Lang,
  H: number,
): number {
  const tr = (k: string, p?: Record<string, string | number>) => t(lang, k, p);
  const money = (c: number) => formatMoney(c, room.currency);

  const W = MINI_W;
  const LEFT = MINI_PAD;
  const RIGHT = W - MINI_PAD;
  const CW = W / 2;
  const items = room.items.slice(0, 4);
  const extraItems = room.items.length - items.length;
  const people = summary.perPerson.slice(0, 6);
  const extraPeople = summary.perPerson.length - people.length;
  const fees: FeeRow[] = [];
  if (summary.discount) fees.push({ label: tr('person.discount'), value: -summary.discount });
  if (summary.coupon) fees.push({ label: tr('person.coupon'), value: -summary.coupon });
  if (summary.serviceFee) fees.push({ label: tr('person.serviceFee'), value: summary.serviceFee });
  if (summary.couvert) fees.push({ label: tr('person.couvert'), value: summary.couvert });

  const INK = '#201d2b';
  const INK2 = 'rgba(32,29,43,0.66)';
  const INK3 = 'rgba(32,29,43,0.45)';
  const VIOLET = '#6d5ef0';

  const inkDash = (y: number) => {
    ctx.save();
    ctx.strokeStyle = INK3;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(LEFT, y);
    ctx.lineTo(RIGHT, y);
    ctx.stroke();
    ctx.restore();
  };

  // ---- Papel cream com borda perfurada ----
  const paper = ctx.createLinearGradient(0, 0, 0, H);
  paper.addColorStop(0, '#fbf8f1');
  paper.addColorStop(1, '#f0eadd');
  ctx.fillStyle = paper;
  receiptCardPath(ctx, 0, 0, W, H, 26, 16, 11);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = 'rgba(90,80,60,0.22)';
  ctx.lineWidth = 2;
  receiptCardPath(ctx, 0, 0, W, H, 26, 16, 11);
  ctx.stroke();
  ctx.restore();

  let y = 0;

  // ---- Cabeçalho: marca + nome + status ----
  y = 46;
  roundRectPath(ctx, LEFT, y - 34, 46, 46, 13);
  const markG = ctx.createLinearGradient(LEFT, y - 34, LEFT + 46, y + 12);
  markG.addColorStop(0, '#7a6cf2');
  markG.addColorStop(1, '#5b8cff');
  ctx.fillStyle = markG;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(LEFT + 12, y - 21);
  ctx.lineTo(LEFT + 34, y - 21);
  ctx.moveTo(LEFT + 12, y - 12);
  ctx.lineTo(LEFT + 34, y - 12);
  ctx.moveTo(LEFT + 12, y - 3);
  ctx.lineTo(LEFT + 25, y - 3);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = '800 26px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(tr('app.name'), LEFT + 62, y - 3);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'right';
  ctx.fillStyle = VIOLET;
  ctx.font = '700 14px Sora, Inter, sans-serif';
  ctx.fillText(tr('close.closed').toUpperCase(), RIGHT, y - 16);
  ctx.fillStyle = INK2;
  ctx.font = '400 12.5px Inter, sans-serif';
  const dateStr = new Date(room.closedAt ?? room.createdAt).toLocaleString(lang, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  ctx.fillText(dateStr, RIGHT, y + 4);
  ctx.restore();

  // ---- Mesa ----
  y += 42;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = '700 26px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(truncateText(ctx, room.tableName, 320), LEFT, y);
  ctx.restore();
  y += 30;
  const meta = [room.restaurant, `Código ${room.code}`].filter(Boolean).join('   ·   ');
  ctx.save();
  ctx.fillStyle = INK2;
  ctx.font = '400 14px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(truncateText(ctx, meta, 360), LEFT, y);
  ctx.restore();

  // ---- Total — o protagonista ----
  y += 34;
  inkDash(y);
  y += 34;
  ctx.save();
  ctx.fillStyle = INK3;
  ctx.font = '600 14px Sora, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tr('close.total').toUpperCase(), CW, y);
  ctx.restore();
  y += 44;
  ctx.save();
  ctx.font = '800 58px Sora, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const valStr = money(summary.total);
  const valGrad = ctx.createLinearGradient(CW - 140, 0, CW + 140, 0);
  valGrad.addColorStop(0, '#8a6cf2');
  valGrad.addColorStop(0.5, '#6d5ef0');
  valGrad.addColorStop(1, '#5b8cff');
  ctx.fillStyle = valGrad;
  ctx.fillText(truncateText(ctx, valStr, 400), CW, y);
  ctx.restore();
  y += 56;

  // ---- Participantes ----
  y += 26;
  inkDash(y);
  y += 34;
  ctx.save();
  ctx.fillStyle = VIOLET;
  ctx.font = '700 15px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(tr('room.participants').toUpperCase(), LEFT, y);
  ctx.restore();
  y += 26;
  people.forEach((p) => {
    const participant = room.participants.find((x) => x.id === p.participantId);
    ctx.save();
    ctx.beginPath();
    ctx.arc(LEFT + 7, y - 9, 7, 0, Math.PI * 2);
    ctx.fillStyle = participant?.color ?? VIOLET;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = INK;
    ctx.font = '500 17px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(truncateText(ctx, participant?.name ?? '?', 260), LEFT + 24, y);
    ctx.fillStyle = INK;
    ctx.font = '700 17px Sora, Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(money(p.total), RIGHT, y);
    ctx.restore();
    y += 32;
  });
  if (extraPeople > 0) {
    ctx.save();
    ctx.fillStyle = INK3;
    ctx.font = '500 14px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`+${extraPeople} ${tr('room.participants')}`, LEFT + 24, y);
    ctx.restore();
    y += 26;
  }

  // ---- Pedidos ----
  y += 12;
  inkDash(y);
  y += 34;
  ctx.save();
  ctx.fillStyle = VIOLET;
  ctx.font = '700 15px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tr('room.orders').toUpperCase(), LEFT, y);
  ctx.restore();
  y += 28;
  items.forEach((item) => {
    roundRectPath(ctx, LEFT, y - 31, 30, 30, 9);
    ctx.fillStyle = '#ece6d8';
    ctx.fill();
    ctx.save();
    ctx.fillStyle = VIOLET;
    ctx.font = '700 15px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(item.qty), LEFT + 15, y - 16);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = INK;
    ctx.font = '600 17px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(truncateText(ctx, item.name, 260), LEFT + 44, y - 2);
    ctx.fillStyle = INK;
    ctx.font = '700 17px Sora, Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(money(item.qty * item.unitPrice), RIGHT, y - 2);
    ctx.restore();
    y += 40;
  });
  if (extraItems > 0) {
    ctx.save();
    ctx.fillStyle = INK3;
    ctx.font = '500 14px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`+${extraItems} ${tr('room.itemsCount')}`, LEFT, y);
    ctx.restore();
    y += 26;
  }

  // ---- Subtotal + taxas ----
  y += 12;
  inkDash(y);
  y += 30;
  const rows: FeeRow[] = [{ label: tr('person.subtotal'), value: summary.subtotal }, ...fees];
  rows.forEach((row) => {
    ctx.save();
    ctx.fillStyle = row.value < 0 ? INK3 : INK2;
    ctx.font = '500 15px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(truncateText(ctx, row.label, 240), LEFT, y);
    ctx.fillStyle = INK;
    ctx.font = '600 16px Sora, Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(money(row.value), RIGHT, y);
    ctx.restore();
    y += 30;
  });

  // ---- Total final ----
  y += 4;
  inkDash(y);
  y += 34;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = '700 18px Sora, Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tr('close.total'), LEFT, y);
  ctx.fillStyle = VIOLET;
  ctx.font = '800 30px Sora, Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(money(summary.total), RIGHT, y);
  ctx.restore();

  // ---- Perfuração + assinatura ----
  y += 36;
  inkDash(y);
  y += 40;
  const sig = tr('close.signature');
  ctx.save();
  ctx.font = '700 15px Sora, Inter, sans-serif';
  const sigW = ctx.measureText(sig).width;
  const startX = CW - (28 + 12 + sigW) / 2;
  roundRectPath(ctx, startX, y - 24, 28, 28, 8);
  const sigGrad = ctx.createLinearGradient(startX, y - 24, startX + 28, y + 4);
  sigGrad.addColorStop(0, '#7a6cf2');
  sigGrad.addColorStop(1, '#5b8cff');
  ctx.fillStyle = sigGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX + 7, y - 15);
  ctx.lineTo(startX + 21, y - 15);
  ctx.moveTo(startX + 7, y - 9);
  ctx.lineTo(startX + 21, y - 9);
  ctx.moveTo(startX + 7, y - 3);
  ctx.lineTo(startX + 14, y - 3);
  ctx.stroke();
  ctx.fillStyle = INK2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(sig, startX + 28 + 12, y - 10);
  ctx.restore();

  y += 46;
  return y;
}

/**
 * Gera o mini-recibo (papel cream) como data URL para exibição
 * imediata na tela — o momento de "impressão" do fechamento.
 */
export async function renderMiniReceipt(
  room: Room,
  summary: BillSummary,
  lang: Lang,
): Promise<string | null> {
  try {
    await document.fonts.ready;
  } catch {
    /* segue com as fontes de fallback */
  }

  const W = MINI_W;

  // Passada de medição: altura real sem cortar o zigzag inferior.
  const probe = document.createElement('canvas');
  probe.width = W * MINI_SCALE;
  probe.height = 2400 * MINI_SCALE;
  const pctx = probe.getContext('2d');
  if (!pctx) return null;
  pctx.scale(MINI_SCALE, MINI_SCALE);
  const endY = drawMiniReceipt(pctx, room, summary, lang, 2400);
  const height = Math.ceil(endY + 44);

  const canvas = document.createElement('canvas');
  canvas.width = W * MINI_SCALE;
  canvas.height = height * MINI_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(MINI_SCALE, MINI_SCALE);
  drawMiniReceipt(ctx, room, summary, lang, height);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Resumo em texto / PDF (mantidos)
// ------------------------------------------------------------

export function buildSummaryText(room: Room, summary: BillSummary, lang: Lang): string {
  const money = (c: number) => formatMoney(c, room.currency);
  const lines: string[] = [];
  lines.push(`🥂 ${room.tableName} — ${t(lang, 'app.name')}`);
  if (room.restaurant) lines.push(room.restaurant);
  lines.push(new Date(room.createdAt).toLocaleString(lang));
  lines.push('');
  lines.push(`—— ${t(lang, 'close.subtitle')} ——`);
  lines.push('');
  for (const p of summary.perPerson) {
    const participant = room.participants.find((x) => x.id === p.participantId);
    lines.push(`${participant?.name ?? '?'}: ${money(p.total)}`);
  }
  lines.push('');
  lines.push(`${t(lang, 'close.total')}: ${money(summary.total)}`);
  return lines.join('\n');
}

/** Exporta PDF via diálogo de impressão do navegador. */
export function exportPdf(room: Room, summary: BillSummary, lang: Lang): void {
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return;
  const money = (c: number) => formatMoney(c, room.currency);
  const rows = summary.perPerson
    .map((p) => {
      const participant = room.participants.find((x) => x.id === p.participantId);
      return `<tr><td>${escapeHtml(participant?.name ?? '?')}</td><td class="num">${money(p.total)}</td></tr>`;
    })
    .join('');
  win.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escapeHtml(room.tableName)}</title>
  <style>
    body{font-family:'Segoe UI',system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 20px;color:#1e2233}
    h1{font-size:22px;margin:0 0 4px} .sub{color:#667;margin-bottom:24px}
    table{width:100%;border-collapse:collapse} td{padding:8px 4px;border-bottom:1px solid #e5e7f0}
    td.num{text-align:right;font-weight:600} .total{font-size:18px;font-weight:700;margin-top:20px}
    .foot{margin-top:32px;color:#99a;font-size:12px}
  </style></head><body>
  <h1>🥂 ${escapeHtml(room.tableName)}</h1>
  <div class="sub">${room.restaurant ? escapeHtml(room.restaurant) + ' · ' : ''}${new Date(room.createdAt).toLocaleString(lang)}</div>
  <table>${rows}</table>
  <div class="total">${t(lang, 'close.total')}: ${money(summary.total)}</div>
  <div class="foot">${t(lang, 'app.slogan')}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
  </body></html>`);
  win.document.close();
}

/** Compartilha o resumo (API nativa ou fallback para clipboard). */
export async function shareSummary(
  room: Room,
  summary: BillSummary,
  lang: Lang,
): Promise<'shared' | 'copied' | 'failed'> {
  const text = buildSummaryText(room, summary, lang);
  if (navigator.share) {
    try {
      await navigator.share({ title: room.tableName, text });
      return 'shared';
    } catch {
      /* usuário cancelou */
      return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    vibrate([12, 50, 22]);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
