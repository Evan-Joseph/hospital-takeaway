import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import Button from '../ui/Button';
import { SimpleBreadcrumb } from '../ui/Breadcrumb';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  showBackButton?: boolean;
  backPath?: string;
  rightElement?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  showUserInfo?: boolean;
  showLogo?: boolean;
  showBreadcrumb?: boolean;
}

export default function PageLayout({
  children,
  title,
  showBackButton = true,
  backPath,
  rightElement,
  className = '',
  headerClassName = '',
  contentClassName = '',
  showUserInfo = false,
  showLogo = false,
  showBreadcrumb = false
}: PageLayoutProps) {
  const { user, userProfile, signOut } = useAuth();
  const { smartGoBack, canGoBack, getSuggestedBackPath } = useSmartNavigation();

  const handleBack = () => {
    smartGoBack(backPath);
  };

  // 获取返回按钮的显示文本
  const getBackButtonText = () => {
    if (!canGoBack()) return '首页';
    
    const suggestedPath = getSuggestedBackPath();
    
    // 根据路径返回友好的文本
    const pathLabels: Record<string, string> = {
      '/': '首页',
      '/merchants': '商家列表',
      '/cart': '购物车',
      '/orders': '我的订单',
      '/profile': '个人中心',
      '/merchant-admin': '商家后台',
      '/super-admin': '管理后台'
    };
    
    return pathLabels[suggestedPath] || '返回';
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 ${className}`}>
      {/* Header */}
      <div className={`bg-white shadow-sm ${headerClassName}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side */}
            <div className="flex items-center">
              {showLogo ? (
                <Link to="/" className="flex items-center">
                  <h1 className="text-2xl font-bold text-blue-600">码上购</h1>
                </Link>
              ) : showBackButton ? (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                  title={`返回到${getBackButtonText()}`}
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  {getBackButtonText()}
                </Button>
              ) : (
                <div className="w-16"></div>
              )}
              
              {!showLogo && (
                <h1 className="text-xl font-semibold text-gray-900 truncate ml-4">
                  {title}
                </h1>
              )}
            </div>
            
            {/* Right side */}
            <div className="flex items-center space-x-4">
              {showUserInfo && user && userProfile ? (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <span className="text-sm text-gray-700 block">
                      欢迎，{userProfile.name}
                    </span>
                    {userProfile.user_type && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                        {userProfile.user_type === 'customer' ? '顾客' : 
                         userProfile.user_type === 'merchant' ? '商家' : 
                         userProfile.user_type === 'super_admin' ? '管理员' : '用户'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-500 hover:text-gray-700"
                    title="登出"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : showUserInfo && !user ? (
                <div className="flex items-center space-x-4">
                  <Link
                    to="/auth/login"
                    className="text-gray-700 hover:text-gray-900"
                  >
                    登录
                  </Link>
                  <Link
                    to="/auth/register"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    注册
                  </Link>
                </div>
              ) : (
                rightElement
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      {showBreadcrumb && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <SimpleBreadcrumb />
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}