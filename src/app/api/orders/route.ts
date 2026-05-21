import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
import { createOrder, setRequestCredentials } from "@/lib/paypal-api";

function initFromRequest(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
}

export async function POST(request: NextRequest) {
  const tag = "[POST /api/orders]";
  let body: Record<string, unknown> = {};

  try {
    body = await request.json();
    console.log(`${tag} request body:`, JSON.stringify(body, null, 2));
  } catch (e) {
    console.error(`${tag} failed to parse request body:`, e);
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  initFromRequest(request);

  try {
    const { jsonResponse, httpStatusCode } = await createOrder(body);
    console.log(`${tag} PayPal response [${httpStatusCode}]:`, JSON.stringify(jsonResponse, null, 2));
    if (httpStatusCode >= 400) {
      console.error(`${tag} PayPal returned error status ${httpStatusCode}`);
    }
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error(`${tag} unexpected error:`, error);
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }
}
