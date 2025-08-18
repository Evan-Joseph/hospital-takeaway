-- 检查user_profiles表的RLS策略
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

-- 检查authenticated和anon角色的权限
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 检查特定用户ID是否存在
SELECT 
    id, 
    phone, 
    name, 
    user_type, 
    created_at 
FROM user_profiles 
WHERE id = 'bea1da5a-bacf-4bd3-9d2b-54ed6242d272';