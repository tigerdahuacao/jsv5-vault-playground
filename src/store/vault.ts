"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PartyData {
  customerID: string;
  vaultID: string;
  merchantID: string;
}

interface VaultStore {
  thirdPartyApp: string;
  firstPartyApp: string;
  thirdParty: PartyData;
  firstParty: PartyData;

  setThirdPartyApp: (tag: string, merchantID?: string) => void;
  setFirstPartyApp: (tag: string) => void;
  saveVaultResult: (isAuth: boolean, customerID: string, vaultID: string) => void;
  getPartyData: (isAuth: boolean) => PartyData;
}

export const useVaultStore = create<VaultStore>()(
  persist(
    (set, get) => ({
      thirdPartyApp: "",
      firstPartyApp: "",
      thirdParty: { customerID: "", vaultID: "", merchantID: "" },
      firstParty: { customerID: "", vaultID: "", merchantID: "" },

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
    }),
    { name: "paypal-vault-store" }
  )
);
