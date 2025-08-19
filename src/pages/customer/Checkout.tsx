import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Phone, User, Copy, Check, QrCode } from 'lucide-react';
import { useCartStore } from '../../stores/cartStore';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import PageLayout from '../../components/layout/PageLayout';
import { toast } from 'sonner';

interface Merchant {
  id: string;
  name: string;
  payment_qr_code: string;
  minimum_order_amount?: number;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const merchantId = searchParams.get('merchant');
  const fromOrderId = searchParams.get('fromOrder');
  const { user } = useAuth();
  const { getItemsByMerchant, clearMerchantItems, getMerchantTotalWithDiscount } = useCartStore();
  
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [existingOrder, setExistingOrder] = useState<any>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  
  // 收货信息
  const [deliveryInfo, setDeliveryInfo] = useState({
    name: user?.user_metadata?.name || '',
    phone: user?.phone || '',
    address: ''
  });

  const merchantGroups = getItemsByMerchant();
  const currentMerchantItems = merchantId ? merchantGroups[merchantId] : null;

  useEffect(() => {
    if (!merchantId) {
      navigate('/cart');
      return;
    }
    
    // 如果没有购物车数据，可能是从订单详情页直接跳转过来的
    if (!currentMerchantItems) {
      // 检查是否是从订单详情页跳转过来的（URL中包含orderId参数）
      const urlParams = new URLSearchParams(window.location.search);
      const fromOrder = urlParams.get('fromOrder');
      
      if (fromOrder) {
         // 从订单详情页跳转过来，获取订单信息并显示支付页面
         fetchExistingOrder(fromOrder);
         fetchMerchant();
         setOrderCreated(true); // 直接显示支付界面
       } else {
        // 正常情况下没有购物车数据，跳转到购物车
        navigate('/cart');
        return;
      }
    } else {
      fetchMerchant();
    }
  }, [merchantId, currentMerchantItems]);

