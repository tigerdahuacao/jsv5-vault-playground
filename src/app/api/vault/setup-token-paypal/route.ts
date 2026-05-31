import { NextRequest, NextResponse } from "next/server";
import { createSetupTokenSavePayPal, setRequestCredentials } from "@/lib/paypal-api";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
  try {
    const permitMultiple = request.nextUrl.searchParams.get("permit_multiple_payment_tokens") === "true";
    const { jsonResponse, httpStatusCode } = await createSetupTokenSavePayPal(permitMultiple);
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("Failed to create PayPal setup token:", error);
    return NextResponse.json({ error: "Failed to create setup token." }, { status: 500 });
  }
}
