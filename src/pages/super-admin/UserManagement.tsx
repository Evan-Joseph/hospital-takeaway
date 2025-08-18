import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, Ban, CheckCircle, Users, Phone, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Loading from '../../components/ui/Loading';
import Empty from '../../components/Empty';
import { toast } from 'sonner';

interface User {
  id: string;
  phone: string;
  name: string;
  user_type: 'customer' | 'merchant';
  created_at: string;
  last_sign_in_at?: string;
}

interface UserDetail extends User {
  merchants?: {
    id: string;
    name: string;
    category: string;
    is_active: boolean;
  }[];
  orders?: {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
  }[];
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .neq('user_type', 'super_admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetail = async (userId: string) => {
    setLoadingDetail(true);
    
    try {
      // 获取用户基本信息
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      let userDetail: UserDetail = userProfile;

      // 如果是商家用户，获取商家信息
      if (userProfile.user_type === 'merchant') {
        const { data: merchants } = await supabase
          .from('merchants')
          .select('id, name, category, is_active')
          .eq('owner_id', userId);
        
        userDetail.merchants = merchants || [];
      }

      // 获取用户订单信息（如果是顾客）
      if (userProfile.user_type === 'customer') {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, total_amount, status, created_at')
          .eq('customer_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        userDetail.orders = orders || [];
      }

      setSelectedUser(userDetail);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching user detail:', error);
      toast.error('获取用户详情失败');
    } finally {
      setLoadingDetail(false);
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

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'customer':
        return { label: '顾客', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'merchant':
        return { label: '商家', color: 'text-green-600', bgColor: 'bg-green-100' };
      default:
        return { label: '未知', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phone.includes(searchTerm);
    const matchesType = userTypeFilter === 'all' || user.user_type === userTypeFilter;
    return matchesSearch && matchesType;
  });

  const customerCount = users.filter(u => u.user_type === 'customer').length;
  const merchantCount = users.filter(u => u.user_type === 'merchant').length;

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
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <p className="text-gray-600">
          共 {users.length} 个用户，其中 {customerCount} 个顾客，{merchantCount} 个商家
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总用户数</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">顾客用户</p>
              <p className="text-2xl font-bold text-blue-600">{customerCount}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">商家用户</p>
              <p className="text-2xl font-bold text-green-600">{merchantCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索用户姓名或手机号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部用户</option>
              <option value="customer">顾客</option>
              <option value="merchant">商家</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <Empty
          icon={Users}
          title="暂无用户"
          description={searchTerm || userTypeFilter !== 'all' ? '没有找到匹配的用户' : '还没有用户注册'}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户类型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    注册时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最后登录
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const userType = getUserTypeLabel(user.user_type);
                  
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {user.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          userType.color
                        } ${userType.bgColor}`}>
                          {userType.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(user.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : '从未登录'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchUserDetail(user.id)}
                          disabled={loadingDetail}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          查看详情
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* User Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="用户详情"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">基本信息</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">姓名:</span>
                  <span className="font-medium">{selectedUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">手机号:</span>
                  <span className="font-medium">{selectedUser.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">用户类型:</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    getUserTypeLabel(selectedUser.user_type).color
                  } ${getUserTypeLabel(selectedUser.user_type).bgColor}`}>
                    {getUserTypeLabel(selectedUser.user_type).label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">注册时间:</span>
                  <span>{formatDate(selectedUser.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">最后登录:</span>
                  <span>{selectedUser.last_sign_in_at ? formatDate(selectedUser.last_sign_in_at) : '从未登录'}</span>
                </div>
              </div>
            </div>

            {/* Merchant Info */}
            {selectedUser.user_type === 'merchant' && selectedUser.merchants && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">商家信息</h3>
                {selectedUser.merchants.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暂无商家信息</p>
                ) : (
                  <div className="space-y-3">
                    {selectedUser.merchants.map((merchant) => (
                      <div key={merchant.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{merchant.name}</h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            merchant.is_active 
                              ? 'text-green-600 bg-green-100' 
                              : 'text-red-600 bg-red-100'
                          }`}>
                            {merchant.is_active ? '已激活' : '未激活'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">类型: {merchant.category}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Order History */}
            {selectedUser.user_type === 'customer' && selectedUser.orders && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">订单历史 (最近10单)</h3>
                {selectedUser.orders.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暂无订单记录</p>
                ) : (
                  <div className="space-y-3">
                    {selectedUser.orders.map((order) => {
                      const statusInfo = getOrderStatusLabel(order.status);
                      
                      return (
                        <div key={order.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">{formatCurrency(order.total_amount)}</span>
                            <span className={`text-sm font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}