# Migration History: vault-test → vault-test-new

## 项目背景

**源项目：** `C:\Users\yqiang\Desktop\test\vault-test`  
**目标项目：** `C:\Users\yqiang\Desktop\test\vault-test-new`  
**迁移时间：** 2026-04-15 ~ 2026-04-16  
**迁移目标：** 将一个 2024 年用 Node.js + Express + EJS 写的 PayPal Vault 测试工具，重写为现代 Next.js 全栈应用，同时大幅改进 UI 质量。

---

## 源项目架构理解

### 技术栈
- **Runtime:** Node.js (ES Modules, `"type": "module"`)
- **Web 框架:** Express
- **模板引擎:** EJS（服务端渲染）
- **数据库:** LowDB（JSON 文件，`data/data.json`）
- **CSS 框架:** Semantic UI（老旧，样式较难看）
- **包管理:** npm

### 核心模块

| 文件 | 职责 |
|------|------|
| `server/server.js` | Express 入口，路由注册 |
| `server/api.js` (536行) | 所有 PayPal REST API 调用，模块级状态保存凭证 |
| `server/routes/page/commonPageRenderFunction.js` | 读 DB、选凭证、生成 token，返回 EJS render params |
| `server/routes/page/vault_with_purchase.js` | `/checkout_ACDC`、`/checkout_PayPal` 路由 |
| `server/routes/page/vault_without_purchase.js` | `/save_card`、`/save_paypal` 路由 |
| `server/routes/page/vault_with_api.js` | `/checkout_API` 路由 |
| `server/routes/orderV2API/ordersAPI.js` | `POST /api/orders`、`POST /api/orders/:id/capture` |
| `server/routes/vault/vaultAPI.js` | Vault token 系列端点 |
| `data/db.js` | LowDB 包装器 |
| `config/default.json` | 所有 PayPal App 凭证 + 测试卡数据 |

### DB 数据结构

```json
{
  "3rdParty":  { "merchantID": "", "customerID": "", "vaultID": "" },
  "1stParty":  { "merchantID": "", "customerID": "", "vaultID": "" },
  "currentPageVaultSaveParams": {
    "is_use_PAYPAL_AUTH_ASSERTION": false,
    "VAULT_MODEL": "",
    "isVaultSave": false,
    "isCard": false
  },
  "appInfo": {
    "3rdParty": { "tagName": "" },
    "1stParty": { "tagName": "" }
  }
}
```

### 两种商户模式
- **3rd Party（合作伙伴/平台模式）：** 请求头加 `PayPal-Auth-Assertion`，读写 `3rdParty.*` in DB
- **1st Party（直接商户模式）：** 直接调用，读写 `1stParty.*` in DB

### Vault 三大流程
1. **Vault with Purchase** (`checkout_ACDC`、`checkout_PayPal`)：先支付，同时 vault
2. **Vault without Purchase** (`save_card`、`save_paypal`)：仅 vault，不支付
3. **API Vault** (`checkout_API`)：4 步手动 API 演示

### PayPal 凭证配置（config/default.json）
- **3rd Party Apps：** US_Old, US_New, C2-AUM2z, C2-Lin-Adm6y
- **1st Party Apps：** US, C2-AfT9T, C2-ATorZ, Lala-Test
- **测试卡：** 4868719460707704 / 12/2027 / 123

---

## 目标架构设计

### 技术栈选型
- **框架:** Next.js 16 (App Router)
- **语言:** TypeScript
- **样式:** Tailwind CSS v4
- **包管理:** pnpm
- **数据库:** LowDB 7（保持不变）
- **运行环境:** 纯 Node.js 服务端（Next.js API Routes）

### 目录结构

```
vault-test-new/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                          # 首页/Dashboard
│   │   ├── checkout_ACDC/page.tsx
│   │   ├── checkout_PayPal/page.tsx
│   │   ├── checkout_API/page.tsx
│   │   ├── save_card/page.tsx
│   │   ├── save_paypal/page.tsx
│   │   └── api/
│   │       ├── orders/route.ts
│   │       ├── orders/[orderID]/capture/route.ts
│   │       ├── vault/init/route.ts
│   │       ├── vault/setup-token-card/route.ts
│   │       ├── vault/setup-token-paypal/route.ts
│   │       ├── vault/payment-token/route.ts
│   │       ├── vault/store-params/route.ts
│   │       ├── vault/paypal-api/route.ts
│   │       └── client-credentials/route.ts
│   ├── lib/
│   │   ├── paypal-api.ts    # 所有 PayPal REST API 逻辑
│   │   ├── db.ts            # LowDB 包装器
│   │   ├── config.ts        # 凭证 + 测试卡配置
│   │   └── utils.ts         # cn() Tailwind 工具
│   ├── components/
│   │   ├── VaultCommonPart.tsx
│   │   ├── ClientIDPanel.tsx
│   │   ├── CardCopyInfo.tsx
│   │   └── ResultArea.tsx
│   └── types/
│       └── paypal.d.ts      # Window.paypal 全局类型声明
├── CLAUDE.md
├── next.config.ts
└── data.json                # LowDB 数据文件（运行时生成）
```

