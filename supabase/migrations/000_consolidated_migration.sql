-- 码上购医院PWA平台 - 合并迁移脚本
-- 此脚本合并了所有现有的迁移文件，用于服务器迁移和部署
-- 生成时间: 2025-01-18
-- 版本: 1.0

-- ============================================================================
-- 1. 基础表结构创建 (来自 001_initial_schema.sql)
-- ============================================================================

-- 扩展用户配置表
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    user_type VARCHAR(20) DEFAULT 'customer' CHECK (user_type IN ('customer', 'merchant', 'super_admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON user_profiles(user_type);

-- 商家表
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    payment_qr_code TEXT,
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchants_owner_id ON merchants(owner_id);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_is_active ON merchants(is_active);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    category VARCHAR(100),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_merchant_id ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);

-- 订单表（包含增强的状态管理）
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    verification_code VARCHAR(10) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    delivery_address TEXT NOT NULL,
    delivery_name VARCHAR(100) NOT NULL,
    delivery_phone VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'customer_paid', 'timeout_closed', 'merchant_confirmed', 'customer_received', 'cancelled')),
    payment_deadline TIMESTAMP WITH TIME ZONE,
    auto_close_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_deadline ON orders(payment_deadline);
CREATE INDEX IF NOT EXISTS idx_orders_auto_close_at ON orders(auto_close_at);

-- 订单项表
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- 优惠活动表（包含商品数量限制逻辑）
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value >= 0),
    promotion_type VARCHAR(50) DEFAULT 'general',
    minimum_amount DECIMAL(10,2) DEFAULT 0,
    max_usage_count INTEGER,
    current_usage_count INTEGER DEFAULT 0,
    max_usage_per_customer INTEGER,
    max_usage_product_count INTEGER,
    current_usage_product_count INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_merchant_id ON promotions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_usage_product_count ON promotions(current_usage_product_count);

-- 优惠使用记录表
CREATE TABLE IF NOT EXISTS promotion_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    discount_amount DECIMAL(10,2) NOT NULL,
    product_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion_id ON promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_customer_id ON promotion_usage(customer_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_product_count ON promotion_usage(product_count);

-- 轮播图表
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    image_url TEXT NOT NULL,
    link_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_sort_order ON banners(sort_order);
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active);

-- 公告表（包含多角色支持）
CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    announcement_type VARCHAR(50) DEFAULT 'general',
    target_roles TEXT[] DEFAULT ARRAY['customer', 'merchant'],
    publisher_name VARCHAR(100),
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(announcement_type);
CREATE INDEX IF NOT EXISTS idx_announcements_target_roles ON announcements USING GIN(target_roles);
CREATE INDEX IF NOT EXISTS idx_announcements_valid_until ON announcements(valid_until);

-- 收货地址表
CREATE TABLE IF NOT EXISTS delivery_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_id ON delivery_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_is_default ON delivery_addresses(is_default);

-- 平台设置表
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. 触发器函数创建
-- ============================================================================

-- 创建触发器函数用于自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 自动设置支付倒计时（30分钟）
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

-- 自动关闭超时订单
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

-- 更新优惠活动使用商品数
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

-- 检查优惠活动可用性（按商品数）
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

-- 记录优惠使用（包含商品数）
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

-- ============================================================================
-- 3. 触发器创建
-- ============================================================================

-- 为需要的表添加更新时间触发器
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchants_updated_at ON merchants;
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_addresses_updated_at ON delivery_addresses;
CREATE TRIGGER update_delivery_addresses_updated_at BEFORE UPDATE ON delivery_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON platform_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 支付倒计时触发器
DROP TRIGGER IF EXISTS set_payment_deadline_trigger ON orders;
CREATE TRIGGER set_payment_deadline_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_payment_deadline();

-- 优惠使用商品数更新触发器
DROP TRIGGER IF EXISTS update_promotion_product_usage_count_trigger ON promotion_usage;
CREATE TRIGGER update_promotion_product_usage_count_trigger
    AFTER INSERT ON promotion_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_promotion_product_usage_count();

-- ============================================================================
-- 4. RLS (行级安全) 策略
-- ============================================================================

-- 启用RLS但使用宽松策略
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- 宽松的读取权限
DROP POLICY IF EXISTS "Allow public read access" ON user_profiles;
CREATE POLICY "Allow public read access" ON user_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON merchants;
CREATE POLICY "Allow public read access" ON merchants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON products;
CREATE POLICY "Allow public read access" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON banners;
CREATE POLICY "Allow public read access" ON banners FOR SELECT USING (true);

-- 公告的特殊策略
DROP POLICY IF EXISTS "Anyone can view active announcements" ON announcements;
CREATE POLICY "Anyone can view active announcements" ON announcements FOR SELECT USING (is_active = true);

