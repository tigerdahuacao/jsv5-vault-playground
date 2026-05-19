import { NextRequest, NextResponse } from "next/server";
import { captureOrder, setRequestCredentials } from "@/lib/paypal-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderID: string }> }
) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );

  try {
    const { orderID } = await params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    return NextResponse.json(jsonResponse, { status: Number(httpStatusCode) || 200 });
  } catch (error) {
    console.error("Failed to capture order:", error);
    return NextResponse.json({ error: "Failed to capture order." }, { status: 500 });
  }
}
