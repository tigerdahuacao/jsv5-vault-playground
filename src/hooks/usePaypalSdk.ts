"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VaultInitData } from "@/components/VaultCommonPart";

type SdkComponent = "card-fields" | "buttons" | "card-fields,buttons";

interface UsePaypalSdkOptions {
  components: SdkComponent;
  /** Extra URL params appended to the SDK script src, e.g. "&vault=true" */
  extraParams?: string;
  onError?: (msg: string) => void;
}

/**
 * Manages PayPal JS SDK lifecycle safely:
 * - Reuses existing script when clientId hasn't changed
 * - Tears down SDK cleanly (destroys CardFields, removes iframes, clears window.paypal)
 *   before re-loading with a new clientId
 * - Cleans up on component unmount
 */
export function usePaypalSdk({ components, extraParams = "", onError }: UsePaypalSdkOptions) {
  const [sdkReady, setSdkReady] = useState(false);
  const loadedClientIdRef = useRef<string>("");
  // Holds any CardFields instance so we can close it before tearing down
  const cardFieldInstanceRef = useRef<{ close?: () => void } | null>(null);

  const destroySdk = useCallback(() => {
    // 1. Close active CardFields instance before touching the script/iframes
    if (cardFieldInstanceRef.current?.close) {
      try { cardFieldInstanceRef.current.close(); } catch (_) { }
    }
    cardFieldInstanceRef.current = null;

    // 2. Remove PayPal-injected zoid iframes
    document.querySelectorAll("iframe[name^='__zoid']").forEach((el) => {
      el.parentElement?.remove();
    });

    // 3. Remove the script tag
    document.getElementById("paypal-sdk-script")?.remove();

    // 4. Clear the global namespace so the next load starts clean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).paypal;

    loadedClientIdRef.current = "";
    setSdkReady(false);
  }, []);

  const loadSdk = useCallback((data: VaultInitData) => {
    if (!data.clientId) return;

    // Reuse existing SDK if clientId matches and window.paypal is live
    if (
      loadedClientIdRef.current === data.clientId &&
      document.getElementById("paypal-sdk-script") &&
      window.paypal
    ) {
      setSdkReady(true);
      return;
    }

    // Need fresh load — tear down cleanly first
    destroySdk();

    const script = document.createElement("script");
    script.id = "paypal-sdk-script";
    script.src = `https://www.paypal.com/sdk/js?client-id=${data.clientId}&components=${components}&currency=USD${extraParams}`;
    if (data.id_token) {
      console.log("data-user-id-token:", data.id_token)
      script.setAttribute("data-user-id-token", data.id_token);
    }
    script.onload = () => {
      loadedClientIdRef.current = data.clientId;
      setSdkReady(true);
    };
    script.onerror = () => {
      onError?.("Failed to load PayPal SDK. Check client ID or network.");
    };
    document.head.appendChild(script);
  }, [components, extraParams, destroySdk, onError]);

  // Clean up when the page component unmounts (e.g. navigating away)
  useEffect(() => {
    return () => { destroySdk(); };
  }, [destroySdk]);

  return { sdkReady, loadSdk, destroySdk, cardFieldInstanceRef };
}
