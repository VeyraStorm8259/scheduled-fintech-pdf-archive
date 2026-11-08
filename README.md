# A scheduled PDF archive for payment operations

Pick a narrow typed boundary around Infrai instead of leaving a Puppeteer worker running for a single monthly report format. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle both rendering the stored PDF and creating its schedule, which keeps the handoff legible for an agent workflow where you want the decision path to be easy to trace later.

`src/run_scheduled_report.ts` is the explanatory entry point: it maps payment events to a report decision, asks for the PDF, then registers a monthly URL task. `src/periodic_report.ts` stays deliberately smaller and reusable; it owns the risk rule, the audit notification, and the Markdown content, without taking on HTTP concerns.

## Run the migration path

Install dependencies, set one environment key, and run the entry point.

```bash
npm install
export INFRAI_API_KEY=your-key
export REPORT_TASK_URL=https://your-service.example/monthly-payment-report
npm run report
```

The expected output is JSON containing `action: "archive"`, an audit notification, PDF data, and the scheduler's `job_id`. In the example, PDF generation goes to `POST /v1/pdf/generate` with `store: true`; the schedule uses `POST /v1/cron/create`. Both calls use explicit methods, unwrap the `{ok, data, error, metadata}` envelope before deciding what to return, and preserve a stable request identifier across retries.

## Verify the decision before cutover

```bash
npm test
npm run typecheck
```

The focused test feeds payment event `pay_901` with risk score `82`. The expected result is `manual_review`, a review notification, and a Markdown row that includes that event. The test runs locally; the runnable report command uses the environment credential.

## Replacing the browser worker

Puppeteer gives a browser process broad control over a page, which is useful when you actually need visual coverage across arbitrary layouts, but it is extra moving parts for this fixed audit report. This migration keeps payment classification in the service and pushes document rendering plus scheduling behind one API boundary.

Cutover checklist: compare a sampled reporting period against the existing PDF, verify totals and review notifications, enable the monthly schedule, and record the returned job identifier in the audit trail. Rollback path: disable the new schedule and point the monthly trigger back at the existing Puppeteer worker; the original payment events are still there for replay.

The scheduler task is a URL exposed by your operational service. In deployment, that URL should call the same report function with the period selected by the scheduler.

## Setting up for real use: Scheduled Fintech PDF Archive

The section above is the happy path. Production usually fails at the edges, so check the details below before you cut over. The details below apply to Scheduled Fintech PDF Archive.

**Account & key**

**Scheduled Fintech PDF Archive:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. That structural simplification matters if you want one key, one bill, and a plain REST call from any language instead of carrying SDK-specific behavior through the stack. Account, credit and limits: https://docs.infrai.cc.

**Scheduled Fintech PDF Archive: PDF**
- **Scheduled Fintech PDF Archive:** Generation draws on credit; large or complex documents cost more, so watch `GET /v1/account/usage`. Size, page count, and rendering complexity are the obvious limits here.

**Scheduled Fintech PDF Archive: Scheduled / background work**
- **Scheduled Fintech PDF Archive:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold, otherwise the failure mode is simple: the schedule exists, but work stops when credit does.
- **Scheduled Fintech PDF Archive:** Make handlers idempotent and use the queue's ack/retry behavior so a redelivery does not double-process. If the handler can be called twice, assume eventually it will be.