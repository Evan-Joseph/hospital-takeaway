import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { EyeIcon, EyeSlashIcon, PhoneIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'sonner'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, user, userProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/'

  // 监听用户状态变化，登录成功后根据用户类型跳转
  useEffect(() => {
    if (user && userProfile && !loading) {
      // 根据用户类型决定跳转路径
      let targetPath = '/'
      
      if (userProfile.user_type === 'merchant') {
        targetPath = '/merchant-admin'
      } else if (userProfile.user_type === 'super_admin') {
        targetPath = '/super-admin'
      } else if (userProfile.user_type === 'customer') {
        // 如果有来源路径且不是登录页面，则跳转到来源路径
        targetPath = from === '/auth/login' ? '/' : from
      }
      
      console.log('Login success, redirecting to:', targetPath, 'User type:', userProfile.user_type)
      navigate(targetPath, { replace: true })
    }
  }, [user, userProfile, loading, navigate, from])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!phone || !password) {
      toast.error('请填写完整信息')
      return
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error('请输入正确的手机号')
      return
    }

    setLoading(true)
    
    try {
      const { error } = await signIn(phone, password)
      
      if (error) {
        console.error('Login error:', error)
        toast.error('登录失败：' + (error.message || '未知错误'))
        setLoading(false)
      } else {
        toast.success('登录成功')
        // 不立即导航，让AuthContext处理状态更新后自动重定向
        // 这样可以避免竞态条件和无限循环
        setLoading(false)
      }
    } catch (error) {
      console.error('Login exception:', error)
      toast.error('登录失败，请重试')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-500 rounded-full flex items-center justify-center mb-4">
            <PhoneIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">码上购</h2>
          <p className="text-gray-600">医院便民购物平台</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                手机号
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <PhoneIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={11}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link
                to="/auth/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                忘记密码？
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '登录中...' : '登录'}
            </button>

            <div className="text-center">
              <span className="text-sm text-gray-600">还没有账号？</span>
              <Link
                to="/auth/register"
                className="ml-1 text-sm text-blue-600 hover:text-blue-500 font-medium"
              >
                立即注册
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}