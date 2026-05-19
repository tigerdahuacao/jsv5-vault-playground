"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type FlowType = "card" | "paypal";

interface FlowVaultData {
  customerID: string;
  vaultID: string;
}

interface PartyData {
  merchantID: string;
  card: FlowVaultData;
  paypal: FlowVaultData;
}

export type VaultModel = "firstTime" | "returning";

interface VaultStore {
  thirdPartyApp: string;
  firstPartyApp: string;
  thirdParty: PartyData;
  firstParty: PartyData;
  model: VaultModel;
  useAuthAssertion: boolean;

  setThirdPartyApp: (tag: string, merchantID?: string) => void;
  setThirdPartyMerchantID: (merchantID: string) => void;
  setFirstPartyApp: (tag: string) => void;
  saveVaultResult: (isAuth: boolean, flowType: FlowType, customerID: string, vaultID: string) => void;
  getFlowData: (isAuth: boolean, flowType: FlowType) => FlowVaultData;
  getPartyData: (isAuth: boolean) => PartyData;
  setModel: (model: VaultModel) => void;
  setUseAuthAssertion: (value: boolean) => void;
}

const emptyFlow = (): FlowVaultData => ({ customerID: "", vaultID: "" });

const defaultParty = (merchantID = ""): PartyData => ({
  merchantID,
  card: emptyFlow(),
  paypal: emptyFlow(),
});

export const useVaultStore = create<VaultStore>()(
  persist(
    (set, get) => ({
      thirdPartyApp: "",
      firstPartyApp: "",
      thirdParty: defaultParty("CMHAMMNAXCMGA"),
      firstParty: defaultParty(),
      model: "firstTime",
      useAuthAssertion: true,

      setThirdPartyApp: (tag, merchantID = "") =>
        set((s) => ({
          thirdPartyApp: tag,
          thirdParty: { ...s.thirdParty, merchantID },
        })),

      setThirdPartyMerchantID: (merchantID) =>
        set((s) => ({
          thirdParty: { ...s.thirdParty, merchantID },
        })),

      setFirstPartyApp: (tag) => set({ firstPartyApp: tag }),

      saveVaultResult: (isAuth, flowType, customerID, vaultID) =>
        set((s) => {
          const key = isAuth ? "thirdParty" : "firstParty";
          return {
            [key]: {
              ...s[key],
              [flowType]: { customerID, vaultID },
            },
          };
        }),

      getFlowData: (isAuth, flowType) => {
        const party = isAuth ? get().thirdParty : get().firstParty;
        return party[flowType];
      },

      getPartyData: (isAuth) =>
        isAuth ? get().thirdParty : get().firstParty,

      setModel: (model) => set({ model }),

      setUseAuthAssertion: (value) => set({ useAuthAssertion: value }),
    }),
    {
      name: "paypal-vault-store",
      storage: createJSONStorage(() => sessionStorage),
      version: 2,
      migrate: (state: unknown) => {
        const s = state as Record<string, unknown>;

        const migrateParty = (raw: unknown, defaultMerchantID = ""): PartyData => {
          const p = (raw as Record<string, unknown>) || {};
          // Handle old flat structure: { customerID, vaultID, merchantID }
          const oldCustomerID = (p.customerID as string) || "";
          const oldVaultID = (p.vaultID as string) || "";
          return {
            merchantID: (p.merchantID as string) || defaultMerchantID,
            card: (p.card as FlowVaultData) || { customerID: oldCustomerID, vaultID: oldVaultID },
            paypal: (p.paypal as FlowVaultData) || emptyFlow(),
          };
        };

        return {
          ...s,
          thirdParty: migrateParty(s.thirdParty, "CMHAMMNAXCMGA"),
          firstParty: migrateParty(s.firstParty),
        };
      },
    }
  )
);
