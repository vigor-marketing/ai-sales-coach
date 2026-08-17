import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { ensureUploadsDir } from '../utils/storage.js';
import { writeAuditLog } from '../utils/audit.js';
import { sendApiError } from '../utils/apiResponse.js';

const router: Router = Router();
router.use(authMiddleware);

// Configure multer for file uploads. The production path is injected by UPLOADS_DIR.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ensureUploadsDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  },
});

// Upload file and return URL
router.post('/', upload.single('file'), async (req: AuthRequest, res: any) => {
  try {
    const file = req.file;
    if (!file) return sendApiError(res, 400, 'FILE_REQUIRED', '请选择文件');

    writeAuditLog({
      action: 'file.uploaded',
      traceId: res.locals.traceId,
      actorId: req.user?.id,
      objectId: file.filename,
      purpose: 'training-attachment',
      result: 'success',
      metadata: { mimeType: file.mimetype, size: file.size },
    });

    const fileUrl = `/uploads/${file.filename}`;
    const isImage = file.mimetype.startsWith('image/');

    res.json({
      url: fileUrl,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      isImage,
    });
  } catch (error) {
    console.error('Upload error:', error);
    sendApiError(res, 500, 'FILE_UPLOAD_FAILED', '文件上传失败');
  }
});

export default router;
