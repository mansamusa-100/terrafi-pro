import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../uploads/kyc');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const docType = req.body.docType || 'document';
    cb(null, `${req.params.id}-${docType}-${Date.now()}${ext}`);
  }
});

export const kycUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: kycFileFilter
});

const bulkStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

export const bulkKycUpload = multer({
  storage: bulkStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 100 },
  fileFilter: kycFileFilter
});

function kycFileFilter(_req, file, cb) {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];
  cb(null, allowed.includes(file.mimetype));
}

export const kycUploadDir = uploadDir;
