import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Store, Phone, MapPin, Tag, FileText, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Loading from '../../components/ui/Loading';
import { toast } from 'sonner';

interface Merchant {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string;
  is_active: boolean;
}

interface StoreFormData {
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string;
}

interface Props {
  merchant: Merchant | null;
  onUpdate: () => void;
}

import { MERCHANT_CATEGORIES, getCategoryIcon, getCategoryColors } from '../../constants/categories';

export default function StoreProfile({ merchant, onUpdate }: Props) {
  const [searchParams] = useSearchParams();
  const isSetup = searchParams.get('setup') === 'true';
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<StoreFormData>({
    name: '',
    description: '',
    category: MERCHANT_CATEGORIES[0],
    address: '',
    phone: ''
  });

  useEffect(() => {
    if (merchant) {
      setFormData({
        name: merchant.name,
        description: merchant.description || '',
        category: merchant.category,
        address: merchant.address,
        phone: merchant.phone
      });
    } else if (user) {
      // 如果是新建，预填用户手机号
      setFormData(prev => ({
        ...prev,
        phone: user.phone || ''
      }));
    }
  }, [merchant, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // 验证表单
    if (!formData.name.trim()) {
      toast.error('请输入店铺名称');
      return;
    }

    if (!formData.address.trim()) {
      toast.error('请输入店铺地址');
      return;
    }

    if (!formData.phone.trim()) {
      toast.error('请输入联系电话');
      return;
    }

    setSubmitting(true);
    
    try {
      const storeData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        owner_id: user.id
      };

      if (merchant) {
        // 更新店铺信息
        const { error } = await supabase
          .from('merchants')
          .update(storeData)
          .eq('id', merchant.id);

        if (error) throw error;
        toast.success('店铺信息更新成功');
      } else {
        // 创建店铺
        const { error } = await supabase
          .from('merchants')
          .insert({
            ...storeData,
            is_active: false // 新店铺默认未激活，需要管理员审核
          });

        if (error) throw error;
        toast.success('店铺信息创建成功，等待管理员审核');
      }

      onUpdate();
    } catch (error) {
      console.error('Error saving store info:', error);
      toast.error('保存店铺信息失败');
    } finally {
      setSubmitting(false);
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isSetup ? '完善店铺信息' : '店铺信息'}
        </h1>
        <p className="text-gray-600">
          {isSetup 
            ? '请完善您的店铺信息以开始使用商家后台' 
            : '管理您的店铺基本信息'
          }
        </p>
      </div>

      {/* Setup Notice */}
      {isSetup && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">首次设置</p>
              <p className="text-sm text-blue-700">
                完善店铺信息后，您的店铺将提交给管理员审核，审核通过后即可正常营业
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Store Status */}
      {merchant && (
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            {merchant.is_active ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">店铺已激活</p>
                  <p className="text-sm text-green-700">您的店铺正在正常营业中</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-900">店铺未激活</p>
                  <p className="text-sm text-yellow-700">您的店铺正在等待管理员审核，审核通过后即可营业</p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Store Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Store Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Store className="inline w-4 h-4 mr-1" />
              店铺名称 *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="请输入店铺名称"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="inline w-4 h-4 mr-1" />
              店铺类型 *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {MERCHANT_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline w-4 h-4 mr-1" />
              店铺描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="请输入店铺描述，介绍您的特色和服务"
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline w-4 h-4 mr-1" />
              店铺地址 *
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="请输入详细的店铺地址，如：3号楼1层101室"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="inline w-4 h-4 mr-1" />
              联系电话 *
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="请输入联系电话"
              required
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {submitting ? '保存中...' : (merchant ? '更新信息' : '创建店铺')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Tips */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">温馨提示</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start space-x-2">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
            <p>店铺信息将显示给顾客，请确保信息准确完整</p>
          </div>
          <div className="flex items-start space-x-2">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
            <p>新店铺需要管理员审核后才能正常营业</p>
          </div>
          <div className="flex items-start space-x-2">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
            <p>联系电话将用于顾客咨询和订单沟通</p>
          </div>
          <div className="flex items-start space-x-2">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
            <p>请及时更新店铺信息以保持信息的时效性</p>
          </div>
        </div>
      </Card>

      {/* Business Hours Notice */}
      <Card className="p-6 bg-green-50 border-green-200">
        <div className="flex items-center space-x-2 mb-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-green-900">营业时间说明</h3>
        </div>
        <p className="text-sm text-green-700">
          目前平台支持24小时营业模式，您可以随时接收和处理订单。
          如需设置特定营业时间，请联系平台管理员。
        </p>
      </Card>
    </div>
  );
}