import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import config from './config';
import swaggerSpec from './config/swagger';
import routes from './routes';
import webhookRoutes from './routes/webhook.routes';
import requestId from './middleware/requestId';
import notFound from './middleware/notFound';
import errorHandler from './middleware/errorHandler';
import captureRawBody from './middleware/captureRawBody';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.security.corsOrigin,
    credentials: true,
  }),
);

// Webhook routes need raw body for signature verification
// Apply captureRawBody middleware before other routes
app.use('/webhooks', captureRawBody, webhookRoutes);

// Body parser middleware for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression middleware
app.use(compression());

// Request ID middleware
app.use(requestId);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use(`${config.api.prefix}/${config.api.version}`, routes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

export default app;
