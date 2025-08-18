import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import PageLayout from '../../components/layout/PageLayout';
import Button from '../../components/ui/Button';
import { toast } from 'sonner';
import {
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface DeliveryAddress {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export default function Profile() {
  const { user, userProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showNameForm, setShowNameForm] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  
  // 表单状态
  const [nameForm, setNameForm] = useState({ name: userProfile?.name || '' });
  const [phoneForm, setPhoneForm] = useState({ phone: userProfile?.phone || '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrent: false,
    showNew: false,
    showConfirm: false
  });
  const [addressForm, setAddressForm] = useState({
    name: '',
    phone: '',
    address: '',
    is_default: false
  });

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_addresses')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching addresses:', error);
        return;
      }

      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  const handleUpdateName = async () => {
    if (!nameForm.name.trim()) {
      toast.error('请输入姓名');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ name: nameForm.name.trim() })
        .eq('id', user?.id);

      if (error) {
        toast.error('更新姓名失败');
        return;
      }

      toast.success('姓名更新成功');
      setShowNameForm(false);
      // 刷新页面以获取最新数据
      window.location.reload();
    } catch (error) {
      toast.error('更新姓名失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhone = async () => {
    if (!phoneForm.phone.trim() || !/^1[3-9]\d{9}$/.test(phoneForm.phone)) {
      toast.error('请输入正确的手机号');
      return;
    }

    setLoading(true);
    try {
      // 更新用户配置表
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ phone: phoneForm.phone })
        .eq('id', user?.id);

      if (profileError) {
        toast.error('更新手机号失败');
        return;
      }

      // 注意：更新auth.users表的手机号需要特殊处理
      // 这里我们只更新用户配置表，auth表的更新需要通过Supabase的特殊API
      toast.success('手机号更新成功');
      setShowPhoneForm(false);
      window.location.reload();
    } catch (error) {
      toast.error('更新手机号失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('请填写完整信息');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('新密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast.error('密码更新失败：' + error.message);
        return;
      }

      toast.success('密码更新成功');
      setShowPasswordForm(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        showCurrent: false,
        showNew: false,
        showConfirm: false
      });
    } catch (error) {
      toast.error('密码更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!addressForm.name.trim() || !addressForm.phone.trim() || !addressForm.address.trim()) {
      toast.error('请填写完整的地址信息');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(addressForm.phone)) {
      toast.error('请输入正确的手机号');
      return;
    }

    setLoading(true);
    try {
      if (editingAddress) {
        // 更新地址
        const { error } = await supabase
          .from('delivery_addresses')
          .update({
            name: addressForm.name,
            phone: addressForm.phone,
            address: addressForm.address,
            is_default: addressForm.is_default
          })
          .eq('id', editingAddress.id);

        if (error) {
          toast.error('更新地址失败');
          return;
        }

        toast.success('地址更新成功');
      } else {
        // 新增地址
        const { error } = await supabase
          .from('delivery_addresses')
          .insert({
            user_id: user?.id,
            name: addressForm.name,
            phone: addressForm.phone,
            address: addressForm.address,
            is_default: addressForm.is_default
          });

        if (error) {
          toast.error('添加地址失败');
          return;
        }

        toast.success('地址添加成功');
      }

      // 如果设置为默认地址，需要取消其他地址的默认状态
      if (addressForm.is_default) {
        await supabase
          .from('delivery_addresses')
          .update({ is_default: false })
          .eq('user_id', user?.id)
          .neq('id', editingAddress?.id || '');
      }

      setShowAddressForm(false);
      setEditingAddress(null);
      setAddressForm({ name: '', phone: '', address: '', is_default: false });
      fetchAddresses();
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('确定要删除这个地址吗？')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('delivery_addresses')
        .delete()
        .eq('id', addressId);

      if (error) {
        toast.error('删除地址失败');
        return;
      }

      toast.success('地址删除成功');
      fetchAddresses();
    } catch (error) {
      toast.error('删除地址失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    setLoading(true);
    try {
      // 先取消所有地址的默认状态
      await supabase
        .from('delivery_addresses')
        .update({ is_default: false })
        .eq('user_id', user?.id);

      // 设置新的默认地址
      const { error } = await supabase
        .from('delivery_addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) {
        toast.error('设置默认地址失败');
        return;
      }

      toast.success('默认地址设置成功');
      fetchAddresses();
    } catch (error) {
      toast.error('设置默认地址失败');
    } finally {
      setLoading(false);
    }
  };

  const startEditAddress = (address: DeliveryAddress) => {
    setEditingAddress(address);
    setAddressForm({
      name: address.name,
      phone: address.phone,
      address: address.address,
      is_default: address.is_default
    });
    setShowAddressForm(true);
  };

  const startAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({ name: '', phone: '', address: '', is_default: false });
    setShowAddressForm(true);
  };

  if (!user || !userProfile) {
    return (
      <PageLayout title="个人中心">
        <div className="text-center py-8">
          <p className="text-gray-600">请先登录</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="个人中心">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 用户信息卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{userProfile.name}</h2>
              <p className="text-gray-600">{userProfile.phone}</p>
              <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {userProfile.user_type === 'customer' ? '顾客' : '商家'}
              </span>
            </div>
          </div>

          {/* 个人信息管理 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">个人信息管理</h3>
            
            {/* 姓名 */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <UserIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">姓名</p>
                  <p className="text-sm text-gray-600">{userProfile.name}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setNameForm({ name: userProfile.name });
                  setShowNameForm(true);
                }}
                className="text-blue-600 hover:text-blue-700"
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* 手机号 */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <PhoneIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">手机号</p>
                  <p className="text-sm text-gray-600">{userProfile.phone}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setPhoneForm({ phone: userProfile.phone });
                  setShowPhoneForm(true);
                }}
                className="text-blue-600 hover:text-blue-700"
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* 密码 */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <LockClosedIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">密码</p>
                  <p className="text-sm text-gray-600">••••••••</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowPasswordForm(true)}
                className="text-blue-600 hover:text-blue-700"
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 收货地址管理 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">收货地址</h3>
            <Button
              onClick={startAddAddress}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              添加地址
            </Button>
          </div>

          {addresses.length === 0 ? (
            <div className="text-center py-8">
              <MapPinIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">暂无收货地址</p>
              <Button
                onClick={startAddAddress}
                className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
              >
                添加第一个地址
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`p-4 border rounded-lg ${
                    address.is_default ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="font-medium text-gray-900">{address.name}</p>
                        <p className="text-sm text-gray-600">{address.phone}</p>
                        {address.is_default && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            默认
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{address.address}</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {!address.is_default && (
                        <Button
                          variant="ghost"
                          onClick={() => handleSetDefaultAddress(address.id)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          设为默认
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => startEditAddress(address)}
                        className="text-gray-600 hover:text-gray-700"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteAddress(address.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 账户操作 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">账户操作</h3>
          <Button
            onClick={signOut}
            variant="outline"
            className="w-full text-red-600 border-red-600 hover:bg-red-50"
          >
            退出登录
          </Button>
        </div>
      </div>

      {/* 修改姓名弹窗 */}
      {showNameForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">修改姓名</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  姓名
                </label>
                <input
                  type="text"
                  value={nameForm.name}
                  onChange={(e) => setNameForm({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入姓名"
                />
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowNameForm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleUpdateName}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                >
                  {loading ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 修改手机号弹窗 */}
      {showPhoneForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">修改手机号</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  手机号
                </label>
                <input
                  type="tel"
                  value={phoneForm.phone}
                  onChange={(e) => setPhoneForm({ phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入手机号"
                  maxLength={11}
                />
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowPhoneForm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleUpdatePhone}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                >
                  {loading ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 修改密码弹窗 */}
      {showPasswordForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">修改密码</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  当前密码
                </label>
                <div className="relative">
                  <input
                    type={passwordForm.showCurrent ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入当前密码"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordForm(prev => ({ ...prev, showCurrent: !prev.showCurrent }))}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {passwordForm.showCurrent ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  新密码
                </label>
                <div className="relative">
                  <input
                    type={passwordForm.showNew ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入新密码（至少6位）"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordForm(prev => ({ ...prev, showNew: !prev.showNew }))}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {passwordForm.showNew ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  确认新密码
                </label>
                <div className="relative">
                  <input
                    type={passwordForm.showConfirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请再次输入新密码"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordForm(prev => ({ ...prev, showConfirm: !prev.showConfirm }))}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {passwordForm.showConfirm ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: '',
                      showCurrent: false,
                      showNew: false,
                      showConfirm: false
                    });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleUpdatePassword}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                >
                  {loading ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 地址表单弹窗 */}
      {showAddressForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingAddress ? '编辑地址' : '添加地址'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  收货人姓名
                </label>
                <input
                  type="text"
                  value={addressForm.name}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入收货人姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  手机号
                </label>
                <input
                  type="tel"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入手机号"
                  maxLength={11}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  详细地址
                </label>
                <textarea
                  value={addressForm.address}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入详细地址"
                  rows={3}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={addressForm.is_default}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_default" className="ml-2 block text-sm text-gray-900">
                  设为默认地址
                </label>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    setShowAddressForm(false);
                    setEditingAddress(null);
                    setAddressForm({ name: '', phone: '', address: '', is_default: false });
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSaveAddress}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                >
                  {loading ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}