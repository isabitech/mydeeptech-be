# Marketing Module Handoff

## What Changed

- A new admin-only `Marketing` module now exists for bulk email campaigns.
- Frontend can now:
  - preview a campaign audience before sending
  - send a bulk campaign to either DTUsers or custom email addresses
  - fetch campaign history
  - fetch a single campaign with recipient-level delivery results
- Campaigns are stored in a dedicated `MarketingCampaign` collection.

## Base Route

- `/api/admin/marketing`

## Access Rule

- Admin token required.
- All routes are protected by `authenticateAdmin`.

## Campaign Lifecycle

1. Frontend builds campaign content and audience.
2. Frontend can call `POST /campaigns/preview` to estimate recipients before send.
3. Frontend sends the campaign with `POST /campaigns/send`.
4. Backend immediately creates the campaign with status `queued`.
5. Backend processes the campaign in batches in-process and updates status:
   - `queued`
   - `sending`
   - `completed`
   - `completed_with_errors`
   - `failed`
6. Frontend can poll:
   - `GET /campaigns`
   - `GET /campaigns/:campaignId`
7. If some recipients fail, frontend can re-queue the failed recipients with:
   - `POST /campaigns/:campaignId/retry`

## Audience Types

### `dtusers`

Use this when frontend wants backend to resolve recipients from the DTUser database.

Supported filters:

- `verifiedOnly`
- `dtUserIds`
- `filters.annotatorStatus`
- `filters.microTaskerStatus`
- `filters.qaStatus`
- `filters.country`

Allowed values:

- `annotatorStatus`: `pending | submitted | verified | approved | rejected`
- `microTaskerStatus`: `pending | submitted | verified | approved | rejected`
- `qaStatus`: `pending | approved | rejected`
- `country`:
  - `all` = do not filter by country
  - `unknown` = users with no country on profile
  - any specific country name like `Nigeria`, `Ghana`, `Kenya`

Country source of truth:

- backend filters against `DTUser.personal_info.country`
- `unknown` matches:
  - missing country field
  - `null`
  - empty string
  - whitespace-only values

### `custom_emails`

Use this when frontend already has the recipient list.

`audience.customRecipients` accepts:

- plain email strings
- objects like:

```json
{
  "email": "user@example.com",
  "fullName": "User Name"
}
```

Backend deduplicates by email automatically.

## Delivery Provider

Marketing campaigns use `Mailjet` only.

Allowed `delivery.provider` value:

- `mailjet`

Notes:

- Frontend can omit `delivery.provider` and the backend will still use Mailjet.
- Frontend should not expose Brevo or a provider toggle for Marketing campaigns.
- Backend attaches Mailjet campaign metadata per marketing send so failed recipients can be retried against the same campaign context.

## Personalization Tokens

Backend replaces these automatically per recipient:

- `FIRST_NAME`
- `FULL_NAME`
- `EMAIL`
- `{{firstName}}`
- `{{fullName}}`
- `{{email}}`

`firstName` is derived from the recipient full name, or from the email prefix if full name is missing.

## Endpoints

### Get Country Options For Audience Filter

- `GET /api/admin/marketing/audience/countries`

Optional query:

- `verifiedOnly=true|false`
- `annotatorStatus=pending|submitted|verified|approved|rejected|all`
- `microTaskerStatus=pending|submitted|verified|approved|rejected|all`
- `qaStatus=pending|approved|rejected|all`

Purpose:

- lets frontend populate the country dropdown for the `dtusers` audience filter
- returns special options first:
  - `all`
  - `unknown`
  - then real country names sorted alphabetically

Example request:

```http
GET /api/admin/marketing/audience/countries?verifiedOnly=true&microTaskerStatus=approved
```

Success response:

```json
{
  "success": true,
  "message": "Marketing country options retrieved successfully",
  "data": {
    "options": [
      {
        "value": "all",
        "label": "All Countries",
        "count": 120
      },
      {
        "value": "unknown",
        "label": "No Country On Profile",
        "count": 8
      },
      {
        "value": "Ghana",
        "label": "Ghana",
        "count": 12
      },
      {
        "value": "Nigeria",
        "label": "Nigeria",
        "count": 54
      }
    ],
    "appliedFilters": {
      "verifiedOnly": true,
      "annotatorStatus": "",
      "microTaskerStatus": "approved",
      "qaStatus": ""
    }
  }
}
```

Notes:

- `count` is the number of DTUsers matching each option under the current query filters.
- Frontend can call this on page load and again whenever the other audience filters change.

### Preview Audience

- `POST /api/admin/marketing/campaigns/preview`

Body example for `dtusers`:

```json
{
  "audience": {
    "type": "dtusers",
    "verifiedOnly": true,
    "filters": {
      "microTaskerStatus": "approved",
      "qaStatus": "approved",
      "country": "Nigeria"
    }
  }
}
```

Body example for `custom_emails`:

```json
{
  "audience": {
    "type": "custom_emails",
    "customRecipients": [
      "first@example.com",
      {
        "email": "second@example.com",
        "fullName": "Second User"
      }
    ]
  }
}
```

