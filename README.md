# whatsapp-bulk-saas

WhatsApp bulk messaging micro SaaS with compliant Cloud API integration. Node.js backend with queue management, template handling, and opt-in validation for spam-safe multi-contact messaging.

## Features

- 🚀 Production-ready Node.js backend with Express
- 🏗️ Clean architecture with separation of concerns
- 🔒 Security best practices (Helmet, CORS)
- 📝 Comprehensive logging with Winston
- 📚 API documentation with Swagger
- ✅ Testing setup with Jest and Supertest
- 🔄 Auto-reload development with Nodemon
- 🎨 Code quality with ESLint and Prettier
- 🏥 Health check endpoint

## Tech Stack

- **Runtime**: Node.js >= 18.0.0
- **Framework**: Express 5.x
- **Validation**: Joi
- **Logging**: Winston
- **Documentation**: Swagger (OpenAPI 3.0)
- **Testing**: Jest + Supertest
- **Code Quality**: ESLint + Prettier (Airbnb style guide)

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

4. Update the `.env` file with your configuration.

### Running the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
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

## Project Structure

```
whatsapp-bulk-saas/
├── src/
│   ├── config/          # Configuration files
│   │   ├── index.js     # Main configuration
│   │   ├── logger.js    # Winston logger setup
│   │   └── swagger.js   # Swagger/OpenAPI configuration
│   ├── controllers/     # Route controllers (application layer)
│   ├── services/        # Business logic layer
│   ├── repositories/    # Data access layer
│   ├── models/          # Data models/schemas
│   ├── middleware/      # Express middleware
│   │   ├── errorHandler.js  # Global error handler
│   │   ├── notFound.js      # 404 handler
│   │   └── requestId.js     # Request ID for tracing
│   ├── routes/          # API route definitions
│   ├── utils/           # Helper functions
│   │   └── errors.js    # Custom error classes
│   ├── validators/      # Input validation schemas
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── helpers/        # Test utilities
├── docs/
│   └── insomnia-collection.json  # Insomnia API collection
├── logs/               # Application logs (auto-generated)
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

Key variables:
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## Testing

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

