import swaggerJsdoc from 'swagger-jsdoc';
import config from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Bulk SaaS API',
      version: '1.0.0',
      description:
        'WhatsApp bulk messaging micro SaaS with compliant Cloud API integration. Provides queue management, template handling, and opt-in validation for spam-safe multi-contact messaging.',
      contact: {
        name: 'API Support',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: `http://${config.host}:${config.port}${config.api.prefix}/${config.api.version}`,
        description: 'Development server',
      },
    ],
    components: {
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
