# Brut vers Net — suivi du taux de service

Magasin Général et Logistiport, distribution et réception. L'outil part du taux
**brut** tel que le KPI le calcule, retire ce qui est **documenté** par une pièce,
puis ce que **votre analyse** établit, et affiche les trois niveaux côte à côte.

---

## Ouvrir

Double-cliquez sur **`index.html`**. C'est tout : aucun serveur, aucune
installation. Les six fichiers JavaScript et la feuille de style se chargent
depuis le dossier.

Pour envoyer l'outil à quelqu'un, ou le poser sur un partage réseau, prenez
plutôt **`dist/brut-vers-net.html`** : c'est le même outil en un seul fichier.

---

## L'arborescence

```
brut-vers-net/
├── index.html            le squelette : le corps des cinq onglets, les six <script>
├── css/
│   └── styles.css        toute la mise en forme, thèmes clair et sombre compris
├── js/
│   ├── 1-noyau.js        état, modèle de données, calcul des trois taux, contrôles
│   ├── 2-reprise.js      historique S27 → S36 2026, embarqué en dur
│   ├── 3-stockage.js     Firestore, repli REST, repli navigateur
│   ├── 4-regles.js       moteur de règles : ordre, reprise des saisies, rejeu
│   ├── 5-rendu.js        tableau de bord, graphiques, tableaux, barre de filtres
│   └── 6-import.js       imports PowerBI / SAP / relevé, volets, Excel, démarrage
├── build.sh              assemble les deux formes distribuables
├── dist/
│   ├── brut-vers-net.html   un seul fichier, complet
│   └── artefact.html        le même sans squelette, pour l'artefact claude.ai
└── LISEZ-MOI.md
```

**L'ordre de chargement est celui des numéros.** Le noyau d'abord, le démarrage
en dernier. Le changer casse l'outil : `6-import.js` appelle au chargement des
fonctions déclarées dans les cinq précédents.

Les six fichiers partagent une seule portée globale — ce sont des `<script>`
classiques, pas des modules. Une fonction déclarée dans `1-noyau.js` est
appelable depuis `6-import.js` sans rien exporter ni importer. C'est voulu :
pas d'outil de compilation, pas de dépendances, rien à installer.

---

## Modifier

La source, c'est l'arborescence. On modifie `js/*.js`, `css/styles.css` ou
`index.html`, on recharge la page, on voit le résultat.

Quand c'est bon :

```sh
./build.sh
```

Le script vérifie la syntaxe des six fichiers un par un, puis écrit les deux
formes de `dist/`. Il ne produit rien si un fichier ne compile pas — un
`<script>` séparé est parsé séparément, donc une erreur dans l'un laisserait les
autres tourner à moitié, ce qui est pire qu'une page blanche.

### Où trouver quoi

| Vous cherchez | Fichier | Repères |
|---|---|---|
| le calcul des trois taux | `1-noyau.js` | `cellStats`, `agg` |
| la sélection d'une plage de dates | `1-noyau.js` | `dansPlage`, `coupee`, `effCells`, `syncRange` |
| le retard en jours ouvrés | `1-noyau.js` | `joursOuvres`, `retardKo`, `feriesSet` |
| les contrôles de cohérence | `1-noyau.js` | `controls` |
| la lecture de l'export PowerBI | `6-import.js` | `analyseExport`, `applyExport` |
| le dépôt de fichiers « Mettre à jour » | `6-import.js` | `openMaj`, `deposeTout` |
| l'ordre des règles, la reprise des saisies | `4-regles.js` | `rejouerRegles`, `impactsRegles` |
| le tableau de bord | `5-rendu.js` | `renderDash`, `drawEvo`, `drawVol` |
| la barre de filtres | `5-rendu.js` | `renderRange` |

---

## Les données

Un document par **période × site × service**, dans la collection `suivi` de
Firestore, plus un document `__regles` qui porte les règles, les causes
traduites et les causes que vous avez ajoutées.

Trois niveaux de repli, dans l'ordre : SDK Firebase → API REST Firestore →
mémoire du navigateur. Si le réseau de l'entreprise bloque `gstatic.com` ou
`firestore.googleapis.com`, l'outil continue de fonctionner sur la copie locale
et le dit dans le bandeau. Rien n'est perdu ; la synchronisation reprend quand
l'accès revient.

La configuration Firebase est dans `3-stockage.js`. Ces clés sont publiques par
conception : ce sont les règles Firestore, côté serveur, qui décident de qui
peut lire et écrire.

---

## Ce qui n'est pas dans le dossier

Les scripts de test (`audit.mjs`, `final2.mjs`, `cnt.mjs`, `maille.mjs`…) vivent
à part. Ils pilotent la page avec Playwright et rejouent, à chaque modification :

- les 19 contrôles du moteur de règles (ordre, reprise, restitution, idempotence) ;
- la cohérence des compteurs d'onglets ;
- l'égalité des taux entre les trois mailles sur une même période ;
- le calcul du retard en jours ouvrés, fériés compris ;
- le rendu à 1440, 900 et 400 px.
