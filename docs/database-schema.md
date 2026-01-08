# Database Schema Documentation

## Overview

The WhatsApp Bulk SaaS application uses PostgreSQL with Prisma ORM for database management. The schema is designed to support multi-tenant operations, message tracking, campaign management, and comprehensive audit trails.

## Entity Relationship Diagram

```
┌─────────┐       ┌──────────┐       ┌──────────┐
│  User   │──────<│ Contact  │       │ Template │
│         │       │          │       │          │
└────┬────┘       └────┬─────┘       └────┬─────┘
     │                 │                   │
     │                 │                   │
     │            ┌────┴─────┐             │
     └───────────>│ Campaign │<────────────┘
                  │          │
                  └────┬─────┘
                       │
                  ┌────┴─────┐       ┌──────────────┐
                  │ Message  │──────<│ WebhookEvent │
                  │          │       │              │
                  └──────────┘       └──────────────┘
```

## Tables

### Users

**Purpose**: Multi-tenant user management with WhatsApp Business API credentials.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique user email |
| businessName | String? | Optional business name |
| wabaId | String? | WhatsApp Business Account ID |
| phoneNumberId | String? | WhatsApp Phone Number ID |
| accessToken | String | Encrypted permanent access token |
| webhookVerifyToken | String? | Encrypted webhook verification token |
| subscriptionTier | Enum | free, basic, or pro |
| isActive | Boolean | Account status (default: true) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations**:
- One-to-many with Contacts, Templates, Campaigns, Messages, WebhookEvents

**Indexes**:
- Unique: email

**Security**:
- `accessToken` and `webhookVerifyToken` are encrypted at rest using AES-256-GCM

### Contacts

**Purpose**: Store contact information with opt-in/opt-out tracking for GDPR compliance.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to User |
| phone | String | E.164 format phone number |
| name | String? | Contact name |
| email | String? | Contact email |
| optedIn | Boolean | Opt-in status (default: false) |
| optedInAt | DateTime? | When contact opted in |
| optedOutAt | DateTime? | When contact opted out |
| optInSource | Enum | manual, csv, api, or webhook |
| tags | String[] | Array of tags for segmentation |
| metadata | JSONB | Custom fields and additional data |
| isBlocked | Boolean | Block status (default: false) |
| blockedReason | String? | Reason for blocking |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations**:
- Many-to-one with User
- One-to-many with Messages

**Indexes**:
- userId
- phone
- optedIn
- tags
- Unique constraint: [userId, phone]

**Notes**:
- Phone numbers must be in E.164 format (+[country code][number])
- Tags enable sophisticated contact segmentation
- JSONB metadata allows flexible custom fields

### Templates

**Purpose**: WhatsApp message templates for approved marketing and utility messages.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to User |
| name | String | Template name |
| whatsappTemplateId | String? | Template ID from Meta |
| language | String | Language code (default: en_US) |
| category | Enum | marketing, utility, or authentication |
| status | Enum | draft, pending, approved, or rejected |
| components | JSONB | Header, body, footer, buttons |
| rejectionReason | String? | Reason if rejected by Meta |
| approvedAt | DateTime? | Approval timestamp |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations**:
- Many-to-one with User
- One-to-many with Campaigns

**Indexes**:
- Unique constraint: [userId, name]

**Notes**:
- Templates must be approved by Meta before use
- Components stored as JSONB for flexibility

### Campaigns

**Purpose**: Bulk messaging campaigns to multiple contacts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to User |
| name | String | Campaign name |
| templateId | UUID? | Foreign key to Template (nullable) |
| messageType | Enum | text or template |
| messageContent | JSONB | Message body or template parameters |
| status | Enum | draft, scheduled, processing, completed, failed, paused |
| scheduledAt | DateTime? | Scheduled send time |
| startedAt | DateTime? | When campaign started |
| completedAt | DateTime? | When campaign finished |
| totalRecipients | Integer | Total number of recipients (default: 0) |
| sentCount | Integer | Successfully sent (default: 0) |
| deliveredCount | Integer | Delivered to recipient (default: 0) |
| failedCount | Integer | Failed to send (default: 0) |
| readCount | Integer | Read by recipient (default: 0) |
| errorMessage | String? | Error message if failed |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations**:
- Many-to-one with User
- Many-to-one with Template (nullable)
- One-to-many with Messages

