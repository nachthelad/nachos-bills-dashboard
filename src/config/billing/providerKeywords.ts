import type { CategoryValue } from "./categories"

export const PROVIDER_KEYWORDS: Array<{ value: CategoryValue; keywords: string[] }> = [
  {
    value: "electricity",
    keywords: ["edesur", "edenor", "epec", "electric", "electricidad", "luz", "edea", "edesa", "epe", "energia"],
  },
  { value: "water", keywords: ["aysa", "agua", "aguas", "aguas cordobesas"] },
  { value: "gas", keywords: ["metrogas", "naturgy", "gas", "gas natural ban", "gasban", "camuzzi"] },
  {
    value: "internet",
    keywords: [
      "telecentro",
      "fibertel",
      "cablevision",
      "personal",
      "claro",
      "movistar",
      "internet",
      "wifi",
      "fibra",
      "flow",
      "iplan",
      "fibercorp",
    ],
  },
  { value: "hoa", keywords: ["expensa", "consorcio", "administracion", "edificio"] },
  { value: "credit_card", keywords: ["visa", "mastercard", "amex", "american express", "maestro", "cabal", "naranja"] },
  { value: "other", keywords: ["mercado pago", "uala", "billetera"] },
]
