# Telegram Premium Bot 后台管理系统开发 Prompt

## 项目概述
开发一个简单的 Web 后台管理系统，用于管理 Telegram Premium 自动开通机器人。系统需要提供配置管理、价格管理、订单查看和财务统计等基础功能。

## 技术栈建议
- **前端框架**: React + TypeScript 或 Vue 3 + TypeScript
- **UI 组件库**: Ant Design / Element Plus / Tailwind CSS
- **后端框架**: Node.js + Express 或 Fastify
- **数据库**: MongoDB / PostgreSQL / MySQL
- **认证**: 简单的密码登录即可



## 功能需求

### 1. 系统配置管理

#### 1.1 机器人基础配置
- **BOT_TOKEN**: Telegram Bot Token
- **FRAGMENT_COOKIE**: Fragment API Cookie
- **FRAGMENT_HASH**: Fragment API Hash
- **FRAGMENT_POLL_HASH**: Fragment API Poll Hash
- **FRAGMENT_AUTO_REFRESH**: 是否自动刷新 Cookie（开关）
- **HTTP_PROXY**: 代理地址（可选）

#### 1.2 TON 支付配置
- **TON_ENDPOINT**: TON 节点地址
- **TON_API_KEY**: TON API Key
- **TON_MNEMONIC**: TON 钱包助记词（加密存储）
- **TON_AUTOPAY**: 是否启用自动支付（开关）

#### 1.3 Epusdt (TRC20 USDT) 支付配置
- **EPUSDT_BASE_URL**: Epusdt API 地址
- **EPUSDT_TOKEN**: Epusdt API Token
- **EPUSDT_NOTIFY_URL**: 支付回调地址
- **EPUSDT_REDIRECT_URL**: 支付跳转地址
- **EPUSDT_ENABLED**: 是否启用 Epusdt 支付（开关）

#### 1.4 支付宝支付配置
- **ALIPAY_APP_ID**: 支付宝应用 ID
- **ALIPAY_PRIVATE_KEY**: 支付宝私钥（加密存储）
- **ALIPAY_PUBLIC_KEY**: 支付宝公钥
- **ALIPAY_GATEWAY**: 支付宝网关地址
- **ALIPAY_ENABLED**: 是否启用支付宝支付（开关）

#### 1.5 服务器配置
- **SERVER_PORT**: 服务器端口
- **ORDER_TTL_SECONDS**: 订单过期时间（秒）
- **ORDER_MAX_ENTRIES**: 最大订单数

### 2. 价格管理

#### 2.1 会员价格配置
- **3 个月价格**: 可编辑，单位 USDT
- **6 个月价格**: 可编辑，单位 USDT
- **12 个月价格**: 可编辑，单位 USDT
- **价格更新时间**: 显示最后更新时间
- **价格历史记录**: 可查看价格变更历史

#### 2.2 汇率配置（可选）
- **USDT/CNY 汇率**: 用于计算人民币价格
- **汇率更新时间**: 自动或手动更新

### 3. 用户管理

#### 3.1 用户列表
- **用户 ID**: Telegram User ID
- **用户名**: Telegram Username
- **昵称**: First Name + Last Name
- **注册时间**: 首次使用机器人时间
- **最后活跃时间**: 最后一次使用时间
- **订单总数**: 该用户创建的订单数
- **成功订单数**: 该用户成功完成的订单数
- **总消费金额**: 该用户总消费（USDT/CNY）

#### 3.2 用户详情
- 基本信息
- 订单历史列表

#### 3.3 用户统计
- **总用户数**: 使用过机器人的用户总数
- **活跃用户数**: 最近 7/30 天活跃用户
- **新用户数**: 今日/本周/本月新增用户

### 4. 订单管理

#### 4.1 订单列表
- **订单号**: Fragment Request ID
- **用户信息**: 用户 ID、用户名
- **目标用户**: 接收会员的用户名
- **订阅时长**: 月数
- **订单金额**: CNY 金额
- **支付方式**: 支付宝 / TRC20 USDT
- **订单状态**: 
  - 等待用户支付
  - 支付成功
  - 正在处理
  - 已广播
  - 等待确认
  - 已完成
  - 已过期
  - 失败
- **创建时间**: 订单创建时间
- **完成时间**: 订单完成时间
- **操作**: 查看详情

#### 4.2 订单详情
- 完整订单信息
- 支付信息（支付地址、支付链接等）
- 订单状态变更历史
- 相关日志

#### 4.3 订单筛选
- 按状态筛选
- 按支付方式筛选
- 按时间范围筛选
- 按用户筛选
- 按金额范围筛选

### 5. 财务统计

#### 5.1 总览统计
- **总订单数**: 所有订单总数
- **成功订单数**: 已完成的订单数
- **失败订单数**: 失败的订单数
- **总收款金额**: 所有成功订单的总金额
- **今日收款**: 今日成功订单金额
- **本月收款**: 本月成功订单金额
- **成功率**: 成功订单数 / 总订单数

#### 5.2 支付方式统计
- **TRC20 USDT 收款**:
  - 总订单数
  - 成功订单数
  - 总收款金额（USDT）
  - 总收款金额（CNY，按汇率计算）
  - 今日收款
  - 本月收款

- **支付宝收款**:
  - 总订单数
  - 成功订单数
  - 总收款金额（CNY）
  - 今日收款
  - 本月收款

#### 5.3 时间维度统计
- **按日期统计**: 每日订单数、收款金额
- **按周统计**: 每周订单数、收款金额
- **按月统计**: 每月订单数、收款金额
- **图表展示**: 使用折线图、柱状图展示趋势

