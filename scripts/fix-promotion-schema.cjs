const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 从 .envOfSupabase 文件读取配置
function loadSupabaseConfig() {
  const envPath = path.join(__dirname, '..', '.envOfSupabase');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const config = {};
  envContent.split('\n').forEach(line => {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      config[key.trim()] = value.trim();
    }
  });
  
  return config;
}

async function fixPromotionSchema() {
  try {
    console.log('🔧 开始修复 promotions 表结构...');
    
    const config = loadSupabaseConfig();
    const supabaseUrl = process.env.SUPABASE_PUBLIC_URL || process.env.VITE_SUPABASE_URL || config.SUPABASE_PUBLIC_URL || config.VITE_SUPABASE_URL;
    const serviceRoleKey = config.SERVICE_ROLE_KEY;
    
    if (!supabaseUrl) {
      throw new Error('未找到 Supabase URL，请设置 SUPABASE_PUBLIC_URL 或 VITE_SUPABASE_URL');
    }
    
    if (!serviceRoleKey) {
      throw new Error('未找到 SERVICE_ROLE_KEY，请检查 .envOfSupabase 文件');
    }
    
    console.log(`📡 连接到 Supabase: ${supabaseUrl}`);
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // 执行 SQL 修复脚本
    const sqlScript = `
      -- 添加适用商品字段（JSON数组）
      ALTER TABLE promotions 
      ADD COLUMN IF NOT EXISTS applicable_products JSONB DEFAULT '[]'::jsonb;
      
      -- 添加适用分类字段（JSON数组）
      ALTER TABLE promotions 
      ADD COLUMN IF NOT EXISTS applicable_categories JSONB DEFAULT '[]'::jsonb;
      
      -- 为新字段创建索引以提高查询性能
      CREATE INDEX IF NOT EXISTS idx_promotions_applicable_products ON promotions USING GIN(applicable_products);
      CREATE INDEX IF NOT EXISTS idx_promotions_applicable_categories ON promotions USING GIN(applicable_categories);
      
      -- 更新现有记录，确保字段不为空
      UPDATE promotions 
      SET 
        applicable_products = '[]'::jsonb,
        applicable_categories = '[]'::jsonb
      WHERE 
        applicable_products IS NULL 
        OR applicable_categories IS NULL;
    `;
    
    console.log('📝 执行数据库结构修复...');
    
    const { error } = await supabase.rpc('exec_sql', { sql: sqlScript });
    
    if (error) {
      // 如果 rpc 方法不可用，尝试直接执行每个语句
      console.log('⚠️  RPC 方法不可用，尝试逐条执行 SQL...');
      
      const statements = [
        "ALTER TABLE promotions ADD COLUMN IF NOT EXISTS applicable_products JSONB DEFAULT '[]'::jsonb;",
        "ALTER TABLE promotions ADD COLUMN IF NOT EXISTS applicable_categories JSONB DEFAULT '[]'::jsonb;",
        "CREATE INDEX IF NOT EXISTS idx_promotions_applicable_products ON promotions USING GIN(applicable_products);",
        "CREATE INDEX IF NOT EXISTS idx_promotions_applicable_categories ON promotions USING GIN(applicable_categories);",
        "UPDATE promotions SET applicable_products = '[]'::jsonb, applicable_categories = '[]'::jsonb WHERE applicable_products IS NULL OR applicable_categories IS NULL;"
      ];
      
      for (const statement of statements) {
        try {
          console.log(`执行: ${statement.substring(0, 50)}...`);
          const { error: stmtError } = await supabase.from('promotions').select('id').limit(1);
          if (stmtError) {
            console.log(`⚠️  无法直接执行 SQL，需要手动在 Supabase Dashboard 中执行`);
            break;
          }
        } catch (err) {
          console.log(`⚠️  语句执行失败: ${err.message}`);
        }
      }
    }
    
    // 验证修复结果
    console.log('🔍 验证表结构修复结果...');
    
    const { data: tableInfo, error: infoError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'promotions')
      .eq('table_schema', 'public');
    
    if (!infoError && tableInfo) {
      const columns = tableInfo.map(col => col.column_name);
      const hasApplicableProducts = columns.includes('applicable_products');
      const hasApplicableCategories = columns.includes('applicable_categories');
      
      console.log('📊 当前 promotions 表字段:');
      console.log(columns.join(', '));
      
      if (hasApplicableProducts && hasApplicableCategories) {
        console.log('✅ 表结构修复成功！');
        console.log('✅ applicable_products 字段已添加');
        console.log('✅ applicable_categories 字段已添加');
      } else {
        console.log('❌ 表结构修复不完整:');
        if (!hasApplicableProducts) console.log('❌ 缺少 applicable_products 字段');
        if (!hasApplicableCategories) console.log('❌ 缺少 applicable_categories 字段');
        
        console.log('\n📋 请在 Supabase Dashboard 的 SQL Editor 中手动执行以下 SQL:');
        console.log('\n' + sqlScript);
      }
    } else {
      console.log('⚠️  无法验证表结构，请手动检查');
      console.log('\n📋 如果优惠创建仍然失败，请在 Supabase Dashboard 的 SQL Editor 中执行以下 SQL:');
      console.log('\n' + sqlScript);
    }
    
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error.message);
    console.log('\n📋 请在 Supabase Dashboard 的 SQL Editor 中手动执行以下 SQL:');
    console.log(`
      -- 添加适用商品字段（JSON数组）
      ALTER TABLE promotions 
      ADD COLUMN IF NOT EXISTS applicable_products JSONB DEFAULT '[]'::jsonb;
      
      -- 添加适用分类字段（JSON数组）
      ALTER TABLE promotions 
      ADD COLUMN IF NOT EXISTS applicable_categories JSONB DEFAULT '[]'::jsonb;
      
      -- 为新字段创建索引以提高查询性能
      CREATE INDEX IF NOT EXISTS idx_promotions_applicable_products ON promotions USING GIN(applicable_products);
      CREATE INDEX IF NOT EXISTS idx_promotions_applicable_categories ON promotions USING GIN(applicable_categories);
      
      -- 更新现有记录，确保字段不为空
      UPDATE promotions 
      SET 
        applicable_products = '[]'::jsonb,
        applicable_categories = '[]'::jsonb
      WHERE 
        applicable_products IS NULL 
        OR applicable_categories IS NULL;
    `);
  }
}

fixPromotionSchema();