/**
 * Supabase Storage 诊断脚本
 * 检查存储桶状态和配置
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

async function diagnoseBuckets() {
  console.log('🔍 开始诊断 Supabase Storage 配置...');
  console.log('=' .repeat(50));

  try {
    // 1. 检查所有存储桶
    console.log('\n📦 检查存储桶列表:');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ 获取存储桶列表失败:', bucketsError.message);
      return;
    }

    console.log(`✓ 找到 ${buckets.length} 个存储桶:`);
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.name} (${bucket.public ? '公共' : '私有'})`);
    });

    // 2. 检查 'images' 存储桶
    const imagesBucket = buckets.find(b => b.name === 'images');
    
    if (!imagesBucket) {
      console.error('\n❌ 未找到 "images" 存储桶!');
      console.log('\n🔧 建议修复步骤:');
      console.log('   1. 执行 SQL 脚本创建存储桶');
      console.log('   2. 或运行存储桶修复工具');
      return;
    }

    console.log('\n✓ "images" 存储桶存在');
    console.log(`   - 类型: ${imagesBucket.public ? '公共' : '私有'}`);
    console.log(`   - ID: ${imagesBucket.id}`);
    console.log(`   - 创建时间: ${imagesBucket.created_at}`);

    // 3. 测试存储桶访问权限
    console.log('\n🔐 测试存储桶访问权限:');
    
    // 尝试列出文件
    const { data: files, error: listError } = await supabase.storage
      .from('images')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('❌ 列出文件失败:', listError.message);
    } else {
      console.log('✓ 可以访问存储桶');
      console.log(`   - 根目录文件数: ${files.length}`);
    }

    // 4. 检查子目录
    console.log('\n📁 检查子目录结构:');
    const directories = ['products', 'banners', 'payment-qr', 'qrcodes', 'uploads'];
    
    for (const dir of directories) {
      const { data: dirFiles, error: dirError } = await supabase.storage
        .from('images')
        .list(dir, { limit: 1 });
      
      if (dirError) {
        console.log(`   - ${dir}/: ❌ (${dirError.message})`);
      } else {
        console.log(`   - ${dir}/: ✓ (${dirFiles.length} 文件)`);
      }
    }

    // 5. 测试上传权限
    console.log('\n📤 测试上传权限:');
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = new Blob(['test content'], { type: 'text/plain' });
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`test/${testFileName}`, testContent);
    
    if (uploadError) {
      console.error('❌ 上传测试失败:', uploadError.message);
    } else {
      console.log('✓ 上传权限正常');
      
      // 清理测试文件
      await supabase.storage
        .from('images')
        .remove([`test/${testFileName}`]);
      console.log('✓ 测试文件已清理');
    }

    // 6. 检查 RLS 策略
    console.log('\n🛡️ 检查 RLS 策略:');
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'storage')
      .eq('tablename', 'objects');
    
    if (policiesError) {
      console.error('❌ 获取 RLS 策略失败:', policiesError.message);
    } else {
      console.log(`✓ 找到 ${policies.length} 个存储相关的 RLS 策略`);
      policies.forEach(policy => {
        console.log(`   - ${policy.policyname}: ${policy.cmd}`);
      });
    }

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 诊断完成');
}

// 运行诊断
diagnoseBuckets().catch(console.error);