-- 创建收货地址表
CREATE TABLE IF NOT EXISTS delivery_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_id ON delivery_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_is_default ON delivery_addresses(user_id, is_default);

-- 启用RLS
ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Users can view own addresses" ON delivery_addresses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses" ON delivery_addresses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses" ON delivery_addresses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses" ON delivery_addresses
    FOR DELETE USING (auth.uid() = user_id);

-- 授予权限
GRANT ALL ON delivery_addresses TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 创建触发器来自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_delivery_addresses_updated_at
    BEFORE UPDATE ON delivery_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 确保每个用户只能有一个默认地址的触发器
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
    -- 如果新记录设置为默认地址，则取消同一用户的其他默认地址
    IF NEW.is_default = TRUE THEN
        UPDATE delivery_addresses 
        SET is_default = FALSE 
        WHERE user_id = NEW.user_id 
          AND id != NEW.id 
          AND is_default = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER ensure_single_default_address_trigger
    BEFORE INSERT OR UPDATE ON delivery_addresses
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_address();

-- 插入一些示例数据（可选）
-- INSERT INTO delivery_addresses (user_id, name, phone, address, is_default)
-- VALUES 
--     ('user-id-1', '张三', '13800138000', '北京市朝阳区某某医院1号楼301室', true),
--     ('user-id-1', '李四', '13900139000', '北京市朝阳区某某医院2号楼201室', false);