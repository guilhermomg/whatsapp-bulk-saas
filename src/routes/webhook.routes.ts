import express from 'express';
import { verifyWebhook, handleWebhookEvent } from '../controllers/webhook.controller';

const router = express.Router();

router.get('/whatsapp', verifyWebhook);
router.post('/whatsapp', handleWebhookEvent);

export default router;
