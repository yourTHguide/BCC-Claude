import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday } from '@/lib/dates'
import { SMC_NEXT_EDITION, SMC_PRODUCT_SLUG } from '@/lib/smc/config'

export interface SmcBookableEvent {
  // null when the event could not be loaded from the database; the page then
  // shows the configured event details for review and keeps checkout closed.
  eventId: string | null
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  priceThb: number
  capacity: number | null
  remaining: number | null
  isOpen: boolean
  source: 'database' | 'config'
}

function configFallback(): SmcBookableEvent {
  return {
    eventId: null,
    date: SMC_NEXT_EDITION.date,
    startTime: SMC_NEXT_EDITION.startTime,
    priceThb: SMC_NEXT_EDITION.priceThb,
    capacity: SMC_NEXT_EDITION.capacity,
    remaining: null,
    isOpen: false,
    source: 'config',
  }
}

// Next open SMC event from Supabase (product slug 'smc'). Read-only.
// Price and availability shown here are informational; the checkout API
// re-resolves both inside the database before taking any payment.
export async function loadNextSmcEvent(): Promise<SmcBookableEvent> {
  try {
    const supabase = getServiceSupabase()
    const { data: product } = await supabase
      .from('products')
      .select('id, default_price, default_start_time')
      .eq('slug', SMC_PRODUCT_SLUG)
      .maybeSingle()
    if (!product) return configFallback()

    const { data: event } = await supabase
      .from('event_dates')
      .select('id, event_date, is_open, price_override, start_time_override, capacity')
      .eq('product_id', product.id)
      .gte('event_date', bangkokToday())
      .order('event_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!event) return configFallback()

    const { data: availability } = await supabase.rpc('smc_event_availability', { p_event_id: event.id })
    const row = Array.isArray(availability) ? availability[0] : availability

    return {
      eventId: event.id,
      date: event.event_date,
      startTime: String(event.start_time_override ?? product.default_start_time ?? SMC_NEXT_EDITION.startTime).slice(0, 5),
      priceThb: event.price_override ?? product.default_price ?? SMC_NEXT_EDITION.priceThb,
      capacity: event.capacity ?? null,
      remaining: row?.remaining ?? null,
      isOpen: event.is_open === true,
      source: 'database',
    }
  } catch (err) {
    console.error('loadNextSmcEvent failed:', err)
    return configFallback()
  }
}
