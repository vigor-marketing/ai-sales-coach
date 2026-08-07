import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { ensureUploadsDir } from '../utils/storage.js';

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
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
    if (!file) return res.status(400).json({ error: '请选择文件' });

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
    res.status(500).json({ error: '文件上传失败' });
  }
});

export default router;
