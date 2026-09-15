/* =========================================================================
   Bloc 3 : règles automatiques
   Une règle lit les colonnes de l'export conservées avec chaque KO et pose
   une cause à sa place. Elle s'applique aux périodes déjà chargées comme aux
   prochains imports, et se défait aussi bien qu'elle se pose.
   ========================================================================= */

const OPS_COL = [
  { k:"est",       l:"est exactement",      val:true },
  { k:"nest",      l:"n'est pas",           val:true },
  { k:"contient",  l:"contient",            val:true },
  { k:"ncontient", l:"ne contient pas",     val:true },
  { k:"vide",      l:"est vide",            val:false },
  { k:"nvide",     l:"n'est pas vide",      val:false },
  { k:"sup",       l:"est supérieur à",     val:true, num:true },
  { k:"inf",       l:"est inférieur à",     val:true, num:true }
];
const OPS_ECART = [
  { k:"le", l:"au plus" }, { k:"lt", l:"moins de" },
  { k:"ge", l:"au moins" }, { k:"gt", l:"plus de" }, { k:"eq", l:"exactement" }
];

const normVal = s => String(s == null ? "" : s).trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "");
const nombre = s => { const n = parseFloat(String(s).replace(",", ".")); return isFinite(n) ? n : null; };

/* Une condition sur une colonne, pour un KO donné. */
function condVraie(cond, cell, i){
  const v = ctxVal(cell, i, cond.col);
  const a = normVal(v), b = normVal(cond.val);
  switch (cond.op){
    case "est":       return a === b;
    case "nest":      return a !== b;
    case "contient":  return !!a && a.includes(b);
    case "ncontient": return !a || !a.includes(b);
    case "vide":      return !a;
    case "nvide":     return !!a;
    case "sup":       { const x = nombre(v), y = nombre(cond.val); return x != null && y != null && x > y; }
    case "inf":       { const x = nombre(v), y = nombre(cond.val); return x != null && y != null && x < y; }
    default:          return false;
  }
}
/* Écart de la première date à la seconde, en jours ouvrés ou calendaires.
   Négatif quand la seconde précède la première — joursOuvres ne compte que vers
   l'avant, on l'appelle donc dans le bon sens et on rend le signe. */
function ecartJours(cell, i, colA, colB, ouvres){
  const a = parseDate(ctxVal(cell, i, colA)), b = parseDate(ctxVal(cell, i, colB));
  if (!a || !b) return null;
  const ja = toUTCDay(a), jb = toUTCDay(b);
  if (!ouvres) return Math.round((jb - ja) / 864e5);
  return jb >= ja ? joursOuvres(ja, jb) : -joursOuvres(jb, ja);
}
function compare(x, op, n){
  switch (op){
    case "le": return x <= n; case "lt": return x < n;
    case "ge": return x >= n; case "gt": return x > n;
    case "eq": return x === n; default: return false;
  }
}
/* La règle vise-t-elle ce KO ? */
function regleVise(r, cell, i, ref){
  if (!r.actif) return false;
  if (r.service && r.service !== "tous" && r.service !== cell.service) return false;
  if (r.type === "liste"){
    const set = r.refsSet || (r.refsSet = new Set((r.refs || []).map(x => String(x).trim()).filter(Boolean)));
    const p = (cell.koPostes || [])[i] || "";
    return set.has(String(ref)) || (p && set.has(String(ref) + "-" + p));
  }
  if (r.type === "dates"){
    const e = ecartJours(cell, i, r.dateA, r.dateB, r.ouvres !== false);
    if (e == null) return false;
    if (!compare(e, r.opD, +r.nD || 0)) return false;
    return (r.conds || []).every(c => condVraie(c, cell, i));
  }
  return (r.conds || []).length > 0 && r.conds.every(c => condVraie(c, cell, i));
}
/* ---- une règle qu'on ne peut plus lire ----
   Une règle s'appuie sur des colonnes de l'export, gardées avec chaque KO. Si
   l'export suivant ne les porte plus — le « tout cocher » oublié, une version
   du rapport qui change — la condition ne devient pas fausse : elle devient
   illisible. Les deux se ressemblaient dans le code, et la règle effaçait alors
   ses justifications en silence. Ce n'est pas une cause qui cesse d'être vraie,
   c'est une panne de lecture : on garde les lignes et on le dit. */
function colsRequises(r){
  if (!r || r.type === "liste") return [];
  const out = (r.conds || []).map(c => c.col).filter(Boolean);
  if (r.type === "dates"){ if (r.dateA) out.push(r.dateA); if (r.dateB) out.push(r.dateB); }
  return out;
}
function regleEvaluable(r, cell){
  const need = colsRequises(r);
  if (!need.length) return true;
  const x = cell && cell.koCtx;
  if (!x || !Array.isArray(x.c) || !x.c.length) return false;
  return need.every(col => x.c.indexOf(col) >= 0);
}
/* Les KO déjà couverts par une justification qui n'est pas d'une règle. */
function dejaCouverts(cell){
  const parPoste = new Set(), parRef = {};
  (cell.lignes || []).forEach(l => {
    if (l.regle) return;                       /* posé par une règle : rejouable */
    const ps = (l.postes || []).map(String);
    if (ps.length) ps.forEach(p => parPoste.add(String(l.ref) + "|" + p));
    else parRef[String(l.ref)] = (parRef[String(l.ref)] || 0) + Math.max(0, +l.nb || 0);
  });
  return { parPoste, parRef };
}
/* Passe les règles sur une liste de périodes.
   Idempotent : les lignes déjà posées par une règle sont refaites, les autres
   ne sont jamais touchées. `simule` n'écrit rien et rend seulement le compte. */
