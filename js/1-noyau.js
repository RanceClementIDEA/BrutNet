/* =========================================================================
   Brut vers Net — suivi du taux de service (MG & Logistiport)
   Bloc 1 : constantes, dates, stockage, modèle de calcul
   ========================================================================= */
"use strict";

/* ═══════════════════════════════════════════════════════════════════════
   CONFIGURATION DE LA BASE PARTAGÉE  —  la seule zone à modifier
   Remplacez  null  par l'objet firebaseConfig de votre projet Firebase :
   const FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", projectId: "…",
                             storageBucket: "…", messagingSenderId: "…", appId: "…" };
   Laissé à null, l'outil fonctionne en local (données dans le navigateur).
   ═══════════════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDExOc5kwwJ5Frt5xO4X3dKdUgQdl5qxYs",
  authDomain: "taux-net.firebaseapp.com",
  projectId: "taux-net",
  storageBucket: "taux-net.firebasestorage.app",
  messagingSenderId: "261454698272",
  appId: "1:261454698272:web:521d2aed6afb880d69a945"
};
const FIREBASE_SDK_VERSION = "12.18.0";
const FB_COLLECTION = "suivi";
const DOC_REGLES = "__regles";          /* les règles partagent la collection des périodes */

const SITES = { mag:{l:"MG", d:"aires MG, LGB, BAK et DAN"}, log:{l:"Logistiport", d:"aire LOG"} };
const SERVS = { distri:{l:"Distribution", d:"KPI 5.1 / 5.2 — livraison à date"}, recep:{l:"Réception", d:"KPI 2.1 / 2.2 — arrivée → entrée en stock"} };
const AIRE2SITE = { MG:"mag", LGB:"mag", BAK:"mag", DAN:"mag", LOG:"log" };
const SRC = { auto:"Automatique", releve:"Relevé", manuel:"Manuel" };

const CATS = [
  {k:"irrealisable", l:"Demande irréalisable",   p:"distri", s:"auto",   j:true,  d:"Créée le jour de son échéance ou après : la confirmation devait tomber la veille ouvrée."},
  {k:"anomalie",     l:"Anomalie de calcul",     p:"tous",   s:"auto",   j:true,  d:"Tenue avant son échéance et pourtant comptée KO."},
  {k:"reliquat",     l:"Reliquat",               p:"distri", s:"releve", j:true},
  {k:"reliquat_ant", l:"Reliquat antérieur",     p:"distri", s:"manuel", j:true,  d:"Backlog d'une période antérieure, soldé ici."},
  {k:"grues",        l:"Grues",                  p:"distri", s:"releve", j:true},
  {k:"litiges",      l:"Litiges",                p:"distri", s:"releve", j:true},
  {k:"dechets",      l:"Flux déchets",           p:"distri", s:"releve", j:true},
  {k:"dtm",          l:"DTM",                    p:"distri", s:"releve", j:true},
  {k:"mad",          l:"Mise à disposition",     p:"distri", s:"releve", j:true},
  {k:"irrecevable",  l:"Demande irrecevable",    p:"distri", s:"releve", j:true},
  {k:"reedition",    l:"Litige BR réédité",      p:"recep",  s:"auto",   j:true,  d:"Délai réel depuis la recréation ≤ objectif (heures si urgent, jours ouvrés sinon)."},
  {k:"douane",       l:"Blocage douane",         p:"recep",  s:"auto",   j:true},
  {k:"ferie",        l:"Jour férié",             p:"recep",  s:"auto",   j:true},
  /* Les litiges de réception, tels que l'exploitation les nomme : le BR est
     arrivé, mais quelque chose empêche l'entrée en stock. Ils manquaient — seul
     le litige de BR réédité était proposé, et il ne couvre qu'un cas sur cinq. */
  {k:"fournisseur",  l:"Litige fournisseur",     p:"recep",  s:"manuel", j:true,  d:"Litige ouvert avec le fournisseur : quantité, référence, commande."},
  {k:"nonconf",      l:"Non-conformité",         p:"recep",  s:"manuel", j:true,  d:"Marchandise non conforme ou refusée au contrôle."},
  {k:"docs",         l:"Documents manquants",    p:"recep",  s:"manuel", j:true,  d:"Documents ou identification manquants à l'arrivée."},
  {k:"arbitrage",    l:"Arbitrage achats",       p:"recep",  s:"manuel", j:true,  d:"Entrée suspendue en attente d'un arbitrage achats ou fournisseur."},
  {k:"transport",    l:"Transport amont",        p:"tous",   s:"manuel", j:true},
  {k:"client",       l:"Demande client tardive", p:"tous",   s:"manuel", j:true},
  {k:"si",           l:"Indisponibilité SI/SAP", p:"tous",   s:"manuel", j:true},
  {k:"autre",        l:"Autre — justifié",       p:"tous",   s:"manuel", j:true,  d:"Commentaire obligatoire."},
  {k:"fraction",     l:"Réception fractionnée",  p:"recep",  s:"manuel", j:false, d:"Livraison arrivée en plusieurs fois — à trancher avant de conclure."},
  {k:"traitement",   l:"Retard de traitement",   p:"recep",  s:"manuel", j:false, d:"Le retard vient du traitement interne : il reste compté."},
  {k:"urgences",     l:"Urgences",               p:"tous",   s:"releve", j:false},
  {k:"retard",       l:"Retard",                 p:"tous",   s:"releve", j:false},
  {k:"nr",           l:"Non renseignée",         p:"tous",   s:"releve", j:false}
];
const CAT = Object.fromEntries(CATS.map(c => [c.k, c]));
/* ---------------- vos causes à vous ----------------
   La liste ci-dessus est celle du métier tel qu'on le connaissait en écrivant
   l'outil. Elle ne couvrira jamais tout : une fermeture de zone, une servitude,
   un chantier arrêté — des causes qui reviennent, et qu'il faut pouvoir nommer
   sans attendre. Elles s'ajoutent ici, à la suite, et se comportent en tout
   point comme les autres : une règle peut les poser, un relevé s'y traduire,
   une saisie les choisir.

   Le champ qui compte est `j` : une cause qui justifie retire le KO du net, une
   cause qui ne justifie pas le documente sans l'effacer. C'est la seule
   question à laquelle il faut répondre en la créant, et elle est posée en
   clair. */
const CAT_MIENNES = new Set();
function cleCause(lib){
  const b = CAT_ALIAS.norm(lib).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "cause";
  let k = "u_" + b, n = 2;
  while (CAT[k]) k = "u_" + b + "_" + (n++);
  return k;
}
function normCats(list){
  if (!Array.isArray(list)) return [];
  return list.map(c => c && {
    k: String(c.k || "").slice(0, 40),
    l: String(c.l || "").trim().slice(0, 60),
    p: ["tous", "distri", "recep"].indexOf(c.p) >= 0 ? c.p : "tous",
    s: "manuel", j: c.j !== false, mien: true,
    d: String(c.d || "").trim().slice(0, 200)
  }).filter(c => c && c.k && c.l);
}
/* Repose l'ensemble des causes personnalisées : on retire les précédentes puis
   on remet celles-ci, pour que deux chargements ne les empilent pas. */
function poseCats(list){
  CAT_MIENNES.forEach(k => { delete CAT[k];
    const i = CATS.findIndex(c => c.k === k); if (i >= 0) CATS.splice(i, 1);
    const j = SANS.indexOf(k); if (j >= 0) SANS.splice(j, 1); });
  CAT_MIENNES.clear();
  normCats(list).forEach(c => {
    if (CAT[c.k]) return;
    CATS.push(c); CAT[c.k] = c; CAT_MIENNES.add(c.k);
    if (!c.j) SANS.push(c.k);
    CAT_ALIAS.map[CAT_ALIAS.norm(c.l)] = c.k;
    CAT_ALIAS.map[CAT_ALIAS.norm(c.k)] = c.k;
  });
  S.cats = CATS.filter(c => c.mien).map(c => ({ k:c.k, l:c.l, p:c.p, j:c.j, d:c.d }));
  return S.cats;
}
const mesCauses = () => CATS.filter(c => c.mien);
const QUICK = { distri:["reliquat", "grues", "litiges"], recep:["douane", "fournisseur", "reedition"] };
const SANS = CATS.filter(c => !c.j).map(c => c.k);
/* libellés bruts du relevé -> clés internes */
const CAT_ALIAS = (() => {
  const m = {};
  const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  CATS.forEach(c => { m[norm(c.l)] = c.k; m[norm(c.k)] = c.k; });
  Object.assign(m, {
    "reliquats":"reliquat", "grue":"grues", "litige":"litiges", "dechets":"dechets", "flux dechet":"dechets",
    "mise a dispo":"mad", "mad":"mad", "irrecevable":"irrecevable", "demande irrecevable":"irrecevable",
    "urgence":"urgences", "retards":"retard", "non renseigne":"nr", "non renseignee":"nr", "":"nr",
    "autre":"autre", "autres":"autre", "dtm":"dtm",
    /* libellés longs de l'ancien suivi, pour que ses saisies retombent juste */
    "marchandise non conforme ou refusee":"nonconf", "non conforme":"nonconf",
    "documents ou identification manquants":"docs", "document manquant":"docs",
    "attente d arbitrage achats ou fournisseur":"arbitrage", "arbitrage":"arbitrage",
    "reception fractionnee a trancher":"fraction", "retard d exploitation":"retard",
    "litige de stock":"litiges",
    /* le rebut, tel qu'un relevé l'écrit : c'est le flux déchets */
    "rebut":"dechets", "rebuts":"dechets", "mise au rebut":"dechets", "dechet":"dechets"
  });
  return { map:m, norm };
})();

/* Repère figé sur l'import du 14/09/2026 : PowerBI S27 → S37, les deux
   extractions SAP (01/07 → 02/09 et 01/09 → 10/09) et le relevé quotidien du
   25/06 au 21/07. Le flux et le brut ne dépendent que des fichiers : s'ils ne
   retombent pas, c'est l'import qui n'est pas le bon. Le net est celui d'une
   base sans règle enregistrée — le vôtre monte à mesure que vos règles et vos
   saisies justifient, et c'est tant mieux. Les semaines d'avant le plancher
   comptent ici : le repère porte sur les données chargées, pas sur l'affichage. */
const REFERENCE = [
  {s:"distri", z:"mag",  flux:13436, ko:921,  brut:.9315, net:.9361},
  {s:"distri", z:"log",  flux:7482,  ko:397,  brut:.9469, net:.9469},
  {s:"distri", z:"tous", flux:20918, ko:1318, brut:.9370, net:.9400},
  {s:"recep",  z:"mag",  flux:6026,  ko:362,  brut:.9399, net:.9706},
  {s:"recep",  z:"log",  flux:6091,  ko:284,  brut:.9534, net:.9570},
  {s:"recep",  z:"tous", flux:12117, ko:646,  brut:.9467, net:.9638}
];

