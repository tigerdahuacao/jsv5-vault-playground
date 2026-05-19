import { NextRequest, NextResponse } from "next/server";
import { createOrder, getAccessToken } from "@/lib/paypal-api";

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

  const token = getAccessToken();
  console.log(`${tag} access_token present: ${!!token} (length=${token?.length ?? 0})`);
  if (!token) {
    console.error(`${tag} access_token is missing — /api/vault/init may not have been called`);
    return NextResponse.json(
      { error: "Not initialized. Please reload the page to re-run /api/vault/init." },
      { status: 401 }
    );
  }

  try {
    console.log(`${tag} calling PayPal createOrder...`);
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
