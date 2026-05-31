"use client";

/**
 * VaultCommonPart — 各结账页共享的 Vault 状态面板
 *
 * 职责：
 * 1. 挂载时调用 /api/vault/init，初始化服务端的 PayPal 凭证和 Vault 上下文
 * 2. 展示当前 Auth 模式标签（3rd/1st Party）和买家类型标签（首次/返回）
 * 3. 提供 Customer ID、Vault ID 的可编辑输入（returning 模式自动回填）
 * 4. 可选：展示"Use Vault ID to Pay"复选框（首次买家时置灰）
 * 5. 可选：展示订单金额输入框
 *
 * 通过 ref（VaultCommonPartRef）向父组件暴露 getState()，
 * 父组件在 createOrder 时调用以获取最新的 customerId / vaultId / useVault / orderAmount。
 *
 * 流程类型（flowType）由 route prop 自动推导：
 * - "checkout-PayPal" / "save-PayPal" → "paypal"
 * - 其余 → "card"
 * 用于从 Zustand store 读取对应的 customerID / vaultID，避免 card 和 paypal 数据互串。
 *
 * Props：
 * - model: "firstTime" | "returning"
 * - isUsePaypalAuthAssertion: 是否使用 3rd Party 模式
 * - route: 当前页面路由名（用于推导 flowType 和传给 init API）
 * - showVaultOption: 是否显示 "Use Vault ID to Pay" 复选框，默认 true
 * - showOrderAmount: 是否显示金额输入框，默认 true
 * - onInitDataLoaded: init 完成后的回调，父组件用来触发 SDK 加载
 *
 * 使用位置：
 * - src/app/checkout-ACDC/page.tsx
 * - src/app/checkout-PayPal/page.tsx
 * - src/app/checkout-API/page.tsx
 * - src/app/save-card/page.tsx
 * - src/app/save-PayPal/page.tsx
 */

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useVaultStore, type FlowType } from "@/store/vault";
import { cn } from "@/lib/utils";

export interface VaultInitData {
  clientId: string;
  access_token: string;
  id_token: string;
  VAULT_MODEL: string;
  CUSTOMER_ID: string;
  VAULT_ID: string;
  TEST_MERCHANT_ID: string;
  is_use_PAYPAL_AUTH_ASSERTION: boolean;
  route: string;
  PAYPAL_TEST_CARD_NO: string;
  PAYPAL_TEST_CARD_DATE: string;
  PAYPAL_TEST_CARD_CVV: string;
}

export interface VaultCommonPartRef {
  getState: () => {
    customerId: string;
    vaultId: string;
    useVault: boolean;
    orderAmount: string;
  };
  initData: VaultInitData | null;
}

interface VaultCommonPartProps {
  model: string;
  isUsePaypalAuthAssertion: boolean;
  route?: string;
  showVaultOption?: boolean;
  showOrderAmount?: boolean;
  onInitDataLoaded?: (data: VaultInitData) => void;
}