### 路由映射

| 旧 Express 路由 | 新 Next.js |
|---|---|
| `GET /` | `app/page.tsx` |
| `GET /checkout_ACDC` | `app/checkout_ACDC/page.tsx` |
| `GET /checkout_PayPal` | `app/checkout_PayPal/page.tsx` |
| `GET /checkout_API` | `app/checkout_API/page.tsx` |
| `GET /save_card` | `app/save_card/page.tsx` |
| `GET /save_paypal` | `app/save_paypal/page.tsx` |
| `POST /api/orders` | `app/api/orders/route.ts` |
| `POST /api/orders/:id/capture` | `app/api/orders/[orderID]/capture/route.ts` |
| `GET /vault_common_part_init` | `app/api/vault/init/route.ts` |
| `GET /save_purchase_later_create_setup_token?type=card` | `app/api/vault/setup-token-card/route.ts` |
| `GET /save_purchase_later_create_setup_token?type=paypal` | `app/api/vault/setup-token-paypal/route.ts` |
| `GET /save_purchase_later_create_payment_token` | `app/api/vault/payment-token/route.ts` |
| `POST /dbStoreVaultACDC` | `app/api/vault/store-params/route.ts` |
| `POST/GET /vault_api_request_body` | `app/api/vault/paypal-api/route.ts` |
| `POST /write_client_credentials` | `app/api/client-credentials/route.ts` |

---

## 实施步骤

### Step 1 — 项目初始化

```bash
cd C:\Users\yqiang\Desktop\test
pnpm create next-app vault-test-new \
  --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*"
cd vault-test-new
pnpm add lowdb clsx tailwind-merge
```

生成项目骨架，配置 TypeScript、Tailwind CSS v4、App Router。

### Step 2 — `src/lib/config.ts`

将 `config/default.json` 从 JSON 文件迁移为 TypeScript 模块。包含：
- `clientIDConfigs`：所有 3rd Party / 1st Party App 的 client_id、client_secret、merchant_id
- `testCard`：测试卡号、有效期、CVV
- `USE_API_VAULT`：`checkout_API` 页面使用的预置 API 请求体（字符串化 JSON）

**关键决策：** 原项目通过 `config/default.json` 硬编码凭证，新项目保持相同方式（这是内部测试工具，不对外发布）。

### Step 3 — `src/lib/db.ts`

LowDB 7 包装器，保持与原 `data/db.js` 相同的接口：

```typescript
interface DbSchema {
  "3rdParty": { merchantID: string; customerID: string; vaultID: string };
  "1stParty": { merchantID: string; customerID: string; vaultID: string };
  currentPageVaultSaveParams: { ... };
  appInfo: { "3rdParty": { tagName: string }; "1stParty": { tagName: string } };
}

export async function readDB(): Promise<DbSchema>
export async function updateDB(path: string, value: unknown): Promise<void>
```

**注意：** LowDB 7 使用 `JSONFilePreset`，是纯 ESM 包，需要在 `next.config.ts` 中配置 `serverExternalPackages: ["lowdb"]`，否则 Next.js 的 webpack 会尝试打包它导致报错。

### Step 4 — `src/lib/paypal-api.ts`

1:1 移植 `server/api.js`（536行 → TypeScript）。

**关键设计：** 保留模块级状态变量：
```typescript
let PAYPAL_CLIENT_ID = "";
let PAYPAL_CLIENT_SECRET = "";
let access_token = "";
let VAULT_MODEL = "";
let VAULT_ID = "";
let CUSTOMER_ID = "";
let TEST_MERCHANT_ID = "";
let is_use_PAYPAL_AUTH_ASSERTION = false;
```

原因：Next.js API Routes 运行在同一个长驻 Node.js 进程中，模块级状态在请求间保持有效。这与原 Express 应用行为完全一致。

导出函数：`initClientIDSecret`、`initVaultInfo`、`generateToken`、`generateClientToken`、`createOrder`、`captureOrder`、`createSetupTokenSaveCard`、`createSetupTokenSavePayPal`、`createPaymentToken`、`callPayPalAPI`

