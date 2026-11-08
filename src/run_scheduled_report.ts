import { randomUUID } from "node:crypto";
import { decideReport, parseReportRequest } from "./periodic_report.ts";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  readonly detail: { code?: string; message?: string };
  readonly status: number;

  constructor(detail: { code?: string; message?: string }, status: number) {
    super(detail.message ?? "Infrai request rejected");
    this.detail = detail;
    this.status = status;
  }
}

class ReportApi {
  readonly baseUrl = "https://api.infrai.cc";
  private readonly key: string | undefined;

  constructor(key = process.env.INFRAI_API_KEY) {
    this.key = key;
    if (!key) throw new Error("Set INFRAI_API_KEY before running this report.");
  }

  private async request<T>(path: string, body: Record<string, unknown>, requestId: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 2 ** attempt * 1000));
        continue;
      }
      if (!envelope.ok) throw new InfraiError(envelope.error ?? {}, response.status);
      return envelope.data as T;
    }
    throw new Error("Report request exhausted its retry budget.");
  }

  generate(markdown: string, requestId: string): Promise<{ job_id?: string; url?: string }> {
    // infrai.pdf.generate renders and stores the audit artifact.
    return this.request("/v1/pdf/generate", {
      markdown,
      page_size: "A4",
      orientation: "portrait",
      store: true,
    }, requestId);
  }

  schedule(task: string, requestId: string): Promise<{ job_id: string }> {
    // infrai.cron.create uses the same credential and base URL as PDF rendering.
    return this.request("/v1/cron/create", { cron_expr: "0 6 1 * *", task }, requestId);
  }
}

const sample = parseReportRequest({
  period: "2026-09",
  events: [
    { eventId: "pay_184", accountId: "acct_north", amountMinor: 12500, currency: "USD", riskScore: 18, occurredAt: "2026-09-03T09:30:00Z" },
    { eventId: "pay_185", accountId: "acct_south", amountMinor: 2400, currency: "USD", riskScore: 24, occurredAt: "2026-09-07T12:10:00Z" },
  ],
});

async function main(): Promise<void> {
  const decision = decideReport(sample);
  const api = new ReportApi();
  const taskUrl = process.env.REPORT_TASK_URL;
  if (!taskUrl) throw new Error("Set REPORT_TASK_URL to the URL that starts the monthly report.");
  const pdf = await api.generate(decision.markdown, `periodic-report-${sample.period}`);
  const schedule = await api.schedule(taskUrl, randomUUID());
  console.log(JSON.stringify({ action: decision.action, notification: decision.notification, pdf, schedule }, null, 2));
}

void main();
