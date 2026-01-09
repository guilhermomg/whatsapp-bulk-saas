# whatsapp-bulk-saas

WhatsApp bulk messaging micro SaaS with compliant Cloud API integration. Node.js backend with queue management, template handling, and opt-in validation for spam-safe multi-contact messaging.

## Features

- 🚀 Production-ready Node.js backend with Express
- 💙 TypeScript for type safety and better developer experience
- 📱 **WhatsApp Cloud API Integration** with official Meta Business API
- 🔄 Retry logic with exponential backoff for robust messaging
- 🔐 Webhook signature verification for secure event handling
- 📨 Support for text and template messages
- 🏗️ Clean architecture with separation of concerns
- 🔒 Security best practices (Helmet, CORS)
- 📝 Comprehensive logging with Winston
- 📚 API documentation with Swagger
- ✅ Testing setup with Jest and Supertest (21 tests passing)
- 🔄 Auto-reload development with Nodemon
- 🎨 Code quality with ESLint and Prettier
- 🏥 Health check endpoint

## Tech Stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js >= 18.0.0
- **Framework**: Express 5.x
- **HTTP Client**: Axios
- **Validation**: Joi
- **Logging**: Winston
- **Documentation**: Swagger (OpenAPI 3.0)
- **Testing**: Jest + Supertest + ts-jest
- **Code Quality**: ESLint + Prettier (Airbnb TypeScript style guide)
- **WhatsApp**: Meta Cloud API (v18.0)
- **Database**: PostgreSQL with Prisma ORM

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 13 (local or cloud instance)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/guilhermomg/whatsapp-bulk-saas.git
cd whatsapp-bulk-saas
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
   - Database: Set `DATABASE_URL` to your PostgreSQL connection string
   - Encryption: Generate an encryption key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set `ENCRYPTION_KEY`
   - WhatsApp: See [WhatsApp Setup Guide](docs/WHATSAPP_SETUP.md) for obtaining WhatsApp credentials

5. Set up the database:
```bash
# Generate Prisma Client
npm run db:generate

# Run migrations (requires PostgreSQL connection)
npm run db:migrate

# Seed sample data (optional, for development)
npm run db:seed
```

6. Build the TypeScript code:
```bash
npm run build
```

### Running the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### API Documentation

Once the server is running, access the Swagger documentation at:
```
http://localhost:3000/api-docs
```

### Health Check

Check if the API is running:
```
http://localhost:3000/api/v1/health
```

## WhatsApp Cloud API

This application integrates with the official WhatsApp Cloud API for compliant, spam-safe messaging.

### Quick Start

1. **Setup WhatsApp Credentials**: Follow the [WhatsApp Setup Guide](docs/WHATSAPP_SETUP.md) to:
   - Create a Meta Business Account
   - Register your phone number
   - Obtain permanent access token
   - Configure webhooks

2. **Configure Environment Variables**: Update your `.env` file with WhatsApp credentials:
   ```env
   WHATSAPP_API_VERSION=v18.0
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id
   WHATSAPP_ACCESS_TOKEN=your_permanent_token
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verification_token
   WHATSAPP_APP_SECRET=your_app_secret
   ```

3. **Test the Integration**:
   ```bash
   # Check WhatsApp service status
   curl http://localhost:3000/api/v1/whatsapp/status

   # Send a test message
   curl -X POST http://localhost:3000/api/v1/messages/send \
     -H "Content-Type: application/json" \
     -d '{
       "type": "text",
       "to": "+14155238886",
       "body": "Hello from WhatsApp Cloud API!"
     }'
   ```

### Available Endpoints

- `GET /api/v1/whatsapp/status` - Check WhatsApp connectivity and phone number status
- `POST /api/v1/messages/send` - Send text or template messages
- `GET /webhooks/whatsapp` - Webhook verification endpoint
- `POST /webhooks/whatsapp` - Receive message status updates and incoming messages

## Template Management

The application provides comprehensive template management for WhatsApp message templates, supporting the full template lifecycle from creation to approval and usage in campaigns.

### Template Operations

