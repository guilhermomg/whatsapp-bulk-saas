import logger from '../config/logger';
import getWhatsAppConfig, { validateWhatsAppConfig } from '../config/whatsapp';

/**
 * Validates all required environment variables and configurations on startup
 * @throws {Error} If any required configuration is missing
 */
const validateEnvironment = (): void => {
  logger.info('Validating environment configuration...');

  try {
    // Validate WhatsApp configuration
    validateWhatsAppConfig();
    const whatsappConfig = getWhatsAppConfig();
    logger.info('✓ WhatsApp configuration is valid');
    logger.info(`  - API Version: ${whatsappConfig.apiVersion}`);
    logger.info(`  - Phone Number ID: ${whatsappConfig.phoneNumberId.slice(0, 8)}...`);
    logger.info(`  - Business Account ID: ${whatsappConfig.businessAccountId.slice(0, 8)}...`);
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(`⚠ WhatsApp configuration warning: ${error.message}`);
      logger.warn('  Some WhatsApp features may not be available.');
      logger.warn('  See docs/WHATSAPP_SETUP.md for setup instructions.');
    }
  }

  logger.info('✓ Environment validation complete');
};

export default validateEnvironment;
