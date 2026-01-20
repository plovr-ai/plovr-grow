// Currency options for dropdown selection
export const CURRENCY_OPTIONS = [
  { value: "USD", label: "US Dollar ($)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "CNY", label: "Chinese Yuan (¥)" },
  { value: "JPY", label: "Japanese Yen (¥)" },
  { value: "CAD", label: "Canadian Dollar (C$)" },
  { value: "AUD", label: "Australian Dollar (A$)" },
  { value: "KRW", label: "South Korean Won (₩)" },
  { value: "MXN", label: "Mexican Peso (MX$)" },
] as const;

// Locale options for dropdown selection
export const LOCALE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "zh-TW", label: "Chinese (Traditional)" },
  { value: "de-DE", label: "German" },
  { value: "fr-FR", label: "French" },
  { value: "es-ES", label: "Spanish" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]["value"];
export type LocaleCode = (typeof LOCALE_OPTIONS)[number]["value"];
