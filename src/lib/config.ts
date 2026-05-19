// Mirror of config/default.json — centralised config for the Next.js app

export const testCard = {
  PAYPAL_TEST_CARD_NO: "4111111111111111",
  PAYPAL_TEST_CARD_DATE: "12/2027",
  PAYPAL_TEST_CARD_CVV: "123",
};

export type AppEntry = {
  clientID: string;
  secret: string;
  "partner-email"?: string;
  "partner-id"?: string;
  merchantID?: string;
  pwd?: string;
  comment?: Record<string, string>;
};

export const clientIDConfigs: {
  thirdParty: Record<string, AppEntry>;
  firstParty: Record<string, AppEntry>;
} = {
  thirdParty: {
    US_Old: {
      clientID:
        "AaupPo8G66AlZPSMxOMUtvQx2oSlP_8fMqOpYS-mTW0wsJkeXqfuBAVrvF1jx-gnzkUqGNRLHTD-VR_x",
      secret:
        "EK8hqlHecd2m5k3tEpppVe6Xj5McpzlL8qVV57dWtxGtjmzC0Pp-fmLMZkdgUixG4Zee6qOUtxbFyCrD",
      "partner-email": "petro-test01-us-platform@cctest.com",
    },
    US_New: {
      clientID:
        "AaB-X2CM2jf9k-DU-sWSaNbpfKnHeRLHa84MppXHdBpv36uWUqGui9ldOk6SeET9Os5Hc4J5puUTetXo",
      secret:
        "EAwyCjl9UrSmRqV4h6E_xoZdt3CVdJof6P9_1c8IY-jUca_m7g9oCAuMiw5vJ-MyhJzopPiRwbTaqUYy",
      "partner-email": "petro-vault-test@cc.com",
      pwd: "Qq111222333",
    },
    "C2-AUM2z": {
      clientID:
        "AUM2zJb7drPiUy5Vby3gnWhQghznD59atjgWuh2yhUIbGYbuxpSVfZqwgHJx9lbeoxqiklXs0sdm_HW7",
      secret:
        "EOEczaB4H2gKrghoM5J5IOh_zUkxKSzftSuEaez10oa6l3CuQZ3Q396PtT0OklIPD0KyttJZknBLcL7K",
      "partner-email": "petro-test01-my-c2@cctest.com",
      pwd: "Qq111222333",
    },
    "C2-Lin-Adm6y": {
      clientID:
        "Adm6ykY4qOapGZKtcvcrXTqnuqsNIsBxhWSNMR0zLTV5R3PZkWD7or5axoRRmHwWc8jHrhdjH5JZZIOh",
      secret:
        "EOQaTl91zj2ZNS5SJc-p8Yo3ToZgtujPtTHmiEk55XSJ_UPqT2XiTQgfhtrStwzCINa9vpuMnGj7_BBN",
      "partner-id": "D97UUQ6K3XGH2",
    },
  },
  firstParty: {
    US: {
      merchantID: "XD7W9GPWCSU9L",
      clientID:
        "AUg7J8a_Q3JNzSOMucYdUzXt_UGQBXXtVIQlkd8zhUNcm0NfSCa5oyZu-tXvSlTLOzkIhYWD1TRaCe2C",
      secret:
        "EGo7Qcp8xuEv1clleZn9JF3EcNUXrKt9WvIrJMMVkGKS-wkyQKdaHjZ2O0CeFHOWvqSruxI-FMXpEtUz",
    },
    "C2-AfT9T": {
      "partner-id": "N83L9PW82HDHL",
      clientID:
        "AfT9T73YOOVSPXNJb8pd9E4WkuwFl1NDM5naClS9HwORvc7mlppOzVHMqzSMAo3oZ7-zyqLgo5SbHPV2",
      secret:
        "ECFSfdTPHh5qezz-5nTWYSNTtmIxke64jVJkDZINSYVNCp0zOkZ2tQAKDQlQ8WYwm9iHwQ13jrQPHUiQ",
    },
    "C2-ATorZ": {
      clientID:
        "ATorZMIJrWsnLfLmzmfdOGA4AzRv_7ZGW4uHyva9Y0v7A1UcmvL18evdvZqrdc1wiuEeIenyiJvEEUZR",
      secret:
        "EB32KNIh4AfVBMgsAiRaPUmI7_p11h3TCdau4K9b-CdwecEPhU5W13H2MCZsX6-fUr6A1U0mAeW5mALH",
    },
    "Lala-Test": {
      clientID:
        "Aeq9yhBdHK8k8Fr9av15Zl9TvrQ4Rf3fULHwlR5c3r9SVrWk_Ig-b6E_7zITqAtNkViXCxGlpWVz3_o3",
      secret:
        "EGenIIE-uz9QYAtzRILRFWyCn6kYwuT6FfJ9yzlr_DUfODN43ba2zXOkYfNzxmRF2gDALL4rfoYakYMS",
    },
  },
};

export const USE_API_VAULT = {
  paypal: {
    Setup_token_for_paypal: JSON.stringify(
      {
        payment_source: {
          paypal: {
            usage_type: "MERCHANT",
            customer_type: "CONSUMER",
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              brand_name: "EXAMPLE INC",
              locale: "en-US",
              return_url: "https://example.com/returnUrl",
              cancel_url: "https://example.com/cancelUrl",
            },
          },
        },
      },
      null,
      2
    ),
  },
  card: {
    Setup_token_for_card: JSON.stringify(
      {
        payment_source: {
          card: {
            number: "4111111111111111",
            expiry: "2027-12",
            name: "Firstname Lastname",
            billing_address: {
              address_line_1: "2211 N First Street",
              address_line_2: "17.3.160",
              admin_area_1: "CA",
              admin_area_2: "San Jose",
              postal_code: "95131",
              country_code: "US",
            },
            experience_context: {
              brand_name: "YourBrandName",
              locale: "en-US",
              return_url: "https://example.com/returnUrl",
              cancel_url: "https://example.com/cancelUrl",
            },
          },
        },
      },
      null,
      2
    ),
    Create_payment_token_for_card: JSON.stringify(
      {
        payment_source: {
          token: { id: "572189484X6583044", type: "SETUP_TOKEN" },
        },
      },
      null,
      2
    ),
    Make_payment_for_card: JSON.stringify(
      {
        intent: "CAPTURE",
        purchase_units: [
          { amount: { currency_code: "USD", value: "100.00" } },
        ],
        payment_source: { card: { vault_id: "dnbbj3g" } },
      },
      null,
      2
    ),
  },
};
