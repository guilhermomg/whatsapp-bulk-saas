import express from 'express';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  validateTemplateParameters,
  syncTemplates,
} from '../controllers/template.controller';

const router = express.Router();

// Template CRUD
router.post('/', createTemplate);
router.get('/', listTemplates);
router.get('/:id', getTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

// Template Operations (must be before /:id routes to avoid conflicts)
router.post('/sync', syncTemplates);
router.post('/:id/preview', previewTemplate);
router.post('/:id/validate', validateTemplateParameters);

export default router;
