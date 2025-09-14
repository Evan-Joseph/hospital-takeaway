-- 拼手气红包系统数据库结构扩展
-- 添加红包相关字段和表结构

-- ============================================================================
-- 1. 扩展 promotions 表，添加红包相关字段
-- ============================================================================

-- 添加红包总数量字段
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS total_red_packets INTEGER DEFAULT 0;

-- 添加红包剩余数量字段
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS remaining_red_packets INTEGER DEFAULT 0;

-- 添加代金券有效期天数字段
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS voucher_validity_days INTEGER DEFAULT 30;

-- 为新字段创建索引
CREATE INDEX IF NOT EXISTS idx_promotions_remaining_red_packets ON promotions(remaining_red_packets);
CREATE INDEX IF NOT EXISTS idx_promotions_total_red_packets ON promotions(total_red_packets);

-- ============================================================================
-- 2. 创建红包领取记录表
-- ============================================================================

CREATE TABLE IF NOT EXISTS red_packet_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    claimed_amount DECIMAL(10,2) NOT NULL CHECK (claimed_amount > 0),
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    voucher_id UUID, -- 关联生成的代金券ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_red_packet_claims_promotion_id ON red_packet_claims(promotion_id);
CREATE INDEX IF NOT EXISTS idx_red_packet_claims_user_id ON red_packet_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_red_packet_claims_voucher_id ON red_packet_claims(voucher_id);
CREATE INDEX IF NOT EXISTS idx_red_packet_claims_claimed_at ON red_packet_claims(claimed_at DESC);

-- 创建唯一约束，防止用户重复领取同一个红包
CREATE UNIQUE INDEX IF NOT EXISTS idx_red_packet_claims_unique 
ON red_packet_claims(promotion_id, user_id);

