// ============================================================
// Divide Aê! — Cloud Functions de referência
// 1. calculateBill: cálculo da conta no servidor (mesma lógica do app)
// 2. cleanupRooms: remove salas abertas por mais de 24h (controle de custo)
// ============================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Distribuição exata de centavos (método do maior resto) — espelho de src/domain/split.ts
function fairSplit(totalCents, weights) {
  const n = weights.length;
  if (n === 0) return [];
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    const base = Math.floor(totalCents / n);
    const rest = totalCents - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
  }
  const raw = weights.map((w) => (totalCents * w) / sumW);
  const floors = raw.map(Math.floor);
  let remaining = totalCents - floors.reduce((a, b) => a + b, 0);
  if (remaining < 0) remaining = 0;
  const idx = raw.map((r, i) => ({ r: r - Math.floor(r), i })).sort((a, b) => b.r - a.r);
  const result = [...floors];
  for (let k = 0; k < remaining && k < idx.length; k++) result[idx[k].i] += 1;
  return result;
}

function itemTotal(item) {
  return Math.round(item.unitPrice * item.qty);
}

/** Cálculo completo da conta — mesma invariante do app: soma individual == total. */
function computeBill(room) {
  const participants = room.participants.map((p) => p.id);
  const subtotal = room.items.reduce((acc, item) => acc + itemTotal(item), 0);

  const perPerson = {};
  participants.forEach((pid) => (perPerson[pid] = 0));
  room.items.forEach((item) => {
    if (item.splitType === 'single') {
      perPerson[item.ownerId] = (perPerson[item.ownerId] || 0) + itemTotal(item);
    } else {
      const quantities = item.shares
        .filter((s) => s.qty > 0)
        .map((s) => Math.round(s.qty * 100));
      const parts = fairSplit(itemTotal(item), quantities);
      item.shares
        .filter((s) => s.qty > 0)
        .forEach((s, i) => (perPerson[s.participantId] = (perPerson[s.participantId] || 0) + parts[i]));
    }
  });

  const fees = room.fees || {};
  let discount = 0;
  if (fees.discount) {
    discount =
      fees.discount.type === 'percent'
        ? Math.round((subtotal * fees.discount.value) / 100)
        : Math.min(fees.discount.value, subtotal);
  }
  let coupon = fees.couponPct ? Math.round((subtotal * fees.couponPct) / 100) : 0;
  if (discount + coupon > subtotal) discount = Math.max(0, discount - (discount + coupon - subtotal));
  const afterDiscount = subtotal - discount - coupon;
  const serviceFee = fees.serviceFeePct ? Math.round((afterDiscount * fees.serviceFeePct) / 100) : 0;
  const couvert = (fees.couvertPerPerson || 0) * participants.length;
  const total = afterDiscount + serviceFee + couvert;

  const weights = participants.map((pid) => Math.max(0, perPerson[pid]));
  const dParts = fairSplit(discount, weights);
  const cParts = fairSplit(coupon, weights);
  const fBasis = participants.map((pid, i) => Math.max(0, perPerson[pid] - dParts[i] - cParts[i]));
  const fParts = fairSplit(serviceFee, fBasis);
  const coParts = fairSplit(couvert, participants.map(() => 1));

  return {
    subtotal,
    discount,
    coupon,
    serviceFee,
    couvert,
    total,
    perPerson: participants.map((pid, i) => ({
      participantId: pid,
      itemsTotal: perPerson[pid],
      discount: dParts[i],
      coupon: cParts[i],
      serviceFee: fParts[i],
      couvert: coParts[i],
      total: perPerson[pid] - dParts[i] - cParts[i] + fParts[i] + coParts[i],
    })),
  };
}

// 1) Cálculo no servidor (chamável por HTTP) — útil para integrações de PDV
exports.calculateBill = functions.https.onCall(async (data) => {
  if (!data || !data.code) throw new functions.https.HttpsError('invalid-argument', 'code obrigatório');
  const snap = await admin.firestore().collection('rooms').doc(data.code).get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Sala não encontrada');
  return computeBill(snap.data());
});

// 2) Limpeza: salas abertas há mais de 24h são arquivadas (custo zero)
exports.cleanupRooms = functions.pubsub.schedule('every 6 hours').onRun(async () => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const rooms = await admin
    .firestore()
    .collection('rooms')
    .where('status', '==', 'open')
    .where('createdAt', '<', cutoff)
    .get();
  const batch = admin.firestore().batch();
  rooms.docs.forEach((doc) => batch.update(doc.ref, { status: 'closed', closedAt: Date.now() }));
  await batch.commit();
  console.log(`cleanupRooms: ${rooms.size} salas arquivadas`);
});
