
const base = "https://api.sandbox.paypal.com";

let PAYPAL_CLIENT_ID: string;
let PAYPAL_CLIENT_SECRET: string;
let access_token: string;
let VAULT_MODEL: string;
let VAULT_ID: string;
let CUSTOMER_ID: string;
let TEST_MERCHANT_ID: string;
let is_use_PAYPAL_AUTH_ASSERTION: boolean;

export const initClientIDSecret = (
  clientID: string,
  secret: string,
  merchant_id: string,
  isUsePAYPAL_AUTH_ASSERTION: boolean
) => {
  PAYPAL_CLIENT_ID = clientID;
  PAYPAL_CLIENT_SECRET = secret;
  TEST_MERCHANT_ID = merchant_id;
  is_use_PAYPAL_AUTH_ASSERTION = isUsePAYPAL_AUTH_ASSERTION;
};

export const getAccessToken = () => access_token;

export const initVaultInfo = (
  vault_model: string,
  vault_id: string,
  customer_id: string
) => {
  VAULT_MODEL = vault_model;
  VAULT_ID = vault_id;
  CUSTOMER_ID = customer_id;
};

function generatePayPalAuthAssertion(
  clientID: string,
  merchantID: string
): string {
  const to_encode = { iss: clientID, payer_id: merchantID };
  const encoded_str = Buffer.from(JSON.stringify(to_encode)).toString("base64");
  return `eyJhbGciOiJub25lIn0=.${encoded_str}.`;
}

