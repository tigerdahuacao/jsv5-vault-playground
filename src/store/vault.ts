"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface PartyData {
  customerID: string;
  vaultID: string;
  merchantID: string;
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
  setFirstPartyApp: (tag: string) => void;
  saveVaultResult: (isAuth: boolean, customerID: string, vaultID: string) => void;
  getPartyData: (isAuth: boolean) => PartyData;
  setModel: (model: VaultModel) => void;
  setUseAuthAssertion: (value: boolean) => void;
}

export const useVaultStore = create<VaultStore>()(
  persist(
    (set, get) => ({
      thirdPartyApp: "",
      firstPartyApp: "",
      thirdParty: { customerID: "", vaultID: "", merchantID: "" },
      firstParty: { customerID: "", vaultID: "", merchantID: "" },
      model: "firstTime",
      useAuthAssertion: true,

      setThirdPartyApp: (tag, merchantID = "") =>
        set((s) => ({
          thirdPartyApp: tag,
          thirdParty: { ...s.thirdParty, merchantID },
        })),

      setFirstPartyApp: (tag) => set({ firstPartyApp: tag }),

      saveVaultResult: (isAuth, customerID, vaultID) =>
        set((s) =>
          isAuth
            ? { thirdParty: { ...s.thirdParty, customerID, vaultID } }
            : { firstParty: { ...s.firstParty, customerID, vaultID } }
        ),

      getPartyData: (isAuth) =>
        isAuth ? get().thirdParty : get().firstParty,

      setModel: (model) => set({ model }),

      setUseAuthAssertion: (value) => set({ useAuthAssertion: value }),
    }),
    {
      name: "paypal-vault-store",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
