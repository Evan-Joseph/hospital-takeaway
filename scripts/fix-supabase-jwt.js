#!/usr/bin/env node

/**
 * Supabase JWT 配置修复工具
 * 用于生成新的 JWT 密钥并更新相关配置文件
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT 生成函数
function generateJWT(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// 生成随机 JWT Secret
function generateJWTSecret() {
  return crypto.randomBytes(32).toString('base64');
}

// 生成 ANON KEY
function generateAnonKey(secret) {
  const payload = {
    iss: 'supabase',
    ref: 'hospital-delivery',
    role: 'anon',
    iat: Math.floor(Date.now() / 1000),
    exp: 2000000000 // 2033年
  };
  return generateJWT(payload, secret);
}

// 生成 SERVICE ROLE KEY
function generateServiceRoleKey(secret) {
  const payload = {
    iss: 'supabase',
    ref: 'hospital-delivery',
    role: 'service_role',
    iat: Math.floor(Date.now() / 1000),
    exp: 2000000000 // 2033年
  };
  return generateJWT(payload, secret);
}

// 更新 .env 文件
function updateEnvFile(anonKey) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // 更新或添加 ANON_KEY
  const anonKeyRegex = /^VITE_SUPABASE_ANON_KEY=.*$/m;
  if (anonKeyRegex.test(envContent)) {
    envContent = envContent.replace(anonKeyRegex, `VITE_SUPABASE_ANON_KEY=${anonKey}`);
  } else {
    envContent += `\nVITE_SUPABASE_ANON_KEY=${anonKey}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env 文件已更新');
}

// 更新 .envOfSupabase 文件
function updateSupabaseEnvFile(jwtSecret, anonKey, serviceRoleKey) {
  const envPath = path.join(process.cwd(), '.envOfSupabase');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .envOfSupabase 文件不存在');
    return;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');

  // 更新 JWT_SECRET
  const jwtSecretRegex = /^JWT_SECRET=.*$/m;
  if (jwtSecretRegex.test(envContent)) {
    envContent = envContent.replace(jwtSecretRegex, `JWT_SECRET=${jwtSecret}`);
  }

  // 更新 ANON_KEY
  const anonKeyRegex = /^ANON_KEY=.*$/m;
  if (anonKeyRegex.test(envContent)) {
    envContent = envContent.replace(anonKeyRegex, `ANON_KEY=${anonKey}`);
  }

  // 更新 SERVICE_ROLE_KEY
  const serviceRoleKeyRegex = /^SERVICE_ROLE_KEY=.*$/m;
  if (serviceRoleKeyRegex.test(envContent)) {
    envContent = envContent.replace(serviceRoleKeyRegex, `SERVICE_ROLE_KEY=${serviceRoleKey}`);
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .envOfSupabase 文件已更新');
}

// 主函数
function main() {
  console.log('🔧 开始修复 Supabase JWT 配置...');
  
  // 生成新的 JWT Secret
  const jwtSecret = generateJWTSecret();
  console.log('✅ 生成新的 JWT_SECRET');
  
  // 生成新的密钥
  const anonKey = generateAnonKey(jwtSecret);
  const serviceRoleKey = generateServiceRoleKey(jwtSecret);
  console.log('✅ 生成新的 ANON_KEY 和 SERVICE_ROLE_KEY');
  
  // 更新配置文件
  updateEnvFile(anonKey);
  updateSupabaseEnvFile(jwtSecret, anonKey, serviceRoleKey);
  
  console.log('\n📋 生成的配置信息:');
  console.log('JWT_SECRET:', jwtSecret);
  console.log('ANON_KEY:', anonKey);
  console.log('SERVICE_ROLE_KEY:', serviceRoleKey);
  
  console.log('\n🚨 重要提醒:');
  console.log('1. 请将新的配置部署到您的自托管 Supabase 服务器');
  console.log('2. 重启 Supabase 服务: docker-compose down && docker-compose up -d');
  console.log('3. 重启前端开发服务器以应用新配置');
  
  console.log('\n✅ JWT 配置修复完成!');
}

// 检查是否为主模块
if (import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  main();
} else {
  // 简化的检测方式
  main();
}

export {
  generateJWTSecret,
  generateAnonKey,
  generateServiceRoleKey,
  updateEnvFile,
  updateSupabaseEnvFile
};