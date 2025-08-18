-- 增强公告系统，支持多角色发布
-- 根据PRD需求：支持选择发布对象，支持多选（如同时向顾客和商家发布）

-- 1. 添加目标用户类型字段
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT ARRAY['customer', 'merchant'];

-- 2. 添加发布者信息字段
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS publisher_id UUID;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS publisher_name VARCHAR(100) DEFAULT '系统管理员';

-- 3. 添加公告类型字段
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS announcement_type VARCHAR(50) DEFAULT 'general' 
  CHECK (announcement_type IN ('general', 'urgent', 'maintenance', 'promotion'));

-- 4. 添加有效期字段
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE;

-- 5. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_announcements_target_roles ON announcements USING GIN(target_roles);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(announcement_type);
CREATE INDEX IF NOT EXISTS idx_announcements_valid_period ON announcements(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_announcements_active_created ON announcements(is_active, created_at DESC);

-- 6. 更新现有公告的目标角色（默认向所有用户发布）
UPDATE announcements 
SET target_roles = ARRAY['customer', 'merchant']
WHERE target_roles IS NULL OR array_length(target_roles, 1) IS NULL;

-- 7. 创建函数：获取用户可见的公告
CREATE OR REPLACE FUNCTION get_announcements_for_user(user_role TEXT)
RETURNS TABLE (
    id UUID,
    title VARCHAR(255),
    content TEXT,
    announcement_type VARCHAR(50),
    publisher_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.content,
        a.announcement_type,
        a.publisher_name,
        a.created_at,
        a.valid_until
    FROM announcements a
    WHERE 
        a.is_active = true
        AND user_role = ANY(a.target_roles)
        AND a.valid_from <= NOW()
        AND (a.valid_until IS NULL OR a.valid_until > NOW())
    ORDER BY 
        CASE a.announcement_type 
            WHEN 'urgent' THEN 1
            WHEN 'maintenance' THEN 2
            WHEN 'promotion' THEN 3
            ELSE 4
        END,
        a.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建函数：统计各角色的公告数量
CREATE OR REPLACE FUNCTION count_announcements_by_role()
RETURNS TABLE (
    role_name TEXT,
    total_count BIGINT,
    active_count BIGINT,
    urgent_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH role_stats AS (
        SELECT 
            unnest(ARRAY['customer', 'merchant']) as role_name
    )
    SELECT 
        rs.role_name,
        COUNT(a.id) as total_count,
        COUNT(CASE WHEN a.is_active = true THEN 1 END) as active_count,
        COUNT(CASE WHEN a.is_active = true AND a.announcement_type = 'urgent' THEN 1 END) as urgent_count
    FROM role_stats rs
    LEFT JOIN announcements a ON rs.role_name = ANY(a.target_roles)
    GROUP BY rs.role_name;
END;
$$ LANGUAGE plpgsql;

-- 9. 更新RLS策略以支持多角色
DROP POLICY IF EXISTS "Public can view active announcements" ON announcements;
DROP POLICY IF EXISTS "Authenticated users can view all announcements" ON announcements;
DROP POLICY IF EXISTS "Authenticated users can manage announcements" ON announcements;

-- 允许所有用户查看激活的公告（根据角色过滤）
CREATE POLICY "Public can view role-specific announcements" ON announcements
  FOR SELECT
  USING (
    is_active = true 
    AND valid_from <= NOW()
    AND (valid_until IS NULL OR valid_until > NOW())
  );

-- 允许认证用户查看所有公告
CREATE POLICY "Authenticated users can view all announcements" ON announcements
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 允许认证用户管理公告
CREATE POLICY "Authenticated users can manage announcements" ON announcements
  FOR ALL
  USING (auth.role() = 'authenticated');

-- 10. 插入示例多角色公告
INSERT INTO announcements (title, content, target_roles, announcement_type, publisher_name) VALUES
('系统维护通知', '系统将于今晚22:00-24:00进行维护升级，期间可能影响正常使用，请提前安排。', ARRAY['customer', 'merchant'], 'maintenance', '系统管理员'),
('新功能上线', '平台新增了订单实时跟踪功能，现在您可以更方便地查看订单状态。', ARRAY['customer'], 'general', '系统管理员'),
('商家优惠活动', '欢迎商家设置优惠活动吸引更多顾客，详情请查看商家管理后台。', ARRAY['merchant'], 'promotion', '系统管理员')
ON CONFLICT DO NOTHING;

COMMIT;