/* ---------------- la réédition, devenue une règle comme les autres ----------------
   Tant qu'elle vivait dans l'import SAP, elle ne passait qu'une fois : un réimport
   PowerBI la laissait derrière. Depuis que la période garde `reed` — ce que SAP dit
   de chaque poste recréé — elle se rejoue sans le fichier, se défait quand la preuve
   ne la porte plus, et prime sur une saisie à la main : le délai recompté est une
   pièce, la saisie une appréciation. */
const REGLE_REED = "__reed";
function reedLignes(cell){
  const m = cell && cell.reed; if (!m) return [];
  const nKo = {}, postesKo = {};
  (cell.koRefs || []).forEach((r, i) => {
    const k = sansZeros(r); nKo[k] = (nKo[k] || 0) + 1;
    const p = String((cell.koPostes || [])[i] || "");
    if (p) (postesKo[k] = postesKo[k] || {})[p] = 1;
  });
  const out = [];
  for (const k in m){
    const i = k.lastIndexOf("-"); if (i < 0) continue;
    const ref = sansZeros(k.slice(0, i)), poste = k.slice(i + 1), v = m[k] || {};
    if (!nKo[ref]) continue;                       /* ce KO n'est pas chargé */
    if (postesKo[ref] && !postesKo[ref][poste]) continue;
    if (v.reel == null || !(v.reel <= v.obj)) continue;   /* délai réel au-delà : le KO reste */
    out.push({ ref, poste, v });
  }
  return out;
}
function passerRegles(cells, regles, simule, conflits){
  const actives = (regles || []).filter(r => r.actif);
  const stats = { total:0, parRegle:{}, cellules:0, reed:0, repris:0, conflits:{}, gelees:0, parGel:{},
                  reprisMain:0, doubles:0, tenus:{} };
  const out = [];
  cells.forEach(cell => {
    const reed = reedLignes(cell);
    const vises = {};
    reed.forEach(x => { vises[x.ref + "|" + x.poste] = 1; });
    /* ---- la mention de reprise doit survivre au passage suivant ----
       Les lignes de règle sont défaites et refaites à chaque passage. La saisie
       qu'elles ont remplacée, elle, n'existe plus : au deuxième passage il n'y a
       plus rien à reprendre, et la mention « remplace la saisie … » disparaissait
       en silence. On la relève sur la ligne d'avant et on la repose telle quelle :
       c'est la seule trace de ce que quelqu'un avait écrit à la main. */
    const memo = {};
    (cell.lignes || []).forEach(l => {
      if (!l.regle) return;
      const m = String(l.com || "").match(/ · remplace la saisie .*$/);
      if (m) memo[l.regle + "|" + sansZeros(l.ref) + "|" + String((l.postes || [])[0] || "")] = m[0];
    });
    const repriseDite = (regle, ref, poste) => memo[regle + "|" + sansZeros(ref) + "|" + String(poste || "")] || "";
    /* une saisie portant exactement ce poste cède la place, et sa cause est gardée
       dans le commentaire : rien n'est perdu, la meilleure preuve l'emporte */
    const repris = [];
    /* les règles que cette période ne permet plus de juger */
    const gel = {};
    actives.forEach(r => { if (!regleEvaluable(r, cell)) gel[r.id] = 1; });
    const figees = [];
    /* ---- rendre les saisies que les règles avaient reprises ----
       Une règle qui reprend une saisie ne la détruit pas : elle l'emporte avec
       elle dans `rep`. À chaque passage on la remet en place d'abord, puis on
       rejoue — si la règle la vise encore, elle la reprendra de nouveau ; si la
       règle a été retirée ou désactivée, la saisie est simplement de retour.
       Sans cela, supprimer une règle effaçait pour de bon le travail de
       quelqu'un, et les KO qu'elle couvrait ressortaient sans aucune cause.
       Une ligne gardée faute de pouvoir la rejuger garde la sienne au chaud. */
    const rendu = {};
    (cell.lignes || []).forEach(l => {
      if (!l.regle || l.regle === REGLE_REED || !l.rep || gel[l.regle]) return;
      let r = null; try { r = JSON.parse(l.rep); } catch(e){ return; }
      if (!r || !r.c || !CAT[r.c]) return;
      /* Chaque ligne de règle emporte SA part. On les regroupe par saisie
         d'origine et on additionne : dix lignes pour une saisie de dix postes
         redonnent la saisie entière, et six lignes prises sur une saisie de dix
         ne redonnent que six — les quatre autres sont encore visibles. */
      const k = r.i || [String(r.r || l.ref), r.c, r.s].join("|");
      const g = rendu[k] || (rendu[k] = { i: r.i || "", ref: String(r.r || l.ref), cat: r.c,
        src: SRC[r.s] ? r.s : "manuel", com: String(r.m || ""), d: r.d || l.d || "",
        st: r.t === "rejet" ? "rejet" : "ok", n: 0, p: [], pose: false });
      g.n += Math.max(0, +r.n || 0);
      if (!r.q) (Array.isArray(r.p) ? r.p : []).forEach(x => {
        const s = String(x); if (s && g.p.indexOf(s) < 0) g.p.push(s); });
    });
    /* Une saisie seulement rognée est encore là : on lui rend sa part au lieu
       d'en créer une seconde à côté. */
    const source = (cell.lignes || []).map(l => {
      const g = (!l.regle && l.id && rendu[l.id]) ? rendu[l.id] : null;
      if (!g || g.n <= 0) return l;
      g.pose = true;
      return Object.assign({}, l, { nb: Math.max(0, +l.nb || 0) + g.n,
        postes: (l.postes || []).concat(g.p.filter(x => (l.postes || []).indexOf(x) < 0)) });
    });
    Object.keys(rendu).forEach(k => {
      const g = rendu[k];
      if (g.pose || g.n <= 0) return;
      source.push({ id: g.i || uid(), ref: g.ref, postes: g.p, cat: g.cat, nb: g.n,
        src: g.src, com: g.com, d: g.d, st: g.st });
    });
    const avant = source.filter(l => {
      if (l.regle){
        if (l.regle === REGLE_REED) return false;      /* refaite depuis `reed` */
        if (gel[l.regle]){
          stats.gelees++; stats.parGel[l.regle] = (stats.parGel[l.regle] || 0) + 1;
          figees.push(l); return true;                 /* illisible : on garde */
        }
        return false;
      }
      const ps = (l.postes || []).map(String);
      /* Une saisie posée en quantité ne nomme aucun poste. Si la réédition couvre
         déjà tous les KO de sa référence, elle fait double emploi : elle cède la
         place comme le ferait une saisie au poste, et sa cause part dans le
         commentaire de la ligne qui reste. Sans ce cas, la saisie survivait au
         filtre puis se faisait retirer plus loin par le plafond — sans un mot. */
      if (!ps.length){
        const rn = sansZeros(l.ref);
        const n = (cell.koRefs || []).reduce((s, r) => s + (sansZeros(r) === rn ? 1 : 0), 0);
        if (!n) return true;
        const couv = reed.filter(x => x.ref === rn)
          .reduce((s, x) => s + (occKo(cell)[x.ref + "|" + x.poste] || 1), 0);
        if (couv < n) return true;
        if (l.cat !== "reedition") repris.push({ ref:rn, postes:[], cat:l.cat, com:l.com, src:l.src });
        return false;
      }
      /* Un poste que la réédition va reprendre laisse la place, quelle que soit la
         ligne qui l'occupait : une ancienne réédition posée à la main par l'import
         SAP, ou une saisie. Sans quoi le même KO serait justifié deux fois. */
      if (!ps.every(p => vises[sansZeros(l.ref) + "|" + p])) return true;
      if (l.cat !== "reedition")
        repris.push({ ref:sansZeros(l.ref), postes:ps, cat:l.cat, com:l.com, src:l.src });
      return false;
    });
    stats.repris += repris.length;
    const ajoutReed = reed.map(x => {
      const pr = repris.find(r => r.ref === x.ref && (!r.postes.length || r.postes.indexOf(x.poste) >= 0));
      return { id: uid(), ref:x.ref, postes:[x.poste], cat:"reedition",
        nb: (occKo(cell)[x.ref + "|" + x.poste] || 1), src:"auto",
        d: cell.koDates ? (cell.koDates[(cell.koRefs || []).findIndex((r, i) =>
             sansZeros(r) === x.ref && String((cell.koPostes || [])[i] || "") === x.poste)] || "") : "",
        com: (x.v.dd === 2 ? "Poste redivisé le " : "Poste recréé le ") + frDay(x.v.cre) +
             " (ancien poste " + x.v.anc +
             (x.v.dd === 2 ? ", même poste de commande, créé plus d'un jour après"
              : x.v.dd ? ", rapproché par le poste de commande" : "") + ") — délai réel " +
             dec(x.v.reel, Number.isInteger(x.v.reel) ? 0 : 2) + (x.v.u === "h" ? " h" : " j ouvré" + (x.v.reel > 1 ? "s" : "")) +
             " pour un objectif de " + x.v.obj + (x.v.u === "h" ? " h" : " j ouvrés") +
             (pr ? " · remplace la saisie « " + (CAT[pr.cat] ? CAT[pr.cat].l : pr.cat) + " »" +
               (String(pr.com || "").trim() ? " — " + String(pr.com).trim() : "")
               : repriseDite(REGLE_REED, x.ref, x.poste)),
        st: "ok", regle: REGLE_REED };
    });
    const cov = dejaCouverts({ lignes: avant, koRefs: cell.koRefs, koPostes: cell.koPostes });
    ajoutReed.forEach(l => { cov.parPoste.add(String(l.ref) + "|" + l.postes[0]); });
    /* Une ligne gardée faute de pouvoir la rejuger couvre quand même son poste :
       sans cela une autre règle viendrait justifier le même KO une seconde fois. */
    figees.forEach(l => { (l.postes || []).forEach(po => {
      cov.parPoste.add(String(l.ref) + "|" + String(po));
      cov.parPoste.add(sansZeros(l.ref) + "|" + String(po)); });
      if (!(l.postes || []).length) cov.parRef[String(l.ref)] = (cov.parRef[String(l.ref)] || 0) + Math.max(0, +l.nb || 0); });
    /* les références de l'export peuvent encore porter leurs zéros de tête */
    (cell.koRefs || []).forEach((r, i) => {
      const p = String((cell.koPostes || [])[i] || "");
      if (p && cov.parPoste.has(sansZeros(r) + "|" + p)) cov.parPoste.add(String(r) + "|" + p);
    });
    /* Ce qu'une justification en quantité couvre déjà, par référence. Les
       références de l'export gardent parfois leurs zéros de tête là où les
       justifications sont normalisées : on compte sur la forme sans zéros, sinon
       les deux ne se retrouvent pas et la couverture passe pour nulle. */
    const reste = {};
    Object.keys(cov.parRef).forEach(k => { const n = sansZeros(k);
      reste[n] = (reste[n] || 0) + cov.parRef[k]; });
    /* ---- pourquoi une règle ne prend pas un KO qu'elle vise ----
       Une règle peut être la plus haute de la liste et ne rien poser : le KO est
       déjà tenu par quelque chose qu'elle n'a pas le droit de reprendre — un
       relevé, une réédition SAP — ou par une ligne qu'on ne peut plus rejuger.
       Vu de l'écran, on remonte la règle, le chiffre ne bouge pas, et on conclut
       que la hiérarchie ne marche pas. On note donc ce qui la retient. */
    const tenuPar = {};
    const srcDe = l => l.regle === REGLE_REED ? "reedition"
      : l.regle ? "regle" : (l.src === "releve" ? "releve" : "manuel");   /* manuel = toute saisie reprenable */
    const noteTenu = l => {
      const s = srcDe(l);
      const ps = (l.postes || []).map(String).filter(Boolean);
      if (!ps.length){
        /* Sur une référence tenue par plusieurs pièces, c'est celle qu'une règle
           ne peut pas reprendre qui explique le blocage — pas la saisie. */
        const k = "#" + sansZeros(l.ref);
        if (!tenuPar[k] || tenuPar[k] === "manuel") tenuPar[k] = s;
        return;
      }
      ps.forEach(po => { tenuPar[String(l.ref) + "|" + po] = s;
                         tenuPar[sansZeros(l.ref) + "|" + po] = s; });
    };
    avant.forEach(noteTenu);
    ajoutReed.forEach(noteTenu);
    /* Seule la première règle de la liste aurait posé : c'est elle qu'on retient.
       Un poste qui porte plusieurs flux n'est pas « retenu » pour autant : sa
       ligne a déjà été posée dans ce passage, du poids de ce qu'il porte, et les
       flux suivants du même poste n'ont rien à réclamer. `posees` les écarte —
       sans quoi l'écran annonçait six KO bloqués qui ne l'étaient pas. */
    const posees = new Set();
    const noteBloc = (i, ref, par) => {
      for (const r of actives){
        if (!regleVise(r, cell, i, ref)) continue;
        const m = stats.tenus[r.id] || (stats.tenus[r.id] = {});
        m[par] = (m[par] || 0) + 1;
        return;
      }
    };
    const ajout = [];
    /* ---- une règle passe devant une saisie à la main ----
       Le relevé est une déclaration de l'exploitation, qui sait pourquoi ; une
       saisie faite ici est une qualification rapide, qu'une règle lisant les
       colonnes de l'export a le droit de reprendre. La cause d'origine part dans
       le commentaire : rien n'est perdu. Une saisie n'est reprise que si TOUS ses
       postes le sont — sinon la ligne resterait à cheval, et le même KO serait
       justifié deux fois. */
    /* ---- ce qu'une règle a le droit de reprendre ----
       Tout ce qui n'est ni une règle ni un relevé. Le relevé est une déclaration
       de l'exploitation, il ne se reprend pas. Une ligne « automatique » SANS
       règle, elle, est une orpheline — un vieil import, une reprise d'historique :
       plus rien ne l'adosse, et une règle vivante qui lit les colonnes de
       l'export dit mieux. Tant qu'on ne reprenait que `manuel`, ces lignes-là
       étaient increvables, et invisibles par-dessus le marché. */
    const reprenable = l => !l.regle && l.st === "ok" && l.src !== "releve";
    const mains = {};
    avant.forEach(l => {
      if (!reprenable(l)) return;
      (l.postes || []).map(String).filter(Boolean).forEach(p => { mains[sansZeros(l.ref) + "|" + p] = l; });
    });
    /* ---- une saisie posée en quantité cède aussi la place ----
       Elle ne nomme aucun poste : elle consommait le budget de sa référence, et
       la règle passait son tour quel que soit son rang. On remontait la règle,
       rien ne bougeait.

       Une quantité, ça se coupe — `ajusteRef` le fait déjà pour le plafond. On
       ne joue donc plus au tout-ou-rien : les règles prennent ce qu'elles
       visent, et les saisies gardent le reste des places de la référence. Cela
       règle du même coup les deux cas qui restaient bloqués : deux saisies sur
       la même référence, et une saisie annonçant plus de KO que la référence
       n'en porte. */
    const mainsQte = {};
    avant.forEach(l => {
      if (!reprenable(l)) return;
      if ((l.postes || []).map(String).filter(Boolean).length) return;
      const n = Math.max(0, +l.nb || 0);
      if (!n) return;
      const rn = sansZeros(l.ref);
      const g = mainsQte[rn] || (mainsQte[rn] = { ls: [], brut: 0, reste: 0, cede: 0, pris: 0 });
      g.ls.push({ l, n });
      g.brut += n;
    });
    /* Ce qu'elles annoncent au-delà des KO de la référence ne tient pas debout :
       on borne au budget réel, sinon elles bloqueraient des places qui n'existent
       pas. Le brut sert quand même à retrancher leur part du budget commun —
       sans quoi leur surplus passerait pour une pièce, et bloquerait les règles
       à la place d'un relevé imaginaire. */
    Object.keys(mainsQte).forEach(rn => {
      const g = mainsQte[rn];
      g.reste = Math.min(g.brut, budgetRef(cell, rn));
    });
    /* Le budget en quantité, séparé : ce qu'une règle n'a pas le droit de
       reprendre — relevé, réédition, règle illisible — et les saisies qu'elle peut. */
    const resteFixe = {};
    Object.keys(reste).forEach(rn => {
      const g = mainsQte[rn];
      resteFixe[rn] = Math.max(0, reste[rn] - (g ? g.brut : 0));
    });
    const prises = new Map();          /* ligne manuelle -> postes que les règles reprennent */
    (cell.koRefs || []).forEach((refBrut, i) => {
      const ref = String(refBrut), rn = sansZeros(ref);
      const poste = String((cell.koPostes || [])[i] || "");
      const main = poste ? mains[rn + "|" + poste] : null;
      if (poste && cov.parPoste.has(ref + "|" + poste) && !main){
        if (!posees.has(ref + "|" + poste))
          noteBloc(i, ref, tenuPar[ref + "|" + poste] || tenuPar[rn + "|" + poste] || "autre");
        return;
      }
      /* Une justification en quantité — une ligne de relevé, une saisie rapide —
         ne nomme aucun poste, mais elle retire bien un KO de cette référence.
         Elle doit se décompter ici, que le KO porte un poste ou non. Sans cela
         une règle travaillant poste par poste reposait une cause sur un KO déjà
         justifié : la référence se retrouvait justifiée plus de fois qu'elle
         n'était en KO, et le plafond de la période masquait l'écart en absorbant
         le surplus d'une autre référence. */
      let cedeIci = false;
      if (!main){
        if (resteFixe[rn] > 0){ resteFixe[rn]--;
          noteBloc(i, ref, tenuPar["#" + rn] || "autre");
          return; }
        const mq = mainsQte[rn];
        if (mq && mq.reste > 0){ mq.reste--; mq.cede++; cedeIci = true; }
        else if (mq && mq.cede > 0){ /* toutes ses places sont cédées : rien à retenir */ }
      }
      /* Une seule cause par KO : c'est la première règle de la liste qui la pose.
         Les suivantes qui visaient le même KO sont notées — deux règles qui se
         disputent un KO, c'est l'ordre de la liste qui tranche, et il vaut mieux
         que cela se voie que de le découvrir dans un chiffre. */
      let gagnante = null;
      for (const r of actives){
        if (!regleVise(r, cell, i, ref)) continue;
        if (!gagnante){ gagnante = r; if (simule && !conflits) break; }
        else { const k = gagnante.id + ">" + r.id; stats.conflits[k] = (stats.conflits[k] || 0) + 1; }
      }
      if (gagnante){
        const r = gagnante;
        /* Un poste qui porte plusieurs flux ne donne qu'une ligne, du poids de
           ce qu'il porte : sans quoi la règle en posait une par flux et le
           décompte les additionnait deux fois. */
        if (poste){ cov.parPoste.add(ref + "|" + poste); posees.add(ref + "|" + poste); }
        const w = poste ? (occKo(cell)[sansZeros(ref) + "|" + poste] || 1) : 1;
        const ligne = { id: uid(), ref, postes: poste ? [poste] : [], cat: r.cause,
          nb: w, src: r.src || "auto", com: r.nom + repriseDite(r.id, ref, poste),
          d: (cell.koDates || [])[i] || "",
          st: CAT[r.cause] && CAT[r.cause].j ? "ok" : "rejet", regle: r.id };
        if (main){
          ligne._main = main;
          if (!prises.has(main)) prises.set(main, new Set());
          prises.get(main).add(poste);
        } else if (cedeIci){
          const mq = mainsQte[rn];
          ligne._qte = mq; mq.pris += w;
        }
        ajout.push(ligne);
      }
    });
    /* Chaque saisie visée n'est reprise que si les règles couvrent tous ses postes.
       Sinon on annule la reprise : la saisie reste entière, et les lignes de règle
       qui l'auraient doublée sont retirées. */
    const lachees = new Set();
    prises.forEach((postes, l) => {
      const tous = (l.postes || []).map(String).filter(Boolean);
      if (tous.length && tous.every(p => postes.has(p))) lachees.add(l);
    });
    /* Les saisies en quantité gardent ce que les règles n'ont pas pris : sur une
       référence de dix KO dont six partent au rebut, la règle en prend six et la
       saisie garde quatre. C'est ce partage qui manquait — et sans lui les dix
       restaient sur l'ancienne cause. */
    const rognees = new Map();
    Object.keys(mainsQte).forEach(rn => {
      const g = mainsQte[rn];
      if (!g || g.pris <= 0) return;
      let libre = Math.max(0, budgetRef(cell, rn) - g.pris);
      g.ls.forEach(x => {
        const garde = Math.min(x.n, libre);
        libre -= garde;
        if (garde <= 0) lachees.add(x.l);
        else if (garde < x.n) rognees.set(x.l, garde);
      });
    });
    const ajoutNet = ajout.filter(l => {
      /* Une reprise au poste est tout ou rien : un poste ne se coupe pas en deux.
         Une reprise en quantité, elle, a toujours lieu — la saisie garde le
         reste des places, elle ne perd que ce que la règle a pris. */
      const c = l._main || (l._qte ? l._qte.ls[0] && l._qte.ls[0].l : null);
      if (!c) return true;
      if (l._main && !lachees.has(l._main)){                  /* reprise abandonnée */
        /* Le compteur de la règle sera plus bas : l'écran doit dire pourquoi,
           sinon on cherche des KO qui ont disparu sans un mot. */
        const t = stats.tenus[l.regle] || (stats.tenus[l.regle] = {});
        t.manuel = (t.manuel || 0) + (+l.nb || 0);
        return false;
      }
      /* la mention relevée sur la ligne d'avant est remplacée par celle-ci, qui
         décrit la saisie que ce passage-ci reprend — on n'empile pas les deux */
      l.com = String(l.com || "").replace(/ · remplace la saisie .*$/, "") +
        " · remplace la saisie « " + (CAT[c.cat] ? CAT[c.cat].l : c.cat) + " »" +
        (c.com ? " (" + String(c.com).slice(0, 80) + ")" : "");
      /* La saisie voyage avec la ligne qui l'a reprise : c'est ce qui permet de
         la rendre intacte si la règle est retirée un jour. Chaque ligne n'emporte
         que SA part — en les additionnant on retrouve la saisie entière, et une
         saisie seulement rognée ne se voit pas rendre plus qu'elle n'a cédé. */
      const enQte = !!l._qte;
      l.rep = JSON.stringify({ i: c.id || "", r: String(c.ref), q: enQte ? 1 : 0,
        p: enQte ? [] : (l.postes || []).map(String),
        c: c.cat, n: Math.max(0, +l.nb || 0), s: c.src || "manuel",
        m: String(c.com || "").slice(0, 200), d: c.d || "", t: c.st === "rejet" ? "rejet" : "ok" });
      delete l._main; delete l._qte;
      return true;
    });
    ajout.forEach(l => { delete l._main; delete l._qte; });
    const avantNet = avant.filter(l => !lachees.has(l))
      .map(l => rognees.has(l) ? Object.assign({}, l, { nb: rognees.get(l) }) : l);
    stats.reprisMain += lachees.size;
    const avaitDesRegles = (cell.lignes || []).some(l => l.regle);
    /* Dernier garde-fou, après tous les chemins. Une référence peut être visée
       par une règle, par la réédition, par le relevé et par une saisie : il
       suffit que deux d'entre eux se croisent pour qu'elle sorte justifiée plus
       de fois qu'elle n'est en KO. Le plafond de la période masquait l'écart en
       laissant le surplus d'une référence couvrir le manque d'une autre. Ici il
       est repris, dans l'ordre annoncé — relevé, puis automatique, puis saisie —
       et la cause écartée passe en commentaire. */
    const base = avantNet.concat(ajoutReed, ajoutNet);
    /* Le garde-fou tourne aussi en simulation. Sans lui, le compte annoncé sur
       la carte d'une règle était celui des lignes qu'elle VOULAIT poser, pas de
       celles qui survivent au plafond : deux KO d'écart suffisent à faire douter
       de tout le reste. */
    const aj = ajusteRef(cell, base, null);
    stats.doubles += aj.ecartes + aj.rognes;
    /* Le compte se lit sur le résultat, jamais sur les intentions : entre la
       boucle et ici, une reprise a pu être abandonnée et une ligne rognée. */
    aj.lignes.forEach(l => {
      if (!l.regle) return;
      const n = Math.max(0, +l.nb || 0);
      if (l.regle === REGLE_REED){ stats.reed += n; return; }
      stats.total += n;
      stats.parRegle[l.regle] = (stats.parRegle[l.regle] || 0) + n;
    });
    if (ajoutNet.length || ajoutReed.length || avaitDesRegles || lachees.size || aj.ecartes || aj.rognes){
      stats.cellules++;
      if (!simule) out.push(Object.assign({}, cell, { lignes: aj.lignes }));
    }
  });
  return { cellules: out, stats };
}
/* ---- les règles qui se disputent un même KO ----
   Quand deux règles actives visent le même KO, la première de la liste pose sa
   cause et la seconde ne pose rien. Le résultat est juste — une seule cause par
   KO — mais le départage tient à l'ordre de création, que personne ne voit.
   On le donne à voir, avec le nombre de KO en jeu, et on laisse remonter une
   règle dans la liste pour trancher autrement. */
