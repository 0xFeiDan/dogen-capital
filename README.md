# Dogen Capital

Dogen Capital 是一个面向个人交易者的交易日志与复盘系统。它不是券商终端，而是用来长期记录交易、沉淀思考、追踪账户表现，并支持两位用户共用同一个站点但各自维护独立数据。

当前项目已经从“浏览器本地记录工具”升级为“服务端同步版交易记录站点”，核心数据由 Next.js API + Prisma + SQLite 管理，前端通过 Zustand 进行本地状态缓存和展示。

## 核心功能

### 1. 仪表盘

用于查看账户整体状态，包含：

- 本金
- 已实现净盈亏
- 胜率
- 持仓数量
- 净值曲线
- 资产分布
- 月度盈亏

### 2. 交易日志

交易日志是项目的核心模块，用于记录每一笔交易。

支持记录：

- 代码与名称
- 多头 / 空头方向
- 持仓状态
- 入场时间 / 出场时间
- 入场价 / 出场价 / 当前价
- 数量
- 手续费
- 标签
- 形态类型
- 备注

表格体验包括：

- 持仓中永远排在前面
- 已平仓记录按时间排序
- 固定表头
- 持仓时长显示与筛选
- 盈亏与收益率排序

### 3. 思考笔记

用于保存交易之外的重要内容，例如：

- 市场观察
- 行业判断
- 个股观点
- 策略总结
- 复盘记录

标签系统为完全自定义模式，不依赖固定标签列表。

### 4. 分析页

用于查看更聚合的统计结果，例如：

- 标签维度胜率与盈亏
- 持仓时间分布
- 最佳 / 最差标的
- 最大回撤等

### 5. 双用户模式

系统内置两位用户：

- 我
- 女朋友

切换用户后，下列内容会自动切到对应用户的数据：

- 仪表盘
- 交易日志
- 思考笔记
- 本金设置

## 价格模式

交易日志现在支持两种价格模式：

- `manual`
- `binance`

### Manual 模式

手动模式保留原有使用方式：

- `ticker` 继续填写你自己习惯的展示代码，例如 `META`、`CRCL`、`XAG`
- `currentPrice` 由你手动填写
- 系统不会请求外部行情

适用场景：

- 币安没有的标的
- 股票、场外产品、特殊品种
- 你只想做静态记录，不需要实时刷新

### Binance 模式

币安模式用于给开仓单自动刷新价格。

每笔交易可额外保存：

- `pricingMode = binance`
- `binanceMarketType = spot | usdm-futures`
- `binanceSymbol`，例如 `BTCUSDT`、`ETHUSDT`、`XAGUSDT`

说明：

- 页面展示仍然优先使用你填写的 `ticker`
- 真正请求币安盘口时使用 `binanceSymbol`
- 只有 `status = open` 的交易会自动刷新

### 更真实的结算规则

币安模式不会直接使用最新成交价，而是按更接近真实成交的方式刷新 `currentPrice`：

- `long` 使用 `bid1`
- `short` 使用 `ask1`

这意味着：

- 做多仓位按“卖出可成交价”估算
- 做空仓位按“买回可成交价”估算

这样得到的未实现盈亏，比单纯使用 last price 更贴近真实交易结果。

### 当前已接入的币安市场

- Binance Spot
- Binance USD-M Futures

系统通过同源 API 路由 `/api/market/binance/quotes` 代理请求币安盘口数据。

### 自动刷新规则

当交易满足以下条件时，系统会自动刷新价格：

- `pricingMode = binance`
- `status = open`
- `binanceSymbol` 有效

当前行为：

- 默认约每 5 秒刷新一次
- 页面重新聚焦时会立即刷新
- 页面隐藏时暂停刷新
- 仅更新 `currentPrice`
- 不会因为价格刷新而污染交易本身的 `updatedAt`

### 向后兼容

历史数据会自动兼容：

- 老交易如果没有新字段，默认按 `manual` 模式处理
- 原来的 `ticker + currentPrice` 结构仍然有效
- 导入导出已经兼容 `pricingMode`、`binanceMarketType`、`binanceSymbol`

## 数据同步方式

当前版本采用“服务端为主”的同步模式：

- 交易数据保存在服务器
- 思考笔记保存在服务器
- 本金设置保存在服务器
- 前端进入站点后先从服务器拉取最新快照
- 页面会定时与服务器同步
- 浏览器重新聚焦时也会再次同步

这意味着：

- 你在电脑 A 上修改的数据会写入服务端
- 电脑 B 在刷新、聚焦或下一轮同步后可以看到相同结果

## 导入与导出

当前导入导出为服务端驱动模式。

支持导出：

- 当前用户交易记录 JSON
- 当前用户交易记录 CSV
- 当前用户思考笔记 JSON
- 完整双人数据包 JSON

支持导入：

- 合并导入
- 覆盖导入

交易导入导出会保留：

- 基础交易字段
- `currentPrice`
- `pricingMode`
- `binanceMarketType`
- `binanceSymbol`

## 登录与安全

项目支持密码访问保护，适合部署到自己的服务器上使用。

当前已实现：

- 登录页密码校验
- 服务端 Session Cookie
- 路由访问拦截
- 登录失败限制
- 退出登录

建议公网部署时搭配：

- HTTPS
- 反向代理（例如 Nginx）
- PM2 或其他进程管理器

## 技术栈

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- Recharts
- Prisma
- SQLite

职责概览：

- Next.js：页面、API、服务端能力
- Zustand：前端状态管理
- Prisma：数据库访问
- SQLite：本地/服务器轻量数据库
- Recharts：图表展示

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备环境变量

复制 `.env.example` 为 `.env`，然后填写：

- `DATABASE_URL`
- `AUTH_PASSWORD_HASH`
- `AUTH_SESSION_SECRET`
- `AUTH_SESSION_TTL_SECONDS`

示例内容见 [`.env.example`](C:\Users\Administrator\Desktop\dogen\.env.example)。

### 3. 生成密码哈希

```bash
npm run auth:hash
```

把生成结果填入 `AUTH_PASSWORD_HASH`。

### 4. 初始化数据库

```bash
npm run db:push
```

### 5. 启动开发环境

```bash
npm run dev
```

默认使用 Next.js 开发服务器。

## 常用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run auth:hash
npm run db:generate
npm run db:push
```

## 适合谁使用

这个项目尤其适合：

- 个人投资者
- 短线或波段交易者
- 有复盘习惯的人
- 想把交易记录和交易思考放在一起管理的人
- 想和伴侣共用一个站点入口、但又希望保留各自独立数据的人

## 总结

Dogen Capital 的价值不在于替代券商软件，而在于帮助交易者建立自己的交易记录系统。

它把账户概览、交易记录、思考笔记、双用户切换、服务端同步、导入导出和密码访问整合到一个完整站点里，让交易记录这件事更长期、更有结构，也更容易坚持下去。

