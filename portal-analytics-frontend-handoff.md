# Portal Analytics Frontend Integration Handoff

This handoff is for the separate portal frontend team integrating the
business-owner/admin analytics dashboard.

Analytics data is backend-owned. The portal frontend consumes reporting APIs and
renders the metrics exactly as returned. It must not emit analytics events,
derive revenue from operational records, or change API behavior.

The customer app does not consume analytics dashboards. These endpoints are for
business-owner/admin portal use only and must not appear in customer-facing app
navigation, SDK integrations, or public views.

## Authentication And Permissions

All analytics reporting endpoints require a portal-authenticated user.

Current backend enforcement:

- Authentication: portal API authentication through the protected portal stack.
- DRF permissions: `IsAuthenticated` and `BusinessPermission`.
- Required business permission: `reports.view`.

Unauthorized users, customer users, and users without `reports.view` must not
see analytics navigation, dashboard cards, chart data, or error details that
confirm analytics data exists. Treat `401` and `403` as access-denied states,
not as empty analytics data.

## Shared Query Parameters

All endpoints support the same filter set.

| Parameter | Format | Notes |
| --- | --- | --- |
| `date_from` | `YYYY-MM-DD` | Inclusive local start date. Must be on or before `date_to`. |
| `date_to` | `YYYY-MM-DD` | Inclusive local end date. Defaults to the current local date. |
| `source` | string enum | One of `app`, `portal`, `public`, `webhook`, or `system`. |
| `service_id` | integer | Filters events carrying `service_id` or `service_ids`. |
| `product_id` | integer | Filters events carrying `product_id`, `product_ids`, `lines[].product_id`, or `line_items[].product_id`. |
| `staff_id` | integer | Filters events carrying `staff_id` or `staff_ids`. |
| `payment_channel` | string | Filters events carrying `payment_channel` or `channel`. |
| `purpose` | string | Filters events carrying `purpose` or `payment_purpose`. Known values include `booking_deposit` and `commerce_order`. |

Dates are calendar dates, not timestamps. The backend converts `date_from` to
the start of the local day and `date_to` to the end of the local day. Responses
echo the effective dates in `meta.date_from` and `meta.date_to`.

If filters are omitted, the backend uses all matching events in the default date
range. If neither date is supplied, the default range is the last 30 local
calendar days, inclusive. If only `date_to` is supplied, `date_from` defaults to
29 days before it. If only `date_from` is supplied, `date_to` defaults to the
current local date.

If a filter has no matching data, the API returns a valid report with zero
counts, `"0.00"` money values, empty arrays or objects for groupings, and
`null` for metrics that are not safely derivable because the denominator or
underlying event model is unavailable.

Product, service, staff, channel, and purpose filters only work when the
underlying analytics events contain those properties. Older or incomplete event
history may not support every filter.

## Shared Response Rules

Every response includes endpoint-specific metrics plus a `meta` object:

```json
{
  "meta": {
    "date_from": "2026-06-10",
    "date_to": "2026-07-09",
    "default_date_range_days": 30,
    "filters": {
      "source": null,
      "service_id": null,
      "product_id": null,
      "staff_id": null,
      "payment_channel": null,
      "purpose": null
    },
    "definitions": {},
    "skipped_metrics": {}
  }
}
```

Frontend interpretation rules:

- Revenue is calculated from `payment_succeeded.amount` only.
- Do not sum order totals or appointment totals as revenue unless the backend
  explicitly provides that value.
- Operational events are counts, not direct revenue.
- `null` means not safely derivable. Do not display it as zero.
- `0` or `"0.00"` means the backend safely calculated zero.
- Percentages are returned by the backend as percentage strings, such as
  `"93.33"`. Display them as percentages, but do not recompute them.
- Money values are decimal strings. Avoid frontend floating point arithmetic for
  totals.
- Some metrics may be incomplete until more event history is collected.
- Waitlist recovered revenue currently returns `null` because successful payment
  events do not yet identify waitlist-origin payments.

## Endpoint Integration Details

### GET /api/portal/v1/analytics/overview/

