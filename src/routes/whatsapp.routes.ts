import express from 'express';
import { getWhatsAppStatus } from '../controllers/messages.controller';

const router = express.Router();

router.get('/status', getWhatsAppStatus);

export default router;