let CONFLITS = null;
function signatureRegles(){
  return S.regles.map(r => r.id + (r.actif ? "1" : "0")).join(",") + "#" + Object.keys(S.cells).length;
}
function conflitsRegles(){
  const sig = signatureRegles();
  if (CONFLITS && CONFLITS.sig === sig) return CONFLITS.l;
  const actives = S.regles.filter(r => r.actif);
  let l = [];
  if (actives.length > 1){
    const { stats } = passerRegles(Object.values(S.cells), S.regles, true, true);
    const nom = id => (S.regles.find(r => r.id === id) || {}).nom || "règle supprimée";
    l = Object.entries(stats.conflits).map(([k, n]) => {
      const [a, b] = k.split(">");
      return { a, b, n, na:nom(a), nb:nom(b) };
    }).sort((x, y) => y.n - x.n);
  }
  CONFLITS = { sig, l };
  return l;
}
function oublieConflits(){ CONFLITS = null; IMPACTS = null; }
/* Ce qu'une règle changerait sur les périodes affichées, sans rien écrire.
   ATTENTION : la règle est passée SEULE. C'est sa portée, pas ce qu'elle pose
   quand les autres sont là. */
function simuleRegle(r){
  const cells = selCells().map(c => realCell(c) || c);
  const vues = {}; cells.forEach(c => { vues[c.id] = c; });
  const { stats } = passerRegles(Object.values(vues), [Object.assign({}, r, { actif:true })], true);
  return stats.total;
}
/* ---- ce que chaque règle pose VRAIMENT, les autres en place ----
   Un KO ne reçoit qu'une cause, et c'est la règle la plus haute de la liste qui
   la pose. Tant que la carte affichait la portée de la règle prise seule, le
   chiffre ne bougeait pas d'un pouce quand on remontait une règle : la
   hiérarchie fonctionnait dans les chiffres du tableau de bord, mais l'écran
   n'en montrait rien, ce qui revient à ne pas fonctionner. Un seul passage,
   toutes les règles ensemble, et on lit ce que chacune a posé. */
