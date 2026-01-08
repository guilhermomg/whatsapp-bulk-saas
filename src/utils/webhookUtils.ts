import crypto from 'crypto';
import getWhatsAppConfig from '../config/whatsapp';

/**
 * Verify webhook signature from WhatsApp
 * @param signature - X-Hub-Signature-256 header value
 * @param body - Raw request body as string
 * @returns boolean - True if signature is valid
 */
export const verifyWebhookSignature = (signature: string, body: string): boolean => {
  if (!signature) {
    return false;
  }

  // WhatsApp sends signature in format: sha256=<signature>
  const signatureParts = signature.split('=');
  if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = signatureParts[1];
  const whatsappConfig = getWhatsAppConfig();

  // Calculate HMAC using app secret
  const hmac = crypto.createHmac('sha256', whatsappConfig.appSecret);
  hmac.update(body);
  const calculatedSignature = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  // Ensure buffers are valid and of equal length to avoid RangeError
  try {
    const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (calculatedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(calculatedBuffer, expectedBuffer);
  } catch {
    // In case of invalid hex or other errors, treat signature as invalid
    return false;
  }
};

/**
 * Extract phone number from webhook event
 */
export const extractPhoneFromWebhook = (entry: {
  changes: Array<{ value: { metadata: { display_phone_number: string } } }>;
}): string => entry.changes[0]?.value?.metadata?.display_phone_number || '';

/**
 * Check if webhook event is a duplicate (for idempotency)
 * This is a simple in-memory implementation. In production, use Redis or database
 */
const processedWebhooks = new Set<string>();

export const isWebhookProcessed = (webhookId: string): boolean => processedWebhooks.has(webhookId);

export const markWebhookAsProcessed = (webhookId: string): void => {
  processedWebhooks.add(webhookId);

  // Clean up old entries after 1 hour (simple memory management)
  setTimeout(() => processedWebhooks.delete(webhookId), 3600000);
};
