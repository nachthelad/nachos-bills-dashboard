export function formatAmount(
  amount: number,
  currency = "ARS",
  showAmounts = true
): string {
  if (!showAmounts) return "••••••";
  if (currency === "ARS") {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return `USD ${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}
