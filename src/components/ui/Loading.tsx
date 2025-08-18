import React from 'react'
import { clsx } from 'clsx'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
  className?: string
}

export default function Loading({ 
  size = 'md', 
  text = '加载中...', 
  fullScreen = false,
  className 
}: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }
  
  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }
  
  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <div
        className={clsx(
          'animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
          sizeClasses[size]
        )}
      />
      {text && (
        <p className={clsx('mt-2 text-gray-600', textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  )
  
  if (fullScreen) {
    return (
      <div className={clsx(
        'fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50',
        className
      )}>
        {spinner}
      </div>
    )
  }
  
  return (
    <div className={clsx('flex items-center justify-center p-4', className)}>
      {spinner}
    </div>
  )
}

// 页面级别的加载组件
export function PageLoading({ text = '页面加载中...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <Loading size="lg" text={text} />
    </div>
  )
}

// 内联加载组件
export function InlineLoading({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <Loading size="sm" text={text} />
    </div>
  )
}