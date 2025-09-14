import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { NavigationProvider } from './contexts/NavigationContext'
import ProtectedRoute, { SuperAdminProtectedRoute } from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'

// 认证页面
import Home from './pages/Home'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import SuperAdminLogin from './pages/auth/SuperAdminLogin'
import MerchantList from './pages/customer/MerchantList'
import MerchantDetail from './pages/customer/MerchantDetail'
import Cart from './pages/customer/Cart'
import Checkout from './pages/customer/Checkout'
import Orders from './pages/customer/Orders'
import OrderDetail from './pages/customer/OrderDetail'
import Profile from './pages/customer/Profile'
import MerchantAdmin from './pages/merchant/MerchantAdmin'
import SuperAdmin from './pages/super-admin/SuperAdmin'

// 超级管理员页面（待实现）
// import SuperAdmin from './pages/super-admin/SuperAdmin'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <NavigationProvider>
          <div className="App">
          <Routes>
            {/* 公开路由 */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/super-admin" element={<SuperAdminLogin />} />
            
            {/* 顾客端路由 */}
            <Route path="/" element={<Home />} />
            <Route path="/merchants" element={<MerchantList />} />
            <Route path="/merchant/:id" element={<MerchantDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:orderId" element={<OrderDetail />} />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute requiredUserType="customer">
                  <Profile />
                </ProtectedRoute>
              } 
            />
            
            {/* 商家端路由 */}
            <Route 
              path="/merchant-admin/*" 
              element={
                <ProtectedRoute requiredUserType="merchant">
                  <MerchantAdmin />
                </ProtectedRoute>
              } 
            />
            
            {/* 超级管理员路由 */}
            <Route 
              path="/super-admin/*" 
              element={
                <SuperAdminProtectedRoute>
                  <SuperAdmin />
                </SuperAdminProtectedRoute>
              } 
            />
            
            {/* 404页面 */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-gray-600 mb-8">页面未找到</p>
                  <a href="/" className="text-blue-600 hover:text-blue-500">返回首页</a>
                </div>
              </div>
            } />
          </Routes>
          
          {/* Toast 通知 */}
          <Toaster 
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#fff',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              },
            }}
          />
          </div>
          </NavigationProvider>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
