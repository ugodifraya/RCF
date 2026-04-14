import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* GET /api/teams/my — coach gets their team info */
router.get('/my', requireAuth, requireCoach, async (req: AuthRequest, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { coachId: req.user!.id },
      include: {
        members: {
          select: { id: true, firstName: true, lastName: true, position: true, avatarUrl: true, role: true },
        },
      },
    });
    if (!team) return res.status(404).json({ error: 'Aucune équipe trouvée' });
    res.json(team);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* GET /api/teams/info/:code — public: get team name by invite code */
router.get('/info/:code', async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { inviteCode: req.params.code.toUpperCase() },
      select: { id: true, name: true, category: true, inviteCode: true },
    });
    if (!team) return res.status(404).json({ error: 'Code invalide' });
    res.json(team);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* POST /api/teams/regenerate-code — coach regenerates invite code */
router.post('/regenerate-code', requireAuth, requireCoach, async (req: AuthRequest, res) => {
  try {
    let code = generateCode();
    // Ensure uniqueness
    while (await prisma.team.findUnique({ where: { inviteCode: code } })) {
      code = generateCode();
    }
    const team = await prisma.team.update({
      where: { coachId: req.user!.id },
      data: { inviteCode: code },
    });
    res.json({ inviteCode: team.inviteCode });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* POST /api/teams/join — player joins a team with invite code */
router.post('/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code manquant' });

    const team = await prisma.team.findUnique({
      where: { inviteCode: code.toUpperCase() },
    });
    if (!team) return res.status(404).json({ error: 'Code invalide ou équipe introuvable' });

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { teamId: team.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, position: true, birthDate: true, avatarUrl: true, teamId: true },
    });
    res.json({ user, team: { id: team.id, name: team.name, category: team.category } });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
