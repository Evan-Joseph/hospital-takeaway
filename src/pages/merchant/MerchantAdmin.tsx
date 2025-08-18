import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Package, 
  ShoppingCart, 
  CreditCard, 
  Gift, 
  Store, 
  Menu as MenuIcon,
  X,
  Bell,
  User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';

// 子页面组件（待创建）
import MerchantDashboard from './MerchantDashboard';
import MenuManagement from './MenuManagement';
import OrderManagement from './OrderManagement';
import PaymentManagement from './PaymentManagement';
import PromotionManagement from './PromotionManagement';
import StoreProfile from './StoreProfile';

interface Merchant {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string;
  is_active: boolean;
  payment_qr_code: string;
}

const menuItems = [
  { path: '/merchant-admin', icon: Home, label: '首页', exact: true },
  { path: '/merchant-admin/menu', icon: Package, label: '菜单管理' },
  { path: '/merchant-admin/orders', icon: ShoppingCart, label: '订单管理' },
  { path: '/merchant-admin/payment', icon: CreditCard, label: '收款码' },
  { path: '/merchant-admin/promotions', icon: Gift, label: '优惠活动' },
  { path: '/merchant-admin/profile', icon: Store, label: '店铺信息' }
];

export default function MerchantAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    if (user) {
      fetchMerchantInfo();
      fetchPendingOrders();
    }
  }, [user]);

  const fetchMerchantInfo = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 商家信息不存在，跳转到创建页面
          navigate('/merchant-admin/profile?setup=true');
          return;
        }
        throw error;
      }
      
      setMerchant(data);
    } catch (error) {
      console.error('Error fetching merchant info:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingOrders = async () => {
    if (!user) return;
    
    try {
      // 获取商家ID
      const { data: merchantData } = await supabase
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (merchantData) {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchantData.id)
          .in('status', ['paid', 'confirmed']);

        setPendingOrders(count || 0);
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActiveRoute = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">商家后台</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Merchant Info */}
        {merchant && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Store className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{merchant.name}</p>
                <p className="text-xs text-gray-500 truncate">{merchant.category}</p>
              </div>
            </div>
            {!merchant.is_active && (
              <div className="mt-2 px-2 py-1 bg-yellow-100 rounded text-xs text-yellow-800">
                店铺未激活
              </div>
            )}
          </div>
        )}
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(item.path, item.exact);
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  active
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.path === '/merchant-admin/orders' && pendingOrders > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                    {pendingOrders}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        
        {/* User Info & Sign Out */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.user_metadata?.name || '商家用户'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.phone}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="w-full text-gray-600 border-gray-200"
          >
            退出登录
          </Button>
        </div>
      </div>
      
      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <MenuIcon className="w-5 h-5" />
              </Button>
              <h2 className="text-lg font-semibold text-gray-900">
                {menuItems.find(item => isActiveRoute(item.path, item.exact))?.label || '商家后台'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {pendingOrders > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/merchant-admin/orders')}
                  className="relative text-gray-600"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {pendingOrders}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<MerchantDashboard merchant={merchant} />} />
            <Route path="/menu" element={<MenuManagement merchant={merchant} />} />
            <Route path="/orders" element={<OrderManagement merchant={merchant} />} />
            <Route path="/payment" element={<PaymentManagement merchant={merchant} />} />
            <Route path="/promotions" element={<PromotionManagement merchant={merchant} />} />
            <Route path="/profile" element={<StoreProfile merchant={merchant} onUpdate={fetchMerchantInfo} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}