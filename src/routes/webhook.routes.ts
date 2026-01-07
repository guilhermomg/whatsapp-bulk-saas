import express from 'express';
import { verifyWebhook, handleWebhookEvent } from '../controllers/webhook.controller';
import { webhookSecurityHeaders, ipWhitelist } from '../middleware/webhookSecurity';

const router = express.Router();

// Apply security middleware to all webhook routes
router.use(webhookSecurityHeaders);
router.use(ipWhitelist);

router.get('/whatsapp', verifyWebhook);
router.post('/whatsapp', handleWebhookEvent);

export default router;
