# Checkout — Raw Card Number + Order API Vault — Design

Date: 2026-10-20

## 1. Problem

所有现有的信用卡 vault 测试场景（`checkout-ACDC`、`checkout-API`）都依赖 PayPal 的 SDK 组件来处理原始卡号：`checkout-ACDC` 用 Card Fields 组件（卡号从不进入应用代码），`checkout-API` 用 setup-token / payment-token 两步流程把卡号交给 PayPal 托管页面。

现在需要新增一个测试 case：前端用普通 `<input>` 收集卡号/有效期/CVV（卡号直接进入前端 state 和后端请求体，不经过任何 PayPal SDK 组件），后端直接把这些原始卡数据放进 Orders API 的请求体里创建订单，并在这个过程中把卡 vault 化；之后用记录下来的 `vault_id` 做后续支付，不再要求用户重新输卡号。

## 2. Scope

### In scope

- 新页面 `src/app/checkout-card-with-pci/page.tsx`，路由 `/checkout-card-with-pci`。
- 首次支付路径：原始 `<input>` 表单收集卡号/有效期/CVV（预填 `config.ts` 的 `testCard`，可编辑）→ `POST /api/orders`（body 含 `payment_source.card.{number,expiry,security_code}`，若勾选"使用 vault"则附带 `attributes.vault:{store_in_vault:"ON_SUCCESS"}`）→ 成功后立即连续调用 `POST /api/orders/{id}/capture`（无需等待任何前端 SDK 回调，两步在同一次点击里顺序执行）。
- 从 capture 响应里提取 `payment_source.card.attributes.vault.id` / `.customer.id`，写入 `useVaultStore.saveVaultResult`（与 `checkout-ACDC` 一致）。
- 返回用户路径：`VaultCommonPart` 检测到已有 `vaultId` 时，隐藏卡号表单，只显示"用已存卡支付"按钮 → `POST /api/orders`（`payment_source.card.vault_id`，不含任何原始卡字段）→ 连续 capture。
- 复用现有组件：`VaultCommonPart`（含既有的"使用 vault"勾选框）、`CardCopyInfo`（展示测试卡号供参考，不绑定输入框）、`ResultArea`、`ApiTraceLog` + `useApiTraceLog`。
- Dashboard（`src/app/page.tsx`）新增一个入口卡片指向该路由。

### Out of scope

- 不加载 PayPal SDK script —— 本页面不使用 `window.paypal` 的任何组件。
- 不新增/修改后端路由 —— `POST /api/orders` 和 `POST /api/orders/[orderID]/capture` 已原样转发请求体，足以支撑本 case。
- 不做"不勾选 vault"情形以外的分支特殊处理，行为与 `checkout-ACDC` 的既有 `useVault` 勾选框语义一致。
- 不新增"仅存卡不支付"的变体（那是 `save-card` 页面的职责）。

## 3. 页面结构

与 `checkout-ACDC/page.tsx` 同构：

1. `VaultCommonPart`（ref）—— 调用 `/api/vault/init`，展示 client ID / customer ID，提供"使用 vault"勾选框和可选订单金额；`getState()` 返回 `{customerId, vaultId, useVault, orderAmount}`。
2. 根据 `vaultId` 是否存在，渲染两种视图：
   - **首次（无 vaultId）**：卡号/有效期/CVV 三个 `<input>`，预填 `testCard`；旁边放 `CardCopyInfo` 作参考；"Pay" 按钮。
   - **返回用户（有 vaultId）**：隐藏卡号表单，显示已存卡摘要 + "Pay with Saved Card" 按钮。
3. `ApiTraceLog`（配合 `useApiTraceLog`）展示每次请求/响应 trace。
4. `ResultArea` 展示成功/失败/信息提示。

## 4. 数据流

### 4.1 首次支付

```ts
POST /api/orders
{
  intent: "CAPTURE",
  purchase_units: [...],
  payment_source: {
    card: {
      number, expiry, security_code,
      ...(useVault ? { attributes: { vault: { store_in_vault: "ON_SUCCESS" } } } : {})
    }
  }
}
```

创建成功后，立即（同一个处理函数内，无需等待任何前端组件触发）调用：

```ts
POST /api/orders/{id}/capture
```

从 capture 响应中取出 `payment_source.card.attributes.vault.id` / `.customer.id`，调用 `useVaultStore.saveVaultResult` 保存，供下次访问时 `VaultCommonPart` 识别为"返回用户"。

### 4.2 返回用户支付

```ts
POST /api/orders
{
  intent: "CAPTURE",
  purchase_units: [...],
  payment_source: { card: { vault_id } }
}
```

同样创建成功后立即连续调用 capture。整个"创建订单 → 捕获"是连续执行的，因为没有前端 SDK 组件（如 Card Fields 的 `onApprove`）来分隔这两步。

### 4.3 Trace

每次 fetch 响应按现有模式用 `extractTrace()` 剥离 `__trace` 字段，`pushTrace()` 推入 `ApiTraceLog`，与 `checkout-ACDC`/`checkout-API` 等页面一致。

## 5. 错误处理

与 `checkout-ACDC` 一致：create order 或 capture 失败时，把错误信息渲染进 `ResultArea`（`type: "error"`）；无论成功失败，trace 都要记录下来。

## 6. Dashboard 入口

在 `src/app/page.tsx` 的 flow 选择器里新增一项，指向 `/checkout-card-with-pci`，文案类似"Card (Raw API, no SDK)"。
