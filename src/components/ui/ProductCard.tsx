import React from 'react';
import { Package } from 'lucide-react';
import Card from './Card';
import Button from './Button';

interface ProductCardProps {
  name: string;
  price: number;
  image?: string;
  description?: string;
  quantity?: number;
  showQuantityControls?: boolean;
  showAddButton?: boolean;
  onQuantityChange?: (change: number) => void;
  onAddToCart?: () => void;
  className?: string;
  imageClassName?: string;
}

export default function ProductCard({
  name,
  price,
  image,
  description,
  quantity = 0,
  showQuantityControls = false,
  showAddButton = false,
  onQuantityChange,
  onAddToCart,
  className = '',
  imageClassName = ''
}: ProductCardProps) {
  return (
    <Card className={`p-4 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center space-x-4">
        {/* Product Image */}
        <div className={`w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 ${imageClassName}`}>
          {image ? (
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Package className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{name}</h3>
          {description && (
            <p className="text-sm text-gray-500 truncate mt-1">{description}</p>
          )}
          <p className="text-lg font-semibold text-blue-600 mt-1">¥{price.toFixed(2)}</p>
        </div>

        {/* Controls */}
        <div className="flex-shrink-0">
          {showQuantityControls && onQuantityChange && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onQuantityChange(-1)}
                disabled={quantity <= 0}
                className="w-8 h-8 p-0 border-gray-200"
              >
                -
              </Button>
              <span className="w-8 text-center text-sm font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onQuantityChange(1)}
                className="w-8 h-8 p-0 border-gray-200"
              >
                +
              </Button>
            </div>
          )}
          
          {showAddButton && onAddToCart && (
            <Button
              onClick={onAddToCart}
              disabled={quantity <= 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
            >
              加入购物车
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}