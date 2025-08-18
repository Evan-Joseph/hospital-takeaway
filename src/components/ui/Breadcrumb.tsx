import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { useSmartNavigation } from '../../hooks/useSmartNavigation';

interface BreadcrumbItem {
  label: string;
  path: string;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

// 根据路径生成面包屑项目
function generateBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  const pathSegments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];
  
  // 路径标签映射
  const pathLabels: Record<string, string> = {
    '': '首页',
    'merchants': '商家列表',
    'merchant': '商家详情',
    'cart': '购物车',
    'checkout': '结算',
    'orders': '我的订单',
    'order': '订单详情',
    'profile': '个人中心',
    'merchant-admin': '商家后台',
    'menu': '菜单管理',
    'payment': '收款管理',
    'promotions': '优惠管理',
    'super-admin': '管理后台',
    'users': '用户管理',
    'content': '内容管理',
    'analytics': '数据分析',
    'auth': '认证',
    'login': '登录',
    'register': '注册'
  };
  
  let currentPath = '';
  
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // 跳过动态路由参数（通常是ID）
    if (/^[a-f0-9-]{36}$/.test(segment) || /^\d+$/.test(segment)) {
      return;
    }
    
    const label = pathLabels[segment] || segment;
    const isActive = index === pathSegments.length - 1;
    
    items.push({
      label,
      path: currentPath,
      isActive
    });
  });
  
  return items;
}

export default function Breadcrumb({ 
  items, 
  showHome = true, 
  className = '' 
}: BreadcrumbProps) {
  const location = useLocation();
  const { smartNavigate } = useSmartNavigation();
  
  // 如果没有提供items，则自动生成
  const breadcrumbItems = items || generateBreadcrumbItems(location.pathname);
  
  // 如果只有一个项目且是首页，不显示面包屑
  if (breadcrumbItems.length <= 1 && location.pathname === '/') {
    return null;
  }
  
  const handleNavigation = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    smartNavigate(path);
  };
  
  return (
    <nav className={`flex items-center space-x-1 text-sm text-gray-500 ${className}`} aria-label="面包屑导航">
      {showHome && location.pathname !== '/' && (
        <>
          <Link 
            to="/" 
            onClick={(e) => handleNavigation('/', e)}
            className="flex items-center hover:text-gray-700 transition-colors"
            title="返回首页"
          >
            <HomeIcon className="h-4 w-4" />
          </Link>
          {breadcrumbItems.length > 0 && (
            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
          )}
        </>
      )}
      
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && (
            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
          )}
          
          {item.isActive ? (
            <span className="font-medium text-gray-900 truncate max-w-32">
              {item.label}
            </span>
          ) : (
            <Link
              to={item.path}
              onClick={(e) => handleNavigation(item.path, e)}
              className="hover:text-gray-700 transition-colors truncate max-w-32"
              title={item.label}
            >
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

// 简化版面包屑，只显示当前页面和上一级
export function SimpleBreadcrumb({ className = '' }: { className?: string }) {
  const location = useLocation();
  const { getSuggestedBackPath, smartNavigate } = useSmartNavigation();
  
  const currentPath = location.pathname;
  const parentPath = getSuggestedBackPath();
  
  // 路径标签映射
  const pathLabels: Record<string, string> = {
    '/': '首页',
    '/merchants': '商家列表',
    '/cart': '购物车',
    '/orders': '我的订单',
    '/profile': '个人中心',
    '/merchant-admin': '商家后台',
    '/super-admin': '管理后台'
  };
  
  const getCurrentLabel = () => {
    const segments = currentPath.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    
    if (currentPath === '/') return '首页';
    if (currentPath.includes('/merchant/')) return '商家详情';
    if (currentPath.includes('/order/')) return '订单详情';
    
    return pathLabels[currentPath] || lastSegment || '当前页面';
  };
  
  const getParentLabel = () => {
    return pathLabels[parentPath] || '上一页';
  };
  
  // 如果在首页，不显示面包屑
  if (currentPath === '/' || parentPath === currentPath) {
    return null;
  }
  
  const handleParentNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    smartNavigate(parentPath);
  };
  
  return (
    <nav className={`flex items-center space-x-1 text-sm text-gray-500 ${className}`} aria-label="简化面包屑导航">
      <Link
        to={parentPath}
        onClick={handleParentNavigation}
        className="hover:text-gray-700 transition-colors truncate max-w-32"
        title={`返回${getParentLabel()}`}
      >
        {getParentLabel()}
      </Link>
      
      <ChevronRightIcon className="h-4 w-4 text-gray-400" />
      
      <span className="font-medium text-gray-900 truncate max-w-32">
        {getCurrentLabel()}
      </span>
    </nav>
  );
}