import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ─── MESURES PHYSIQUES ────────────────────────────────────────────────────────

// Joueuse : ses mesures
router.get('/my-measurements', requireAuth, async (req: AuthRequest, res) => {
  try {
    const measurements = await prisma.physicalMeasurement.findMany({
      where: { userId: req.user!.id },
      orderBy: { date: 'desc' },
    });
    res.json(measurements);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Joueuse : ajouter une mesure
router.post('/measurements', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { weight, height, date } = req.body;
    if (!date) return res.status(400).json({ error: 'Date requise' });
    const measurement = await prisma.physicalMeasurement.create({
      data: {
        userId: req.user!.id,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        date: new Date(date),
      },
    });
    res.status(201).json(measurement);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Joueuse : modifier une mesure
router.put('/measurements/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { weight, height, date } = req.body;
    const existing = await prisma.physicalMeasurement.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) return res.status(404).json({ error: 'Introuvable' });
    const updated = await prisma.physicalMeasurement.update({
      where: { id: req.params.id },
      data: { weight: weight ? parseFloat(weight) : null, height: height ? parseFloat(height) : null, date: new Date(date) },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── TESTS PERFORMANCE ────────────────────────────────────────────────────────

// Joueuse : ses tests
router.get('/my-tests', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tests = await prisma.performanceTest.findMany({
      where: { userId: req.user!.id },
      orderBy: { date: 'desc' },
    });
    res.json(tests);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Coach : ajouter un test pour une joueuse
router.post('/tests', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { userId, type, value, unit, date, notes } = req.body;
    if (!userId || !type || value === undefined || !unit || !date) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    const test = await prisma.performanceTest.create({
      data: { userId, type, value: parseFloat(value), unit, date: new Date(date), notes },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(test);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Coach : modifier un test
router.put('/tests/:id', requireCoach, async (_req, res) => {
  try {
    const { type, value, unit, date, notes } = _req.body;
    const test = await prisma.performanceTest.update({
      where: { id: _req.params.id },
      data: { type, value: parseFloat(value), unit, date: new Date(date), notes },
    });
    res.json(test);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Coach : supprimer un test
router.delete('/tests/:id', requireCoach, async (_req, res) => {
  try {
    await prisma.performanceTest.delete({ where: { id: _req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DASHBOARD COACH ──────────────────────────────────────────────────────────

router.get('/dashboard', requireCoach, async (_req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: { role: 'PLAYER' },
      include: {
        physicalMeasurements: { orderBy: { date: 'desc' }, take: 2 },
        performanceTests: { orderBy: { date: 'desc' } },
      },
      orderBy: { lastName: 'asc' },
    });

    const result = players.map(p => {
      const [latest, previous] = p.physicalMeasurements;
      const weightDiff = latest?.weight && previous?.weight ? +(latest.weight - previous.weight).toFixed(1) : null;
      const heightDiff = latest?.height && previous?.height ? +(latest.height - previous.height).toFixed(1) : null;

      // Group tests by type, keep latest per type
      const testsByType: Record<string, { value: number; unit: string; date: string }> = {};
      p.performanceTests.forEach(t => {
        if (!testsByType[t.type]) testsByType[t.type] = { value: t.value, unit: t.unit, date: t.date.toISOString() };
      });

      return {
        id: p.id, firstName: p.firstName, lastName: p.lastName, position: p.position, number: p.number, avatarUrl: p.avatarUrl,
        latestMeasurement: latest ? { weight: latest.weight, height: latest.height, date: latest.date } : null,
        weightDiff, heightDiff,
        tests: testsByType,
        allTests: p.performanceTests,
      };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Coach : toutes les mesures d'une joueuse
router.get('/player/:userId/measurements', requireCoach, async (req, res) => {
  try {
    const measurements = await prisma.physicalMeasurement.findMany({
      where: { userId: req.params.userId },
      orderBy: { date: 'asc' },
    });
    res.json(measurements);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Coach : tous les tests d'une joueuse
router.get('/player/:userId/tests', requireCoach, async (req, res) => {
  try {
    const tests = await prisma.performanceTest.findMany({
      where: { userId: req.params.userId },
      orderBy: { date: 'asc' },
    });
    res.json(tests);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
