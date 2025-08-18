import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Users, 
  Store, 
  FileText, 
  BarChart3, 
  Menu as MenuIcon,
  X,
  Shield,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Loading from '../../components/ui/Loading';

// 子页面组件（待创建）
import SuperAdminDashboard from './SuperAdminDashboard';
import UserManagement from './UserManagement';
import MerchantManagement from './MerchantManagement';
import ContentManagement from './ContentManagement';
import Analytics from './Analytics';

const menuItems = [
  { path: '/super-admin', icon: Home, label: '首页', exact: true },
  { path: '/super-admin/users', icon: Users, label: '用户管理' },
  { path: '/super-admin/merchants', icon: Store, label: '商家管理' },
  { path: '/super-admin/content', icon: FileText, label: '内容管理' },
  { path: '/super-admin/analytics', icon: BarChart3, label: '数据统计' }
];

export default function SuperAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMerchants: 0,
    activeMerchants: 0,
    pendingMerchants: 0,
    totalOrders: 0,
    todayOrders: 0,
    monthlyOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    recentOrders: []
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersResult, merchantsResult, ordersResult] = await Promise.all([
        // 用户统计
        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .neq('user_type', 'super_admin'),
        
        // 商家统计
        supabase
          .from('merchants')
          .select('id, status', { count: 'exact' }),
        
        // 订单统计
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
      ]);

      const merchants = merchantsResult.data || [];
      const pendingMerchants = merchants.filter(m => m.status === 'pending').length;
      const activeMerchants = merchants.filter(m => m.status === 'active').length;

      setStats({
        totalUsers: usersResult.count || 0,
        totalMerchants: merchantsResult.count || 0,
        activeMerchants,
        pendingMerchants,
        totalOrders: ordersResult.count || 0,
        todayOrders: 0,
        monthlyOrders: 0,
        totalRevenue: 0,
        todayRevenue: 0,
        monthlyRevenue: 0,
        recentOrders: []
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth/super-admin');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">超级管理员</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Admin Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">系统管理员</p>
              <p className="text-xs text-gray-500">码上购平台</p>
            </div>
          </div>
        </div>
        
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
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.path === '/super-admin/merchants' && stats.pendingMerchants > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                    {stats.pendingMerchants}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        
        {/* Sign Out */}
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="w-full text-gray-600 border-gray-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
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
                {menuItems.find(item => isActiveRoute(item.path, item.exact))?.label || '超级管理员'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {stats.pendingMerchants > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/super-admin/merchants')}
                  className="text-red-600"
                >
                  {stats.pendingMerchants} 个商家待审核
                </Button>
              )}
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<SuperAdminDashboard stats={stats} />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/merchants" element={<MerchantManagement onUpdate={fetchStats} />} />
            <Route path="/content" element={<ContentManagement onUpdate={fetchStats} />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}