import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  Clock, 
  Eye,
  AlertCircle,
  CheckCircle,
  DollarSign
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { useSupabaseSubscription } from '../../hooks/useSupabaseSubscription';

interface Merchant {
  id: string;
  name: string;
  is_active: boolean;
}

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  todayRevenue: number;
  totalProducts: number;
  activePromotions: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  customer_name: string;
  verification_code: string;
}

const statusConfig = {
  pending: { label: '待支付', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  customer_paid: { label: '顾客称已支付', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  timeout_closed: { label: '超时关闭', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  merchant_confirmed: { label: '商家已确认收款/配送中', color: 'text-green-600', bgColor: 'bg-green-100' },
  customer_received: { label: '顾客已确认收货', color: 'text-green-600', bgColor: 'bg-green-100' },
  cancelled: { label: '已取消', color: 'text-red-600', bgColor: 'bg-red-100' }
};

interface Props {
  merchant: Merchant | null;
}

export default function MerchantDashboard({ merchant }: Props) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    todayRevenue: 0,
    totalProducts: 0,
    activePromotions: 0
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (merchant?.id) {
      fetchDashboardData();
    }
  }, [merchant?.id]);

  // 订阅新订单
  useSupabaseSubscription(
    {
      table: 'orders',
      event: 'INSERT',
      schema: 'public',
      filter: `merchant_id=eq.${merchant?.id}`
    },
    () => {
      fetchDashboardData();
    },
    [merchant?.id]
  );

  // 订阅订单状态更新
  useSupabaseSubscription(
    {
      table: 'orders',
      event: 'UPDATE',
      schema: 'public',
      filter: `merchant_id=eq.${merchant?.id}`
    },
    () => {
      fetchDashboardData();
    },
    [merchant?.id]
  );

  const fetchDashboardData = async () => {
    if (!merchant?.id) return;
    
    try {
      // 获取统计数据
      const [ordersResult, productsResult, promotionsResult] = await Promise.all([
        // 订单统计
        supabase
          .from('orders')
          .select('status, total_amount, created_at')
          .eq('merchant_id', merchant.id),
        
        // 商品统计
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .eq('is_available', true),
        
        // 优惠活动统计
        supabase
          .from('promotions')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .eq('is_active', true)
          .gte('end_date', new Date().toISOString())
      ]);

      if (ordersResult.data) {
        const orders = ordersResult.data;
        const today = new Date().toDateString();
        
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(order => 
          ['customer_paid', 'merchant_confirmed'].includes(order.status)
        ).length;
        const todayRevenue = orders
          .filter(order => 
            new Date(order.created_at).toDateString() === today &&
            ['merchant_confirmed', 'customer_received'].includes(order.status)
          )
          .reduce((sum, order) => sum + order.total_amount, 0);

        setStats({
          totalOrders,
          pendingOrders,
          todayRevenue,
          totalProducts: productsResult.count || 0,
          activePromotions: promotionsResult.count || 0
        });
      }

      // 获取最近订单
      const { data: recentOrdersData } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          status,
          created_at,
          delivery_name,
          verification_code
        `)
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentOrdersData) {
        const formattedOrders = recentOrdersData.map(order => ({
          ...order,
          customer_name: order.delivery_name
        }));
        setRecentOrders(formattedOrders);
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
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">店铺信息未完善</h3>
          <p className="text-gray-600 mb-4">请先完善您的店铺信息以开始使用商家后台</p>
          <Button 
            onClick={() => navigate('/merchant-admin/profile?setup=true')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            完善店铺信息
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">欢迎回来，{merchant.name}！</h1>
        <p className="text-blue-100">
          {merchant.is_active ? '您的店铺正在正常营业' : '您的店铺暂未激活，请联系管理员'}
        </p>
        {!merchant.is_active && (
          <div className="mt-3 px-3 py-2 bg-yellow-500 bg-opacity-20 rounded-lg border border-yellow-300">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">店铺未激活，无法接收新订单</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">今日营业额</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.todayRevenue)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">待处理订单</p>
              <p className="text-2xl font-bold text-orange-600">{stats.pendingOrders}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          {stats.pendingOrders > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/merchant-admin/orders')}
              className="mt-2 text-orange-600 hover:text-orange-700"
            >
              立即处理 →
            </Button>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总订单数</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalOrders}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">在售商品</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalProducts}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/merchant-admin/menu')}
            className="mt-2 text-purple-600 hover:text-purple-700"
          >
            管理商品 →
          </Button>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">最近订单</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/merchant-admin/orders')}
            className="text-blue-600 hover:text-blue-700"
          >
            查看全部 →
          </Button>
        </div>
        
        {recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暂无订单</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
              
              return (
                <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="font-medium text-gray-900">{order.order_number}</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        statusInfo.color
                      } ${statusInfo.bgColor}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>顾客: {order.customer_name}</span>
                      <span>金额: {formatCurrency(order.total_amount)}</span>
                      <span>时间: {formatTime(order.created_at)}</span>
                      {['paid', 'confirmed'].includes(order.status) && (
                        <span className="font-mono bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          验证码: {order.verification_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/merchant-admin/orders')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 text-center">
          <Package className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">管理菜单</h3>
          <p className="text-sm text-gray-600 mb-4">添加、编辑或删除商品</p>
          <Button
            onClick={() => navigate('/merchant-admin/menu')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            进入管理
          </Button>
        </Card>

        <Card className="p-6 text-center">
          <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">优惠活动</h3>
          <p className="text-sm text-gray-600 mb-4">创建促销活动吸引顾客</p>
          <Button
            onClick={() => navigate('/merchant-admin/promotions')}
            className="bg-green-600 hover:bg-green-700"
          >
            创建活动
          </Button>
        </Card>

        <Card className="p-6 text-center">
          <CheckCircle className="w-12 h-12 text-purple-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">店铺设置</h3>
          <p className="text-sm text-gray-600 mb-4">更新店铺信息和收款码</p>
          <Button
            onClick={() => navigate('/merchant-admin/profile')}
            className="bg-purple-600 hover:bg-purple-700"
          >
            设置店铺
          </Button>
        </Card>
      </div>
    </div>
  );
}