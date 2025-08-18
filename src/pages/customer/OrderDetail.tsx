import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Package, Truck, CheckCircle, XCircle, MapPin, Phone, User, Copy, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';
import PageLayout from '../../components/layout/PageLayout';
import { useSupabaseSubscription } from '../../hooks/useSupabaseSubscription';
import { toast } from 'sonner';

interface OrderDetail {
  id: string;
  order_number: string;
  verification_code: string;
  total_amount: number;
  status: string;
  delivery_address: string;
  delivery_name: string;
  delivery_phone: string;
  created_at: string;
  updated_at: string;
  payment_deadline?: string;
  auto_close_at?: string;
  merchant_id: string;
  merchant: {
    name: string;
    phone: string;
    payment_qr_code: string;
  };
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products: {
      name: string;
      image_url: string;
      description: string;
    };
  }[];
}

const statusConfig = {
  pending: { label: '待支付', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  customer_paid: { label: '已支付', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Package },
  timeout_closed: { label: '支付超时', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: XCircle },
  merchant_confirmed: { label: '配送中', color: 'text-green-600', bgColor: 'bg-green-100', icon: Truck },
  customer_received: { label: '已完成', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle }
};

const statusSteps = [
  { key: 'pending', label: '订单创建', description: '订单已创建，等待支付' },
  { key: 'customer_paid', label: '支付完成', description: '支付成功，等待商家确认' },
  { key: 'merchant_confirmed', label: '配送中', description: '商家已确认收款，正在配送' },
  { key: 'customer_received', label: '订单完成', description: '订单已完成，感谢您的购买' }
];

export default function OrderDetail() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (orderId && user) {
      fetchOrderDetail();
      
      // 设置定期刷新作为备用方案（每30秒刷新一次）
      const refreshInterval = setInterval(() => {
        fetchOrderDetail();
      }, 30000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [orderId, user]);

  // 订阅订单状态变化
  useSupabaseSubscription(
    {
      table: 'orders',
      event: 'UPDATE',
      schema: 'public',
      filter: `id=eq.${orderId}`
    },
    () => {
      fetchOrderDetail();
    },
    [orderId]
  );

  const fetchOrderDetail = async () => {
    if (!orderId || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          verification_code,
          total_amount,
          status,
          delivery_address,
          delivery_name,
          delivery_phone,
          created_at,
          updated_at,
          payment_deadline,
          auto_close_at,
          merchant_id,
          merchants!merchant_id (
            name,
            phone,
            payment_qr_code
          ),
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            products (
              name,
              image_url,
              description
            )
          )
        `)
        .eq('id', orderId)
        .eq('customer_id', user.id)
        .single();

      if (error) throw error;
      
      // 转换数据结构
      const formattedOrder = {
        ...data,
        merchant: Array.isArray(data.merchants) ? data.merchants[0] : data.merchants,
        order_items: data.order_items?.map(item => ({
          ...item,
          products: Array.isArray(item.products) ? item.products[0] : item.products
        })) || []
      };
      
      setOrder(formattedOrder);
      
      // 如果是待支付订单且有支付截止时间，启动倒计时
      if (formattedOrder.status === 'pending' && formattedOrder.payment_deadline) {
        startCountdown(formattedOrder.payment_deadline);
      }
    } catch (error) {
      console.error('Error fetching order detail:', error);
      toast.error('获取订单详情失败');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = (deadline: string) => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const difference = deadlineTime - now;
      
      if (difference > 0) {
        setTimeLeft(Math.floor(difference / 1000)); // 转换为秒
      } else {
        setTimeLeft(0);
        // 支付超时，刷新订单状态
        fetchOrderDetail();
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  };

  // 格式化倒计时显示
  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = async () => {
    if (!order) return;
    
    try {
      await navigator.clipboard.writeText(order.verification_code);
      setCopied(true);
      toast.success('验证码已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleConfirmReceived = async () => {
    if (!order) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'customer_received',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;
      
      toast.success('已确认收货');
      fetchOrderDetail(); // 重新获取订单详情
    } catch (error) {
      console.error('Error confirming order:', error);
      toast.error('确认收货失败');
    }
  };
  
  const handleMarkAsPaid = async () => {
    if (!order) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'customer_paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;
      
      toast.success('已标记为已支付，等待商家确认');
      fetchOrderDetail(); // 重新获取订单详情
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('标记支付状态失败');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    return statusSteps.findIndex(step => step.key === order.status);
  };

  if (loading) {
    return (
      <PageLayout title="订单详情" showBackButton={true}>
        <div className="flex items-center justify-center min-h-96">
          <Loading />
        </div>
      </PageLayout>
    );
  }

  if (!order) {
    return (
      <PageLayout title="订单详情" showBackButton={true}>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <p className="text-gray-500 mb-4">订单不存在</p>
            <Button onClick={() => navigate('/orders')} className="bg-blue-600 hover:bg-blue-700">
              返回订单列表
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
  const StatusIcon = statusInfo.icon;
  const currentStepIndex = getCurrentStepIndex();

  return (
    <PageLayout 
      title="订单详情" 
      showBackButton={true}
      contentClassName="max-w-4xl"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Order Status */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
              statusInfo.color
            } ${statusInfo.bgColor}`}>
              <StatusIcon className="w-4 h-4 mr-2" />
              {statusInfo.label}
            </div>
            <span className="text-sm text-gray-500">订单号: {order.order_number}</span>
          </div>
          
          {/* Status Timeline */}
          <div className="space-y-3">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div key={step.key} className="flex items-start space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <div className="w-2 h-2 bg-current rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                  {isCurrent && (
                    <span className="text-xs text-blue-600 font-medium">当前状态</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Payment Countdown (for pending orders) */}
        {order.status === 'pending' && timeLeft !== null && (
          <Card className="p-4">
            <div className={`text-center p-4 rounded-lg ${
              timeLeft > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-200'
            }`}>
              {timeLeft > 0 ? (
                <>
                  <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <h3 className="font-medium text-orange-900 mb-1">支付倒计时</h3>
                  <div className="text-3xl font-mono font-bold text-orange-600 mb-2">
                    {formatTimeLeft(timeLeft)}
                  </div>
                  <p className="text-sm text-orange-700">
                    请在倒计时结束前完成支付，否则订单将自动关闭
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <h3 className="font-medium text-red-900 mb-1">支付已超时</h3>
                  <p className="text-sm text-red-700">
                    订单支付时间已过期，订单将自动关闭
                  </p>
                </>
              )}
            </div>
          </Card>
        )}

        {/* Verification Code (for pending/paid orders) */}
        {['pending', 'customer_paid'].includes(order.status) && (
          <Card className="p-4">
            <h3 className="font-medium text-gray-900 mb-3">付款验证码</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-mono font-bold text-gray-900 tracking-wider">
                  {order.verification_code}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="text-blue-600 border-blue-200"
                >
                  {copied ? (
                    <><Check className="w-4 h-4 mr-1" />已复制</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-1" />复制</>
                  )}
                </Button>
              </div>
              <p className="text-sm text-yellow-700">
                请在支付时将此验证码填写到备注中
              </p>
            </div>
          </Card>
        )}

        {/* Merchant Info */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">商家信息</h3>
          <div className="space-y-2">
            <p className="text-gray-700">{order.merchant.name}</p>
            <p className="text-sm text-gray-500">联系电话: {order.merchant.phone}</p>
          </div>
        </Card>

        {/* Order Items */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">商品清单</h3>
          <div className="space-y-3">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {item.products.image_url ? (
                    <img
                      src={item.products.image_url}
                      alt={item.products.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{item.products.name}</h4>
                  <p className="text-sm text-gray-500 truncate">{item.products.description}</p>
                  <p className="text-sm text-gray-500">¥{item.unit_price.toFixed(2)} × {item.quantity}</p>
                </div>
                <p className="font-medium text-gray-900">¥{item.total_price.toFixed(2)}</p>
              </div>
            ))}
            
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">总计</span>
                <span className="font-bold text-lg text-blue-600">¥{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Delivery Info */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">收货信息</h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{order.delivery_name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{order.delivery_phone}</span>
            </div>
            <div className="flex items-start space-x-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <span className="text-gray-700">{order.delivery_address}</span>
            </div>
          </div>
        </Card>

        {/* Order Info */}
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-3">订单信息</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">订单号</span>
              <span className="text-gray-900">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">创建时间</span>
              <span className="text-gray-900">{formatDate(order.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">更新时间</span>
              <span className="text-gray-900">{formatDate(order.updated_at)}</span>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {order.status === 'merchant_confirmed' && (
            <Button
              onClick={handleConfirmReceived}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
            >
              确认收货
            </Button>
          )}
          
          {order.status === 'pending' && (
            <>
              <Button
                onClick={() => navigate(`/checkout?merchant=${order.merchant_id}&fromOrder=${order.id}`)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
              >
                继续支付
              </Button>
              <Button
                onClick={handleMarkAsPaid}
                variant="outline"
                className="w-full border-green-600 text-green-600 hover:bg-green-50 py-3 text-lg"
              >
                我已完成支付
              </Button>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}