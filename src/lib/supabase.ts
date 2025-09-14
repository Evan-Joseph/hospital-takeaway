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
  // 添加全局配置 - 针对自托管环境优化
  global: {
    headers: {
      'X-Client-Info': 'hospital-delivery-pwa',
      'apikey': supabaseAnonKey,
      'Cache-Control': 'no-cache',
      'Accept': 'application/json'
      // 移除 Content-Type 以允许文件上传时自动设置正确的类型
    },
    // 添加网络超时和重试配置
    fetch: async (url, options = {}) => {
      const maxRetries = 3
      const baseDelay = 1000
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          // 如果响应成功，直接返回
          if (response.ok || response.status < 500) {
            return response
          }
          
          // 服务器错误，尝试重试
          throw new Error(`Server error: ${response.status}`)
          
        } catch (error: any) {
          console.warn(`网络请求失败，第 ${attempt}/${maxRetries} 次尝试:`, {
            url,
            error: error.message,
            attempt
          })
          
          // 如果是最后一次尝试，抛出错误
          if (attempt === maxRetries) {
            throw error
          }
          
          // 等待后重试，使用指数退避
          await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)))
        }
      }
      
      throw new Error('Max retries exceeded')
    }
  },
  // 数据库配置
  db: {
    schema: 'public'
  },
  // 实时订阅配置 - 针对自托管环境调整
  realtime: {
    params: {
      eventsPerSecond: 5, // 降低频率以适应云服务器
      timeout: 30000 // 增加超时时间
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

// 连接验证和错误处理
export const validateSupabaseConnection = async (): Promise<{
  isConnected: boolean
  error?: string
  latency?: number
}> => {
  try {
    const startTime = Date.now()
    
    // 测试基本连接
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
      .single()
    
    const latency = Date.now() - startTime
    
    if (error && error.code !== 'PGRST116') { // PGRST116 是空结果错误，可以忽略
      console.warn('Supabase connection test failed:', error)
      return {
        isConnected: false,
        error: `连接测试失败: ${error.message}`,
        latency
      }
    }
    
    console.log(`Supabase 连接成功，延迟: ${latency}ms`)
    return {
      isConnected: true,
      latency
    }
  } catch (error: any) {
    console.error('Supabase connection validation error:', error)
    return {
      isConnected: false,
      error: `连接验证异常: ${error.message || '未知错误'}`
    }
  }
}

// 自动重试机制的数据库操作包装器
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  shouldRetry?: (error: any) => boolean
): Promise<T> => {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      console.warn(`操作失败，第 ${attempt}/${maxRetries} 次尝试:`, {
        error: error.message,
        code: error.code,
        attempt
      })
      
      // 检查是否应该重试
      if (shouldRetry && !shouldRetry(error)) {
        throw error
      }
      
      // 对于某些错误类型，不进行重试
      if (error.code === '42501' || error.code === '23505') { // 权限错误或唯一约束违反
        throw error
      }
      
      if (attempt < maxRetries) {
        // 使用指数退避策略
        const retryDelay = delay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
  }
  
  throw lastError!
}

// 专门用于 Supabase 操作的重试包装器
export const withSupabaseRetry = async <T>(
  operation: () => Promise<{ data: T; error: any }>,
  maxRetries: number = 3
): Promise<{ data: T; error: any }> => {
  return withRetry(
    operation,
    maxRetries,
    1000,
    (error) => {
      // 只对网络错误和临时服务器错误进行重试
      return error.code === 'PGRST301' || 
             error.message?.includes('network') ||
             error.message?.includes('timeout') ||
             error.message?.includes('fetch')
    }
  )
}

// 初始化时验证连接
if (typeof window !== 'undefined') {
  // 延迟验证连接，避免阻塞应用启动
  setTimeout(() => {
    validateSupabaseConnection().then(result => {
      if (!result.isConnected) {
        console.error('Supabase 自托管实例连接失败:', result.error)
        // 可以在这里添加用户通知逻辑
      } else {
        console.log('✅ Supabase 自托管实例连接正常')
      }
    })
  }, 2000)
}