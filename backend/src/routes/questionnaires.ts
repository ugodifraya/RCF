import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const isStaff = ['COACH', 'ADMIN'].includes(req.user!.role);
    const questionnaires = await prisma.questionnaire.findMany({
      where: isStaff ? {} : { isActive: true },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { questions: true, responses: true } },
        responses: isStaff ? { include: { user: { select: { firstName: true, lastName: true } } } }
          : { where: { userId: req.user!.id }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(questionnaires);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        responses: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            answers: { include: { question: true } },
          },
        },
      },
    });
    if (!questionnaire) return res.status(404).json({ error: 'Questionnaire introuvable' });
    res.json(questionnaire);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireCoach, async (req: AuthRequest, res) => {
  try {
    const { title, description, dueDate, questions } = req.body;
    if (!title || !questions?.length) return res.status(400).json({ error: 'Titre et questions requis' });

    const questionnaire = await prisma.questionnaire.create({
      data: {
        title, description, dueDate: dueDate ? new Date(dueDate) : null,
        createdById: req.user!.id,
        questions: {
          create: questions.map((q: { text: string; type: string; options?: string[]; order: number }) => ({
            text: q.text, type: q.type, options: q.options ? JSON.stringify(q.options) : null, order: q.order,
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    res.status(201).json(questionnaire);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', requireCoach, async (_req, res) => {
  try {
    await prisma.questionnaire.update({ where: { id: _req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/respond', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { answers } = req.body;
    const existing = await prisma.questionnaireResponse.findUnique({
      where: { questionnaireId_userId: { questionnaireId: req.params.id, userId: req.user!.id } },
    });
    if (existing) return res.status(400).json({ error: 'Vous avez déjà répondu à ce questionnaire' });

    const response = await prisma.questionnaireResponse.create({
      data: {
        questionnaireId: req.params.id,
        userId: req.user!.id,
        answers: {
          create: answers.map((a: { questionId: string; answer: string }) => ({ questionId: a.questionId, answer: a.answer })),
        },
      },
      include: { answers: true },
    });
    res.status(201).json(response);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
