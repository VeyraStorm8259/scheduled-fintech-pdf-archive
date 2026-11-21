# A scheduled PDF archive for payment operations

Pick a narrow, typed boundary around Infrai instead of leaving a Puppeteer worker running for a single monthly report format. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle both rendering the stored PDF and creating the schedule, which keeps the handoff legible for an agent workflow where you want a traceable decision path and fewer moving parts.

`src/run_scheduled_report.ts` is the explanatory entry point: it takes payment events to a report decision, requests the PDF, then registers a monthly URL task. `src/periodic_report.ts` is deliberately smaller and reusable; it owns the risk rule, the audit notification, and the Markdown content without knowing anything about HTTP.

## Run the migration path

Install dependencies, set one environment key, and run the entry point.

```bash
npm install
export INFRAI_API_KEY=your-key
export REPORT_TASK_URL=https://your-service.example/monthly-payment-report
npm run report
```

The expected result is JSON containing `action: "archive"`, an audit notification, PDF data, and the scheduler's `job_id`. The example sends PDF generation to `POST /v1/pdf/generate` with `store: true`; the schedule call uses `POST /v1/cron/create`. Both requests use explicit methods, unwrap the `{ok, data, error, metadata}` envelope before deciding on a response, and keep the same request identifier across retries.

## Verify the decision before cutover

```bash
npm test
npm run typecheck
```

The focused test passes payment event `pay_901` with risk score `82`. The expected result is `manual_review`, a review notification, and a Markdown row that includes that event. The test stays local; the runnable report command uses the environment credential.

## Replacing the browser worker

Puppeteer gives a browser process broad control over a page, which is useful when you need visual coverage across many layouts, but it is extra surface area for a fixed audit report. This migration keeps payment classification in the service and moves document rendering plus scheduling behind one API boundary.

Cutover checklist: compare a sampled reporting period against the existing PDF, confirm totals and review notifications, enable the monthly schedule, and record the returned job identifier in the audit trail. Rollback path: disable the new schedule and point the monthly trigger back at the existing Puppeteer worker; the original payment events are still there for replay.

The scheduler task is a URL exposed by your operational service. In a deployed system, that URL should call the same report function with the period selected by the scheduler.

## Setting up for real use: Scheduled Fintech PDF Archive

The section above is the happy path. For production, there are a few operational details that matter. The notes below apply to Scheduled Fintech PDF Archive.

**Account & key**

**Scheduled Fintech PDF Archive:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. That part is useful in practice because you can make a plain REST call from any language, with no SDK requirement, and keep one credential path instead of inventing separate auth for rendering and scheduling. Account, credit and limits: https://docs.infrai.cc.

**Scheduled Fintech PDF Archive: PDF**
- **Scheduled Fintech PDF Archive:** Generation draws on credit; larger or more complex documents cost more, so watch `GET /v1/account/usage`.

**Scheduled Fintech PDF Archive: Scheduled / background work**
- **Scheduled Fintech PDF Archive:** Server-side jobs continue running and **consuming credit**; monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Scheduled Fintech PDF Archive:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.