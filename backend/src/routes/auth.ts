import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, position: true, birthDate: true, avatarUrl: true, teamId: true,
} as const;

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, position, birthDate, role, teamName, teamCategory, teamCode } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });

    const userRole = role === 'COACH' ? 'COACH' : 'PLAYER';
    const hash = await bcrypt.hash(password, 10);

    // Resolve teamId for players joining via code
    let teamId: string | null = null;
    if (userRole === 'PLAYER' && teamCode) {
      const team = await prisma.team.findUnique({ where: { inviteCode: teamCode.toUpperCase() } });
      if (!team) return res.status(400).json({ error: 'Code équipe invalide' });
      teamId = team.id;
    }

    const user = await prisma.user.create({
      data: {
        email, password: hash, firstName, lastName,
        role: userRole,
        position: position || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        teamId,
      },
      select: USER_SELECT,
    });

    // Coach: create team automatically
    if (userRole === 'COACH' && teamName) {
      let code = generateCode();
      while (await prisma.team.findUnique({ where: { inviteCode: code } })) code = generateCode();
      await prisma.team.create({
        data: { name: teamName, category: teamCategory || null, inviteCode: code, coachId: user.id },
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, select: { ...USER_SELECT, password: true } });
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const { password: _pwd, ...safeUser } = user;
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token, user: safeUser });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { ...USER_SELECT, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
