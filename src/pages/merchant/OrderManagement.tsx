import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Phone,
  User,
  Copy,
  Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Loading from '../../components/ui/Loading';
import Empty from '../../components/Empty';
import { useSupabaseSubscription } from '../../hooks/useSupabaseSubscription';
import { toast } from 'sonner';

interface Merchant {
  id: string;
  name: string;
}

interface Order {
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
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products: {
      name: string;
      image_url: string;
    };
  }[];
}

interface Props {
  merchant: Merchant | null;
}

const statusConfig = {
  pending: { label: '待支付', color: 'text-yellow-600', bgColor: 'bg-yellow-100', nextStatus: null, priority: 1 },
  customer_paid: { label: '顾客称已支付', color: 'text-blue-600', bgColor: 'bg-blue-100', nextStatus: 'merchant_confirmed', priority: 2 },
  timeout_closed: { label: '超时关闭', color: 'text-gray-600', bgColor: 'bg-gray-100', nextStatus: null, priority: 5 },
  merchant_confirmed: { label: '商家已确认收款/配送中', color: 'text-green-600', bgColor: 'bg-green-100', nextStatus: null, priority: 3 },
  customer_received: { label: '顾客已确认收货', color: 'text-green-600', bgColor: 'bg-green-100', nextStatus: null, priority: 4 },
  cancelled: { label: '已取消', color: 'text-red-600', bgColor: 'bg-red-100', nextStatus: null, priority: 6 }
};

const statusActions = {
  customer_paid: '确认收款'
};

const getStatusPriority = (status: string) => {
  return statusConfig[status as keyof typeof statusConfig]?.priority || 999;
};

