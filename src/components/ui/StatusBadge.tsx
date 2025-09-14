import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatusBadgeProps {
  label: string;
  color: 'yellow' | 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'gray';
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorClasses = {
  yellow: 'text-yellow-700 bg-yellow-100 border-yellow-200',
  blue: 'text-blue-700 bg-blue-100 border-blue-200',
  green: 'text-green-700 bg-green-100 border-green-200',
  orange: 'text-orange-700 bg-orange-100 border-orange-200',
  purple: 'text-purple-700 bg-purple-100 border-purple-200',
  red: 'text-red-700 bg-red-100 border-red-200',
  gray: 'text-gray-700 bg-gray-100 border-gray-200'
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-2 text-base'
};

const iconSizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5'
};

export default function StatusBadge({
  label,
  color,
  icon: Icon,
  size = 'md',
  className = ''
}: StatusBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-medium
        ${colorClasses[color]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {Icon && (
        <Icon className={`mr-1 ${iconSizeClasses[size]}`} />
      )}
      {label}
    </span>
  );
}