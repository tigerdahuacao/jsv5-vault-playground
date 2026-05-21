import { NextRequest, NextResponse } from "next/server";
import { createPaymentToken, setRequestCredentials } from "@/lib/paypal-api";


export const runtime = "edge";

export async function GET(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
  try {
    const { searchParams } = new URL(request.url);
    const token_id = searchParams.get("token_id");
    if (!token_id) {
      return NextResponse.json({ error: "token_id is required" }, { status: 400 });
    }
    const result = await createPaymentToken(token_id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to create payment token:", error);
    return NextResponse.json({ error: "Failed to create payment token." }, { status: 500 });
  }
}
