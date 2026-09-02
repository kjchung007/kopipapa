import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const toHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder()
  const a = encoder.encode(left.toLowerCase())
  const b = encoder.encode(right.toLowerCase())
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index]
  return difference === 0
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const rawBody = await request.text()
  const receivedSignature = request.headers.get('Hitpay-Signature') ?? request.headers.get('hitpay-signature') ?? ''
  const salt = Deno.env.get('HITPAY_SALT') ?? ''
  if (!receivedSignature || !salt) return json({ error: 'Webhook signature is missing.' }, 401)

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const computedSignature = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))
  if (!constantTimeEqual(computedSignature, receivedSignature)) {
    console.warn('Rejected HitPay webhook with invalid signature.')
    return json({ error: 'Invalid signature.' }, 401)
  }

  let payload: { id?: string; status?: string; amount?: string | number; currency?: string; reference_number?: string; payments?: Array<{ payment_type?: string }> }
  try { payload = JSON.parse(rawBody) } catch { return json({ error: 'Invalid JSON payload.' }, 400) }
  if (!payload.id) return json({ error: 'Payment request ID is missing.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Webhook service is not configured.' }, 503)
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { data: order, error: orderError } = await admin.from('orders')
    .select('id,final_total,payment_status,payment_method')
    .eq('hitpay_payment_request_id', payload.id)
    .single()
  if (orderError || !order) return json({ error: 'Matching order was not found.' }, 404)

  const paymentStatus = String(payload.status ?? '').toLowerCase()
  if (paymentStatus !== 'completed') {
    const terminalStatus = paymentStatus === 'canceled' || paymentStatus === 'expired' || paymentStatus === 'inactive' ? 'cancelled' : paymentStatus === 'failed' ? 'failed' : null
    if (!terminalStatus) return json({ received: true })
    const { error: terminalError } = await admin.from('orders').update({ payment_status: terminalStatus })
      .eq('id', order.id).eq('payment_status', 'pending')
    if (terminalError) return json({ error: 'Payment failure could not be recorded.' }, 500)
    return json({ received: true, payment_status: terminalStatus })
  }

  const paidCents = Math.round(Number(payload.amount) * 100)
  if (payload.currency?.toUpperCase() !== 'MYR' || !Number.isFinite(paidCents) || paidCents !== order.final_total) {
    console.error('HitPay amount/currency mismatch', { orderId: order.id, paidCents, currency: payload.currency })
    return json({ error: 'Payment amount or currency mismatch.' }, 409)
  }
  if (order.payment_status === 'paid') return json({ received: true, duplicate: true })

  const actualMethod = payload.payments?.[0]?.payment_type
  if (actualMethod && actualMethod !== order.payment_method) {
    console.error('HitPay method mismatch', { orderId: order.id, expected: order.payment_method, actual: actualMethod })
    return json({ error: 'Payment method mismatch.' }, 409)
  }

  const { error: updateError } = await admin.from('orders').update({
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
  }).eq('id', order.id).neq('payment_status', 'paid')
  if (updateError) {
    console.error('Could not mark order paid', updateError)
    return json({ error: 'Order payment could not be recorded.' }, 500)
  }

  return json({ received: true })
})
