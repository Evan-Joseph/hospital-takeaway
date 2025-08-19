-- 移除拼手气红包系统
-- 回滚所有红包相关的数据库结构

-- ============================================================================
-- 1. 删除触发器（必须在删除函数之前）
-- ============================================================================

DROP TRIGGER IF EXISTS update_user_vouchers_updated_at_trigger ON user_vouchers;

-- ============================================================================
-- 2. 删除函数
-- ============================================================================

-- 删除红包领取函数
DROP FUNCTION IF EXISTS claim_red_packet(UUID, UUID);

-- 删除代金券编码生成函数
DROP FUNCTION IF EXISTS generate_voucher_code();

-- 删除触发器函数
DROP FUNCTION IF EXISTS update_user_vouchers_updated_at();

-- ============================================================================
-- 3. 删除表
-- ============================================================================

-- 删除用户代金券表
DROP TABLE IF EXISTS user_vouchers CASCADE;

-- 删除红包领取记录表
DROP TABLE IF EXISTS red_packet_claims CASCADE;

-- ============================================================================
-- 4. 移除 promotions 表中的红包相关字段
-- ============================================================================

-- 删除索引
DROP INDEX IF EXISTS idx_promotions_remaining_red_packets;
DROP INDEX IF EXISTS idx_promotions_total_red_packets;

-- 删除字段
ALTER TABLE promotions DROP COLUMN IF EXISTS total_red_packets;
ALTER TABLE promotions DROP COLUMN IF EXISTS remaining_red_packets;
ALTER TABLE promotions DROP COLUMN IF EXISTS voucher_validity_days;

-- ============================================================================
-- 5. 清理数据
-- ============================================================================

-- 删除所有拼手气红包类型的优惠活动
DELETE FROM promotions WHERE promotion_type = 'lucky_red_packet';

-- 最后更新时间
-- 最后更新: 2025-01-18