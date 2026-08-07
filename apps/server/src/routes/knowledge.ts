import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { ensureUploadsDir } from '../utils/storage.js';

const router: Router = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureUploadsDir()),
  }),
});

router.use(authMiddleware);

router.get('/entries', async (_req, res) => {
  try {
    const entries = await prisma.knowledgeEntry.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(entries);
  } catch (error) {
    console.error('Failed to fetch entries:', error);
    res.status(500).json({ error: '获取知识条目失败' });
  }
});

router.post('/entries', async (req, res) => {
  try {
    const data = {
      question: req.body.question || '',
      answer: req.body.answer || '',
      category: req.body.category || '通用',
      tags: req.body.tags || '',
    };
    const entry = await prisma.knowledgeEntry.create({ data });
    res.status(201).json(entry);
  } catch (error) {
    console.error('Failed to create entry:', error);
    res.status(500).json({ error: '创建知识条目失败' });
  }
});

router.put('/entries/:id', async (req, res) => {
  try {
    const existing = await prisma.knowledgeEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '条目未找到' });
    const entry = await prisma.knowledgeEntry.update({
      where: { id: req.params.id },
      data: {
        question: req.body.question ?? existing.question,
        answer: req.body.answer ?? existing.answer,
        category: req.body.category ?? existing.category,
        tags: req.body.tags ?? existing.tags,
      },
    });
    res.json(entry);
  } catch (error) {
    console.error('Failed to update entry:', error);
    res.status(500).json({ error: '更新知识条目失败' });
  }
});

router.delete('/entries/:id', async (req, res) => {
  try {
    const existing = await prisma.knowledgeEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '条目未找到' });
    await prisma.knowledgeEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete entry:', error);
    res.status(500).json({ error: '删除知识条目失败' });
  }
});

router.get('/documents', async (_req, res) => {
  try {
    const docs = await prisma.document.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(docs);
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    res.status(500).json({ error: '获取文档列表失败' });
  }
});

// Upload document (parse and store as knowledge entries)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: '请选择文件' });
    
    const fs = await import('fs');
    const text = fs.readFileSync(file.path, 'utf-8');
    
    // Create document record
    const doc = await prisma.document.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        parsedText: text.substring(0, 10000),
        status: 'PARSED',
      },
    });
    
    // Create knowledge entry from document
    await prisma.knowledgeEntry.create({
      data: {
        question: `文档: ${file.originalname}`,
        answer: text.substring(0, 5000),
        category: '上传文档',
        tags: '文档',
        sourceDocId: doc.id,
      },
    });
    
    res.status(201).json({ message: '上传成功', document: doc });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

export default router;