#### Create Template
```bash
curl -X POST http://localhost:3000/api/v1/templates \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "name": "order_confirmation",
    "language": "en_US",
    "category": "utility",
    "components": {
      "header": {
        "type": "text",
        "text": "Order Confirmation"
      },
      "body": {
        "text": "Hi {{1}}, your order {{2}} has been confirmed. Total: {{3}}.",
        "variables": ["customer_name", "order_id", "total_amount"]
      },
      "footer": {
        "text": "Thank you for your purchase"
      },
      "buttons": [
        {
          "type": "url",
          "text": "Track Order",
          "url": "https://example.com/track"
        }
      ]
    }
  }'
```

#### List Templates
```bash
# List all templates
curl "http://localhost:3000/api/v1/templates?userId=your-user-id"

# Filter by status
curl "http://localhost:3000/api/v1/templates?userId=your-user-id&status=approved"

# Filter by category
curl "http://localhost:3000/api/v1/templates?userId=your-user-id&category=marketing"

# Search by name
curl "http://localhost:3000/api/v1/templates?userId=your-user-id&search=order"
```

#### Preview Template
```bash
curl -X POST "http://localhost:3000/api/v1/templates/template-id/preview?userId=your-user-id" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "customer_name": "John Doe",
      "order_id": "#12345",
      "total_amount": "$99.99"
    }
  }'
```

#### Validate Template Parameters
```bash
curl -X POST "http://localhost:3000/api/v1/templates/template-id/validate?userId=your-user-id" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "customer_name": "John Doe",
      "order_id": "#12345",
      "total_amount": "$99.99"
    }
  }'
```

#### Sync Templates from Meta
```bash
curl -X POST http://localhost:3000/api/v1/templates/sync \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "wabaId": "your-waba-id"
  }'
```

### Template Categories

- **Marketing**: Promotional messages, sales, offers (requires opt-in)
- **Utility**: Order updates, account notifications, alerts
- **Authentication**: OTP codes, verification messages

### Template Structure

Templates support the following components:

- **Header** (optional): Text, image, video, or document (max 60 chars for text)
- **Body** (required): Main message text with variables (max 1024 chars)
- **Footer** (optional): Small text at bottom (max 60 chars)
- **Buttons** (optional): Up to 3 action buttons (URL, phone, quick reply)

### Variable Placeholders

Templates support dynamic parameters using {{1}}, {{2}}, {{3}}, etc:

```javascript
// Template body
"Hi {{1}}, your order {{2}} is ready for pickup at {{3}}."

// Variables
["customer_name", "order_number", "store_location"]

// Result
"Hi John, your order #12345 is ready for pickup at Main Street Store."
```

**Important**: Variables must be sequential starting from {{1}}.

### Template Status Flow

```
Draft → Pending → Approved/Rejected
         ↓           ↓
    Submitted   Can be used in campaigns
    to Meta
```

- **Draft**: Template is being created/edited
- **Pending**: Submitted to Meta for approval
- **Approved**: Ready to use in campaigns
- **Rejected**: Not approved by Meta (check rejection reason)

### Template Validation

The system validates:
- ✅ Name format (lowercase, numbers, underscores only)
- ✅ Sequential variable numbering ({{1}}, {{2}}, {{3}})
- ✅ Character limits (body: 1024, header/footer: 60, buttons: 25)
- ✅ Maximum 3 buttons per template
- ✅ Valid language codes (ISO 639-1)
- ✅ Valid component structure

### Template Examples

#### Utility Template (Order Update)
```json
{
  "name": "order_update",
  "category": "utility",
  "language": "en_US",
  "components": {
    "body": {
      "text": "Order {{1}} has been {{2}}. Expected delivery: {{3}}.",
      "variables": ["order_id", "status", "delivery_date"]
    }
  }
}
```

#### Marketing Template (Summer Sale)
```json
{
  "name": "summer_sale",
  "category": "marketing",
  "language": "en_US",
  "components": {
    "header": {
      "type": "image",
      "url": "https://example.com/summer.jpg"
    },
    "body": {
      "text": "Hi {{1}}! Summer sale is here! Get {{2}}% off on all items.",
      "variables": ["customer_name", "discount_percentage"]
    },
    "footer": {
      "text": "Valid until Aug 31"
    },
    "buttons": [
      {
        "type": "url",
        "text": "Shop Now",
        "url": "https://shop.example.com"
      }
    ]
  }
}
```