Success response:

```json
{
  "success": true,
  "message": "Marketing audience preview generated successfully",
  "data": {
    "totalRecipients": 2,
    "sampleRecipients": [
      {
        "dtUserId": null,
        "email": "first@example.com",
        "fullName": "",
        "firstName": "first"
      },
      {
        "dtUserId": null,
        "email": "second@example.com",
        "fullName": "Second User",
        "firstName": "Second"
      }
    ]
  }
}
```

Notes:

- `sampleRecipients` is capped at 10.
- Preview does not create a campaign.

### Send Campaign

- `POST /api/admin/marketing/campaigns/send`

Minimum requirements:

- `name`
- `subject`
- either `htmlContent` or `textContent`
- `audience`

Example payload:

```json
{
  "name": "MicroTasks Launch",
  "subject": "Start Earning with MyDeepTech",
  "textContent": "Hello FIRST_NAME,\n\nNew AI microtasks are now available on your dashboard.",
  "sender": {
    "email": "support@mydeeptech.ng",
    "name": "MyDeepTech Team"
  },
  "audience": {
    "type": "dtusers",
    "verifiedOnly": true,
    "filters": {
      "microTaskerStatus": "approved",
      "country": "all"
    }
  },
  "delivery": {
    "provider": "mailjet",
    "batchSize": 50,
    "delayBetweenBatchesMs": 1000
  }
}
```

If frontend only sends `textContent`:

- backend generates a basic HTML wrapper automatically

If frontend only sends `htmlContent`:

- backend generates a text fallback by stripping the HTML

Success response:

```json
{
  "success": true,
  "message": "Marketing campaign created and queued for delivery",
  "data": {
    "id": "6825f4a5f2d0fc1c9d8b1234",
    "name": "MicroTasks Launch",
    "subject": "Start Earning with MyDeepTech",
    "sender": {
      "email": "support@mydeeptech.ng",
      "name": "MyDeepTech Team"
    },
    "audience": {
      "type": "dtusers",
      "verifiedOnly": true,
      "dtUserIds": [],
      "filters": {
        "annotatorStatus": "",
        "microTaskerStatus": "approved",
        "qaStatus": "",
        "country": "all"
      },
      "requestedRecipientCount": 120
    },
    "delivery": {
      "provider": "mailjet",
      "batchSize": 50,
      "delayBetweenBatchesMs": 1000
    },
    "status": "queued",
    "totalRecipients": 120,
    "sentCount": 0,
    "failedCount": 0,
    "createdBy": {
      "id": "681111111111111111111111"
    },
    "createdAt": "2026-05-15T10:00:00.000Z",
    "updatedAt": "2026-05-15T10:00:00.000Z",
    "startedAt": null,
    "completedAt": null,
    "lastError": "",
    "sampleRecipients": [
      {
        "dtUserId": "680000000000000000000001",
        "email": "user@example.com",
        "fullName": "Example User",
        "firstName": "Example",
        "status": "pending",
        "deliveryProvider": "mailjet",
        "providerMessageId": "",
        "errorMessage": "",
        "lastAttemptAt": null,
        "sentAt": null
      }
    ]
  }
}
```

Notes:

- Response status is `202`.
- Campaign sending continues after the response returns.

### Get Campaign List

- `GET /api/admin/marketing/campaigns`

Optional query:

- `page`
- `limit`
- `status`

Allowed `status` filter values:

- `draft`
- `queued`
- `sending`
- `completed`
- `completed_with_errors`
- `failed`

Success response shape:

