#!/usr/bin/env node

/**
 * 云端Supabase存储桶诊断脚本
 * 连接到云端自托管Supabase实例并检查images存储桶配置
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从.envOfSupabase读取配置
function loadCloudConfig() {
  const envPath = path.join(__dirname, '..', '.envOfSupabase');
  if (!fs.existsSync(envPath)) {
    throw new Error('.envOfSupabase文件不存在');
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const config = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      config[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return {
    url: 'http://47.104.163.98:8000', // 云端IP
    anonKey: config.ANON_KEY,
    serviceRoleKey: config.SERVICE_ROLE_KEY
  };
}

// 诊断存储桶配置
async function diagnoseStorageConfig() {
  console.log('🔍 开始诊断云端Supabase存储桶配置...');
  console.log('=' .repeat(60));
  
  try {
    const config = loadCloudConfig();
    console.log(`📡 连接到云端Supabase: ${config.url}`);
    
    if (!config.anonKey || !config.serviceRoleKey) {
      throw new Error('缺少必要的API密钥配置');
    }
    
    // 使用service role key进行管理操作
    const supabase = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Supabase客户端初始化成功');
    
    // 1. 检查存储桶列表
    console.log('\n📋 检查存储桶列表...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ 获取存储桶列表失败:', bucketsError.message);
      console.log('🔧 可能的原因:');
      console.log('   - Supabase Storage服务未启动');
      console.log('   - API密钥权限不足');
      console.log('   - 网络连接问题');
      return;
    }
    
    console.log('✅ 存储桶列表获取成功');
    console.log('📦 现有存储桶:', buckets.map(b => b.name).join(', ') || '无');
    
    // 2. 检查images存储桶是否存在
    const imagesBucket = buckets.find(bucket => bucket.name === 'images');
    
    if (!imagesBucket) {
      console.log('\n❌ images存储桶不存在!');
      console.log('🔧 修复建议:');
      console.log('   1. 在Supabase Dashboard中手动创建images存储桶');
      console.log('   2. 或运行repair-storage.js脚本自动创建');
      console.log('   3. 确保存储桶设置为公共访问');
      
      // 尝试创建存储桶
      console.log('\n🛠️  尝试自动创建images存储桶...');
      const { data: createData, error: createError } = await supabase.storage.createBucket('images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });
      
      if (createError) {
        console.error('❌ 创建存储桶失败:', createError.message);
        console.log('🔧 请手动在Supabase Dashboard中创建images存储桶');
      } else {
        console.log('✅ images存储桶创建成功');
      }
    } else {
      console.log('\n✅ images存储桶存在');
      console.log('📋 存储桶信息:');
      console.log(`   - ID: ${imagesBucket.id}`);
      console.log(`   - 名称: ${imagesBucket.name}`);
      console.log(`   - 公共访问: ${imagesBucket.public ? '是' : '否'}`);
      console.log(`   - 创建时间: ${imagesBucket.created_at}`);
      console.log(`   - 更新时间: ${imagesBucket.updated_at}`);
    }
    
    // 3. 测试存储桶访问权限
    console.log('\n🔐 测试存储桶访问权限...');
    const { data: files, error: listError } = await supabase.storage
      .from('images')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('❌ 列出文件失败:', listError.message);
      console.log('🔧 可能的问题:');
      console.log('   - 存储桶不存在');
      console.log('   - RLS策略配置错误');
      console.log('   - 权限不足');
    } else {
      console.log('✅ 存储桶访问权限正常');
      console.log(`📁 根目录文件数量: ${files.length}`);
    }
    
    // 4. 检查目录结构
    console.log('\n📁 检查目录结构...');
    const directories = ['products', 'banners', 'payment-qr', 'qrcodes', 'uploads'];
    
    for (const dir of directories) {
      const { data: dirFiles, error: dirError } = await supabase.storage
        .from('images')
        .list(dir, { limit: 1 });
      
      if (dirError) {
        console.log(`❌ ${dir}/目录访问失败: ${dirError.message}`);
      } else {
        console.log(`✅ ${dir}/目录可访问 (${dirFiles.length}个文件)`);
      }
    }
    
    // 5. 测试上传权限
    console.log('\n📤 测试上传权限...');
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = 'Supabase存储桶测试文件';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`uploads/${testFileName}`, testContent, {
        contentType: 'text/plain'
      });
    
    if (uploadError) {
      console.error('❌ 上传测试失败:', uploadError.message);
      console.log('🔧 可能的问题:');
      console.log('   - 存储桶不允许上传');
      console.log('   - RLS策略阻止上传');
      console.log('   - 文件大小或类型限制');
    } else {
      console.log('✅ 上传测试成功');
      console.log(`📄 测试文件路径: ${uploadData.path}`);
      
      // 清理测试文件
      await supabase.storage
        .from('images')
        .remove([`uploads/${testFileName}`]);
      console.log('🗑️  测试文件已清理');
    }
    
    // 6. 检查RLS策略
    console.log('\n🛡️  检查storage.objects表的RLS策略...');
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'storage')
      .eq('tablename', 'objects');
    
    if (policiesError) {
      console.log('⚠️  无法查询RLS策略:', policiesError.message);
    } else {
      console.log(`📋 找到${policies.length}个RLS策略`);
      policies.forEach(policy => {
        console.log(`   - ${policy.policyname}: ${policy.cmd} (${policy.roles})`);
      });
    }
    
    // 7. 生成诊断报告
    console.log('\n' + '=' .repeat(60));
    console.log('📊 诊断报告总结:');
    console.log('=' .repeat(60));
    
    if (imagesBucket) {
      console.log('✅ images存储桶存在且可访问');
    } else {
      console.log('❌ images存储桶不存在或无法访问');
    }
    
    console.log('\n🔧 建议的修复步骤:');
    console.log('1. 确保Supabase Storage服务正常运行');
    console.log('2. 在Supabase Dashboard中创建images存储桶');
    console.log('3. 设置存储桶为公共访问');
    console.log('4. 配置适当的RLS策略');
    console.log('5. 验证API密钥权限');
    
  } catch (error) {
    console.error('💥 诊断过程中发生错误:', error.message);
    console.log('\n🔧 故障排除建议:');
    console.log('1. 检查网络连接到云端服务器');
    console.log('2. 验证.envOfSupabase配置文件');
    console.log('3. 确认Supabase服务正在运行');
    console.log('4. 检查防火墙和端口设置');
  }
}

// 运行诊断
diagnoseStorageConfig()
  .then(() => {
    console.log('\n🎉 诊断完成!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 诊断失败:', error.message);
    process.exit(1);
  });

export { diagnoseStorageConfig };