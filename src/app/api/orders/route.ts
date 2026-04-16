import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/paypal-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jsonResponse, httpStatusCode } = await createOrder(body);
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 }
    );
  }
}