/* ---------------------------- utilitaires ---------------------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const nf = new Intl.NumberFormat("fr-FR");
const n0 = v => nf.format(Math.round(v || 0));
/* Le « s » du pluriel : « 1 DT lue », « 3 DT lues ». */
const sPl = n => (Math.abs(Math.round(n || 0)) > 1 ? "s" : "");
const dec = (v, d) => (v == null || !isFinite(v)) ? "—" : v.toLocaleString("fr-FR", {minimumFractionDigits:d, maximumFractionDigits:d});
const pf = r => (r == null || !isFinite(r)) ? "—" : dec(r * 100, 1) + " %";
const ptf = r => (r == null || !isFinite(r)) ? "—" : (r < 0 ? "−" : "+") + dec(Math.abs(r) * 100, 2) + " pt";
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];

function isoWeekOf(d){
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7) + 3);
  return { y: t.getUTCFullYear(), w: 1 + Math.round((t - first) / 6048e5) };
}
const weekKey = d => { const {y, w} = isoWeekOf(d); return y + "-W" + String(w).padStart(2, "0"); };
function weekMonday(key){
  const [y, w] = key.split("-W").map(Number);
  const first = new Date(Date.UTC(y, 0, 4));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  first.setUTCDate(first.getUTCDate() + (w - 1) * 7);
  return first;
}
function weekSpan(key){
  const a = weekMonday(key), b = new Date(a); b.setUTCDate(a.getUTCDate() + 6);
  const f = d => String(d.getUTCDate()).padStart(2,"0") + "/" + String(d.getUTCMonth()+1).padStart(2,"0");
  return f(a) + " → " + f(b);
}
function monthOfWeek(key){
  const th = weekMonday(key); th.setUTCDate(th.getUTCDate() + 3);
  return th.getUTCFullYear() + "-M" + String(th.getUTCMonth() + 1).padStart(2, "0");
}
const weekLabel = k => "S" + Number(k.split("-W")[1]);
const monthLabel = k => { const [y, m] = k.split("-M"); return MOIS[Number(m) - 1] + " " + y.slice(2); };
const estJour = k => /^\d{4}-\d{2}-\d{2}$/.test(k);
const dayLabel = k => k.slice(8, 10) + "/" + k.slice(5, 7);
const perLabel = k => estJour(k) ? dayLabel(k) : k.includes("-W") ? weekLabel(k) : monthLabel(k);
const perLong  = k => estJour(k) ? (frWeekday(k) + " " + frDay(k))
  : k.includes("-W") ? "Semaine " + Number(k.split("-W")[1]) + " · " + weekSpan(k) + " " + k.slice(0,4) : monthLabel(k);
const perSort  = (a, b) => a.localeCompare(b);
const frDay = iso => { if (!iso) return "—"; const p = String(iso).slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso; };
const JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const frWeekday = iso => { if (!iso) return "—"; const d = new Date(String(iso).slice(0,10) + "T00:00:00Z");
  return isNaN(d) ? "—" : JOURS[d.getUTCDay()] + (estOuvre(d) ? "" : " (non ouvré)"); };
function dateOfRef(cell, ref){
  const i = (cell.koRefs || []).indexOf(String(ref));
  return i >= 0 ? ((cell.koDates || [])[i] || "") : "";
}

/* ------------------- jours ouvrés et fériés français ------------------- */
function paques(y){
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),
    g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,
    m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;
  return Date.UTC(y, mo - 1, da);
}
const FERIES = {};
function feriesSet(y){
  if (FERIES[y]) return FERIES[y];
  const E = paques(y), D = 864e5;
  const l = [Date.UTC(y,0,1), Date.UTC(y,4,1), Date.UTC(y,4,8), Date.UTC(y,6,14), Date.UTC(y,7,15),
             Date.UTC(y,10,1), Date.UTC(y,10,11), Date.UTC(y,11,25), E + D, E + 39*D, E + 50*D];
  return FERIES[y] = new Set(l.map(t => new Date(t).toISOString().slice(0, 10)));
}
const ymd = d => d.toISOString().slice(0, 10);
const toUTCDay = d => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
function estOuvre(d){
  const w = d.getUTCDay();
  return w !== 0 && w !== 6 && !feriesSet(d.getUTCFullYear()).has(ymd(d));
}
/* jours ouvrés entre deux dates : départ exclu, arrivée incluse */
function joursOuvres(a, b){
  if (!a || !b) return null;
  const d = new Date(a.getTime()), stop = b.getTime();
  let n = 0, guard = 0;
  while (d.getTime() < stop && guard++ < 3000){ d.setUTCDate(d.getUTCDate() + 1); if (estOuvre(d)) n++; }
  return n;
}
/* Le même décompte, mais signé : une fin antérieure à l'échéance rend un nombre
   négatif au lieu de zéro. Sert au repli du calcul de retard, où le sens du
   dépassement est justement ce qu'on cherche à lire. */
function joursOuvresSigne(a, b){
  if (a == null || b == null) return null;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da) || isNaN(db)) return null;
  if (da.getTime() === db.getTime()) return 0;
  return da.getTime() < db.getTime() ? joursOuvres(da, db) : -joursOuvres(db, da);
}

/* ---------------------------- état ---------------------------- */
/* Le tableau de bord commence le lundi 13 juillet 2026 — début de la S29. Les
   semaines d'avant sont chargées et justifiées, mais pas affichées. */
const PLANCHER_DEF = "2026-07-13";
const S = {
  cells: {},
  ui: { tab:"dash", site:"tous", serv:"tous", maille:"semaine", preset:"all", from:null, to:null, d1:null, d2:null,
        q:"", qcat:"", qsrc:"", qst:"", vue:"simple", qscope:"", qshow:40,
        ajq:"", ajTri:"ko", ajSens:-1, regTri:"date", regSens:-1 },
  regles: [],
  causes: {},                      /* libellés libres du relevé -> catégorie de l'outil */
  cats: [],                        /* les causes que vous avez ajoutées vous-même */
  cible: 99,                       /* taux net visé, réglable — colore les tuiles */
  plancher: PLANCHER_DEF,          /* première date montrée au tableau de bord */
  backend: "local", db: null, fb: null, ready: false, pending: 0, writeErr: null
};
const LSCIBLE = "taux-net-cible";
const LSPLANCHER = "taux-net-plancher";
const LSKEY = "brut-net-taux-service-v1";
const CFGKEY = "brut-net-firebase-config";
const BACKEND_LBL = { local:"Navigateur seul", db:"Base Claude", firebase:"Base partagée Firebase",
  rest:"Base partagée Firebase (sans SDK)" };

function cellId(p, s, sv){ return p + "_" + s + "_" + sv; }
const LIMREF = 6000;   /* nombre de références de KO gardées par période */
/* Détail journalier d'une période : { "2026-07-08": { f: flux, k: KO }, … }.
   Présent dès qu'un export a été importé ; absent sur les bases plus anciennes. */
function normJours(j){
  const out = {};
  if (!j || typeof j !== "object") return out;
  Object.keys(j).forEach(k => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
    const v = j[k] || {};
    const f = Math.max(0, +v.f || 0), n = Math.max(0, +v.k || 0);
    if (f || n) out[k] = { f, k:n };
  });
  return out;
}
function normCell(c){
  const n = normCellBrut(c);
  /* Le poids des lignes se relit sur le détail chargé : une justification vaut
     le nombre de flux qu'elle couvre, pas le nombre qu'on avait saisi le jour où
     le détail n'était pas encore là. Se refait à chaque écriture, donc suit
     l'export. */
  n.lignes.forEach(l => { const p = poidsLigne(n, l); if (p !== l.nb) l.nb = p; });
  return n;
}
function normCellBrut(c){
  return {
    id: c.id || cellId(c.periode, c.site, c.service),
    periode: c.periode, site: c.site, service: c.service,
    flux: Math.max(0, +c.flux || 0), ko: Math.max(0, +c.ko || 0),
    litiges: c.litiges == null ? null : Math.max(0, +c.litiges || 0),
    /* Combien de ces litiges écartés étaient des KO. Sans ce chiffre, impossible
       de dire à quoi ressemblerait le brut « tout compris » — celui que PowerBI
       affiche — et l'écart entre les deux restait une énigme. */
    litigesKo: c.litigesKo == null ? null : Math.max(0, +c.litigesKo || 0),
    note: c.note || "", demo: !!c.demo, maj: c.maj || new Date().toISOString(),
    koRefs: Array.isArray(c.koRefs) ? c.koRefs.slice(0, LIMREF) : [],
    koDates: Array.isArray(c.koDates) ? c.koDates.slice(0, LIMREF) : [],
    koPostes: Array.isArray(c.koPostes) ? c.koPostes.slice(0, LIMREF).map(x => x == null ? "" : String(x)) : [],
    postesOk: !!c.postesOk,
    jours: normJours(c.jours),
    koCtx: ctxUnpack(c.koCtx),
    /* Postes recréés après litige, relevés dans SAP : « BR-poste » → la date de
       recréation, le poste d'origine et le délai recompté depuis cette date.
       C'est la seule base honnête pour ces lignes — le litige a arrêté le temps,
       et le KPI, lui, continue de compter depuis l'arrivée du BR. */
    reed: (c.reed && typeof c.reed === "object" && !Array.isArray(c.reed)) ? c.reed : null,
    lignes: (Array.isArray(c.lignes) ? c.lignes : []).map(l => ({
      id: l.id || uid(), ref: l.ref || "", cat: CAT[l.cat] ? l.cat : "autre",
      postes: Array.isArray(l.postes) ? l.postes.map(String).filter(Boolean) : [],
      nb: Math.max(0, +l.nb || 0), src: SRC[l.src] ? l.src : "manuel",
      d: l.d || "", com: l.com || "", st: l.st === "rejet" ? "rejet" : "ok",
      /* Marque de la règle qui a posé la ligne : c'est elle qui rend le rejeu
         défaisable. La perdre ici figerait les justifications automatiques et
         les ferait passer pour des saisies à la main. */
      regle: l.regle || "",
      /* La saisie à la main que cette ligne a remplacée, mise de côté en clair.
         Sans elle, retirer la règle effaçait définitivement le travail de
         quelqu'un : la ligne de règle disparaissait, et la saisie qu'elle avait
         reprise ne revenait pas. Une chaîne, pas un objet — Firestore n'accepte
         pas de tableau dans un tableau, et `postes` en est un. */
      rep: typeof l.rep === "string" ? l.rep.slice(0, 600) : ""
    }))
  };
}

/* ------------------------- contexte des KO -------------------------
   Pour qu'une règle écrite aujourd'hui puisse juger une semaine d'il y a deux
   mois, chaque KO garde les colonnes de son export. Stockage colonnaire avec
   dictionnaire : les valeurs se répètent beaucoup, on ne les écrit qu'une fois.
     c : noms des colonnes
     d : valeurs distinctes, colonne par colonne
     v : par colonne, l'indice de la valeur de chaque KO (−1 = vide)          */
