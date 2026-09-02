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
      console.error('Required payment environment variables are missing.')
      return json({ error: 'Payment service is not configured.' }, 503)
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const token = authorization.slice('Bearer '.length)
    const { data: authData, error: authError } = await userClient.auth.getUser(token)
    if (authError || !authData.user || authData.user.is_anonymous) return json({ error: 'Your verified session has expired. Please sign in again.' }, 401)

    const body = await request.json().catch(() => null) as { order_id?: number; total_amount?: number; payment_method?: string; fpx_bank?: string | null } | null
    const orderId = Number(body?.order_id)
    const suppliedAmount = Number(body?.total_amount)
    const paymentMethod = body?.payment_method
    const fpxBank = body?.fpx_bank ?? null
    const allowedFpxBanks = new Set(['maybank2u','cimb_clicks','public_bank','rhb_now','hong_leong','ambank','bank_islam'])
    if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isFinite(suppliedAmount)) {
      return json({ error: 'A valid order and amount are required.' }, 400)
    }
    if (paymentMethod !== 'fpx' && paymentMethod !== 'touch_n_go') {
      return json({ error: 'Choose FPX or Touch n Go.' }, 400)
    }
    if (paymentMethod === 'fpx' && (!fpxBank || !allowedFpxBanks.has(fpxBank))) {
      return json({ error: 'Choose a valid FPX bank.' }, 400)
    }
    if (paymentMethod !== 'fpx' && fpxBank) return json({ error: 'A bank can only be selected for FPX.' }, 400)

    const { data: order, error: orderError } = await userClient
      .from('orders')
      .select('id,order_number,user_id,customer_name,customer_email,final_total,payment_status,payment_method,hitpay_payment_request_id,hitpay_checkout_url')
      .eq('id', orderId)
      .eq('user_id', authData.user.id)
      .single()
    if (orderError || !order) return json({ error: 'Order not found.' }, 404)
    if (order.payment_status === 'paid') return json({ error: 'This order has already been paid.' }, 409)

    const authoritativeAmount = order.final_total / 100
    if (Math.abs(authoritativeAmount - suppliedAmount) > 0.0001) {
      return json({ error: 'The checkout total changed. Please review your order again.' }, 409)
    }
    if (order.payment_method !== paymentMethod) {
      return json({ error: 'The selected payment method does not match this order.' }, 409)
    }
    if (order.hitpay_payment_request_id && order.hitpay_checkout_url) {
      return json({ url: order.hitpay_checkout_url, payment_request_id: order.hitpay_payment_request_id })
    }

    const appUrl = (Deno.env.get('APP_URL') || request.headers.get('Origin') || '').replace(/\/$/, '')
    if (!appUrl) return json({ error: 'The payment return URL is not configured.' }, 503)
    const redirectUrl = `${appUrl}/?payment=return&order_id=${order.id}`
    const webhookUrl = `${supabaseUrl}/functions/v1/hitpay-webhook`

    const hitPayResponse = await fetch('https://api.sandbox.hit-pay.com/v1/payment-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BUSINESS-API-KEY': hitPayApiKey,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        amount: authoritativeAmount.toFixed(2),
        currency: 'MYR',
        payment_methods: [paymentMethod],
        purpose: `Kopi Papa order ${order.order_number}`,
        reference_number: order.order_number,
        redirect_url: redirectUrl,
        webhook: webhookUrl,
        allow_repeated_payments: false,
        send_email: false,
        metadata: { order_id: String(order.id), ...(fpxBank ? { fpx_bank: fpxBank } : {}) },
        ...(order.customer_email ? { email: order.customer_email } : {}),
        ...(order.customer_name ? { name: order.customer_name } : {}),
      }),
    })
    const hitPayData = await hitPayResponse.json().catch(() => ({})) as { id?: string; url?: string; message?: string; errors?: unknown }
    if (!hitPayResponse.ok || !hitPayData.id || !hitPayData.url) {
      console.error('HitPay payment request failed', hitPayResponse.status, hitPayData)
      return json({ error: hitPayData.message || 'HitPay could not start this payment.' }, 502)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { error: updateError } = await admin.from('orders').update({
      hitpay_payment_request_id: hitPayData.id,
      hitpay_checkout_url: hitPayData.url,
      payment_initiated_at: new Date().toISOString(),
      payment_bank: fpxBank,
    }).eq('id', order.id).eq('user_id', authData.user.id).eq('payment_status', 'pending')
    if (updateError) {
      console.error('Could not persist HitPay request', updateError)
      return json({ error: 'Payment was created but could not be attached to the order. Contact support.' }, 500)
    }

    return json({ url: hitPayData.url, payment_request_id: hitPayData.id })
  } catch (error) {
    console.error('create-hitpay-payment failed', error)
    return json({ error: 'Unable to start payment. Please try again.' }, 500)
  }
})
