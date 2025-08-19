# Supabase 自托管迁移错误修复指南

## 🎯 修复概述

本指南详细说明了如何修复从官方 Supabase 服务迁移到自托管 Supabase 实例时遇到的 JWT 签名错误和其他连接问题。

## 🔍 问题诊断

### 原始错误日志分析

根据提供的 7 条错误日志，主要问题包括：

1. **JWT 签名错误** (JWSError JWSInvalidSignature)
   - 错误代码：PGRST301
   - 根本原因：客户端使用的 ANON_KEY 与服务器的 JWT_SECRET 不匹配

2. **用户配置文件查询失败**
   - 错误代码：PGRST116
   - 原因：数据库中缺少用户配置记录

3. **网络连接中断**
   - 错误：net::ERR_ABORTED
   - 原因：网络不稳定或服务器响应超时

## 🛠️ 已实施的修复方案

### 1. JWT 密钥生成和配置修复

**创建的工具：** `scripts/fix-supabase-jwt.js`

**功能：**
- 生成新的 32 字符 JWT_SECRET
- 基于新密钥生成匹配的 ANON_KEY 和 SERVICE_ROLE_KEY
- 自动更新 `.env` 和 `.envOfSupabase` 配置文件

**使用方法：**
```bash
node scripts/fix-supabase-jwt.js
```

**生成的配置：**
```env
# .env 文件
VITE_SUPABASE_URL=http://47.104.163.98:8000
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .envOfSupabase 文件
JWT_SECRET=9R0xTRjR/j5Flh8hpR1yoyuA1WH8+c3Pqp2rpQMtOHM=
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. AuthContext 错误处理优化

**修复文件：** `src/contexts/AuthContext.tsx`

**主要改进：**
- 添加了自动创建缺失用户配置的功能
- 改进了错误分类和处理逻辑
- 增强了重试机制和用户友好的错误提示

**关键功能：**
```typescript
// 自动创建缺失的用户配置
const createMissingUserProfile = async (userId: string) => {
  // 从 auth.users 获取用户信息并创建配置
}

// 改进的错误处理
if (error.code === 'PGRST116') {
  console.log('[AuthContext] User profile not found, attempting to create one')
  await createMissingUserProfile(userId)
  return
}
```

### 3. 网络连接重试机制

**修复文件：** `src/lib/supabase.ts`

**主要改进：**
- 实现了指数退避重试策略
- 添加了智能错误分类（哪些错误应该重试）
- 增加了网络超时和连接优化

**关键功能：**
```typescript
// 全局 fetch 重试机制
fetch: async (url, options = {}) => {
  const maxRetries = 3
  const baseDelay = 1000
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // 实现指数退避重试
  }
}

// Supabase 专用重试包装器
export const withSupabaseRetry = async <T>(
  operation: () => Promise<{ data: T; error: any }>,
  maxRetries: number = 3
): Promise<{ data: T; error: any }> => {
  // 只对特定错误类型进行重试
}
```

### 4. 配置验证脚本

**创建的工具：** `scripts/validate-supabase-config.js`

**功能：**
- 验证环境变量配置
- 检查 JWT Token 格式和有效性
- 测试网络连接和 Supabase 服务
- 提供详细的诊断报告

**使用方法：**
```bash
node scripts/validate-supabase-config.js
```

## 🚨 当前状态和下一步操作

### ✅ 已完成的修复

1. **JWT 配置修复** - 生成了新的匹配密钥
2. **客户端配置优化** - 更新了环境变量和连接配置
3. **错误处理改进** - 增强了 AuthContext 的错误处理
4. **网络重试机制** - 实现了智能重试策略
5. **验证工具** - 创建了配置验证脚本

### ⚠️ 需要手动操作的步骤

**重要：以下步骤需要在云服务器上执行**

1. **更新服务器配置**
   ```bash
   # 在云服务器 47.104.163.98 上执行
   cd /path/to/supabase
   
   # 更新 .env 文件中的 JWT_SECRET
   JWT_SECRET=9R0xTRjR/j5Flh8hpR1yoyuA1WH8+c3Pqp2rpQMtOHM=
   ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **重启 Supabase 服务**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **检查服务状态**
   ```bash
   docker-compose ps
   curl http://localhost:8000/rest/v1/
   ```

4. **验证配置**
   ```bash
   # 在本地项目中运行
   node scripts/validate-supabase-config.js
   ```

### 🔧 故障排除

**如果验证脚本仍然显示网络连接失败：**

1. **检查服务器状态**
   ```bash
   # 在服务器上检查
   docker-compose logs
   netstat -tlnp | grep 8000
   ```

2. **检查防火墙设置**
   ```bash
   # 确保端口 8000 开放
   ufw status
   iptables -L
   ```

3. **检查网络连通性**
   ```bash
   # 从本地测试
   ping 47.104.163.98
   telnet 47.104.163.98 8000
   ```

## 📋 验证清单

在完成所有修复后，请确认以下项目：

- [ ] 云服务器上的 Supabase 服务正在运行
- [ ] JWT_SECRET 已在服务器上更新
- [ ] 服务器已重启并应用新配置
- [ ] 端口 8000 在防火墙中开放
- [ ] 本地配置验证脚本通过所有测试
- [ ] 前端应用可以正常连接和认证
- [ ] 数据库操作正常工作

## 🎉 预期结果

完成所有步骤后，您应该看到：

1. **验证脚本输出：**
   ```
   🎉 所有验证通过！Supabase 配置正确。
   ```

2. **前端应用：**
   - 不再出现 JWT 签名错误
   - 用户认证正常工作
   - 数据库查询成功
   - 网络连接稳定

3. **浏览器控制台：**
   - 清除所有 PGRST301 错误
   - 清除所有 JWSInvalidSignature 错误
   - 正常的应用日志输出

## 📞 技术支持

如果在执行过程中遇到问题，请检查：

1. **服务器日志：** `docker-compose logs`
2. **网络连接：** `ping` 和 `telnet` 测试
3. **配置文件：** 确保所有密钥正确复制
4. **防火墙：** 确保端口开放

---

**最后更新：** $(date)
**状态：** 客户端修复完成，等待服务器配置更新