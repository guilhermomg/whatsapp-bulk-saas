import express from 'express';
import multer from 'multer';
import {
  createContact,
  getContact,
  listContacts,
  updateContact,
  deleteContact,
  optInContact,
  optOutContact,
  bulkOptIn,
  bulkOptOut,
  updateContactTags,
  bulkTag,
  bulkUntag,
  importCsv,
  exportCsv,
} from '../controllers/contact.controller';

const router = express.Router();

// Configure multer for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Accept only CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Contact CRUD
router.post('/', createContact);
router.get('/', listContacts);
router.get('/:id', getContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

// CSV Operations (must be before /:id routes to avoid conflicts)
router.post('/import-csv', upload.single('file'), importCsv);
router.get('/export-csv', exportCsv);

// Opt-in/out
router.post('/:id/opt-in', optInContact);
router.post('/:id/opt-out', optOutContact);
router.post('/bulk-opt-in', bulkOptIn);
router.post('/bulk-opt-out', bulkOptOut);

// Tags
router.patch('/:id/tags', updateContactTags);
router.post('/bulk-tag', bulkTag);
router.delete('/bulk-untag', bulkUntag);

export default router;
