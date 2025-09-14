import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Store, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  Eye,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';

interface Stats {
  totalUsers: number;
  totalMerchants: number;
  activeMerchants: number;
  pendingMerchants: number;
  totalOrders: number;
  todayOrders: number;
  monthlyOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  monthlyRevenue: number;
  recentOrders: {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    customer_name: string;
    merchant_name: string;
    merchant_category: string;
  }[];
}

interface OrderWithRelations {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  user_profiles: {
    name: string;
  } | null;
  merchants: {
    name: string;
    category: string;
  } | null;
}

interface RecentActivity {
  id: string;
  type: 'user_register' | 'merchant_register' | 'order_created';
  description: string;
  created_at: string;
}

interface Props {
  stats: Stats;
}

export default function SuperAdminDashboard({ stats }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [revenueStats, setRevenueStats] = useState({
    todayRevenue: 0,
    monthRevenue: 0,
    totalRevenue: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [topMerchants, setTopMerchants] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 获取营业额统计（使用正确的订单状态）
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, created_at, status')
        .in('status', ['customer_paid', 'merchant_confirmed', 'customer_received']);

      if (orders) {
        const now = new Date();
        const today = now.toDateString();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const todayRevenue = orders
          .filter(order => new Date(order.created_at).toDateString() === today)
          .reduce((sum, order) => sum + order.total_amount, 0);

        const monthRevenue = orders
          .filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
          })
          .reduce((sum, order) => sum + order.total_amount, 0);

        const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);

        setRevenueStats({ todayRevenue, monthRevenue, totalRevenue });
      }

      // 获取热门商家（使用正确的订单状态）
      const { data: merchantOrders } = await supabase
        .from('orders')
        .select(`
          merchant_id,
          total_amount,
          merchants!merchant_id (
            name,
            category
          )
        `)
        .in('status', ['customer_paid', 'merchant_confirmed', 'customer_received']);

      if (merchantOrders) {
        const merchantStats = merchantOrders.reduce((acc: any, order: any) => {
          const merchantId = order.merchant_id;
          const merchant = Array.isArray(order.merchants) ? order.merchants[0] : order.merchants;
          if (!acc[merchantId]) {
            acc[merchantId] = {
              id: merchantId,
              name: merchant?.name || '未知商家',
              category: merchant?.category || '其他',
              totalRevenue: 0,
              orderCount: 0
            };
          }
          acc[merchantId].totalRevenue += order.total_amount;
          acc[merchantId].orderCount += 1;
          return acc;
        }, {});

        const sortedMerchants = Object.values(merchantStats)
          .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
          .slice(0, 5);

        setTopMerchants(sortedMerchants);
      }

      // 获取最近订单活动
      const { data: recentOrders } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          created_at,
          user_profiles!customer_id (name),
          merchants!merchant_id (name, category)
        `)
        .order('created_at', { ascending: false })
        .limit(5) as { data: OrderWithRelations[] | null };

      if (recentOrders) {
        const activities: RecentActivity[] = (recentOrders as OrderWithRelations[]).map(order => ({
          id: order.id,
          type: 'order_created' as const,
          description: `新订单：${order.user_profiles?.name || '未知用户'} 在 ${order.merchants?.name || '未知商家'} 下单`,
          created_at: order.created_at
        }));
        setRecentActivities(activities);
      } else {
        // 模拟最近活动（实际项目中可以从日志表获取）
        const activities: RecentActivity[] = [
          {
            id: '1',
            type: 'user_register',
            description: '新用户注册',
            created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
          },
          {
            id: '2',
            type: 'merchant_register',
            description: '新商家申请入驻',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
          },
          {
            id: '3',
            type: 'order_created',
            description: '新订单创建',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
          }
        ];
        setRecentActivities(activities);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else {
      return `${diffDays}天前`;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_register':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'merchant_register':
        return <Store className="w-4 h-4 text-green-600" />;
      case 'order_created':
        return <ShoppingCart className="w-4 h-4 text-purple-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">欢迎使用码上购管理后台</h1>
        <p className="text-purple-100">
          管理平台用户、商家和内容，监控平台运营数据
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总用户数</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalUsers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/super-admin/users')}
            className="mt-2 text-blue-600 hover:text-blue-700"
          >
            查看详情 →
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">商家总数</p>
              <p className="text-2xl font-bold text-green-600">{stats.totalMerchants}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Store className="w-6 h-6 text-green-600" />
            </div>
          </div>
          {stats.pendingMerchants > 0 && (
            <div className="mt-2 text-sm text-orange-600">
              {stats.pendingMerchants} 个待审核
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/super-admin/merchants')}
            className="mt-2 text-green-600 hover:text-green-700"
          >
            管理商家 →
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">订单总数</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalOrders}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">今日营业额</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(revenueStats.todayRevenue)}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/super-admin/analytics')}
            className="mt-2 text-orange-600 hover:text-orange-700"
          >
            查看统计 →
          </Button>
        </Card>
      </div>

      {/* Revenue Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">今日营业额</h3>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(revenueStats.todayRevenue)}</p>
          <p className="text-sm text-gray-500 mt-1">实时更新</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">本月营业额</h3>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{formatCurrency(revenueStats.monthRevenue)}</p>
          <p className="text-sm text-gray-500 mt-1">当月累计</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">总营业额</h3>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-purple-600">{formatCurrency(revenueStats.totalRevenue)}</p>
          <p className="text-sm text-gray-500 mt-1">平台累计</p>
        </Card>
      </div>

      {/* Recent Activities and Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">最近活动</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/super-admin/analytics')}
              className="text-blue-600 hover:text-blue-700"
            >
              查看更多 →
            </Button>
          </div>
          
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500">{formatTime(activity.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Merchants */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">热门商家</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/super-admin/merchants')}
              className="text-blue-600 hover:text-blue-700"
            >
              查看全部 →
            </Button>
          </div>
          
          <div className="space-y-4">
            {topMerchants.map((merchant, index) => (
              <div key={merchant.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{merchant.name}</p>
                    <p className="text-xs text-gray-500">{merchant.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(merchant.totalRevenue)}</p>
                  <p className="text-xs text-gray-500">{merchant.orderCount} 单</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 text-center">
          <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">用户管理</h3>
          <p className="text-sm text-gray-600 mb-4">查看和管理平台用户</p>
          <Button
            onClick={() => navigate('/super-admin/users')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            进入管理
          </Button>
        </Card>

        <Card className="p-6 text-center">
          <Store className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">商家审核</h3>
          <p className="text-sm text-gray-600 mb-4">审核商家入驻申请</p>
          <Button
            onClick={() => navigate('/super-admin/merchants')}
            className="bg-green-600 hover:bg-green-700"
          >
            {stats.pendingMerchants > 0 ? `审核 ${stats.pendingMerchants} 个申请` : '查看商家'}
          </Button>
        </Card>

        <Card className="p-6 text-center">
          <FileText className="w-12 h-12 text-purple-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">内容管理</h3>
          <p className="text-sm text-gray-600 mb-4">管理轮播图和平台内容</p>
          <Button
            onClick={() => navigate('/super-admin/content')}
            className="bg-purple-600 hover:bg-purple-700"
          >
            管理内容
          </Button>
        </Card>
      </div>
    </div>
  );
}