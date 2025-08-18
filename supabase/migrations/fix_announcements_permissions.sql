-- 检查并修复公告表权限

-- 确保RLS已启用
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Public can view active announcements" ON announcements;
DROP POLICY IF EXISTS "Authenticated users can view all announcements" ON announcements;
DROP POLICY IF EXISTS "Authenticated users can manage announcements" ON announcements;

-- 创建新的RLS策略

-- 允许所有用户查看激活的公告
CREATE POLICY "Public can view active announcements" ON announcements
  FOR SELECT
  USING (is_active = true);

-- 允许认证用户查看所有公告
CREATE POLICY "Authenticated users can view all announcements" ON announcements
  FOR SELECT
  TO authenticated
  USING (true);

-- 允许认证用户管理公告（增删改）
CREATE POLICY "Authenticated users can manage announcements" ON announcements
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 为anon和authenticated角色授予权限
GRANT SELECT ON announcements TO anon;
GRANT ALL PRIVILEGES ON announcements TO authenticated;

-- 检查当前权限
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'announcements'
  AND grantee IN ('anon', 'authenticated') 
ORDER BY grantee, privilege_type;