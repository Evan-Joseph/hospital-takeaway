# 码上购 - 医疗便民订购平台

一个现代化的医疗便民购物平台，为医院患者和家属提供便捷的线上购物服务。

## 🌟 项目特色

- **PWA应用**：支持离线使用，可安装到手机桌面
- **多角色系统**：顾客、商家、超级管理员三种角色
- **实时订单**：基于Supabase的实时订单状态更新
- **智能优惠**：灵活的优惠券和促销活动系统
- **响应式设计**：完美适配手机、平板、电脑

## 🚀 在线演示

**部署地址**：https://trae30gw8vhy-gaoshenzhou-9245-josephs-projects-e1d093b3.vercel.app

## 📱 功能特性

### 👥 顾客端功能
- ✅ 用户注册登录
- ✅ 商品浏览和搜索
- ✅ 购物车管理
- ✅ 订单下单和支付
- ✅ 订单状态实时跟踪
- ✅ 个人信息和收货地址管理
- ✅ 优惠券使用
- ✅ 待付款订单提醒

### 🏪 商家端功能
- ✅ 商品和菜单管理
- ✅ 订单实时接收和处理
- ✅ 优惠活动设置
- ✅ 收款码管理
- ✅ 店铺信息管理
- ✅ 库存管理
- ✅ 订单统计分析

### 👨‍💼 超级管理员功能
- ✅ 用户和商家管理
- ✅ 轮播图管理
- ✅ 系统公告发布
- ✅ 营业额统计
- ✅ 平台数据监控
- ✅ 商家审核管理

## 🛠️ 技术栈

### 前端技术
- **React 18** - 现代化前端框架
- **TypeScript** - 类型安全的JavaScript
- **Tailwind CSS** - 实用优先的CSS框架
- **Vite** - 快速的构建工具
- **React Router** - 客户端路由
- **Zustand** - 轻量级状态管理
- **Lucide React** - 现代化图标库
- **Sonner** - 优雅的通知组件

### 后端服务
- **Supabase** - 开源的Firebase替代品
  - PostgreSQL数据库
  - 实时订阅
  - 用户认证
  - 文件存储
  - 行级安全(RLS)

### 部署平台
- **Vercel** - 现代化的部署平台
- **PWA** - 渐进式Web应用

## 📦 项目结构

```
HospitalDeliveryPWA/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── ui/             # UI基础组件
│   │   └── layout/         # 布局组件
│   ├── pages/              # 页面组件
│   │   ├── auth/           # 认证相关页面
│   │   ├── customer/       # 顾客端页面
│   │   ├── merchant/       # 商家端页面
│   │   └── super-admin/    # 管理员页面
│   ├── contexts/           # React上下文
│   ├── hooks/              # 自定义Hooks
│   ├── stores/             # 状态管理
│   ├── lib/                # 工具库
│   └── utils/              # 工具函数
├── supabase/
│   └── migrations/         # 数据库迁移文件
├── public/                 # 静态资源
└── docs/                   # 项目文档
```

## 🚀 快速开始

### 环境要求
- Node.js 18+
- pnpm (推荐) 或 npm
- Supabase账号

### 安装依赖
```bash
# 克隆项目
git clone https://github.com/Evan-Joseph/hospital-takeaway.git
cd hospital-takeaway

# 安装依赖
pnpm install
# 或
npm install
```

### 环境配置
1. 复制环境变量文件
```bash
cp .env.example .env
```

2. 配置Supabase环境变量
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 数据库设置
1. 在Supabase中创建新项目
2. 运行数据库迁移
```bash
# 使用合并后的迁移文件
supabase db reset
```

### 启动开发服务器
```bash
pnpm dev
# 或
npm run dev
```

访问 http://localhost:5173 查看应用

## 📋 核心业务流程

### 订单状态流转
1. **待支付** - 顾客下单后的初始状态
2. **顾客称已支付** - 顾客完成线下支付后标记
3. **商家已确认收款** - 商家核对验证码后确认
4. **商家配送中** - 商家开始配送
5. **顾客已确认收货** - 订单完成
6. **超时关闭** - 30分钟内未支付自动关闭

### 支付流程
1. 顾客下单 → 自动跳转支付页
2. 显示商家收款码和订单验证码
3. 顾客扫码支付并填写验证码
4. 手动标记为"已支付"
5. 跳转到订单详情页

## 🎯 核心功能亮点

### 实时订单管理
- 基于Supabase实时订阅的订单状态同步
- 商家端新订单实时通知
- 顾客端订单状态实时更新

### 智能库存管理
- 防止超库存下单
- 实时库存数量更新
- 库存不足自动提醒

### 灵活优惠系统
- 支持百分比和固定金额折扣
- 按商品数量限制优惠使用
- 满额优惠和单品优惠
- 防止重复应用优惠

### 多角色权限管理
- 严格的角色权限控制
- 不同角色看到不同的功能界面
- 安全的数据访问控制

## 🔧 部署指南

### Vercel部署
1. 连接GitHub仓库到Vercel
2. 配置环境变量
3. 自动部署

### 环境变量配置
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📊 数据库设计

### 核心表结构
- `user_profiles` - 用户信息
- `merchants` - 商家信息
- `products` - 商品信息
- `orders` - 订单信息
- `order_items` - 订单商品
- `promotions` - 优惠活动
- `banners` - 轮播图
- `announcements` - 系统公告
- `delivery_addresses` - 收货地址

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👨‍💻 作者

**Evan Joseph**
- GitHub: [@Evan-Joseph](https://github.com/Evan-Joseph)
- Email: evanshenzhou@gmail.com

## 🙏 致谢

感谢以下开源项目：
- [React](https://reactjs.org/)
- [Supabase](https://supabase.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
- [Vercel](https://vercel.com/)

---

⭐ 如果这个项目对你有帮助，请给它一个星标！