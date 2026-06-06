# 乐行连锁 - 线上乐器租赁系统

全栈乐器租赁管理系统，支持按乐器种类管理 SKU、用户下单、门店取还、扫码管理等功能。

## 技术栈

- **前端**: React 18 + React Router 6 + TanStack Query + Axios
- **后端**: Go + Gin + MongoDB (mongo-driver)
- **反向代理**: Nginx
- **部署**: Docker Compose

## 功能特性

- 🎸 按乐器种类（弦乐/管乐/打击/键盘/电子）管理 SKU
- 🔍 商品列表支持分类和价格区间过滤
- 🧮 租期价格实时计算器
- 📦 库存事务保证（库存不为负）
- 💳 Mock 支付流程
- 🏪 门店取还登记
- ⏰ 逾期自动计算，滞纳金展示
- 📱 管理端扫码更新订单状态（输入框模拟扫码）
- 🔤 订单号 UUID + 6位对外短码
- ❌ 取消订单仅允许 pending 且未出库
- ✅ 质检通过后 24 小时内释放库存
- 🩺 健康检查 `/healthz`
- 🌱 种子数据 25 个 SKU

## 快速开始

### 一键启动

```bash
docker-compose up -d --build
```

### 访问地址

- 前端: http://localhost
- 后端 API: http://localhost/api/v1
- Nginx 健康检查: http://localhost/healthz
- 后端健康检查: http://localhost:8080/healthz

### 本地开发

#### 启动 MongoDB

```bash
docker-compose up -d mongodb
```

#### 启动后端

```bash
cd backend
cp .env.example .env
go mod download
go run main.go
```

#### 启动前端

```bash
cd frontend
npm install
npm start
```

## 项目结构

```
.
├── backend/                 # Go 后端
│   ├── config/             # 配置
│   ├── db/                 # 数据库连接
│   ├── handlers/           # API 处理器
│   ├── models/             # 数据模型
│   ├── seed/               # 种子数据
│   ├── utils/              # 工具函数
│   ├── main.go             # 入口
│   ├── go.mod
│   └── Dockerfile
├── frontend/               # React 前端
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── api.js          # API 封装
│   │   ├── App.js          # 根组件
│   │   ├── index.js        # 入口
│   │   └── styles.css      # 样式
│   ├── package.json
│   └── Dockerfile
├── nginx/                  # Nginx 配置
│   └── nginx.conf
├── docs/                   # 文档
│   ├── COLLECTION_SCHEMA.md # 集合结构 & ER 图
│   ├── STATUS_FLOW.md      # 状态流转图
│   └── openapi.yml         # OpenAPI 3.0 规范
├── docker-compose.yml
└── README.md
```

## API 概览

完整 API 文档请查看 [docs/openapi.yml](docs/openapi.yml)

### 健康检查
- `GET /healthz`

### SKU 管理
- `GET /api/v1/skus/categories` - 获取分类
- `GET /api/v1/skus` - SKU 列表（支持过滤）
- `GET /api/v1/skus/:id` - SKU 详情
- `POST /api/v1/skus` - 创建 SKU
- `PUT /api/v1/skus/:id` - 更新 SKU
- `DELETE /api/v1/skus/:id` - 删除 SKU

### 门店管理
- `GET /api/v1/stores` - 门店列表
- `POST /api/v1/stores` - 创建门店

### 订单管理
- `GET /api/v1/orders/calculate` - 价格计算
- `GET /api/v1/orders` - 订单列表
- `GET /api/v1/orders/:id` - 订单详情
- `GET /api/v1/orders/short/:shortCode` - 短码查订单
- `POST /api/v1/orders` - 创建订单
- `POST /api/v1/orders/:id/cancel` - 取消订单
- `POST /api/v1/orders/pay` - 支付
- `POST /api/v1/orders/pickup` - 取货
- `POST /api/v1/orders/return` - 归还
- `POST /api/v1/orders/inspect` - 质检
- `POST /api/v1/orders/scan` - 扫码更新状态

## 核心业务规则

### 库存管理
- 使用 MongoDB 事务保证库存操作原子性
- 创建订单时通过乐观锁 `available > 0` 防止超卖
- 取消订单和质检通过时归还库存
- `available` 永远不为负

### 订单取消规则
- 仅 `pending` 状态允许取消
- 已取货（`pickedUpAt != null`）的订单不允许取消

### 订单状态流转
```
pending → paid → picked_up → returned → completed
   ↓         ↓            ↓
cancelled  overdue → returned
```

### 滞纳金计算
- 超过预计归还日期自动计算
- 逾期天数向上取整
- 滞纳金 = 租金总额 × 1% × 逾期天数

### 质检规则
- 归还后 24 小时内必须完成质检
- 质检通过后释放库存
- 质检不通过需人工处理

## 文档

- [集合结构 & ER 图](docs/COLLECTION_SCHEMA.md)
- [订单状态流转图](docs/STATUS_FLOW.md)
- [OpenAPI 3.0 规范](docs/openapi.yml)

## 健康检查

所有服务都配置了健康检查：

```bash
# Nginx
curl http://localhost/healthz

# 后端
curl http://localhost:8080/healthz

# MongoDB
docker exec yuexing-mongodb mongosh --eval "db.adminCommand('ping')"
```

## 种子数据

系统启动时自动插入：
- **25 个 SKU**（弦乐5、管乐5、打击5、键盘5、电子5）
- **3 个门店**（北京旗舰店、上海店、广州店）

## 管理端操作流程

1. 用户下单支付后，订单状态为 `paid`
2. 用户到门店取货：管理员输入短码 → 点击「取货」→ 状态变为 `picked_up`
3. 用户归还乐器：管理员输入短码 → 点击「归还」→ 状态变为 `returned`，自动计算滞纳金
4. 质检通过：管理员输入短码 → 点击「质检通过」→ 状态变为 `completed`，库存释放

## 许可证

MIT
