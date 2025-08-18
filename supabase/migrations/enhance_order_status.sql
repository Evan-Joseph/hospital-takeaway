-- 增强订单状态管理和支付倒计时功能

-- 1. 添加支付倒计时相关字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_close_at TIMESTAMP WITH TIME ZONE;

-- 2. 更新现有订单的状态映射
-- 将旧状态映射到新状态
UPDATE orders SET status = 'customer_paid' WHERE status = 'paid';
UPDATE orders SET status = 'merchant_confirmed' WHERE status IN ('confirmed', 'preparing', 'delivering');
UPDATE orders SET status = 'customer_received' WHERE status = 'completed';
-- cancelled 状态保持不变，但我们用 timeout_closed 表示超时关闭

-- 3. 更新订单状态枚举，细化为5种状态
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'customer_paid', 'timeout_closed', 'merchant_confirmed', 'customer_received', 'cancelled'));

-- 4. 创建函数：自动设置支付倒计时（30分钟）
CREATE OR REPLACE FUNCTION set_payment_deadline()
RETURNS TRIGGER AS $$
BEGIN
    -- 只对新创建的待支付订单设置倒计时
    IF NEW.status = 'pending' AND OLD IS NULL THEN
        NEW.payment_deadline = NEW.created_at + INTERVAL '30 minutes';
        NEW.auto_close_at = NEW.created_at + INTERVAL '30 minutes';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器：自动设置支付倒计时
DROP TRIGGER IF EXISTS set_payment_deadline_trigger ON orders;
CREATE TRIGGER set_payment_deadline_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_payment_deadline();

-- 6. 创建函数：自动关闭超时订单
CREATE OR REPLACE FUNCTION auto_close_expired_orders()
RETURNS void AS $$
BEGIN
    UPDATE orders 
    SET status = 'timeout_closed', 
        updated_at = NOW()
    WHERE status = 'pending' 
      AND auto_close_at IS NOT NULL 
      AND auto_close_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 7. 为现有的待支付订单设置支付倒计时
UPDATE orders 
SET payment_deadline = created_at + INTERVAL '30 minutes',
    auto_close_at = created_at + INTERVAL '30 minutes'
WHERE status = 'pending' 
  AND payment_deadline IS NULL;

-- 8. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_orders_payment_deadline ON orders(payment_deadline);
CREATE INDEX IF NOT EXISTS idx_orders_auto_close_at ON orders(auto_close_at);

-- 9. 添加商家状态管理字段（用于后续任务）
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' 
  CHECK (status IN ('pending', 'active', 'suspended'));

-- 10. 更新现有商家状态
UPDATE merchants SET status = 'active' WHERE is_active = true;
UPDATE merchants SET status = 'suspended' WHERE is_active = false;

-- 11. 创建索引
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

COMMIT;