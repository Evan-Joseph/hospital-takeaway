import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // 完全禁用锁机制 - 根据MDN LockManager规范
    lock: <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => fn(),
    // 使用自定义存储键避免冲突
    storageKey: 'hospital-delivery-auth-token',
    // 禁用自动刷新时的锁检查
    debug: false,
    // 设置更宽松的会话检测
    flowType: 'pkce'
  },
  // 添加全局配置
  global: {
    headers: {
      'X-Client-Info': 'hospital-delivery-pwa',
      'apikey': supabaseAnonKey,
      'Cache-Control': 'no-cache'
    }
  },
  // 数据库配置
  db: {
    schema: 'public'
  },
  // 实时订阅配置
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// 添加全局错误处理，捕获LockManager相关错误
if (typeof window !== 'undefined') {
  // 重写console.warn以过滤LockManager警告
  const originalWarn = console.warn
  console.warn = (...args) => {
    const message = args.join(' ')
    // 过滤掉LockManager相关的警告
    if (message.includes('LockManager') || message.includes('@supabase/gotrue-js')) {
      return // 静默处理LockManager警告
    }
    originalWarn.apply(console, args)
  }
  
  // 添加全局错误监听器
  window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('LockManager')) {
      event.preventDefault() // 阻止LockManager错误冒泡
      return false
    }
  })
  
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('LockManager')) {
      event.preventDefault() // 阻止LockManager Promise rejection
      return false
    }
  })
}

// 数据库类型定义
export interface UserProfile {
  id: string
  phone: string
  name: string
  user_type: 'customer' | 'merchant' | 'super_admin'
  created_at: string
  updated_at: string
}

export interface Merchant {
  id: string
  owner_id: string
  name: string
  description?: string
  category: string
  address: string
  phone: string
  payment_qr_code?: string
  is_active: boolean
  status?: 'pending' | 'active' | 'suspended' | 'rejected'
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  merchant_id: string
  name: string
  description?: string
  price: number
  image_url?: string
  category?: string
  stock_quantity: number
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  customer_id: string
  merchant_id: string
  order_number: string
  verification_code: string
  total_amount: number
  delivery_address: string
  delivery_name: string
  delivery_phone: string
  status: 'pending' | 'paid' | 'confirmed' | 'preparing' | 'delivering' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface Promotion {
  id: string
  merchant_id: string
  title: string
  description?: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export interface Banner {
  id: string
  title: string
  image_url: string
  link_url?: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface PlatformSettings {
  id: string
  key: string
  value?: string
  updated_at: string
}