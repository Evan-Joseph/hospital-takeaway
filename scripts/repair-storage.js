/**
 * Supabase Storage 自动修复工具
 * 自动创建和配置缺失的存储桶
 */

import { createClient } from '@supabase/supabase-js';

// 读取环境变量
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function repairStorage() {
  console.log('🔧 开始修复 Supabase Storage 配置...');
  console.log('=' .repeat(50));

  try {
    // 1. 检查现有存储桶
    console.log('\n📦 检查现有存储桶:');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ 获取存储桶列表失败:', bucketsError.message);
      return;
    }

    const imagesBucket = buckets.find(b => b.name === 'images');
    
    if (imagesBucket) {
      console.log('✓ "images" 存储桶已存在');
      console.log('   - 跳过创建步骤');
    } else {
      console.log('❌ "images" 存储桶不存在，开始创建...');
      
      // 2. 创建 images 存储桶
      const { data: createData, error: createError } = await supabase.storage
        .createBucket('images', {
          public: true,
          allowedMimeTypes: [
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/gif',
            'image/webp'
          ],
          fileSizeLimit: 5242880 // 5MB
        });
      
      if (createError) {
        console.error('❌ 创建存储桶失败:', createError.message);
        
        // 如果是权限问题，提供SQL解决方案
        if (createError.message.includes('permission') || createError.message.includes('policy')) {
          console.log('\n💡 检测到权限问题，请执行以下SQL脚本:');
          console.log('\n```sql');
          console.log(generateStorageBucketSQL());
          console.log('```\n');
        }
        return;
      }
      
      console.log('✓ "images" 存储桶创建成功');
    }

    // 3. 验证存储桶配置
    console.log('\n🔍 验证存储桶配置:');
    
    // 测试上传权限
    const testFileName = `repair-test-${Date.now()}.txt`;
    const testContent = new Blob(['repair test'], { type: 'text/plain' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`test/${testFileName}`, testContent);
    
    if (uploadError) {
      console.error('❌ 上传测试失败:', uploadError.message);
      
      // 提供详细的修复建议
      console.log('\n🔧 修复建议:');
      if (uploadError.message.includes('Bucket not found')) {
        console.log('   1. 存储桶可能未正确创建，请检查数据库');
        console.log('   2. 执行完整的SQL迁移脚本');
      } else if (uploadError.message.includes('policy')) {
        console.log('   1. RLS策略可能未正确配置');
        console.log('   2. 检查storage.objects表的权限设置');
      }
      
      console.log('\n💡 完整SQL修复脚本:');
      console.log('\n```sql');
      console.log(generateStorageBucketSQL());
      console.log('```\n');
      
    } else {
      console.log('✓ 上传功能正常');
      
      // 清理测试文件
      await supabase.storage
        .from('images')
        .remove([`test/${testFileName}`]);
      console.log('✓ 测试文件已清理');
    }

    // 4. 创建必要的目录结构
    console.log('\n📁 确保目录结构存在:');
    const directories = ['products', 'banners', 'payment-qr', 'qrcodes', 'uploads'];
    
    for (const dir of directories) {
      const placeholderFile = `${dir}/.gitkeep`;
      const placeholderContent = new Blob([''], { type: 'text/plain' });
      
      const { error: dirError } = await supabase.storage
        .from('images')
        .upload(placeholderFile, placeholderContent, {
          upsert: true
        });
      
      if (dirError && !dirError.message.includes('already exists')) {
        console.log(`   - ${dir}/: ❌ (${dirError.message})`);
      } else {
        console.log(`   - ${dir}/: ✓`);
      }
    }

  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 修复完成');
}

function generateStorageBucketSQL() {
  return `-- Supabase Storage 存储桶配置
-- 创建 images 存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images', 
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 启用 storage.objects 表的 RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to images" ON storage.objects;

-- 创建新的 RLS 策略
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    bucket_id = 'images'
  );

CREATE POLICY "Allow authenticated users to update files" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    bucket_id = 'images'
  );

CREATE POLICY "Allow authenticated users to delete files" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    bucket_id = 'images'
  );

CREATE POLICY "Allow public read access to images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'images'
  );

-- 授予权限
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO anon;`;
}

// 运行修复
repairStorage().catch(console.error);