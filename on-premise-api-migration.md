# WhatsApp On-Premise API → Cloud API Migration Guide

> ⚠️ **The On-Premises API was fully sunset on October 23, 2025.** It can no longer send or receive messages. All businesses must migrate to the Cloud API.

---

## Pre-Migration Checklist

Before starting, confirm all of the following:

- [ ] **Verified Meta Business Manager (MBM) account** — your business must be verified.
- [ ] **Meta Developer App** — must be configured for WhatsApp and created under the same Business ID as your source WABA.
- [ ] **App Permissions** — your Meta app must have advanced access approved for:
  - `whatsapp_business_messaging`
  - `whatsapp_business_management`
- [ ] **WABA Review Status** — source WABA must have an approved review status.
- [ ] **Number is connected and registered** — the phone number must be active under On-Premise hosting. Disconnected numbers must be reconnected first.
- [ ] **Low-traffic window scheduled** — plan the migration during off-peak hours to minimize disruption.

---

## Step 1 — Review API Differences

Before migrating, audit your current integration for incompatibilities:

- **Webhooks** — Cloud API webhooks use a different payload format. Update your webhook handler.
- **Media IDs** — media IDs from On-Premise are invalid in Cloud API. You must re-upload all media files after migration.
- **Media codecs** — the following audio formats are **not supported** by Cloud API and must be re-encoded before migrating:
  - `audio/x-hx-aac-adts`
  - `audio/mp4`
- **Authentication** — On-Premise uses username/password; Cloud API uses a Bearer token (System User Token).
- **Base URL** — all API calls will point to `https://graph.facebook.com/v{version}/` instead of your self-hosted host.

---

## Step 2 — Generate Business Phone Number Metadata

Call the On-Premise API to export the metadata for your phone number. This encoded string contains your number's settings and is required for Cloud API registration.

```http
POST https://<your-on-premise-host>/v1/account/migrate
Authorization: Basic <base64(username:password)>
```

**Save the encoded string returned in the `data` field** — you will need it in Step 4.

```json
{
  "users": [
    {
      "token": "<token>",
      "expires_after": "..."
    }
  ],
  "data": "<ENCODED_METADATA_STRING>"
}
```

---

## Step 3 — Deregister the Number from On-Premise

Remove the number from your self-hosted On-Premise instance:

```http
DELETE https://<your-on-premise-host>/v1/account
Authorization: Basic <base64(username:password)>
```

> ⏸️ **The phone number will be temporarily unable to send or receive messages starting from this step.** Downtime is typically around 5 minutes.

---

## Step 4 — Register the Number with Cloud API

Use the Graph API to register the number under Cloud API. Include the metadata from Step 2 and your 2FA PIN.

```http
POST https://graph.facebook.com/{version}/{phone-number-id}/register
Authorization: Bearer <SYSTEM_USER_ACCESS_TOKEN>
Content-Type: application/json
```

```json
{
  "messaging_product": "whatsapp",
  "pin": "<YOUR_6_DIGIT_2FA_PIN>",
  "certificate": "<ENCODED_METADATA_STRING_FROM_STEP_2>"
}
```

**Notes:**
- `{phone-number-id}` — found in your Meta App Dashboard under WhatsApp > Phone Numbers.
- `pin` — your existing 6-digit 2FA PIN, or the new PIN you want to set.
- `certificate` — the encoded metadata string captured in Step 2.

A successful response confirms the number is now registered to Cloud API and deregistered from On-Premise.

---

## Step 5 — Subscribe Webhooks on Cloud API

After registration, you must subscribe your Meta app to Cloud API webhooks for the associated WABA.

### 5a — Configure webhook URL in App Dashboard

1. Go to [Meta for Developers](https://developers.facebook.com) → Your App → **WhatsApp** → **Configuration**.
2. Set your **Webhook URL** and **Verify Token**.
3. Subscribe to the relevant webhook fields (e.g., `messages`, `message_status`).

### 5b — Subscribe app to WABA via API

```http
POST https://graph.facebook.com/{version}/{waba-id}/subscribed_apps
Authorization: Bearer <SYSTEM_USER_ACCESS_TOKEN>
```

> Once this is done, On-Premise webhooks will stop being delivered and Cloud API webhooks will begin.

---

## Step 6 — Verify the Migration

1. Go to [Meta for Developers](https://developers.facebook.com) → Your App → **WhatsApp** → **API Setup**.
2. In the phone number dropdown, confirm your number is listed and its status is **Connected**.
3. Send a test message to verify message delivery is working.
4. Confirm that webhook events are being received at your updated endpoint.

---

## Step 7 — Update Your Integration

Update all references in your application code:

| What Changes         | On-Premise                          | Cloud API                                           |
|----------------------|-------------------------------------|-----------------------------------------------------|
| Base URL             | `https://<your-host>/v1/`           | `https://graph.facebook.com/v{version}/`            |
| Authentication       | Username + Password (Basic Auth)    | System User Bearer Token                            |
| Webhooks             | Self-hosted receiver                | Meta App Dashboard subscription                     |
| Media IDs            | Local IDs (no longer valid)         | Re-upload via Cloud API to generate new IDs         |
| Send Message Path    | `POST /v1/messages`                 | `POST /{phone-number-id}/messages`                  |

---

## Post-Migration Tasks

- [ ] **Re-upload all media files** via the Cloud API `/media` endpoint to generate new valid media IDs.
- [ ] **Re-encode unsupported audio files** to a supported codec before uploading.
- [ ] **Review and resubmit message templates** if any are in a pending or rejected state.
- [ ] **Update API URLs and tokens** across all services and environments (dev, staging, prod).
- [ ] **Monitor webhook delivery** for the first few hours after migration.
- [ ] **Test all message types** — text, image, document, interactive, template messages.

---

## Troubleshooting

| Issue | Resolution |
|---|---|
| Registration fails with `1005` error | Number may still be active on On-Premise. Ensure Step 3 completed successfully. |
| Webhooks not being delivered | Re-subscribe your app to the WABA using the Subscribed Apps endpoint (Step 5b). |
| Media messages failing | Re-upload media files to Cloud API. On-Premise media IDs are not portable. |
| 2FA PIN error | Reset your PIN in WhatsApp Manager: Settings → WhatsApp Accounts → select WABA → reset verification code. |
| Number status stuck as "Pending" | Ensure your display name is approved and two-step verification is enabled in WhatsApp Manager before registering. |

---

## Useful Links

- [Meta Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [On-Premises API Sunset Page](https://developers.facebook.com/docs/whatsapp/on-premises/sunset)
- [WhatsApp Business Manager](https://business.facebook.com/wa/manage/)
- [Meta for Developers — App Dashboard](https://developers.facebook.com/apps/)
- [WhatsApp Business API Status Page](https://metastatus.com/whatsapp-business-api)
- [Cloud API Compliance Center](https://www.facebook.com/business/business-messaging/compliance)

---

*Last updated: May 2026*