#### Authentication Template (OTP)
```json
{
  "name": "verification_code",
  "category": "authentication",
  "language": "en_US",
  "components": {
    "body": {
      "text": "Your verification code is {{1}}. Valid for {{2}} minutes.",
      "variables": ["code", "expiry_minutes"]
    }
  }
}
```

### Template API Endpoints

- `POST /api/v1/templates` - Create a new template
- `GET /api/v1/templates` - List templates with filters
- `GET /api/v1/templates/:id` - Get template by ID
- `PUT /api/v1/templates/:id` - Update template (draft only)
- `DELETE /api/v1/templates/:id` - Delete template
- `POST /api/v1/templates/:id/preview` - Preview template with parameters
- `POST /api/v1/templates/:id/validate` - Validate template parameters
- `POST /api/v1/templates/sync` - Sync templates from Meta WhatsApp API

### Available Endpoints

- `GET /api/v1/whatsapp/status` - Check WhatsApp connectivity and phone number status
- `POST /api/v1/messages/send` - Send text or template messages
- `GET /webhooks/whatsapp` - Webhook verification endpoint
- `POST /webhooks/whatsapp` - Receive message status updates and incoming messages

### Features

- ✅ Send text messages with URL preview support
- ✅ Send template messages with dynamic parameters
- ✅ Webhook signature verification for security
- ✅ Message status tracking (sent, delivered, read, failed)
- ✅ Incoming message handling (for opt-out requests)
- ✅ Retry logic with exponential backoff (1s, 2s, 4s, 8s, 16s)
- ✅ Rate limiting awareness (80 requests/second per phone number)
- ✅ Request/response logging with PII sanitization
- ✅ Phone number validation (E.164 format)
- ✅ Idempotent webhook processing

### Documentation

