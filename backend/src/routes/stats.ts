import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/team', requireCoach, async (_req, res) => {
  try {
    const totalPlayers = await prisma.user.count({ where: { role: 'PLAYER' } });
    const totalEvents = await prisma.event.count();
    const totalMatches = await prisma.match.count();

    const matches = await prisma.match.findMany({
      where: { scoreHome: { not: null }, scoreAway: { not: null } },
    });
    let wins = 0, losses = 0, draws = 0;
    for (const m of matches) {
      if (m.scoreHome === null || m.scoreAway === null) continue;
      const isHome = m.homeAway === 'HOME';
      const ourScore = isHome ? m.scoreHome : m.scoreAway;
      const theirScore = isHome ? m.scoreAway : m.scoreHome;
      if (ourScore > theirScore) wins++;
      else if (ourScore < theirScore) losses++;
      else draws++;
    }

    const attendanceStats = await prisma.attendance.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const injuryStats = await prisma.injury.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    res.json({
      totalPlayers, totalEvents, totalMatches,
      matchResults: { wins, losses, draws, total: wins + losses + draws },
      attendanceStats,
      injuryStats,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/attendance', requireCoach, async (_req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        attendances: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { date: 'desc' },
      take: 20,
    });
    res.json(events);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/players', requireCoach, async (_req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: { role: 'PLAYER' },
      include: {
        attendances: { select: { status: true } },
        matchStats: {
          select: { goals: true, assists: true, minutesPlayed: true, yellowCards: true, redCards: true, rating: true, starter: true },
        },
        injuries: { select: { status: true, type: true } },
      },
    });

    const result = players.map(p => {
      const totalEvents = p.attendances.length;
      const present = p.attendances.filter(a => a.status === 'PRESENT').length;
      const absent = p.attendances.filter(a => a.status === 'ABSENT').length;
      const goals = p.matchStats.reduce((s, m) => s + m.goals, 0);
      const assists = p.matchStats.reduce((s, m) => s + m.assists, 0);
      const minutesPlayed = p.matchStats.reduce((s, m) => s + m.minutesPlayed, 0);
      const matchesPlayed = p.matchStats.filter(m => m.minutesPlayed > 0).length;
      const yellowCards = p.matchStats.reduce((s, m) => s + m.yellowCards, 0);
      const redCards = p.matchStats.reduce((s, m) => s + m.redCards, 0);
      const ratings = p.matchStats.filter(m => m.rating !== null).map(m => m.rating as number);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      const activeInjuries = p.injuries.filter(i => i.status === 'ACTIVE').length;

      return {
        id: p.id, firstName: p.firstName, lastName: p.lastName, position: p.position, number: p.number,
        attendanceRate: totalEvents > 0 ? Math.round((present / totalEvents) * 100) : 0,
        present, absent, totalEvents,
        goals, assists, minutesPlayed, matchesPlayed, yellowCards, redCards,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        activeInjuries,
      };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/my-stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const attendances = await prisma.attendance.findMany({ where: { userId: req.user!.id } });
    const matchStats = await prisma.playerMatchStat.findMany({
      where: { userId: req.user!.id },
      include: { match: { select: { date: true, opponent: true, homeAway: true, scoreHome: true, scoreAway: true } } },
      orderBy: { match: { date: 'desc' } },
    });
    const injuries = await prisma.injury.findMany({ where: { userId: req.user!.id }, orderBy: { startDate: 'desc' } });

    const totalEvents = attendances.length;
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const absent = attendances.filter(a => a.status === 'ABSENT').length;
    const goals = matchStats.reduce((s, m) => s + m.goals, 0);
    const assists = matchStats.reduce((s, m) => s + m.assists, 0);
    const minutesPlayed = matchStats.reduce((s, m) => s + m.minutesPlayed, 0);
    const matchesPlayed = matchStats.filter(m => m.minutesPlayed > 0).length;

    res.json({
      attendance: { total: totalEvents, present, absent, rate: totalEvents > 0 ? Math.round((present / totalEvents) * 100) : 0 },
      matchStats: { goals, assists, minutesPlayed, matchesPlayed },
      recentMatches: matchStats.slice(0, 5),
      injuries,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
