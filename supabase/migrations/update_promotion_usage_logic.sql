-- 更新优惠系统逻辑：将使用限制从"使用次数"调整为"使用商品数"

-- 1. 为promotions表添加新字段
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS max_usage_product_count INTEGER;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS current_usage_product_count INTEGER DEFAULT 0;

-- 2. 为promotion_usage表添加商品数量字段
ALTER TABLE promotion_usage ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 1;

-- 3. 更新现有数据：将使用次数转换为商品数
-- 假设每次使用平均涉及1个商品，可以根据实际情况调整
UPDATE promotions 
SET max_usage_product_count = max_usage_count,
    current_usage_product_count = current_usage_count
WHERE max_usage_count IS NOT NULL;

-- 4. 创建新的函数：更新优惠活动使用商品数
CREATE OR REPLACE FUNCTION update_promotion_product_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    -- 增加优惠活动的使用商品数
    UPDATE promotions 
    SET current_usage_product_count = current_usage_product_count + COALESCE(NEW.product_count, 1)
    WHERE id = NEW.promotion_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建新的触发器：自动更新使用商品数
DROP TRIGGER IF EXISTS update_promotion_product_usage_count_trigger ON promotion_usage;
CREATE TRIGGER update_promotion_product_usage_count_trigger
    AFTER INSERT ON promotion_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_promotion_product_usage_count();

-- 6. 更新检查优惠活动可用性的函数
CREATE OR REPLACE FUNCTION check_promotion_availability_by_product_count(
    p_promotion_id UUID,
    p_customer_id UUID,
    p_order_amount DECIMAL,
    p_product_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    promotion_record promotions%ROWTYPE;
    customer_product_usage_count INTEGER;
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
    
    -- 检查总使用商品数限制（新逻辑）
    IF promotion_record.max_usage_product_count IS NOT NULL THEN
        IF (promotion_record.current_usage_product_count + p_product_count) > promotion_record.max_usage_product_count THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- 检查每人使用商品数限制（新逻辑）
    IF promotion_record.max_usage_per_customer IS NOT NULL THEN
        SELECT COALESCE(SUM(product_count), 0) INTO customer_product_usage_count
        FROM promotion_usage
        WHERE promotion_id = p_promotion_id
          AND customer_id = p_customer_id;
        
        IF (customer_product_usage_count + p_product_count) > promotion_record.max_usage_per_customer THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建函数：记录优惠使用（包含商品数）
CREATE OR REPLACE FUNCTION record_promotion_usage(
    p_promotion_id UUID,
    p_order_id UUID,
    p_customer_id UUID,
    p_discount_amount DECIMAL,
    p_product_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
BEGIN
    -- 检查是否可以使用优惠
    IF NOT check_promotion_availability_by_product_count(p_promotion_id, p_customer_id, 0, p_product_count) THEN
        RETURN FALSE;
    END IF;
    
    -- 记录使用
    INSERT INTO promotion_usage (
        promotion_id,
        order_id,
        customer_id,
        discount_amount,
        product_count
    ) VALUES (
        p_promotion_id,
        p_order_id,
        p_customer_id,
        p_discount_amount,
        p_product_count
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 8. 添加注释说明新字段
COMMENT ON COLUMN promotions.max_usage_product_count IS '最大使用商品数限制';
COMMENT ON COLUMN promotions.current_usage_product_count IS '当前已使用商品数';
COMMENT ON COLUMN promotion_usage.product_count IS '本次使用涉及的商品数量';

-- 9. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_promotions_usage_product_count ON promotions(current_usage_product_count);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_product_count ON promotion_usage(product_count);

COMMIT;