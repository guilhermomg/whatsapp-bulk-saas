import express from 'express';
import { getAllTags } from '../controllers/contact.controller';

const router = express.Router();

// Get all tags with counts
router.get('/', getAllTags);

export default router;
