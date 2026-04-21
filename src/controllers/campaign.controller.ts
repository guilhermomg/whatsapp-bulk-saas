import { Request, Response } from 'express';
import { CampaignService } from '../services/campaignService';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import logger from '../config/logger';

const campaignService = new CampaignService();

/**
 * @swagger
 * tags:
 *   name: Campaigns
 *   description: Campaign management endpoints
 */

/**
 * @swagger
 * /campaigns:
 *   post:
 *     summary: Create a new campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - templateId
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Black Friday Promo'
 *               templateId:
 *                 type: string
 *                 format: uuid
 *               contactFilter:
 *                 type: object
 *                 properties:
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Campaign created with status draft
 *       400:
 *         description: Invalid template status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Template not found
 */
export async function createCampaign(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const {
      name, templateId, contactFilter, scheduledAt,
    } = req.body;

    if (!name) throw new BadRequestError('name is required');
    if (!templateId) throw new BadRequestError('templateId is required');

    const campaign = await campaignService.createCampaign(req.user.userId, {
      name,
      templateId,
      contactFilter,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error creating campaign:', error);
    throw error;
  }
}

/**
 * @swagger
 * /campaigns:
 *   get:
 *     summary: List campaigns with pagination and status filter
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, processing, completed, failed, paused]
 *     responses:
 *       200:
 *         description: Paginated list of campaigns
 *       401:
 *         description: Unauthorized
 */
export async function listCampaigns(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const limit = parseInt(String(req.query.limit ?? 20), 10);
    const offset = parseInt(String(req.query.offset ?? 0), 10);
    const { status } = req.query as { status?: string };

    const result = await campaignService.listCampaigns({
      userId: req.user.userId,
      limit,
      offset,
      status: status as any,
    });

    res.status(200).json({
      success: true,
      data: result.campaigns,
      pagination: { total: result.total, limit, offset },
    });
  } catch (error) {
    logger.error('Error listing campaigns:', error);
    throw error;
  }
}

/**
 * @swagger
 * /campaigns/{id}:
 *   get:
 *     summary: Get campaign detail with stats
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign detail with delivery stats
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 */
export async function getCampaign(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const { id } = req.params;
    const campaign = await campaignService.getCampaignById(id, req.user.userId);
    const stats = await campaignService.getCampaignStats(id, req.user.userId);

    res.status(200).json({ success: true, data: { ...campaign, stats } });
  } catch (error) {
    logger.error('Error getting campaign:', error);
    throw error;
  }
}

/**
 * @swagger
 * /campaigns/{id}:
 *   put:
 *     summary: Update a draft campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               templateId:
 *                 type: string
 *                 format: uuid
 *               contactFilter:
 *                 type: object
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Campaign updated
 *       400:
 *         description: Can only update draft campaigns
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 */
export async function updateCampaign(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const { id } = req.params;
    const {
      name, templateId, contactFilter, scheduledAt,
    } = req.body;

    const campaign = await campaignService.updateCampaign(id, req.user.userId, {
      name,
      templateId,
      contactFilter,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });

    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error updating campaign:', error);
    throw error;
  }
}

/**
 * @swagger
 * /campaigns/{id}:
 *   delete:
 *     summary: Delete a draft campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Campaign deleted
 *       400:
 *         description: Only draft campaigns can be deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 */
export async function deleteCampaign(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const { id } = req.params;
    await campaignService.deleteCampaign(id, req.user.userId);

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting campaign:', error);
    throw error;
  }
}

/**
 * @swagger
 * /campaigns/{id}/start:
 *   post:
 *     summary: Start a campaign (enqueues jobs, sets status to processing)
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign started, status is now processing
 *       400:
 *         description: Campaign cannot be started (wrong status or no contacts)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 */
export async function startCampaign(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const { id } = req.params;
    const campaign = await campaignService.startCampaign(id, req.user.userId);

    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error starting campaign:', error);
    throw error;
  }
}

/**
 * @swagger
 * /campaigns/{id}/pause:
 *   post:
 *     summary: Pause an in-progress campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign paused
 *       400:
 *         description: Only processing campaigns can be paused
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 */
export async function pauseCampaign(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const { id } = req.params;
    const campaign = await campaignService.pauseCampaign(id, req.user.userId);

    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error pausing campaign:', error);
    throw error;
  }
}

/**
 * @swagger
 * /campaigns/{id}/cancel:
 *   post:
 *     summary: Cancel a campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign cancelled
 *       400:
 *         description: Campaign cannot be cancelled in its current status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 */
export async function cancelCampaign(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) throw new UnauthorizedError();

    const { id } = req.params;
    const campaign = await campaignService.cancelCampaign(id, req.user.userId);

    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    logger.error('Error cancelling campaign:', error);
    throw error;
  }
}
