import { NextRequest, NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal-api";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orderID: string }> }
) {
  try {
    const { orderID } = await params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    return NextResponse.json(jsonResponse, {
      status: Number(httpStatusCode) || 200,
    });
  } catch (error) {
    console.error("Failed to capture order:", error);
    return NextResponse.json(
      { error: "Failed to capture order." },
      { status: 500 }
    );
  }
}