let IMPACTS = null;
function impactsRegles(){
  const sig = signatureRegles() + "#" + S.regles.map(r => r.id).join(">") +
    "#" + S.ui.site + S.ui.serv + S.ui.from + S.ui.to + S.ui.preset + S.ui.maille;
  if (IMPACTS && IMPACTS.sig === sig) return IMPACTS.m;
  const reels = {};
  selCells().forEach(c => { const x = realCell(c) || c; reels[x.id] = x; });
  const { stats } = passerRegles(Object.values(reels), S.regles, true);
  return (IMPACTS = { sig, m: { pose: stats.parRegle || {}, tenus: stats.tenus || {} } }).m;
}
/* Ce qui retient une règle sur un KO qu'elle vise, dit comme on le dirait à
   quelqu'un qui vient de remonter sa règle et ne voit rien bouger. */
const TENU_LBL = {
  releve: "déjà tenus par le relevé — une règle ne reprend jamais une déclaration de l'exploitation",
  reedition: "déjà tenus par la réédition de poste BR",
  manuel: "tenus par une saisie à la main que ces règles ne reprennent pas en entier — elle reste en place",
  regle: "déjà tenus par une règle devenue illisible sur ces périodes",
  autre: "déjà justifiés autrement"
};
/* L'effet réellement obtenu, règles déjà en place comprises. Compter les KO
   visés ne suffit pas : un KO déjà couvert par une justification de lot ne
   rapporte rien de plus, et le taux affiché plafonne au nombre de KO de la
   période. On recalcule donc le taux comme le tableau de bord le fera. */