### Step 5 — API Routes（9 个文件）

每个路由对应一个原 Express 路由，统一使用 `NextResponse`。

**`/api/vault/init`** 是最核心的端点，整合了原来的 `getJsSDKEjsRenderParam()` + `dbStoreVault()` 逻辑：
1. 读 DB，取当前选中的 App tagName
2. 根据 `is_use_PAYPAL_AUTH_ASSERTION` 从 `config.ts` 查找对应凭证
3. 调用 `initClientIDSecret` + `initVaultInfo` 初始化模块级状态
4. 调用 `generateToken` 获取 access token
5. 调用 `generateClientToken` 获取 PayPal SDK 的 `id_token`（即 `data-user-id-token`）
6. 将会话参数写回 DB
7. 返回 `{ clientId, id_token, VAULT_MODEL, CUSTOMER_ID, VAULT_ID, ... }`

### Step 6 — 共享组件

**`VaultCommonPart.tsx`** — 最复杂的组件，用 `forwardRef` + `useImperativeHandle` 暴露状态给父页面：
```typescript
export interface VaultCommonPartRef {
  getState: () => {
    customerId: string;
    vaultId: string;
    useVault: boolean;
    orderAmount: string;
  };
  initData: VaultInitData | null;
}
```

**`ClientIDPanel.tsx`** — 两个 `<select>` 下拉框，选择后 POST 到 `/api/client-credentials`，持久化到 DB。带有 `data-select="3rdParty"` / `data-select="1stParty"` 属性，首页用于检测是否已选择。

**`CardCopyInfo.tsx`** — 深色渐变卡片，每个字段（卡号/有效期/CVV）独立复制按钮，点击后显示"✓ Copied"反馈。

**`ResultArea.tsx`** — 四种状态（success/error/info/idle），彩色左边框 + 图标前缀，使用 `white-space: pre-wrap` 保留换行格式。

### Step 7 — 页面组件

所有页面均为 Client Components（需要浏览器运行 PayPal SDK），包裹在 `<Suspense>` 中（`useSearchParams` 的 Next.js 要求）。

**PayPal SDK 加载模式（所有页面通用）：**
```typescript
const script = document.createElement("script");
script.id = "paypal-sdk-script";
script.src = `https://www.paypal.com/sdk/js?client-id=${data.clientId}&components=...`;
if (data.id_token) script.setAttribute("data-user-id-token", data.id_token);
script.onload = () => setSdkReady(true);
document.head.appendChild(script);
```

不用 `next/script` 是因为 clientId 和 id_token 是运行时从 DB 读取的，无法在构建期确定。

### Step 8 — UI 重设计

相较于原 Semantic UI 的风格，新 UI 设计方向：

| 元素 | 新设计 |
|------|--------|
| 背景 | `bg-gradient-to-br from-slate-50 via-white to-slate-100` |
| 卡片 | `rounded-2xl shadow-lg border border-slate-100` |
| 按钮（选中） | `bg-blue-600 text-white shadow-lg shadow-blue-200 scale-[1.02]` |
| 按钮（未选中） | `border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50` |
| 输入框 | `rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2` |
| 标签 | `text-xs font-bold uppercase tracking-widest text-slate-400` |
| 3rd Party 徽章 | `bg-violet-100 text-violet-700` |
| 1st Party 徽章 | `bg-amber-100 text-amber-700` |
| 流程卡片 hover | `hover:shadow-lg hover:scale-[1.01] hover:border-blue-400` |

---

## 遭遇的 Barriers 与解决方案

### Barrier 1：TypeScript 全局类型冲突 — `Window.paypal` 多次声明

**问题：** 最初每个页面文件里各自声明了 `declare global { interface Window { paypal: ... } }`，但不同页面只声明了各自需要的部分（`checkout_ACDC` 只有 `CardFields`，`checkout_PayPal` 只有 `Buttons`），TypeScript 编译器报 `TS2717: Subsequent property declarations must have the same type`。

**解决方案：** 创建统一的 `src/types/paypal.d.ts`，将 `CardFields` 和 `Buttons` 合并到单一 `PayPalSDK` interface，然后从所有页面文件中移除各自的 `declare global` 块。

```typescript
// src/types/paypal.d.ts
interface PayPalSDK {
  CardFields: (opts: Record<string, unknown>) => PayPalCardFields;
  Buttons: (opts: Record<string, unknown>) => PayPalButtons;
}
declare global {
  interface Window {
    paypal: PayPalSDK;
  }
}
export {};
```

### Barrier 2：LowDB 7 ESM 打包问题

**问题：** LowDB 7 是纯 ESM 包，Next.js 默认用 webpack 打包所有 `node_modules`，导致 `require()` 调用 ESM 模块报错。

**解决方案：** 在 `next.config.ts` 中配置：
```typescript
experimental: {
  serverExternalPackages: ["lowdb"],
}
```

这告诉 Next.js 不要打包 lowdb，让 Node.js 原生 ESM 处理器加载它。

### Barrier 3：Next.js 动态路由参数类型

**问题：** Next.js 16 的 App Router 中，动态路由的 `params` 是 `Promise<{ orderID: string }>` 而不是直接的对象，如果按旧方式写会有 TypeScript 类型错误。

**解决方案：** 路由处理函数签名改为：
```typescript
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderID: string }> }
) {
  const { orderID } = await params;
  // ...
}
```

### Barrier 4：Windows Shell CWD 重置问题

**问题：** 在 Bash 工具中运行命令时，shell 会话的工作目录不断重置回原来的 `vault-test` 目录，而不是新的 `vault-test-new`，导致 `pnpm` 命令在错误目录下执行。

**解决方案：** 所有涉及新项目的命令改用绝对路径：
```bash
cd "C:\Users\yqiang\Desktop\test\vault-test-new" && pnpm ...
# 或
powershell -Command "Set-Location 'C:\Users\yqiang\Desktop\test\vault-test-new'; pnpm ..."
```

### Barrier 5：`useSearchParams` 在 App Router 中的限制

**问题：** Next.js App Router 要求使用 `useSearchParams()` 的组件必须包裹在 `<Suspense>` 边界内，否则会触发构建警告。

**解决方案：** 所有页面采用双层结构：
```typescript
function CheckoutACDCContent() {
  const searchParams = useSearchParams(); // 实际内容
  // ...
}

