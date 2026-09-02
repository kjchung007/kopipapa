import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export type Store = {
  id: number
  name: string
  address: string
  phone: string
  preparation_minutes: number
  minutes_per_cup: number
  buffer_minutes: number
  accepting_pickup: boolean
  opening_time: string
  closing_time: string
  image_url?: string | null
}

type StoreContextValue = {
  stores: Store[]
  selectedStore: Store | null
  loadingStores: boolean
  storeError: string
  selectStore: (store: Store) => void
  reloadStores: () => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)
const storageKey = 'kopi-papa-selected-store'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<Store | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) as Store : null
    } catch {
      return null
    }
  })
  const [loadingStores, setLoadingStores] = useState(true)
  const [storeError, setStoreError] = useState('')

  async function reloadStores() {
    setLoadingStores(true)
    setStoreError('')
    let { data, error } = await supabase
      .from('stores')
      .select('id,name,address,phone,preparation_minutes,minutes_per_cup,buffer_minutes,accepting_pickup,opening_time,closing_time,image_url')
      .eq('active', true)
      .order('name')
    if (error && /opening_time|closing_time|schema cache/i.test(error.message)) {
      const legacy = await supabase
        .from('stores')
        .select('id,name,address,phone,preparation_minutes,minutes_per_cup,buffer_minutes,accepting_pickup,image_url')
        .eq('active', true)
        .order('name')
      data = legacy.data?.map(store => ({ ...store, opening_time:'10:00:00', closing_time:'22:00:00' })) ?? null
      error = legacy.error
    }
    if (error) setStoreError(error.message)
    else {
      const next = (data ?? []) as Store[]
      setStores(next)
      setSelectedStore(current => current ? next.find(store => store.id === current.id) ?? null : null)
    }
    setLoadingStores(false)
  }

  useEffect(() => {
    void reloadStores()
    const channel = supabase.channel('customer-stores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => void reloadStores())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  function selectStore(store: Store) {
    setSelectedStore(store)
    localStorage.setItem(storageKey, JSON.stringify(store))
  }

  const value = useMemo(() => ({ stores, selectedStore, loadingStores, storeError, selectStore, reloadStores }), [stores, selectedStore, loadingStores, storeError])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
