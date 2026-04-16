import { NextResponse } from "next/server";
import { createSetupTokenSavePayPal } from "@/lib/paypal-api";

export async function GET() {
  try {
    const { jsonResponse, httpStatusCode } = await createSetupTokenSavePayPal();
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("Failed to create PayPal setup token:", error);
    return NextResponse.json({ error: "Failed to create setup token." }, { status: 500 });
  }
}
