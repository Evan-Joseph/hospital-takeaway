# Supabase 自托管迁移诊断报告

## 🔍 问题诊断

### 当前状态
- ✅ Vite 项目配置已更新为指向云服务器 IP: `http://47.104.163.98:8000`
- ✅ 客户端配置已优化适配自托管环境
- ✅ 添加了连接验证和错误处理机制
- ❌ **JWT 签名验证失败** (JWSError JWSInvalidSignature)

### 根本原因
自托管 Supabase 配置文件 `.envOfSupabase` 中的 `JWT_SECRET` 仍然是默认占位符值：
```
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
```

而客户端使用的 `ANON_KEY` 是基于默认 JWT_SECRET 生成的演示密钥，与实际部署的自托管实例不匹配。

## 🛠️ 解决方案

### 方案 1：更新自托管 Supabase 的 JWT_SECRET（推荐）

1. **生成新的 JWT_SECRET**：
   ```bash
   openssl rand -base64 32
   ```

2. **更新 `.envOfSupabase` 文件**：
   ```env
   JWT_SECRET=<新生成的32字符密钥>
   ```

3. **重新生成 ANON_KEY 和 SERVICE_ROLE_KEY**：
   使用 Supabase CLI 或在线 JWT 生成器，基于新的 JWT_SECRET 生成：
   
   **ANON_KEY payload**:
   ```json
   {
     "iss": "supabase",
     "ref": "<your-project-ref>",
     "role": "anon",
     "iat": 1641910000,
     "exp": 2000000000
   }
   ```
   
   **SERVICE_ROLE_KEY payload**:
   ```json
   {
     "iss": "supabase",
     "ref": "<your-project-ref>",
     "role": "service_role",
     "iat": 1641910000,
     "exp": 2000000000
   }
   ```

4. **重启自托管 Supabase 服务**：
   ```bash
   docker-compose down
   docker-compose up -d
   ```

5. **更新客户端 .env 文件**：
   ```env
   VITE_SUPABASE_ANON_KEY=<新生成的ANON_KEY>
   ```

### 方案 2：使用现有的默认配置

如果自托管实例确实使用默认的 JWT_SECRET，则需要确保：

1. **验证自托管实例配置**：
   - 确认 `JWT_SECRET` 确实是默认值
   - 确认服务正常运行在 `47.104.163.98:8000`

2. **检查网络连接**：
   ```bash
   curl http://47.104.163.98:8000/rest/v1/
   ```

## 🔧 当前已完成的配置优化

### 1. 环境变量更新
```env
# 已更新为云服务器地址
VITE_SUPABASE_URL=http://47.104.163.98:8000
```

### 2. 客户端配置优化
- ✅ 增加了 30 秒网络超时
- ✅ 优化了实时订阅配置
- ✅ 添加了适合云服务器的请求头

### 3. 错误处理和监控
- ✅ 连接验证函数 `validateSupabaseConnection()`
- ✅ 自动重试机制 `withRetry()`
- ✅ 启动时自动连接检测

## 📋 下一步操作

1. **立即执行**：按照方案 1 更新 JWT 配置
2. **验证连接**：重启服务后测试连接
3. **数据迁移**：确认数据是否已正确迁移到自托管实例
4. **功能测试**：测试认证、数据库操作等核心功能

## 🚨 注意事项

- JWT_SECRET 更改后，所有现有的 JWT token 将失效
- 需要重新生成所有 API 密钥
- 确保在生产环境中使用强密码
- 建议备份现有配置文件

---

**状态**: 配置迁移 90% 完成，等待 JWT 配置修复
**最后更新**: $(date)