import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ─── CYCLES (joueuse) ────────────────────────────────────────────────────────

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
        painLevel: painLevel !== undefined && painLevel !== '' ? parseInt(painLevel) : null,
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
        painLevel: painLevel !== undefined && painLevel !== '' ? parseInt(painLevel) : null,
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

// ─── TABLEAU DE BORD SANTÉ (coach) ───────────────────────────────────────────

router.get('/dashboard', requireCoach, async (_req, res) => {
  try {
    const today = new Date();

    const activeInjuries = await prisma.injury.findMany({
      where: { status: 'ACTIVE' },
      include: { user: { select: { id: true, firstName: true, lastName: true, position: true, avatarUrl: true } } },
      orderBy: { startDate: 'desc' },
    });

    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentInjuries = await prisma.injury.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Coach voit TOUS les cycles actifs avec niveau de douleur
    const activeCycles = await prisma.cycleTracking.findMany({
      where: {
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { startDate: 'desc' },
    });

    const totalPlayers = await prisma.user.count({ where: { role: 'PLAYER' } });
    const injuredCount = activeInjuries.length;
    const inCycleCount = activeCycles.length;
    const availableCount = totalPlayers - injuredCount;

    const allInjuries = await prisma.injury.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, position: true, avatarUrl: true } } },
      orderBy: { startDate: 'desc' },
      take: 30,
    });

    res.json({ summary: { totalPlayers, injuredCount, inCycleCount, availableCount }, activeInjuries, recentInjuries, activeCycles, allInjuries });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
