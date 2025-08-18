import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Gift, Calendar, Percent, DollarSign, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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
}

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  promotion_type: 'general' | 'product_specific' | 'category_specific' | 'minimum_amount';
  minimum_amount: number;
  applicable_products: string[];
  applicable_categories: string[];
  max_usage_count?: number;
  current_usage_count: number;
  max_usage_per_customer?: number;
  max_usage_product_count?: number;
  current_usage_product_count: number;
}

interface PromotionFormData {
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  promotion_type: 'general' | 'product_specific' | 'category_specific' | 'minimum_amount';
  minimum_amount: string;
  applicable_products: string[];
  applicable_categories: string[];
  max_usage_count: string;
  max_usage_per_customer: string;
  max_usage_product_count: string;
}

interface Props {
  merchant: Merchant | null;
}

export default function PromotionManagement({ merchant }: Props) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>({
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    start_date: '',
    end_date: '',
    is_active: true,
    promotion_type: 'general',
    minimum_amount: '',
    applicable_products: [],
    applicable_categories: [],
    max_usage_count: '',
    max_usage_per_customer: '',
    max_usage_product_count: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<{id: string, name: string, category: string}[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (merchant?.id) {
      fetchPromotions();
      fetchProducts();
    }
  }, [merchant?.id]);

  const fetchProducts = async () => {
    if (!merchant?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category')
        .eq('merchant_id', merchant.id)
        .eq('is_available', true);

      if (error) throw error;
      
      const productList = data || [];
      setProducts(productList);
      
      // 提取所有分类
      const uniqueCategories = [...new Set(productList.map(p => p.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchPromotions = async () => {
    if (!merchant?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast.error('获取优惠活动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (promotion?: Promotion) => {
    if (promotion) {
      setEditingPromotion(promotion);
      setFormData({
        title: promotion.title,
        description: promotion.description,
        discount_type: promotion.discount_type,
        discount_value: promotion.discount_value.toString(),
        start_date: new Date(promotion.start_date).toISOString().slice(0, 16),
        end_date: new Date(promotion.end_date).toISOString().slice(0, 16),
        is_active: promotion.is_active,
        promotion_type: promotion.promotion_type || 'general',
        minimum_amount: promotion.minimum_amount?.toString() || '',
        applicable_products: promotion.applicable_products || [],
        applicable_categories: promotion.applicable_categories || [],
        max_usage_count: promotion.max_usage_count?.toString() || '',
        max_usage_per_customer: promotion.max_usage_per_customer?.toString() || '',
        max_usage_product_count: promotion.max_usage_product_count?.toString() || ''
      });
    } else {
      setEditingPromotion(null);
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      setFormData({
        title: '',
        description: '',
        discount_type: 'percentage',
        discount_value: '',
        start_date: now.toISOString().slice(0, 16),
        end_date: tomorrow.toISOString().slice(0, 16),
        is_active: true,
        promotion_type: 'general',
        minimum_amount: '',
        applicable_products: [],
        applicable_categories: [],
        max_usage_count: '',
        max_usage_per_customer: '',
        max_usage_product_count: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPromotion(null);
    setFormData({
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      start_date: '',
      end_date: '',
      is_active: true,
      promotion_type: 'general',
      minimum_amount: '',
      applicable_products: [],
      applicable_categories: [],
      max_usage_count: '',
      max_usage_per_customer: '',
      max_usage_product_count: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant?.id) return;

    // 验证表单
    if (!formData.title.trim()) {
      toast.error('请输入活动标题');
      return;
    }

    if (!formData.discount_value || parseFloat(formData.discount_value) <= 0) {
      toast.error('请输入有效的优惠金额');
      return;
    }

    if (formData.discount_type === 'percentage' && parseFloat(formData.discount_value) > 100) {
      toast.error('折扣百分比不能超过100%');
      return;
    }

    if (new Date(formData.start_date) >= new Date(formData.end_date)) {
      toast.error('结束时间必须晚于开始时间');
      return;
    }

    if (formData.promotion_type === 'product_specific' && formData.applicable_products.length === 0) {
      toast.error('请至少选择一个适用商品');
      return;
    }

    if (formData.promotion_type === 'category_specific' && formData.applicable_categories.length === 0) {
      toast.error('请至少选择一个适用分类');
      return;
    }

    setSubmitting(true);
    
    try {
      const promotionData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        is_active: formData.is_active,
        promotion_type: formData.promotion_type,
        minimum_amount: formData.minimum_amount ? parseFloat(formData.minimum_amount) : 0,
        applicable_products: formData.applicable_products,
        applicable_categories: formData.applicable_categories,
        max_usage_count: formData.max_usage_count ? parseInt(formData.max_usage_count) : null,
        max_usage_per_customer: formData.max_usage_per_customer ? parseInt(formData.max_usage_per_customer) : null,
        max_usage_product_count: formData.max_usage_product_count ? parseInt(formData.max_usage_product_count) : null,
        merchant_id: merchant.id
      };

      if (editingPromotion) {
        // 更新活动
        const { error } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', editingPromotion.id);

        if (error) throw error;
        toast.success('优惠活动更新成功');
      } else {
        // 创建活动
        const { error } = await supabase
          .from('promotions')
          .insert(promotionData);

        if (error) throw error;
        toast.success('优惠活动创建成功');
      }

      handleCloseModal();
      fetchPromotions();
    } catch (error) {
      console.error('Error saving promotion:', error);
      toast.error('保存优惠活动失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (promotion: Promotion) => {
    if (!confirm(`确定要删除优惠活动「${promotion.title}」吗？`)) return;
    
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promotion.id);

      if (error) throw error;
      
      toast.success('优惠活动删除成功');
      fetchPromotions();
    } catch (error) {
      console.error('Error deleting promotion:', error);
      toast.error('删除优惠活动失败');
    }
  };

  const toggleActive = async (promotion: Promotion) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !promotion.is_active })
        .eq('id', promotion.id);

      if (error) throw error;
      
      toast.success(`优惠活动已${promotion.is_active ? '停用' : '启用'}`);
      fetchPromotions();
    } catch (error) {
      console.error('Error toggling promotion:', error);
      toast.error('操作失败');
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

  const formatDiscount = (type: string, value: number) => {
    if (type === 'percentage') {
      return `${value}% 折扣`;
    } else {
      return `减 ¥${value.toFixed(2)}`;
    }
  };

  const getPromotionTypeLabel = (type: string) => {
    const typeLabels = {
      general: '通用优惠',
      minimum_amount: '满减优惠',
      product_specific: '指定商品',
      category_specific: '指定分类'
    };
    return typeLabels[type as keyof typeof typeLabels] || type;
  };

  const getPromotionStatus = (promotion: Promotion) => {
    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);

    if (!promotion.is_active) {
      return { label: '已停用', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }

    if (now < startDate) {
      return { label: '未开始', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    }

    if (now > endDate) {
      return { label: '已结束', color: 'text-red-600', bgColor: 'bg-red-100' };
    }

    return { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100' };
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">优惠活动</h1>
          <p className="text-gray-600">创建和管理您的促销活动</p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          创建活动
        </Button>
      </div>

      {/* Promotions List */}
      {promotions.length === 0 ? (
        <div className="text-center py-12">
          <Empty
            icon={Gift}
            title="暂无优惠活动"
            description="创建优惠活动来吸引更多顾客"
          />
          <div className="mt-6">
            <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              创建活动
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {promotions.map((promotion) => {
            const status = getPromotionStatus(promotion);
            
            return (
              <Card key={promotion.id} className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{promotion.title}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        status.color
                      } ${status.bgColor}`}>
                        {status.label}
                      </span>
                    </div>
                    
                    {/* Promotion Type Badge */}
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        {getPromotionTypeLabel(promotion.promotion_type)}
                      </span>
                      {promotion.promotion_type === 'minimum_amount' && (
                        <span className="text-xs text-gray-600">
                          满{formatCurrency(promotion.minimum_amount)}可用
                        </span>
                      )}
                      {(promotion.max_usage_count || promotion.max_usage_per_customer || promotion.max_usage_product_count) && (
                        <span className="text-xs text-gray-600">
                          {promotion.max_usage_count && `限${promotion.max_usage_count}次`}
                          {promotion.max_usage_per_customer && `每人限${promotion.max_usage_per_customer}次`}
                          {promotion.max_usage_product_count && `限${promotion.max_usage_product_count}件商品`}
                        </span>
                      )}
                    </div>
                    
                    {promotion.description && (
                      <p className="text-sm text-gray-600 mb-3">{promotion.description}</p>
                    )}
                  </div>
                </div>

                {/* Discount Info */}
                <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-3">
                    {promotion.discount_type === 'percentage' ? (
                      <Percent className="w-8 h-8 text-orange-600" />
                    ) : (
                      <DollarSign className="w-8 h-8 text-orange-600" />
                    )}
                    <div>
                      <p className="text-lg font-bold text-orange-900">
                        {formatDiscount(promotion.discount_type, promotion.discount_value)}
                      </p>
                      <p className="text-sm text-orange-700">
                        {promotion.discount_type === 'percentage' ? '百分比折扣' : '固定金额减免'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>开始: {formatDate(promotion.start_date)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>结束: {formatDate(promotion.end_date)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(promotion)}
                    className={promotion.is_active ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}
                  >
                    {promotion.is_active ? (
                      <><EyeOff className="w-3 h-3 mr-1" />停用</>
                    ) : (
                      <><Eye className="w-3 h-3 mr-1" />启用</>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal(promotion)}
                    className="text-blue-600 border-blue-200"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    编辑
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(promotion)}
                    className="text-red-600 border-red-200"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Promotion Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingPromotion ? '编辑优惠活动' : '创建优惠活动'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">活动标题 *</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="请输入活动标题"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">活动描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="请输入活动描述"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Promotion Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">优惠活动类型 *</label>
            <select
              value={formData.promotion_type}
              onChange={(e) => setFormData(prev => ({ ...prev, promotion_type: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="general">通用优惠</option>
              <option value="minimum_amount">满减优惠</option>
              <option value="product_specific">指定商品优惠</option>
              <option value="category_specific">指定分类优惠</option>
            </select>
          </div>

          {/* Minimum Amount for minimum_amount type */}
          {formData.promotion_type === 'minimum_amount' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">最低消费金额 (元) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.minimum_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, minimum_amount: e.target.value }))}
                placeholder="50.00"
                required
              />
            </div>
          )}

          {/* Product Selection for product_specific type */}
          {formData.promotion_type === 'product_specific' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择适用商品 *</label>
              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="text-gray-500 text-sm">暂无可选商品</p>
                ) : (
                  <div className="space-y-2">
                    {products.map(product => (
                      <label key={product.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.applicable_products.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                applicable_products: [...prev.applicable_products, product.id]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                applicable_products: prev.applicable_products.filter(id => id !== product.id)
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{product.name}</span>
                        <span className="text-xs text-gray-500">({product.category})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {formData.applicable_products.length === 0 && (
                <p className="text-red-500 text-xs mt-1">请至少选择一个商品</p>
              )}
            </div>
          )}

          {/* Category Selection for category_specific type */}
          {formData.promotion_type === 'category_specific' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择适用分类 *</label>
              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-gray-500 text-sm">暂无可选分类</p>
                ) : (
                  <div className="space-y-2">
                    {categories.map(category => (
                      <label key={category} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.applicable_categories.includes(category)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                applicable_categories: [...prev.applicable_categories, category]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                applicable_categories: prev.applicable_categories.filter(cat => cat !== category)
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{category}</span>
                        <span className="text-xs text-gray-500">
                          ({products.filter(p => p.category === category).length} 个商品)
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {formData.applicable_categories.length === 0 && (
                <p className="text-red-500 text-xs mt-1">请至少选择一个分类</p>
              )}
            </div>
          )}

          {/* Discount Type and Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">优惠方式 *</label>
              <select
                value={formData.discount_type}
                onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value as 'percentage' | 'fixed_amount' }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="percentage">百分比折扣</option>
                <option value="fixed_amount">固定金额减免</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.discount_type === 'percentage' ? '折扣百分比 (%)' : '减免金额 (元)'} *
              </label>
              <Input
                type="number"
                step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                min="0"
                max={formData.discount_type === 'percentage' ? '100' : undefined}
                value={formData.discount_value}
                onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                placeholder={formData.discount_type === 'percentage' ? '10' : '5.00'}
                required
              />
            </div>
          </div>

          {/* Usage Limits */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">总使用次数限制</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_usage_count}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_usage_count: e.target.value }))}
                  placeholder="不限制请留空"
                />
                <p className="text-xs text-gray-500 mt-1">限制优惠券被使用的总次数</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">每人使用次数限制</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_usage_per_customer}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_usage_per_customer: e.target.value }))}
                  placeholder="不限制请留空"
                />
                <p className="text-xs text-gray-500 mt-1">限制每个顾客使用优惠券的次数</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">最大使用商品数限制</label>
              <Input
                type="number"
                min="1"
                value={formData.max_usage_product_count}
                onChange={(e) => setFormData(prev => ({ ...prev, max_usage_product_count: e.target.value }))}
                placeholder="不限制请留空"
              />
              <p className="text-xs text-gray-500 mt-1">限制使用优惠券的商品总数量（推荐使用此限制方式）</p>
            </div>
          </div>

          {/* Start and End Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">开始时间 *</label>
              <input
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">结束时间 *</label>
              <input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Active Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={formData.is_active}
                  onChange={() => setFormData(prev => ({ ...prev, is_active: true }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">启用</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!formData.is_active}
                  onChange={() => setFormData(prev => ({ ...prev, is_active: false }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">停用</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? '保存中...' : (editingPromotion ? '更新活动' : '创建活动')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}