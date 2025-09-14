import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  session: Session | null
  loading: boolean
  profileError: string | null
  retryFetchProfile: () => Promise<void>
  signUp: (phone: string, password: string, name: string, userType: 'customer' | 'merchant') => Promise<{ error: any }>
  signIn: (phone: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (phone: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    
    // 获取初始会话
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            setLoading(false)
          }
          return
        }
        
        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          
          if (session?.user) {
            await fetchUserProfile(session.user.id)
          }
          
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }
    
    initializeAuth()

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth state changed:', {
        event,
        userId: session?.user?.id,
        hasSession: !!session,
        mounted
      })
      
      if (!mounted) {
        console.log('[AuthContext] Component unmounted, ignoring auth state change')
        return
      }
      
      if (event === 'SIGNED_OUT' || !session) {
        console.log('[AuthContext] User signed out or no session, clearing all state')
        // 登出或会话无效时，清除所有状态
        setSession(null)
        setUser(null)
        setUserProfile(null)
        setLoading(false)
        return
      }
      
      // 设置会话和用户状态
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        console.log('[AuthContext] User session found, fetching user profile')
        console.log('[AuthContext] Session details:', {
          userId: session.user.id,
          email: session.user.email,
          phone: session.user.phone,
          accessTokenPresent: !!session.access_token,
          refreshTokenPresent: !!session.refresh_token
        })
        
        // 不立即设置loading为false，等待fetchUserProfile完成
        try {
          await fetchUserProfile(session.user.id)
        } catch (error) {
          console.error('[AuthContext] Failed to fetch user profile in auth state change:', error)
          console.warn('[AuthContext] Critical failure in auth state change, signing out to prevent ghost state')
          
          // 如果获取用户配置失败，立即登出用户避免幽灵状态
          setSession(null)
          setUser(null)
          setUserProfile(null)
          setLoading(false)
          
          // 执行完整的登出流程
          try {
            await supabase.auth.signOut()
          } catch (signOutError) {
            console.error('[AuthContext] Error during emergency sign out:', signOutError)
          }
          
          return
        }
      } else {
        console.log('[AuthContext] No user in session, setting userProfile to null')
        setUserProfile(null)
      }
      
      // 只有在处理完用户配置后才设置loading为false
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (userId: string, retryCount = 0) => {
    if (profileLoading) {
      console.log('[AuthContext] fetchUserProfile already in progress, skipping')
      return // 防止重复请求
    }
    
    setProfileLoading(true)
    setProfileError(null) // 清除之前的错误
    
    try {
      console.log(`[AuthContext] Fetching user profile for userId: ${userId}, attempt: ${retryCount + 1}`)
      console.log('[AuthContext] Current session state:', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        accessToken: session?.access_token ? 'present' : 'missing'
      })
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('[AuthContext] Error fetching user profile:', {
          error,
          userId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          sessionExists: !!session,
          accessToken: session?.access_token ? 'present' : 'missing'
        })
        
        // 如果是权限错误，直接登出用户避免幽灵状态
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.warn('[AuthContext] Permission error detected, signing out user to prevent ghost state')
          await signOut()
          return
        }
        
        // 如果用户配置不存在（PGRST116），尝试创建用户配置
        if (error.code === 'PGRST116') {
          console.log('[AuthContext] User profile not found, attempting to create one')
          await createMissingUserProfile(userId)
          return
        }
        
        // 如果是网络错误或临时错误，尝试重试
        if (retryCount < 2 && (error.code === 'PGRST301' || error.message?.includes('network') || error.message?.includes('timeout'))) {
          console.log(`[AuthContext] Retrying fetchUserProfile, attempt ${retryCount + 2}`)
          setTimeout(() => {
            fetchUserProfile(userId, retryCount + 1)
          }, 1000 * (retryCount + 1)) // 递增延迟
          return
        }
        
        // 设置用户友好的错误信息
        let errorMessage = '获取用户信息失败'
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          errorMessage = '权限不足，请重新登录'
        } else if (error.code === 'PGRST116') {
          errorMessage = '用户配置不存在，请联系管理员'
        } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
          errorMessage = '网络连接失败，请检查网络后重试'
        }
        
        setProfileError(errorMessage)
        setUserProfile(null)
        
        return
      }

      console.log('[AuthContext] Successfully fetched user profile:', {
        userId: data.id,
        name: data.name,
        userType: data.user_type,
        phone: data.phone
      })
      setUserProfile(data)
      setProfileError(null) // 成功时清除错误
    } catch (error) {
      console.error('[AuthContext] Unexpected error fetching user profile:', {
        error,
        userId,
        retryCount,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      })
      
      // 对于意外错误，也尝试重试
      if (retryCount < 2) {
        console.log(`[AuthContext] Retrying fetchUserProfile after unexpected error, attempt ${retryCount + 2}`)
        setTimeout(() => {
          fetchUserProfile(userId, retryCount + 1)
        }, 1000 * (retryCount + 1))
        return
      }
      
      // 最终失败，设置错误信息并考虑登出用户
      console.warn('[AuthContext] All retry attempts failed, considering sign out to prevent ghost state')
      setProfileError('系统错误，请稍后重试')
      setUserProfile(null)
      
      // 如果多次重试都失败，可能是严重的系统问题，登出用户
      setTimeout(async () => {
        console.warn('[AuthContext] Signing out user due to persistent fetchUserProfile failures')
        await signOut()
      }, 2000)
    } finally {
      setProfileLoading(false)
    }
  }

  // 创建缺失的用户配置
  const createMissingUserProfile = async (userId: string) => {
    try {
      console.log('[AuthContext] Creating missing user profile for userId:', userId)
      
      // 从 auth.users 获取用户信息
      const { data: authUser } = await supabase.auth.getUser()
      
      if (!authUser.user) {
        console.error('[AuthContext] No auth user found when creating profile')
        await signOut()
        return
      }
      
      const userData = authUser.user.user_metadata || {}
      const profileData = {
        id: userId,
        phone: authUser.user.phone?.replace('+86', '') || '',
        name: userData.name || '用户',
        user_type: userData.user_type || 'customer'
      }
      
      console.log('[AuthContext] Creating profile with data:', profileData)
      
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert(profileData)
      
      if (insertError) {
        console.error('[AuthContext] Error creating missing profile:', insertError)
        setProfileError('无法创建用户配置，请重新登录')
        setTimeout(() => signOut(), 2000)
        return
      }
      
      console.log('[AuthContext] Successfully created missing user profile')
      // 重新获取用户配置
      await fetchUserProfile(userId)
      
    } catch (error) {
      console.error('[AuthContext] Error in createMissingUserProfile:', error)
      setProfileError('创建用户配置失败，请重新登录')
      setTimeout(() => signOut(), 2000)
    }
  }

  // 手动重试获取用户配置
  const retryFetchProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id)
    }
  }

  const signUp = async (phone: string, password: string, name: string, userType: 'customer' | 'merchant') => {
    try {
      console.log(`[AuthContext] Starting signUp process for ${userType}: ${name}, phone: ${phone}`)
      
      // 注册用户
      const { data, error } = await supabase.auth.signUp({
        phone: `+86${phone}`,
        password,
        options: {
          data: {
            name,
            user_type: userType
          }
        }
      })

      if (error) {
        console.error('[AuthContext] Auth signUp error:', {
          error,
          code: error.message,
          phone: `+86${phone}`,
          userType
        })
        return { error }
      }

      if (!data.user) {
        console.error('[AuthContext] No user data returned from signUp')
        return { error: new Error('注册失败：未返回用户数据') }
      }

      console.log(`[AuthContext] Auth user created successfully:`, {
        userId: data.user.id,
        phone: data.user.phone,
        confirmed: data.user.confirmed_at ? 'confirmed' : 'pending'
      })

      // 创建用户配置
      const profileData = {
        id: data.user.id,
        phone,
        name,
        user_type: userType
      }

      console.log('[AuthContext] Creating user profile:', profileData)
      
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert(profileData)

      if (profileError) {
        console.error('[AuthContext] Error creating user profile:', {
          error: profileError,
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          userId: data.user.id,
          profileData
        })
        
        // 如果用户配置创建失败，需要清理已创建的auth用户以避免数据不一致
        try {
          console.log('[AuthContext] Cleaning up auth user due to profile creation failure')
          await supabase.auth.admin.deleteUser(data.user.id)
        } catch (cleanupError) {
          console.error('[AuthContext] Failed to cleanup auth user:', cleanupError)
        }
        
        // 根据错误类型提供更具体的错误信息
        let errorMessage = '注册失败，请重试'
        if (profileError.code === '23505') {
          errorMessage = '该手机号已被注册，请直接登录'
        } else if (profileError.code === '42501') {
          errorMessage = '权限不足，请联系管理员'
        } else if (profileError.message?.includes('duplicate key')) {
          errorMessage = '该手机号已被注册，请直接登录'
        }
        
        return { error: new Error(errorMessage) }
      }

      console.log(`[AuthContext] User profile created successfully for ${userType}: ${name}`)
      return { error: null }
    } catch (error) {
      console.error('[AuthContext] Unexpected error in signUp:', {
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        phone,
        name,
        userType
      })
      return { error: error instanceof Error ? error : new Error('注册过程中发生未知错误') }
    }
  }

  const signIn = async (phone: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: `+86${phone}`,
        password
      })

      if (error) {
        return { error }
      }

      // 简化登录流程，让onAuthStateChange处理用户配置获取
      // 如果用户配置不存在，fetchUserProfile会设置userProfile为null
      // ProtectedRoute会处理这种情况
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = async () => {
    try {
      console.log('Starting sign out process')
      
      // 立即清除本地状态
      setUser(null)
      setUserProfile(null)
      setSession(null)
      setLoading(false)
      
      // 清除所有本地存储
      localStorage.removeItem('super_admin_session')
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.clear()
      
      // 执行Supabase登出
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Error signing out from Supabase:', error)
      } else {
        console.log('Successfully signed out from Supabase')
      }
      
      // 强制刷新页面以确保完全清除状态
      setTimeout(() => {
        window.location.href = '/auth/login'
      }, 100)
      
    } catch (error) {
      console.error('Sign out error:', error)
      // 强制清除所有状态并跳转
      setUser(null)
      setUserProfile(null)
      setSession(null)
      setLoading(false)
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/auth/login'
    }
  }

  const resetPassword = async (phone: string) => {
    try {
      // 注意：Supabase目前主要支持邮箱重置密码
      // 这里我们可以实现一个自定义的手机号重置逻辑
      // 或者引导用户联系客服
      console.log('Phone password reset not implemented yet:', phone)
      return { error: new Error('手机号密码重置功能暂未实现，请联系客服') }
    } catch (error) {
      return { error }
    }
  }

  const value = {
    user,
    userProfile,
    session,
    loading,
    profileError,
    retryFetchProfile,
    signUp,
    signIn,
    signOut,
    resetPassword
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}