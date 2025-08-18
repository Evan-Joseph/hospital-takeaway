-- 创建公告表
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE
    ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 所有用户都可以查看激活的公告
CREATE POLICY "Anyone can view active announcements" ON announcements FOR SELECT USING (is_active = true);

-- 只有认证用户可以查看所有公告（包括未激活的）
CREATE POLICY "Authenticated users can view all announcements" ON announcements FOR SELECT USING (auth.role() = 'authenticated');

-- 只有认证用户可以创建、更新、删除公告（超级管理员功能）
CREATE POLICY "Authenticated users can manage announcements" ON announcements FOR ALL USING (auth.role() = 'authenticated');

-- 为authenticated角色授权
GRANT ALL PRIVILEGES ON announcements TO authenticated;
GRANT SELECT ON announcements TO anon;

-- 插入示例公告
INSERT INTO announcements (title, content, is_active) VALUES
('欢迎使用码上购平台', '欢迎使用码上购医院便民购物平台！我们致力于为医院患者和家属提供便捷的购物服务。', true),
('平台使用指南', '请注意：下单时请准确填写病房号和联系方式，以便我们及时为您配送。如有任何问题，请联系客服。', true);