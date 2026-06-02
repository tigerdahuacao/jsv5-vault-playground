import { NextRequest, NextResponse } from "next/server";
import { createSetupTokenSaveCard, setRequestCredentials } from "@/lib/paypal-api";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
  try {
    const merchantCustomerId =
      request.nextUrl.searchParams.get("merchant_customer_id") || "";
    const { jsonResponse, httpStatusCode } =
      await createSetupTokenSaveCard(merchantCustomerId);
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("Failed to create card setup token:", error);
    return NextResponse.json({ error: "Failed to create setup token." }, { status: 500 });
  }
}
