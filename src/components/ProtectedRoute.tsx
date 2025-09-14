import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserProfile } from '../lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredUserType?: UserProfile['user_type']
  requireAuth?: boolean
}

export default function ProtectedRoute({ 
  children, 
  requiredUserType, 
  requireAuth = true 
}: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  // 严格检查：必须同时有user和userProfile才算已登录
  if (requireAuth && (!user || !userProfile)) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // 只有在用户完全登录且有明确用户类型时才进行角色检查
  if (requiredUserType && user && userProfile && userProfile.user_type !== requiredUserType) {
    // 根据用户类型重定向到对应的首页
    const redirectPath = {
      customer: '/',
      merchant: '/merchant-admin',
      super_admin: '/super-admin'
    }[userProfile.user_type]
    
    return <Navigate to={redirectPath || '/'} replace />
  }

  return <>{children}</>
}

// 超级管理员路由保护组件
export function SuperAdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isSuperAdminLoggedIn = localStorage.getItem('super_admin_session') === 'true'

  if (!isSuperAdminLoggedIn) {
    return <Navigate to="/auth/super-admin" state={{ from: location }} replace />
  }

  return <>{children}</>
}