#!/bin/sh
# ---------------------------------------------------------------------------
#  Brut vers Net — assemblage
#
#  La source, c'est l'arborescence : index.html, css/styles.css, js/*.js.
#  C'est là qu'on modifie, et elle s'ouvre telle quelle dans un navigateur.
#
#  Ce script en tire les deux formes distribuables, à l'identique :
#    dist/brut-vers-net.html  un seul fichier, complet, ouvrable d'un double-clic
#                             ou déposable sur un partage réseau
#    dist/artefact.html       le même sans <!doctype>/<html>/<head>/<body> :
#                             c'est la forme qu'attend l'artefact claude.ai,
#                             qui pose son propre squelette
#
#  Les deux gardent les six <script> séparés, dans l'ordre des numéros, pour
#  qu'ils se comportent exactement comme l'arborescence.
# ---------------------------------------------------------------------------
set -e
cd "$(dirname "$0")"
RACINE=$(pwd)
mkdir -p dist

JS="js/1-noyau.js js/2-reprise.js js/3-stockage.js js/4-regles.js js/5-rendu.js js/6-import.js"

# 1. contrôle de syntaxe, fichier par fichier -------------------------------
#    Un <script> séparé est parsé séparément : une erreur dans l'un n'empêche
#    plus les autres de tourner, elle les laisse tourner à moitié. Mieux vaut
#    ne rien produire.
if command -v node >/dev/null 2>&1; then
  for f in $JS; do
    node --check "$f" || { echo "!! erreur de syntaxe : $f"; exit 1; }
  done
  echo "syntaxe : 6 fichiers vérifiés"
else
  echo "node absent — contrôle de syntaxe sauté"
fi

# 2. le numero de version, ecrit dans le noyau -------------------------------
#    Il se lit dans les reglages : on sait alors si la page ouverte est la bonne.
VER=$(cat VERSION 2>/dev/null || echo "dev")
DAT=$(date +%d/%m/%Y)
python3 - "$RACINE" "$VER" "$DAT" <<'TAG'
import sys, os, re
r, ver, dat = sys.argv[1], sys.argv[2], sys.argv[3]
q = os.path.join(r, "js/1-noyau.js")
t = open(q, encoding="utf-8").read()
t = re.sub(r'const VERSION = "[^"]*";', 'const VERSION = "%s";' % ver, t, count=1)
t = re.sub(r'const VERSION_DATE = "[^"]*";', 'const VERSION_DATE = "%s";' % dat, t, count=1)
open(q, "w", encoding="utf-8").write(t)
TAG
echo "version : $VER du $DAT"

# 3. le fichier unique, complet ---------------------------------------------
#    Le CSS et les six scripts sont posés en clair à la place de leurs balises.
python3 - "$RACINE" <<'PY'
import sys, os, re
r = sys.argv[1]
js = ["js/1-noyau.js", "js/2-reprise.js", "js/3-stockage.js",
      "js/4-regles.js", "js/5-rendu.js", "js/6-import.js"]
lire = lambda p: open(os.path.join(r, p), encoding="utf-8").read()

index = lire("index.html")
css = lire("css/styles.css").rstrip("\n")

# le <link> vers la feuille locale devient le <style> lui-même
plein = index.replace('<link rel="stylesheet" href="css/styles.css">',
                      "<style>\n" + css + "\n</style>", 1)

# chaque <script src> devient son contenu
for p in js:
    code = lire(p).rstrip("\n")
    plein = plein.replace('<script src="%s"></script>' % p,
                          "<script>\n" + code + "\n</script>", 1)

assert "css/styles.css" not in plein, "feuille de style non incorporée"
assert 'script src="js/' not in plein, "script non incorporé"

open(os.path.join(r, "dist/brut-vers-net.html"), "w", encoding="utf-8").write(plein)

#    la forme artefact : le squelette en moins
i = plein.find("<title>")
j = plein.rfind("</body>")
art = plein[i:j]
#    La charnière </head><body> tombe au milieu de ce qu'on garde : l'artefact
#    pose la sienne, celle-ci ferait un second <body> imbriqué.
art = art.replace("</head>\n<body>\n", "", 1).rstrip() + "\n"
for interdit in ("<!doctype", "<html", "<head>", "</head>", "<body>", "</body>"):
    assert interdit not in art.lower(), "squelette résiduel : " + interdit
open(os.path.join(r, "dist/artefact.html"), "w", encoding="utf-8").write(art)
PY

echo "dist/brut-vers-net.html : $(wc -c < dist/brut-vers-net.html) octets"
echo "dist/artefact.html      : $(wc -c < dist/artefact.html) octets"
