import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product } from '../lib/supabase'

export interface CartItem {
  productId: string
  merchantId: string
  name: string
  price: number
  image: string
  quantity: number
}

export interface Promotion {
  id: string
  title: string
  description: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  promotion_type: 'general' | 'product_specific' | 'category_specific' | 'minimum_amount'
  minimum_amount: number
  max_usage_count?: number
  current_usage_count: number
  max_usage_per_customer?: number
  max_usage_product_count?: number
  current_usage_product_count: number
}

export interface CartStore {
  items: CartItem[]
  merchantNames: Record<string, string> // 存储商家ID到商家名称的映射
  appliedPromotions: Record<string, Promotion[]> // 存储每个商家应用的优惠
  addItem: (product: Product, quantity: number, merchantName: string) => void
  removeItem: (productId: string, merchantId: string) => void
  updateQuantity: (productId: string, merchantId: string, quantity: number) => void
  clearCart: () => void
  clearMerchantItems: (merchantId: string) => void
  getItemsByMerchant: () => Record<string, { name: string; items: CartItem[] }>
  getTotalItems: () => number
  getTotalPrice: () => number
  getMerchantTotal: (merchantId: string) => number
  getMerchantTotalWithDiscount: (merchantId: string, promotions?: Promotion[]) => { originalTotal: number; discountAmount: number; finalTotal: number }
  applyPromotions: (merchantId: string, promotions: Promotion[]) => void
  removePromotions: (merchantId: string) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      merchantNames: {},
      appliedPromotions: {},
      
      addItem: (product, quantity, merchantName) => {
        set((state) => {
          const existingItem = state.items.find(item => 
            item.productId === product.id && item.merchantId === product.merchant_id
          )
          
          // 更新商家名称映射
          const updatedMerchantNames = {
            ...state.merchantNames,
            [product.merchant_id]: merchantName
          }
          
          if (existingItem) {
            return {
              items: state.items.map(item =>
                item.productId === product.id && item.merchantId === product.merchant_id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
              merchantNames: updatedMerchantNames
            }
          }
          
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                merchantId: product.merchant_id,
                name: product.name,
                price: product.price,
                image: product.image_url || '',
                quantity
              }
            ],
            merchantNames: updatedMerchantNames
          }
        })
      },
      
      removeItem: (productId, merchantId) => {
        set((state) => ({
          items: state.items.filter(item => 
            !(item.productId === productId && item.merchantId === merchantId)
          )
        }))
      },
      
      updateQuantity: (productId, merchantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, merchantId)
          return
        }
        
        set((state) => ({
          items: state.items.map(item =>
            item.productId === productId && item.merchantId === merchantId
              ? { ...item, quantity }
              : item
          )
        }))
      },
      
      clearCart: () => {
        set({ items: [] })
      },
      
      clearMerchantItems: (merchantId) => {
        set((state) => ({
          items: state.items.filter(item => item.merchantId !== merchantId)
        }))
      },
      
      getItemsByMerchant: () => {
        const { items, merchantNames } = get()
        const merchantGroups: Record<string, { name: string; items: CartItem[] }> = {}
        
        items.forEach(item => {
          if (!merchantGroups[item.merchantId]) {
            merchantGroups[item.merchantId] = {
              name: merchantNames[item.merchantId] || `商家 ${item.merchantId.slice(0, 8)}`,
              items: []
            }
          }
          merchantGroups[item.merchantId].items.push(item)
        })
        
        return merchantGroups
      },
      
      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },
      
      getTotalPrice: () => {
        return get().items.reduce((total, item) => {
          return total + (item.price * item.quantity)
        }, 0)
      },
      
      getMerchantTotal: (merchantId) => {
        return get().items
          .filter(item => item.merchantId === merchantId)
          .reduce((total, item) => {
            return total + (item.price * item.quantity)
          }, 0)
      },
      
      getMerchantTotalWithDiscount: (merchantId, promotions) => {
        const originalTotal = get().getMerchantTotal(merchantId)
        const appliedPromotions = promotions || get().appliedPromotions[merchantId] || []
        
        let discountAmount = 0
        
        // 应用优惠计算
        appliedPromotions.forEach(promotion => {
          // 检查最低消费要求
          if (promotion.promotion_type === 'minimum_amount' && originalTotal < promotion.minimum_amount) {
            return // 不满足最低消费要求，跳过此优惠
          }
          
          let currentDiscount = 0
          
          if (promotion.discount_type === 'percentage') {
            currentDiscount = originalTotal * (promotion.discount_value / 100)
          } else if (promotion.discount_type === 'fixed_amount') {
            currentDiscount = promotion.discount_value
          }
          
          // 确保折扣不超过原价
          currentDiscount = Math.min(currentDiscount, originalTotal - discountAmount)
          discountAmount += currentDiscount
        })
        
        const finalTotal = Math.max(0, originalTotal - discountAmount)
        
        return {
          originalTotal,
          discountAmount,
          finalTotal
        }
      },
      
      applyPromotions: (merchantId, promotions) => {
        set((state) => ({
          appliedPromotions: {
            ...state.appliedPromotions,
            [merchantId]: promotions
          }
        }))
      },
      
      removePromotions: (merchantId) => {
        set((state) => {
          const newAppliedPromotions = { ...state.appliedPromotions }
          delete newAppliedPromotions[merchantId]
          return {
            appliedPromotions: newAppliedPromotions
          }
        })
      }
    }),
    {
      name: 'cart-storage',
      version: 1
    }
  )
)