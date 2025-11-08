# Telegram Premium Bot

Telegram Premium 自动开通机器人及后台管理系统

## 功能特性

- 🤖 Telegram Bot 自动开通 Premium 会员
- 💳 支持多种支付方式：TON、TRC20 USDT、支付宝
- 📊 完整的后台管理系统
- 🔐 使用 Prisma 管理数据库
- 🌐 全中文界面

## 技术栈

### Bot 部分
- Node.js (ES Modules)
- Telegraf - Telegram Bot 框架
- TON SDK - TON 区块链交互
- Axios - HTTP 请求
- Express - 回调服务器

### 后台管理
- Next.js 16
- React 19
- TypeScript
- Prisma - ORM
- SQLite - 数据库
- Tailwind CSS - 样式

## 快速开始

### 1. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 2. 配置环境变量

复制 `env.example` 为 `.env` 并填写配置：

```bash
cp env.example .env
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run db:generate

# 推送数据库 schema
npm run db:push

# 或使用迁移
npm run db:migrate
```

### 4. 启动服务

```bash
# 启动机器人
npm run bot

# 启动后台管理系统（另一个终端）
npm run dev
```

访问 `http://localhost:3000` 查看后台管理系统

## 项目结构

```
PremiumBot/
├── src/                    # Bot 源代码
│   ├── bot.js             # 主 Bot 逻辑
│   ├── config.js          # 配置管理
│   ├── fragmentApi.js     # Fragment API 封装
│   ├── tonSender.js       # TON 支付服务
│   ├── epusdtClient.js    # Epusdt 支付客户端
│   ├── cookieManager.js    # Cookie 管理
│   ├── store.js           # 内存存储
│   ├── orderPolling.js    # 订单轮询
│   ├── callbackServer.js  # 回调服务器
│   ├── index.js           # 入口文件
│   └── utils/             # 工具函数
│       └── httpAgents.js  # HTTP Agent 共享
├── app/                    # Next.js 应用
│   ├── api/               # API 路由
│   ├── dashboard/         # 后台管理页面
│   └── login/             # 登录页面
├── components/            # React 组件
├── lib/                   # 共享库
│   ├── prisma.ts          # Prisma 客户端
│   └── auth.ts            # 认证逻辑
├── prisma/                # Prisma 配置
│   └── schema.prisma      # 数据库 Schema
└── package.json
```

## 数据库 Schema

使用 Prisma 管理以下表：

- `User` - 用户表
- `Order` - 订单表
- `Config` - 配置表
- `Price` - 价格表
- `PriceHistory` - 价格历史表

## 开发命令

```bash
# Bot
npm run bot              # 启动机器人

# 后台管理
npm run dev              # 开发模式
npm run build            # 构建
npm run start            # 生产模式

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 推送 Schema
npm run db:migrate       # 创建迁移
npm run db:studio        # 打开 Prisma Studio
```

## 注意事项

1. **环境变量**: 确保所有必需的环境变量都已配置
2. **代理设置**: 如果在中国大陆，需要配置 `HTTP_PROXY`
3. **Cookie**: Cookie 会自动获取和刷新，也可以手动设置
4. **数据库**: 首次运行需要初始化数据库

## 许可证

MIT