**Indexes**:
- userId
- status
- scheduledAt

**Notes**:
- Stats are updated as messages progress through lifecycle
- Scheduled campaigns are processed by a background job

### Messages

**Purpose**: Individual message tracking for status updates and audit trail.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| campaignId | UUID? | Foreign key to Campaign (nullable) |
| contactId | UUID | Foreign key to Contact |
| userId | UUID | Foreign key to User |
| whatsappMessageId | String? | Message ID from WhatsApp API |
| direction | Enum | outbound or inbound |
| type | Enum | text, template, image, or document |
| content | JSONB | Message content/parameters |
| status | Enum | queued, sent, delivered, read, or failed |
| sentAt | DateTime? | When sent to WhatsApp API |
| deliveredAt | DateTime? | When delivered to recipient |
| readAt | DateTime? | When read by recipient |
| failedAt | DateTime? | When message failed |
| errorCode | String? | Error code if failed |
| errorMessage | String? | Error message if failed |
| retryCount | Integer | Number of retry attempts (default: 0) |
| metadata | JSONB | Additional message data |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations**:
- Many-to-one with Campaign (nullable)
- Many-to-one with Contact
- Many-to-one with User
- One-to-many with WebhookEvents

**Indexes**:
- campaignId
- contactId
- userId
- status
- whatsappMessageId
- Unique: whatsappMessageId

**Notes**:
- Status updates received via webhooks
- Retry logic handles temporary failures
- Inbound messages also tracked for opt-out handling

### WebhookEvents

**Purpose**: Audit trail for all webhook events from WhatsApp API.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID? | Foreign key to User (nullable) |
| eventType | String | Type of event (e.g., 'message_status') |
| payload | JSONB | Full webhook payload |
| messageId | UUID? | Foreign key to Message (nullable) |
| processed | Boolean | Processing status (default: false) |
| processedAt | DateTime? | When event was processed |
| errorMessage | String? | Error if processing failed |
| receivedAt | DateTime | When webhook received (default: now) |
| createdAt | DateTime | Creation timestamp |

**Relations**:
- Many-to-one with User (nullable)
- Many-to-one with Message (nullable)

**Indexes**:
- eventType
- processed
- receivedAt
- messageId

**Notes**:
- Complete webhook payload stored for debugging
- Idempotent processing prevents duplicates
- Failed events can be reprocessed

## Enums

### SubscriptionTier
- `free` - Free tier with limitations
- `basic` - Basic paid tier
- `pro` - Professional tier with full features

### OptInSource
- `manual` - Manually added
- `csv` - Imported from CSV
- `api` - Added via API
- `webhook` - Opted in via WhatsApp message

### TemplateCategory
- `marketing` - Marketing messages
- `utility` - Transactional messages
- `authentication` - OTP and verification

### TemplateStatus
- `draft` - Not yet submitted
- `pending` - Awaiting Meta approval
- `approved` - Approved for use
- `rejected` - Rejected by Meta

### MessageType
- `text` - Plain text message
- `template` - Template message

### CampaignStatus
- `draft` - Being created
- `scheduled` - Scheduled for future
- `processing` - Currently sending
- `completed` - Finished successfully
- `failed` - Failed to complete
- `paused` - Temporarily paused

### MessageDirection
- `outbound` - Sent to customer
- `inbound` - Received from customer

### MessageContentType
- `text` - Text message
- `template` - Template message
- `image` - Image message
- `document` - Document message

