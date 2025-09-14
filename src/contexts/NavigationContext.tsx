import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useSmartNavigation } from '../hooks/useSmartNavigation';

interface NavigationContextType {
  // 这个上下文主要用于管理全局导航状态
  // 具体的导航功能通过 useSmartNavigation hook 提供
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { clearNavigationHistory } = useSmartNavigation();

  // 当用户登录/登出状态变化时，清除导航历史
  useEffect(() => {
    clearNavigationHistory();
  }, [user?.id, clearNavigationHistory]);

  const value: NavigationContextType = {
    // 可以在这里添加全局导航状态
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}