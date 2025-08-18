-- 修复user_profiles表的权限配置
-- 解决"第三态"问题中的权限访问问题

-- 首先检查当前权限状态
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 确保anon角色有基本的SELECT权限（用于公开访问）
GRANT SELECT ON user_profiles TO anon;

-- 确保authenticated角色有完整的访问权限
GRANT ALL PRIVILEGES ON user_profiles TO authenticated;

-- 检查RLS策略是否存在
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 如果需要，创建更宽松的RLS策略以支持用户配置访问
-- 允许用户访问自己的配置
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- 允许用户更新自己的配置
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 允许插入新的用户配置（注册时需要）
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 验证权限配置
SELECT 
    'Permissions after fix:' as status,
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;