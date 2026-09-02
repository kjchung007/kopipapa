import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const hitPayApiKey = Deno.env.get('HITPAY_API_KEY') ?? ''
    if (!supabaseUrl || !publishableKey || !serviceRoleKey || !hitPayApiKey) {
      return json({ error: 'Payment service is not configured.' }, 503)
    }

    const token = authorization.slice('Bearer '.length)
    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'Your session has expired.' }, 401)

    const body = await request.json().catch(() => null) as { order_id?: number } | null
    const orderId = Number(body?.order_id)
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return json({ error: 'A valid order is required.' }, 400)

    const { data: order, error: orderError } = await userClient.from('orders')
      .select('id,user_id,final_total,payment_status,payment_method,hitpay_payment_request_id')
      .eq('id', orderId).eq('user_id', authData.user.id).single()
    if (orderError || !order) return json({ error: 'Order not found.' }, 404)
    if (order.payment_status === 'paid') return json({ payment_status: 'paid' })
    if (!order.hitpay_payment_request_id) return json({ error: 'This order has no payment request.' }, 409)

    const hitPayResponse = await fetch(
      `https://api.sandbox.hit-pay.com/v1/payment-requests/${encodeURIComponent(order.hitpay_payment_request_id)}`,
      { headers: { 'X-BUSINESS-API-KEY': hitPayApiKey, 'X-Requested-With': 'XMLHttpRequest' } },
    )
    const payment = await hitPayResponse.json().catch(() => ({})) as {
      id?: string; status?: string; amount?: string; currency?: string; payment_methods?: string[]
    }
    if (!hitPayResponse.ok) {
      console.error('HitPay reconciliation request failed', hitPayResponse.status, payment)
      return json({ error: 'Payment status could not be checked.' }, 502)
    }

    const status = String(payment.status ?? '').toLowerCase()
    if (status !== 'completed') {
      const terminalStatus = status === 'canceled' || status === 'expired' || status === 'inactive' ? 'cancelled' : status === 'failed' ? 'failed' : null
      if (terminalStatus) {
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
        const { error: terminalError } = await admin.from('orders').update({ payment_status: terminalStatus })
          .eq('id', order.id).eq('hitpay_payment_request_id', order.hitpay_payment_request_id).eq('payment_status', 'pending')
        if (terminalError) return json({ error: 'Payment failure could not be recorded.' }, 500)
        return json({ payment_status: terminalStatus })
      }
      return json({ payment_status: 'pending' })
    }
    const amountCents = Math.round(Number(payment.amount) * 100)
    if (payment.id !== order.hitpay_payment_request_id || amountCents !== order.final_total || String(payment.currency).toUpperCase() !== 'MYR') {
      console.error('HitPay reconciliation validation mismatch', { orderId, paymentRequestId: payment.id, amountCents, currency: payment.currency })
      return json({ error: 'Payment details did not match the order.' }, 409)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { error: updateError } = await admin.from('orders').update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', order.id).eq('hitpay_payment_request_id', payment.id).eq('payment_status', 'pending')
    if (updateError) {
      console.error('Could not reconcile paid order', updateError)
      return json({ error: 'Payment was confirmed but the order could not be updated.' }, 500)
    }

    return json({ payment_status: 'paid' })
  } catch (error) {
    console.error('reconcile-hitpay-payment failed', error)
    return json({ error: 'Unable to verify payment.' }, 500)
  }
})
