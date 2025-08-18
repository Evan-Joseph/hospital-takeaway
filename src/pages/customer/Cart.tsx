import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, Tag, Gift, CreditCard, X } from 'lucide-react';
import { useCartStore, Promotion } from '../../stores/cartStore';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Empty from '../../components/Empty';
import PageLayout from '../../components/layout/PageLayout';
import { toast } from 'sonner';

export default function Cart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    items, 
    updateQuantity, 
    removeItem, 
    getTotalPrice, 
    getItemsByMerchant, 
    getMerchantTotalWithDiscount,
    applyPromotions,
    appliedPromotions
  } = useCartStore();
  
  const [availablePromotions, setAvailablePromotions] = useState<Record<string, Promotion[]>>({});
  const [loading, setLoading] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [showFloatingWindow, setShowFloatingWindow] = useState(true);

  const merchantGroups = getItemsByMerchant();
  
  useEffect(() => {
    fetchPromotions();
    if (user) {
      fetchPendingOrdersCount();
    }
  }, [items, user]);
  
  const fetchPendingOrdersCount = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', user.id)
        .eq('status', 'pending');
        
      if (!error && data) {
        setPendingOrdersCount(data.length);
      }
    } catch (error) {
      console.error('Error fetching pending orders count:', error);
    }
  };
  
  const fetchPromotions = async () => {
    if (items.length === 0) return;
    
    setLoading(true);
    try {
      const merchantIds = [...new Set(items.map(item => item.merchantId))];
      const promotionsData: Record<string, Promotion[]> = {};
      
      for (const merchantId of merchantIds) {
        const { data, error } = await supabase
          .from('promotions')
          .select('*')
          .eq('merchant_id', merchantId)
          .eq('is_active', true)
          .gte('end_date', new Date().toISOString())
          .lte('start_date', new Date().toISOString());
          
        if (!error && data) {
          promotionsData[merchantId] = data;
          // 自动应用通用优惠
          const generalPromotions = data.filter(p => p.promotion_type === 'general');
          if (generalPromotions.length > 0) {
            applyPromotions(merchantId, generalPromotions);
          }
        }
      }
      
      setAvailablePromotions(promotionsData);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <PageLayout title="购物车">
        <div className="text-center py-12">
          <Empty
            icon={ShoppingBag}
            title="购物车是空的"
            description="快去选购您需要的商品吧"
          />
          <div className="mt-6">
            <Button onClick={() => navigate('/')} className="bg-blue-600 hover:bg-blue-700">
              去购物
            </Button>
          </div>
        </div>
        
        {/* Floating Window for Pending Orders - 购物车为空时也显示 */}
        {user && pendingOrdersCount > 0 && showFloatingWindow && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-orange-500 text-white rounded-lg shadow-lg p-4 max-w-xs relative animate-bounce">
              <button
                onClick={() => setShowFloatingWindow(false)}
                className="absolute -top-2 -right-2 bg-gray-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-gray-700"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    您有 {pendingOrdersCount} 笔订单待付款
                  </p>
                  <p className="text-xs opacity-90">
                    点击此处支付
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/orders')}
                className="w-full mt-3 bg-white text-orange-600 hover:bg-gray-50 font-medium text-sm py-2"
              >
                查看订单
              </Button>
            </div>
          </div>
        )}
      </PageLayout>
    );
  }

  const handleCheckout = (merchantId: string) => {
    navigate(`/checkout?merchant=${merchantId}`);
  };

  const handleQuantityIncrease = async (productId: string, merchantId: string, currentQuantity: number) => {
    try {
      // 检查商品当前库存
      const { data: product, error } = await supabase
        .from('products')
        .select('stock_quantity, name')
        .eq('id', productId)
        .single();
      
      if (error) {
        toast.error('获取商品信息失败');
        return;
      }
      
      if (currentQuantity >= product.stock_quantity) {
        toast.error(`库存不足，${product.name} 仅剩 ${product.stock_quantity} 件`);
        return;
      }
      
      updateQuantity(productId, merchantId, currentQuantity + 1);
    } catch (error) {
      console.error('Error checking stock:', error);
      toast.error('检查库存失败');
    }
  };

  return (
    <PageLayout title="购物车">
      {/* Cart Items by Merchant */}
      <div className="space-y-6">
          {Object.entries(merchantGroups).map(([merchantId, merchantData]) => (
            <Card key={merchantId} className="p-4">
              {/* Merchant Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-900">{merchantData.name}</span>
                </div>
                <span className="text-sm text-gray-500">{merchantData.items.length}件商品</span>
              </div>

              {/* Items */}
              <div className="space-y-3">
                {merchantData.items.map((item) => (
                  <div key={`${item.productId}-${item.merchantId}`} className="flex items-center space-x-3">
                    {/* Product Image */}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                      <p className="text-sm text-gray-500">¥{item.price.toFixed(2)}</p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.productId, item.merchantId, item.quantity - 1)}
                        className="w-8 h-8 p-0 border-gray-200"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityIncrease(item.productId, item.merchantId, item.quantity)}
                        className="w-8 h-8 p-0 border-gray-200"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.productId, item.merchantId)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* 优惠信息 */}
              {availablePromotions[merchantId] && availablePromotions[merchantId].length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center mb-2">
                    <Gift className="w-4 h-4 text-red-500 mr-1" />
                    <span className="text-sm font-medium text-gray-700">可用优惠</span>
                  </div>
                  <div className="space-y-2">
                    {availablePromotions[merchantId].map(promotion => {
                      const isApplied = appliedPromotions[merchantId]?.some(p => p.id === promotion.id);
                      const canApply = promotion.promotion_type !== 'minimum_amount' || 
                                     merchantData.items.reduce((sum, item) => sum + item.price * item.quantity, 0) >= promotion.minimum_amount;
                      
                      return (
                        <div key={promotion.id} className={`p-2 rounded-lg border cursor-pointer ${
                          isApplied ? 'bg-green-50 border-green-200 hover:bg-green-100' : 
                          canApply ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' : 
                          'bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => {
                          if (canApply && !isApplied) {
                            // 检查商品数量限制
                            const totalProductCount = merchantData.items.reduce((sum, item) => sum + item.quantity, 0);
                            if (promotion.max_usage_product_count && totalProductCount > promotion.max_usage_product_count) {
                              toast.error(`该优惠限制最多${promotion.max_usage_product_count}件商品，当前购物车有${totalProductCount}件商品`);
                              return;
                            }
                            
                            // 检查是否已有其他优惠应用（多件优惠互斥）
                            const currentPromotions = appliedPromotions[merchantId] || [];
                            if (currentPromotions.length > 0) {
                              toast.error('每个商家只能应用一个优惠，请先取消当前优惠');
                              return;
                            }
                            
                            applyPromotions(merchantId, [promotion]); // 只应用一个优惠
                            toast.success(`已应用优惠：${promotion.title}`);
                          } else if (isApplied) {
                            // 如果已应用，点击取消优惠
                            const currentPromotions = appliedPromotions[merchantId] || [];
                            const updatedPromotions = currentPromotions.filter(p => p.id !== promotion.id);
                            applyPromotions(merchantId, updatedPromotions);
                            toast.success(`已取消优惠：${promotion.title}`);
                          }
                        }}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">{promotion.title}</span>
                                {isApplied ? (
                                  <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">已应用</span>
                                ) : canApply ? (
                                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">点击应用</span>
                                ) : null}
                              </div>
                              <div className="text-xs text-gray-600">
                                {promotion.discount_type === 'percentage' ? 
                                  `打${(100 - promotion.discount_value).toFixed(0)}折` : 
                                  `减¥${promotion.discount_value.toFixed(2)}`
                                }
                                {promotion.promotion_type === 'minimum_amount' && 
                                  ` (满¥${promotion.minimum_amount.toFixed(2)})`
                                }
                              </div>
                            </div>
                            {!canApply && !isApplied && (
                              <span className="text-xs text-gray-400">不满足条件</span>
                            )}
                            {isApplied && (
                              <span className="text-xs text-green-600">点击取消</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Merchant Total and Checkout */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                {(() => {
                  const discountInfo = getMerchantTotalWithDiscount(merchantId);
                  return (
                    <div className="space-y-2 mb-3">
                      {discountInfo.discountAmount > 0 && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">原价</span>
                            <span className="text-gray-500 line-through">¥{discountInfo.originalTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-red-600">优惠</span>
                            <span className="text-red-600">-¥{discountInfo.discountAmount.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">小计</span>
                        <span className="font-semibold text-lg text-gray-900">
                          ¥{discountInfo.finalTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <Button
                  onClick={() => handleCheckout(merchantId)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  去结算
                </Button>
              </div>
            </Card>
          ))}
        </div>

      {/* Total Summary */}
      <Card className="mt-6 p-4 bg-white border-2 border-blue-200">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium text-gray-900">总计</span>
          <span className="text-2xl font-bold text-blue-600">¥{getTotalPrice().toFixed(2)}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">需分别向各商家付款</p>
      </Card>
      
      {/* Floating Window for Pending Orders */}
      {user && pendingOrdersCount > 0 && showFloatingWindow && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-orange-500 text-white rounded-lg shadow-lg p-4 max-w-xs relative animate-bounce">
            <button
              onClick={() => setShowFloatingWindow(false)}
              className="absolute -top-2 -right-2 bg-gray-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-gray-700"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 rounded-full p-2">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  您有 {pendingOrdersCount} 笔订单待付款
                </p>
                <p className="text-xs opacity-90">
                  点击此处支付
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/orders')}
              className="w-full mt-3 bg-white text-orange-600 hover:bg-gray-50 font-medium text-sm py-2"
            >
              查看订单
            </Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}