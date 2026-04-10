import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const coachPassword = await bcrypt.hash('coach123', 10);
  const playerPassword = await bcrypt.hash('player123', 10);

  const coach = await prisma.user.upsert({
    where: { email: 'coach@rcf.fr' },
    update: {},
    create: { email: 'coach@rcf.fr', password: coachPassword, firstName: 'Sophie', lastName: 'Martin', role: 'COACH' },
  });

  const players = [
    { email: 'emma@rcf.fr', firstName: 'Emma', lastName: 'Dubois', position: 'Attaquante', number: 9 },
    { email: 'lea@rcf.fr', firstName: 'Léa', lastName: 'Bernard', position: 'Milieu', number: 8 },
    { email: 'julie@rcf.fr', firstName: 'Julie', lastName: 'Thomas', position: 'Défenseure', number: 4 },
    { email: 'camille@rcf.fr', firstName: 'Camille', lastName: 'Robert', position: 'Gardienne', number: 1 },
    { email: 'marie@rcf.fr', firstName: 'Marie', lastName: 'Petit', position: 'Milieu', number: 6 },
    { email: 'alice@rcf.fr', firstName: 'Alice', lastName: 'Durand', position: 'Attaquante', number: 11 },
  ];

  const createdPlayers = [];
  for (const p of players) {
    const player = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: { ...p, password: playerPassword, role: 'PLAYER' },
    });
    createdPlayers.push(player);
  }

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const event1 = await prisma.event.create({
    data: {
      title: 'Entraînement Tactique',
      type: 'TRAINING',
      date: nextWeek,
      location: 'Stade Municipal',
      description: 'Travail sur les phases offensives',
      createdById: coach.id,
    },
  });

  const event2 = await prisma.event.create({
    data: {
      title: 'Match vs FC Bordeaux',
      type: 'MATCH',
      date: nextTwoWeeks,
      location: 'Stade Municipal',
      description: 'Match de championnat – journée 12',
      createdById: coach.id,
    },
  });

  for (const player of createdPlayers) {
    await prisma.attendance.upsert({
      where: { userId_eventId: { userId: player.id, eventId: event1.id } },
      update: {},
      create: { userId: player.id, eventId: event1.id, status: 'PENDING' },
    });
    await prisma.attendance.upsert({
      where: { userId_eventId: { userId: player.id, eventId: event2.id } },
      update: {},
      create: { userId: player.id, eventId: event2.id, status: 'PENDING' },
    });
  }

  const questionnaire = await prisma.questionnaire.create({
    data: {
      title: 'Bilan de forme – Semaine 1',
      description: 'Évaluation hebdomadaire de votre état physique et mental',
      createdById: coach.id,
      questions: {
        create: [
          { text: 'Comment évaluez-vous votre forme physique cette semaine ?', type: 'SCALE', order: 1 },
          { text: 'Avez-vous ressenti des douleurs ou gênes musculaires ?', type: 'YES_NO', order: 2 },
          { text: 'Quel est votre niveau de motivation en ce moment ?', type: 'SCALE', order: 3 },
          { text: 'Avez-vous des remarques particulières pour le coach ?', type: 'TEXT', order: 4 },
          { text: 'Quel aspect de votre jeu souhaitez-vous améliorer ?', type: 'MULTIPLE_CHOICE', options: JSON.stringify(['Technique', 'Physique', 'Tactique', 'Mental']), order: 5 },
        ],
      },
    },
  });

  const pastMatch = await prisma.match.create({
    data: {
      date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      opponent: 'AS Nantes',
      location: 'Stade de la Beaujoire',
      homeAway: 'AWAY',
      scoreHome: 1,
      scoreAway: 2,
      competition: 'Championnat D2',
      createdById: coach.id,
    },
  });

  await prisma.playerMatchStat.createMany({
    data: [
      { matchId: pastMatch.id, userId: createdPlayers[0].id, minutesPlayed: 90, goals: 2, assists: 0, starter: true, rating: 8.5 },
      { matchId: pastMatch.id, userId: createdPlayers[1].id, minutesPlayed: 90, goals: 0, assists: 1, starter: true, rating: 7.0 },
      { matchId: pastMatch.id, userId: createdPlayers[2].id, minutesPlayed: 90, goals: 0, assists: 0, yellowCards: 1, starter: true, rating: 6.5 },
      { matchId: pastMatch.id, userId: createdPlayers[3].id, minutesPlayed: 90, goals: 0, assists: 0, starter: true, rating: 7.5 },
      { matchId: pastMatch.id, userId: createdPlayers[4].id, minutesPlayed: 72, goals: 0, assists: 1, starter: true, rating: 7.0 },
      { matchId: pastMatch.id, userId: createdPlayers[5].id, minutesPlayed: 18, goals: 0, assists: 0, starter: false, rating: 6.0 },
    ],
  });

  console.log('✅ Seed terminé!');
  console.log('  Coach: coach@rcf.fr / coach123');
  console.log('  Joueuse: emma@rcf.fr / player123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
