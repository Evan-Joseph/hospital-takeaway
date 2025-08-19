# 商家激活状态同步问题修复指南

## 🎯 问题描述

在超管后台已明确激活商家的情况下，商家后台却显示未激活。这是由于数据库中 `merchants` 表的两个状态字段不同步导致的：

- **超管后台**：使用 `status` 字段管理商家状态（`pending`/`active`/`suspended`/`rejected`）
- **商家后台**：使用 `is_active` 字段判断激活状态（`true`/`false`）

## 🔍 根本原因分析

1. **字段不同步**：超管后台激活商家时只更新 `status = 'active'`，但没有同步更新 `is_active = true`
2. **缺少触发器**：数据库没有自动同步机制来保持两个字段的一致性
3. **历史数据不一致**：现有数据中可能存在 `status = 'active'` 但 `is_active = false` 的情况

## 🛠️ 已实施的修复方案

### 1. 数据库触发器修复

**文件**: `supabase/migrations/001_fix_merchant_status_sync.sql`

- ✅ 创建了 `sync_merchant_status()` 函数
- ✅ 添加了 `sync_merchant_status_trigger` 触发器
- ✅ 自动同步 `status` 和 `is_active` 字段

**同步规则**:
```sql
-- 当 status = 'active' 时，is_active = true
-- 当 status != 'active' 时，is_active = false
```

### 2. 超管后台逻辑修复

**文件**: `src/pages/super-admin/MerchantManagement.tsx`

- ✅ 修复了 `handleStatusUpdate` 函数
- ✅ 现在同时更新 `status` 和 `is_active` 字段
- ✅ 确保数据一致性

**修复前**:
```javascript
.update({ status: status })
```

**修复后**:
```javascript
const updateData = { status, is_active: (status === 'active') };
.update(updateData)
```

### 3. 数据修复脚本

**文件**: `scripts/fix-merchant-status-data.js`

- ✅ 检查现有数据的一致性
- ✅ 自动修复不一致的记录
- ✅ 提供详细的修复报告

## 🚨 需要手动执行的步骤

### 步骤 1: 应用数据库迁移

在云服务器 (47.104.163.98) 上执行：

```bash
# 方法 1: 使用 Supabase CLI（推荐）
supabase db push

# 方法 2: 手动执行 SQL
# 将 001_fix_merchant_status_sync.sql 的内容复制到 Supabase Dashboard 的 SQL Editor 中执行
```

### 步骤 2: 修复现有数据

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 检查不一致的数据
SELECT id, name, status, is_active 
FROM merchants 
WHERE (status = 'active' AND is_active = false) 
   OR (status != 'active' AND is_active = true);

-- 修复不一致的数据
UPDATE merchants 
SET is_active = (status = 'active')
WHERE (status = 'active' AND is_active = false) 
   OR (status != 'active' AND is_active = true);

-- 验证修复结果
SELECT 
  COUNT(*) as total_merchants,
  COUNT(CASE WHEN status = 'active' AND is_active = true THEN 1 END) as active_consistent,
  COUNT(CASE WHEN status != 'active' AND is_active = false THEN 1 END) as inactive_consistent,
  COUNT(CASE WHEN (status = 'active' AND is_active = false) OR (status != 'active' AND is_active = true) THEN 1 END) as inconsistent
FROM merchants;
```

### 步骤 3: 重启应用服务

```bash
# 重启前端开发服务器
npm run dev

# 如果有后端服务，也需要重启
```

## 🧪 测试验证

### 1. 超管后台测试

1. 登录超管后台
2. 找到一个状态为 `pending` 的商家
3. 点击「激活」按钮
4. 验证商家状态变为 `active`

### 2. 商家后台测试

1. 使用被激活的商家账号登录
2. 检查商家后台是否显示「店铺已激活」
3. 验证可以正常接收订单

### 3. 数据库验证

```sql
-- 检查特定商家的状态
SELECT id, name, status, is_active 
FROM merchants 
WHERE id = 'your-merchant-id';

-- 检查所有商家状态一致性
SELECT 
  status,
  is_active,
  COUNT(*) as count
FROM merchants 
GROUP BY status, is_active
ORDER BY status, is_active;
```

## 📊 预期结果

修复完成后，应该达到以下效果：

- ✅ 超管激活商家时，`status` 和 `is_active` 字段同步更新
- ✅ 商家后台正确显示激活状态
- ✅ 所有历史数据的状态字段保持一致
- ✅ 未来的状态变更自动保持同步

## 🔧 故障排除

### 问题 1: 触发器未生效

**症状**: 更新 `status` 后 `is_active` 没有自动更新

**解决方案**:
```sql
-- 检查触发器是否存在
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'sync_merchant_status_trigger';

-- 重新创建触发器
DROP TRIGGER IF EXISTS sync_merchant_status_trigger ON merchants;
CREATE TRIGGER sync_merchant_status_trigger
    BEFORE UPDATE ON merchants
    FOR EACH ROW
    EXECUTE FUNCTION sync_merchant_status();
```

### 问题 2: 前端缓存问题

**症状**: 数据库已修复但前端仍显示旧状态

**解决方案**:
1. 清除浏览器缓存
2. 重启开发服务器
3. 强制刷新页面 (Ctrl+F5)

### 问题 3: 权限问题

**症状**: 无法更新商家状态

**解决方案**:
```sql
-- 检查表权限
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'merchants' 
  AND grantee IN ('anon', 'authenticated');

-- 授予必要权限
GRANT ALL PRIVILEGES ON merchants TO authenticated;
```

## 📝 维护建议

1. **定期检查**: 每周检查一次数据一致性
2. **监控日志**: 关注商家激活相关的错误日志
3. **备份数据**: 在重要操作前备份 `merchants` 表
4. **文档更新**: 保持修复文档的及时更新

## 🎉 总结

通过以上修复方案，我们解决了商家激活状态不同步的问题：

1. **根本解决**: 创建了数据库触发器确保字段同步
2. **前端修复**: 更新了超管后台的激活逻辑
3. **数据修复**: 提供了脚本修复历史数据
4. **预防措施**: 建立了长期的数据一致性保障机制

现在商家激活状态将在超管后台和商家后台之间保持完全同步！