Purpose: high-level business dashboard summary across revenue, payments,
bookings, commerce operations, waitlist movement, and notifications.

Query params: supports all shared query parameters. Most first-version
dashboards should start with `date_from`, `date_to`, and optional `source`.

Default date range: last 30 local calendar days, inclusive.

Example request:

```http
GET /api/portal/v1/analytics/overview/?date_from=2026-06-10&date_to=2026-07-09
Authorization: Bearer <portal-access-token>
```

Example response:

```json
{
  "gross_revenue": "12500.00",
  "booking_revenue": "2500.00",
  "commerce_revenue": "10000.00",
  "successful_payment_count": 42,
  "failed_payment_count": 3,
  "payment_success_rate": "93.33",
  "booking_created_count": 18,
  "appointment_completed_count": 12,
  "appointment_cancelled_count": 2,
  "appointment_no_show_count": 1,
  "order_confirmed_count": 24,
  "order_dispatched_count": 20,
  "waitlist_promoted_count": 4,
  "waitlist_recovered_revenue": null,
  "notification_sent_count": 15,
  "notification_read_count": 11,
  "meta": {
    "date_from": "2026-06-10",
    "date_to": "2026-07-09",
    "default_date_range_days": 30,
    "filters": {
      "source": null,
      "service_id": null,
      "product_id": null,
      "staff_id": null,
      "payment_channel": null,
      "purpose": null
    },
    "definitions": {
      "gross_revenue": "Sum of payment_succeeded.amount in the selected range.",
      "booking_revenue": "Sum of payment_succeeded.amount where purpose is booking_deposit.",
      "commerce_revenue": "Sum of payment_succeeded.amount where purpose is commerce_order.",
      "payment_success_rate": "successful_payment_count / (successful_payment_count + failed_payment_count) * 100.",
      "operational_counts": "Counts are based on matching AnalyticsEvent event_name values."
    },
    "skipped_metrics": {
      "waitlist_recovered_revenue": "Existing payment_succeeded events do not identify whether a payment came from a promoted waitlist hold."
    }
  }
}
```

Loading state recommendation: use skeleton cards for the summary metrics and
keep the previous loaded date-range label visible only if the UI clearly marks
the data as refreshing.

Empty state recommendation: show zero-valued cards for safely calculated counts
and money totals. Show "Not available" for `waitlist_recovered_revenue` and any
rate returned as `null`.

Error state recommendation: show a dashboard-level error with retry for `5xx` or
network failures. For `401` or `403`, hide analytics content and route to the
portal access-denied pattern.

Frontend display notes: use this endpoint for top KPI cards. Do not use it to
build detailed charts beyond compact summary trends, because it does not return
time-series data.

### GET /api/portal/v1/analytics/revenue/

Purpose: revenue-focused aggregates and breakdowns by day, source, payment
purpose, and payment channel.

Query params: supports all shared query parameters. `purpose`,
`payment_channel`, and `source` are most relevant.

Default date range: last 30 local calendar days, inclusive.

Example request:

```http
GET /api/portal/v1/analytics/revenue/?date_from=2026-06-10&date_to=2026-07-09&purpose=commerce_order
Authorization: Bearer <portal-access-token>
```

Example response:

```json
{
  "total_revenue": "10000.00",
  "revenue_by_day": [
    {
      "date": "2026-07-08",
      "revenue": "4200.00"
    },
    {
      "date": "2026-07-09",
      "revenue": "5800.00"
    }
  ],
  "revenue_by_source": {
    "app": "6000.00",
    "webhook": "4000.00"
  },
  "revenue_by_purpose": {
    "commerce_order": "10000.00"
  },
  "revenue_by_payment_channel": {
    "card": "8500.00",
    "mobile_money": "1500.00"
  },
  "average_order_value": "416.67",
  "average_booking_value": "0.00",
  "failed_payment_value": "700.00",
  "expired_checkout_value": "300.00",
  "meta": {
    "date_from": "2026-06-10",
    "date_to": "2026-07-09",
    "default_date_range_days": 30,
    "filters": {
      "source": null,
      "service_id": null,
      "product_id": null,
      "staff_id": null,
      "payment_channel": null,
      "purpose": "commerce_order"
    },
    "definitions": {
      "total_revenue": "Sum of payment_succeeded.amount only; order and appointment events are not revenue inputs.",
      "revenue_by_day": "Daily sum of payment_succeeded.amount grouped by event created_at local date.",
      "average_order_value": "Commerce payment revenue divided by successful commerce payment count.",
      "average_booking_value": "Booking deposit revenue divided by successful booking payment count.",
      "failed_payment_value": "Sum of payment_failed.amount.",
      "expired_checkout_value": "Sum of checkout_expired.amount when checkout events include an amount."
    },
    "skipped_metrics": {}
  }
}
```