-- ============================================================================
-- 3. 创建用户代金券表
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
    red_packet_claim_id UUID REFERENCES red_packet_claims(id) ON DELETE CASCADE,
    voucher_code VARCHAR(20) UNIQUE NOT NULL, -- 代金券编码
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- 代金券金额
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 过期时间
    used_at TIMESTAMP WITH TIME ZONE, -- 使用时间
    used_order_id UUID, -- 使用的订单ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_id ON user_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_promotion_id ON user_vouchers(promotion_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_status ON user_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_expires_at ON user_vouchers(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_voucher_code ON user_vouchers(voucher_code);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_created_at ON user_vouchers(created_at DESC);

-- ============================================================================
-- 4. 创建触发器函数
-- ============================================================================

-- 自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_user_vouchers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 生成唯一代金券编码
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        -- 生成8位随机代金券编码：V + 7位数字
        code := 'V' || LPAD(FLOOR(RANDOM() * 10000000)::TEXT, 7, '0');
        
        -- 检查编码是否已存在
        SELECT EXISTS(SELECT 1 FROM user_vouchers WHERE voucher_code = code) INTO exists;
        
        -- 如果不存在则返回
        IF NOT exists THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 红包领取处理函数
CREATE OR REPLACE FUNCTION claim_red_packet(
    p_promotion_id UUID,
    p_user_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    voucher_id UUID,
    voucher_code TEXT,
    amount DECIMAL(10,2),
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_promotion promotions%ROWTYPE;
    v_claimed_amount DECIMAL(10,2);
    v_voucher_code TEXT;
    v_voucher_id UUID;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_claim_id UUID;
BEGIN
    -- 检查优惠活动是否存在且有效
    SELECT * INTO v_promotion
    FROM promotions
    WHERE id = p_promotion_id
      AND promotion_type = 'lucky_red_packet'
      AND is_active = true
      AND start_date <= NOW()
      AND end_date >= NOW();
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, '红包活动不存在或已结束'::TEXT, NULL::UUID, NULL::TEXT, NULL::DECIMAL(10,2), NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- 检查是否还有剩余红包
    IF v_promotion.remaining_red_packets <= 0 THEN
        RETURN QUERY SELECT false, '红包已被抢完'::TEXT, NULL::UUID, NULL::TEXT, NULL::DECIMAL(10,2), NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- 检查用户是否已经领取过
    IF EXISTS(SELECT 1 FROM red_packet_claims WHERE promotion_id = p_promotion_id AND user_id = p_user_id) THEN
        RETURN QUERY SELECT false, '您已经领取过这个红包'::TEXT, NULL::UUID, NULL::TEXT, NULL::DECIMAL(10,2), NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- 计算随机金额（平均金额±1元）
    v_claimed_amount := v_promotion.discount_value + (RANDOM() * 2 - 1);
    -- 确保金额不小于0.01元
    v_claimed_amount := GREATEST(v_claimed_amount, 0.01);
    
    -- 生成代金券编码
    v_voucher_code := generate_voucher_code();
    
    -- 计算代金券过期时间
    v_expires_at := NOW() + INTERVAL '1 day' * v_promotion.voucher_validity_days;
    
    -- 开始事务处理
    BEGIN
        -- 减少剩余红包数量
        UPDATE promotions 
        SET remaining_red_packets = remaining_red_packets - 1
        WHERE id = p_promotion_id;
        
        -- 记录红包领取
        INSERT INTO red_packet_claims (promotion_id, user_id, claimed_amount)
        VALUES (p_promotion_id, p_user_id, v_claimed_amount)
        RETURNING id INTO v_claim_id;
        
        -- 创建代金券
        INSERT INTO user_vouchers (
            user_id, 
            promotion_id, 
            red_packet_claim_id, 
            voucher_code, 
            amount, 
            expires_at
        )
        VALUES (
            p_user_id, 
            p_promotion_id, 
            v_claim_id, 
            v_voucher_code, 
            v_claimed_amount, 
            v_expires_at
        )
        RETURNING id INTO v_voucher_id;
        
        -- 更新红包领取记录中的代金券ID
        UPDATE red_packet_claims 
        SET voucher_id = v_voucher_id 
        WHERE id = v_claim_id;
        
        RETURN QUERY SELECT true, '红包领取成功'::TEXT, v_voucher_id, v_voucher_code, v_claimed_amount, v_expires_at;
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT false, '领取失败，请重试'::TEXT, NULL::UUID, NULL::TEXT, NULL::DECIMAL(10,2), NULL::TIMESTAMP WITH TIME ZONE;
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. 创建触发器
-- ============================================================================

-- 为 user_vouchers 表添加更新时间触发器
DROP TRIGGER IF EXISTS update_user_vouchers_updated_at_trigger ON user_vouchers;
CREATE TRIGGER update_user_vouchers_updated_at_trigger
    BEFORE UPDATE ON user_vouchers
    FOR EACH ROW
    EXECUTE FUNCTION update_user_vouchers_updated_at();

-- ============================================================================
-- 6. 启用 RLS (行级安全)
-- ============================================================================

-- 启用 RLS
ALTER TABLE red_packet_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vouchers ENABLE ROW LEVEL SECURITY;

-- 红包领取记录的 RLS 策略
DROP POLICY IF EXISTS "Allow authenticated users to view their own claims" ON red_packet_claims;
CREATE POLICY "Allow authenticated users to view their own claims" 
ON red_packet_claims FOR SELECT 
USING (auth.role() = 'authenticated' AND user_id = auth.uid());

DROP POLICY IF EXISTS "Allow authenticated users to create claims" ON red_packet_claims;
CREATE POLICY "Allow authenticated users to create claims" 
ON red_packet_claims FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

DROP POLICY IF EXISTS "Allow public read access to claims" ON red_packet_claims;
CREATE POLICY "Allow public read access to claims" 
ON red_packet_claims FOR SELECT 
USING (true);

-- 用户代金券的 RLS 策略
DROP POLICY IF EXISTS "Allow authenticated users to view their own vouchers" ON user_vouchers;
CREATE POLICY "Allow authenticated users to view their own vouchers" 
ON user_vouchers FOR SELECT 
USING (auth.role() = 'authenticated' AND user_id = auth.uid());

DROP POLICY IF EXISTS "Allow authenticated users to update their own vouchers" ON user_vouchers;
CREATE POLICY "Allow authenticated users to update their own vouchers" 
ON user_vouchers FOR UPDATE 
USING (auth.role() = 'authenticated' AND user_id = auth.uid());

DROP POLICY IF EXISTS "Allow public read access to vouchers" ON user_vouchers;
CREATE POLICY "Allow public read access to vouchers" 
ON user_vouchers FOR SELECT 
USING (true);

-- ============================================================================
-- 7. 权限授予
-- ============================================================================

-- 为 authenticated 角色授权
GRANT ALL PRIVILEGES ON red_packet_claims TO authenticated;
GRANT ALL PRIVILEGES ON user_vouchers TO authenticated;

-- 为 anon 角色授予读取权限
GRANT SELECT ON red_packet_claims TO anon;
GRANT SELECT ON user_vouchers TO anon;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION claim_red_packet(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_red_packet(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION generate_voucher_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_voucher_code() TO anon;

-- ============================================================================
-- 8. 更新现有数据
-- ============================================================================

-- 为现有的拼手气红包活动设置默认值
UPDATE promotions 
SET 
    total_red_packets = 100,
    remaining_red_packets = 100,
    voucher_validity_days = 30
WHERE promotion_type = 'lucky_red_packet' 
  AND (total_red_packets IS NULL OR total_red_packets = 0);

-- 最后更新时间
-- 最后更新: 2025-01-18