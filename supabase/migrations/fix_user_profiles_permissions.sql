-- 确保authenticated用户有正确的权限访问user_profiles表

-- 授予authenticated角色对user_profiles表的SELECT权限
GRANT SELECT ON user_profiles TO authenticated;

-- 授予authenticated角色对user_profiles表的INSERT权限（用于注册）
GRANT INSERT ON user_profiles TO authenticated;

-- 授予authenticated角色对user_profiles表的UPDATE权限（用于更新配置）
GRANT UPDATE ON user_profiles TO authenticated;

-- 创建或更新RLS策略，允许用户访问自己的配置
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 确保RLS已启用
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 验证权限设置
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;