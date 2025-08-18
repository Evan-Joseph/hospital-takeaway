import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Search, Filter, Eye, EyeOff } from 'lucide-react';
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
  category?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  stock_quantity: number;
  is_available: boolean;
  created_at: string;
}

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  stock_quantity: string;
  is_available: boolean;
  image_file?: File;
}

interface Props {
  merchant: Merchant | null;
}

import { PRODUCT_CATEGORIES, getProductCategoriesForMerchant, getCategoryIcon, getCategoryColors } from '../../constants/categories';

export default function MenuManagement({ merchant }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // 根据商家类型获取可用的商品分类
  const availableCategories = merchant?.category 
    ? getProductCategoriesForMerchant(merchant.category)
    : PRODUCT_CATEGORIES;
  
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    category: availableCategories[0],
    stock_quantity: '',
    is_available: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    if (merchant?.id) {
      fetchProducts();
    }
  }, [merchant?.id]);

  const fetchProducts = async () => {
    if (!merchant?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('获取商品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        category: product.category,
        stock_quantity: product.stock_quantity.toString(),
        is_available: product.is_available
      });
      setImagePreview(product.image_url || '');
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        category: availableCategories[0],
        stock_quantity: '',
        is_available: true
      });
      setImagePreview('');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: availableCategories[0],
      stock_quantity: '',
      is_available: true
    });
    setImagePreview('');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, image_file: file }));
      
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    try {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件（JPG、PNG、GIF等格式）');
      }

      // 验证文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('图片大小不能超过10MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      console.log('开始上传图片:', { fileName, filePath, fileSize: file.size });

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('图片上传失败:', uploadError);
        throw new Error(`上传失败: ${uploadError.message}`);
      }

      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      console.log('图片上传成功:', data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error('uploadImage error:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant?.id) return;

    setSubmitting(true);
    
    try {
      let imageUrl = editingProduct?.image_url || '';
      
      // 上传新图片
      if (formData.image_file) {
        try {
          imageUrl = await uploadImage(formData.image_file);
        } catch (uploadError) {
          console.error('图片上传失败:', uploadError);
          toast.error(uploadError instanceof Error ? uploadError.message : '图片上传失败，请重试');
          setSubmitting(false);
          return;
        }
      }

      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        stock_quantity: parseInt(formData.stock_quantity),
        is_available: formData.is_available,
        image_url: imageUrl,
        merchant_id: merchant.id
      };

      if (editingProduct) {
        // 更新商品
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('商品更新成功');
      } else {
        // 创建商品
        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) throw error;
        toast.success('商品创建成功');
      }

      handleCloseModal();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('保存商品失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`确定要删除商品「${product.name}」吗？`)) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;
      
      toast.success('商品删除成功');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('删除商品失败');
    }
  };

  const toggleAvailability = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available: !product.is_available })
        .eq('id', product.id);

      if (error) throw error;
      
      toast.success(`商品已${product.is_available ? '下架' : '上架'}`);
      fetchProducts();
    } catch (error) {
      console.error('Error toggling availability:', error);
      toast.error('操作失败');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
          <h1 className="text-2xl font-bold text-gray-900">菜单管理</h1>
          <p className="text-gray-600">管理您的商品信息</p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加商品
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索商品名称或描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">全部分类</option>
                {availableCategories.map(category => {
                  const colors = getCategoryColors(category);
                  return (
                    <option key={category} value={category}>
                      {getCategoryIcon(category)} {category}
                    </option>
                  );
                })}
              </select>
          </div>
        </div>
      </Card>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Empty
            icon={Package}
            title="暂无商品"
            description={searchTerm || selectedCategory !== 'all' ? '没有找到匹配的商品' : '还没有添加任何商品'}
          />
          <div className="mt-6">
            <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              添加商品
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              {/* Product Image */}
              <div className="aspect-video bg-gray-100 relative">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Package className="w-12 h-12" />
                  </div>
                )}
                
                {/* Availability Badge */}
                <div className="absolute top-2 right-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    product.is_available
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.is_available ? '在售' : '下架'}
                  </span>
                </div>
              </div>
              
              {/* Product Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                  <span className="text-lg font-bold text-blue-600 ml-2">¥{product.price.toFixed(2)}</span>
                </div>
                
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    getCategoryColors(product.category).bg
                  } ${
                    getCategoryColors(product.category).text
                  }`}>
                    {getCategoryIcon(product.category)} {product.category}
                  </span>
                  <span>库存: {product.stock_quantity}</span>
                </div>
                
                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAvailability(product)}
                    className={product.is_available ? 'text-red-600 border-red-200' : 'text-green-600 border-green-200'}
                  >
                    {product.is_available ? (
                      <><EyeOff className="w-3 h-3 mr-1" />下架</>
                    ) : (
                      <><Eye className="w-3 h-3 mr-1" />上架</>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal(product)}
                    className="text-blue-600 border-blue-200"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    编辑
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product)}
                    className="text-red-600 border-red-200"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Product Form Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingProduct ? '编辑商品' : '添加商品'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">商品图片</label>
            <div className="flex items-center space-x-4">
              {imagePreview && (
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="预览" className="w-full h-full object-cover" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">商品名称 *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="请输入商品名称"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">商品描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="请输入商品描述"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Price and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">价格 (元) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">分类 *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {getCategoryIcon(category)} {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock and Availability */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">库存数量 *</label>
              <Input
                type="number"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
              <div className="flex items-center space-x-4 pt-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={formData.is_available}
                    onChange={() => setFormData(prev => ({ ...prev, is_available: true }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">上架</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!formData.is_available}
                    onChange={() => setFormData(prev => ({ ...prev, is_available: false }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">下架</span>
                </label>
              </div>
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
              {submitting ? '保存中...' : (editingProduct ? '更新商品' : '添加商品')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}