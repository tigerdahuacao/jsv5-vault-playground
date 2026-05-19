import { NextResponse } from "next/server";
import { createSetupTokenSaveCard } from "@/lib/paypal-api";

export async function GET() {
  try {
    const { jsonResponse, httpStatusCode } = await createSetupTokenSaveCard();
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("Failed to create card setup token:", error);
    return NextResponse.json({ error: "Failed to create setup token." }, { status: 500 });
  }
}
