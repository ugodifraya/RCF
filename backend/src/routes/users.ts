import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireCoach, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, firstName: true, lastName: true, role: true, position: true, number: true, createdAt: true },
      orderBy: [{ lastName: 'asc' }],
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/players', requireAuth, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'PLAYER' },
      select: { id: true, firstName: true, lastName: true, position: true, number: true },
      orderBy: [{ lastName: 'asc' }],
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, position, number } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { firstName, lastName, position, number: number ? parseInt(number) : null },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, position: true, number: true },
    });
    res.json(user);
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