/* « Unité de mesure » était écartée comme une colonne d'habillage. C'en est une
   de fond : elle dit si l'indicateur se compte en jours ouvrés ou en heures, et
   sans elle le retard d'un flux urgent s'écrivait en journées. Deux valeurs
   distinctes en tout — elle ne pèse rien dans le dictionnaire. */
const CTX_HORS = /^(annee|mois|annee mois|annee semaine|business unit|centre organisationnel|client|resultat|statut avancement|nombre de flux|identifiant flux|date heure)/;
const CTX_MAXCOL = 32, CTX_MAXVAL = 60;
const normCol = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/* Une colonne de date / d'heure, d'après son nom. Sert à remettre en clair les
   numéros de série que le tableur écrit à la place des dates (46204 = 01/07/2026)
   et les fractions de journée à la place des heures (0,6441 = 15:27). Sans ça la
   règle afficherait « Date fin est 46204 », illisible, et les suggestions du
   champ seraient inutilisables. */
const CTX_EST_DATE = /(^| )date( |$)|^date|echeance|jour de/;
const CTX_EST_HEURE = /(^| )heure( |$)|^heure/;
function serieVersDate(n){
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5);
  const p = x => String(x).padStart(2, "0");
  return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear();
}
function fractionVersHeure(f){
  let s = Math.round(f * 86400); if (s >= 86400) s -= 86400;
  const p = x => String(x).padStart(2, "0");
  return p(Math.floor(s / 3600)) + ":" + p(Math.floor(s / 60) % 60);
}
function ctxLisible(brut, kind){
  if (!kind) return brut;
  if (kind === "date" && /^\d{5}(\.\d+)?$/.test(brut)){
    const n = parseFloat(brut);
    if (n > 20000 && n < 80000) return serieVersDate(n);
  }
  if (kind === "heure" && /^0?\.\d+$/.test(brut)) return fractionVersHeure(parseFloat(brut));
  if (kind === "date" && /^(\d{4})-(\d{2})-(\d{2})/.test(brut))
    return brut.slice(8, 10) + "/" + brut.slice(5, 7) + "/" + brut.slice(0, 4);
  return brut;
}
function ctxNew(colonnes){
  const c = colonnes.filter(h => h && !CTX_HORS.test(normCol(h))).slice(0, CTX_MAXCOL);
  const k = c.map(h => { const n = normCol(h);
    return CTX_EST_DATE.test(n) ? "date" : CTX_EST_HEURE.test(n) ? "heure" : ""; });
  return { c, k, d: c.map(() => []), v: c.map(() => []), idx: c.map(() => ({})), src: colonnes };
}
function ctxPush(ctx, ligne, indexParNom){
  ctx.c.forEach((nom, k) => {
    const i = indexParNom[nom];
    let brut = i == null ? "" : String(ligne[i] == null ? "" : ligne[i]).trim().slice(0, CTX_MAXVAL);
    if (!brut || brut === "None"){ ctx.v[k].push(-1); return; }
    brut = ctxLisible(brut, ctx.k[k]);
    let pos = ctx.idx[k][brut];
    if (pos == null){ pos = ctx.d[k].length; ctx.d[k].push(brut); ctx.idx[k][brut] = pos; }
    ctx.v[k].push(pos);
  });
}
function ctxFin(ctx){ return ctx ? { c: ctx.c, k: ctx.k, d: ctx.d, v: ctx.v } : null; }
/* Firestore refuse un tableau directement dans un tableau, et le dictionnaire
   du contexte en est fait de deux (d et v). On l'écrit donc en texte au moment
   d'enregistrer, et on le relit indifféremment dans les deux formes : les bases
   déjà remplies avant ce changement restent lisibles. */
function ctxPack(x){
  if (!x || !Array.isArray(x.c)) return null;
  return { c: x.c, k: Array.isArray(x.k) ? x.k : [],
    d: typeof x.d === "string" ? x.d : JSON.stringify(x.d || []),
    v: typeof x.v === "string" ? x.v : JSON.stringify(x.v || []) };
}
function ctxUnpack(x){
  if (!x || !Array.isArray(x.c)) return null;
  const par = q => { if (Array.isArray(q)) return q;
    try { const o = JSON.parse(q || "[]"); return Array.isArray(o) ? o : []; } catch(e){ return []; } };
  return { c: x.c, k: Array.isArray(x.k) ? x.k : [], d: par(x.d), v: par(x.v) };
}
/* Le document tel qu'il part dans la base : aucun tableau imbriqué. */
function pourBase(n){
  const o = Object.assign({}, n);
  o.koCtx = ctxPack(n.koCtx);
  return o;
}
/* Les colonnes de date d'une période (pour proposer le bon choix dans une règle). */
function ctxKind(colonne){
  let k = "";
  Object.values(S.cells).forEach(c => {
    const x = c.koCtx; if (!x || !x.c || k) return;
    const j = x.c.indexOf(colonne);
    if (j >= 0 && x.k && x.k[j]) k = x.k[j];
  });
  if (k) return k;
  const n = normCol(colonne);
  return CTX_EST_DATE.test(n) ? "date" : CTX_EST_HEURE.test(n) ? "heure" : "";
}
/* Valeur d'une colonne pour le i-ème KO d'une période. */
function ctxVal(cell, i, colonne){
  const x = cell && cell.koCtx;
  if (!x || !x.c) return "";
  const k = x.c.indexOf(colonne);
  if (k < 0) return "";
  const p = (x.v[k] || [])[i];
  return p == null || p < 0 ? "" : ((x.d[k] || [])[p] || "");
}
/* Colonnes disponibles sur l'ensemble des périodes chargées. */
function ctxColonnes(){
  const s = new Set();
  Object.values(S.cells).forEach(c => (c.koCtx && c.koCtx.c ? c.koCtx.c : []).forEach(n => s.add(n)));
  return Array.from(s).sort((a, b) => a.localeCompare(b, "fr"));
}
/* ------------------------- opérateur d'un KO -------------------------
   En réception, la colonne « ID Collaborateur » de l'export porte le code de
   l'opérateur qui a traité le flux — TKX, 13M, HGD… — et elle est toujours
   remplie. En distribution la même colonne porte un code d'emplacement, sans
   rapport avec une personne : on ne l'affiche donc qu'en réception. */
/* Les exports ne nomment pas cette colonne pareil d'une version à l'autre :
   on la cherche par morceau de nom, pas sur une graphie exacte. */
const CAND_OP = ["collaborateur", "receptionnaire", "magasinier", "operateur",
  "traite par", "affecte a", "responsable", "intervenant", "agent",
  "cree par", "createur", "modifie par", "utilisateur", "login", "nom prenom"];
function colOp(cell){
  const x = cell && cell.koCtx;
  if (!x || !Array.isArray(x.c)) return "";
  for (const cand of CAND_OP){
    const n = x.c.find(v => normCol(v).indexOf(cand) >= 0);
    if (n) return n;
  }
  return "";
}
function opKo(cell, i){
  if (!cell || cell.service !== "recep") return "";
  const c = colOp(cell); return c ? ctxVal(cell, i, c) : "";
}
/* Les valeurs distinctes d'une colonne pour une référence, éventuellement
   bornée à certains postes. Le contexte est rangé par KO : c'est en
   retrouvant les KO de la référence qu'on retrouve ce que l'export en disait. */
function ctxRef(cell, ref, postes, col){
  if (!cell || !col) return [];
  const lim = postes && postes.length ? new Set(postes.map(String)) : null;
  const s = new Set();
  (cell.koRefs || []).forEach((r, i) => {
    if (String(r) !== String(ref)) return;
    if (lim && !lim.has(String((cell.koPostes || [])[i] || ""))) return;
    const v = ctxVal(cell, i, col); if (v) s.add(v);
  });
  return Array.from(s).sort();
}
/* ---------------- de combien ce retard est-il en retard ? ----------------
   Le décompte ne se fait pas en jours de calendrier. Un flux dû le vendredi et
   terminé le lundi a un jour ouvré de retard, pas trois ; le 14 juillet ne
   compte pas davantage. L'export porte déjà la réponse, comptée dans le
   calendrier de l'entreprise — samedis, dimanches, fériés et ponts déduits —
   et c'est elle qu'on lit plutôt que de la recalculer : sur l'import de
   septembre, « Valeur KPI » et un décompte ouvré refait à la main tombent
   d'accord sur 20 068 lignes de distribution sur 20 153, et les 85 restantes
   sont des jours de fermeture propres au site, que seul l'export connaît.

   Distribution : la valeur EST l'écart à l'échéance, en jours ouvrés. Zéro
   n'est pas « à l'heure » : la confirmation devait tomber la veille ouvrée
   (objectif −1), et la moitié des KO sont exactement là — d'où l'écriture en
   J, qui dit la journée plutôt qu'une durée.

   Réception : la valeur est le délai de traitement ; le retard est ce qui
   dépasse l'objectif.

   Urgents — KPI 5.2 et 2.2 : même mécanique, mais l'indicateur se compte en
   heures. Trois heures et vingt minutes de dépassement s'écrivaient « J+1 »
   tant que l'unité restait illisible ; elles s'écrivent « +3,3 h ».

   Rend { v, t, d } : une valeur triable, son écriture, et la même chose en
   clair pour l'infobulle. */
