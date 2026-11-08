import { z } from "zod";

export type PaymentEvent = {
  eventId: string;
  accountId: string;
  amountMinor: number;
  currency: string;
  riskScore: number;
  occurredAt: string;
};

export type ReportRequest = {
  period: string;
  events: PaymentEvent[];
};

export type ReportDecision = {
  action: "archive" | "manual_review";
  notification: string;
  markdown: string;
};

const paymentEventSchema = z.object({
  eventId: z.string().min(1),
  accountId: z.string().min(1),
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  riskScore: z.number().min(0).max(100),
  occurredAt: z.string().datetime(),
});

const reportRequestSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  events: z.array(paymentEventSchema).min(1),
});

export function parseReportRequest(input: unknown): ReportRequest {
  return reportRequestSchema.parse(input);
}

const REVIEW_RISK_SCORE = 70;

export function decideReport(request: ReportRequest): ReportDecision {
  const risky = request.events.filter((event) => event.riskScore >= REVIEW_RISK_SCORE);
  const totalMinor = request.events.reduce((sum, event) => sum + event.amountMinor, 0);
  const action = risky.length > 0 ? "manual_review" : "archive";
  const notification = action === "archive"
    ? `Audit record: ${request.period} archived with ${request.events.length} payment events.`
    : `Audit record: ${request.period} requires review for ${risky.length} risk-sensitive payment events.`;
  const rows = request.events.map((event) =>
    `| ${event.eventId} | ${event.accountId} | ${event.currency} ${(event.amountMinor / 100).toFixed(2)} | ${event.riskScore} |`,
  );

  return {
    action,
    notification,
    markdown: [
      `# Payment activity: ${request.period}`,
      "",
      `Decision: ${action}`,
      `Total recorded value: ${(totalMinor / 100).toFixed(2)}`,
      "",
      "| Event | Account | Amount | Risk score |",
      "| --- | --- | ---: | ---: |",
      ...rows,
    ].join("\n"),
  };
}
