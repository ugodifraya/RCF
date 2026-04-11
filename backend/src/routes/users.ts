import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireCoach, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, role: true, position: true, number: true, avatarUrl: true, createdAt: true },
      orderBy: [{ lastName: 'asc' }],
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Coach : créer un compte joueuse
router.post('/', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { email, firstName, lastName, position, number, password } = req.body;
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, firstName, lastName, role: 'PLAYER', password: hashed, position: position || null, number: number ? parseInt(number) : null },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, position: true, number: true, avatarUrl: true },
    });
    res.status(201).json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Coach : modifier le profil d'une joueuse
router.patch('/:id', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, position, number, email } = req.body;
    const data: Record<string, unknown> = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (position !== undefined) data.position = position || null;
    if (number !== undefined) data.number = number ? parseInt(number) : null;
    if (email) data.email = email;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, position: true, number: true, avatarUrl: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/players', requireAuth, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'PLAYER' },
      select: { id: true, firstName: true, lastName: true, position: true, number: true, avatarUrl: true },
      orderBy: [{ lastName: 'asc' }],
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, position, number, avatarUrl, email, password } = req.body;
    const data: Record<string, unknown> = { firstName, lastName, position, number: number ? parseInt(number) : null };
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (email) data.email = email;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, position: true, number: true, avatarUrl: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload avatar (base64)
router.post('/me/avatar', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { base64, ext } = req.body;
    if (!base64) return res.status(400).json({ error: 'Image requise' });

    const uploadsDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = `${req.user!.id}.${ext || 'jpg'}`;
    const filepath = path.join(uploadsDir, filename);
    const imageData = base64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filepath, Buffer.from(imageData, 'base64'));

    const avatarUrl = `/uploads/avatars/${filename}`;
    await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl } });
    res.json({ avatarUrl });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/:id/role', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { role } = req.body;
    if (!['PLAYER', 'COACH', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
