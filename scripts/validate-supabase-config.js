#!/usr/bin/env node

/**
 * Supabase 配置验证脚本
 * 用于验证自托管 Supabase 配置是否正确
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取环境变量
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=');
      }
    }
  });
  
  return env;
}

// 验证 JWT Token 格式
function validateJWTFormat(token, tokenName) {
  if (!token) {
    console.log(`❌ ${tokenName} 未设置`);
    return false;
  }
  
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log(`❌ ${tokenName} 格式无效（应该有3个部分）`);
    return false;
  }
  
  try {
    // 验证 header
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      console.log(`❌ ${tokenName} header 无效`);
      return false;
    }
    
    // 验证 payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (!payload.iss || !payload.role) {
      console.log(`❌ ${tokenName} payload 缺少必要字段`);
      return false;
    }
    
    console.log(`✅ ${tokenName} 格式正确`);
    console.log(`   - 角色: ${payload.role}`);
    console.log(`   - 签发者: ${payload.iss}`);
    console.log(`   - 过期时间: ${new Date(payload.exp * 1000).toLocaleString()}`);
    
    return true;
  } catch (error) {
    console.log(`❌ ${tokenName} 解析失败:`, error.message);
    return false;
  }
}

// 测试网络连接
async function testNetworkConnection(url) {
  try {
    console.log(`🔗 测试网络连接: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const startTime = Date.now();
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    if (response.ok || response.status === 401) { // 401 是正常的，表示需要认证
      console.log(`✅ 网络连接正常 (${latency}ms)`);
      return true;
    } else {
      console.log(`❌ 网络连接失败: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 网络连接失败:`, error.message);
    return false;
  }
}

// 测试 Supabase 客户端连接
async function testSupabaseConnection(url, anonKey) {
  try {
    console.log(`🔧 测试 Supabase 客户端连接...`);
    
    const supabase = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(15000)
          });
        }
      }
    });
    
    // 测试基本查询
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`✅ Supabase 连接正常（表为空是正常的）`);
        return true;
      } else if (error.code === 'PGRST301') {
        console.log(`❌ JWT 签名验证失败 - 密钥不匹配`);
        console.log(`   错误详情: ${error.message}`);
        return false;
      } else {
        console.log(`❌ Supabase 连接失败:`, error.message);
        return false;
      }
    }
    
    console.log(`✅ Supabase 连接正常`);
    return true;
  } catch (error) {
    console.log(`❌ Supabase 连接测试失败:`, error.message);
    return false;
  }
}

// 测试认证服务
async function testAuthService(url, anonKey) {
  try {
    console.log(`🔐 测试认证服务...`);
    
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        'apikey': anonKey,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const settings = await response.json();
      console.log(`✅ 认证服务正常`);
      console.log(`   - 邮箱注册: ${settings.external?.email ? '启用' : '禁用'}`);
      console.log(`   - 手机注册: ${settings.external?.phone ? '启用' : '禁用'}`);
      return true;
    } else {
      console.log(`❌ 认证服务失败: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 认证服务测试失败:`, error.message);
    return false;
  }
}

// 主验证函数
async function main() {
  console.log('🔍 开始验证 Supabase 配置...\n');
  
  // 读取配置文件
  const envPath = path.join(process.cwd(), '.env');
  const supabaseEnvPath = path.join(process.cwd(), '.envOfSupabase');
  
  const env = loadEnvFile(envPath);
  const supabaseEnv = loadEnvFile(supabaseEnvPath);
  
  console.log('📋 配置文件检查:');
  console.log(`   .env 文件: ${fs.existsSync(envPath) ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`   .envOfSupabase 文件: ${fs.existsSync(supabaseEnvPath) ? '✅ 存在' : '❌ 不存在'}`);
  console.log();
  
  // 验证环境变量
  console.log('🔧 环境变量检查:');
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const jwtSecret = supabaseEnv.JWT_SECRET;
  const serviceRoleKey = supabaseEnv.SERVICE_ROLE_KEY;
  
  console.log(`   VITE_SUPABASE_URL: ${supabaseUrl || '❌ 未设置'}`);
  console.log(`   JWT_SECRET: ${jwtSecret ? '✅ 已设置' : '❌ 未设置'}`);
  console.log();
  
  // 验证 JWT Token 格式
  console.log('🔑 JWT Token 验证:');
  const anonKeyValid = validateJWTFormat(anonKey, 'ANON_KEY');
  const serviceRoleKeyValid = validateJWTFormat(serviceRoleKey, 'SERVICE_ROLE_KEY');
  console.log();
  
  if (!supabaseUrl || !anonKey) {
    console.log('❌ 缺少必要的环境变量，无法进行连接测试');
    return;
  }
  
  // 网络连接测试
  console.log('🌐 网络连接测试:');
  const networkOk = await testNetworkConnection(supabaseUrl);
  console.log();
  
  if (!networkOk) {
    console.log('❌ 网络连接失败，请检查服务器状态和网络配置');
    return;
  }
  
  // Supabase 连接测试
  console.log('🔗 Supabase 连接测试:');
  const supabaseOk = await testSupabaseConnection(supabaseUrl, anonKey);
  console.log();
  
  // 认证服务测试
  console.log('🔐 认证服务测试:');
  const authOk = await testAuthService(supabaseUrl, anonKey);
  console.log();
  
  // 总结
  console.log('📊 验证结果总结:');
  console.log(`   配置文件: ${fs.existsSync(envPath) && fs.existsSync(supabaseEnvPath) ? '✅' : '❌'}`);
  console.log(`   JWT Token: ${anonKeyValid && serviceRoleKeyValid ? '✅' : '❌'}`);
  console.log(`   网络连接: ${networkOk ? '✅' : '❌'}`);
  console.log(`   Supabase 连接: ${supabaseOk ? '✅' : '❌'}`);
  console.log(`   认证服务: ${authOk ? '✅' : '❌'}`);
  
  const allOk = anonKeyValid && serviceRoleKeyValid && networkOk && supabaseOk && authOk;
  
  console.log();
  if (allOk) {
    console.log('🎉 所有验证通过！Supabase 配置正确。');
  } else {
    console.log('⚠️  存在配置问题，请根据上述检查结果进行修复。');
    
    if (!supabaseOk && anonKeyValid) {
      console.log();
      console.log('💡 建议修复步骤:');
      console.log('   1. 确保自托管 Supabase 服务器正在运行');
      console.log('   2. 检查服务器的 JWT_SECRET 是否与生成的密钥匹配');
      console.log('   3. 重启 Supabase 服务: docker-compose down && docker-compose up -d');
      console.log('   4. 检查防火墙和网络配置');
    }
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(console.error);
} else {
  main().catch(console.error);
}

export { main as validateSupabaseConfig };