export type CategorySuggestion = {
  categoryId?: number;
  categoryName: string;
  confidence: number;
  reason: string;
};

export type ClassifyResult = {
  category: CategorySuggestion | null;
  paymentMethodHint: string | null;
  isLikelyInstallment: boolean;
  isLikelySubscription: boolean;
  flags: string[];
};

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: "Food", keywords: ["makan", "food", "restaurant", "cafe", "kopi", "coffee", "gojek makan", "grabfood", "mcdonald", "kfc"] },
  { category: "Transport", keywords: ["grab", "gojek", "uber", "bbm", "fuel", "bensin", "tol", "parking", "parkir", "taxi"] },
  { category: "Shopping", keywords: ["shopee", "tokopedia", "lazada", "amazon", "mall", "uniqlo", "zara"] },
  { category: "Entertainment", keywords: ["netflix", "spotify", "disney", "youtube", "game", "steam", "cinema", "bioskop"] },
  { category: "Utilities", keywords: ["pln", "pdam", "internet", "wifi", "pulsa", "listrik", "token", "indihome"] },
  { category: "Health", keywords: ["apotek", "hospital", "klinik", "dokter", "pharmacy", "bpjs"] },
  { category: "Housing", keywords: ["sewa", "rent", "kost", "mortgage", "ipl", "maintenance"] },
  { category: "Education", keywords: ["kursus", "course", "tuition", "sekolah", "kuliah", "udemy"] },
  { category: "Electronics", keywords: ["laptop", "phone", "iphone", "samsung", "gadget", "monitor", "headphones"] },
];

const SUBSCRIPTION_KEYWORDS = [
  "netflix", "spotify", "disney", "youtube premium", "subscription", "langganan", "prime", "icloud", "office 365",
];

const INSTALLMENT_KEYWORDS = [
  "cicilan", "installment", "angsuran", "0%", "kredit", "tenor", "bulan", "12x", "6x", "24x",
];

export function classifyTransactionNote(
  input: {
    notes?: string | null;
    amount?: number;
    existingCategories?: Array<{ id: number; name: string }>;
  }
): ClassifyResult {
  const text = (input.notes || "").toLowerCase();
  const flags: string[] = [];
  let best: CategorySuggestion | null = null;

  for (const rule of CATEGORY_KEYWORDS) {
    const hit = rule.keywords.find((k) => text.includes(k));
    if (hit) {
      const existing = input.existingCategories?.find(
        (c) => c.name.toLowerCase() === rule.category.toLowerCase()
      );
      const confidence = hit.length >= 5 ? 0.85 : 0.7;
      if (!best || confidence > best.confidence) {
        best = {
          categoryId: existing?.id,
          categoryName: existing?.name || rule.category,
          confidence,
          reason: `Matched keyword "${hit}"`,
        };
      }
    }
  }

  // Fuzzy match against user's actual category names
  if (input.existingCategories) {
    for (const cat of input.existingCategories) {
      const name = cat.name.toLowerCase();
      if (name && text.includes(name) && (!best || best.confidence < 0.9)) {
        best = {
          categoryId: cat.id,
          categoryName: cat.name,
          confidence: 0.9,
          reason: `Notes mention category "${cat.name}"`,
        };
      }
    }
  }

  const isLikelySubscription = SUBSCRIPTION_KEYWORDS.some((k) => text.includes(k));
  const isLikelyInstallment = INSTALLMENT_KEYWORDS.some((k) => text.includes(k));

  if (isLikelySubscription) flags.push("Looks like a subscription/recurring charge");
  if (isLikelyInstallment) flags.push("Looks like an installment/financing purchase");
  if (input.amount != null && input.amount >= 5_000_000) {
    flags.push("Unusually large amount — double-check category and financing");
  }

  let paymentMethodHint: string | null = null;
  if (/cash|tunai/.test(text)) paymentMethodHint = "Cash";
  else if (/transfer|bank|bca|mandiri|bni|bri/.test(text)) paymentMethodHint = "Bank Transfer";
  else if (/credit|kartu kredit|cc/.test(text)) paymentMethodHint = "Credit Card";
  else if (/debit|ewallet|ovo|gopay|dana|shopeepay/.test(text)) paymentMethodHint = "E-Wallet";

  return {
    category: best,
    paymentMethodHint,
    isLikelyInstallment,
    isLikelySubscription,
    flags,
  };
}
