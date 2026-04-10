import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        attendances: {
          where: { userId: req.user!.id },
          select: { status: true, note: true },
        },
        _count: { select: { attendances: true } },
      },
      orderBy: { date: 'asc' },
    });
    res.json(events);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        attendances: {
          include: { user: { select: { id: true, firstName: true, lastName: true, position: true, number: true } } },
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Événement introuvable' });
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { title, type, date, endDate, location, description } = req.body;
    if (!title || !type || !date) return res.status(400).json({ error: 'Champs obligatoires manquants' });

    const event = await prisma.event.create({
      data: { title, type, date: new Date(date), endDate: endDate ? new Date(endDate) : null, location, description, createdById: req.user!.id },
    });

    const players = await prisma.user.findMany({ where: { role: 'PLAYER' }, select: { id: true } });
    for (const p of players) {
      await prisma.attendance.upsert({
        where: { userId_eventId: { userId: p.id, eventId: event.id } },
        update: {},
        create: { userId: p.id, eventId: event.id, status: 'PENDING' },
      });
    }
    res.status(201).json(event);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { title, type, date, endDate, location, description } = req.body;
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { title, type, date: new Date(date), endDate: endDate ? new Date(endDate) : null, location, description },
    });
    res.json(event);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', requireCoach, async (_req, res) => {
  try {
    await prisma.attendance.deleteMany({ where: { eventId: _req.params.id } });
    await prisma.event.delete({ where: { id: _req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/attendance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, note } = req.body;
    const attendance = await prisma.attendance.upsert({
      where: { userId_eventId: { userId: req.user!.id, eventId: req.params.id } },
      update: { status, note },
      create: { userId: req.user!.id, eventId: req.params.id, status, note },
    });
    res.json(attendance);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