function simuleEffet(r){
  const reels = {};
  selCells().forEach(c => { const x = realCell(c) || c; reels[x.id] = x; });
  const base = Object.values(reels);
  const autres = S.regles.filter(x => x.id !== r.id);
  const avec = autres.concat([Object.assign({}, r, { actif:true })]);
  const app = (regles) => {
    const { cellules } = passerRegles(base, regles, false);
    const parId = {}; cellules.forEach(c => { parId[c.id] = c; });
    return agg(base.map(c => parId[c.id] || c));
  };
  const { stats } = passerRegles(base, avec, true);
  return { n: stats.parRegle[r.id] || 0, avant: app(autres), apres: app(avec) };
}

/* ---------------------------- modèles de règles ----------------------------
   Les trois causes que l'aide annonce comme lues dans les données mais que rien
   ne posait encore. Chacune ouvre l'éditeur pré-rempli avec son effet chiffré :
   c'est vous qui décidez de l'enregistrer, pas l'outil. */
const MODELES = [
  { k:"irr", titre:"Demande créée après son échéance",
    pour:"La date de début est postérieure — ou égale — à la date de fin prévue : la confirmation devait tomber avant que la demande n'existe.",
    besoin:["Date début", "Date fin prévue"],
    r:{ nom:"Demande irréalisable", service:"distri", type:"dates", dateA:"Date début",
        dateB:"Date fin prévue", opD:"le", nD:0, ouvres:false, cause:"irrealisable", src:"auto", conds:[] } },
  /* Ce modèle comparait les deux dates en jours de calendrier, et c'est ce qui
     lui faisait trouver quelque chose. Repris en jours ouvrés sur l'import de
     septembre, il ne reste rien : sur les 36 KO qu'il visait, 19 avaient leur
     échéance un samedi ou le 14 juillet — terminés le vendredi ou la veille,
     ils sont pile à l'heure, pas en avance — et les 17 autres sont des flux
     urgents, comptés en heures, qui ont bien dépassé leur seuil de trois
     heures. L'anomalie était dans la comparaison, pas dans le KPI. Le modèle
     reste proposé, corrigé : s'il affiche « aucun KO », c'est la réponse. */
  { k:"ano", titre:"Livrée avant son échéance et pourtant KO",
    pour:"La date de fin précède la date de fin prévue d'au moins un jour ouvré, sur un flux compté en jours. " +
      "Attention : la plupart des cas qui en avaient l'air venaient d'une échéance tombant un samedi ou un férié.",
    besoin:["Date fin", "Date fin prévue", "Unité de mesure"],
    r:{ nom:"Anomalie de calcul", service:"distri", type:"dates", dateA:"Date fin",
        dateB:"Date fin prévue", opD:"ge", nD:1, ouvres:true, cause:"anomalie", src:"auto",
        conds:[{ col:"Unité de mesure", op:"est", val:"jour" }] } },
  { k:"dou", titre:"Blocage douane levé",
    pour:"La colonne Statut douane est passée à « Terminé » : le flux a attendu la douane, pas le magasin.",
    besoin:["Statut douane"],
    r:{ nom:"Blocage douane", service:"tous", type:"colonne", cause:"douane", src:"auto",
        conds:[{ col:"Statut douane", op:"est", val:"Terminé" }] } },
  /* Trouvé en repassant sur l'export de septembre : 176 KO de distribution partent
     au rebut, dont 61 qu'aucune autre règle ne voit. Personne n'attend derrière un
     mouvement vers le rebut — mais c'est un arbitrage d'exploitation, pas une
     évidence : le modèle est proposé, il n'est pas posé. */
  { k:"reb", titre:"Mouvement vers le rebut",
    pour:"La destination est REBUT : aucun client n'attend derrière. À trancher avec l'exploitation — " +
      "sur l'export de septembre, 61 KO que rien d'autre ne couvre, dont Logistiport Distribution tire +1,1 pt.",
    besoin:["Emplacement cible"],
    r:{ nom:"Mouvement vers le rebut", service:"distri", type:"colonne", cause:"dechets", src:"auto",
        conds:[{ col:"Emplacement cible", op:"est", val:"REBUT" }] } }
];
/* Un modèle n'est proposé que si l'export chargé porte ses colonnes. */
function modeleDispo(m){
  const cols = ctxColonnes();
  return m.besoin.every(c => cols.indexOf(c) >= 0);
}
function modeleRegle(m){
  return normRegles([Object.assign({ id:uid(), actif:true }, m.r)])[0];
}