- [WhatsApp Setup Guide](docs/WHATSAPP_SETUP.md) - Complete setup instructions
- [Insomnia Collection](docs/insomnia-collection.json) - API testing collection
- [Swagger Documentation](http://localhost:3000/api-docs) - Interactive API docs

## Project Structure

```
whatsapp-bulk-saas/
├── src/
│   ├── config/          # Configuration files
│   │   ├── index.ts     # Main configuration
│   │   ├── logger.ts    # Winston logger setup
│   │   ├── swagger.ts   # Swagger/OpenAPI configuration
│   │   └── whatsapp.ts  # WhatsApp Cloud API configuration
│   ├── controllers/     # Route controllers (application layer)
│   │   ├── health.controller.ts    # Health check endpoint
│   │   ├── messages.controller.ts  # Message sending endpoints
│   │   └── webhook.controller.ts   # Webhook handlers
│   ├── services/        # Business logic layer
│   │   └── whatsapp/    # WhatsApp service layer
│   │       └── whatsappClient.ts   # WhatsApp API client
│   ├── repositories/    # Data access layer
│   ├── models/          # Data models/schemas
│   ├── middleware/      # Express middleware
│   │   ├── errorHandler.ts  # Global error handler
│   │   ├── notFound.ts      # 404 handler
│   │   └── requestId.ts     # Request ID for tracing
│   ├── routes/          # API route definitions
│   ├── utils/           # Helper functions
│   │   ├── errors.ts        # Custom error classes
│   │   └── webhookUtils.ts  # Webhook utilities
│   ├── validators/      # Input validation schemas
│   │   └── whatsapp.validator.ts  # WhatsApp payload validators
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── dist/                # Compiled JavaScript (generated)
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   │   ├── health.test.ts    # Health endpoint tests
│   │   ├── messages.test.ts  # Message endpoint tests
│   │   └── webhook.test.ts   # Webhook endpoint tests
│   └── helpers/        # Test utilities
│       ├── testUtils.ts          # Test request helper
│       └── mockWhatsAppClient.ts # Mock WhatsApp client
├── docs/
│   ├── insomnia-collection.json  # Insomnia API collection
│   └── WHATSAPP_SETUP.md         # WhatsApp setup guide
├── logs/               # Application logs (auto-generated)
├── tsconfig.json       # TypeScript configuration
├── tsconfig.eslint.json # TypeScript config for ESLint
├── .env.example        # Environment variables template
├── .eslintrc.json     # ESLint configuration
├── .prettierrc        # Prettier configuration
├── jest.config.js     # Jest configuration
├── nodemon.json       # Nodemon configuration
└── package.json       # Project dependencies and scripts
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run dev` | Start development server with auto-reload |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate test coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues automatically |
| `npm run format` | Format code with Prettier |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:migrate:prod` | Deploy migrations to production |
| `npm run db:reset` | Reset database (development only) |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:push` | Push schema changes without migrations |

## Database

This application uses PostgreSQL with Prisma ORM for robust data management.

### Database Setup

1. **Install PostgreSQL** (if running locally):
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql

   # Ubuntu
   sudo apt-get install postgresql
   sudo service postgresql start
   ```

2. **Create Database**:
   ```bash
   createdb whatsapp_bulk_saas
   ```

3. **Configure Connection**:
   Update `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/whatsapp_bulk_saas?schema=public"
   ```

4. **Run Migrations**:
   ```bash
   npm run db:migrate
   ```

5. **Seed Sample Data** (optional):
   ```bash
   npm run db:seed
   ```

### Database Schema

The schema includes:
- **Users**: Multi-tenant user management with encrypted credentials
- **Contacts**: Contact management with opt-in/opt-out tracking
- **Templates**: WhatsApp message templates
- **Campaigns**: Bulk messaging campaigns
- **Messages**: Individual message tracking with status updates
- **WebhookEvents**: Audit trail for all webhook events

See [Database Schema Documentation](docs/database-schema.md) for complete details.

### Free PostgreSQL Options

For development and testing:
- **Supabase** - 500MB free tier with excellent UI
- **Neon** - 3GB free tier, serverless PostgreSQL
- **Railway** - $5 credit/month
- **ElephantSQL** - 20MB free (minimal but OK for testing)
- **Local Docker**:
  ```bash
  docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
  ```

### Prisma Studio

View and edit your database with Prisma Studio:
```bash
npm run db:studio
```
Opens at http://localhost:5555

## Environment Variables

See `.env.example` for all available environment variables.

### Server Configuration
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: localhost)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

### Database Configuration
- `DATABASE_URL` - PostgreSQL connection string
- `DATABASE_POOL_MIN` - Minimum connection pool size (default: 2)
- `DATABASE_POOL_MAX` - Maximum connection pool size (default: 10)
- `ENCRYPTION_KEY` - 32-byte hex key for encrypting sensitive data (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### WhatsApp Cloud API Configuration
- `WHATSAPP_API_VERSION` - API version (default: v18.0)
- `WHATSAPP_PHONE_NUMBER_ID` - Your WhatsApp phone number ID
- `WHATSAPP_BUSINESS_ACCOUNT_ID` - Your WhatsApp Business Account ID
- `WHATSAPP_ACCESS_TOKEN` - Permanent access token from Meta
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` - Webhook verification token
- `WHATSAPP_APP_SECRET` - App secret for webhook signature verification

See the [WhatsApp Setup Guide](docs/WHATSAPP_SETUP.md) for instructions on obtaining these values.

## Testing

All tests are passing (21/21 ✓):

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Code Quality

### Linting
```bash
npm run lint
```

### Auto-fix linting issues
```bash
npm run lint:fix
```

### Format code
```bash
npm run format
```

## Design Patterns

This project implements several design patterns:

- **Repository Pattern** - Abstract data access layer
- **Dependency Injection** - For services and repositories
- **Factory Pattern** - For creating complex objects
- **Strategy Pattern** - For different queue/messaging strategies

## Error Handling

The application uses custom error classes for consistent error handling:
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `ValidationError` (422)
- `InternalServerError` (500)

## Logging

Logs are written to:
- Console (with colors in development)
- `logs/all.log` - All logs
- `logs/error.log` - Error logs only

## API Tools

### Insomnia Collection

Import the Insomnia collection from `docs/insomnia-collection.json` to test the API.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

