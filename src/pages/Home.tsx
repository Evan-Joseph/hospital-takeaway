import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, Banner } from '../lib/supabase'
import PageLayout from '../components/layout/PageLayout'
import { 
  UserIcon, 
  ClockIcon,
  ShoppingBagIcon,
  SpeakerWaveIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'

interface RecentOrder {
  id: string;
  order_number: string;
  total_amount: number;
  created_at: string;
  merchant: {
    name: string;
  };
  order_items: {
    quantity: number;
    products: {
      name: string;
    };
  }[];
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  target_roles?: string[];
  announcement_type?: string;
  publisher_name?: string;
  valid_until?: string;
  created_at: string;
}

export default function Home() {
  const { user, userProfile, profileError, retryFetchProfile } = useAuth()
  const [banners, setBanners] = useState<Banner[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [recentOrder, setRecentOrder] = useState<RecentOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)

  useEffect(() => {
    fetchBanners()
    fetchAnnouncements()
    if (user && userProfile?.user_type === 'customer') {
      fetchRecentOrder()
    }
    setLoading(false)
  }, [user, userProfile])

  // 轮播图自动播放
  useEffect(() => {
    if (banners.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prevIndex) => 
        prevIndex === banners.length - 1 ? 0 : prevIndex + 1
      )
    }, 4000) // 每4秒切换一次
    
    return () => clearInterval(interval)
  }, [banners.length])

  const goToBanner = (index: number) => {
    setCurrentBannerIndex(index)
  }

  const goToPrevBanner = () => {
    setCurrentBannerIndex((prevIndex) => 
      prevIndex === 0 ? banners.length - 1 : prevIndex - 1
    )
  }

  const goToNextBanner = () => {
    setCurrentBannerIndex((prevIndex) => 
      prevIndex === banners.length - 1 ? 0 : prevIndex + 1
    )
  }

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (error) {
        console.error('Error fetching banners:', error)
        return
      }

      setBanners(data || [])
    } catch (error) {
      console.error('Error fetching banners:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnnouncements = async () => {
    try {
      const userRole = userProfile?.user_type || 'customer'
      
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3)

      if (error) {
        console.error('Error fetching announcements:', error)
        return
      }

      // 过滤出适合当前用户角色的公告
      const filteredAnnouncements = (data || []).filter(announcement => {
        if (!announcement.target_roles || announcement.target_roles.length === 0) {
          return true // 如果没有设置目标角色，则显示给所有用户
        }
        return announcement.target_roles.includes(userRole)
      })

      // 检查有效期
      const validAnnouncements = filteredAnnouncements.filter(announcement => {
        if (!announcement.valid_until) return true
        return new Date(announcement.valid_until) > new Date()
      })

      setAnnouncements(validAnnouncements)
    } catch (error) {
      console.error('Error fetching announcements:', error)
    }
  }

  const fetchRecentOrder = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          created_at,
          merchants!merchant_id (
            name
          ),
          order_items (
            quantity,
            products (
              name
            )
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching recent order:', error)
        return
      }

      if (data) {
        // 转换数据结构
        const formattedOrder = {
          ...data,
          merchant: Array.isArray(data.merchants) ? data.merchants[0] : data.merchants,
          order_items: data.order_items?.map(item => ({
            ...item,
            products: Array.isArray(item.products) ? item.products[0] : item.products
          })) || []
        }
        setRecentOrder(formattedOrder)
      }
    } catch (error) {
      console.error('Error fetching recent order:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getOrderItemsText = (orderItems: RecentOrder['order_items']) => {
    if (!orderItems || orderItems.length === 0) return ''
    if (orderItems.length === 1) {
      return `${orderItems[0].products.name} 等${orderItems[0].quantity}件`
    }
    const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0)
    return `${orderItems[0].products.name} 等${totalItems}件`
  }

  const getAnnouncementIcon = (type?: string) => {
    switch (type) {
      case 'urgent':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
      case 'maintenance':
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
      case 'promotion':
        return <SpeakerWaveIcon className="h-5 w-5 text-purple-600" />
      default:
        return <SpeakerWaveIcon className="h-5 w-5 text-blue-600" />
    }
  }

  const getAnnouncementTypeLabel = (type?: string) => {
    switch (type) {
      case 'urgent': return '🚨 紧急'
      case 'maintenance': return '🔧 维护'
      case 'promotion': return '🎉 优惠'
      default: return '📢 公告'
    }
  }

  const rightElement = user && profileError ? (
    <div className="flex items-center space-x-2 text-sm">
      <span className="text-red-600">{profileError}</span>
      <button
        onClick={retryFetchProfile}
        className="text-blue-600 hover:text-blue-700 underline"
      >
        重试
      </button>
    </div>
  ) : null

  return (
    <PageLayout
      title="码上购"
      showBackButton={false}
      showLogo={true}
      showUserInfo={true}
      rightElement={rightElement}
      contentClassName="max-w-7xl"
    >
        {/* 轮播图 */}
        {!loading && banners.length > 0 && (
          <div className="mb-8">
            <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden group">
              {/* 轮播图片容器 */}
              <div 
                className="flex transition-transform duration-500 ease-in-out h-full"
                style={{ transform: `translateX(-${currentBannerIndex * 100}%)` }}
              >
                {banners.map((banner, index) => (
                  <div key={banner.id} className="w-full h-full flex-shrink-0 relative">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                      <div className="text-center text-white">
                        <h2 className="text-2xl md:text-4xl font-bold mb-2">{banner.title}</h2>
                        <p className="text-lg">医院便民购物平台</p>
                      </div>
                    </div>
                    {/* 点击跳转链接 */}
                    {banner.link_url && (
                      <a 
                        href={banner.link_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="absolute inset-0 z-10"
                        aria-label={`跳转到 ${banner.title}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              
              {/* 左右切换按钮 */}
              {banners.length > 1 && (
                <>
                  <button
                    onClick={goToPrevBanner}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-opacity-70"
                    aria-label="上一张"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={goToNextBanner}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-opacity-70"
                    aria-label="下一张"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
              
              {/* 指示器 */}
              {banners.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  {banners.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToBanner(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        index === currentBannerIndex 
                          ? 'bg-white scale-110' 
                          : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                      }`}
                      aria-label={`跳转到第 ${index + 1} 张图片`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 公告区域 */}
        {announcements.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center mb-4">
              <SpeakerWaveIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">平台公告</h3>
            </div>
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getAnnouncementIcon(announcement.announcement_type)}
                        <h4 className="font-medium text-gray-900">{announcement.title}</h4>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          announcement.announcement_type === 'urgent' ? 'text-red-600 bg-red-100' :
                          announcement.announcement_type === 'maintenance' ? 'text-orange-600 bg-orange-100' :
                          announcement.announcement_type === 'promotion' ? 'text-purple-600 bg-purple-100' :
                          'text-blue-600 bg-blue-100'
                        }`}>
                          {getAnnouncementTypeLabel(announcement.announcement_type)}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">{announcement.content}</p>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>发布者: {announcement.publisher_name || '系统管理员'}</span>
                        <span>{formatDate(announcement.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 问候区 - 显示最近订单信息 */}
        {user && userProfile?.user_type === 'customer' && recentOrder && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center mb-4">
              <ClockIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">最近订单</h3>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{recentOrder.merchant.name}</span>
                <span className="text-sm text-gray-600">{formatDate(recentOrder.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{getOrderItemsText(recentOrder.order_items)}</span>
                <span className="font-semibold text-blue-600">¥{recentOrder.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 购物入口 - 仅对顾客显示 */}
        {user && userProfile?.user_type === 'customer' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">开始购物</h3>
            <Link
              to="/merchants"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ShoppingBagIcon className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <h4 className="font-medium text-gray-900">浏览商家</h4>
                <p className="text-sm text-gray-600">发现附近商家，选购心仪商品</p>
              </div>
            </Link>
          </div>
        )}

        {/* 订单列表入口 - 仅对顾客显示 */}
        {user && userProfile?.user_type === 'customer' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">我的订单</h3>
            <Link
              to="/orders"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h4 className="font-medium text-gray-900">订单列表</h4>
                <p className="text-sm text-gray-600">查看历史订单和订单状态</p>
              </div>
            </Link>
          </div>
        )}

        {/* 个人中心入口 */}
        {user && userProfile && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">个人中心</h3>
            <Link
              to="/profile"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <UserIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h4 className="font-medium text-gray-900">管理个人信息</h4>
                <p className="text-sm text-gray-600">
                  {userProfile.user_type === 'customer' ? '管理个人信息和收货地址' : '管理个人信息和店铺设置'}
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* 未登录用户的引导 */}
        {(!user || !userProfile) && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">开始使用码上购</h3>
            <p className="text-gray-600 mb-6">注册账号，享受便捷的医院购物服务</p>
            <div className="flex justify-center space-x-4">
              <Link
                to="/auth/register"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                立即注册
              </Link>
              <Link
                to="/auth/login"
                className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
              >
                已有账号
              </Link>
            </div>
          </div>
        )}
    </PageLayout>
  )
}