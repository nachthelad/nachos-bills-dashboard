import type { CategoryValue } from "./categories"

export type ProviderHint = {
  providerId: string
  providerName: string
  category: CategoryValue
  keywords: string[]
}

export const PROVIDER_HINTS: ProviderHint[] = [
  {
    providerId: "personal",
    providerName: "Personal (Fibertel)",
    category: "internet",
    keywords: ["personal", "fibertel", "telecom argentina", "cablevision"],
  },
  {
    providerId: "flow",
    providerName: "Flow (Cablevisión Telecom)",
    category: "internet",
    keywords: ["flow", "fibertel flow", "flow empresas"],
  },
  {
    providerId: "telecentro",
    providerName: "Telecentro",
    category: "internet",
    keywords: ["telecentro"],
  },
  {
    providerId: "claro",
    providerName: "Claro",
    category: "internet",
    keywords: ["claro"],
  },
  {
    providerId: "movistar",
    providerName: "Movistar",
    category: "internet",
    keywords: ["movistar"],
  },
  {
    providerId: "movistar_tv",
    providerName: "Movistar TV",
    category: "internet",
    keywords: ["movistar tv", "movistar play"],
  },
  {
    providerId: "iplan",
    providerName: "iPlan",
    category: "internet",
    keywords: ["iplan", "iplan fiber"],
  },
  {
    providerId: "fibercorp",
    providerName: "Fibercorp",
    category: "internet",
    keywords: ["fibercorp", "telecom empresas"],
  },
  {
    providerId: "telecom",
    providerName: "Telecom Argentina",
    category: "internet",
    keywords: ["telecom argentina"],
  },
  {
    providerId: "edesur",
    providerName: "Edesur",
    category: "electricity",
    keywords: ["edesur"],
  },
  {
    providerId: "edenor",
    providerName: "Edenor",
    category: "electricity",
    keywords: ["edenor"],
  },
  {
    providerId: "epec",
    providerName: "EPEC (Córdoba)",
    category: "electricity",
    keywords: ["epec"],
  },
  {
    providerId: "edea",
    providerName: "EDEA",
    category: "electricity",
    keywords: ["edea"],
  },
  {
    providerId: "edesa",
    providerName: "EDESA",
    category: "electricity",
    keywords: ["edesa"],
  },
  {
    providerId: "epe_santafe",
    providerName: "EPE Santa Fe",
    category: "electricity",
    keywords: ["epe", "energia santafe"],
  },
  {
    providerId: "aysa",
    providerName: "AySA",
    category: "water",
    keywords: ["aysa"],
  },
  {
    providerId: "aguas_cordobesas",
    providerName: "Aguas Cordobesas",
    category: "water",
    keywords: ["aguas cordobesas"],
  },
  {
    providerId: "metrogas",
    providerName: "Metrogas",
    category: "gas",
    keywords: ["metrogas"],
  },
  {
    providerId: "naturgy",
    providerName: "Naturgy",
    category: "gas",
    keywords: ["naturgy", "gas natural ban", "gasban"],
  },
  {
    providerId: "camuzzi",
    providerName: "Camuzzi Gas",
    category: "gas",
    keywords: ["camuzzi"],
  },
  {
    providerId: "expensas_genericas",
    providerName: "Expensas / Consorcio",
    category: "hoa",
    keywords: ["expensa", "consorcio", "administracion"],
  },
  {
    providerId: "visa",
    providerName: "Visa",
    category: "credit_card",
    keywords: ["visa"],
  },
  {
    providerId: "mastercard",
    providerName: "Mastercard",
    category: "credit_card",
    keywords: ["mastercard"],
  },
  {
    providerId: "amex",
    providerName: "American Express",
    category: "credit_card",
    keywords: ["amex", "american express"],
  },
  {
    providerId: "naranja",
    providerName: "Tarjeta Naranja X",
    category: "credit_card",
    keywords: ["naranja", "tarjeta naranja", "naranja x"],
  },
  {
    providerId: "cabal",
    providerName: "Cabal",
    category: "credit_card",
    keywords: ["cabal"],
  },
  {
    providerId: "maestro",
    providerName: "Maestro",
    category: "credit_card",
    keywords: ["maestro"],
  },
  {
    providerId: "coto",
    providerName: "Coto",
    category: "other",
    keywords: ["coto"],
  },
  {
    providerId: "mercadopago",
    providerName: "Mercado Pago",
    category: "other",
    keywords: ["mercado pago", "mp"],
  },
  {
    providerId: "uala",
    providerName: "Ualá",
    category: "other",
    keywords: ["uala"],
  },
]