  const fetchMerchant = async () => {
    if (!merchantId) return;
    
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, name, payment_qr_code, minimum_order_amount')
        .eq('id', merchantId)
        .single();

      if (error) throw error;
      setMerchant(data);
    } catch (error) {
      console.error('Error fetching merchant:', error);
      toast.error('获取商家信息失败');
    }
  };

  const fetchExistingOrder = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          verification_code,
          total_amount,
          delivery_name,
          delivery_phone,
          delivery_address
        `)
        .eq('id', orderId)
        .eq('customer_id', user?.id)
        .single();

      if (error) throw error;
      
      setExistingOrder(data);
      setCurrentOrderId(data.id);
      setVerificationCode(data.verification_code);
      setDeliveryInfo({
        name: data.delivery_name,
        phone: data.delivery_phone,
        address: data.delivery_address
      });
    } catch (error) {
      console.error('Error fetching existing order:', error);
      toast.error('获取订单信息失败');
    }
  };

  const generateVerificationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORDER${timestamp.slice(-6)}${random}`;
  };

  const handleCreateOrder = async () => {
    if (!currentMerchantItems || !merchant || !user) return;
    
    if (!deliveryInfo.name || !deliveryInfo.phone || !deliveryInfo.address) {
      toast.error('请填写完整的收货信息');
      return;
    }

    setLoading(true);
    let createdOrderId: string | null = null;
    
    try {
      // 1. 先检查起送金额
      console.log('开始检查起送金额...');
      const discountInfo = getMerchantTotalWithDiscount(merchantId);
      const totalAmount = discountInfo.finalTotal;
      
      if (merchant?.minimum_order_amount && totalAmount < merchant.minimum_order_amount) {
        toast.error(`订单金额不足，起送金额为¥${merchant.minimum_order_amount.toFixed(2)}`);
        return;
      }
      
      // 2. 检查所有商品的库存
      console.log('开始检查库存...');
      const stockCheckPromises = currentMerchantItems.items.map(async (item) => {
        const { data: product, error } = await supabase
          .from('products')
          .select('stock_quantity, name')
          .eq('id', item.productId)
          .single();
        
        if (error) {
          console.error(`获取商品库存失败 (${item.productId}):`, error);
          throw new Error(`获取商品库存失败: ${error.message}`);
        }
        
        return {
          productId: item.productId,
          productName: product.name,
          requestedQuantity: item.quantity,
          availableStock: product.stock_quantity,
          isSufficient: product.stock_quantity >= item.quantity
        };
      });
      
      const stockResults = await Promise.all(stockCheckPromises);
      const insufficientItems = stockResults.filter(result => !result.isSufficient);
      
      if (insufficientItems.length > 0) {
        const errorMessages = insufficientItems.map(item => 
          `${item.productName}：需要${item.requestedQuantity}件，库存仅剩${item.availableStock}件`
        );
        toast.error(`库存不足：\n${errorMessages.join('\n')}`);
        return;
      }
      
      console.log('库存检查通过，开始创建订单...');
      const orderNumber = generateOrderNumber();
      const code = generateVerificationCode();
      // 使用之前计算的折扣后总金额

      // 2. 创建订单
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          merchant_id: merchantId,
          order_number: orderNumber,
          verification_code: code,
          total_amount: totalAmount,
          delivery_address: deliveryInfo.address,
          delivery_name: deliveryInfo.name,
          delivery_phone: deliveryInfo.phone,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) {
        console.error('创建订单失败:', orderError);
        throw new Error(`创建订单失败: ${orderError.message}`);
      }
      
      createdOrderId = order.id;
      console.log('订单创建成功，ID:', createdOrderId);

      // 3. 创建订单项
      const orderItems = currentMerchantItems.items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('创建订单项失败:', itemsError);
        throw new Error(`创建订单项失败: ${itemsError.message}`);
      }
      
      console.log('订单项创建成功');

      // 4. 扣减库存 - 使用更安全的方式
      console.log('开始更新库存...');
      for (const item of currentMerchantItems.items) {
        try {
          // 使用 RPC 函数进行原子性库存更新
          const { error: updateError } = await supabase
            .rpc('update_product_stock', {
              product_id: item.productId,
              quantity_to_subtract: item.quantity
            });
          
          if (updateError) {
            // 如果 RPC 函数不存在，使用传统方式
            if (updateError.code === 'PGRST202') {
              const { data: currentProduct, error: fetchError } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.productId)
                .single();
              
              if (fetchError) throw fetchError;
              
              const { error: directUpdateError } = await supabase
                .from('products')
                .update({ 
                  stock_quantity: Math.max(0, currentProduct.stock_quantity - item.quantity),
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.productId);
              
              if (directUpdateError) throw directUpdateError;
            } else {
              throw updateError;
            }
          }
        } catch (stockError) {
          console.error(`更新商品库存失败 (${item.productId}):`, stockError);
          // 库存更新失败不应该阻止订单创建，只记录错误
          console.warn('库存更新失败，但订单已创建');
        }
      }
      
      console.log('库存更新完成');

      setVerificationCode(code);
      setCurrentOrderId(order.id);
      setOrderCreated(true);
      toast.success('订单创建成功！');
      
      // 清空该商家的购物车
      clearMerchantItems(merchantId);
      
    } catch (error) {
      console.error('订单创建过程中发生错误:', error);
      
      // 如果订单已创建但后续步骤失败，尝试清理
      if (createdOrderId) {
        try {
          console.log('尝试清理已创建的订单:', createdOrderId);
          await supabase.from('order_items').delete().eq('order_id', createdOrderId);
          await supabase.from('orders').delete().eq('id', createdOrderId);
          console.log('订单清理完成');
        } catch (cleanupError) {
          console.error('清理订单失败:', cleanupError);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : '创建订单失败，请重试';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = async () => {
    try {
      const targetOrderId = currentOrderId || existingOrder?.id;
      if (!targetOrderId) {
        toast.error('订单信息错误');
        return;
      }

      // 更新订单状态为已支付
      const { error } = await supabase
        .from('orders')
        .update({ status: 'customer_paid' })
        .eq('id', targetOrderId);

      if (error) throw error;

      toast.success('支付状态已更新，等待商家确认');
      // 根据PRD需求：支付操作完成后->自动跳转订单详情页
      navigate(`/orders/${targetOrderId}`);
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('更新支付状态失败');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(verificationCode);
      setCopied(true);
      toast.success('验证码已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const handleScanQR = () => {
    // 这里可以实现扫码功能，暂时使用模拟数据
    setDeliveryInfo({
      name: '张三',
      phone: '13800138000',
      address: '北京市朝阳区某某街道某某小区某某号楼某某单元某某室'
    });
    toast.success('地址信息已自动填充');
  };

  const totalAmount = currentMerchantItems 
    ? getMerchantTotalWithDiscount(merchantId).finalTotal
    : existingOrder?.total_amount || 0;

  if (!merchant) {
    return (
      <PageLayout title="结算" backPath="/cart">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">加载中...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="结算" 
      backPath={orderCreated ? (currentOrderId || existingOrder?.id ? `/orders/${currentOrderId || existingOrder?.id}` : "/orders") : "/cart"}
    >
      <div className="space-y-6">
        {!orderCreated ? (
          <>
            {/* 商家信息 */}
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">{merchant.name}</h3>
              <div className="text-sm text-gray-600">
                商家ID: {merchant.id}
              </div>
            </Card>

            {/* 商品清单 */}
            {currentMerchantItems && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3">商品清单</h3>
                <div className="space-y-3">
                  {currentMerchantItems.items.map((item) => (
                    <div key={item.productId} className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-600">¥{item.price} × {item.quantity}</div>
                      </div>
                      <div className="font-semibold">¥{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="border-t pt-3 flex justify-between items-center font-semibold text-lg">
                    <span>总计</span>
                    <span className="text-red-600">¥{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* 收货信息 */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">收货信息</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleScanQR}
                  className="flex items-center space-x-1"
                >
                  <QrCode className="w-4 h-4" />
                  <span>扫码填充</span>
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="收货人姓名"
                    value={deliveryInfo.name}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, name: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="联系电话"
                    value={deliveryInfo.phone}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="详细地址"
                    value={deliveryInfo.address}
                    onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                  />
                </div>
              </div>
            </Card>

            {/* 确认订单按钮 */}
            <Button
              onClick={handleCreateOrder}
              disabled={loading || !deliveryInfo.name || !deliveryInfo.phone || !deliveryInfo.address}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
            >
              {loading ? '创建中...' : `确认订单 ¥${totalAmount.toFixed(2)}`}
            </Button>
          </>
        ) : (
          <>
            {/* 支付信息 */}
            <Card className="p-6 text-center">
              <h3 className="text-xl font-semibold mb-4 text-green-600">订单创建成功！</h3>
              <div className="mb-6">
                <img
                  src={merchant.payment_qr_code}
                  alt="收款码"
                  className="w-48 h-48 mx-auto border rounded-lg"
                />
              </div>
              <div className="text-2xl font-bold text-red-600 mb-4">
                ¥{totalAmount.toFixed(2)}
              </div>
            </Card>

            {/* 付款验证码 */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">付款验证码</div>
                  <div className="text-xl font-mono font-bold">{verificationCode}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="flex items-center space-x-1"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '已复制' : '复制'}</span>
                </Button>
              </div>
            </Card>

            {/* 支付步骤 */}
            <Card className="p-4">
              <h4 className="font-semibold mb-3">支付步骤</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div>1. 使用微信或支付宝扫描上方二维码</div>
                <div>2. 输入支付金额：¥{totalAmount.toFixed(2)}</div>
                <div>3. 完成支付后，点击下方"我已完成支付"按钮</div>
                <div>4. 商家确认收款后，您的订单将开始配送</div>
              </div>
            </Card>

            {/* 完成按钮 */}
            <div className="space-y-3">
              <Button
                onClick={handlePaymentComplete}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
              >
                我已完成支付
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const targetOrderId = currentOrderId || existingOrder?.id;
                  if (targetOrderId) {
                    navigate(`/orders/${targetOrderId}`);
                  } else {
                    navigate('/orders');
                  }
                }}
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-3 text-lg"
              >
                查看订单详情
              </Button>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}