#### 5.4 价格维度统计
- **3 个月订阅**: 订单数、收款金额
- **6 个月订阅**: 订单数、收款金额
- **12 个月订阅**: 订单数、收款金额

### 6. 系统状态（可选）

#### 6.1 系统状态
- **机器人状态**: 在线/离线
- **Fragment API 状态**: 正常/异常
- **Cookie 状态**: 有效/过期/即将过期

### 7. 数据导出（可选）

#### 7.1 订单导出
- 支持导出 Excel / CSV
- 可筛选导出
- 包含订单所有字段

#### 7.2 财务报表导出
- 按时间范围导出
- 按支付方式导出
- 包含统计汇总数据


## 数据库设计建议

### 用户表 (users)
```javascript
{
  userId: String, // Telegram User ID
  username: String,
  firstName: String,
  lastName: String,
  createdAt: Date,
  lastActiveAt: Date,
  isBanned: Boolean,
  banReason: String,
  banAt: Date
}
```

### 订单表 (orders)
```javascript
{
  orderId: String, // Fragment Request ID
  userId: String, // 创建订单的用户 ID
  targetUsername: String, // 接收会员的用户名
  months: Number, // 订阅月数
  amount: Number, // CNY 金额
  amountTon: Number, // TON 金额
  amountUsdt: Number, // USDT 金额
  paymentMethod: String, // 'alipay' | 'usdt'
  status: String, // 订单状态
  reqId: String, // Fragment Request ID
  tonAddress: String, // TON 收款地址
  epusdtOrderId: String, // Epusdt 订单 ID
  epusdtToken: String, // Epusdt 支付地址
  epusdtPaymentUrl: String, // Epusdt 支付链接
  alipayOrderId: String, // 支付宝订单 ID
  alipayQrCode: String, // 支付宝二维码
  createdAt: Date,
  paidAt: Date,
  completedAt: Date,
  expiredAt: Date
}
```

### 配置表 (configs)
```javascript
{
  key: String, // 配置键
  value: String, // 配置值（敏感信息加密）
  type: String, // 配置类型
  description: String, // 配置说明
  updatedAt: Date
}
```

### 价格表 (prices)
```javascript
{
  months: Number, // 订阅月数
  price: Number, // 价格（USDT）
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean
}
```

### 价格历史表 (price_history)
```javascript
{
  months: Number,
  oldPrice: Number,
  newPrice: Number,
  updatedAt: Date
}
```

## API 接口设计

### 配置管理
- `GET /api/config` - 获取所有配置
- `PUT /api/config/:key` - 更新配置
- `GET /api/config/status` - 获取配置状态

### 价格管理
- `GET /api/prices` - 获取当前价格
- `PUT /api/prices` - 更新价格
- `GET /api/prices/history` - 获取价格历史

### 用户管理
- `GET /api/users` - 获取用户列表（支持分页、筛选）
- `GET /api/users/:userId` - 获取用户详情
- `GET /api/users/stats` - 获取用户统计

### 订单管理
- `GET /api/orders` - 获取订单列表（支持分页、筛选）
- `GET /api/orders/:orderId` - 获取订单详情
- `GET /api/orders/stats` - 获取订单统计

### 财务统计
- `GET /api/finance/overview` - 获取财务总览
- `GET /api/finance/payment-methods` - 获取支付方式统计
- `GET /api/finance/timeline` - 获取时间维度统计
- `GET /api/finance/export` - 导出财务报表

### 系统监控（可选）
- `GET /api/system/status` - 获取系统状态

## 前端页面结构

```
/admin
├── /login                    # 登录页（简单密码登录）
├── /dashboard               # 仪表盘（总览统计）
├── /config                  # 配置管理
│   ├── /bot                 # 机器人配置
│   ├── /ton                 # TON 配置
│   ├── /epusdt              # Epusdt 配置
│   ├── /alipay              # 支付宝配置
│   └── /server              # 服务器配置
├── /prices                  # 价格管理
├── /users                   # 用户管理
│   ├── /list                # 用户列表
│   └── /:userId             # 用户详情
├── /orders                  # 订单管理
│   ├── /list                # 订单列表
│   └── /:orderId            # 订单详情
└── /finance                 # 财务统计
    ├── /overview            # 财务总览
    ├── /payment-methods     # 支付方式统计
    └── /timeline            # 时间维度统计
```

## 安全要求

1. **认证**: 简单的密码登录即可（可存储在环境变量中）
2. **加密**: 敏感信息（助记词、私钥）加密存储
3. **HTTPS**: 建议使用 HTTPS（生产环境）
4. **CORS**: 配置合理的 CORS 策略

## 实时更新（可选）

- 可选择性实现实时数据更新
- 订单状态变更实时推送
- 新订单实时通知

## 开发优先级

### Phase 1: 核心功能（必须）
1. 简单登录（密码验证）
2. 配置管理
3. 价格管理
4. 订单列表和详情
5. 基础财务统计

### Phase 2: 扩展功能（可选）
1. 用户管理
2. 详细财务统计
3. 数据导出
4. 系统状态查看

## 注意事项

1. **数据同步**: 后台管理系统需要与机器人共享数据库或通过 API 通信
2. **简单实用**: 优先实现核心功能，保持界面简洁
3. **安全性**: 敏感信息加密存储，登录密码存储在环境变量中
4. **用户体验**: 界面要简洁易用，支持响应式设计

