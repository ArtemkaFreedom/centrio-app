import { NextRequest, NextResponse } from 'next/server';

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY!;

const PLANS: Record<string, { amount: number; label: string }> = {
  month: { amount: 2.99,  label: 'Centrio Pro — 1 месяц' },
  year:  { amount: 19.99, label: 'Centrio Pro — 1 год' },
};

export async function POST(req: NextRequest) {
  try {
    const { userId, plan } = await req.json();

    if (!userId || !plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }

    const { amount, label } = PLANS[plan];
    const orderId = `${userId}_${plan}_${Date.now()}`;

    const res = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        order_id: orderId,
        order_description: label,
        ipn_callback_url: 'https://centrio.me/api/crypto-webhook',
        success_url: 'https://centrio.me/payment-success',
        cancel_url: 'https://centrio.me/pricing',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[NOWPayments] invoice error:', err);
      return NextResponse.json({ error: 'Payment service error' }, { status: 502 });
    }

    const invoice = await res.json();
    return NextResponse.json({ payment_url: invoice.invoice_url, order_id: orderId });
  } catch (e) {
    console.error('[create-crypto-payment]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
