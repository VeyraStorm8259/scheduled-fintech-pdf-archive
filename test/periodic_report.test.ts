import assert from "node:assert/strict";
import test from "node:test";
import { decideReport } from "../src/periodic_report.ts";

test("a high-risk payment holds the periodic report for review", () => {
  const result = decideReport({
    period: "2026-09",
    events: [
      { eventId: "pay_901", accountId: "acct_review", amountMinor: 7300, currency: "USD", riskScore: 82, occurredAt: "2026-09-10T10:00:00Z" },
    ],
  });

  assert.equal(result.action, "manual_review");
  assert.match(result.notification, /requires review/);
  assert.match(result.markdown, /pay_901/);
});