function generateRandomPayPalRequestID(): string {
  return Date.now().toString(32);
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${access_token}`,
    "PayPal-Request-Id": generateRandomPayPalRequestID(),
  };
  if (is_use_PAYPAL_AUTH_ASSERTION) {
    headers["Paypal-Auth-Assertion"] = generatePayPalAuthAssertion(
      PAYPAL_CLIENT_ID,
      TEST_MERCHANT_ID
    );
  }
  return headers;
}

async function handleResponse(
  response: Response
): Promise<{ jsonResponse: Record<string, unknown>; httpStatusCode: number }> {
  try {
    const jsonResponse = await response.json();
    return { jsonResponse, httpStatusCode: response.status };
  } catch {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

export async function generateToken(): Promise<{
  access_token: string;
  id_token: string;
}> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("MISSING_API_CREDENTIALS");
  }

  const requestBody: Record<string, string> = {
    grant_type: "client_credentials",
    response_type: "id_token",
  };

  const auth = Buffer.from(
    PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
  ).toString("base64");
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
  };

  if (VAULT_MODEL === "returning") {
    requestBody["target_customer_id"] = CUSTOMER_ID;
    if (is_use_PAYPAL_AUTH_ASSERTION) {
      headers["PayPal-Auth-Assertion"] = generatePayPalAuthAssertion(
        PAYPAL_CLIENT_ID,
        TEST_MERCHANT_ID
      );
    }
  }

  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    body: new URLSearchParams(requestBody),
    headers,
  });

  const data = (await response.json()) as {
    access_token: string;
    id_token: string;
  };
  access_token = data.access_token;
  return { access_token: data.access_token, id_token: data.id_token };
}

// Deprecated but kept to avoid breaking flows
export async function generateClientToken(): Promise<string | undefined> {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return undefined;
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");
    const response = await fetch(`${base}/v1/identity/generate-token`, {
      method: "POST",
      body: JSON.stringify({ customer_id: CUSTOMER_ID }),
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });
    const data = (await response.json()) as { client_token: string };
    return data.client_token;
  } catch {
    return undefined;
  }
}

export async function createSetupTokenSavePayPal(): Promise<{
  jsonResponse: Record<string, unknown>;
  httpStatusCode: number;
}> {
  const url = `${base}/v3/vault/setup-tokens`;
  const payload = {
    payment_source: {
      paypal: {
        description: "Description for PayPal to be shown to PayPal payer",
        shipping: {
          name: { full_name: "Firstname Lastname" },
          address: {
            address_line_1: "2211 N First Street",
            address_line_2: "Building 17",
            admin_area_2: "San Jose",
            admin_area_1: "CA",
            postal_code: "95131",
            country_code: "US",
          },
        },
        permit_multiple_payment_tokens: false,
        usage_pattern: "IMMEDIATE",
        usage_type: "MERCHANT",
        customer_type: "CONSUMER",
        experience_context: {
          shipping_preference: "SET_PROVIDED_ADDRESS",
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          brand_name: "EXAMPLE INC",
          locale: "en-US",
          return_url: "https://example.com/returnUrl",
          cancel_url: "https://example.com/cancelUrl",
        },
      },
    },
  };

  const response = await fetch(url, {
    headers: buildHeaders(),
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function createSetupTokenSaveCard(): Promise<{
  jsonResponse: Record<string, unknown>;
  httpStatusCode: number;
}> {
  const url = `${base}/v3/vault/setup-tokens`;
  const payload = {
    payment_source: {
      card: {
        verification_method: "SCA_ALWAYS",
        experience_context: {
          brand_name: "GMS Rocks",
          locale: "de-DE",
          return_url: "https://example.com/returnUrl",
          cancel_url: "https://example.com/cancelUrl",
        },
      },
    },
  };

  const response = await fetch(url, {
    headers: buildHeaders(),
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function createPaymentToken(
  token_id: string
): Promise<Record<string, unknown>> {
  const url = `${base}/v3/vault/payment-tokens`;
  const payload = {
    payment_source: { token: { id: token_id, type: "SETUP_TOKEN" } },
  };

  const response = await fetch(url, {
    headers: buildHeaders(),
    method: "POST",
    body: JSON.stringify(payload),
  });

  const { jsonResponse } = await handleResponse(response);
  return jsonResponse;
}

export async function createOrder(body: Record<string, unknown>): Promise<{
  jsonResponse: Record<string, unknown>;
  httpStatusCode: number;
}> {
  const tag = "[paypal-api.createOrder]";
  const url = `${base}/v2/checkout/orders`;

  const headers = buildHeaders();
  const tokenPreview = access_token
    ? `${access_token.slice(0, 8)}...${access_token.slice(-4)}`
    : "(none)";
  console.log(`${tag} POST ${url}`);
  console.log(`${tag} access_token preview: ${tokenPreview}`);
  console.log(`${tag} is_use_PAYPAL_AUTH_ASSERTION: ${is_use_PAYPAL_AUTH_ASSERTION}`);
  console.log(`${tag} PayPal-Auth-Assertion header present: ${!!headers["Paypal-Auth-Assertion"]}`);
  console.log(`${tag} request body:`, JSON.stringify(body, null, 2));

  const response = await fetch(url, { headers, method: "POST", body: JSON.stringify(body) });

  console.log(`${tag} response status: ${response.status} ${response.statusText}`);
  const result = await handleResponse(response);
  console.log(`${tag} parsed response:`, JSON.stringify(result.jsonResponse, null, 2));
  return result;
}

async function getOrderDetail(
  requestHeaders: Record<string, string>,
  orderID: string
): Promise<string> {
  const url = `${base}/v2/checkout/orders/${orderID}`;
  const response = await fetch(url, { method: "GET", headers: requestHeaders });
  const result = await handleResponse(response);
  return result.jsonResponse.status === "COMPLETED"
    ? "ORDER_ALREADY_COMPLETED"
    : "ORDER_WAITING_CAPTURE";
}

export async function captureOrder(orderID: string): Promise<{
  jsonResponse: Record<string, unknown>;
  httpStatusCode: number | string;
}> {
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;
  const requestHeaders = buildHeaders();

  const orderStatus = await getOrderDetail(requestHeaders, orderID);
  if (orderStatus === "ORDER_ALREADY_COMPLETED") {
    return {
      jsonResponse: { status: "ORDER_ALREADY_COMPLETED" },
      httpStatusCode: "299",
    };
  }

  const response = await fetch(url, { method: "POST", headers: requestHeaders });
  return handleResponse(response);
}

export async function callPayPalAPI(
  httpMethod: string,
  requestBody: Record<string, unknown> | null,
  endpoint: string,
  getPathParam?: string
): Promise<{ jsonResponse: Record<string, unknown>; httpStatusCode: number }> {
  const url = `${base}${endpoint}`;
  const headers = buildHeaders();

  let response: Response;
  if (httpMethod === "POST") {
    response = await fetch(url, {
      headers,
      method: "POST",
      body: JSON.stringify(requestBody),
    });
  } else {
    const getUrl = `${url}?${getPathParam}`;
    response = await fetch(getUrl, { headers, method: "GET" });
  }

  return handleResponse(response);
}

