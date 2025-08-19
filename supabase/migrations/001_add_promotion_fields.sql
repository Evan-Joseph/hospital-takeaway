-- 添加优惠活动表缺失的字段
-- 修复 applicable_categories 和 applicable_products 字段缺失问题

-- 添加适用商品字段（JSON数组）
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS applicable_products JSONB DEFAULT '[]'::jsonb;

-- 添加适用分类字段（JSON数组）
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS applicable_categories JSONB DEFAULT '[]'::jsonb;

-- 为新字段创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_promotions_applicable_products ON promotions USING GIN(applicable_products);
CREATE INDEX IF NOT EXISTS idx_promotions_applicable_categories ON promotions USING GIN(applicable_categories);

-- 更新现有记录，确保字段不为空
UPDATE promotions 
SET 
  applicable_products = '[]'::jsonb,
  applicable_categories = '[]'::jsonb
WHERE 
  applicable_products IS NULL 
  OR applicable_categories IS NULL;