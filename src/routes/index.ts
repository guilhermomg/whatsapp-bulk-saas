import express from 'express';
import healthRoutes from './health.routes';
import messagesRoutes from './messages.routes';
import whatsappRoutes from './whatsapp.routes';
import contactRoutes from './contact.routes';
import tagsRoutes from './tags.routes';
import templateRoutes from './template.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import campaignRoutes from './campaign.routes';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/messages', messagesRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/contacts', contactRoutes);
router.use('/tags', tagsRoutes);
router.use('/templates', templateRoutes);
router.use('/campaigns', campaignRoutes);

export default router;
