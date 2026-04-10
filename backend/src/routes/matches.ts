import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const matches = await prisma.match.findMany({
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { playerStats: true } },
      },
      orderBy: { date: 'desc' },
    });
    res.json(matches);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id', requireAuth, async (_req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: _req.params.id },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        playerStats: {
          include: { user: { select: { id: true, firstName: true, lastName: true, position: true, number: true } } },
          orderBy: [{ starter: 'desc' }, { minutesPlayed: 'desc' }],
        },
      },
    });
    if (!match) return res.status(404).json({ error: 'Match introuvable' });
    res.json(match);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { date, opponent, location, homeAway, scoreHome, scoreAway, competition, notes } = req.body;
    if (!date || !opponent) return res.status(400).json({ error: 'Date et adversaire requis' });

    const match = await prisma.match.create({
      data: {
        date: new Date(date), opponent, location, homeAway: homeAway || 'HOME',
        scoreHome: scoreHome !== undefined && scoreHome !== '' ? parseInt(scoreHome) : null,
        scoreAway: scoreAway !== undefined && scoreAway !== '' ? parseInt(scoreAway) : null,
        competition, notes, createdById: req.user!.id,
      },
    });
    res.status(201).json(match);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { date, opponent, location, homeAway, scoreHome, scoreAway, competition, notes } = req.body;
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        date: new Date(date), opponent, location, homeAway,
        scoreHome: scoreHome !== undefined && scoreHome !== '' ? parseInt(scoreHome) : null,
        scoreAway: scoreAway !== undefined && scoreAway !== '' ? parseInt(scoreAway) : null,
        competition, notes,
      },
    });
    res.json(match);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', requireCoach, async (_req, res) => {
  try {
    await prisma.playerMatchStat.deleteMany({ where: { matchId: _req.params.id } });
    await prisma.match.delete({ where: { id: _req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/stats', requireCoach, async (req, res) => {
  try {
    const { playerStats } = req.body;
    for (const stat of playerStats) {
      await prisma.playerMatchStat.upsert({
        where: { matchId_userId: { matchId: req.params.id, userId: stat.userId } },
        update: {
          minutesPlayed: parseInt(stat.minutesPlayed) || 0,
          goals: parseInt(stat.goals) || 0,
          assists: parseInt(stat.assists) || 0,
          yellowCards: parseInt(stat.yellowCards) || 0,
          redCards: parseInt(stat.redCards) || 0,
          rating: stat.rating ? parseFloat(stat.rating) : null,
          starter: Boolean(stat.starter),
        },
        create: {
          matchId: req.params.id, userId: stat.userId,
          minutesPlayed: parseInt(stat.minutesPlayed) || 0,
          goals: parseInt(stat.goals) || 0,
          assists: parseInt(stat.assists) || 0,
          yellowCards: parseInt(stat.yellowCards) || 0,
          redCards: parseInt(stat.redCards) || 0,
          rating: stat.rating ? parseFloat(stat.rating) : null,
          starter: Boolean(stat.starter),
        },
      });
    }
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { playerStats: { include: { user: { select: { id: true, firstName: true, lastName: true, position: true, number: true } } } } },
    });
    res.json(match);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
