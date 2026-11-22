# Miamee — plan de construction

Journal alimentaire photo pour iPhone. Objectif de la phase actuelle : **mesurer et documenter**
ce qui est mangé. Pas de recommandation, pas de jugement, pas d'objectif de poids.

## Décisions arrêtées

| Sujet | Choix | Pourquoi |
|---|---|---|
| Forme de l'app | PWA installable | gratuit, aucun compte développeur Apple, déploiement immédiat |
| Hébergement | GitHub Pages, dépôt public `miamee` | gratuit ; aucun secret dans le code |
| Base de données | Supabase (projet dédié, palier gratuit) | Postgres + auth + stockage photos + fonctions serveur |
| Reconnaissance d'image | Gemini `gemini-3.5-flash-lite`, palier gratuit | seul fournisseur avec un palier gratuit pour l'image |
| Clé Gemini | projet AI Studio au **palier gratuit**, facturation désactivée | le palier se décide au niveau du *compte de facturation*, pas du projet : à zéro crédit prépayé, toutes les clés de tous ses projets renvoient 402 ensemble |
| Produits emballés | code-barres → Open Food Facts, **et** photo du tableau nutritionnel → Gemini | le code-barres est exact et gratuit ; la photo couvre le reste |
| Aliments génériques | extrait de la table CIQUAL (ANSES) | référence française, libre, évite d'appeler l'IA |
| Coût mensuel visé | 0 $ | tous les paliers gratuits |

Hors périmètre pour l'instant, mais le schéma ne doit pas les bloquer : objectifs de poids ou de
masse, import de la balance connectée, recommandations alimentaires.

## Principe de conception central

Chaque ligne du journal fige ses propres valeurs nutritionnelles au moment de l'enregistrement,
et porte un drapeau **pesé** ou **estimé**.

- *Figer* : si une valeur de référence est corrigée plus tard, l'historique déjà saisi ne bouge pas.
- *Pesé / estimé* : une photo seule donne ±20 à 40 % ; un poids ou une étiquette donne quelques
  pourcents. Dans six mois, au moment de fixer des objectifs, il faudra savoir quelles données de
  l'historique sont solides.

Deuxième principe : **rien n'est enregistré sans passage par un écran de validation**. L'IA propose,
l'utilisateur corrige, puis on écrit en base.

## Les quantités : données, estimées, ou les deux

Une description de repas peut arriver sous trois formes, et les trois doivent marcher :

- **tout pesé** — « pomme de terre 180 g, beurre 10 g » : aucune estimation, tout est marqué `pesé` ;
- **rien de pesé** — « une purée de pomme de terre au beurre avec des champignons » : les quantités
  sont estimées depuis la photo si elle existe, sinon depuis une portion standard ;
- **partiellement pesé** — « cette pomme de terre pèse 180 g, deux cuillères à café de beurre, 5 gros
  champignons » : le poids donné est repris tel quel, les autres sont déduits des mesures ménagères
  ou estimés depuis la photo.

Conséquence : **une même entrée mélange des lignes `pesé` et des lignes `estimé`**. Le drapeau vit sur
la ligne, jamais sur l'entrée. Une quantité fournie par l'utilisateur n'est jamais réécrite par le
modèle.

## L'appariement avec tes produits n'est jamais automatique

Photographier un paquet enregistre un produit dans la bibliothèque. Cela **ne veut pas dire** que ce
produit se retrouve dans le prochain plat photographié. Un produit enregistré est un *candidat*,
jamais une certitude.

L'ordre des opérations est délibéré : **le modèle décrit, le code apparie.**

1. La photo du plat est analysée sans que la bibliothèque de produits soit envoyée au modèle. Il
   renvoie ce qu'il observe, en toute indépendance : « coquillettes », pas « pâtes ».
2. Le code cherche ensuite dans la bibliothèque les produits compatibles avec le **type observé**.
3. Trois issues :
   - *un seul produit compatible* → il est proposé, pré-sélectionné et signalé ; tu peux le refuser ;
   - *aucun produit compatible* → les valeurs génériques du type observé sont utilisées. Un paquet de
     spaghetti enregistré ne sera jamais appliqué à une assiette de coquillettes ;
   - *plusieurs produits compatibles, ou type visuellement indistinct* → l'app demande : « ces pâtes,
     c'est lesquelles ? », avec tes produits et l'option générique.

Pourquoi ne pas simplement envoyer la liste des produits au modèle et le laisser choisir : il
choisirait presque toujours quelque chose dans la liste fournie, même à tort. Séparer
l'identification de l'appariement supprime ce biais, coûte moins de tokens, et rend la règle
vérifiable.

Une découverte faite en chargeant les données a obligé à compléter ce mécanisme : **la table
Ciqual n'a pas d'entrée « coquillettes » ni « spaghetti »**, toutes les formes de pâtes renvoyant
à « Pâtes sèches standard ». L'aliment générique ne suffisait donc pas à distinguer deux paquets.
Chaque produit porte en plus la **forme précise observée** (`products.kind`), et un produit n'est
candidat que si cette forme correspond à ce qui est vu dans l'assiette.

Le modèle ne fournit jamais de calories, seulement une identification et une estimation de poids.
Les valeurs viennent de la table de référence, ce qui les rend stables et vérifiables.

