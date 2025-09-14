#!/usr/bin/env node

/**
 * 商家状态数据修复脚本
 * 修复 merchants 表中 status 和 is_active 字段的不一致问题
 * 生成时间: 2025-01-18
 * 版本: 1.0
 */

import { createClient } from '@supabase/supabase-js';

// 配置 Supabase 客户端（优先环境变量，其次 .envOfSupabase 文件）
const envUrl = process.env.SUPABASE_PUBLIC_URL || process.env.VITE_SUPABASE_URL;
const envServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

let supabaseUrl = envUrl;
let supabaseServiceKey = envServiceRole;

if (!supabaseUrl || !supabaseServiceKey) {
  // 尝试从 .envOfSupabase 读取
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.join(process.cwd(), '.envOfSupabase');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const map = {};
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          map[key.trim()] = valueParts.join('=').trim();
        }
      });
      supabaseUrl = supabaseUrl || map.SUPABASE_PUBLIC_URL || map.VITE_SUPABASE_URL;
      supabaseServiceKey = supabaseServiceKey || map.SUPABASE_SERVICE_ROLE_KEY || map.SERVICE_ROLE_KEY;
    }
  } catch {}
}

if (!supabaseUrl) {
  console.error('❌ 错误: 缺少 SUPABASE_PUBLIC_URL/VITE_SUPABASE_URL 配置');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ 错误: 缺少 SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY 配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 检查商家状态数据一致性
 */
async function checkMerchantStatusConsistency() {
  console.log('🔍 检查商家状态数据一致性...');
  
  try {
    // 查询所有商家数据
    const { data: merchants, error } = await supabase
      .from('merchants')
      .select('id, name, status, is_active');
    
    if (error) {
      throw error;
    }
    
    if (!merchants || merchants.length === 0) {
      console.log('ℹ️  没有找到商家数据');
      return { total: 0, inconsistent: [] };
    }
    
    // 检查不一致的数据
    const inconsistentMerchants = merchants.filter(merchant => {
      const shouldBeActive = merchant.status === 'active';
      return merchant.is_active !== shouldBeActive;
    });
    
    console.log(`📊 数据统计:`);
    console.log(`   总商家数: ${merchants.length}`);
    console.log(`   状态一致: ${merchants.length - inconsistentMerchants.length}`);
    console.log(`   状态不一致: ${inconsistentMerchants.length}`);
    
    if (inconsistentMerchants.length > 0) {
      console.log('\n❌ 发现不一致的商家数据:');
      inconsistentMerchants.forEach(merchant => {
        console.log(`   - ${merchant.name} (ID: ${merchant.id})`);
        console.log(`     状态: ${merchant.status}, 激活: ${merchant.is_active}`);
      });
    } else {
      console.log('\n✅ 所有商家状态数据一致');
    }
    
    return {
      total: merchants.length,
      inconsistent: inconsistentMerchants
    };
    
  } catch (error) {
    console.error('❌ 检查数据时发生错误:', error.message);
    throw error;
  }
}

/**
 * 修复商家状态数据
 */
async function fixMerchantStatusData(inconsistentMerchants) {
  if (inconsistentMerchants.length === 0) {
    console.log('✅ 没有需要修复的数据');
    return;
  }
  
  console.log(`\n🔧 开始修复 ${inconsistentMerchants.length} 条不一致的数据...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const merchant of inconsistentMerchants) {
    try {
      const shouldBeActive = merchant.status === 'active';
      
      const { error } = await supabase
        .from('merchants')
        .update({ is_active: shouldBeActive })
        .eq('id', merchant.id);
      
      if (error) {
        throw error;
      }
      
      console.log(`   ✅ 修复成功: ${merchant.name} (is_active: ${merchant.is_active} → ${shouldBeActive})`);
      successCount++;
      
    } catch (error) {
      console.error(`   ❌ 修复失败: ${merchant.name} - ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 修复结果:`);
  console.log(`   成功: ${successCount}`);
  console.log(`   失败: ${errorCount}`);
}

/**
 * 验证修复结果
 */
async function verifyFix() {
  console.log('\n🔍 验证修复结果...');
  
  const result = await checkMerchantStatusConsistency();
  
  if (result.inconsistent.length === 0) {
    console.log('\n🎉 所有商家状态数据已修复完成！');
    return true;
  } else {
    console.log(`\n⚠️  仍有 ${result.inconsistent.length} 条数据不一致，可能需要手动处理`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 商家状态数据修复脚本启动');
  console.log('=' .repeat(50));
  
  try {
    // 1. 检查数据一致性
    const checkResult = await checkMerchantStatusConsistency();
    
    if (checkResult.total === 0) {
      console.log('\n✅ 没有商家数据，无需修复');
      return;
    }
    
    // 2. 修复不一致的数据
    if (checkResult.inconsistent.length > 0) {
      await fixMerchantStatusData(checkResult.inconsistent);
      
      // 3. 验证修复结果
      const isFixed = await verifyFix();
      
      if (isFixed) {
        console.log('\n✅ 数据修复完成');
      } else {
        console.log('\n⚠️  数据修复可能不完整，请检查日志');
        process.exit(1);
      }
    }
    
    console.log('\n🎯 建议下一步操作:');
    console.log('1. 应用数据库迁移: supabase db push');
    console.log('2. 重启应用服务器');
    console.log('3. 测试商家激活功能');
    
  } catch (error) {
    console.error('\n❌ 脚本执行失败:', error.message);
    process.exit(1);
  }
}

// 运行脚本
main();

export {
  checkMerchantStatusConsistency,
  fixMerchantStatusData,
  verifyFix
};