export default function CheckoutACDCPage() {
  return (
    <Suspense>
      <CheckoutACDCContent />
    </Suspense>
  );
}
```

### Barrier 6：Tailwind CSS v4 语法变更

**问题：** Tailwind CSS v4 的引入方式从 `@tailwind base/components/utilities` 改为 `@import "tailwindcss"`，配置文件格式也有变化。

**解决方案：** `globals.css` 直接使用 v4 语法：
```css
@import "tailwindcss";
```

不需要单独的 `tailwind.config.ts`（v4 自动扫描）。

---

## 最终验证结果

```
pnpm build  →  ✓ No TypeScript errors, all routes compiled
pnpm dev    →  ✓ Ready in 4.1s at http://localhost:3000
```

HTTP 响应检查：
```
GET /               →  200 OK (首页，完整 UI 渲染)
GET /checkout_ACDC  →  200 OK
GET /checkout_PayPal →  200 OK
GET /checkout_API   →  200 OK
GET /save_card      →  200 OK
GET /save_paypal    →  200 OK
```

首页 HTML 验证包含：
- PayPal Sandbox 标识
- Buyer Type 切换（First Time / Returning）
- Auth Mode 开关（3rd Party / 1st Party）
- Client Configuration 下拉框（所有 8 个 App 选项正确）
- 三个流程分区（With Purchase / Without Purchase / API）
- 测试卡数据（4868719460707704 / 12/2027 / 123）

---

## 使用说明

### 首次使用
1. 在首页 Client Configuration 中选择一个 3rd Party App（如 `US_Old`）
2. 如需 1st Party 模式，改选 1st Party App
3. 选择 Buyer Type（First Time / Returning）
4. 选择 Auth Mode（是否启用 PayPal-Auth-Assertion）
5. 点击流程卡片，在新标签页中打开对应页面

### 凭证持久化
凭证选择存储在 `data.json`（LowDB），Server 重启后保留。如需重置，删除 `data.json` 即可。

### 注意事项
- `GET /api/vault/init` 在未选择 App 时返回 `{ "error": "Failed to initialize page." }` — 这是预期行为，需要先在首页选择 App
- PayPal SDK 是运行时动态加载的（`document.createElement("script")`），clientId 来自 DB
- 测试卡仅在 PayPal Sandbox 环境有效

---

---

## 重构二：LowDB → Zustand + localStorage

**日期：** 2026-04-16

### 动机

迁移完成后发现 LowDB（服务端 JSON 文件）在 Next.js 中是一个不必要的负担：

- Express 时代没有浏览器，只能把所有状态存服务端文件
- 现在有 React 客户端环境，所有的「用户状态」（选了哪个 App、上次的 customerID/vaultID）天然属于浏览器
- LowDB 还带来了 ESM 打包问题（需要 `serverExternalPackages`）和 lodash 依赖
- 同时发现一个迁移遗漏的 bug：**customerID/vaultID 支付成功后没有写回 DB**，导致 returning 流程永远读不到值

Zustand + localStorage 同时解决了架构问题和这个 bug。

### 数据流对比

**旧流程（LowDB）：**
```
用户选 App → POST /api/client-credentials → 写 DB
用户打开页面 → GET /api/vault/init → 读 DB 取 appTag → 查 config → 返回 clientId/token
支付成功 → POST /api/vault/store-params → 写 DB（isVaultSave/isCard）
           → dbSaveVaultInfo() 在 paypal-api.ts 内读 DB 再写 customerID/vaultID
