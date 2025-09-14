import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Store, 
  ShoppingCart, 
  DollarSign,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Card from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';
import { toast } from 'sonner';

interface AnalyticsData {
  // 用户统计
  totalUsers: number;
  newUsersToday: number;
  newUsersThisMonth: number;
  userGrowthRate: number;
  
  // 商家统计
  totalMerchants: number;
  activeMerchants: number;
  newMerchantsToday: number;
  newMerchantsThisMonth: number;
  merchantGrowthRate: number;
  
  // 订单统计
  totalOrders: number;
  ordersToday: number;
  ordersThisMonth: number;
  orderGrowthRate: number;
  
  // 收入统计
  totalRevenue: number;
  revenueToday: number;
  revenueThisMonth: number;
  revenueGrowthRate: number;
  
  // 热门商家
  topMerchants: {
    id: string;
    name: string;
    orderCount: number;
    revenue: number;
  }[];
  
  // 订单状态分布
  orderStatusDistribution: {
    status: string;
    count: number;
    percentage: number;
  }[];
  
  // 每日订单趋势（最近7天）
  dailyOrderTrend: {
    date: string;
    orders: number;
    revenue: number;
  }[];
  
  // 商家类型分布
  merchantCategoryDistribution: {
    category: string;
    count: number;
    percentage: number;
  }[];
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // 获取用户统计
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('id, created_at');
      
      const totalUsers = usersData?.length || 0;
      const newUsersToday = usersData?.filter(u => new Date(u.created_at) >= today).length || 0;
      const newUsersThisMonth = usersData?.filter(u => new Date(u.created_at) >= thisMonth).length || 0;
      const newUsersLastMonth = usersData?.filter(u => {
        const date = new Date(u.created_at);
        return date >= lastMonth && date <= lastMonthEnd;
      }).length || 0;
      const userGrowthRate = newUsersLastMonth > 0 ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100 : 0;
      
      // 获取商家统计
      const { data: merchantsData } = await supabase
        .from('merchants')
        .select('id, is_active, created_at, category');
      
      const totalMerchants = merchantsData?.length || 0;
      const activeMerchants = merchantsData?.filter(m => m.is_active).length || 0;
      const newMerchantsToday = merchantsData?.filter(m => new Date(m.created_at) >= today).length || 0;
      const newMerchantsThisMonth = merchantsData?.filter(m => new Date(m.created_at) >= thisMonth).length || 0;
      const newMerchantsLastMonth = merchantsData?.filter(m => {
        const date = new Date(m.created_at);
        return date >= lastMonth && date <= lastMonthEnd;
      }).length || 0;
      const merchantGrowthRate = newMerchantsLastMonth > 0 ? ((newMerchantsThisMonth - newMerchantsLastMonth) / newMerchantsLastMonth) * 100 : 0;
      
      // 获取订单统计
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, merchant_id, merchants(name)');
      
      const totalOrders = ordersData?.length || 0;
      const ordersToday = ordersData?.filter(o => new Date(o.created_at) >= today).length || 0;
      const ordersThisMonth = ordersData?.filter(o => new Date(o.created_at) >= thisMonth).length || 0;
      const ordersLastMonth = ordersData?.filter(o => {
        const date = new Date(o.created_at);
        return date >= lastMonth && date <= lastMonthEnd;
      }).length || 0;
      const orderGrowthRate = ordersLastMonth > 0 ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100 : 0;
      
      // 计算收入统计（只计算已确认的订单）
      const confirmedOrders = ordersData?.filter(o => ['customer_paid', 'merchant_confirmed', 'customer_received'].includes(o.status)) || [];
      const totalRevenue = confirmedOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const revenueToday = confirmedOrders.filter(o => new Date(o.created_at) >= today).reduce((sum, o) => sum + o.total_amount, 0);
      const revenueThisMonth = confirmedOrders.filter(o => new Date(o.created_at) >= thisMonth).reduce((sum, o) => sum + o.total_amount, 0);
      const revenueLastMonth = confirmedOrders.filter(o => {
        const date = new Date(o.created_at);
        return date >= lastMonth && date <= lastMonthEnd;
      }).reduce((sum, o) => sum + o.total_amount, 0);
      const revenueGrowthRate = revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : 0;
      