## Modèle de données

Référentiels :

- `foods` — aliments génériques issus de CIQUAL : nom, catégorie, valeurs pour 100 g.
- `products` — **les produits de marque scannés par l'utilisateur** : code-barres, marque, type
  (« penne complètes »), valeurs pour 100 g, origine (`openfoodfacts` / `photo_etiquette` /
  `manuel`), photo de l'étiquette. C'est ce qui permet qu'un plat de pâtes soit calculé avec les
  valeurs de *ces* pâtes-là.
- `portions` — mesures ménagères converties en grammes : « c. à café de beurre » = 5 g,
  « gros champignon de Paris » = 20 g, etc.

Journal :

- `entries` — un repas ou une collation : horodatage exact (`eaten_at`), type (petit-déj / déjeuner /
  dîner / collation, pré-deviné d'après l'heure et modifiable), titre, note, photo, méthode de
  saisie.
- `entry_items` — les lignes : libellé, référence vers `foods` ou `products`, quantité en grammes,
  quantité affichée (« 2 c. à café »), **valeurs nutritionnelles figées**, drapeau estimé, indice de
  confiance, réponse brute du modèle.

Vues SQL : totaux par jour, par semaine, par mois. Sécurité : RLS, chaque ligne filtrée sur le
compte de l'utilisateur.

## Fonctions serveur (Supabase Edge Functions)

La clé Gemini vit **uniquement** ici, jamais dans le code envoyé au téléphone.

- `analyze-dish` — photo d'un plat → liste d'ingrédients avec quantités estimées et alternatives.
- `read-label` — photo d'un tableau nutritionnel → valeurs pour 100 g + marque + nom.
- `parse-text` — phrase libre → même structure que `analyze-dish`.

Le code-barres est interrogé directement depuis le téléphone (Open Food Facts accepte les appels
navigateur) : pas de fonction serveur, pas de quota consommé.

## Phases

### Phase 0 — Fondations
Dépôt public `miamee`, squelette Vite + React + TypeScript + Tailwind + PWA, déploiement GitHub
Pages par GitHub Actions, projet Supabase dédié, clé Gemini.
**Vérification** : la page s'ouvre sur l'iPhone en HTTPS ; un appel test à Gemini depuis la fonction
serveur renvoie du texte.

### Phase 1 — Journal manuel, zéro IA
Schéma SQL complet, RLS, vues de totaux, chargement de l'extrait CIQUAL et des mesures ménagères,
connexion par lien magique, écran « Aujourd'hui », saisie manuelle (aliment + poids, ou macros
saisies directement), heure et type de repas.
**Vérification** : saisir « 180 g de pomme de terre » puis « 32 g de protéines » depuis l'iPhone ;
le total du jour correspond au calcul fait à la main.

### Phase 2 — Vues dans le temps
Jour, semaine, mois. Graphique d'évolution, moyennes, répartition des macros, part des lignes
estimées.
**Vérification** : le total de la semaine égale la somme des jours, contrôlée sur trois jours saisis.

### Phase 3 — Produits emballés
Scan du code-barres → Open Food Facts → fiche produit préremplie → validation → enregistrement dans
`products`. En parallèle : photo du tableau nutritionnel → lecture par Gemini → même écran de
validation, pour les produits absents de la base, les emballages de boucherie et les produits sans
code-barres.
**Vérification** : scanner un vrai paquet de pâtes ; la fiche « marque + type + kcal/100 g » existe
en base et réapparaît en suggestion le lendemain à la saisie du mot « pâtes ».

### Phase 4 — Photo de plat
Photo → détection des ingrédients avec quantités estimées et alternatives → écran de validation où
les produits déjà enregistrés sont proposés en priorité → enregistrement.
**Vérification** : photographier une assiette de purée ; les ingrédients ressortent, deux poids sont
corrigés à la main, l'entrée est enregistrée avec le drapeau estimé.

### Phase 5 — Texte libre et dictée
Phrase libre, éventuellement accompagnée d'une photo, transformée en liste d'ingrédients pesés.
Dictée assurée par le clavier iOS, rien à coder.
**Vérification** : la phrase « une purée avec cette pomme de terre qui pèse 180 g, deux cuillères à
café de beurre, 5 gros champignons de Paris avec un peu d'huile d'olive et une côte de porc » produit
cinq lignes avec des grammages cohérents.

### Phase 6 — Finitions
Installation sur l'écran d'accueil, compression des photos avant envoi, file d'attente hors-ligne,
correction et suppression d'une entrée, duplication d'un repas fréquent.
**Vérification** : en mode avion, un repas saisi part tout seul au retour du réseau.

## Hypothèses à corriger si besoin

- Interface en français, système métrique (g, ml), avec mesures ménagères en complément.
- Macros suivies : calories, protéines, glucides dont sucres, lipides dont saturés, fibres, sodium.
- Un seul compte, connexion par lien magique envoyé par courriel, sans mot de passe.
- Photos conservées, réduites à 1024 px avant envoi (environ 150 ko, soit près de 6 000 photos dans
  le 1 Go gratuit).
- Horodatage stocké en UTC, affiché dans le fuseau du téléphone.