function uniteKo(cell, ref, postes){
  const u = (ctxRef(cell, ref, postes, "Unité de mesure") || [])[0] || "";
  if (u) return /heure/i.test(u) ? "h" : "j";
  /* Les périodes enregistrées avant que la colonne soit retenue n'ont pas
     l'unité. Le libellé du KPI la porte aussi : les flux urgents — 5.2, 2.2 —
     se comptent en heures, tous les autres en jours ouvrés. */
  const k = (ctxRef(cell, ref, postes, "KPI (Code - Libellé)") || [])[0] || "";
  return (/urgent/i.test(k) || /\b\d+\.2\b/.test(k)) ? "h" : "j";
}
function retardKo(cell, ref, postes){
  if (!cell || !ref) return null;
  const h = uniteKo(cell, ref, postes) === "h";
  const val = nombre((ctxRef(cell, ref, postes, "Valeur KPI") || [])[0]);
  const obj = nombre((ctxRef(cell, ref, postes, "Objectif") || [])[0]);
  const recep = cell.service === "recep";
  let e = null;
  if (val != null && (recep || h)){ if (obj != null) e = val - obj; }
  else if (val != null){ e = val; }
  /* Repli : pas de valeur d'indicateur lisible. Les dates restent, et le
     décompte se refait en jours ouvrés — jamais en calendaire. */
  if (e == null && !recep && !h){
    e = joursOuvresSigne(jourDe((ctxRef(cell, ref, postes, "Date fin prévue") || [])[0]),
                         jourDe((ctxRef(cell, ref, postes, "Date fin") || [])[0]));
  }
  if (e == null) return null;
  /* Le dépassement n'est pas toujours entier : « 2,83 jours » pour un objectif
     de 2 fait 0,8 jour, pas 1. Arrondir écrivait « +1 j » sur vingt heures et
     « +0 j » sur un vrai dépassement. La décimale n'apparaît qu'utile. */
  const petit = Math.abs(e) < 10 && Math.abs(e % 1) > 0.05;
  const chiffre = petit ? dec(Math.abs(e), 1) : n0(Math.abs(e));
  const signe = e > 0 ? "+" : e < 0 ? "−" : "";
  if (h) return { v: e / 24, t: signe + chiffre + " h",
    d: e > 0 ? chiffre + " h au-delà de l'objectif"
     : e < 0 ? chiffre + " h sous l'objectif" : "pile à l'objectif" };
  const jr = j => chiffre + " jour" + (Math.abs(j) > 1 ? "s" : "") + " ouvré" + (Math.abs(j) > 1 ? "s" : "");
  if (recep) return { v: e, t: signe + chiffre + " j",
    d: e > 0 ? jr(e) + " au-delà de l'objectif"
     : e < 0 ? jr(e) + " sous l'objectif" : "pile à l'objectif" };
  return { v: e, t: e === 0 ? "J+0" : (e > 0 ? "J+" + chiffre : "J−" + chiffre),
    d: e > 0 ? "terminé " + jr(e) + " après l'échéance"
     : e < 0 ? "terminé " + jr(e) + " avant l'échéance"
     : "terminé le jour de l'échéance — la confirmation devait tomber la veille ouvrée" };
}
/* Une date écrite comme l'outil l'a rangée — 02/09/2026 — ou en ISO. */
function jourDe(s){
  const t = String(s || "").trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return null;
}
function opsRef(cell, ref, postes){
  if (!cell || cell.service !== "recep") return [];
  return ctxRef(cell, ref, postes, colOp(cell));
}
/* La colonne opérateur est-elle seulement présente dans les données chargées ?
   Distinguer « personne n'est renseigné » de « l'export ne porte pas la
   colonne » évite de chercher un défaut d'affichage là où il n'y en a pas. */
function opDispo(cells){
  let ctx = false, col = false;
  (cells || []).forEach(c => {
    if (c.service !== "recep") return;
    if (c.koCtx && (c.koCtx.c || []).length){ ctx = true; if (colOp(c)) col = true; }
  });
  return { ctx, col };
}
/* Ce que SAP dit de la recréation des postes d'une référence. */
function reedRef(cell, ref, postes){
  const m = cell && cell.reed; if (!m) return [];
  const lim = postes && postes.length ? postes.map(String) : null;
  const out = [];
  for (const k in m){
    const p = k.lastIndexOf("-"); if (p < 0) continue;
    if (sansZeros(k.slice(0, p)) !== sansZeros(ref)) continue;
    const poste = k.slice(p + 1);
    if (lim && lim.indexOf(poste) < 0) continue;
    out.push(Object.assign({ poste }, m[k]));
  }
  return out.sort((a, b) => cmpPoste(a.poste, b.poste));
}
/* Valeurs vues pour une colonne, les plus fréquentes d'abord. */
function ctxValeurs(colonne, max){
  const n = {};
  Object.values(S.cells).forEach(c => {
    const x = c.koCtx; if (!x || !x.c) return;
    const k = x.c.indexOf(colonne); if (k < 0) return;
    (x.v[k] || []).forEach(p => { if (p >= 0){ const val = (x.d[k] || [])[p]; if (val) n[val] = (n[val] || 0) + 1; } });
  });
  return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, max || 40);
}

/* ---------------------------- stockage ---------------------------- */
function saveLocal(){
  try { localStorage.setItem(LSKEY, JSON.stringify({ v:1, cells:Object.values(S.cells) })); } catch(e){}
}
function loadLocal(){
  try {
    const raw = localStorage.getItem(LSKEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.cells)) return null;
    const m = {}; o.cells.forEach(c => { const n = normCell(c); m[n.id] = n; });
    return m;
  } catch(e){ return null; }
}
/* Fusion d'un instantané de la base avec ce que ce navigateur a en mémoire.
   La base ne fait pas systématiquement autorité : si une écriture vient d'être
   refusée, l'instantané est plus ancien que le travail local, et l'adopter tel
   quel effacerait des justifications saisies à la main. On garde donc la version
   la plus récente de chaque période, et toutes les périodes que la base n'a pas
   encore vues tant qu'une écriture est en vol ou en échec. */
function mergeSnapshot(distant){
  const local = S.cells || {};
  const out = {};
  for (const id in distant){
    const d = distant[id], l = local[id];
    out[id] = (l && l.maj && d.maj && l.maj > d.maj) ? l : d;
  }
  if (S.pending || S.writeErr)
    for (const id in local) if (!out[id]) out[id] = local[id];
  return out;
}
function setStatus(kind, txt){
  const d = $("#sv-dot"), t = $("#sv-txt");
  if (!d) return;
  d.className = "dot " + kind; t.textContent = txt;
}
function remoteSet(n){
  /* La base n'accepte qu'un objet : mieux vaut une erreur qui se lit qu'un
     refus opaque venu d'un undefined arrivé jusqu'ici. */
  if (!n || typeof n !== "object" || !n.id)
    return Promise.reject(new Error("période introuvable au moment d'écrire"));
  const doc = pourBase(n);
  if (S.backend === "db") return S.db.doc(FB_COLLECTION + "/" + n.id).set(doc);
  if (S.backend === "firebase") return S.fb.m.setDoc(S.fb.m.doc(S.fb.db, FB_COLLECTION, n.id), doc);
  if (S.backend === "rest") return restSet(n.id, doc);
  return Promise.resolve();
}
function remoteDel(id){
  if (S.backend === "db") return S.db.doc(FB_COLLECTION + "/" + id).delete();
  if (S.backend === "firebase") return S.fb.m.deleteDoc(S.fb.m.doc(S.fb.db, FB_COLLECTION, id));
  if (S.backend === "rest") return restDel(id);
  return Promise.resolve();
}
const errCode = e => (e && (e.code || e.message)) ? String(e.code || e.message).slice(0, 90) : "erreur";
/* Traduit l'échec de connexion en geste à faire, plutôt qu'en code d'erreur. */
function fbDiag(code){
  const c = String(code || "").toLowerCase();
  if (/permission-denied|missing or insufficient/.test(c))
    return { t:"Les règles Firestore refusent l'accès",
      d:"Console Firebase → Firestore Database → Règles. Il faut autoriser la collection <code>suivi</code> aux sessions authentifiées, puis <b>Publier</b>." };
  if (/operation-not-allowed|admin-restricted|configuration-not-found/.test(c))
    return { t:"L'authentification anonyme n'est pas activée",
      d:"Console Firebase → Authentication → Sign-in method → activer <b>Anonyme</b>. Sans elle, aucune session n'est ouverte et les règles refusent tout." };
  if (/not-found|database.*does not exist/.test(c))
    return { t:"La base Firestore n'existe pas encore",
      d:"Console Firebase → Firestore Database → <b>Créer une base de données</b>, en région <code>europe-west</code>." };
  if (/failed to fetch|importing|network|unavailable|dynamically imported/.test(c))
    return { t:"Le réseau bloque Firebase",
      d:"La page charge le SDK depuis <code>gstatic.com</code> et écrit sur <code>firestore.googleapis.com</code>. Sur un poste d'entreprise, ces deux domaines doivent être autorisés." };
  if (/api-key|invalid.*key/.test(c))
    return { t:"Clé d'API refusée",
      d:"Vérifiez que la configuration collée est bien celle de l'application Web du projet." };
  if (/invalid.argument|nested array|not supported/.test(c))
    return { t:"La base refuse la forme du document",
      d:"Firestore n'accepte pas un tableau placé directement dans un tableau. L'outil met le " +
        "contexte des KO en texte avant de l'écrire depuis cette version : si le message revient, " +
        "c'est qu'un autre champ est en cause — signalez-le, il se corrige au niveau du code." };
  return null;
}
async function putCell(c){
  const n = normCell(c); n.maj = new Date().toISOString();
  S.cells[n.id] = n; saveLocal();
  if (S.backend === "local"){ setStatus("local", "Enregistré sur ce navigateur"); }
  else {
    S.pending++; setStatus("busy", "Enregistrement…");
    try { await remoteSet(n); S.writeErr = null; setStatus("ok", "Enregistré dans la base"); }
    catch(e){ writeFail(1, 1, e); }
    finally { S.pending--; }
  }
  render();
}
async function dropCell(id){
  delete S.cells[id]; saveLocal();
  if (S.backend !== "local"){ try { await remoteDel(id); } catch(e){ toast("Suppression refusée : " + errCode(e), true); } }
  render();
}
async function bulkPut(list){
  /* Les objets à écrire sont figés ici. Les relire dans S.cells au fil de la
     boucle était un piège : chaque écriture réussie déclenche un instantané de
     la base qui remplace S.cells, et une période toute neuve — celle que
     l'import vient de créer — en disparaît le temps que le serveur la renvoie.
     remoteSet recevait alors undefined et la base refusait l'écriture. */
  const aEcrire = (Array.isArray(list) ? list : []).filter(c => c && typeof c === "object")
    .map(c => { const n = normCell(c); n.maj = new Date().toISOString();
      S.cells[n.id] = n; return n; });
  if (!aEcrire.length){ render(); return; }
  saveLocal();
  if (S.backend === "local"){ setStatus("local", "Enregistré sur ce navigateur"); }
  else {
    S.pending++; setStatus("busy", "Enregistrement…");
    let ko = 0, premiere = null;
    try {
      for (const n of aEcrire){
        try { await remoteSet(n); }
        catch(e){ ko++; if (!premiere) premiere = e; }
      }
    } finally { S.pending--; }
    if (ko) writeFail(ko, aEcrire.length, premiere);
    else { S.writeErr = null; setStatus("ok", "Enregistré dans la base"); }
  }
  render();
}
/* La base injoignable relève du même bandeau : le code d'erreur seul, enfoui
   dans les réglages, n'aide personne. */
function connectFail(code){
  const d = fbDiag(code);
  S.writeErr = { ko:0, total:0, code: code || "connexion refusée",
    t: d ? d.t : "La base n'a pas pu être jointe", d: d ? d.d : "",
    connexion: true, when: new Date().toISOString() };
}
/* Une écriture refusée doit dire pourquoi et quoi faire. Le compte seul —
   « 3 écritures refusées » — n'apprend rien et laisse croire à une perte. */
