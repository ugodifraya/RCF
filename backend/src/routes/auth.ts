import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, position, number } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hash, firstName, lastName, position, number: number ? parseInt(number) : null },
    });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, position: user.position, number: user.number } });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, position: user.position, number: user.number } });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, position: true, number: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