      // 计算热门商家
      const merchantStats = merchantsData?.map(merchant => {
        const merchantOrders = confirmedOrders.filter(o => o.merchant_id === merchant.id);
        const merchantInfo = merchantOrders[0]?.merchants;
        let merchantName = '未知商家';
        if (Array.isArray(merchantInfo) && merchantInfo[0]?.name) {
          merchantName = merchantInfo[0].name;
        } else if (merchantInfo && typeof merchantInfo === 'object' && 'name' in merchantInfo) {
          merchantName = (merchantInfo as any).name;
        } else if (merchant && typeof merchant === 'object' && 'name' in merchant) {
          merchantName = (merchant as any).name;
        }
        return {
          id: merchant.id,
          name: merchantName,
          orderCount: merchantOrders.length,
          revenue: merchantOrders.reduce((sum, o) => sum + o.total_amount, 0)
        };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 5) || [];
      
      // 计算订单状态分布
      const statusCounts = ordersData?.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const orderStatusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: (count / totalOrders) * 100
      }));
      
      // 计算每日订单趋势（最近7天）
      const dailyOrderTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayOrders = ordersData?.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= date && orderDate < nextDate;
        }) || [];
        
        const dayRevenue = dayOrders
          .filter(o => ['customer_paid', 'merchant_confirmed', 'customer_received'].includes(o.status))
          .reduce((sum, o) => sum + o.total_amount, 0);
        
        dailyOrderTrend.push({
          date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          orders: dayOrders.length,
          revenue: dayRevenue
        });
      }
      
      // 计算商家类型分布
      const categoryCounts = merchantsData?.reduce((acc, merchant) => {
        acc[merchant.category] = (acc[merchant.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const merchantCategoryDistribution = Object.entries(categoryCounts).map(([category, count]) => ({
        category,
        count,
        percentage: (count / totalMerchants) * 100
      }));
      
      setData({
        totalUsers,
        newUsersToday,
        newUsersThisMonth,
        userGrowthRate,
        totalMerchants,
        activeMerchants,
        newMerchantsToday,
        newMerchantsThisMonth,
        merchantGrowthRate,
        totalOrders,
        ordersToday,
        ordersThisMonth,
        orderGrowthRate,
        totalRevenue,
        revenueToday,
        revenueThisMonth,
        revenueGrowthRate,
        topMerchants: merchantStats,
        orderStatusDistribution,
        dailyOrderTrend,
        merchantCategoryDistribution
      });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  const formatGrowthRate = (rate: number) => {
    const isPositive = rate >= 0;
    return (
      <span className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
        {Math.abs(rate).toFixed(1)}%
      </span>
    );
  };

  const getOrderStatusLabel = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      pending: { label: '待支付', color: 'bg-yellow-500' },
      customer_paid: { label: '顾客称已支付', color: 'bg-blue-500' },
      timeout_closed: { label: '超时关闭', color: 'bg-gray-500' },
      merchant_confirmed: { label: '商家已确认收款/配送中', color: 'bg-green-500' },
      customer_received: { label: '顾客已确认收货', color: 'bg-green-600' },
      cancelled: { label: '已取消', color: 'bg-red-500' }
    };
    return statusConfig[status] || { label: status, color: 'bg-gray-500' };
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据统计</h1>
          <p className="text-gray-600">平台运营数据分析和趋势监控</p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
            <option value="90d">最近90天</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Users */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            {formatGrowthRate(data.userGrowthRate)}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{data.totalUsers}</p>
            <p className="text-sm text-gray-600">总用户数</p>
            <div className="mt-2 text-xs text-gray-500">
              <span>今日新增: {data.newUsersToday}</span>
              <span className="mx-2">•</span>
              <span>本月新增: {data.newUsersThisMonth}</span>
            </div>
          </div>
        </Card>

        {/* Merchants */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Store className="w-6 h-6 text-green-600" />
            </div>
            {formatGrowthRate(data.merchantGrowthRate)}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{data.totalMerchants}</p>
            <p className="text-sm text-gray-600">总商家数</p>
            <div className="mt-2 text-xs text-gray-500">
              <span>已激活: {data.activeMerchants}</span>
              <span className="mx-2">•</span>
              <span>本月新增: {data.newMerchantsThisMonth}</span>
            </div>
          </div>
        </Card>

        {/* Orders */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-orange-600" />
            </div>
            {formatGrowthRate(data.orderGrowthRate)}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{data.totalOrders}</p>
            <p className="text-sm text-gray-600">总订单数</p>
            <div className="mt-2 text-xs text-gray-500">
              <span>今日订单: {data.ordersToday}</span>
              <span className="mx-2">•</span>
              <span>本月订单: {data.ordersThisMonth}</span>
            </div>
          </div>
        </Card>

        {/* Revenue */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            {formatGrowthRate(data.revenueGrowthRate)}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.totalRevenue)}</p>
            <p className="text-sm text-gray-600">总营业额</p>
            <div className="mt-2 text-xs text-gray-500">
              <span>今日: {formatCurrency(data.revenueToday)}</span>
              <span className="mx-2">•</span>
              <span>本月: {formatCurrency(data.revenueThisMonth)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">订单趋势</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {data.dailyOrderTrend.map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 w-16">{day.date}</span>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.max((day.orders / Math.max(...data.dailyOrderTrend.map(d => d.orders))) * 100, 5)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{day.orders}单</p>
                  <p className="text-xs text-gray-500">{formatCurrency(day.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Order Status Distribution */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">订单状态分布</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {data.orderStatusDistribution.map((item, index) => {
              const statusInfo = getOrderStatusLabel(item.status);
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${statusInfo.color}`} />
                    <span className="text-sm text-gray-700">{statusInfo.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900">{item.count}</span>
                    <span className="text-xs text-gray-500 ml-2">({item.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Merchants */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">热门商家</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {data.topMerchants.map((merchant, index) => (
              <div key={merchant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{merchant.name}</p>
                    <p className="text-sm text-gray-600">{merchant.orderCount} 订单</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(merchant.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Merchant Categories */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">商家类型分布</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {data.merchantCategoryDistribution.map((item, index) => {
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500', 'bg-indigo-500'];
              const color = colors[index % colors.length];
              
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-sm text-gray-700">{item.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900">{item.count}</span>
                    <span className="text-xs text-gray-500 ml-2">({item.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}