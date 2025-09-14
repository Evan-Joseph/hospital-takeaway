import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  X,
  Ban,
  Store, 
  Phone, 
  MapPin, 
  DollarSign, 
  ShoppingBag, 
  BarChart3,
  Calendar,
  Package,
  AlertCircle,
  Tag
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Merchant as BaseMerchant } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Loading from '../../components/ui/Loading';
import Empty from '../../components/Empty';
import { toast } from 'sonner';

interface Merchant {
  id: string;
  name: string;
  description?: string;
  category: string;
  address: string;
  phone: string;
  is_active: boolean;
  status?: 'pending' | 'active' | 'suspended' | 'rejected';
  created_at: string;
  owner: {
    name: string;
    phone: string;
  };
}

interface MerchantWithProfile {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  user_profiles: {
    name: string;
    phone: string;
  } | null;
}

interface MerchantDetail extends Merchant {
  products?: {
    id: string;
    name: string;
    price: number;
    is_available: boolean;
  }[];
  orders?: {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
  }[];
  revenue?: number;
}

interface Props {
  onUpdate: () => void;
}

export default function MerchantManagement({ onUpdate }: Props) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select(`
          id,
          name,
          description,
          category,
          address,
          phone,
          is_active,
          status,
          created_at,
          user_profiles!owner_id (
            name,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // 转换数据结构
      const formattedMerchants: Merchant[] = data?.map(merchant => ({
        id: merchant.id,
        name: merchant.name,
        description: merchant.description,
        category: merchant.category,
        address: merchant.address,
        phone: merchant.phone,
        is_active: merchant.is_active,
        status: merchant.status,
        created_at: merchant.created_at,
        owner: Array.isArray(merchant.user_profiles) 
          ? (merchant.user_profiles[0] || { name: '未知', phone: '未知' })
          : (merchant.user_profiles || { name: '未知', phone: '未知' })
      })) || [];
      
      setMerchants(formattedMerchants);
    } catch (error) {
      console.error('Error fetching merchants:', error);
      toast.error('获取商家列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchantDetail = async (merchantId: string) => {
    setLoadingDetail(true);
    
    try {
      // 获取商家基本信息
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select(`
          *,
          user_profiles!owner_id (
            name,
            phone
          )
        `)
        .eq('id', merchantId)
        .single();

      if (merchantError) throw merchantError;

      let merchantDetail: MerchantDetail = {
        ...merchantData,
        owner: merchantData.user_profiles
      };

      // 获取商品信息
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, is_available')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      merchantDetail.products = products || [];

      // 获取订单信息和营业额
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      merchantDetail.orders = orders || [];
      
      // 计算总营业额
      const revenue = orders
        ?.filter(order => ['confirmed', 'preparing', 'delivering', 'completed'].includes(order.status))
        .reduce((sum, order) => sum + order.total_amount, 0) || 0;
      
      merchantDetail.revenue = revenue;

      setSelectedMerchant(merchantDetail);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching merchant detail:', error);
      toast.error('获取商家详情失败');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStatusUpdate = async (merchantId: string, status: string) => {
    setUpdating(merchantId);
    
    try {
      // 同时更新 status 和 is_active 字段以确保数据一致性
      const updateData: { status: string; is_active?: boolean } = { status };
      
      // 根据状态设置 is_active 字段
      updateData.is_active = (status === 'active');
      
      const { error } = await supabase
        .from('merchants')
        .update(updateData)
        .eq('id', merchantId);

      if (error) throw error;
      
      const statusText = {
        'active': '激活',
        'suspended': '封停',
        'rejected': '拒绝',
        'pending': '设为待审核'
      }[status] || '更新';
      
      toast.success(`商家${statusText}成功`);
      
      // 重新获取数据
      fetchMerchants();
      onUpdate();
    } catch (error: any) {
      console.error('Error updating merchant status:', error);
      toast.error(`操作失败: ${error.message}`);
    } finally {
      setUpdating(null);
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

  const formatCurrency = (amount: number) => {
    return `¥${amount.toFixed(2)}`;
  };

  const getOrderStatusLabel = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      pending: { label: '待支付', color: 'text-yellow-600' },
      customer_paid: { label: '顾客称已支付', color: 'text-blue-600' },
      timeout_closed: { label: '超时关闭', color: 'text-gray-600' },
      merchant_confirmed: { label: '商家已确认收款/配送中', color: 'text-green-600' },
      customer_received: { label: '顾客已确认收货', color: 'text-green-600' },
      cancelled: { label: '已取消', color: 'text-red-600' }
    };
    return statusConfig[status] || { label: status, color: 'text-gray-600' };
  };

  const categories = [...new Set(merchants.map(m => m.category))];

  const filteredMerchants = merchants.filter(merchant => {
    const matchesSearch = merchant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         merchant.owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         merchant.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && merchant.status === 'active') ||
                         (statusFilter === 'pending' && merchant.status === 'pending') ||
                         (statusFilter === 'suspended' && merchant.status === 'suspended');
    const matchesCategory = categoryFilter === 'all' || merchant.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const activeCount = merchants.filter(m => m.status === 'active').length;
  const pendingCount = merchants.filter(m => m.status === 'pending').length;
  const suspendedCount = merchants.filter(m => m.status === 'suspended').length;

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">商家管理</h1>
        <p className="text-gray-600">
          共 {merchants.length} 个商家，{activeCount} 个已激活，{pendingCount} 个待审核，{suspendedCount} 个已封停
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">商家总数</p>
              <p className="text-2xl font-bold text-gray-900">{merchants.length}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <Store className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">已激活商家</p>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">待审核商家</p>
              <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">已封停商家</p>
              <p className="text-2xl font-bold text-red-600">{suspendedCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Ban className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索商家名称、店主姓名或手机号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="active">已激活</option>
              <option value="pending">待审核</option>
              <option value="suspended">已封停</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部类型</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Merchants List */}
      {filteredMerchants.length === 0 ? (
        <Empty
          icon={Store}
          title="暂无商家"
          description={searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' ? '没有找到匹配的商家' : '还没有商家注册'}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMerchants.map((merchant) => (
            <Card key={merchant.id} className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{merchant.name}</h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      merchant.status === 'active'
                        ? 'text-green-600 bg-green-100'
                        : merchant.status === 'suspended'
                        ? 'text-red-600 bg-red-100'
                        : merchant.status === 'rejected'
                        ? 'text-gray-600 bg-gray-100'
                        : 'text-orange-600 bg-orange-100'
                    }`}>
                      {merchant.status === 'active' ? '已激活' : 
                       merchant.status === 'suspended' ? '已封停' :
                       merchant.status === 'rejected' ? '已拒绝' : '待审核'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                    <Tag className="w-3 h-3" />
                    <span>{merchant.category}</span>
                  </div>
                  {merchant.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{merchant.description}</p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Phone className="w-3 h-3" />
                  <span>{merchant.phone}</span>
                </div>
                <div className="flex items-start space-x-2 text-sm text-gray-600">
                  <MapPin className="w-3 h-3 mt-0.5" />
                  <span className="line-clamp-2">{merchant.address}</span>
                </div>
              </div>

              {/* Owner Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">店主信息</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">{merchant.owner.name}</span>
                  <span className="text-gray-600">{merchant.owner.phone}</span>
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>注册于 {formatDate(merchant.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMerchantDetail(merchant.id)}
                  disabled={loadingDetail}
                  className="text-blue-600 border-blue-200"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  查看详情
                </Button>
                
                {merchant.status === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusUpdate(merchant.id, 'suspended')}
                    disabled={updating === merchant.id}
                    className="text-red-600 border-red-200"
                  >
                    <Ban className="w-3 h-3 mr-1" />
                    封停
                  </Button>
                ) : merchant.status === 'suspended' ? (
                  <Button
                    size="sm"
                    onClick={() => handleStatusUpdate(merchant.id, 'active')}
                    disabled={updating === merchant.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {updating === merchant.id ? '处理中...' : '解封'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleStatusUpdate(merchant.id, 'active')}
                    disabled={updating === merchant.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {updating === merchant.id ? '处理中...' : '激活'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Merchant Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="商家详情"
        size="lg"
      >
        {selectedMerchant && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">基本信息</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">商家名称:</span>
                    <p className="font-medium">{selectedMerchant.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">商家类型:</span>
                    <p className="font-medium">{selectedMerchant.category}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">联系电话:</span>
                    <p className="font-medium">{selectedMerchant.phone}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">状态:</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      selectedMerchant.status === 'active'
                        ? 'text-green-600 bg-green-100'
                        : selectedMerchant.status === 'suspended'
                        ? 'text-red-600 bg-red-100'
                        : selectedMerchant.status === 'rejected'
                        ? 'text-gray-600 bg-gray-100'
                        : 'text-orange-600 bg-orange-100'
                    }`}>
                      {selectedMerchant.status === 'active' ? '已激活' : 
                       selectedMerchant.status === 'suspended' ? '已封停' :
                       selectedMerchant.status === 'rejected' ? '已拒绝' : '待审核'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">商家地址:</span>
                  <p className="font-medium">{selectedMerchant.address}</p>
                </div>
                {selectedMerchant.description && (
                  <div>
                    <span className="text-sm text-gray-600">商家描述:</span>
                    <p className="font-medium">{selectedMerchant.description}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-600">注册时间:</span>
                  <p className="font-medium">{formatDate(selectedMerchant.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Owner Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">店主信息</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">店主姓名:</span>
                    <p className="font-medium">{selectedMerchant.owner.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">店主手机:</span>
                    <p className="font-medium">{selectedMerchant.owner.phone}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Business Stats */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">经营数据</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedMerchant.products?.length || 0}</p>
                  <p className="text-sm text-blue-700">商品数量</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedMerchant.orders?.length || 0}</p>
                  <p className="text-sm text-green-700">订单数量</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(selectedMerchant.revenue || 0)}</p>
                  <p className="text-sm text-purple-700">总营业额</p>
                </div>
              </div>
            </div>

            {/* Recent Products */}
            {selectedMerchant.products && selectedMerchant.products.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">商品列表 (最近10个)</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedMerchant.products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{formatCurrency(product.price)}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        product.is_available
                          ? 'text-green-600 bg-green-100'
                          : 'text-red-600 bg-red-100'
                      }`}>
                        {product.is_available ? '在售' : '下架'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Orders */}
            {selectedMerchant.orders && selectedMerchant.orders.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">订单记录 (最近10单)</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedMerchant.orders.map((order) => {
                    const statusInfo = getOrderStatusLabel(order.status);
                    
                    return (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{formatCurrency(order.total_amount)}</p>
                          <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                        </div>
                        <span className={`text-sm font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              {selectedMerchant.status === 'active' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleStatusUpdate(selectedMerchant.id, 'suspended');
                    setShowDetailModal(false);
                  }}
                  disabled={updating === selectedMerchant.id}
                  className="text-red-600 border-red-200"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  封停商家
                </Button>
              ) : selectedMerchant.status === 'suspended' ? (
                <Button
                  onClick={() => {
                    handleStatusUpdate(selectedMerchant.id, 'active');
                    setShowDetailModal(false);
                  }}
                  disabled={updating === selectedMerchant.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {updating === selectedMerchant.id ? '处理中...' : '解封商家'}
                </Button>
              ) : selectedMerchant.status === 'pending' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleStatusUpdate(selectedMerchant.id, 'rejected');
                      setShowDetailModal(false);
                    }}
                    disabled={updating === selectedMerchant.id}
                    className="text-gray-600 border-gray-200"
                  >
                    <X className="w-4 h-4 mr-2" />
                    拒绝
                  </Button>
                  <Button
                    onClick={() => {
                      handleStatusUpdate(selectedMerchant.id, 'active');
                      setShowDetailModal(false);
                    }}
                    disabled={updating === selectedMerchant.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {updating === selectedMerchant.id ? '处理中...' : '激活商家'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    handleStatusUpdate(selectedMerchant.id, 'pending');
                    setShowDetailModal(false);
                  }}
                  disabled={updating === selectedMerchant.id}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {updating === selectedMerchant.id ? '处理中...' : '重新审核'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}