### MessageStatus
- `queued` - Waiting to send
- `sent` - Sent to WhatsApp
- `delivered` - Delivered to recipient
- `read` - Read by recipient
- `failed` - Failed to send

## Indexes and Performance

### Why These Indexes?

1. **userId indexes**: Most queries filter by user for multi-tenancy
2. **phone index**: Fast contact lookup by phone number
3. **optedIn index**: Quick filtering of contacts eligible for campaigns
4. **tags index**: Array search for contact segmentation
5. **status indexes**: Filter campaigns/messages by status
6. **whatsappMessageId**: Quick webhook correlation
7. **eventType, processed**: Efficient webhook event processing

### Query Patterns

Common queries are optimized with these indexes:

```sql
-- Find user's opted-in contacts
SELECT * FROM contacts WHERE userId = ? AND optedIn = true;

-- Find scheduled campaigns
SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduledAt <= NOW();

-- Find unprocessed webhook events
SELECT * FROM webhook_events WHERE processed = false ORDER BY receivedAt ASC;

-- Find messages needing retry
SELECT * FROM messages WHERE status = 'failed' AND retryCount < 3;
```

## Migration Strategy

### Development
```bash
npx prisma migrate dev --name <migration_name>
```

### Production
```bash
npx prisma migrate deploy
```

### Rollback
Prisma doesn't support automatic rollbacks. For production:
1. Create a new migration that reverses changes
2. Test thoroughly in staging
3. Deploy the reversal migration

## Connection Pooling

Prisma uses connection pooling by default. Configuration:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public&connection_limit=10"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

Recommended settings:
- **Development**: 5-10 connections
- **Production**: 10-20 connections per instance
- **Serverless**: Use Prisma Data Proxy or pgBouncer

## Backup Strategy

### Automated Backups
1. Enable automated backups on your PostgreSQL provider
2. Keep at least 7 daily backups
3. Monthly archives for compliance

### Manual Backup
```bash
pg_dump -h localhost -U postgres -d whatsapp_bulk_saas > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
psql -h localhost -U postgres -d whatsapp_bulk_saas < backup_20240108.sql
```

## Security Considerations

### Encrypted Fields
- `User.accessToken` - AES-256-GCM encryption
- `User.webhookVerifyToken` - AES-256-GCM encryption

Encryption key stored in environment variable:
```env
ENCRYPTION_KEY=<32-byte-hex-key>
```

Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Access Control
- All queries filtered by `userId` for multi-tenancy
- Contacts enforce unique constraint per user
- Cascade deletes for data cleanup

### PII Handling
- Phone numbers stored in E.164 format
- Email addresses stored as-is
- Custom PII in JSONB `metadata` field
- Consider encryption for metadata if required

## Common Operations

### Create a Campaign
```typescript
const campaign = await campaignRepository.create({
  userId: user.id,
  name: 'Spring Sale',
  templateId: template.id,
  messageType: 'template',
  messageContent: { parameters: ['Customer'] },
  status: 'draft',
  totalRecipients: 100,
});
```

### Update Message Status
```typescript
await messageRepository.updateStatusByWhatsAppMessageId(
  'wamid.12345',
  'delivered'
);
```

### Find Opted-In Contacts
```typescript
const contacts = await contactRepository.findOptedInContacts(userId);
```

## Monitoring and Maintenance

### Health Check
```typescript
import { checkDatabaseHealth } from './utils/dbHealth';

const health = await checkDatabaseHealth();
console.log(health); // { healthy: true, latency: 5, ... }
```

### Cleanup Old Webhook Events
```typescript
// Delete events older than 90 days
await webhookEventRepository.deleteOldEvents(90);
```

### Database Statistics
```sql
-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Future Enhancements

1. **Partitioning**: Partition `messages` and `webhook_events` by date
2. **Archival**: Move old data to archive tables
3. **Read Replicas**: Use read replicas for analytics queries
4. **Full-Text Search**: Add GIN indexes for text search
5. **Materialized Views**: For complex analytics queries

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
