-- 检查特定用户ID是否存在于user_profiles表中
SELECT 
    id,
    phone,
    name,
    user_type,
    created_at,
    updated_at
FROM user_profiles 
WHERE id = '1acf36a1-c0a0-48d7-bfb9-b93db809158c';

-- 检查auth.users表中是否存在该用户
SELECT 
    id,
    phone,
    email,
    created_at,
    confirmed_at,
    raw_user_meta_data
FROM auth.users 
WHERE id = '1acf36a1-c0a0-48d7-bfb9-b93db809158c';

-- 检查user_profiles表的RLS策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 检查当前用户权限
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- 查看所有user_profiles记录（用于调试）
SELECT 
    id,
    phone,
    name,
    user_type,
    created_at
FROM user_profiles 
ORDER BY created_at DESC
LIMIT 10;