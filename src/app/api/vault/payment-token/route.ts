import { NextRequest, NextResponse } from "next/server";
import { createPaymentToken } from "@/lib/paypal-api";

export async function GET(request: NextRequest) {
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
