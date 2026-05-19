export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import {
  initClientIDSecret,
  initVaultInfo,
  generateToken,
  generateClientToken,
} from "@/lib/paypal-api";
import { clientIDConfigs, testCard } from "@/lib/config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vault_model = searchParams.get("model") || "firstTime";
    const is_use_PAYPAL_AUTH_ASSERTION =
      searchParams.get("is_use_PAYPAL_AUTH_ASSERTION") === "true";
    const appTag = searchParams.get("appTag") || "";
    const customerID = searchParams.get("customerID") || "";
    const vaultID = searchParams.get("vaultID") || "";
    const merchantID = searchParams.get("merchantID") || "";
    const route = searchParams.get("route") || "";

    let PAYPAL_CLIENT_ID: string;
    let PAYPAL_CLIENT_SECRET: string;

    if (is_use_PAYPAL_AUTH_ASSERTION) {
      const entry = clientIDConfigs.thirdParty[appTag];
      PAYPAL_CLIENT_ID = entry?.clientID || "";
      PAYPAL_CLIENT_SECRET = entry?.secret || "";
    } else {
      const entry = clientIDConfigs.firstParty[appTag];
      PAYPAL_CLIENT_ID = entry?.clientID || "";
      PAYPAL_CLIENT_SECRET = entry?.secret || "";
    }

    initClientIDSecret(
      PAYPAL_CLIENT_ID,
      PAYPAL_CLIENT_SECRET,
      merchantID,
      is_use_PAYPAL_AUTH_ASSERTION
    );
    initVaultInfo(vault_model, vaultID, customerID);

    await generateClientToken();
    const { id_token } = await generateToken();

    return NextResponse.json({
      clientId: PAYPAL_CLIENT_ID,
      id_token,
      VAULT_MODEL: vault_model,
      CUSTOMER_ID: customerID,
      VAULT_ID: vaultID,
      TEST_MERCHANT_ID: merchantID,
      is_use_PAYPAL_AUTH_ASSERTION,
      route,
      ...testCard,
    });
  } catch (error) {
    console.error("Failed to init vault page:", error);
    return NextResponse.json(
      { error: "Failed to initialize page." },
      { status: 500 }
    );
  }
}
