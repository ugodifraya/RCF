import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireCoach, async (_req, res) => {
  try {
    const injuries = await prisma.injury.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, position: true } } },
      orderBy: { startDate: 'desc' },
    });
    res.json(injuries);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/my-injuries', requireAuth, async (req: AuthRequest, res) => {
  try {
    const injuries = await prisma.injury.findMany({
      where: { userId: req.user!.id },
      orderBy: { startDate: 'desc' },
    });
    res.json(injuries);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { userId, type, startDate, endDate, description } = req.body;
    if (!userId || !type || !startDate) return res.status(400).json({ error: 'Champs requis manquants' });

    const injury = await prisma.injury.create({
      data: { userId, type, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, description },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(injury);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', requireCoach, async (_req, res) => {
  try {
    const { type, startDate, endDate, description, status } = _req.body;
    const injury = await prisma.injury.update({
      where: { id: _req.params.id },
      data: { type, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, description, status },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    res.json(injury);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