const VaultCommonPart = forwardRef<VaultCommonPartRef, VaultCommonPartProps>(
  function VaultCommonPart(
    {
      model,
      isUsePaypalAuthAssertion,
      route = "",
      showVaultOption = true,
      showOrderAmount = true,
      onInitDataLoaded,
    },
    ref
  ) {
    const { thirdPartyApp, firstPartyApp, thirdParty, firstParty } =
      useVaultStore();

    const appTag = isUsePaypalAuthAssertion ? thirdPartyApp : firstPartyApp;
    const partyData = isUsePaypalAuthAssertion ? thirdParty : firstParty;
    const flowType: FlowType = ["checkout-PayPal", "save-PayPal"].includes(route) ? "paypal" : "card";
    const flowData = partyData[flowType];

    const [initData, setInitData] = useState<VaultInitData | null>(null);
    const [customerId, setCustomerId] = useState(flowData.customerID);
    const [vaultId, setVaultId] = useState(flowData.vaultID);
    const [useVault, setUseVault] = useState(model === "returning");
    const [orderAmount, setOrderAmount] = useState(
      String(Math.floor(Math.random() * 100) + 100)
    );
    const [loading, setLoading] = useState(true);

    useImperativeHandle(ref, () => ({
      getState: () => ({ customerId, vaultId, useVault, orderAmount }),
      initData,
    }));

    useEffect(() => {
      if (!appTag) {
        setLoading(false);
        return;
      }

      const fetchInit = async () => {
        setLoading(true);

        const params = new URLSearchParams({
          model,
          is_use_PAYPAL_AUTH_ASSERTION: String(isUsePaypalAuthAssertion),
          appTag,
          customerID: flowData.customerID,
          vaultID: flowData.vaultID,
          merchantID: partyData.merchantID,
          route,
        });

        const res = await fetch(`/api/vault/init?${params}`);
        const data: VaultInitData = await res.json();
        setInitData(data);

        if (model === "returning") {
          setVaultId(data.VAULT_ID || flowData.vaultID);
          setUseVault(true);
          setCustomerId(data.CUSTOMER_ID || flowData.customerID);
        }

        onInitDataLoaded?.(data);
        setLoading(false);
      };

      fetchInit();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model, isUsePaypalAuthAssertion, appTag]);

    const partyBadge = isUsePaypalAuthAssertion ? (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200">
        <span className="w-2 h-2 rounded-full bg-violet-500" />
        <span className="text-sm font-semibold text-violet-700">3rd Party Model</span>
        <span className="text-xs text-violet-500">· PayPal-Auth-Assertion enabled</span>
      </div>
    ) : (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-sm font-semibold text-amber-700">1st Party Model</span>
        <span className="text-xs text-amber-500">· Direct merchant</span>
      </div>
    );

    const modelBadge =
      model === "firstTime" ? (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-xs font-semibold border border-sky-200">
          First Time Buyer
        </span>
      ) : (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
          Returning Buyer
        </span>
      );

    if (loading) {
      return (
        <div className="space-y-3 animate-pulse">
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="h-10 bg-slate-100 rounded-xl" />
          <div className="h-10 bg-slate-100 rounded-xl" />
        </div>
      );
    }

    if (!appTag) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-rose-200 bg-rose-50">
          <span className="text-rose-500 text-lg shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-rose-700">No app selected</p>
            <p className="text-xs text-rose-500 mt-0.5">
              Go back to the dashboard and select a {isUsePaypalAuthAssertion ? "3rd Party" : "1st Party"} app first.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {partyBadge}
          {modelBadge}
        </div>

        {/* Client ID */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Client ID
          </label>
          <input
            type="text"
            value={initData?.clientId || ""}
            disabled
            className="w-full rounded-lg border-2 border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-mono text-slate-500 cursor-not-allowed"
          />
        </div>

        {/* Customer ID */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label
              htmlFor="CUSTOMER_ID"
              className="text-xs font-semibold text-slate-500 uppercase tracking-wider"
            >
              Customer ID
            </label>
            <span className="text-xs text-slate-400">
              {model === "firstTime"
                ? "(Leave blank to let PayPal auto-generate, or specify your own)"
                : "(Pre-filled from previous transaction)"}
            </span>
          </div>
          <input
            id="CUSTOMER_ID"
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder={
              model === "firstTime"
                ? "Optional: enter custom customer ID"
                : "Customer ID from vault"
            }
            className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700
              focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
          />
        </div>

        {/* Vault option */}
        {showVaultOption && (
          <div className={cn(
            "rounded-lg border-2 bg-white p-4 space-y-3",
            model === "firstTime" ? "border-slate-100 opacity-40" : "border-slate-200"
          )}>
            <label className={cn(
              "flex items-center gap-3 group",
              model === "firstTime" ? "cursor-not-allowed" : "cursor-pointer"
            )}>
              <div className="relative">
                <input
                  type="checkbox"
                  id="use_vault_checkbox"
                  checked={useVault}
                  disabled={model === "firstTime"}
                  onChange={(e) => {
                    setUseVault(e.target.checked);
                    if (!e.target.checked) setVaultId("");
                  }}
                  className="sr-only"
                />
                <div
                  className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                    useVault
                      ? "bg-blue-600 border-blue-600"
                      : model === "firstTime"
                        ? "border-slate-200"
                        : "border-slate-300 group-hover:border-blue-400"
                  )}
                >
                  {useVault && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Use Vault ID to Pay
                </p>
                <p className="text-xs text-slate-400">
                  {model === "firstTime"
                    ? "Only available for returning buyers"
                    : "Enable to pay with a stored payment method"}
                </p>
              </div>
            </label>

            {useVault && (
              <input
                id="vault_id_input"
                type="text"
                value={vaultId}
                onChange={(e) => setVaultId(e.target.value)}
                placeholder="Enter vault_id"
                className="w-full rounded-lg border-2 border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-mono text-blue-700
                  focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
              />
            )}
          </div>
        )}

        {/* Order Amount */}
        {showOrderAmount && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="amount_input"
              className="text-xs font-semibold text-slate-500 uppercase tracking-wider"
            >
              Order Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                $
              </span>
              <input
                id="amount_input"
                type="number"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 bg-white pl-7 pr-3 py-2.5 text-sm font-mono text-slate-700
                  focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
              />
            </div>
          </div>
        )}
      </div>
    );
  }
);

VaultCommonPart.displayName = "VaultCommonPart";

export default VaultCommonPart;
