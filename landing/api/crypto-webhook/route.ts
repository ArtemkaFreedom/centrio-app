import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET!;

// Activate Pro — replace with your actual DB logic
async function activatePro(userId: string, plan: string) {
  const expiresAt = plan === 'year'
    ? Date.now() + 365 * 24 * 60 * 60 * 1000
    : Date.now() + 30  * 24 * 60 * 60 * 1000;

  console.log(`[Crypto] Activate Pro: userId=${userId} plan=${plan} expires=${new Date(expiresAt).toISOString()}`);

  // TODO: write to your DB
  // await db.users.update({ where: { id: userId }, data: { pro: true, proExpiresAt: new Date(expiresAt) } });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();

    // Verify NOWPayments signature
    if (IPN_SECRET) {
      const sig = req.headers.get('x-nowpayments-sig');
      const sorted = JSON.stringify(
        Object.keys(JSON.parse(raw)).sort().reduce((acc: Record<string, unknown>, k) => {
          acc[k] = JSON.parse(raw)[k];
          return acc;
        }, {})
      );
      const expected = crypto.createHmac('sha512', IPN_SECRET).update(sorted).digest('hex');
      if (sig !== expected) {
        console.warn('[Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payment = JSON.parse(raw);
    console.log('[Webhook] status:', payment.payment_status, 'order:', payment.order_id);

    if (payment.payment_status === 'finished' || payment.payment_status === 'confirmed') {
      const parts = (payment.order_id as string).split('_');
      const userId = parts[0];
      const plan = parts[1];
      await activatePro(userId, plan);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[crypto-webhook]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
