# RCF Team Manager

Application de gestion d'équipe féminine de football, inspirée de SportEasy et MyCoach.

## Fonctionnalités

### Pour les joueuses
- Créer un compte (nom, prénom, poste, numéro)
- Consulter les événements (entraînements, matchs, autres)
- Indiquer sa présence : Présente / Absente / Peut-être
- Répondre aux questionnaires du coach
- Suivi cycle menstruel et douleurs (données privées)
- Consulter ses statistiques personnelles

### Pour le staff / coach
- Créer et gérer des événements
- Voir les réponses de présence de toutes les joueuses
- Créer des questionnaires (texte libre, oui/non, échelle, choix multiple)
- Voir toutes les réponses aux questionnaires
- Gérer les matchs avec score et statistiques détaillées par joueuse
- Déclarer et suivre les blessures
- Tableau de bord avec statistiques équipe complètes

## Installation

### Prérequis
- Node.js 18+
- npm

### Lancer l'application

**1. Installer les dépendances backend :**
```bash
cd backend
npm install
```

**2. Initialiser la base de données :**
```bash
cd backend
npx prisma migrate dev --name init
npx ts-node src/seed.ts
```

**3. Lancer le backend :**
```bash
cd backend
npm run dev
# Écoute sur http://localhost:3001
```

**4. Installer les dépendances frontend :**
```bash
cd frontend
npm install
```

**5. Lancer le frontend :**
```bash
cd frontend
npm run dev
# Écoute sur http://localhost:5173
```

## Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Coach | coach@rcf.fr | coach123 |
| Joueuse | emma@rcf.fr | player123 |

## Stack technique

- **Frontend** : React 18 + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend** : Node.js + Express + TypeScript
- **Base de données** : SQLite + Prisma ORM
- **Authentification** : JWT (JSON Web Tokens)