Loading state recommendation: render chart and table skeletons separately so KPI
cards can load independently if the UI calls endpoints in parallel.

Empty state recommendation: if `revenue_by_day` is empty, show an empty chart
message for the selected period. Do not synthesize revenue from order totals.

Error state recommendation: show a retryable revenue-panel error. Keep other
dashboard sections visible if their endpoint calls succeed.

Frontend display notes: the API returns only days with revenue. If a continuous
chart axis is needed, the frontend may fill missing dates as display-only zero
points while preserving backend totals exactly.

### GET /api/portal/v1/analytics/bookings/

Purpose: booking and appointment operations, booking deposit revenue, waitlist
counts, and grouping by service and staff.

Query params: supports all shared query parameters. `service_id`, `staff_id`,
and `purpose=booking_deposit` are most relevant.

Default date range: last 30 local calendar days, inclusive.

Example request:

```http
GET /api/portal/v1/analytics/bookings/?date_from=2026-06-10&date_to=2026-07-09&staff_id=7
Authorization: Bearer <portal-access-token>
```

Example response:

```json
{
  "bookings_created": 18,
  "appointments_completed": 12,
  "appointments_cancelled": 2,
  "appointments_rescheduled": 3,
  "appointments_no_show": 1,
  "completion_rate": "66.67",
  "cancellation_rate": "11.11",
  "no_show_rate": "5.56",
  "bookings_by_service": [
    {
      "service_id": 3,
      "count": 9
    }
  ],
  "bookings_by_staff": [
    {
      "staff_id": 7,
      "count": 14
    }
  ],
  "booking_revenue": "2500.00",
  "deposit_revenue": "2500.00",
  "waitlist_created": 5,
  "waitlist_promoted": 4,
  "waitlist_hold_expired": 1,
  "meta": {
    "date_from": "2026-06-10",
    "date_to": "2026-07-09",
    "default_date_range_days": 30,
    "filters": {
      "source": null,
      "service_id": null,
      "product_id": null,
      "staff_id": 7,
      "payment_channel": null,
      "purpose": null
    },
    "definitions": {
      "booking_revenue": "Sum of payment_succeeded.amount where purpose is booking_deposit.",
      "deposit_revenue": "Same as booking_revenue for Phase 1C-lite because booking payments are deposit payments.",
      "rates": "Outcome count divided by bookings_created, expressed as a percentage.",
      "bookings_by_service": "booking_created events grouped by service_ids/service_id properties.",
      "bookings_by_staff": "booking_created events grouped by staff_ids/staff_id properties."
    },
    "skipped_metrics": {}
  }
}
```

Loading state recommendation: show placeholder cards for counts and placeholder
rows for service/staff breakdowns.

Empty state recommendation: show "No booking activity for this period" when all
booking counts are zero. Show rates returned as `null` as "Not available".

Error state recommendation: isolate failures to the booking section when other
endpoint calls succeed.

Frontend display notes: booking revenue and booking operations come from
different event types. Do not assume every booking has a matching successful
payment. `booking_revenue` and `deposit_revenue` are currently equivalent.

### GET /api/portal/v1/analytics/commerce/

Purpose: commerce cart, checkout, confirmed order, dispatched order, revenue,
product quantity, shipping address, and expired checkout metrics.

Query params: supports all shared query parameters. `product_id`,
`purpose=commerce_order`, and `payment_channel` are most relevant.

