import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockClosedIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import bcrypt from 'bcryptjs'

export default function SuperAdminLogin() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const navigate = useNavigate()

  React.useEffect(() => {
    checkIfFirstTime()
  }, [])

  const checkIfFirstTime = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'super_admin_password_hash')
        .single()

      if (error || !data?.value) {
        setIsFirstTime(true)
      }
    } catch (error) {
      setIsFirstTime(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password) {
      toast.error('请输入密码')
      return
    }

    if (isFirstTime) {
      if (password.length < 8) {
        toast.error('密码长度至少8位')
        return
      }
      
      if (password !== confirmPassword) {
        toast.error('两次输入的密码不一致')
        return
      }
    }

    setLoading(true)
    
    try {
      if (isFirstTime) {
        // 首次设置密码
        const hashedPassword = await bcrypt.hash(password, 10)
        
        const { error } = await supabase
          .from('platform_settings')
          .update({ value: hashedPassword })
          .eq('key', 'super_admin_password_hash')

        if (error) {
          toast.error('密码设置失败')
          return
        }

        // 创建超级管理员会话
        localStorage.setItem('super_admin_session', 'true')
        toast.success('密码设置成功')
        navigate('/super-admin')
      } else {
        // 验证密码
        const { data, error } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'super_admin_password_hash')
          .single()

        if (error || !data?.value) {
          toast.error('系统错误')
          return
        }

        const isValid = await bcrypt.compare(password, data.value)
        
        if (!isValid) {
          toast.error('密码错误')
          return
        }

        // 创建超级管理员会话
        localStorage.setItem('super_admin_session', 'true')
        toast.success('登录成功')
        navigate('/super-admin')
      }
    } catch (error) {
      toast.error('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-red-600 rounded-full flex items-center justify-center mb-4">
            <ShieldCheckIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {isFirstTime ? '初始化管理员' : '超级管理员登录'}
          </h2>
          <p className="text-gray-300">
            {isFirstTime ? '首次使用，请设置管理员密码' : '请输入管理员密码'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {isFirstTime ? '设置密码' : '管理员密码'}
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
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder={isFirstTime ? '请设置密码（至少8位）' : '请输入密码'}
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

            {isFirstTime && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  确认密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="请再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (isFirstTime ? '设置中...' : '登录中...') : (isFirstTime ? '设置密码' : '登录')}
            </button>

            {!isFirstTime && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-sm text-gray-600 hover:text-gray-500"
                >
                  返回首页
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}