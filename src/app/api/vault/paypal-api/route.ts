import { NextRequest, NextResponse } from "next/server";
import { callPayPalAPI, setRequestCredentials } from "@/lib/paypal-api";

export const runtime = "edge";

function initFromRequest(request: NextRequest) {
  setRequestCredentials(
    request.headers.get("x-paypal-client-id") || "",
    request.headers.get("x-paypal-merchant-id") || "",
    request.headers.get("x-paypal-use-auth-assertion") === "true",
    request.headers.get("x-paypal-access-token") || ""
  );
}

export async function POST(request: NextRequest) {
  initFromRequest(request);
  try {
    const body = await request.json();
    const { endpoint, requestBody } = body;
    const { jsonResponse, httpStatusCode } = await callPayPalAPI("POST", requestBody, endpoint);
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("PayPal API call failed:", error);
    return NextResponse.json({ error: "PayPal API call failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  initFromRequest(request);
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint") || "";
    const getPathParam = searchParams.get("pathParam") || "";
    const { jsonResponse, httpStatusCode } = await callPayPalAPI("GET", null, endpoint, getPathParam);
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("PayPal API call failed:", error);
    return NextResponse.json({ error: "PayPal API call failed." }, { status: 500 });
  }
}
