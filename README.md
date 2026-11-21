# Miamee

Journal alimentaire photo, pour un seul utilisateur, sur iPhone.

L'objectif de la version actuelle est de **mesurer et documenter** ce qui est mangé :
calories et macronutriments, avec l'heure exacte du repas ou de la collation.
Pas de recommandation, pas d'objectif de poids, pas de jugement.

Le plan de construction, les décisions d'architecture et les critères de vérification
de chaque phase sont dans [PLAN.md](PLAN.md).

## Pile technique

| Rôle | Choix |
|---|---|
| Interface | PWA installable — Vite, React, TypeScript, Tailwind |
| Hébergement | GitHub Pages, déployé par GitHub Actions |
| Données | Supabase — Postgres, authentification, stockage des photos |
| Reconnaissance d'image | Gemini, appelé depuis une fonction serveur Supabase |
| Produits emballés | code-barres via Open Food Facts, sinon lecture de l'étiquette |
| Aliments génériques | extrait de la table CIQUAL de l'ANSES |

Aucune clé secrète ne vit dans ce dépôt. La clé Gemini est stockée comme secret de
fonction serveur chez Supabase et n'est jamais envoyée au téléphone.

## Développement

```bash
npm install
cp .env.example .env   # puis renseigner les deux variables
npm run dev
```

## Compilation

```bash
npm run build
```