```json
{
  "success": true,
  "message": "Marketing campaigns retrieved successfully",
  "data": {
    "campaigns": [
      {
        "id": "6825f4a5f2d0fc1c9d8b1234",
        "name": "MicroTasks Launch",
        "subject": "Start Earning with MyDeepTech",
        "sender": {
          "email": "support@mydeeptech.ng",
          "name": "MyDeepTech Team"
        },
        "audience": {
          "type": "dtusers",
          "verifiedOnly": true,
          "dtUserIds": [],
          "filters": {
            "annotatorStatus": "",
            "microTaskerStatus": "approved",
            "qaStatus": "",
            "country": "all"
          },
          "requestedRecipientCount": 120
        },
        "delivery": {
          "provider": "mailjet",
          "batchSize": 50,
          "delayBetweenBatchesMs": 1000
        },
        "status": "sending",
        "totalRecipients": 120,
        "sentCount": 35,
        "failedCount": 2,
        "createdBy": {
          "id": "681111111111111111111111",
          "fullName": "Admin User",
          "email": "admin@mydeeptech.ng"
        },
        "createdAt": "2026-05-15T10:00:00.000Z",
        "updatedAt": "2026-05-15T10:05:00.000Z",
        "startedAt": "2026-05-15T10:00:02.000Z",
        "completedAt": null,
        "lastError": "Error sending email via MAIL_JET: ..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

### Get Campaign Detail

- `GET /api/admin/marketing/campaigns/:campaignId`

Success response highlights:

- all campaign summary fields
- `htmlContent`
- `textContent`
- full `recipients` array

Recipient shape:

```json
{
  "dtUserId": "680000000000000000000001",
  "email": "user@example.com",
  "fullName": "Example User",
  "firstName": "Example",
  "status": "sent",
  "deliveryProvider": "mailjet",
  "providerMessageId": "617136dd-5467-4357-ba8b-fba4cae069e0",
  "errorMessage": "",
  "lastAttemptAt": "2026-05-15T10:00:05.000Z",
  "sentAt": "2026-05-15T10:00:06.000Z"
}
```

Recipient status values:

- `pending`
- `sent`
- `failed`
- `skipped`

### Retry Failed Deliveries

- `POST /api/admin/marketing/campaigns/:campaignId/retry`

Purpose:

- re-queue failed recipients from an existing campaign
- useful for transient delivery errors like Mailjet connection resets

Body:

- empty body to retry all failed recipients
- optional `recipientEmails` array to retry only specific failed recipients

Example request:

```json
{
  "recipientEmails": ["user@example.com", "second@example.com"]
}
```

Success response:

```json
{
  "success": true,
  "message": "Marketing campaign retry queued successfully",
  "data": {
    "retriedRecipientCount": 2,
    "campaign": {
      "id": "6825f4a5f2d0fc1c9d8b1234",
      "name": "MicroTasks Launch",
      "subject": "Start Earning with MyDeepTech",
      "sender": {
        "email": "support@mydeeptech.ng",
        "name": "MyDeepTech Team"
      },
      "audience": {
        "type": "dtusers",
        "verifiedOnly": true,
        "dtUserIds": [],
        "filters": {
          "annotatorStatus": "",
          "microTaskerStatus": "approved",
          "qaStatus": "",
          "country": "all"
        },
        "requestedRecipientCount": 120
      },
      "delivery": {
        "provider": "mailjet",
        "batchSize": 50,
        "delayBetweenBatchesMs": 1000
      },
      "status": "queued",
      "totalRecipients": 120,
      "sentCount": 118,
      "failedCount": 0,
      "createdBy": {
        "id": "681111111111111111111111"
      },
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:06:00.000Z",
      "startedAt": "2026-05-15T10:00:02.000Z",
      "completedAt": null,
      "lastError": "",
      "sampleRecipients": [
        {
          "dtUserId": "680000000000000000000001",
          "email": "user@example.com",
          "fullName": "Example User",
          "firstName": "Example",
          "status": "pending",
          "deliveryProvider": "mailjet",
          "providerMessageId": "",
          "errorMessage": "",
          "lastAttemptAt": "2026-05-15T10:05:06.000Z",
          "sentAt": null
        }
      ]
    }
  }
}
```

Validation and behavior notes:

- Returns `404` if the campaign does not exist.
- Returns `409` if the campaign is currently in `sending` state.
- Returns `400` if there are no failed recipients to retry.
- Retry response status is `202`.
- After retry is queued, frontend should resume polling campaign detail until the status settles again.

## Recommended Frontend Flow

1. Build campaign form.
2. Let admin choose:
   - `dtusers` audience
   - or `custom_emails`
3. If audience type is `dtusers`, call `GET /audience/countries` to populate the country dropdown.
4. Call preview before enabling final send.
5. Show:
   - `totalRecipients`
   - the first 10 sample recipients
6. On send, redirect to campaign detail or history page.
7. Poll campaign detail every 2 to 5 seconds while status is:
   - `queued`
   - `sending`
8. Stop polling when status becomes:
   - `completed`
   - `completed_with_errors`
   - `failed`
9. If status is `completed_with_errors` or `failed`, show a retry action for all failed recipients or selected failed recipient emails.

## Suggested UI Sections

### Campaign Composer

- campaign name
- subject
- sender email
- sender name
- rich HTML editor or plain text editor
- provider selector
- batch size
- delay between batches

### Audience Builder

- audience type selector:
  - `dtusers`
  - `custom_emails`
- for `dtusers`:
  - verified only toggle
  - optional status filters
  - country filter:
    - `all`
    - `unknown`
    - specific country names
  - optional manual DTUser picker
- for `custom_emails`:
  - email textarea or CSV paste
  - optional full name per recipient if UI supports it

### Campaign History

- name
- subject
- status
- total recipients
- sent count
- failed count
- created by
- created at
- started at
- completed at

### Campaign Detail

- campaign summary
- raw subject and content preview
- recipient table
- filter failed recipients on frontend if needed

## Current Limitations

- No edit campaign endpoint yet.
- No delete campaign endpoint yet.
- No schedule-for-later feature yet.
- No cancel-in-progress endpoint yet.
- `GET /campaigns/:campaignId` returns the full recipients array with no recipient pagination yet.
- Campaign processing currently runs in-process on the backend server, not through a durable queue worker.

## Important Frontend Notes

- Treat `POST /campaigns/send` as queueing a job, not as delivery completion.
- Frontend should not assume `sentCount` is final right after send.
- For very large campaigns, prefer the list page plus detail polling instead of holding everything in one form state.
- If the backend returns `completed_with_errors`, show both the summary counts and the failed recipients list from the detail endpoint.
