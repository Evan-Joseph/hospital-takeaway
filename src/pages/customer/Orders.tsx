import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Package, Truck, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSupabaseSubscription } from '../../hooks/useSupabaseSubscription';
import { supabase } from '../../lib/supabase';
import PageLayout from '../../components/layout/PageLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import Loading from '../../components/ui/Loading';
import Empty from '../../components/Empty';
import { toast } from 'sonner';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  merchant_id: string;
  merchant: {
    name: string;
  };
  order_items: {
    quantity: number;
    products: {
      name: string;
      image_url?: string;
    };
  }[];
}

const statusConfig = {
  pending: { label: '待支付', color: 'yellow' as const, icon: Clock },
  customer_paid: { label: '已支付', color: 'blue' as const, icon: Package },
  timeout_closed: { label: '支付超时', color: 'gray' as const, icon: XCircle },
  merchant_confirmed: { label: '配送中', color: 'green' as const, icon: Truck },
  customer_received: { label: '已完成', color: 'green' as const, icon: CheckCircle },
  cancelled: { label: '已取消', color: 'red' as const, icon: XCircle }
};

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'delivering' | 'completed'>('all');

  useEffect(() => {
    if (user) {
      fetchOrders();
      
      // 设置定期刷新作为备用方案（每30秒刷新一次）
      const refreshInterval = setInterval(() => {
        fetchOrders();
      }, 30000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [user]);

  // 订阅订单状态变化
  useSupabaseSubscription(
    {
      table: 'orders',
      event: 'UPDATE',
      schema: 'public',
      filter: `customer_id=eq.${user?.id}`
    },
    () => {
      fetchOrders();
    },
    [user?.id]
  );

  const fetchOrders = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          status,
          created_at,
          merchant_id,
          merchants!merchant_id (
            name
          ),
          order_items (
            quantity,
            products (
              name,
              image_url
            )
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // 转换数据结构
      const formattedOrders = data.map(order => ({
        ...order,
        merchant: Array.isArray(order.merchants) ? order.merchants[0] : order.merchants,
        order_items: order.order_items?.map(item => ({
          ...item,
          products: Array.isArray(item.products) ? item.products[0] : item.products
        })) || []
      }));
      
      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'pending':
        return orders.filter(order => order.status === 'pending');
      case 'delivering':
        return orders.filter(order => ['customer_paid', 'merchant_confirmed'].includes(order.status));
      case 'completed':
        return orders.filter(order => ['customer_received', 'cancelled', 'timeout_closed'].includes(order.status));
      default:
        return orders;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOrderItemsText = (orderItems: Order['order_items']) => {
    if (orderItems.length === 1) {
      return `${orderItems[0].products.name} 等${orderItems[0].quantity}件`;
    }
    const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    return `${orderItems[0].products.name} 等${totalItems}件`;
  };

  const handleConfirmReceived = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'customer_received' })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('已确认收货');
      fetchOrders(); // 刷新订单列表
    } catch (error) {
      console.error('Error confirming receipt:', error);
      toast.error('确认收货失败');
    }
  };

  const handleMarkAsPaid = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'customer_paid' })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('已标记为已支付，等待商家确认');
      fetchOrders(); // 刷新订单列表
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('标记支付失败');
    }
  };

  if (loading) {
    return (
      <PageLayout title="我的订单" backPath="/">
        <div className="flex items-center justify-center py-12">
          <Loading />
        </div>
      </PageLayout>
    );
  }

  const filteredOrders = getFilteredOrders();

  const tabsElement = (
    <div className="bg-white border-b -mx-4">
      <div className="px-4">
        <div className="flex space-x-6">
          {[
            { key: 'all', label: '全部' },
            { key: 'pending', label: '待支付' },
            { key: 'delivering', label: '配送中' },
            { key: 'completed', label: '已完成' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <PageLayout 
      title="我的订单" 
      backPath="/"
      className="bg-blue-50"
      contentClassName="p-0"
    >
      {/* Tabs */}
      {tabsElement}
      
      {/* Orders List */}
      <div className="p-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Empty
              icon={Package}
              title="暂无订单"
              description={activeTab === 'all' ? '您还没有任何订单' : `暂无${activeTab === 'pending' ? '待支付' : activeTab === 'delivering' ? '配送中' : '已完成'}的订单`}
            />
            <div className="mt-6">
              <Button onClick={() => navigate('/')} className="bg-blue-600 hover:bg-blue-700">
                去购物
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
              const StatusIcon = statusInfo.icon;
              
              return (
                <Card key={order.id} className="p-4">
                  {/* Order Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">{order.merchant.name}</span>
                    <StatusBadge
                      label={statusInfo.label}
                      color={statusInfo.color}
                      icon={statusInfo.icon}
                      size="sm"
                    />
                  </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Order Items */}
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="flex -space-x-2">
                      {order.order_items.slice(0, 3).map((item, index) => (
                        <div key={index} className="w-12 h-12 bg-gray-100 rounded-lg border-2 border-white overflow-hidden">
                          {item.products.image_url ? (
                            <img
                              src={item.products.image_url}
                              alt={item.products.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      ))}
                      {order.order_items.length > 3 && (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg border-2 border-white flex items-center justify-center text-xs text-gray-500">
                          +{order.order_items.length - 3}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getOrderItemsText(order.order_items)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                  </div>

                  {/* Order Footer */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">订单号: {order.order_number}</span>
                      <span className="font-semibold text-gray-900">¥{order.total_amount.toFixed(2)}</span>
                    </div>
                    
                    {/* 订单操作按钮 */}
                    <div className="flex items-center justify-end space-x-2">
                      {order.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/checkout?merchant=${order.merchant_id}&fromOrder=${order.id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            去支付
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsPaid(order.id)}
                            className="border-green-600 text-green-600 hover:bg-green-50"
                          >
                            已完成支付
                          </Button>
                        </>
                      )}
                      {order.status === 'merchant_confirmed' && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmReceived(order.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          确认收货
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}