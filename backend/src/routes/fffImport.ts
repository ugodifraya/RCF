import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { requireCoach, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

interface ParsedMatch {
  title: string;
  date: string;        // ISO string
  location: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  isHome: boolean;
}

// Convertit une date française en ISO
function parseFrenchDate(dateStr: string, timeStr = '15:00'): string | null {
  const months: Record<string, number> = {
    'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
    'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11,
    'jan': 0, 'fév': 1, 'mar': 2, 'avr': 3, 'jui': 6, 'juil': 6,
    'aoû': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'déc': 11,
  };
  // Formats: "15/10/2024", "15 octobre 2024", "Sam. 15 Oct. 2024"
  const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    const [h, min] = timeStr.replace('h', ':').split(':');
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h || '15'), parseInt(min || '0'));
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  const textMatch = dateStr.toLowerCase().match(/(\d{1,2})\s+([a-zéûôèàù]+\.?)\s+(\d{4})/);
  if (textMatch) {
    const [, d, rawMonth, y] = textMatch;
    const month = months[rawMonth.replace('.', '')];
    if (month !== undefined) {
      const [h, min] = timeStr.replace('h', ':').split(':');
      const dt = new Date(parseInt(y), month, parseInt(d), parseInt(h || '15'), parseInt(min || '0'));
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
  }
  return null;
}

// Cherche le nom de l'équipe RCF dans les deux équipes
function detectHomeAway(home: string, away: string, teamName: string): boolean {
  const t = teamName.toLowerCase();
  return home.toLowerCase().includes(t) || home.toLowerCase().includes('rcf');
}

// Scraping principal
async function scrapeFFF(url: string, teamName: string): Promise<ParsedMatch[]> {
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  const matches: ParsedMatch[] = [];

  // Stratégie 1 : chercher données JSON dans les scripts (Nuxt/Next)
  $('script').each((_, el) => {
    const content = $(el).html() || '';
    // Chercher des patterns de matchs dans les données JSON embarquées
    const jsonMatches = content.match(/"dateTime"\s*:\s*"([^"]+)"|"scheduledAt"\s*:\s*"([^"]+)"|"startAt"\s*:\s*"([^"]+)"/g);
    if (jsonMatches && jsonMatches.length > 0) {
      // Tenter de parser l'objet JSON complet
      try {
        const jsonStr = content.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/)?.[1]
          || content.match(/window\.__STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/)?.[1];
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          // Chercher récursivement des objets match
          extractMatchesFromJson(parsed, matches, teamName);
        }
      } catch { /* ignore */ }
    }
  });

  if (matches.length > 0) return matches;

  // Stratégie 2 : HTML classique FFF / epreuves.fff.fr
  // Chercher les lignes de tableau ou divs de calendrier
  const competition = $('h1, .competition-name, .page-title, title').first().text().trim();

  // Pattern : divs avec classes communes FFF
  $('.match-item, .calendrier__item, .rencontre, .match, .fixture, [class*="match"], [class*="rencontre"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length < 10) return;

    const dateEl = $(el).find('[class*="date"], [class*="Date"], time').first();
    const dateText = dateEl.text().trim() || text.match(/\d{1,2}\/\d{1,2}\/\d{4}/)?.[0] || '';
    const timeText = $(el).find('[class*="hour"], [class*="time"], [class*="heure"]').first().text().trim()
      || text.match(/\d{1,2}h\d{0,2}/)?.[0] || '15h00';

    const teams = $(el).find('[class*="team"], [class*="equipe"], [class*="club"]');
    let homeTeam = '', awayTeam = '';
    if (teams.length >= 2) {
      homeTeam = teams.eq(0).text().trim();
      awayTeam = teams.eq(1).text().trim();
    }

    const venue = $(el).find('[class*="venue"], [class*="lieu"], [class*="stade"]').first().text().trim();
    const isoDate = parseFrenchDate(dateText, timeText.replace('h', ':'));

    if (isoDate && (homeTeam || awayTeam)) {
      const isHome = detectHomeAway(homeTeam, awayTeam, teamName);
      const opponent = isHome ? awayTeam : homeTeam;
      matches.push({
        title: opponent ? `vs ${opponent}` : text.substring(0, 60),
        date: isoDate,
        location: venue || '',
        homeTeam,
        awayTeam,
        competition: competition || '',
        isHome,
      });
    }
  });

  if (matches.length > 0) return matches;

  // Stratégie 3 : chercher les tableaux HTML
  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const texts = cells.map((_, c) => $(c).text().trim()).get();
    const dateText = texts.find(t => /\d{1,2}\/\d{1,2}\/\d{4}/.test(t) || /\d{1,2}\s+\w+\s+\d{4}/.test(t)) || '';
    const timeText = texts.find(t => /\d{1,2}h\d{0,2}/.test(t)) || '15h00';

    if (!dateText) return;

    // Les deux équipes sont souvent dans des colonnes séparées
    const homeTeam = texts[1] || '';
    const awayTeam = texts[3] || texts[2] || '';
    const venue = texts[texts.length - 1] || '';
    const isoDate = parseFrenchDate(dateText, timeText.replace('h', ':'));

    if (isoDate) {
      const isHome = detectHomeAway(homeTeam, awayTeam, teamName);
      const opponent = isHome ? awayTeam : homeTeam;
      matches.push({
        title: opponent ? `vs ${opponent}` : `Match du ${dateText}`,
        date: isoDate,
        location: venue,
        homeTeam,
        awayTeam,
        competition: competition || '',
        isHome,
      });
    }
  });

  // Stratégie 4 : chercher patterns de texte avec dates et noms d'équipes
  if (matches.length === 0) {
    const fullText = $('body').text().replace(/\s+/g, ' ');
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s+[A-Za-z]{3}\.?\s*(\d{1,2}h\d{0,2})\s+([^0-9\n]+?)\s+-\s+([^0-9\n]+?)(?=\d{1,2}\/|$)/g;
    let m;
    while ((m = datePattern.exec(fullText)) !== null) {
      const isoDate = parseFrenchDate(m[1], m[2]);
      if (isoDate) {
        const isHome = detectHomeAway(m[3], m[4], teamName);
        matches.push({
          title: `vs ${isHome ? m[4].trim() : m[3].trim()}`,
          date: isoDate,
          location: '',
          homeTeam: m[3].trim(),
          awayTeam: m[4].trim(),
          competition: '',
          isHome,
        });
      }
    }
  }

  return matches;
}

