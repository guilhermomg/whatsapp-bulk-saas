import express from 'express';
import healthRoutes from './health.routes';
import messagesRoutes from './messages.routes';
import whatsappRoutes from './whatsapp.routes';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/messages', messagesRoutes);
router.use('/whatsapp', whatsappRoutes);

export default router;
