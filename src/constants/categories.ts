// 统一的商品和商家分类系统
// 按照生活领域进行分类

// 商家分类（店铺类型）
export const MERCHANT_CATEGORIES = [
  '餐饮美食',
  '生活超市',
  '医疗健康',
  '母婴用品',
  '文具办公',
  '服装配饰',
  '数码电子',
  '图书音像',
  '其他'
] as const;

// 商品分类
export const PRODUCT_CATEGORIES = [
  // 餐饮美食类
  '中式菜品',
  '西式菜品',
  '快餐小食',
  '饮品甜品',
  '烘焙糕点',
  
  // 生活用品类
  '日用百货',
  '清洁用品',
  '厨房用品',
  '家居装饰',
  
  // 医疗健康类
  '药品保健',
  '医疗器械',
  '营养补充',
  
  // 个人护理类
  '洗护用品',
  '美容护肤',
  '口腔护理',
  '个人卫生',
  
  // 母婴用品类
  '婴儿食品',
  '婴儿用品',
  '孕妇用品',
  '儿童玩具',
  
  // 文具办公类
  '文具用品',
  '办公用品',
  '学习用品',
  
  // 服装配饰类
  '服装鞋帽',
  '箱包配饰',
  '珠宝首饰',
  
  // 数码电子类
  '数码产品',
  '电子配件',
  '智能设备',
  
  // 图书音像类
  '图书杂志',
  '音像制品',
  '文化用品',
  
  // 其他
  '其他'
] as const;

// 分类映射关系：商家分类对应的商品分类
export const CATEGORY_MAPPING: Record<string, string[]> = {
  '餐饮美食': ['中式菜品', '西式菜品', '快餐小食', '饮品甜品', '烘焙糕点'],
  '生活超市': ['日用百货', '清洁用品', '厨房用品', '家居装饰', '洗护用品', '个人卫生'],
  '医疗健康': ['药品保健', '医疗器械', '营养补充'],
  '母婴用品': ['婴儿食品', '婴儿用品', '孕妇用品', '儿童玩具'],
  '文具办公': ['文具用品', '办公用品', '学习用品'],
  '服装配饰': ['服装鞋帽', '箱包配饰', '珠宝首饰'],
  '数码电子': ['数码产品', '电子配件', '智能设备'],
  '图书音像': ['图书杂志', '音像制品', '文化用品'],
  '其他': ['其他']
};

// 获取商家分类对应的商品分类
export function getProductCategoriesForMerchant(merchantCategory: string): string[] {
  return CATEGORY_MAPPING[merchantCategory] || ['其他'];
}

// 分类图标映射
export const CATEGORY_ICONS: Record<string, string> = {
  // 商家分类图标
  '餐饮美食': '🍽️',
  '生活超市': '🛒',
  '医疗健康': '🏥',
  '母婴用品': '👶',
  '文具办公': '📝',
  '服装配饰': '👕',
  '数码电子': '📱',
  '图书音像': '📚',
  
  // 商品分类图标
  '中式菜品': '🥢',
  '西式菜品': '🍽️',
  '快餐小食': '🍔',
  '饮品甜品': '🥤',
  '烘焙糕点': '🧁',
  '日用百货': '🛍️',
  '清洁用品': '🧽',
  '厨房用品': '🍳',
  '家居装饰': '🏠',
  '药品保健': '💊',
  '医疗器械': '🩺',
  '营养补充': '💪',
  '洗护用品': '🧴',
  '美容护肤': '💄',
  '口腔护理': '🦷',
  '个人卫生': '🧻',
  '婴儿食品': '🍼',
  '婴儿用品': '👶',
  '孕妇用品': '🤱',
  '儿童玩具': '🧸',
  '文具用品': '✏️',
  '办公用品': '📎',
  '学习用品': '📖',
  '服装鞋帽': '👔',
  '箱包配饰': '👜',
  '珠宝首饰': '💍',
  '数码产品': '💻',
  '电子配件': '🔌',
  '智能设备': '📱',
  '图书杂志': '📚',
  '音像制品': '💿',
  '文化用品': '🎨',
  '其他': '📦'
};

// 获取分类图标
export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || '📦';
}

// 分类颜色映射
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '餐饮美食': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  '生活超市': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  '医疗健康': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  '母婴用品': { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
  '文具办公': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  '服装配饰': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  '数码电子': { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  '图书音像': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  '其他': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
};

// 获取分类颜色
export function getCategoryColors(category: string) {
  // 先尝试直接匹配
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  
  // 如果是商品分类，尝试找到对应的商家分类
  for (const [merchantCategory, productCategories] of Object.entries(CATEGORY_MAPPING)) {
    if (productCategories.includes(category)) {
      return CATEGORY_COLORS[merchantCategory] || CATEGORY_COLORS['其他'];
    }
  }
  
  return CATEGORY_COLORS['其他'];
}

export type MerchantCategory = typeof MERCHANT_CATEGORIES[number];
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];