import { NextRequest, NextResponse } from "next/server";
import { callPayPalAPI } from "@/lib/paypal-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, requestBody } = body;
    const { jsonResponse, httpStatusCode } = await callPayPalAPI(
      "POST",
      requestBody,
      endpoint
    );
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("PayPal API call failed:", error);
    return NextResponse.json({ error: "PayPal API call failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint") || "";
    const getPathParam = searchParams.get("pathParam") || "";
    const { jsonResponse, httpStatusCode } = await callPayPalAPI(
      "GET",
      null,
      endpoint,
      getPathParam
    );
    return NextResponse.json(jsonResponse, { status: httpStatusCode });
  } catch (error) {
    console.error("PayPal API call failed:", error);
    return NextResponse.json({ error: "PayPal API call failed." }, { status: 500 });
  }
}