export default function OrderManagement({ merchant }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [newOrderNotification, setNewOrderNotification] = useState(false);

  useEffect(() => {
    if (merchant?.id) {
      fetchOrders();
    }
  }, [merchant?.id]);

  // 订阅新订单和订单状态变化
  useSupabaseSubscription(
    {
      table: 'orders',
      event: '*',
      schema: 'public',
      filter: `merchant_id=eq.${merchant?.id}`
    },
    (payload) => {
      // 如果是新订单插入，显示通知
      const isNewOrder = payload.eventType === 'INSERT';
      fetchOrders(isNewOrder);
    },
    [merchant?.id]
  );

  const fetchOrders = async (showNotification = false) => {
    if (!merchant?.id) return;
    
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
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            products (
              name,
              image_url
            )
          )
        `)
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // 转换数据结构以匹配TypeScript接口
      const formattedOrders = data?.map(order => ({
        ...order,
        order_items: order.order_items?.map(item => ({
          ...item,
          products: Array.isArray(item.products) ? item.products[0] : item.products
        })) || []
      })) || [];
      
      // 检查是否有新订单
      if (showNotification && lastOrderCount > 0 && formattedOrders.length > lastOrderCount) {
        const newOrdersCount = formattedOrders.length - lastOrderCount;
        toast.success(`收到 ${newOrdersCount} 个新订单！`, {
          duration: 5000,
          action: {
            label: '查看',
            onClick: () => {
              setStatusFilter('customer_paid');
              setSearchTerm('');
            }
          }
        });
        setNewOrderNotification(true);
        setTimeout(() => setNewOrderNotification(false), 3000);
      }
      
      setOrders(formattedOrders);
      setLastOrderCount(formattedOrders.length);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // 根据状态添加相应的时间戳
      // 注意：orders表中只有基础字段，不包含额外的时间戳字段
      // 如果需要记录详细时间，可以考虑在将来添加这些字段到数据库schema中
      
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      const statusLabel = statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus;
      toast.success(`订单状态已更新为：${statusLabel}`);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('更新订单状态失败');
    } finally {
      setUpdating(null);
    }
  };

  const handleCopyCode = async (code: string, orderId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(orderId);
      toast.success('验证码已复制');
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.delivery_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.verification_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    // 按优先级排序：待处理订单优先，然后按时间倒序
    const aPriority = getStatusPriority(a.status);
    const bPriority = getStatusPriority(b.status);
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // 同优先级按创建时间倒序
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingOrders = orders.filter(order => ['customer_paid', 'merchant_confirmed'].includes(order.status));

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">订单管理</h1>
            {newOrderNotification && (
              <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>有新订单</span>
              </div>
            )}
          </div>
          <p className="text-gray-600">
            共 {orders.length} 个订单，{pendingOrders.length} 个待处理
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => fetchOrders(false)}
            variant="outline"
            className="text-blue-600 border-blue-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          {pendingOrders.length > 0 && (
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              {pendingOrders.length} 个待处理
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索订单号、顾客姓名或验证码..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="pending">待支付</option>
              <option value="customer_paid">顾客称已支付</option>
              <option value="merchant_confirmed">商家已确认收款/配送中</option>
              <option value="customer_received">顾客已确认收货</option>
              <option value="timeout_closed">超时关闭</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Empty
          icon={Package}
          title="暂无订单"
          description={searchTerm || statusFilter !== 'all' ? '没有找到匹配的订单' : '还没有收到任何订单'}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusInfo = statusConfig[order.status as keyof typeof statusConfig];
            const nextStatus = statusInfo.nextStatus;
            const actionLabel = nextStatus ? statusActions[order.status as keyof typeof statusActions] : null;
            
            return (
              <Card key={order.id} className="p-6">
                {/* Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex items-center space-x-4">
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="font-semibold text-lg text-gray-900">{order.delivery_name}</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          statusInfo.color
                        } ${statusInfo.bgColor}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="font-semibold">金额: {formatCurrency(order.total_amount)}</span>
                        <span>时间: {formatDate(order.created_at)}</span>
                        <span className="text-xs text-gray-400">订单号: {order.order_number}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetail(order)}
                      className="text-blue-600 border-blue-200"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      详情
                    </Button>
                    
                    {actionLabel && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(order.id, nextStatus!)}
                        disabled={updating === order.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {updating === order.id ? '处理中...' : actionLabel}
                      </Button>
                    )}
                  </div>
                </div>

                {/* 收款确认区域 - 突出显示验证码和金额 */}
                {order.status === 'customer_paid' && (
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-lg p-6 mb-4">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-bold text-blue-800 mb-2">🎉 收款确认</h3>
                      <p className="text-sm text-blue-600">顾客已完成支付，请核对验证码后确认收款</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* 验证码 */}
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <div className="text-center">
                          <span className="text-sm font-medium text-blue-600 block mb-2">付款验证码</span>
                          <span className="text-3xl font-mono font-bold text-blue-800 block">
                            {order.verification_code}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyCode(order.verification_code, order.id)}
                            className="mt-2 text-blue-600 border-blue-300"
                          >
                            {copied === order.id ? (
                              <><Check className="w-4 h-4 mr-1" />已复制</>
                            ) : (
                              <><Copy className="w-4 h-4 mr-1" />复制验证码</>
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {/* 金额 */}
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="text-center">
                          <span className="text-sm font-medium text-green-600 block mb-2">订单金额</span>
                          <span className="text-3xl font-bold text-green-800 block">
                            {formatCurrency(order.total_amount)}
                          </span>
                          <span className="text-xs text-green-600 mt-1 block">
                            请核对收款金额
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-yellow-800 text-center">
                        💡 请在您的收款应用中查找备注为 <strong>{order.verification_code}</strong> 的 <strong>{formatCurrency(order.total_amount)}</strong> 收款记录
                      </p>
                    </div>
                  </div>
                )}
                
                {/* 配货区域 - 突出显示商品列表 */}
                {order.status === 'merchant_confirmed' && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6 mb-4">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-bold text-green-800 mb-2">📦 配货准备</h3>
                      <p className="text-sm text-green-600">已确认收款，请准备以下商品并安排配送</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <Package className="w-4 h-4 mr-2 text-green-600" />
                        商品清单
                      </h4>
                      <div className="space-y-3">
                        {order.order_items.map((item, index) => (
                          <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
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
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900">{item.products.name}</h5>
                              <p className="text-sm text-gray-500">
                                数量: <span className="font-semibold text-green-600">×{item.quantity}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">{formatCurrency(item.total_price)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Items Preview */}
                <div className="border-t pt-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex -space-x-2">
                      {order.order_items.slice(0, 3).map((item, index) => (
                        <div key={index} className="w-10 h-10 bg-gray-100 rounded-lg border-2 border-white overflow-hidden">
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
                        <div className="w-10 h-10 bg-gray-100 rounded-lg border-2 border-white flex items-center justify-center text-xs text-gray-500">
                          +{order.order_items.length - 3}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {order.order_items[0]?.products.name}
                        {order.order_items.length > 1 && ` 等${order.order_items.length}件商品`}
                      </p>
                      <p className="text-xs text-gray-500">
                        配送至: {order.delivery_address}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="订单详情"
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Order Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">订单信息</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">订单号:</span>
                  <span className="font-medium">{selectedOrder.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">状态:</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    statusConfig[selectedOrder.status as keyof typeof statusConfig].color
                  } ${statusConfig[selectedOrder.status as keyof typeof statusConfig].bgColor}`}>
                    {statusConfig[selectedOrder.status as keyof typeof statusConfig].label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">总金额:</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">下单时间:</span>
                  <span>{formatDate(selectedOrder.created_at)}</span>
                </div>
                {['customer_paid', 'merchant_confirmed'].includes(selectedOrder.status) && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">验证码:</span>
                    <span className="font-mono font-bold">{selectedOrder.verification_code}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">顾客信息</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{selectedOrder.delivery_name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{selectedOrder.delivery_phone}</span>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-700">{selectedOrder.delivery_address}</span>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">商品清单</h3>
              <div className="space-y-3">
                {selectedOrder.order_items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
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
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.products.name}</h4>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(item.total_price)}
                    </p>
                  </div>
                ))}
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">总计</span>
                    <span className="font-bold text-lg text-blue-600">
                      {formatCurrency(selectedOrder.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            {statusConfig[selectedOrder.status as keyof typeof statusConfig].nextStatus && (
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    const nextStatus = statusConfig[selectedOrder.status as keyof typeof statusConfig].nextStatus;
                    if (nextStatus) {
                      handleStatusUpdate(selectedOrder.id, nextStatus);
                      setShowDetailModal(false);
                    }
                  }}
                  disabled={updating === selectedOrder.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {updating === selectedOrder.id ? '处理中...' : statusActions[selectedOrder.status as keyof typeof statusActions]}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}