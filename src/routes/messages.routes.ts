import express from 'express';
import { sendMessage, getWhatsAppStatus } from '../controllers/messages.controller';

const router = express.Router();

router.post('/send', sendMessage);
router.get('/status', getWhatsAppStatus);

export default router;
