-- 为商家表添加起送金额字段
-- 用于防止恶意下单，设置最低订单金额

-- 添加起送金额字段
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS minimum_order_amount DECIMAL(10,2) DEFAULT 0 CHECK (minimum_order_amount >= 0);

-- 为新字段添加注释
COMMENT ON COLUMN merchants.minimum_order_amount IS '起送金额，低于此金额的订单将被拒绝';

-- 为新字段创建索引
CREATE INDEX IF NOT EXISTS idx_merchants_minimum_order_amount ON merchants(minimum_order_amount);

-- 更新现有记录，设置默认起送金额为0（无限制）
UPDATE merchants 
SET minimum_order_amount = 0 
WHERE minimum_order_amount IS NULL;