-- 认证用户的完整权限
DROP POLICY IF EXISTS "Allow authenticated users full access" ON user_profiles;
CREATE POLICY "Allow authenticated users full access" ON user_profiles FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON merchants;
CREATE POLICY "Allow authenticated users full access" ON merchants FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON products;
CREATE POLICY "Allow authenticated users full access" ON products FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON orders;
CREATE POLICY "Allow authenticated users full access" ON orders FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON order_items;
CREATE POLICY "Allow authenticated users full access" ON order_items FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON promotions;
CREATE POLICY "Allow authenticated users full access" ON promotions FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON promotion_usage;
CREATE POLICY "Allow authenticated users full access" ON promotion_usage FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON banners;
CREATE POLICY "Allow authenticated users full access" ON banners FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view all announcements" ON announcements;
CREATE POLICY "Authenticated users can view all announcements" ON announcements FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage announcements" ON announcements;
CREATE POLICY "Authenticated users can manage announcements" ON announcements FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON delivery_addresses;
CREATE POLICY "Allow authenticated users full access" ON delivery_addresses FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users full access" ON platform_settings;
CREATE POLICY "Allow authenticated users full access" ON platform_settings FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. 权限授予
-- ============================================================================

-- 为authenticated角色授权
GRANT ALL PRIVILEGES ON user_profiles TO authenticated;
GRANT ALL PRIVILEGES ON merchants TO authenticated;
GRANT ALL PRIVILEGES ON products TO authenticated;
GRANT ALL PRIVILEGES ON orders TO authenticated;
GRANT ALL PRIVILEGES ON order_items TO authenticated;
GRANT ALL PRIVILEGES ON promotions TO authenticated;
GRANT ALL PRIVILEGES ON promotion_usage TO authenticated;
GRANT ALL PRIVILEGES ON banners TO authenticated;
GRANT ALL PRIVILEGES ON announcements TO authenticated;
GRANT ALL PRIVILEGES ON delivery_addresses TO authenticated;
GRANT ALL PRIVILEGES ON platform_settings TO authenticated;

-- 为anon角色授予读取权限
GRANT SELECT ON user_profiles TO anon;
GRANT SELECT ON merchants TO anon;
GRANT SELECT ON products TO anon;
GRANT SELECT ON banners TO anon;
GRANT SELECT ON announcements TO anon;

-- ============================================================================
-- 6. 初始化数据
-- ============================================================================

-- 平台设置初始化
INSERT INTO platform_settings (key, value) VALUES 
('platform_name', '码上购'),
('super_admin_password_hash', NULL),
('sms_service_config', '{}'),
('platform_commission_rate', '0.05')
ON CONFLICT (key) DO NOTHING;

-- 示例公告
INSERT INTO announcements (title, content, is_active, target_roles) VALUES
('欢迎使用码上购平台', '欢迎使用码上购医院便民购物平台！我们致力于为医院患者和家属提供便捷的购物服务。', true, ARRAY['customer', 'merchant']),
('平台使用指南', '请注意：下单时请准确填写病房号和联系方式，以便我们及时为您配送。如有任何问题，请联系客服。', true, ARRAY['customer'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. 字段注释
-- ============================================================================

COMMENT ON COLUMN promotions.max_usage_product_count IS '最大使用商品数限制';
COMMENT ON COLUMN promotions.current_usage_product_count IS '当前已使用商品数';
COMMENT ON COLUMN promotion_usage.product_count IS '本次使用涉及的商品数量';
COMMENT ON COLUMN announcements.announcement_type IS '公告类型：general, urgent, maintenance, promotion';
COMMENT ON COLUMN announcements.target_roles IS '目标角色数组：customer, merchant, super_admin';
COMMENT ON COLUMN orders.payment_deadline IS '支付截止时间';
COMMENT ON COLUMN orders.auto_close_at IS '自动关闭时间';
COMMENT ON COLUMN merchants.status IS '商家状态：pending(待审核), active(已激活), suspended(已封停)';

-- ============================================================================
-- 8. 存储桶创建 (Supabase Storage)
-- ============================================================================

-- 创建存储桶用于图片上传
-- 注意：这部分需要在Supabase控制台中手动创建或通过API创建
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('banner-images', 'banner-images', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('merchant-qr-codes', 'merchant-qr-codes', true);

COMMIT;

-- ============================================================================
-- 迁移完成
-- ============================================================================
-- 此脚本包含了所有必要的表结构、索引、触发器、RLS策略和初始数据
-- 适用于全新部署或现有数据库的完整迁移
-- 版本: 1.0
-- 最后更新: 2025-01-18