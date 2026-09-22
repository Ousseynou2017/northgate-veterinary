# _fonts — les polices de la bibliothèque

Deux fichiers, auto-hébergés, **licence SIL Open Font License 1.1** (usage commercial autorisé,
y compris sur les sites de tes clients).

| Fichier | Famille | Poids | Axes | Source |
|---|---|---|---|---|
| `newsreader-latin.woff2` | Newsreader | 56,7 ko | `wght 200–800` — **sans l'axe `opsz`** | [github.com/productiontype/Newsreader](https://github.com/productiontype/Newsreader) — récupéré via fonts.gstatic.com |
| `source-sans-3-latin.woff2` | Source Sans 3 | 28,1 ko | `wght 200–900` | [github.com/adobe-fonts/source-sans](https://github.com/adobe-fonts/source-sans) — récupéré via fonts.gstatic.com |

**84,8 ko à deux**, pour tout le site. Ce sont des polices **variables** : un seul fichier par
famille couvre toutes les graisses, il n'y a pas de requête supplémentaire pour du gras.

### Pourquoi Newsreader est pris SANS l'axe `opsz`

Poids du sous-ensemble latin, fichiers récupérés et pesés :

| Requête `fonts.googleapis.com/css2` | Poids |
|---|---|
| `Newsreader:opsz,wght@6..72,200..800` | 128,9 ko |
| `Newsreader:wght@200..800` ← **celui qui est ici** | 56,7 ko |
| `Newsreader:wght@500` (statique) | 23,1 ko, perd toutes les graisses |

La police de titre est **préchargée**, donc sur le chemin critique : l'axe `opsz` coûterait
72,2 ko dessus pour un réglage optique qui ne se voit pas sur des titres de 28 à 64 px.
Ne pas « améliorer » ce point sans repeser les trois fichiers.

La graisse des titres est **500**, pas 700 : c'est le serif qui porte le poids visuel.
Elle est posée une seule fois, par `--weight-display` dans `_tokens.css`.

## Sous-ensemble latin

Les fichiers sont subsettés au latin de base, qui couvre **tout le français** :
`é è ê ë à â ä ç î ï ô ö ù û ü ÿ œ æ « » € ’`

Si un projet a besoin de plus (grec, cyrillique, vietnamien, polonais…), il faut récupérer le
sous-ensemble correspondant et ajouter un `@font-face` avec le bon `unicode-range`.

## Ce qu'il faut faire sur un projet client

1. Copier `_fonts/` dans les assets servis du projet.
2. **Précharger la police de titre** dans le `<head>`. **Ce n'est pas une optimisation, c'est
   une correction de défaut** — mesuré sur la vitrine, build de production, Lighthouse mobile :

   | | sans preload | avec preload |
   |---|---|---|
   | CLS | **0,309** | **0** |
   | Performance | 74 | **96** |
   | LCP | 2,1 s | 1,7 s |

   Sans preload, la substitution de la police de titre décale toute la page au chargement.
   Le lien à poser :
   ```html
   <link rel="preload" href="/fonts/newsreader-latin.woff2" as="font" type="font/woff2" crossorigin>
   ```
   Ne précharge **que** celle-là : précharger les deux fait perdre le bénéfice.
3. Vérifier que `font-display: swap` est bien en place (il l'est dans `_tokens.css`).

## Obligation de licence

L'OFL demande que la licence accompagne les fichiers en cas de redistribution. Si tu livres le
dépôt au client, garde ce README et ajoute le texte complet de l'OFL 1.1 récupéré depuis les
dépôts ci-dessus. La police ne peut pas être vendue seule, ce qui n'arrive jamais dans notre cas.

## Changer de polices

Dépose les nouveaux `.woff2` ici, remplace les deux blocs `@font-face` en haut de
`_tokens.css` et les deux variables `--brand-font-display` / `--brand-font-body`.
Aucun bloc ne référence une police en dur.
