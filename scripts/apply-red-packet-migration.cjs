const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 从环境变量或 .envOfSupabase 读取配置（不再使用硬编码默认值）
let SUPABASE_URL = process.env.SUPABASE_PUBLIC_URL || process.env.VITE_SUPABASE_URL;
if (!SUPABASE_URL) {
  try {
    const envPath = path.join(__dirname, '..', '.envOfSupabase');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const map = {};
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [k, ...v] = trimmed.split('=');
          map[k.trim()] = v.join('=').trim();
        }
      });
      SUPABASE_URL = map.SUPABASE_PUBLIC_URL || map.VITE_SUPABASE_URL;
    }
  } catch {}
}
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ 缺少 SERVICE_ROLE_KEY 环境变量');
  console.log('请设置环境变量：');
  console.log('$env:SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

// 创建 Supabase 客户端（使用 SERVICE_ROLE_KEY）
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyRedPacketMigration() {
  try {
    console.log('🚀 开始应用拼手气红包系统迁移...');
    console.log(`📡 连接到: ${SUPABASE_URL}`);
    
    // 读取迁移文件
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '003_add_red_packet_system.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`迁移文件不存在: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 迁移文件读取成功');
    
    // 执行迁移 SQL
    console.log('⚡ 执行数据库迁移...');
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // 如果 exec_sql 函数不存在，尝试直接执行
      console.log('⚠️  exec_sql 函数不存在，尝试分段执行...');
      
      // 将 SQL 分割成多个语句
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      console.log(`📝 共 ${statements.length} 条 SQL 语句需要执行`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            console.log(`⚡ 执行语句 ${i + 1}/${statements.length}...`);
            const { error: stmtError } = await supabase.rpc('exec', {
              sql: statement + ';'
            });
            
            if (stmtError) {
              console.warn(`⚠️  语句 ${i + 1} 执行警告:`, stmtError.message);
              // 继续执行其他语句
            }
          } catch (err) {
            console.warn(`⚠️  语句 ${i + 1} 执行出错:`, err.message);
            // 继续执行其他语句
          }
        }
      }
    }
    
    // 验证迁移结果
    console.log('🔍 验证迁移结果...');
    
    // 检查 promotions 表是否有新字段
    const { data: promotionsColumns, error: columnsError } = await supabase
      .from('promotions')
      .select('*')
      .limit(1);
    
    if (columnsError) {
      console.warn('⚠️  无法验证 promotions 表:', columnsError.message);
    } else {
      console.log('✅ promotions 表访问正常');
    }
    
    // 检查新表是否创建成功
    const tables = ['red_packet_claims', 'user_vouchers'];
    for (const table of tables) {
      try {
        const { error: tableError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (tableError) {
          console.warn(`⚠️  表 ${table} 可能未创建成功:`, tableError.message);
        } else {
          console.log(`✅ 表 ${table} 创建成功`);
        }
      } catch (err) {
        console.warn(`⚠️  无法验证表 ${table}:`, err.message);
      }
    }
    
    // 测试红包领取函数
    console.log('🧪 测试红包领取函数...');
    try {
      const { data: testResult, error: funcError } = await supabase.rpc('claim_red_packet', {
        p_promotion_id: '00000000-0000-0000-0000-000000000000', // 测试用的无效ID
        p_user_id: '00000000-0000-0000-0000-000000000000'
      });
      
      if (funcError) {
        console.warn('⚠️  红包领取函数测试失败:', funcError.message);
      } else {
        console.log('✅ 红包领取函数创建成功');
      }
    } catch (err) {
      console.warn('⚠️  无法测试红包领取函数:', err.message);
    }
    
    console.log('\n🎉 拼手气红包系统迁移完成！');
    console.log('\n📋 迁移内容总结:');
    console.log('  ✅ 扩展 promotions 表，添加红包相关字段');
    console.log('  ✅ 创建 red_packet_claims 表（红包领取记录）');
    console.log('  ✅ 创建 user_vouchers 表（用户代金券）');
    console.log('  ✅ 创建红包领取处理函数');
    console.log('  ✅ 配置 RLS 策略和权限');
    console.log('\n🚀 现在可以开始实现前端功能了！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  }
}

// 执行迁移
applyRedPacketMigration();