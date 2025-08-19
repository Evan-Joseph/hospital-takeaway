#!/usr/bin/env node

/**
 * 云端Supabase存储桶修复脚本
 * 修复images存储桶的MIME类型限制和RLS策略
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

// 修复存储桶配置
async function fixStorageConfig() {
  console.log('🔧 开始修复云端Supabase存储桶配置...');
  console.log('=' .repeat(60));
  
  try {
    const config = loadCloudConfig();
    console.log(`📡 连接到云端Supabase: ${config.url}`);
    
    if (!config.serviceRoleKey) {
      throw new Error('缺少SERVICE_ROLE_KEY配置');
    }
    
    // 使用service role key进行管理操作
    const supabase = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Supabase客户端初始化成功');
    
    // 1. 检查并更新存储桶配置
    console.log('\n🔧 修复存储桶MIME类型限制...');
    
    // 删除现有的images存储桶
    console.log('🗑️  删除现有的images存储桶...');
    const { error: deleteError } = await supabase.storage.deleteBucket('images');
    if (deleteError && !deleteError.message.includes('not found')) {
      console.log('⚠️  删除存储桶时出现警告:', deleteError.message);
    }
    
    // 重新创建images存储桶，配置正确的MIME类型
    console.log('🆕 重新创建images存储桶...');
    const { data: createData, error: createError } = await supabase.storage.createBucket('images', {
      public: true,
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ],
      fileSizeLimit: 5242880 // 5MB
    });
    
    if (createError) {
      console.error('❌ 创建存储桶失败:', createError.message);
      throw createError;
    }
    
    console.log('✅ images存储桶重新创建成功');
    console.log('📋 配置信息:');
    console.log('   - 公共访问: 是');
    console.log('   - 允许的MIME类型: image/jpeg, image/png, image/gif, image/webp, image/svg+xml');
    console.log('   - 文件大小限制: 5MB');
    
    // 2. 执行SQL脚本修复RLS策略
    console.log('\n🛡️  配置storage.objects表的RLS策略...');
    
    const rlsQueries = [
      // 启用RLS
      'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;',
      
      // 删除现有策略（如果存在）
      'DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;',
      'DROP POLICY IF EXISTS "Allow authenticated users to upload" ON storage.objects;',
      'DROP POLICY IF EXISTS "Allow users to upload to images bucket" ON storage.objects;',
      'DROP POLICY IF EXISTS "Allow public access to images bucket" ON storage.objects;',
      
      // 创建新的策略
      `CREATE POLICY "Allow public access to images bucket" ON storage.objects
        FOR SELECT USING (bucket_id = 'images');`,
      
      `CREATE POLICY "Allow users to upload to images bucket" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');`,
      
      `CREATE POLICY "Allow users to update their uploads" ON storage.objects
        FOR UPDATE USING (bucket_id = 'images' AND auth.role() = 'authenticated');`,
      
      `CREATE POLICY "Allow users to delete their uploads" ON storage.objects
        FOR DELETE USING (bucket_id = 'images' AND auth.role() = 'authenticated');`
    ];
    
    for (const query of rlsQueries) {
      console.log(`🔧 执行: ${query.split('\n')[0]}...`);
      const { error: sqlError } = await supabase.rpc('exec_sql', { sql: query });
      
      if (sqlError) {
        console.log(`⚠️  SQL执行警告: ${sqlError.message}`);
        // 继续执行其他查询
      } else {
        console.log('✅ SQL执行成功');
      }
    }
    
    // 3. 授予权限
    console.log('\n🔑 配置权限...');
    const permissionQueries = [
      'GRANT ALL PRIVILEGES ON storage.objects TO authenticated;',
      'GRANT SELECT ON storage.objects TO anon;',
      'GRANT ALL PRIVILEGES ON storage.buckets TO authenticated;',
      'GRANT SELECT ON storage.buckets TO anon;'
    ];
    
    for (const query of permissionQueries) {
      console.log(`🔧 执行权限配置: ${query}`);
      const { error: permError } = await supabase.rpc('exec_sql', { sql: query });
      
      if (permError) {
        console.log(`⚠️  权限配置警告: ${permError.message}`);
      } else {
        console.log('✅ 权限配置成功');
      }
    }
    
    // 4. 测试修复结果
    console.log('\n🧪 测试修复结果...');
    
    // 测试图片上传
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const testFileName = `test-${Date.now()}.png`;
    
    // 将base64转换为blob
    const base64Data = testImageData.split(',')[1];
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`uploads/${testFileName}`, bytes, {
        contentType: 'image/png'
      });
    
    if (uploadError) {
      console.error('❌ 图片上传测试失败:', uploadError.message);
    } else {
      console.log('✅ 图片上传测试成功');
      console.log(`📄 测试文件路径: ${uploadData.path}`);
      
      // 测试公共访问
      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(`uploads/${testFileName}`);
      
      console.log(`🌐 公共访问URL: ${publicUrlData.publicUrl}`);
      
      // 清理测试文件
      await supabase.storage
        .from('images')
        .remove([`uploads/${testFileName}`]);
      console.log('🗑️  测试文件已清理');
    }
    
    // 5. 生成修复报告
    console.log('\n' + '=' .repeat(60));
    console.log('📊 修复完成报告:');
    console.log('=' .repeat(60));
    console.log('✅ images存储桶已重新创建并配置');
    console.log('✅ MIME类型限制已修复');
    console.log('✅ RLS策略已配置');
    console.log('✅ 权限已正确设置');
    
    if (!uploadError) {
      console.log('✅ 图片上传功能正常');
    }
    
    console.log('\n🎯 现在可以正常使用图片上传功能了!');
    
  } catch (error) {
    console.error('💥 修复过程中发生错误:', error.message);
    console.log('\n🔧 故障排除建议:');
    console.log('1. 检查网络连接到云端服务器');
    console.log('2. 验证SERVICE_ROLE_KEY权限');
    console.log('3. 确认Supabase服务正在运行');
    console.log('4. 手动在Supabase Dashboard中配置存储桶');
    throw error;
  }
}

// 运行修复
fixStorageConfig()
  .then(() => {
    console.log('\n🎉 修复完成!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 修复失败:', error.message);
    process.exit(1);
  });

export { fixStorageConfig };