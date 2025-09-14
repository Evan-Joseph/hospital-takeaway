import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef } from 'react';

// 定义应用的主要路由层级
const ROUTE_HIERARCHY: Record<string, string> = {
  // 顾客路由
  '/': '/',
  '/merchants': '/',
  '/merchant/:id': '/merchants',
  '/cart': '/merchants',
  '/checkout': '/cart',
  '/orders': '/',
  '/order/:id': '/orders',
  '/profile': '/',
  
  // 商家路由
  '/merchant-admin': '/merchant-admin',
  '/merchant-admin/menu': '/merchant-admin',
  '/merchant-admin/orders': '/merchant-admin',
  '/merchant-admin/payment': '/merchant-admin',
  '/merchant-admin/promotions': '/merchant-admin',
  '/merchant-admin/profile': '/merchant-admin',
  
  // 超级管理员路由
  '/super-admin': '/super-admin',
  '/super-admin/merchants': '/super-admin',
  '/super-admin/users': '/super-admin',
  '/super-admin/content': '/super-admin',
  '/super-admin/analytics': '/super-admin',
  
  // 认证路由
  '/auth/login': '/',
  '/auth/register': '/',
  '/auth/super-admin-login': '/'
};

// 获取路由的父级路径
function getParentRoute(currentPath: string): string {
  // 首先尝试精确匹配
  if (ROUTE_HIERARCHY[currentPath]) {
    return ROUTE_HIERARCHY[currentPath];
  }
  
  // 尝试模式匹配（处理动态路由）
  for (const [pattern, parent] of Object.entries(ROUTE_HIERARCHY)) {
    if (pattern.includes(':')) {
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
      if (regex.test(currentPath)) {
        return parent;
      }
    }
  }
  
  // 如果没有找到匹配，尝试去掉最后一段路径
  const segments = currentPath.split('/').filter(Boolean);
  if (segments.length > 1) {
    return '/' + segments.slice(0, -1).join('/');
  }
  
  // 默认返回首页
  return '/';
}

// 检查是否是外部跳转（比如从其他网站或直接输入URL）
function isExternalNavigation(navigationHistory: string[]): boolean {
  return navigationHistory.length <= 1;
}

// 检查是否会造成循环导航
function wouldCauseLoop(targetPath: string, navigationHistory: string[]): boolean {
  // 如果目标路径在最近的3个历史记录中出现，可能会造成循环
  const recentHistory = navigationHistory.slice(-3);
  return recentHistory.includes(targetPath);
}

export function useSmartNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationHistory = useRef<string[]>([]);
  const isInitialized = useRef(false);

  // 记录导航历史
  useEffect(() => {
    const currentPath = location.pathname;
    
    if (!isInitialized.current) {
      // 首次初始化
      navigationHistory.current = [currentPath];
      isInitialized.current = true;
    } else {
      // 避免重复记录相同路径
      const lastPath = navigationHistory.current[navigationHistory.current.length - 1];
      if (lastPath !== currentPath) {
        navigationHistory.current.push(currentPath);
        
        // 限制历史记录长度，避免内存泄漏
        if (navigationHistory.current.length > 10) {
          navigationHistory.current = navigationHistory.current.slice(-8);
        }
      }
    }
  }, [location.pathname]);

  // 智能返回函数
  const smartGoBack = useCallback((fallbackPath?: string) => {
    const currentPath = location.pathname;
    const history = navigationHistory.current;
    
    // 如果提供了明确的fallback路径，优先使用
    if (fallbackPath) {
      navigate(fallbackPath);
      return;
    }
    
    // 如果是外部导航（直接访问或刷新页面），使用层级导航
    if (isExternalNavigation(history)) {
      const parentRoute = getParentRoute(currentPath);
      navigate(parentRoute);
      return;
    }
    
    // 查找合适的返回路径
    let targetPath: string | null = null;
    
    // 从历史记录中找到上一个不同的路径
    for (let i = history.length - 2; i >= 0; i--) {
      const path = history[i];
      if (path !== currentPath && !wouldCauseLoop(path, history)) {
        targetPath = path;
        break;
      }
    }
    
    // 如果找到了合适的路径，导航到该路径
    if (targetPath) {
      navigate(targetPath);
    } else {
      // 否则使用层级导航
      const parentRoute = getParentRoute(currentPath);
      navigate(parentRoute);
    }
  }, [location.pathname, navigate]);

  // 智能导航函数（带历史记录管理）
  const smartNavigate = useCallback((path: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      // 替换当前历史记录
      navigationHistory.current[navigationHistory.current.length - 1] = path;
    }
    navigate(path, options);
  }, [navigate]);

  // 获取建议的返回路径（用于显示）
  const getSuggestedBackPath = useCallback((): string => {
    const currentPath = location.pathname;
    const history = navigationHistory.current;
    
    // 如果是外部导航，返回层级父路径
    if (isExternalNavigation(history)) {
      return getParentRoute(currentPath);
    }
    
    // 查找上一个不同的路径
    for (let i = history.length - 2; i >= 0; i--) {
      const path = history[i];
      if (path !== currentPath && !wouldCauseLoop(path, history)) {
        return path;
      }
    }
    
    // 默认返回层级父路径
    return getParentRoute(currentPath);
  }, [location.pathname]);

  // 检查是否可以返回
  const canGoBack = useCallback((): boolean => {
    const history = navigationHistory.current;
    return history.length > 1 || !isExternalNavigation(history);
  }, []);

  // 清除导航历史（用于登录/登出等场景）
  const clearNavigationHistory = useCallback(() => {
    navigationHistory.current = [location.pathname];
  }, [location.pathname]);

  return {
    smartGoBack,
    smartNavigate,
    getSuggestedBackPath,
    canGoBack,
    clearNavigationHistory,
    navigationHistory: navigationHistory.current
  };
}