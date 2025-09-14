import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

interface SubscriptionOptions {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  schema?: string
  filter?: string
}

export function useSupabaseSubscription(
  options: SubscriptionOptions,
  callback: (payload: any) => void,
  dependencies: any[] = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const { table, event = '*', schema = 'public', filter } = options
    
    // 创建频道
    const channel = supabase.channel(`${table}-changes`)
    
    // 配置订阅
    channel.on(
      'postgres_changes' as any,
      {
        event,
        schema,
        table,
        ...(filter && { filter })
      },
      callback
    )
    
    // 订阅频道
    channel.subscribe()
    
    channelRef.current = channel
    
    // 清理函数
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, dependencies)

  // 手动取消订阅
  const unsubscribe = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }

  return { unsubscribe }
}

// 订阅订单状态变化的专用hook
export function useOrderSubscription(
  userId: string,
  onOrderUpdate: (payload: any) => void
) {
  return useSupabaseSubscription(
    {
      table: 'orders',
      event: 'UPDATE',
      filter: `customer_id=eq.${userId}`
    },
    onOrderUpdate,
    [userId]
  )
}

// 订阅商家新订单的专用hook
export function useMerchantOrderSubscription(
  merchantId: string,
  onNewOrder: (payload: any) => void
) {
  return useSupabaseSubscription(
    {
      table: 'orders',
      event: 'INSERT',
      filter: `merchant_id=eq.${merchantId}`
    },
    onNewOrder,
    [merchantId]
  )
}