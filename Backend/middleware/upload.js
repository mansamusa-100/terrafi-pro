import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kycUploadDir = path.join(__dirname, '../uploads/kyc');
const locationUploadDir = path.join(__dirname, '../uploads/location');
fs.mkdirSync(kycUploadDir, { recursive: true });
fs.mkdirSync(locationUploadDir, { recursive: true });

function kycFileFilter(_req, file, cb) {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];
  cb(null, allowed.includes(file.mimetype));
}

function imageFileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  cb(null, allowed.includes(file.mimetype));
}

const kycStorage = multer.diskStorage({
  destination: kycUploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const docType = req.body.docType || 'document';
    cb(null, `${req.params.id}-${docType}-${Date.now()}${ext}`);
  }
});

export const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: kycFileFilter
});

const bulkStorage = multer.diskStorage({
  destination: kycUploadDir,
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

const locationStorage = multer.diskStorage({
  destination: locationUploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}-location-${Date.now()}${ext}`);
  }
});

export const locationPhotoUpload = multer({
  storage: locationStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

export { kycUploadDir, locationUploadDir };