function writeFail(ko, total, err){
  const code = errCode(err);
  const d = fbDiag(code);
  S.writeErr = { ko, total, code, t: d ? d.t : "La base a refusé l'écriture", d: d ? d.d : "",
    when: new Date().toISOString() };
  setStatus("local", n0(ko) + " écriture(s) refusée(s) — copie locale conservée");
  toast(n0(ko) + " sur " + n0(total) + " refusée(s) : " + code, true);
}


/* --------- migration : dates absentes des saisies antérieures --------- */
function migrateDates(){
  const src = (typeof REPRISE !== "undefined" && REPRISE && Array.isArray(REPRISE.cells)) ? REPRISE.cells : [];
  const ref = {}; src.forEach(c => { ref[c.id] = c; });
  const changed = [];
  Object.values(S.cells).forEach(c => {
    let touched = false;
    if ((!c.koDates || !c.koDates.length) && c.koRefs && c.koRefs.length){
      const r = ref[c.id];
      if (r && Array.isArray(r.koDates) && Array.isArray(r.koRefs) &&
          r.koRefs.length === c.koRefs.length &&
          r.koRefs.every((x, i) => String(x) === String(c.koRefs[i]))){
        c.koDates = r.koDates.slice(); touched = true;
      }
    }
    (c.lignes || []).forEach(l => {
      if (!l.d && l.ref){ const d = dateOfRef(c, l.ref); if (d){ l.d = d; touched = true; } }
    });
    if (touched) changed.push(c);
  });
  return changed;
}
/* Scinde demande et poste sur les bases enregistrées avant que le poste existe.
   En réception la référence portait déjà « BR-poste » : elle devient BR + poste,
   les justifications suivent, et rien ne bouge côté chiffres (le calcul ne lit
   que les quantités). En distribution il n'y a rien à récupérer : les postes
   arriveront au prochain import. */
function migratePostes(){
  const changed = [];
  Object.values(S.cells).forEach(c => {
    if (c.postesOk) return;
    let touched = false;
    if (c.service === "recep" && Array.isArray(c.koRefs) && c.koRefs.length &&
        (!Array.isArray(c.koPostes) || !c.koPostes.length)){
      const refs = [], postes = [];
      c.koRefs.forEach(r => { const s = splitRefPoste(String(r), c.service); refs.push(s.ref); postes.push(s.poste); });
      if (postes.some(Boolean)){
        c.koRefs = refs; c.koPostes = postes;
        (c.lignes || []).forEach(l => {
          if (!l.ref || (l.postes && l.postes.length)) return;
          const s = splitRefPoste(String(l.ref), c.service);
          if (s.poste){ l.ref = s.ref; l.postes = [s.poste]; }
        });
        touched = true;
      }
    }
    c.postesOk = true;
    if (touched || c.postesOk) changed.push(c);
  });
  return changed;
}
/* Numéros enregistrés avec les zéros de tête de SAP : on les ramène à la forme
   courte, sans quoi la même DT existe en deux exemplaires selon sa provenance. */
function migrateZeros(){
  const changed = [];
  const pad = x => /^0\d+$/.test(String(x == null ? "" : x).trim());
  Object.values(S.cells).forEach(c => {
    let touched = false;
    (c.koRefs || []).forEach((r, i) => {
      if (pad(r)){ c.koRefs[i] = sansZeros(r); touched = true; }
      const p = (c.koPostes || [])[i];
      if (pad(p)){ c.koPostes[i] = sansZeros(p); touched = true; }
    });
    (c.lignes || []).forEach(l => {
      if (pad(l.ref)){ l.ref = sansZeros(l.ref); touched = true; }
      (l.postes || []).forEach((p, j) => { if (pad(p)){ l.postes[j] = sansZeros(p); touched = true; } });
    });
    if (touched) changed.push(c);
  });
  return changed;
}
/* Contextes enregistrés avant la mise en clair des dates : on réécrit le
   dictionnaire une fois pour toutes plutôt que de traduire à chaque lecture. */
function migrateCtx(){
  const changed = [];
  Object.values(S.cells).forEach(c => {
    const x = c.koCtx;
    /* k absent, ou désaligné parce que le contexte vient d'une version
       antérieure : on le recalcule et on remet les valeurs en clair. */
    if (!x || !Array.isArray(x.c) || (Array.isArray(x.k) && x.k.length === x.c.length)) return;
    x.k = x.c.map(h => { const n = normCol(h);
      return CTX_EST_DATE.test(n) ? "date" : CTX_EST_HEURE.test(n) ? "heure" : ""; });
    x.c.forEach((nom, j) => {
      if (!x.k[j]) return;
      const vieux = x.d[j] || [], neuf = [], vu = {}, remap = [];
      vieux.forEach(v => {
        const lis = ctxLisible(v, x.k[j]);
        let p = vu[lis];
        if (p == null){ p = neuf.length; neuf.push(lis); vu[lis] = p; }
        remap.push(p);
      });
      x.d[j] = neuf;
      x.v[j] = (x.v[j] || []).map(p => (p == null || p < 0 ? -1 : remap[p]));
    });
    changed.push(c);
  });
  return changed;
}
function afterLoad(){
  const a = migrateDates(), b = migratePostes(), d = migrateCtx(), z = migrateZeros();
  const ids = {}; a.concat(b).concat(d).concat(z).forEach(c => { ids[c.id] = c; });
  const chg = Object.values(ids);
  if (chg.length){ bulkPut(chg); return true; }
  return false;
}

/* ---------------------------- données de reprise ----------------------------
   Historique S27 → S36 2026 reconstruit depuis l'export PowerBI et l'extraction
   SAP du dossier du 08/09/2026 (18 709 flux distribution, 10 613 réception).
   Les quatre périmètres retombent exactement sur les chiffres de référence. */
function seedCells(){
  const m = {};
  const src = (typeof REPRISE !== "undefined" && REPRISE && Array.isArray(REPRISE.cells)) ? REPRISE.cells : [];
  src.forEach(c => { const n = normCell(c); m[n.id] = n; });
  return m;
}

/* ---------------------------- calcul ---------------------------- */
function cellStats(c){
  let d = 0, m = 0; const buck = {};
  for (const l of c.lignes){
    if (l.st !== "ok") continue;
    const n = Math.max(0, +l.nb || 0);
    if (!n) continue;
    const g = l.src === "manuel" ? "man" : "doc";
    if (g === "man") m += n; else d += n;
    (buck[l.cat] = buck[l.cat] || {doc:0, man:0})[g] += n;
  }
  const od = Math.min(d, c.ko), om = Math.min(m, Math.max(0, c.ko - od));
  const fd = d > 0 ? od / d : 0, fm = m > 0 ? om / m : 0;
  const cat = {};
  for (const k in buck) cat[k] = { doc: buck[k].doc * fd, man: buck[k].man * fm };
  return { raw:d + m, doc:od, man:om, tot:od + om, over:(d + m) > c.ko, cat };
}
function agg(cells){
  let flux = 0, ko = 0, jd = 0, jm = 0, rawJ = 0;
  const cat = {}; const over = [];
  for (const c of cells){
    const st = cellStats(c);
    flux += c.flux; ko += c.ko; jd += st.doc; jm += st.man; rawJ += st.raw;
    if (st.over) over.push(c);
    for (const k in st.cat){ (cat[k] = cat[k] || {doc:0, man:0}); cat[k].doc += st.cat[k].doc; cat[k].man += st.cat[k].man; }
  }
  const ok = flux - ko, jt = jd + jm;
  return {
    n: cells.length, flux, ko, ok, jdoc: jd, jman: jm, jtot: jt, rawJ,
    reste: Math.max(0, ko - jt), over, cat,
    brut: flux ? ok / flux : null,
    docu: flux ? (ok + jd) / flux : null,
    net:  flux ? (ok + jt) / flux : null,
    couv: flux ? (flux - jt) / flux : null,
    expl: ko ? jt / ko : null
  };
}
/* ------------------- une plage de dates, un seul périmètre -------------------
   La maille dit comment GROUPER les barres. Elle ne doit pas dire quels flux
   sont comptés — et c'est pourtant ce qu'elle faisait : les deux bornes de la
   plage étaient arrondies à la clé de période avant de filtrer, vers l'extérieur
   et sans le dire. Du 15/07 au 10/09, la maille Semaine remontait la borne au
   lundi 13/07 et la maille Mois au 1er juillet ; le même couple de dates donnait
   5 264 flux au jour, 5 503 à la semaine, 5 570 au mois. Trois taux pour une
   seule période.
   Désormais les dates décident seules : une période est retenue si elle touche
   la plage, et celles que la plage coupe sont découpées au jour — quelle que
   soit la maille. Faute de détail au jour, la semaine reste entière : on ne
   l'invente pas, on le dit (voir `coupeesEntieres`). */
function plageLibre(){ return S.ui.preset === "custom" && (S.ui.d1 || S.ui.d2); }
/* La plage coupe-t-elle cette période en deux ? */
function coupee(c){
  if (!plageLibre() || c.jour) return false;
  const [a, b] = spanOf(c);
  return (S.ui.d1 && a < S.ui.d1 && b >= S.ui.d1) || (S.ui.d2 && b > S.ui.d2 && a <= S.ui.d2);
}
/* Cette période touche-t-elle la plage ? */
function dansPlage(c){
  if (!plageLibre()) return true;
  const [a, b] = spanOf(c);
  return (!S.ui.d1 || b >= S.ui.d1) && (!S.ui.d2 || a <= S.ui.d2);
}
/* Les périodes que la plage coupe sans pouvoir les découper, faute de détail au
   jour : elles sont comptées entières, et il faut le dire. */
function coupeesEntieres(){
  if (!plageLibre()) return [];
  return Object.values(S.cells).filter(c =>
    apresPlancher(c) &&
    (S.ui.site === "tous" || c.site === S.ui.site) &&
    (S.ui.serv === "tous" || c.service === S.ui.serv) &&
    coupee(c) && !Object.keys(c.jours || {}).length);
}
/* Toutes les périodes, découpées au jour dès que la vue ou la plage l'exige. */
function effCells(){
  const base = Object.values(S.cells);
  if (!auJour() && !plageLibre()) return base;
  const out = [];
  base.forEach(c => {
    /* Hors maille Jour, on ne découpe que ce que la plage coupe vraiment : une
       semaine entièrement dedans reste entière, et son plafond de
       justifications avec elle. */
    if (!auJour() && !coupee(c)){ out.push(c); return; }
    const d = dayCells(c);
    if (d){ out.push.apply(out, d); return; }
    if (!auJour()){ out.push(c); return; }          /* semaine gardée entière, et signalée */
    /* ---- une semaine sans détail au jour, en maille Jour ----
       On la jetait. Le total affiché perdait alors ses flux sans le dire : la
       même semaine donnait un chiffre à la maille Semaine et un autre à la
       maille Jour, et l'écart n'était expliqué nulle part. On la garde, posée
       sur son lundi : le total reste juste, et la barre anormalement haute dit
       d'elle-même que le détail manque. */
    const sp = spanOf(c);
    out.push(Object.assign({}, c, { jour: sp[0], span: sp, grosJour: true }));
  });
  return out;
}
/* ------------------------- plancher d'affichage -------------------------
   Les semaines antérieures au plancher restent enregistrées, continuent d'être
   justifiées par les règles et alimentent les rapprochements SAP et relevé :
   elles ne sont simplement pas montrées dans le tableau de bord. Juin et le
   début juillet expliquent la file d'attente sans entrer dans le résultat.
   Une période est gardée dès que sa fin atteint le plancher : une semaine à
   cheval n'est jamais coupée en silence. */
