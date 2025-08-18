-- 修复商家注册问题的SQL脚本

-- 1. 首先检查是否有auth用户但没有user_profiles的情况
WITH missing_profiles AS (
    SELECT 
        au.id,
        au.phone,
        au.raw_user_meta_data->>'name' as name,
        au.raw_user_meta_data->>'user_type' as user_type,
        au.created_at
    FROM auth.users au
    LEFT JOIN user_profiles up ON au.id = up.id
    WHERE up.id IS NULL
      AND au.phone IS NOT NULL
)
SELECT 
    'Missing user_profiles for auth users:' as message,
    id,
    phone,
    name,
    user_type,
    created_at
FROM missing_profiles;

-- 2. 为缺失的用户配置创建记录
INSERT INTO user_profiles (id, phone, name, user_type, created_at, updated_at)
SELECT 
    au.id,
    REPLACE(au.phone, '+86', '') as phone, -- 移除+86前缀
    COALESCE(au.raw_user_meta_data->>'name', 'Unknown User') as name,
    COALESCE(au.raw_user_meta_data->>'user_type', 'customer') as user_type,
    au.created_at,
    NOW() as updated_at
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
  AND au.phone IS NOT NULL
  AND au.confirmed_at IS NOT NULL; -- 只为已确认的用户创建配置

-- 3. 确保RLS策略正确配置
-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- 创建新的RLS策略
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. 确保authenticated角色有正确的权限
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 5. 检查特定用户的情况
SELECT 
    'Checking specific user:' as message,
    up.id,
    up.phone,
    up.name,
    up.user_type,
    up.created_at,
    CASE 
        WHEN au.id IS NOT NULL THEN 'Auth user exists'
        ELSE 'Auth user missing'
    END as auth_status
FROM user_profiles up
FULL OUTER JOIN auth.users au ON up.id = au.id
WHERE up.id = '1acf36a1-c0a0-48d7-bfb9-b93db809158c'
   OR au.id = '1acf36a1-c0a0-48d7-bfb9-b93db809158c';

-- 6. 显示修复后的状态
SELECT 
    'User profiles after fix:' as message,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN user_type = 'merchant' THEN 1 END) as merchant_count,
    COUNT(CASE WHEN user_type = 'customer' THEN 1 END) as customer_count
FROM user_profiles;

-- 7. 检查RLS策略状态
SELECT 
    'RLS policies:' as message,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;