/* ---------------------------- stockage des règles ---------------------------- */
const LSREGLES = "taux-net-regles";
function normRegles(list){
  if (!Array.isArray(list)) return [];
  return list.filter(r => r && r.cause && CAT[r.cause]).map(r => ({
    id: r.id || uid(), nom: String(r.nom || "Règle").slice(0, 80), actif: r.actif !== false,
    service: ["tous", "distri", "recep"].indexOf(r.service) >= 0 ? r.service : "tous",
    cause: r.cause, src: SRC[r.src] ? r.src : "auto",
    type: ["colonne", "dates", "liste"].indexOf(r.type) >= 0 ? r.type : "colonne",
    conds: (Array.isArray(r.conds) ? r.conds : []).slice(0, 4).map(c => ({
      col: String(c.col || ""), op: String(c.op || "est"), val: String(c.val == null ? "" : c.val).slice(0, 80) })),
    dateA: String(r.dateA || ""), dateB: String(r.dateB || ""),
    opD: String(r.opD || "le"), nD: +r.nD || 0, ouvres: r.ouvres !== false,
    refs: (Array.isArray(r.refs) ? r.refs : []).slice(0, 5000).map(String)
  }));
}
function chargeReglesLocal(){
  try { const raw = localStorage.getItem(LSREGLES); if (raw) S.regles = normRegles(JSON.parse(raw)); } catch(e){}
}
async function sauveRegles(){
  S.regles = normRegles(S.regles);
  oublieConflits();
  try { localStorage.setItem(LSREGLES, JSON.stringify(S.regles)); } catch(e){}
  /* Le même document porte les trois réglages d'équipe : les règles, la
     traduction des causes libres du relevé, et les causes que vous avez
     ajoutées. Un seul aller-retour — mais alors chaque écriture doit reposer
     les trois, sinon enregistrer une règle efface les deux autres pour tout le
     monde. Les causes ajoutées manquaient ici : elles ne survivaient que dans
     le navigateur de celui qui les avait créées. */
  const doc = { regles: S.regles, causes: S.causes || {}, cats: S.cats || [],
                maj: new Date().toISOString() };
  try {
    if (S.backend === "db" && S.db) await S.db.doc(FB_COLLECTION + "/" + DOC_REGLES).set(doc);
    else if (S.backend === "firebase" && S.fb) await S.fb.m.setDoc(S.fb.m.doc(S.fb.db, FB_COLLECTION, DOC_REGLES), doc);
  } catch(e){ toast("Règles enregistrées sur ce navigateur seulement", true); }
}
/* Rejoue toutes les règles sur les périodes enregistrées. */
async function rejouerRegles(silencieux){
  oublieConflits();
  const { cellules, stats } = passerRegles(Object.values(S.cells), S.regles, false);
  if (cellules.length) await bulkPut(cellules);
  if (!silencieux){
    const n = stats.total + stats.reed;
    toast((n ? n0(n) + " KO documentés automatiquement" : "Aucun KO ne correspond aux règles") +
      (stats.reprisMain ? " · " + n0(stats.reprisMain) + " saisie" + (stats.reprisMain > 1 ? "s" : "") + " reprise" +
        (stats.reprisMain > 1 ? "s" : "") : "") +
      (stats.doubles ? " · " + n0(stats.doubles) + " doublon" + (stats.doubles > 1 ? "s" : "") + " retiré" +
        (stats.doubles > 1 ? "s" : "") : ""));
  }
  return stats;
}
