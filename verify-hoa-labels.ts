import {
  formatHoaPeriod,
  ensureSpanishPeriodLabel,
} from "./lib/hoa-period-utils";

function testFormatter() {
  console.log("Testing formatHoaPeriod...");
  for (let m = 1; m <= 12; m++) {
    console.log(`Month ${m}: ${formatHoaPeriod(m, 2025)}`);
  }

  console.log("\nTesting ensureSpanishPeriodLabel...");
  console.log(`10/2025 -> ${ensureSpanishPeriodLabel("10/2025")}`);
  console.log(`11/2025 -> ${ensureSpanishPeriodLabel("11/2025")}`);
  console.log(`Already Spanish -> ${ensureSpanishPeriodLabel("OCTUBRE/2025")}`);
  console.log(`Fallback numeric -> ${ensureSpanishPeriodLabel("01/2025")}`);
}

testFormatter();
