import express from 'express';
import {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
} from '../controllers/campaign.controller';
import authenticate from '../middleware/authenticate';

const router = express.Router();

router.use(authenticate);

// Campaign CRUD
router.post('/', createCampaign);
router.get('/', listCampaigns);
router.get('/:id', getCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

// Campaign operations (must be before /:id to avoid routing conflicts)
router.post('/:id/start', startCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/cancel', cancelCampaign);

export default router;