Default date range: last 30 local calendar days, inclusive.

Example request:

```http
GET /api/portal/v1/analytics/commerce/?date_from=2026-06-10&date_to=2026-07-09&product_id=21
Authorization: Bearer <portal-access-token>
```

Example response:

```json
{
  "cart_item_added_count": 40,
  "cart_item_removed_count": 6,
  "checkout_started_count": 28,
  "order_confirmed_count": 24,
  "order_dispatched_count": 20,
  "checkout_to_order_conversion_rate": "85.71",
  "commerce_revenue": "10000.00",
  "average_order_value": "416.67",
  "top_products_by_quantity": [
    {
      "product_id": 21,
      "quantity": 15
    }
  ],
  "shipping_address_set_count": 25,
  "checkout_expired_count": 2,
  "meta": {
    "date_from": "2026-06-10",
    "date_to": "2026-07-09",
    "default_date_range_days": 30,
    "filters": {
      "source": null,
      "service_id": null,
      "product_id": 21,
      "staff_id": null,
      "payment_channel": null,
      "purpose": null
    },
    "definitions": {
      "commerce_revenue": "Sum of payment_succeeded.amount where purpose is commerce_order.",
      "checkout_to_order_conversion_rate": "order_confirmed_count / checkout_started_count * 100.",
      "top_products_by_quantity": "cart_item_added quantities grouped by product_id; confirmed order events do not store line items."
    },
    "skipped_metrics": {}
  }
}
```

Loading state recommendation: use chart placeholders for product quantity and
compact card placeholders for funnel counts.

Empty state recommendation: show "No commerce activity for this period" when
cart, checkout, and order counts are all zero.

Error state recommendation: show a section-level retry. Do not replace commerce
errors with zero metrics.

Frontend display notes: `top_products_by_quantity` is based on cart item
additions, not confirmed order line items. Confirmed order events currently do
not store line items. `commerce_revenue` is payment-based.

### GET /api/portal/v1/analytics/payments/

Purpose: payment funnel, success/failure rates, successful and failed payment
values, failure reason buckets, provider/channel breakdowns, and webhook
processing health.

Query params: supports all shared query parameters. `source`,
`payment_channel`, and `purpose` are most relevant.

Default date range: last 30 local calendar days, inclusive.

Example request:

```http
GET /api/portal/v1/analytics/payments/?date_from=2026-06-10&date_to=2026-07-09&payment_channel=card
Authorization: Bearer <portal-access-token>
```

Example response:

```json
{
  "payment_started_count": 45,
  "payment_succeeded_count": 42,
  "payment_failed_count": 3,
  "payment_success_rate": "93.33",
  "payment_failure_rate": "6.67",
  "successful_payment_value": "12500.00",
  "failed_payment_value": "700.00",
  "failures_by_reason_bucket": {
    "insufficient_funds": 2,
    "unknown": 1
  },
  "payments_by_provider": {
    "paystack": 90
  },
  "payments_by_channel": {
    "card": 90
  },
  "webhook_received_count": 43,
  "webhook_processed_count": 43,
  "webhook_processing_success_rate": "100.00",
  "meta": {
    "date_from": "2026-06-10",
    "date_to": "2026-07-09",
    "default_date_range_days": 30,
    "filters": {
      "source": null,
      "service_id": null,
      "product_id": null,
      "staff_id": null,
      "payment_channel": "card",
      "purpose": null
    },
    "definitions": {
      "payment_success_rate": "payment_succeeded_count / (payment_succeeded_count + payment_failed_count) * 100.",
      "payment_failure_rate": "payment_failed_count / (payment_succeeded_count + payment_failed_count) * 100.",
      "successful_payment_value": "Sum of payment_succeeded.amount.",
      "failed_payment_value": "Sum of payment_failed.amount.",
      "webhook_processing_success_rate": "Processed webhook events with status=processed divided by all payment_webhook_processed events."
    },
    "skipped_metrics": {}
  }
}
```

Loading state recommendation: show payment KPI skeletons and defer breakdown
tables until data loads.

