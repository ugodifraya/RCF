import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const FFF_API = 'https://api-dofa.prd-aws.fff.fr';
const FFF_HEADERS = {
  'Accept': 'application/ld+json, application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; RCF-TeamManager/1.0)',
};

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const d = data as Record<string, unknown>;
  return (d['hydra:member'] || d['items'] || d['member'] || []) as unknown[];
}

interface FFFMatch {
  title: string;
  date: string;
  location: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  isHome: boolean;
}

function parseCalendarItem(item: Record<string, unknown>, teamId: string): FFFMatch | null {
  const dateRaw = (item.dateTimeMatch || item.date_heure || item.date || '') as string;
  if (!dateRaw) return null;

  let isoDate: string;
  try { isoDate = new Date(dateRaw).toISOString(); } catch { return null; }

  const homeClub = (item.clubLocal || item.club_local || {}) as Record<string, unknown>;
  const awayClub = (item.clubVisiteur || item.club_visiteur || {}) as Record<string, unknown>;
  const homeName = (homeClub.nom || homeClub.name || item.nomLocal || '') as string;
  const awayName = (awayClub.nom || awayClub.name || item.nomVisiteur || '') as string;

  const venue = (item.lieuRencontre || item.lieu || item.lieuMatch || '') as string;
  const compObj = (item.competition || item.epreuve || {}) as Record<string, unknown>;
  const competition = (compObj.nom || compObj.name || compObj.libelle || '') as string;

  // Detect if our team is home
  const homeEqNo = (homeClub.equipe as Record<string, unknown>)?.eq_no || (item.equipeLocal as Record<string, unknown>)?.eq_no || '';
  const isHome = String(homeEqNo) === String(teamId) || homeName.toLowerCase().includes('rcf');

  const opponent = isHome ? awayName : homeName;

  return {
    title: opponent ? `vs ${opponent}` : 'Match',
    date: isoDate,
    location: venue,
    homeTeam: homeName,
    awayTeam: awayName,
    competition,
    isHome,
  };
}

// ── Rechercher des clubs par nom ─────────────────────────────────────────────
router.get('/search-clubs', async (req, res) => {
  const { q } = req.query;
  if (!q || String(q).length < 2) return res.status(400).json({ error: 'Nom trop court' });

  try {
    const { data } = await axios.get(`${FFF_API}/api/clubs`, {
      params: { nom: q, page: 1 },
      headers: FFF_HEADERS,
      timeout: 10000,
    });
    const list = extractList(data) as Record<string, unknown>[];
    const clubs = list.slice(0, 20).map(c => ({
      id: c.cl_no || c.id || c.clNo,
      name: c.nom || c.name || c.libelle,
      city: c.ville || c.city || '',
      logo: c.logo || '',
    }));
    res.json(clubs);
  } catch (err) {
    console.error('FFF search clubs error:', err);
    res.status(500).json({ error: 'Impossible de contacter l\'API FFF' });
  }
});

// ── Récupérer les équipes d'un club ─────────────────────────────────────────
router.get('/clubs/:clNo/teams', async (req, res) => {
  try {
    const { data } = await axios.get(`${FFF_API}/api/clubs/${req.params.clNo}/equipes`, {
      headers: FFF_HEADERS,
      timeout: 10000,
    });
    const list = extractList(data) as Record<string, unknown>[];
    const teams = list.map(t => ({
      id: t.eq_no || t.id || t.eqNo,
      name: t.nom || t.libelle || t.name,
      category: t.categorie || t.division || '',
    }));
    res.json(teams);
  } catch (err) {
    console.error('FFF get teams error:', err);
    res.status(500).json({ error: 'Impossible de récupérer les équipes' });
  }
});

// ── Aperçu du calendrier d'une équipe ───────────────────────────────────────
router.get('/clubs/:clNo/teams/:eqNo/calendar', async (req, res) => {
  try {
    const { data } = await axios.get(
      `${FFF_API}/api/clubs/${req.params.clNo}/equipes/${req.params.eqNo}/calendrier`,
      { headers: FFF_HEADERS, timeout: 10000 },
    );
    const list = extractList(data) as Record<string, unknown>[];
    const matches = list
      .map(item => parseCalendarItem(item as Record<string, unknown>, req.params.eqNo))
      .filter(Boolean) as FFFMatch[];

    // Dédoublonner par date+titre
    const unique = matches.filter((m, i, arr) =>
      arr.findIndex(x => x.date === m.date && x.title === m.title) === i
    );
    unique.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    res.json(unique.slice(0, 50));
  } catch (err) {
    console.error('FFF calendar error:', err);
    res.status(500).json({ error: 'Impossible de récupérer le calendrier FFF' });
  }
});

// ── Importer le calendrier en base (matchs) ──────────────────────────────────
router.post('/import', requireCoach, async (req: AuthRequest, res) => {
  const { clNo, eqNo, matches, saveSettings, clubName, teamName } = req.body as {
    clNo: string; eqNo: string; matches: FFFMatch[];
    saveSettings?: boolean; clubName?: string; teamName?: string;
  };

  if (!matches || matches.length === 0) return res.status(400).json({ error: 'Aucun match à importer' });

  try {
    // Sauvegarder les settings si demandé
    if (saveSettings && clNo && eqNo) {
      for (const [key, value] of [['fffClubId', clNo], ['fffTeamId', eqNo], ['fffClubName', clubName || ''], ['fffTeamName', teamName || '']]) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: value || '' },
          create: { key, value: value || '' },
        });
      }
    }

    let created = 0;
    for (const m of matches) {
      // Créer comme Match (pas Event) pour avoir le détail votes/stats
      const existing = await prisma.match.findFirst({
        where: { date: new Date(m.date), opponent: m.isHome ? m.awayTeam : m.homeTeam },
      });
      if (existing) continue;

      await prisma.match.create({
        data: {
          date: new Date(m.date),
          opponent: m.isHome ? m.awayTeam : m.homeTeam,
          homeAway: m.isHome ? 'HOME' : 'AWAY',
          location: m.location || null,
          competition: m.competition || null,
          createdById: req.user!.id,
        },
      });
      created++;
    }

    res.json({ created });
  } catch (err) {
    console.error('FFF import error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'import' });
  }
});

// ── Lire les settings FFF ────────────────────────────────────────────────────
router.get('/settings', async (_req, res) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: ['fffClubId', 'fffTeamId', 'fffClubName', 'fffTeamName'] } },
    });
    const map: Record<string, string> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json(map);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Sauvegarder les settings FFF (coach) ────────────────────────────────────
router.put('/settings', requireCoach, async (req: AuthRequest, res) => {
  const { fffClubId, fffTeamId, fffClubName, fffTeamName } = req.body;
  try {
    for (const [key, value] of Object.entries({ fffClubId, fffTeamId, fffClubName, fffTeamName })) {
      if (value !== undefined) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
