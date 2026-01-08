import express from 'express';
import healthRoutes from './health.routes';
import messagesRoutes from './messages.routes';
import whatsappRoutes from './whatsapp.routes';
import contactRoutes from './contact.routes';
import tagsRoutes from './tags.routes';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/messages', messagesRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/contacts', contactRoutes);
router.use('/tags', tagsRoutes);

export default router;
