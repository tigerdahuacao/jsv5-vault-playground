interface PayPalCardFields {
  isEligible: () => boolean;
  NameField: (opts?: Record<string, unknown>) => { render: (sel: string) => void };
  NumberField: (opts?: Record<string, unknown>) => { render: (sel: string) => void };
  CVVField: (opts?: Record<string, unknown>) => { render: (sel: string) => void };
  ExpiryField: (opts?: Record<string, unknown>) => { render: (sel: string) => void };
  submit: () => Promise<void>;
}

interface PayPalButtons {
  render: (sel: string) => void;
}

interface PayPalSDK {
  CardFields: (opts: Record<string, unknown>) => PayPalCardFields;
  Buttons: (opts: Record<string, unknown>) => PayPalButtons;
}

declare global {
  interface Window {
    paypal: PayPalSDK;
  }
}

export {};