Empty state recommendation: show zero counts and values where returned. Show
payment and webhook rates returned as `null` as "Not available".

Error state recommendation: for payment reporting failures, avoid displaying
stale financial totals without a visible stale-data indicator.

Frontend display notes: `payments_by_provider` counts started, succeeded, and
failed payment events together. It is an event count, not a unique payment
intent count.

## Metric Definitions

- Gross revenue: total successful payment amount across purposes.
- Booking revenue: successful payment amount where payment purpose is
  `booking_deposit`.
- Commerce revenue: successful payment amount where payment purpose is
  `commerce_order`.
- Payment success rate: successful payments divided by successful plus failed
  payments.
- Payment failure rate: failed payments divided by successful plus failed
  payments.
- Failed payment value: total amount attached to failed payment events.
- Booking created count: number of bookings created in analytics events.
- Appointment completed count: number of completed appointment events.
- Cancellation count: number of booking cancellation events.
- No-show count: number of appointment no-show events.
- Checkout started count: number of checkout-started events.
- Checkout-to-order conversion rate: confirmed orders divided by started
  checkouts.
- Order confirmed count: number of confirmed order events.
- Order dispatched count: number of dispatched order events.
- Notification sent count: number of notification sent events.
- Notification read count: number of notification read events.

## Suggested First Dashboard Layout

Section 1: Revenue Summary

- Total revenue
- Booking revenue
- Commerce revenue
- Successful payments
- Failed payments
- Payment success rate

Section 2: Booking Performance

- Bookings created
- Appointments completed
- Cancellations
- No-shows
- Reschedules
- Completion rate

Section 3: Commerce Performance

- Checkout started
- Orders confirmed
- Orders dispatched
- Checkout-to-order conversion rate
- Average order value

Section 4: Payment Performance

- Payment started
- Payment succeeded
- Payment failed
- Failed payment value
- Failure reason buckets
- Payment channel breakdown

Section 5: Engagement Snapshot

- Notifications sent
- Notifications read
- Notification read rate

Notification read rate is not currently returned as a named backend field. If
product wants it in the first version, confirm whether the backend should add an
explicit metric or whether the frontend may derive it from sent/read counts.

## What Not To Build Yet

Do not build these surfaces until backend/product explicitly expands the metric
contract:

- Customer-facing analytics.
- Developer or system monitoring dashboard.
- Profitability dashboard.
- Customer lifetime value dashboard.
- Deep cohort retention dashboard.
- Advanced charting that requires unavailable metrics.
- Waitlist recovered revenue cards unless the backend returns a real value.

## QA Checklist

- Unauthenticated users cannot access analytics endpoints or dashboard UI.
- Customer users cannot access analytics endpoints or dashboard UI.
- Business-owner/admin users with `reports.view` can access analytics.
- Users without `reports.view` cannot access analytics.
- `date_from` and `date_to` filters work and the UI shows the effective range
  from `meta`.
- `source` filter works for supported source values.
- Empty data displays correctly without fake revenue.
- `null` values are not shown as zero.
- Revenue totals match the backend response exactly.
- Percentages are not recalculated incorrectly on the frontend.
- Loading states are handled for each section.
- Error states are handled for `401`, `403`, validation errors, network errors,
  and `5xx` responses.
- No PII is displayed.

## Open Questions For Frontend And Product

- Which roles should see analytics?
- Should revenue be visible to all admins or only owner-level admins?
- What date presets should the UI offer?
- Should dashboard cards be exportable?
- Should metrics compare current period vs previous period?
- Should charts be daily, weekly, or monthly?
- Should notification read rate be backend-provided before it appears in the
  first dashboard?

## Backend Inconsistencies Or Integration Notes Discovered

- `waitlist_recovered_revenue` is intentionally `null` because successful
  payment events do not identify waitlist-origin payments.
- Notification read rate is requested for the suggested dashboard layout but is
  not currently returned as a dedicated metric. The available fields are
  `notification_sent_count` and `notification_read_count`.
- Product/service/staff/channel filters are property-dependent, so results may
  be incomplete for older events that do not carry those properties.
- Revenue and operational counts are intentionally separate event models.
