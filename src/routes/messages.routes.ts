import express from 'express';
import { sendMessage } from '../controllers/messages.controller';

const router = express.Router();

router.post('/send', sendMessage);

export default router;
