import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, Merchant, Product } from '../../lib/supabase'
import { useCartStore } from '../../stores/cartStore'
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import PageLayout from '../../components/layout/PageLayout';
import { 
  BuildingStorefrontIcon,
  MapPinIcon,
  PhoneIcon,
  ShoppingCartIcon,
  MinusIcon,
  PlusIcon,
  GiftIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import { getCategoryIcon, getCategoryColors } from '../../constants/categories';
import { toast } from 'sonner'

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  promotion_type: 'general' | 'product_specific' | 'category_specific' | 'minimum_amount';
  minimum_amount: number;
  max_usage_count?: number;
  current_usage_count: number;
  max_usage_per_customer?: number;
}

export default function MerchantDetail() {
  const { id } = useParams<{ id: string }>()
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [productCategories, setProductCategories] = useState<string[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  
  const { addItem, getTotalItems } = useCartStore()
  const cartItemsCount = getTotalItems()

  useEffect(() => {
    if (id) {
      fetchMerchantData()
    }
  }, [id])

  const fetchMerchantData = async () => {
    try {
      // 获取商家信息
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single()

      if (merchantError) {
        console.error('Error fetching merchant:', merchantError)
        return
      }

      setMerchant(merchantData)

      // 获取商品列表
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', id)
        .eq('is_available', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (productsError) {
        console.error('Error fetching products:', productsError)
        return
      }

      setProducts(productsData || [])
      
      // 提取商品分类
      const categories = [...new Set(productsData?.map(p => p.category).filter(Boolean) || [])]
      setProductCategories(categories)
      
      // 获取优惠活动
      const { data: promotionsData, error: promotionsError } = await supabase
        .from('promotions')
        .select('*')
        .eq('merchant_id', id)
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString())
        .lte('start_date', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (promotionsError) {
        console.error('Error fetching promotions:', promotionsError)
      } else {
        setPromotions(promotionsData || [])
        

      }
    } catch (error) {
      console.error('Error fetching merchant data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(product => {
    if (selectedCategory === 'all') return true
    return product.category === selectedCategory
  })

  const updateQuantity = (productId: string, change: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) + change)
    }))
  }

  const addToCart = async (product: Product) => {
    const quantity = quantities[product.id] || 1
    
    // 检查库存
    if (quantity > product.stock_quantity) {
      toast.error(`库存不足，${product.name} 仅剩 ${product.stock_quantity} 件`)
      return
    }
    
    // 检查购物车中是否已有该商品
    const { items } = useCartStore.getState()
    const existingItem = items.find(item => 
      item.productId === product.id && item.merchantId === product.merchant_id
    )
    const totalQuantityAfterAdd = (existingItem?.quantity || 0) + quantity
    
    if (totalQuantityAfterAdd > product.stock_quantity) {
      toast.error(`库存不足，${product.name} 仅剩 ${product.stock_quantity} 件，购物车中已有 ${existingItem?.quantity || 0} 件`)
      return
    }
    
    addItem(product, quantity, merchant?.name || '')
    toast.success(`已添加 ${quantity} 个 ${product.name} 到购物车`)
    setQuantities(prev => ({ ...prev, [product.id]: 0 }))
  }



  if (loading) {
    return (
      <PageLayout title="商家详情" backPath="/merchants">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载商家信息...</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  if (!merchant) {
    return (
      <PageLayout title="商家详情" backPath="/merchants">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <BuildingStorefrontIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">商家不存在</h3>
            <p className="mt-1 text-sm text-gray-500">该商家可能已下线或不存在</p>
            <Link to="/merchants" className="mt-4 inline-block text-blue-600 hover:text-blue-500">
              返回商家列表
            </Link>
          </div>
        </div>
      </PageLayout>
    )
  }

  const rightElement = (
    <Link to="/cart" className="relative">
      <ShoppingCartIcon className="h-6 w-6 text-gray-600" />
      {cartItemsCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {cartItemsCount}
        </span>
      )}
    </Link>
  )

  return (
    <PageLayout 
      title={merchant.name} 
      backPath="/merchants" 
      rightElement={rightElement}
      contentClassName="max-w-2xl"
    >
        {/* 商家信息 */}
        <Card className="mb-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 bg-blue-100 rounded-lg flex items-center justify-center">
                <BuildingStorefrontIcon className="h-10 w-10 text-blue-600" />
              </div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{merchant.name}</h2>
              
              <div className="flex items-center mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  getCategoryColors(merchant.category).bg
                } ${
                  getCategoryColors(merchant.category).text
                }`}>
                  {getCategoryIcon(merchant.category)} {merchant.category}
                </span>
              </div>
              
              {merchant.description && (
                <p className="mt-3 text-gray-600">{merchant.description}</p>
              )}
              
              <div className="mt-4 space-y-2">
                <div className="flex items-center text-sm text-gray-500">
                  <MapPinIcon className="h-4 w-4 mr-2" />
                  <span>{merchant.address}</span>
                </div>
                
                <div className="flex items-center text-sm text-gray-500">
                  <PhoneIcon className="h-4 w-4 mr-2" />
                  <span>{merchant.phone}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 优惠活动 */}
        {promotions.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <GiftIcon className="h-5 w-5 mr-2 text-red-500" />
              优惠活动
            </h3>
            <div className="space-y-3">
              {promotions.map(promotion => {
                const formatDiscount = (type: string, value: number) => {
                  return type === 'percentage' ? `${value}%` : `¥${value.toFixed(2)}`;
                };
                
                const getPromotionTypeLabel = (type: string) => {
                  const typeLabels = {
                    general: '通用优惠',
                    minimum_amount: '满减优惠',
                    product_specific: '指定商品',
                    category_specific: '指定分类'
                  };
                  return typeLabels[type as keyof typeof typeLabels] || '通用优惠';
                };
                
                return (
                  <Card key={promotion.id} className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                          <TagIcon className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{promotion.title}</h4>
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            {getPromotionTypeLabel(promotion.promotion_type)}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 mb-2">
                          <span className="text-lg font-bold text-red-600">
                            {promotion.discount_type === 'percentage' ? '打' : '减'}
                            {formatDiscount(promotion.discount_type, promotion.discount_value)}
                            {promotion.discount_type === 'percentage' ? '折' : ''}
                          </span>
                          
                          {promotion.promotion_type === 'minimum_amount' && (
                            <span className="text-sm text-gray-600">
                              满¥{promotion.minimum_amount.toFixed(2)}可用
                            </span>
                          )}
                          
                          {(promotion.max_usage_count || promotion.max_usage_per_customer) && (
                            <span className="text-xs text-gray-500">
                              {promotion.max_usage_count && `限${promotion.max_usage_count}次`}
                              {promotion.max_usage_per_customer && `每人限${promotion.max_usage_per_customer}次`}
                            </span>
                          )}
                        </div>
                        
                        {promotion.description && (
                          <p className="text-sm text-gray-600">{promotion.description}</p>
                        )}
                        
                        <p className="text-xs text-gray-500 mt-1">
                          有效期至：{new Date(promotion.end_date).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 商品分类筛选 */}
        {productCategories.length > 0 && (
          <div className="mb-6">
            <div className="flex space-x-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                全部商品
              </button>
              {productCategories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getCategoryIcon(category)} {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 商品列表 */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              📦
            </div>
            <h3 className="text-sm font-medium text-gray-900">暂无商品</h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedCategory === 'all' ? '该商家还没有上架商品' : '该分类下暂无商品'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map(product => {
              const quantity = quantities[product.id] || 0
              
              return (
                <Card key={product.id} className="overflow-hidden">
                  {product.image_url && (
                    <div className="aspect-w-16 aspect-h-9">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                    
                    {product.description && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold text-red-600">
                          ¥{product.price.toFixed(2)}
                        </span>
                        {product.stock_quantity > 0 && (
                          <span className="ml-2 text-sm text-gray-500">
                            库存 {product.stock_quantity}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between">
                      {quantity === 0 ? (
                        <Button
                          onClick={() => updateQuantity(product.id, 1)}
                          disabled={product.stock_quantity === 0}
                          className="flex-1"
                        >
                          {product.stock_quantity === 0 ? '缺货' : '选择'}
                        </Button>
                      ) : (
                        <>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                            >
                              <MinusIcon className="h-4 w-4" />
                            </button>
                            <span className="text-lg font-medium">{quantity}</span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              disabled={quantity >= product.stock_quantity}
                              className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <Button
                            onClick={() => addToCart(product)}
                            size="sm"
                          >
                            加入购物车
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
    </PageLayout>
  )
}