function plancher(){ return S.plancher || ""; }
function apresPlancher(c){
  const p = plancher();
  if (!p) return true;
  return spanOf(c)[1] >= p;
}
function horsPlancher(){
  const p = plancher();
  if (!p) return [];
  return Object.values(S.cells).filter(c => !apresPlancher(c));
}
function scopeCells(){
  return effCells().filter(c =>
    apresPlancher(c) &&
    (S.ui.site === "tous" || c.site === S.ui.site) &&
    (S.ui.serv === "tous" || c.service === S.ui.serv));
}
/* ------------------------- découpe au jour -------------------------
   Une période couvre une semaine. Quand son détail journalier a été enregistré
   à l'import (champ `jours`), elle se découpe en autant de périodes d'un jour :
   les KO et les justifications suivent leur propre date. Sans ce détail, la
   semaine reste indivisible — l'outil le dit plutôt que de l'inventer. */
function dayCells(c){
  const jrs = c.jours || {};
  const keys = Object.keys(jrs).sort();
  if (!keys.length) return null;
  const parJour = {};
  keys.forEach(d => { parJour[d] = { refs:[], postes:[], lignes:[] }; });
  (c.koRefs || []).forEach((r, i) => {
    const d = (c.koDates || [])[i];
    if (parJour[d]){ parJour[d].refs.push(r); parJour[d].postes.push((c.koPostes || [])[i] || ""); }
  });
  (c.lignes || []).forEach(l => {
    const d = parJour[l.d] ? l.d : keys[0];   /* sans date : rattachée au premier jour */
    parJour[d].lignes.push(l);
  });
  return keys.map(d => ({
    id: c.id + "@" + d, periode: d, jour: d, parent: c.id,
    site: c.site, service: c.service,
    flux: jrs[d].f, ko: jrs[d].k, litiges: null,
    note: c.note, demo: c.demo, maj: c.maj,
    koRefs: parJour[d].refs, koPostes: parJour[d].postes,
    koDates: parJour[d].refs.map(() => d),
    postesOk: true, jours: { [d]: jrs[d] },
    lignes: parJour[d].lignes
  }));
}
const auJour = () => S.ui.maille === "jour";
/* Une cellule découpée au jour porte un identifiant virtuel « id@date » ;
   toute écriture doit viser la période réelle, qui seule existe en base. */
function realId(id){ const s = String(id || ""); const i = s.indexOf("@"); return i < 0 ? s : s.slice(0, i); }
function realCell(x){
  if (!x) return null;
  const id = typeof x === "string" ? x : (x.parent || x.id);
  return S.cells[realId(id)] || (typeof x === "string" ? null : x);
}
function pkey(c){
  if (c.jour){
    if (S.ui.maille === "mois") return c.jour.slice(0, 4) + "-M" + c.jour.slice(5, 7);
    if (S.ui.maille === "semaine") return weekKey(new Date(c.jour + "T12:00:00Z"));
    return c.jour;
  }
  return S.ui.maille === "mois" ? monthOfWeek(c.periode) : c.periode;
}
function periodKeys(cells){
  return Array.from(new Set((cells || Object.values(S.cells)).map(pkey))).sort(perSort);
}
/* Bornes d'une période, en dates, pour croiser avec une plage libre. */
function spanOf(c){
  /* Une semaine posée sur son lundi faute de détail au jour garde les bornes de
     la semaine : elle couvre bien sept jours, quel que soit le jour qui la porte. */
  if (c.span) return c.span;
  if (c.jour) return [c.jour, c.jour];
  const a = weekMonday(c.periode), b = new Date(a); b.setUTCDate(a.getUTCDate() + 6);
  return [ymd(a), ymd(b)];
}
/* conservé pour un filtrage éventuel par dates ; la plage se règle aujourd'hui
   par la maille Jour et les deux bornes de période */
function inDates(){ return true; }
/* Les périodes que la plage libre ne peut pas découper faute de détail au jour. */
function sansDetail(){
  if (!auJour()) return [];
  return Object.values(S.cells).filter(c =>
    (S.ui.site === "tous" || c.site === S.ui.site) &&
    (S.ui.serv === "tous" || c.service === S.ui.serv) &&
    !Object.keys(c.jours || {}).length);
}
/* Premier et dernier jour couverts par les périodes enregistrées. */
function bornesJours(){
  const cs = Object.values(S.cells).filter(apresPlancher);
  if (!cs.length) return null;
  let a = null, b = null;
  cs.forEach(c => {
    const [x, y] = spanOf(c);
    if (!a || x < a) a = x;
    if (!b || y > b) b = y;
  });
  const p = plancher();
  if (p && a && a < p) a = p;
  return a && b ? [a, b] : null;
}
/* La plage se choisit en dates, pas en numéros de période : un calendrier se lit
   sans savoir que la S32 commence le 3 août. La maille traduit ensuite la date
   en clé de période — c'est elle qui décide si le 3 août veut dire un jour, une
   semaine ou un mois. Les clés sont à largeur fixe et zéro-remplies, donc leur
   comparaison alphabétique est aussi leur comparaison chronologique. */
function cleDeJour(iso){
  if (!iso) return null;
  if (S.ui.maille === "jour") return iso;
  if (S.ui.maille === "mois") return iso.slice(0, 4) + "-M" + iso.slice(5, 7);
  return weekKey(new Date(iso + "T12:00:00Z"));
}
function syncRange(){
  const keys = periodKeys(scopeCells());
  if (!keys.length){ S.ui.from = S.ui.to = null; return keys; }
  if (S.ui.preset !== "custom"){ S.ui.from = keys[0]; S.ui.to = keys[keys.length - 1]; return keys; }
  const b = bornesJours();
  if (!S.ui.d1 && b) S.ui.d1 = b[0];
  if (!S.ui.d2 && b) S.ui.d2 = b[1];
  if (S.ui.d1 && S.ui.d2 && S.ui.d1 > S.ui.d2){ const x = S.ui.d1; S.ui.d1 = S.ui.d2; S.ui.d2 = x; }
  /* Les bornes affichées se relèvent sur ce qui est réellement retenu, pas sur
     un arrondi des dates : c'est la sélection qui fait foi, la maille ne fait
     que la regrouper. */
  const sel = periodKeys(selCells());
  S.ui.from = sel.length ? sel[0] : cleDeJour(S.ui.d1) || keys[0];
  S.ui.to   = sel.length ? sel[sel.length - 1] : cleDeJour(S.ui.d2) || keys[keys.length - 1];
  return keys;
}
function inRange(k){ return (!S.ui.from || k >= S.ui.from) && (!S.ui.to || k <= S.ui.to); }
function selCells(){ return scopeCells().filter(dansPlage); }
function rangeKeys(){ return periodKeys(selCells()); }
function rangeLabel(){
  const k = rangeKeys();
  if (!k.length) return "aucune période";
  if (k.length === 1) return perLong(k[0]);
  const unite = S.ui.maille === "mois" ? " mois" : S.ui.maille === "jour" ? " jours" : " semaines";
  return perLabel(k[0]) + " → " + perLabel(k[k.length - 1]) + " · " + k.length + unite;
}
function filtersActive(){
  return S.ui.site !== "tous" || S.ui.serv !== "tous" || S.ui.preset !== "all" || S.ui.maille !== "semaine";
}
/* Un identifiant de flux porte la demande et le poste. Les formes rencontrées :
     distribution  7304007            → DT 7304007, poste inconnu
                   7304007-3          → DT 7304007, poste 3
                   4512-7304007-3     → DT 7304007, poste 3   (préfixe ignoré)
     réception     90139790-10        → BR 90139790, poste 10
                   90139790-10-2      → BR 90139790, poste 10-2
   La demande sert de regroupement, le poste distingue les flux à l'intérieur. */
/* SAP écrit ses numéros sur une largeur fixe (0090142762, poste 00010), l'export
   PowerBI parfois aussi, le relevé jamais. Sans forme unique, « 90142762-10 »
   déjà justifié et « 0090142762-00010 » fraîchement importé sont deux postes
   différents pour l'outil : la justification se décroche et le poste réapparaît
   à justifier. On ramène donc tout numéro purement chiffré à sa forme courte. */
function sansZeros(x){
  const s = String(x == null ? "" : x).trim();
  return /^0\d+$/.test(s) ? s.replace(/^0+/, "") || "0" : s;
}
function splitRefPoste(raw, service){
  const s = String(raw || "").trim();
  if (!s) return { ref:"", poste:"" };
  const p = s.split("-").map(x => x.trim()).filter(x => x !== "");
  if (p.length <= 1) return { ref:sansZeros(s), poste:"" };
  if (service === "distri"){
    if (p.length === 2) return { ref:sansZeros(p[0]), poste:sansZeros(p[1]) };
    return { ref:sansZeros(p[1]), poste:sansZeros(p.slice(2).join("-")) };
  }
  return { ref:sansZeros(p[0]), poste:sansZeros(p.slice(1).join("-")) };
}
/* Tri naturel des numéros de poste : 10 avant 100, et le texte à la fin. */
function cmpPoste(a, b){
  const na = parseFloat(a), nb = parseFloat(b);
  const oka = isFinite(na) && /^\d/.test(a), okb = isFinite(nb) && /^\d/.test(b);
  if (oka && okb) return na - nb || String(a).localeCompare(String(b));
  if (oka) return -1;
  if (okb) return 1;
  return String(a).localeCompare(String(b), "fr");
}
/* ------------------- un poste peut porter plusieurs flux -------------------
   Une même DT à un même poste revient plusieurs fois dans l'export quand la
   ligne déplace plusieurs objets : même demande, même poste, des codes objet
   différents, et autant de flux comptés par le KPI. Une justification posée sur
   ce poste les explique tous — elle doit donc en retirer autant, pas un seul.
   Sans ce décompte, justifier un poste en quatre exemplaires en retirait un et
   rendait les trois autres inatteignables : aucune règle ne pouvait plus les
   viser, et ils ne comptaient nulle part. */
