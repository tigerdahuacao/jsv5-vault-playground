/**
 * api-client.ts — 前端调用 PayPal API route 的凭证 header 工具
 *
 * Cloudflare Workers 每个请求在独立 isolate 中运行，
 * 服务端模块级变量无法跨请求共享。
 * 解决方案：前端将 /api/vault/init 返回的凭证附在每次请求的 header 中，
 * 各 API route 在处理前从 header 读取并注入到 paypal-api.ts 的模块状态。
 */

import type { VaultInitData } from "@/components/VaultCommonPart";

/** 从 initData 构建凭证 headers，供所有 fetch 调用附加 */
export function buildPayPalHeaders(initData: VaultInitData): Record<string, string> {
  return {
    "x-paypal-access-token": initData.access_token,
    "x-paypal-client-id": initData.clientId,
    "x-paypal-merchant-id": initData.TEST_MERCHANT_ID,
    "x-paypal-use-auth-assertion": String(initData.is_use_PAYPAL_AUTH_ASSERTION),
  };
}
