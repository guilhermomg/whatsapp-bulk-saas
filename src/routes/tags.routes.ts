import express from 'express';
import { getAllTags } from '../controllers/contactController';

const router = express.Router();

// Get all tags with counts
router.get('/', getAllTags);

export default router;