function occKo(cell){
  const o = cell && cell.__occ;
  if (o && o.n === (cell.koRefs || []).length) return o.m;
  const m = {};
  (cell && cell.koRefs || []).forEach((r, i) => {
    const p = String((cell.koPostes || [])[i] || "");
    if (p) { const k = sansZeros(r) + "|" + p; m[k] = (m[k] || 0) + 1; }
  });
  try { Object.defineProperty(cell, "__occ", { value:{ n:(cell.koRefs || []).length, m }, configurable:true }); } catch(e){}
  return m;
}
/* Ce qu'une ligne retire réellement du décompte. Les postes nommés valent ce que
   l'export en montre ; à défaut de détail chargé, la quantité saisie fait foi. */
function poidsLigne(cell, l){
  const ps = (l.postes || []).map(String).filter(Boolean);
  if (!ps.length) return Math.max(0, +l.nb || 0);
  if (!(cell.koRefs || []).length) return Math.max(0, +l.nb || 0);
  const m = occKo(cell), k = sansZeros(l.ref);
  let n = 0, vu = false;
  ps.forEach(p => { const q = m[k + "|" + p]; if (q){ n += q; vu = true; } });
  return vu ? n : Math.max(0, +l.nb || 0);
}
/* ---------------- une référence, un budget de KO ----------------
   Une référence ne peut pas être justifiée plus de fois qu'elle n'est en KO.
   Quand deux sources visent le même KO, l'ordre est celui annoncé dans l'onglet
   des règles : le relevé quotidien passe devant l'automatique, qui passe devant
   la saisie à la main. La ligne écartée ne disparaît pas en silence — sa cause
   est reprise dans le commentaire de celle qui reste, et l'import en rend
   compte. Sans ce garde-fou, un import de relevé posé après une règle justifiait
   deux fois le même KO : le total de la période enflait sans qu'aucun écran ne
   le dise. */
const RANG_SRC = { releve:0, auto:1, manuel:2 };
const rangSrc = l => (l && RANG_SRC[l.src] != null) ? RANG_SRC[l.src] : 3;
function budgetRef(cell, ref){
  const r = sansZeros(ref);
  return (cell.koRefs || []).reduce((n, x) => n + (sansZeros(x) === r ? 1 : 0), 0);
}
/* Ramène les lignes d'une période dans le budget de chaque référence citée.
   `refs` limite le travail aux références qu'on vient de toucher ; sans elle,
   toutes les références de la période sont revues. */
function ajusteRef(cell, lignes, refs){
  const vise = refs ? new Set(Array.from(refs).map(sansZeros)) : null;
  const horsJeu = [], parRef = {};
  lignes.forEach(l => {
    const r = sansZeros(l.ref);
    if (vise && !vise.has(r)) { horsJeu.push(l); return; }
    (parRef[r] = parRef[r] || []).push(l);
  });
  let ecartes = 0, rognes = 0;
  const gardees = [];
  Object.keys(parRef).forEach(r => {
    const ls = parRef[r].slice().sort((a, b) => rangSrc(a) - rangSrc(b) ||
      ((a.postes || []).length ? 0 : 1) - ((b.postes || []).length ? 0 : 1));
    let reste = budgetRef(cell, r);
    const prises = [], laissees = [];
    ls.forEach(l => {
      if (reste <= 0){ laissees.push(l); ecartes++; return; }
      const poids = poidsLigne(cell, l);
      if (poids <= reste){ prises.push(l); reste -= poids; return; }
      /* La ligne déborde. Nommer des postes ne se coupe pas en deux ; une
         quantité, si. */
      if ((l.postes || []).length){ laissees.push(l); ecartes++; return; }
      prises.push(Object.assign({}, l, { nb: reste })); rognes++; reste = 0;
    });
    /* La cause écartée rejoint le commentaire de la ligne gardée — avec les mots
       de celui qui l'a saisie, pas seulement l'étiquette de sa catégorie : c'est
       la phrase tapée à la main qui a de la valeur, et c'est elle qu'on
       chercherait plus tard. Une ligne rigoureusement identique à celle qui
       reste ne laisse rien : il n'y a rien à dire d'un doublon exact. */
    if (laissees.length && prises.length){
      const g = prises[0];
      const dits = [];
      laissees.forEach(l => {
        /* Deux lignes de même cause et de même origine sont interchangeables : il
           n'y a rien à dire d'un doublon exact, et le redire ferait grossir le
           commentaire à chaque passage des règles. */
        if (l.cat === g.cat && l.src === g.src) return;
        const com = String(l.com || "").trim();
        const t = (CAT[l.cat] ? CAT[l.cat].l : l.cat) + (l.src === "manuel" ? " (à la main)" : "") +
          (com && com.indexOf("remplace") < 0 ? " — " + com : "");
        if (dits.indexOf(t) < 0) dits.push(t);
      });
      if (dits.length) prises[0] = Object.assign({}, g, {
        com: coupe([String(g.com || "").replace(/(?:^| · )remplace : .*$/, ""),
          "remplace : " + dits.join(" · ")].filter(Boolean).join(" · "), 400) });
    }
    gardees.push.apply(gardees, prises);
  });
  return { lignes: horsJeu.concat(gardees), ecartes, rognes };
}
/* Les postes déjà couverts par une justification, pour une référence donnée.
   Une ligne peut porter des postes nommés (l.postes) ou seulement une quantité (l.nb). */