```

**新流程（Zustand）：**
```
用户选 App → 直接写 Zustand store（持久化到 localStorage）
用户打开页面 → VaultCommonPart 从 store 读 appTag/customerID/vaultID
             → GET /api/vault/init?appTag=US_Old&customerID=...（无 DB）
支付成功 → 页面从 API 响应提取 customerID/vaultID
         → 调用 store.saveVaultResult() 写入 localStorage
```

### 改动清单

**新增：**
- `src/store/vault.ts` — Zustand store，`persist` middleware 写 `localStorage`
  ```ts
  interface VaultStore {
    thirdPartyApp: string;       // 选中的 3rd Party App tag
    firstPartyApp: string;       // 选中的 1st Party App tag
    thirdParty: { customerID, vaultID, merchantID };
    firstParty:  { customerID, vaultID, merchantID };
    setThirdPartyApp(tag, merchantID?)
    setFirstPartyApp(tag)
    saveVaultResult(isAuth, customerID, vaultID)
    getPartyData(isAuth)
  }
  ```

**修改：**
- `src/app/api/vault/init/route.ts` — 改为从 query params 读 `appTag`/`customerID`/`vaultID`/`merchantID`，移除所有 DB 读写
- `src/components/ClientIDPanel.tsx` — 选择变更时写 store，不再 POST `/api/client-credentials`；下拉框初始值从 store 读（刷新后保留选择）
- `src/components/VaultCommonPart.tsx` — 从 store 读 appTag 和 partyData，拼入 init API 的 query params
- `src/app/checkout_ACDC/page.tsx` — 删除 `POST /api/vault/store-params`；capture 成功后调用 `saveVaultResult()`
- `src/app/checkout_PayPal/page.tsx` — 同上
- `src/app/save_card/page.tsx` — payment-token 成功后调用 `saveVaultResult()`
- `src/app/save_paypal/page.tsx` — 同上
- `src/app/page.tsx` — 从 store 读 `thirdPartyApp`/`firstPartyApp` 做导航前校验，替代旧的 DOM `querySelector`
- `src/lib/paypal-api.ts` — 删除 `import { updateDB, readDB }`、`dbSaveVaultInfo()` 函数及其调用
- `next.config.ts` — 删除 `serverExternalPackages: ["lowdb"]`

**删除：**
- `src/app/api/client-credentials/route.ts`
- `src/app/api/vault/store-params/route.ts`
- `src/lib/db.ts`
- `lodash` + `@types/lodash` 依赖
- `lowdb` 依赖（`serverExternalPackages` 一并移除）

### 顺带修复的 Bug

`dbSaveVaultInfo()` 在原 Express 项目存在，迁移时遗漏，导致新项目中 returning 流程的 customerID/vaultID 永远为空。Zustand 方案让客户端在收到 API 响应时立刻持久化，自然修复了这个问题。

### 验证

```
pnpm build → ✓ 干净构建，路由表中 /api/client-credentials 和 /api/vault/store-params 已消失
GET /       → 200 OK
```

---

## 关键文件速查

| 文件 | 说明 |
|------|------|
| `src/lib/paypal-api.ts` | 所有 PayPal REST API 调用（生成 token、创建订单、vault 操作） |
| `src/lib/config.ts` | 所有 PayPal App 凭证 + 测试卡数据 |
| `src/store/vault.ts` | Zustand store — App 选择、customerID/vaultID 持久化到 localStorage |
| `src/app/api/vault/init/route.ts` | 页面初始化核心端点，从 query params 读取所有参数 |
| `src/components/VaultCommonPart.tsx` | 所有页面共用的 Vault 状态面板，从 store 读取配置 |
| `src/types/paypal.d.ts` | PayPal JS SDK 全局类型（不要在其他文件重复声明） |
| `next.config.ts` | 当前无特殊配置（LowDB 移除后 serverExternalPackages 已删除） |
