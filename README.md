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

## Ressources du projet

| | |
|---|---|
| App en ligne | https://jennsen-spec.github.io/miamee/ |
| Base de données | projet Supabase `miamee`, région `ca-central-1` |
| Déploiement | GitHub Actions → GitHub Pages, à chaque push sur `main` |

## Base de données

Le schéma vit dans le projet Supabase, appliqué sous forme de migrations nommées :
`schema_journal_alimentaire`, `vues_totaux`, `normalisation_des_noms`,
`mesures_menageres_initiales`, `restreindre_handle_new_user`.

| Table | Rôle |
|---|---|
| `foods` | 2 298 aliments génériques, table Ciqual 2020 de l'ANSES, valeurs pour 100 g |
| `products` | les produits de marque scannés par l'utilisateur ; `food_id` porte l'appariement |
| `portions` | mesures ménagères (cuillère à café, gros champignon…) converties en grammes |
| `entries` | un repas ou une collation, avec son heure exacte |
| `entry_items` | les lignes, **valeurs nutritionnelles figées** et drapeau pesé/estimé |
| `daily_totals`, `weekly_totals` | vues de totaux, calculées dans le fuseau du profil |

Chaque table est protégée par RLS : un compte ne voit que ses propres données. Les
référentiels `foods` et `portions` sont en lecture seule via l'API.

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