function extractMatchesFromJson(obj: unknown, matches: ParsedMatch[], teamName: string): void {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(item => extractMatchesFromJson(item, matches, teamName));
    return;
  }
  const record = obj as Record<string, unknown>;
  // Chercher des objets qui ressemblent à des matchs
  if ((record.homeTeam || record.clubDomicile || record.equipeLocale) &&
      (record.awayTeam || record.clubVisiteur || record.equipeVisiteuse)) {
    const homeRaw = (record.homeTeam || record.clubDomicile || record.equipeLocale || '') as Record<string, string> | string;
    const awayRaw = (record.awayTeam || record.clubVisiteur || record.equipeVisiteuse || '') as Record<string, string> | string;
    const home = typeof homeRaw === 'object' ? (homeRaw.name || homeRaw.nom || '') : homeRaw;
    const away = typeof awayRaw === 'object' ? (awayRaw.name || awayRaw.nom || '') : awayRaw;
    const dateRaw = (record.dateTime || record.scheduledAt || record.startAt || record.date || '') as string;
    const venue = typeof record.venue === 'object' ? ((record.venue as Record<string, string>)?.name || '') : (record.venue as string || '');
    const competition = typeof record.competition === 'object' ? ((record.competition as Record<string, string>)?.name || '') : (record.competition as string || '');

    if (home && away && dateRaw) {
      const isoDate = new Date(dateRaw).toISOString();
      const isHome = detectHomeAway(home, away, teamName);
      matches.push({
        title: `vs ${isHome ? away : home}`,
        date: isoDate,
        location: venue || '',
        homeTeam: home,
        awayTeam: away,
        competition: competition || '',
        isHome,
      });
      return;
    }
  }
  Object.values(record).forEach(val => extractMatchesFromJson(val, matches, teamName));
}

// Route principale : scraper fff.fr
router.post('/import-fff', requireCoach, async (req: AuthRequest, res) => {
  const { url, teamName = 'RCF' } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requise' });

  try {
    const matches = await scrapeFFF(url, teamName);
    if (matches.length === 0) {
      return res.json({
        matches: [],
        warning: "Aucun match trouvé. La page fff.fr utilise du rendu JavaScript dynamique. Essayez l'URL de la page epreuves.fff.fr de votre équipe.",
      });
    }
    // Dédupliquer et trier par date
    const unique = matches.filter((m, i, arr) =>
      arr.findIndex(x => x.date === m.date && x.title === m.title) === i
    );
    unique.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    res.json({ matches: unique.slice(0, 40) });
  } catch (err: unknown) {
    const e = err as { code?: string; response?: { status?: number } };
    console.error('FFF import error:', err);
    if (e?.code === 'ECONNREFUSED' || e?.response?.status === 403) {
      return res.status(400).json({ error: 'fff.fr a bloqué la requête. Essayez une URL de epreuves.fff.fr' });
    }
    res.status(500).json({ error: 'Impossible d\'accéder à la page. Vérifiez l\'URL.' });
  }
});

// Route : importer les matchs sélectionnés comme Events
router.post('/import-fff/confirm', requireCoach, async (req: AuthRequest, res) => {
  const { matches } = req.body as { matches: ParsedMatch[] };
  if (!matches || matches.length === 0) return res.status(400).json({ error: 'Aucun match sélectionné' });

  try {
    const created = [];
    for (const m of matches) {
      const event = await prisma.event.create({
        data: {
          title: m.title,
          type: 'MATCH',
          date: new Date(m.date),
          location: m.location || null,
          description: m.competition ? `Compétition : ${m.competition}` : null,
          createdById: req.user!.id,
        },
      });
      created.push(event);
    }
    res.status(201).json({ created: created.length });
  } catch (err) {
    console.error('FFF confirm error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'import' });
  }
});

export default router;
