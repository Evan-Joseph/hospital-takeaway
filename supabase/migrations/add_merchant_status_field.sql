-- 为merchants表添加status字段来更好地管理商家状态
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- 更新现有数据：将is_active字段映射到新的status字段
UPDATE merchants SET status = CASE 
  WHEN is_active = true THEN 'active'
  WHEN is_active = false THEN 'pending'
  ELSE 'pending'
END;

-- 添加状态约束
ALTER TABLE merchants ADD CONSTRAINT merchants_status_check 
  CHECK (status IN ('pending', 'active', 'suspended', 'rejected'));

-- 添加注释说明状态含义
COMMENT ON COLUMN merchants.status IS '商家状态: pending-待审核, active-已激活, suspended-已封停, rejected-已拒绝';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

-- 为了向后兼容，保留is_active字段但添加触发器保持同步
CREATE OR REPLACE FUNCTION sync_merchant_is_active()
RETURNS TRIGGER AS $$
BEGIN
  -- 当status更新时，同步更新is_active字段
  NEW.is_active = (NEW.status = 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_merchant_is_active_trigger
  BEFORE UPDATE OF status ON merchants
  FOR EACH ROW
  EXECUTE FUNCTION sync_merchant_is_active();