function coverage(cell, ref){
  const r = String(ref), postes = new Set();
  let qty = 0;
  (cell.lignes || []).forEach(l => {
    if (String(l.ref) !== r) return;
    const ps = (l.postes || []).map(String).filter(Boolean);
    if (ps.length){ ps.forEach(p => postes.add(p)); }
    else qty += Math.max(0, +l.nb || 0);
  });
  return { postes, qty };
}
/* Une entrée par référence encore incomplètement traitée, avec ses postes restants. */
function toQualify(){
  /* Les périodes sélectionnées peuvent être découpées au jour : on regroupe sur
     la période réelle, seule porteuse des justifications, mais on ne retient que
     les KO effectivement dans la plage affichée. */
  const grp = {};
  for (const c of selCells()){
    if (!c.koRefs || !c.koRefs.length) continue;
    const real = realCell(c) || c;
    c.koRefs.forEach((r, i) => {
      const k = real.id + "\u0000" + String(r);
      const g = grp[k] || (grp[k] = { cell:real, ref:String(r), n:0, postes:[], d:"" });
      g.n++;
      const p = ((c.koPostes || [])[i] || "").toString();
      if (p) g.postes.push(p);
      const dd = (c.koDates || [])[i];
      if (dd && (!g.d || dd < g.d)) g.d = dd;
    });
  }
  const out = [];
  for (const k in grp){
    const g = grp[k], cov = coverage(g.cell, g.ref);
    const totalCell = (g.cell.koRefs || []).reduce((s, r) => s + (String(r) === g.ref ? 1 : 0), 0) || g.n;
    /* Un poste n'est proposé qu'une fois même s'il porte plusieurs flux : le
       cocher les justifie tous. */
    let libres = [...new Set(g.postes.filter(p => !cov.postes.has(p)))];
    /* Un poste couvert retire tous les flux qu'il porte, pas un par poste :
       sinon le reste annoncé dépassait les postes encore proposés. */
    const occ = occKo(g.cell), kref = sansZeros(g.ref);
    let couvPostes = 0;
    cov.postes.forEach(p => { couvPostes += occ[kref + "|" + p] || 1; });
    couvPostes = Math.min(couvPostes, totalCell);
    const parQty = Math.min(cov.qty, Math.max(0, totalCell - couvPostes));
    const resteCell = Math.max(0, totalCell - couvPostes - parQty);
    const reste = Math.min(g.n, resteCell);   /* jamais plus que ce que la plage montre */
    if (reste <= 0) continue;
    libres.sort(cmpPoste);
    if (libres.length > reste) libres = libres.slice(0, reste);
    out.push({ cell:g.cell, ref:g.ref, n:reste, total:totalCell, postes:libres, d:g.d || "",
      ops: opsRef(g.cell, g.ref, libres.length ? libres : null),
      ret: retardKo(g.cell, g.ref, libres.length ? libres : null) });
  }
  return out;
}
const cellLbl = c => perLabel(c.periode) + " " + SITES[c.site].l.slice(0, 3) + "/" + (c.service === "distri" ? "D" : "R");
function controls(){
  const raw = [];
  const cs = selCells(), a = agg(cs);
  const sdVide = sansDetail();
  if (!cs.length){
    if (sdVide.length && S.ui.maille === "jour") return [{ k:"warn", t:"Aucune période n'a le détail au jour",
      d: n0(sdVide.length) + " période(s) dans le périmètre, mais leur export a été chargé avant que l'outil compte les flux par date. Réimportez un export pour lire au jour, ou revenez en maille Semaine." }];
    return [{ k:"warn", t:"Aucune donnée sur ce périmètre", d:"Choisissez une autre période, ou importez un export dans l'onglet Import." }];
  }
  a.over.forEach(c => raw.push({ k:"crit", t:"Justifications supérieures aux KO", tag: cellLbl(c) + " (" + n0(cellStats(c).raw) + " pour " + n0(c.ko) + " KO)",
    why:"Le surplus est ignoré dans le calcul, mais la saisie est à corriger." }));
  /* La plage tombe au milieu d'une semaine dont l'export ne porte pas le détail
     au jour : elle entre entière, avec les jours d'avant ou d'après. C'est la
     seule chose que les dates choisies ne décident pas — autant l'écrire. */
  coupeesEntieres().forEach(c => raw.push({ k:"warn", t:"Semaine comptée entière",
    tag: cellLbl(c) + " (" + n0(c.flux) + " flux)",
    why:"La plage la coupe en deux, mais son export a été chargé avant que l'outil compte les flux par date : "
      + "impossible de n'en garder qu'une partie, elle entre en entier. "
      + "Un réimport de cette semaine permettrait de la découper." }));
  /* Une règle dont la colonne a disparu de l'export ne juge plus rien. Ses
     justifications sont gardées — c'est une panne de lecture, pas une cause qui
     tombe — mais il faut le dire, sinon la règle passe pour active alors qu'elle
     est aveugle. */
  if (typeof regleEvaluable === "function" && (S.regles || []).length){
    const reels = cs.map(c => realCell(c) || c).filter((c, i, l) => l.findIndex(x => x.id === c.id) === i)
      .filter(c => (c.koRefs || []).length);
    const dispo = ctxColonnes();
    S.regles.filter(r => r.actif).forEach(r => {
      const aveugle = reels.filter(c => !regleEvaluable(r, c));
      if (!aveugle.length) return;
      const manque = colsRequises(r).filter(col => dispo.indexOf(col) < 0);
      raw.push({ k:"crit", t:"Une règle ne peut plus être lue",
        tag: r.nom + " — " + n0(aveugle.length) + " période" + (aveugle.length > 1 ? "s" : ""),
        why: (manque.length
              ? "La colonne « " + manque.join(" », « ") + " » n'est plus"
              : "Les colonnes qu'elle lit ne sont plus") +
             " dans l'export conservé avec ces KO. Les justifications déjà posées sont gardées telles quelles, " +
             "mais la règle ne juge plus rien : réimportez un export en cochant toutes les colonnes." });
    });
  }
  /* Deux règles sur un même KO : le résultat est juste, mais c'est l'ordre de la
     liste qui a tranché. Autant le dire plutôt que de le laisser deviner. */
  (typeof conflitsRegles === "function" ? conflitsRegles() : []).forEach(c =>
    raw.push({ k:"warn", t:"Deux règles visent les mêmes KO", tag: c.na + " → " + c.nb + " (" + n0(c.n) + " KO)",
      why:"Un KO ne reçoit qu'une cause : c'est la règle la plus haute dans la liste qui la pose. L'ordre se change dans l'onglet Import." }));
  /* ---- la preuve contre la cause ----
     Ces deux contrôles sont l'audit que je faisais à la main, mis dans l'outil :
     une justification que la donnée contredit, et un poste que la donnée justifie
     sans que personne l'ait vu. Ils se refont tout seuls à chaque affichage. */
  cs.map(c => realCell(c) || c).filter((c, i, l) => l.findIndex(x => x.id === c.id) === i)
    .forEach(c => {
      const nKo = {}, couv = {}, postesKo = {};
      (c.koRefs || []).forEach((r, i) => { const k = sansZeros(r); nKo[k] = (nKo[k] || 0) + 1;
        const p = String((c.koPostes || [])[i] || "");
        if (p) (postesKo[k] = postesKo[k] || {})[p] = 1; });
      (c.lignes || []).forEach(l => {
        if (l.st !== "ok") return;
        const k = sansZeros(l.ref);
        (l.postes || []).forEach(p => couv[k + "|" + p] = 1);
        if (!(l.postes || []).length) couv[k + "|*"] = 1;
      });
      /* Une justification qui ne vise plus rien. Elle continue pourtant à retirer
         ses KO du décompte : c'est le cas d'un export corrigé où la ligne n'est
         plus en retard, ou d'une référence saisie à côté. Sans ce contrôle, elle
         se fond dans le net sans que rien ne la signale. */
      if ((c.koRefs || []).length){
        const occ = occKo(c);
        const perdues = (c.lignes || []).filter(l => {
          if (l.st !== "ok" || !(+l.nb > 0)) return false;
          const k = sansZeros(l.ref), ps = (l.postes || []).map(String);
          if (ps.length) return !ps.some(p => occ[k + "|" + p]);
          return !nKo[k];
        });
        if (perdues.length) raw.push({ k:"crit", t:"Justification sans KO correspondant",
          tag: cellLbl(c) + " · " + perdues.slice(0, 3).map(l => l.ref + ((l.postes || []).length ? " p." + l.postes.join("/") : "")).join(", ") +
            (perdues.length > 3 ? " +" + (perdues.length - 3) : ""),
          why:"L'export chargé ne porte plus ce retard : la ligne retire " + n0(perdues.reduce((s, l) => s + (+l.nb || 0), 0)) +
            " KO qui n'existent plus. Vérifiez la référence, ou supprimez la justification." });
      }
      /* Une référence justifiée plus de fois qu'elle n'est en KO. Le total de la
         période est plafonné à l'affichage, donc l'écart ne se voit nulle part —
         mais deux sources se disputent alors le même KO, et la cause montrée
         n'est plus celle qui compte. */
      if ((c.koRefs || []).length){
        const parRef = {};
        (c.lignes || []).forEach(l => { if (l.st !== "ok") return;
          const k = sansZeros(l.ref); (parRef[k] = parRef[k] || []).push(l); });
        const trop = [];
        Object.keys(parRef).forEach(k => {
          const somme = parRef[k].reduce((s, l) => s + poidsLigne(c, l), 0);
          const bud = nKo[k] || 0;
          if (bud && somme > bud) trop.push({ ref:k, somme, bud,
            src: Array.from(new Set(parRef[k].map(l => l.src || "—"))).join("+") });
        });
        if (trop.length) raw.push({ k:"crit", t:"Une référence justifiée plus de fois qu'elle n'est en KO",
          tag: cellLbl(c) + " · " + trop.slice(0, 3).map(x => x.ref + " " + x.somme + "/" + x.bud + " (" + x.src + ")").join(", ") +
            (trop.length > 3 ? " +" + (trop.length - 3) : ""),
          why:"Deux sources justifient le même retard — le plus souvent un relevé posé par-dessus une règle. " +
            "Réimportez le relevé : il reprendra la place et la cause écartée passera en commentaire." });
      }
      (c.lignes || []).forEach(l => {
        /* Seule une justification qui INVOQUE la réédition peut être contredite
           par le délai recompté depuis la recréation. Un blocage douane, un
           reliquat ou une grue tiennent debout tout seuls : que le poste ait été
           recréé par ailleurs ne les invalide pas. Sans cette garde, le contrôle
           criait au loup dès qu'une règle posait sa cause sur un poste que SAP
           connaît — six lignes d'un même BR pour un seul vrai sujet. */
        if (l.cat !== "reedition" || l.st !== "ok") return;
        const rd = reedRef(c, l.ref, l.postes);
        if (!rd.length) return;
        if (rd.some(x => x.reel == null || x.reel > x.obj))
          raw.push({ k:"crit", t:"Une justification que SAP contredit", tag: cellLbl(c) + " · " + l.ref,
            why:"Le poste est bien recréé, mais son délai depuis la recréation dépasse l'objectif : la réédition " +
              "ne suffit pas à expliquer ce retard. Rechargez l'extraction SAP pour la refaire poser." });
      });
      for (const k in (c.reed || {})){
        const i = k.lastIndexOf("-"); if (i < 0) continue;
        const ref = sansZeros(k.slice(0, i)), poste = k.slice(i + 1), v = c.reed[k];
        if (!nKo[ref] || v.reel == null || !(v.reel <= v.obj)) continue;
        /* Le contrôle doit poser exactement la même question que la règle, sinon
           il crie au loup : une preuve gardée en réserve, dont le poste n'est pas
           en KO, n'est pas un poste « manqué ». */
        if (postesKo[ref] && !postesKo[ref][poste]) continue;
        if (couv[ref + "|" + poste] || couv[ref + "|*"]) continue;
        raw.push({ k:"warn", t:"Un poste recréé conforme n'est pas retiré", tag: cellLbl(c) + " · " + ref + "-" + poste,
          why:"SAP donne un délai de " + dec(v.reel, Number.isInteger(v.reel) ? 0 : 2) + " " + (v.u === "h" ? "h" : "j ouvrés") +
            " depuis la recréation, pour un objectif de " + v.obj + " : ce KO devrait sortir du décompte. " +
            "Relancez « Rejouer sur tout l'historique » dans les règles." });
      }
    });
  if (a.jtot > 0 && a.jman / a.jtot > 0.5 && (a.net - a.brut) > 0.005)
    raw.push({ k:"warn", t:"L'écart repose surtout sur du déclaratif", tag: dec(a.jman / a.jtot * 100, 0) + " % des KO retirés",
      why:"Publiez le net avec le documenté, sinon l'écart ne se défend pas." });
  /* La seule chose qui fasse encore diverger deux mailles sur la même plage :
     une semaine sans détail au jour n'a pas sa place dans une vue au jour, et
     elle en sort. Le total change donc en passant à la maille Jour — on dit
     combien de flux, sinon l'écart passe pour une erreur de calcul. */
  const sd = sdVide;
  if (sd.length) raw.push({ k:"warn", t:"Semaines sans détail au jour",
    tag: n0(sd.length) + (sd.length > 1 ? " périodes" : " période") + " · " +
      n0(sd.reduce((s, c) => s + (c.flux || 0), 0)) + " flux",
    why: "Leur export a été chargé avant que l'outil compte les flux par date : impossible de les répartir. "
      + "Elles sont <b>comptées en entier sur leur lundi</b> — le total est juste, mais la courbe au jour y fait une marche. "
      + "Un réimport de ces semaines la lisserait." });
  const byCouple = {};
  scopeCells().forEach(c => { const k = c.site + "|" + c.service; (byCouple[k] = byCouple[k] || []).push(c); });
  Object.entries(byCouple).forEach(([k, list]) => {
    if (list.length < 4) return;
    const vals = list.map(c => c.flux).sort((x, y) => x - y);
    const med = vals[Math.floor(vals.length / 2)];
    list.filter(c => med > 0 && c.flux < med * 0.6 && dansPlage(c)).forEach(c => raw.push({
      k:"warn", t:"Volume très inférieur à la médiane",
      tag: cellLbl(c) + " (" + n0(c.flux) + " flux pour " + n0(med) + " en médiane)",
      why:"Semaine creuse (congés, arrêt de chantier) ou export partiel : un export incomplet fait monter le brut sans rien améliorer. À trancher avant de commenter la tendance." }));
  });
  const attendu = [];
  Object.keys(SITES).forEach(si => Object.keys(SERVS).forEach(sv => {
    if (S.ui.site !== "tous" && S.ui.site !== si) return;
    if (S.ui.serv !== "tous" && S.ui.serv !== sv) return;
    attendu.push([si, sv]);
  }));
  const sc = scopeCells();
  rangeKeys().forEach(p => attendu.forEach(([si, sv]) => {
    if (!sc.some(c => pkey(c) === p && c.site === si && c.service === sv))
      raw.push({ k:"warn", t:"Période incomplète", tag: perLabel(p) + " " + SITES[si].l.slice(0, 3) + "/" + (sv === "distri" ? "D" : "R"),
        why:"Rien n'est saisi sur ce périmètre : le cumul mélange des périodes inégales." });
  }));
  cs.filter(c => c.ko >= 10 && cellStats(c).tot === 0).forEach(c => raw.push({
    k:"warn", t:"Aucune cause enregistrée", tag: cellLbl(c) + " (" + n0(c.ko) + " KO)",
    why:"Le net y est égal au brut : ces KO restent à qualifier." }));
  if (!raw.length) return [{ k:"ok", t:"Aucun contrôle en défaut",
    d:"Volumes cohérents, périmètres complets, justifications inférieures aux KO. Le net est publiable avec le brut et la couverture." }];
  const order = { crit:0, warn:1, ok:2 }, map = {}, out = [];
  raw.forEach(o => { const key = o.k + "|" + o.t; if (!map[key]){ map[key] = { k:o.k, t:o.t, why:o.why, tags:[] }; out.push(map[key]); } map[key].tags.push(o.tag); });
  out.sort((x, y) => order[x.k] - order[y.k]);
  return out.map(x => ({ k:x.k, t: x.tags.length > 1 ? x.t + " — " + x.tags.length + " cas" : x.t,
    d: x.tags.slice(0, 4).join(" · ") + (x.tags.length > 4 ? " · et " + (x.tags.length - 4) + " autres" : "") + ". " + x.why }));
}
