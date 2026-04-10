import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/my-cycles', requireAuth, async (req: AuthRequest, res) => {
  try {
    const cycles = await prisma.cycleTracking.findMany({
      where: { userId: req.user!.id },
      orderBy: { startDate: 'desc' },
    });
    res.json(cycles);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/cycles', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, painLevel, notes } = req.body;
    if (!startDate) return res.status(400).json({ error: 'Date de début requise' });

    const cycle = await prisma.cycleTracking.create({
      data: {
        userId: req.user!.id,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        painLevel: painLevel !== undefined ? parseInt(painLevel) : null,
        notes,
      },
    });
    res.status(201).json(cycle);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/cycles/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, painLevel, notes } = req.body;
    const cycle = await prisma.cycleTracking.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!cycle) return res.status(404).json({ error: 'Entrée introuvable' });

    const updated = await prisma.cycleTracking.update({
      where: { id: req.params.id },
      data: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        painLevel: painLevel !== undefined ? parseInt(painLevel) : null,
        notes,
      },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/cycles/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const cycle = await prisma.cycleTracking.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!cycle) return res.status(404).json({ error: 'Entrée introuvable' });
    await prisma.cycleTracking.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/cycles/overview', requireCoach, async (_req, res) => {
  try {
    const today = new Date();
    const activeCycles = await prisma.cycleTracking.findMany({
      where: { startDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    res.json(activeCycles);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
