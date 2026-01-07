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

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

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

4. Update the `.env` file with your configuration. See [WhatsApp Setup Guide](docs/WHATSAPP_SETUP.md) for detailed instructions on obtaining WhatsApp credentials.

5. Build the TypeScript code:
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

## Environment Variables

See `.env.example` for all available environment variables.

### Server Configuration
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: localhost)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

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

