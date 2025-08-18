-- 创建优惠活动使用记录表

CREATE TABLE IF NOT EXISTS promotion_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    discount_amount DECIMAL(10,2) NOT NULL CHECK (discount_amount >= 0),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion_id ON promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_customer_id ON promotion_usage(customer_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_order_id ON promotion_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_used_at ON promotion_usage(used_at);

-- 启用RLS
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Allow authenticated users full access" ON promotion_usage 
  FOR ALL USING (auth.role() = 'authenticated');

-- 创建函数：更新优惠活动使用次数
CREATE OR REPLACE FUNCTION update_promotion_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    -- 增加优惠活动的使用次数
    UPDATE promotions 
    SET current_usage_count = current_usage_count + 1
    WHERE id = NEW.promotion_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：自动更新使用次数
DROP TRIGGER IF EXISTS update_promotion_usage_count_trigger ON promotion_usage;
CREATE TRIGGER update_promotion_usage_count_trigger
    AFTER INSERT ON promotion_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_promotion_usage_count();

-- 创建函数：检查优惠活动是否可用
CREATE OR REPLACE FUNCTION check_promotion_availability(
    p_promotion_id UUID,
    p_customer_id UUID,
    p_order_amount DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
    promotion_record promotions%ROWTYPE;
    customer_usage_count INTEGER;
BEGIN
    -- 获取优惠活动信息
    SELECT * INTO promotion_record
    FROM promotions
    WHERE id = p_promotion_id
      AND is_active = true
      AND start_date <= NOW()
      AND end_date >= NOW();
    
    -- 检查优惠活动是否存在且有效
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- 检查最低消费金额
    IF promotion_record.promotion_type = 'minimum_amount' AND p_order_amount < promotion_record.minimum_amount THEN
        RETURN FALSE;
    END IF;
    
    -- 检查总使用次数限制
    IF promotion_record.max_usage_count IS NOT NULL AND promotion_record.current_usage_count >= promotion_record.max_usage_count THEN
        RETURN FALSE;
    END IF;
    
    -- 检查每人使用次数限制
    IF promotion_record.max_usage_per_customer IS NOT NULL THEN
        SELECT COUNT(*) INTO customer_usage_count
        FROM promotion_usage
        WHERE promotion_id = p_promotion_id
          AND customer_id = p_customer_id;
        
        IF customer_usage_count >= promotion_record.max_usage_per_customer THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：计算优惠金额
CREATE OR REPLACE FUNCTION calculate_promotion_discount(
    p_promotion_id UUID,
    p_order_amount DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    promotion_record promotions%ROWTYPE;
    discount_amount DECIMAL;
BEGIN
    -- 获取优惠活动信息
    SELECT * INTO promotion_record
    FROM promotions
    WHERE id = p_promotion_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- 计算优惠金额
    IF promotion_record.discount_type = 'percentage' THEN
        discount_amount = p_order_amount * (promotion_record.discount_value / 100);
    ELSE
        discount_amount = promotion_record.discount_value;
    END IF;
    
    -- 确保优惠金额不超过订单金额
    IF discount_amount > p_order_amount THEN
        discount_amount = p_order_amount;
    END IF;
    
    RETURN discount_amount;
END;
$$ LANGUAGE plpgsql;

COMMIT;