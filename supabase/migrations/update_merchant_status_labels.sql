-- 更新商家状态标签以符合PRD需求
-- 将状态从 pending/active/suspended 调整为更明确的中文对应状态

-- 1. 更新商家状态约束，使用更明确的状态值
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_status_check;
ALTER TABLE merchants ADD CONSTRAINT merchants_status_check 
  CHECK (status IN ('pending', 'active', 'suspended'));

-- 2. 确保现有数据的状态正确性
-- pending = 待审核
-- active = 已激活  
-- suspended = 已封停

-- 3. 为新注册的商家设置默认状态为待审核
ALTER TABLE merchants ALTER COLUMN status SET DEFAULT 'pending';

-- 4. 添加商家状态变更日志表（可选，用于审计）
CREATE TABLE IF NOT EXISTS merchant_status_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changed_by UUID, -- 可以是超级管理员的ID
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_merchant_status_logs_merchant_id ON merchant_status_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_status_logs_created_at ON merchant_status_logs(created_at DESC);

-- 6. 创建函数：记录商家状态变更
CREATE OR REPLACE FUNCTION log_merchant_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 只在状态发生变化时记录
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO merchant_status_logs (merchant_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建触发器：自动记录商家状态变更
DROP TRIGGER IF EXISTS merchant_status_change_trigger ON merchants;
CREATE TRIGGER merchant_status_change_trigger
    AFTER UPDATE ON merchants
    FOR EACH ROW
    EXECUTE FUNCTION log_merchant_status_change();

COMMIT;