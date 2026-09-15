/* =========================================================================
   Bloc 3 : import, formulaires, exports, initialisation
   ========================================================================= */

/* ---------------------------- navigation ---------------------------- */
/* Descente depuis une ligne du tableau de bord vers le détail correspondant */
function drill(code){
  const p = String(code).split("|");
  if (p[0] === "perim"){
    const same = S.ui.site === p[1] && S.ui.serv === p[2];
    if (same && p[3] === "dash"){ S.ui.site = "tous"; S.ui.serv = "tous"; syncSegs(); render(); toast("Filtre retiré"); return; }
    S.ui.site = p[1]; S.ui.serv = p[2]; syncSegs();
    if (p[3] === "justif"){ S.ui.qscope = ""; S.ui.qshow = 40; gotoTab("justif"); window.scrollTo({ top:0, behavior:"smooth" }); }
    else render();
    toast(SITES[p[1]].l + " · " + SERVS[p[2]].l);
    return;
  }
  if (p[0] === "cat"){
    S.ui.qcat = p[1]; S.ui.q = ""; S.ui.qsrc = ""; S.ui.qst = "";
    const qi = $("#q-search"); if (qi) qi.value = "";
    const ss = $("#q-src"); if (ss) ss.value = "";
    const st = $("#q-st"); if (st) st.value = "";
    gotoTab("qualif"); window.scrollTo({ top:0, behavior:"smooth" });
    toast(CAT[p[1]] ? CAT[p[1]].l : p[1]);
  }
}
function gotoTab(name){
  S.ui.tab = name;
  $$(".tab").forEach(x => x.setAttribute("aria-selected", String(x.dataset.tab === name)));
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + name));
  render();
}
$$(".tab").forEach(b => b.addEventListener("click", () => gotoTab(b.dataset.tab)));
function syncSegs(){
  [["f-site", "site"], ["f-serv", "serv"], ["f-maille", "maille"], ["f-maille2", "maille"], ["f-preset", "preset"]].forEach(([id, key]) =>
    $$("#" + id + " button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.v === S.ui[key]))));
}
function segBind(id, key){
  $$("#" + id + " button").forEach(b => b.addEventListener("click", () => {
    S.ui[key] = b.dataset.v; syncSegs(); render();
  }));
}
segBind("f-site", "site"); segBind("f-serv", "serv"); segBind("f-maille", "maille");
/* Le même état, offert deux fois : le filtre du haut et la maille posée
   contre le graphique. Deux contrôles, une seule vérité. */
segBind("f-maille2", "maille");
segBind("f-preset", "preset");
/* Passer en personnalisé ouvre le calendrier sur toute l'étendue des données :
   on rétrécit à partir de ce qu'on a, on ne part pas d'une plage vide. */
$$("#f-preset button").forEach(b => b.addEventListener("click", () => {
  if (b.dataset.v !== "custom") return;
  const bo = bornesJours();
  if (bo && !S.ui.d1){ S.ui.d1 = bo[0]; S.ui.d2 = bo[1]; }
  render();
  const d = $("#f-d1"); if (d && d.showPicker) { try { d.showPicker(); } catch(e){} }
}));
$("#f-d1").addEventListener("change", e => { S.ui.d1 = e.target.value; render(); });
$("#f-d2").addEventListener("change", e => { S.ui.d2 = e.target.value; render(); });
$("#btn-reset").addEventListener("click", () => {
  Object.assign(S.ui, { site:"tous", serv:"tous", maille:"semaine", preset:"all", from:null, to:null, d1:null, d2:null });
  syncSegs(); render(); toast("Filtres réinitialisés");
});
$("#q-search").addEventListener("input", e => { S.ui.q = e.target.value; render(); });
$("#aj-search").addEventListener("input", e => { S.ui.ajq = e.target.value; S.ui.qshow = 40; render(); });
/* Clic sur un en-tête : même colonne → on inverse le sens, sinon on l'adopte. */
document.addEventListener("click", e => {
  const h = e.target.closest("th[data-tri]"); if (!h) return;
  const tbl = h.closest("table"), quoi = tbl && tbl.dataset.tritable;
  if (!quoi) return;
  const cle = h.dataset.tri;
  if (quoi === "aj"){
    if (S.ui.ajTri === cle) S.ui.ajSens = -(S.ui.ajSens || -1);
    else { S.ui.ajTri = cle; S.ui.ajSens = cle === "ref" ? 1 : -1; }
  } else {
    if (S.ui.regTri === cle) S.ui.regSens = -(S.ui.regSens || -1);
    else { S.ui.regTri = cle; S.ui.regSens = (cle === "ref" || cle === "cause" || cle === "perim") ? 1 : -1; }
  }
  render();
});
$("#q-cat").addEventListener("change", e => { S.ui.qcat = e.target.value; render(); });
$("#q-src").addEventListener("change", e => { S.ui.qsrc = e.target.value; render(); });
$("#q-st").addEventListener("change", e => { S.ui.qst = e.target.value; render(); });
$("#btn-print").addEventListener("click", () => {
  const ph = $("#print-sub");
  if (ph) ph.textContent = [
    rangeLabel(),
    S.ui.site === "tous" ? "MG et Logistiport" : SITES[S.ui.site].l,
    S.ui.serv === "tous" ? "distribution et réception" : SERVS[S.ui.serv].l.toLowerCase()
  ].join(" · ") + " — édité le " + frDay(new Date().toISOString().slice(0, 10));
  window.print();
});
$("#btn-reglages").addEventListener("click", () => {
  const go = S.ui.tab === "reglages" ? "dash" : "reglages";
  gotoTab(go);
  $("#btn-reglages").classList.toggle("on", go === "reglages");
});
document.addEventListener("click", e => {
  const g = e.target.closest("[data-goto]");
  if (g){
    gotoTab("guide");
    const el = document.getElementById(g.dataset.goto);
    if (el){ el.classList.add("flash"); el.scrollIntoView({ behavior:"smooth", block:"start" });
      setTimeout(() => el.classList.remove("flash"), 2400); }
    return;
  }
  if (e.target.id === "dl-close"){ closeModal(); return; }
  if (e.target.id === "btn-clear-q"){
    Object.assign(S.ui, { q:"", qcat:"", qsrc:"", qst:"" });
    $("#q-search").value = ""; $("#q-src").value = ""; $("#q-st").value = "";
    render(); return;
  }
  const tr = e.target.closest("tr.clic");
  if (tr && tr.dataset.si && !e.target.closest("button")){
    S.ui.site = tr.dataset.si; S.ui.serv = tr.dataset.sv; syncSegs(); render();
  }
});
function openDefs(){ openModal(
  '<div class="ph"><h2>Les trois taux, et pourquoi trois</h2><span class="sub">Ce qu\'il faut pouvoir dire en réunion</span></div>' +
  '<div class="pb"><div class="steps" style="border:1px solid var(--line);border-radius:9px">' +
  [["Brut", "var(--c-brut)", "OK / (OK + KO) sur les flux comptés. Aucun retrait, aucune interprétation. C'est ce que le client subit, et c'est le seul chiffre que personne ne peut discuter."],
   ["Documenté", "var(--c-expl)", "Le brut, moins les KO dont la justification s'appuie sur une pièce : une date de l'export, une réédition SAP, une ligne du relevé de l'exploitation. Elle se vérifie sans vous."],
   ["Net", "var(--c-net)", "Le documenté, plus les justifications que vous établissez par votre analyse. C'est ce que l'exploitation maîtrise réellement. Les deux se publient ensemble : le documenté est celui qu'un tiers peut recontrôler seul."],
   ["Couverture", "var(--muted)", "La part du volume qui reste jugée. Un net élevé sur une couverture faible est un artefact, pas une performance : cela veut dire qu'on a retiré tellement de flux du jugement que le chiffre ne dit plus grand-chose."]]
  .map(([t, c, d]) => '<div class="step" style="grid-template-columns:12px 1fr"><i class="chip-c" style="background:' + c + ';margin-top:5px"></i>' +
    '<div class="sbody"><h3>' + t + "</h3><p style=\"margin:0\">" + d + "</p></div></div>").join("") +
  '</div><div class="note" style="margin-top:14px">Publiez toujours les trois ensemble, plus le nombre de KO restant à qualifier. Un net seul se retourne contre celui qui le présente.</div>' +
  '<div class="actions"><button class="btn pri" id="dl-close">Fermer</button></div></div>'); }
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (S.ui.tab === "dash"){ drawEvo(); drawVol(); } }, 180); });

/* ---------------------------- plein écran ----------------------------
   Pour l'écran de la salle : les chiffres, les deux graphiques, les filtres.
   L'habillage est du CSS, il couvre la fenêtre quoi qu'il arrive — l'API
   plein écran du navigateur n'est demandée qu'en plus, et son refus (iframe
   sans autorisation, réglage du poste) ne casse rien. */
function plein(){ return document.body.classList.contains("fs"); }
function majFs(){
  const b = $("#btn-fs");
  if (b) b.setAttribute("aria-pressed", String(plein()));
  /* le tableau de bord est le seul écran qui a un sens en plein écran */
  if (plein() && S.ui.tab !== "dash") gotoTab("dash");
  else if (S.ui.tab === "dash"){ drawEvo(); drawVol(); }
}
function entrerFs(){
  if (plein()) return;
  if (S.ui.tab !== "dash") gotoTab("dash");
  document.body.classList.add("fs");
  const el = document.documentElement;
  const rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rq) { try { const p = rq.call(el); if (p && p.catch) p.catch(() => {}); } catch(e){} }
  requestAnimationFrame(majFs);
  toast("Plein écran — Échap pour sortir");
}
function sortirFs(){
  if (!plein()) return;
  document.body.classList.remove("fs");
  const ex = document.exitFullscreen || document.webkitExitFullscreen;
  if (ex && (document.fullscreenElement || document.webkitFullscreenElement)){
    try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch(e){}
  }
  requestAnimationFrame(majFs);
}
const bfs = $("#btn-fs"); if (bfs) bfs.addEventListener("click", () => plein() ? sortirFs() : entrerFs());
const bout = $("#btn-fs-out"); if (bout) bout.addEventListener("click", sortirFs);
/* Quitter par la touche du navigateur laisse la classe derrière : on la retire. */
["fullscreenchange", "webkitfullscreenchange"].forEach(ev =>
  document.addEventListener(ev, () => {
    if (!(document.fullscreenElement || document.webkitFullscreenElement) && plein()) sortirFs();
    else requestAnimationFrame(majFs);
  }));
/* Échap sert déjà à fermer une fiche : le plein écran ne sort que si rien n'est
   ouvert. En capture, donc AVANT le gestionnaire qui ferme la fiche — sans quoi
   il l'a déjà refermée quand on regarde, et les deux partent d'un seul coup. */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || !plein()) return;
  const ovl = $("#ovl");
  if (ovl && getComputedStyle(ovl).display !== "none") return;
  sortirFs();
}, true);

/* ---------------------------- analyse de texte ---------------------------- */
function parseTable(text){
  const t = text.replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  const first = t.split("\n")[0];
  const cnt = s => (first.split(s).length - 1);
  const sep = cnt("\t") >= Math.max(cnt(";"), cnt(",")) ? "\t" : (cnt(";") >= cnt(",") ? ";" : ",");
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++){
    const ch = t[i];
    if (q){ if (ch === '"'){ if (t[i+1] === '"'){ cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep){ row.push(cur); cur = ""; }
    else if (ch === "\n"){ row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  row.push(cur); rows.push(row);
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}
const norm = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function findCol(heads, tests){
  for (const t of tests){ const i = heads.findIndex(h => t(h)); if (i >= 0) return i; }
  return -1;
}
const isoDay = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
/* Un identifiant de flux PowerBI : deux tirets, des chiffres, rien d'autre. */
const RE_IDENT = /^\d{4,}-\d{4,}-\d{2,}$/;
function parseDate(v){
  const s = String(v || "").trim(); if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (m){ let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  /* AAAAMMJJ compact, tel que SAP l'exporte */
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  /* numéro de série d'un tableur : jours depuis le 30/12/1899 */
  if (/^\d{5}(\.\d+)?$/.test(s)){
    const n = parseFloat(s);
    if (n > 20000 && n < 60000){
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
  }
  const d = new Date(s); return isNaN(d) ? null : d;
}

/* ---------------------------- import export PowerBI ---------------------------- */
let EXPORT_OUT = "#export-out", RELEVE_OUT = "#releve-out", EXPORT_APPLY = true, RELEVE_APPLY = true;
let RELEVE_SRC = { ta:"#ta-releve", date:"#r-date", site:"#r-site", serv:"#r-serv" };
let exportDraft = null;
function analyseExport(src){
  const rows = Array.isArray(src) ? src : parseTable(src);
  if (rows.length < 2){ $(EXPORT_OUT).innerHTML = '<div class="note" style="margin-top:14px">Collage vide ou illisible : il faut la ligne d\'en-têtes puis les lignes de flux.</div>'; return; }
  const heads = rows[0].map(norm);
  const colIndex = {}; rows[0].forEach((h, i) => { if (h != null && colIndex[String(h)] == null) colIndex[String(h)] = i; });
  const ci = {
    id:     findCol(heads, [h => h.includes("identifiant flux debut"), h => h.includes("identifiant flux"), h => h.includes("identifiant"), h => h.includes("flux debut")]),
    /* L'export porte deux identifiants, début et fin. Sur les 34 005 lignes de
       l'extraction du 14/09 où les deux sont remplis, ils sont identiques —
       zéro écart. Sur 92 autres, seul « fin » l'est. */
    idfin:  findCol(heads, [h => h.includes("identifiant flux fin"), h => h.includes("flux fin")]),
    aire:   findCol(heads, [h => h === "code aire", h => h.includes("code aire"), h => h.includes("aire"), h => h.includes("type magasin")]),
    kpi:    findCol(heads, [h => h.includes("kpi")]),
    res:    findCol(heads, [h => h === "resultat", h => h.includes("resultat")]),
    fin:    findCol(heads, [h => h === "date fin", h => h.includes("date fin") && !h.includes("prevue"), h => h.includes("date em"), h => h.includes("date")]),
    litige: findCol(heads, [h => h.includes("statut litige"), h => h.includes("litige")]),
    calcul: findCol(heads, [h => h === "calcul"])
  };
  const missing = ["id", "aire", "res"].filter(k => ci[k] < 0);
  if (missing.length || ci.fin < 0){
    $(EXPORT_OUT).innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Colonnes introuvables.</b> Il faut au minimum <code>Identifiant flux début</code>, <code>Code aire</code>, <code>Résultat</code> et une <code>Date fin</code>. En-têtes lus : ' + esc(rows[0].join(" · ")) + "</div>";
    return;
  }
  const acc = {}, rej = { aire:0, kpi:0, date:0, res:0, litige:0, litigeKo:0, ident:0, decale:0 };
  /* Un classeur sain donne à chaque cellule sa référence (A1, B1…). Quand elles
     en sont toutes dépourvues, une cellule vide omise décale silencieusement
     toute la fin de la ligne : mieux vaut s'arrêter que publier des chiffres faux. */
  if (rows.sansReperes && rows.slice(1, 201).some(r => r.length !== heads.length)){
    $(EXPORT_OUT).innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)">' +
      "<b>Cet export ne porte pas de repère de colonne.</b> Ses cellules n'ont pas de référence " +
      "(A1, B1…) et les cellules vides ont été supprimées sans dire lesquelles&nbsp;: à partir du premier " +
      "trou, chaque valeur glisse d'une colonne. La date et l'identifiant lus seraient ceux d'à côté." +
      '<div class="muted" style="margin-top:8px">Deux sorties&nbsp;: réexporter en <b>CSV</b>, ou reprendre ' +
      "l'export Excel habituel — celui qui a servi à la reprise se lit sans problème.</div></div>";
    return;
  }
  for (let i = 1; i < rows.length; i++){
    const r = rows[i];
    const site = AIRE2SITE[String(r[ci.aire] || "").trim().toUpperCase()];
    if (!site){ rej.aire++; continue; }
    const kp = norm(ci.kpi >= 0 ? r[ci.kpi] : "") + " " + norm(ci.calcul >= 0 ? r[ci.calcul] : "");
    let service = null;
    if (/5\s*1|5\s*2|distrib/.test(kp)) service = "distri";
    else if (/2\s*1|2\s*2|recept/.test(kp)) service = "recep";
    if (!service){ rej.kpi++; continue; }
    const d = parseDate(r[ci.fin]);
    if (!d){ rej.date++; continue; }
    /* ---------------- une ligne sans identifiant compte quand même ----------------
       Elle était purement et simplement jetée : ni flux, ni KO. Or PowerBI, lui,
       la compte. Sur l'export Logistiport / distribution de juillet à septembre,
       ces 11 lignes sont TOUTES des KO, toutes sur la semaine 36 : l'outil
       affichait 99,75 % là où PowerBI affichait 97,10 %, soit 2,65 points
       envolés sur une semaine sans que rien ne le dise.
       Deux corrections : le repli sur « Identifiant flux fin », qui suffit dans
       les 92 cas rencontrés ; et, à défaut d'identifiant du tout, la ligne pèse
       au brut — elle ne rejoint simplement pas la liste à justifier, faute de
       quoi que ce soit à montrer à l'exploitation. */
    let ident = String(r[ci.id] == null ? "" : r[ci.id]).trim();
    if (!ident && ci.idfin >= 0) ident = String(r[ci.idfin] == null ? "" : r[ci.idfin]).trim();
    if (r.length !== heads.length) rej.decale++;
    if (!ident) rej.ident++;
    const rs = norm(r[ci.res]);
    let ko;
    if (/^k\s*o|^nok|^non conforme|^ko/.test(rs) || rs === "n") ko = true;
    else if (/^ok|^conforme|^o$|^oui/.test(rs)) ko = false;
    else { rej.res++; continue; }
    const per = weekKey(d), id = cellId(per, site, service);
    const cell = acc[id] || (acc[id] = { periode:per, site, service, flux:0, ko:0, litiges:0, litigesKo:0,
      refs:[], dates:[], postes:[], jours:{}, ctx: ctxNew(rows[0]) });
    if (service === "recep" && ci.litige >= 0){
      const lt = norm(r[ci.litige]);
      /* Le litige sort du décompte — mais la période doit savoir combien, sinon
         la carte « Réception hors litiges » affiche le total de tout l'export
         sur chacune des semaines qu'il couvre (683 écartés × 11 semaines). */
      if (lt && !/non concerne/.test(lt)){
        rej.litige++; cell.litiges++;
        if (ko){ rej.litigeKo++; cell.litigesKo++; }
        continue;
      }
    }
    cell.flux++;
    const dk = isoDay(d);
    const j = cell.jours[dk] || (cell.jours[dk] = { f:0, k:0 });
    j.f++;
    if (ko){
      cell.ko++; j.k++;
      const rp = splitRefPoste(ident, service);
      if (rp.ref && cell.refs.length < LIMREF){
        cell.refs.push(rp.ref); cell.dates.push(isoDay(d)); cell.postes.push(rp.poste);
        ctxPush(cell.ctx, r, colIndex);          /* le contexte suit le KO, index par index */
      }
    }
  }
  /* le nombre de litiges exclus est porté par exportDraft, pas par les cellules :
     il est réaffecté à l'application, service par service (voir applyExport). */
  /* Une semaine dont toutes les réceptions seraient en litige n'aurait aucun flux
     à afficher : on ne la crée pas, comme avant. */
  const list = Object.values(acc).filter(c => c.flux > 0)
    .sort((a, b) => a.periode.localeCompare(b.periode) || a.site.localeCompare(b.site));
  if (!list.length){
    $(EXPORT_OUT).innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Aucune ligne exploitable.</b> Vérifiez le code aire (MG, LGB, BAK, DAN, LOG) et le libellé KPI (5.1/5.2 ou 2.1/2.2).</div>';
    return;
  }
  exportDraft = { list, rej, litiges: rej.litige };
  /* ---- une période déjà chargée qui perdrait du volume ----
     Un export remplace la période qu'il couvre : c'est voulu, c'est ce qui
     permet de corriger. Mais une extraction plus ancienne, ou arrêtée en milieu
     de semaine, fait alors BAISSER un chiffre déjà communiqué — et rien ne le
     disait. Le cas est réel : un export tiré trois jours plus tôt tronquait la
     dernière semaine de 211 flux tout en complétant la première. On l'annonce
     avant d'appliquer, avec les chiffres, et on laisse décider. */
  const baisses = list.map(c => {
    const ex = S.cells[cellId(c.periode, c.site, c.service)];
    if (!ex || !ex.flux) return null;
    const df = c.flux - ex.flux;
    return df < 0 ? { c, ex, df } : null;
  }).filter(Boolean);
  const warn = [];
  if (rej.aire) warn.push(n0(rej.aire) + " hors périmètre (aire inconnue)");
  if (rej.kpi) warn.push(n0(rej.kpi) + " sans KPI reconnu");
  if (rej.date) warn.push(n0(rej.date) + " sans date de fin exploitable");
  if (rej.decale) warn.push(n0(rej.decale) + " lignes au nombre de colonnes inattendu");
  if (rej.res) warn.push(n0(rej.res) + " au résultat illisible");
  $(EXPORT_OUT).innerHTML =
    '<div class="note" style="margin:16px 0 12px">' +
      "<b>" + n0(list.reduce((s, c) => s + c.flux, 0)) + " flux retenus</b> sur " + n0(rows.length - 1) + " lignes collées." +
      (rej.litige
        ? ' <b>' + n0(rej.litige) + " flux réception exclus</b> car en litige (convention métier)."
        : (ci.litige < 0 && list.some(c => c.service === "recep")
          ? ' <b style="color:var(--crit)">La colonne « Statut litige » manque à cet export.</b> ' +
            "Les réceptions en litige ne peuvent donc pas être écartées : leurs KO restent comptés et le brut réception sort trop bas. " +
            "Ajoutez cette colonne à l'export avant de vous servir de ces chiffres."
          : ' <span class="muted">Aucun flux en litige détecté — vérifiez si le filtre est déjà appliqué en amont.</span>')) +
      (warn.length ? '<div class="muted" style="margin-top:5px">Écartés : ' + esc(warn.join(" · ")) + ".</div>" : "") +
      /* Elles comptent au brut : le dire, parce qu'elles n'apparaîtront nulle part
         dans « À justifier » et qu'on se demanderait où elles sont passées. */
      (rej.ident
        ? '<div class="muted" style="margin-top:5px">' + n0(rej.ident) + " ligne" + sPl(rej.ident) +
          " sans identifiant de flux exploitable : <b>comptée" + sPl(rej.ident) + " au brut</b> comme les autres, " +
          "mais absente" + sPl(rej.ident) + " de « À justifier » — il n'y a ni DT ni BR à montrer à l'exploitation.</div>"
        : "") +
    "</div>" +
    (baisses.length
      ? '<div class="note" style="margin:0 0 12px;border-left-color:var(--warn)"><b>' +
        n0(baisses.length) + " période" + sPl(baisses.length) + " perdrai" + (baisses.length > 1 ? "ent" : "t") +
        " du volume</b> — cet export en porte moins que ce qui est déjà enregistré. " +
        "C'est le cas d'une extraction plus ancienne, ou tirée en milieu de semaine : la dernière période y est incomplète. " +
        "Appliquer remplacera quand même le chiffre.<div class=\"muted\" style=\"margin-top:5px\">" +
        baisses.slice(0, 6).map(x => esc(perLabel(x.c.periode) + " " + SITES[x.c.site].l + " · " + SERVS[x.c.service].l) +
          " : <b>" + n0(x.ex.flux) + " → " + n0(x.c.flux) + "</b> flux (" + n0(x.df) + ")").join(" · ") +
        (baisses.length > 6 ? " · +" + n0(baisses.length - 6) + " autre" + sPl(baisses.length - 6) : "") +
        "</div></div>"
      : "") +
    '<div class="tw" style="border:1px solid var(--line);border-radius:8px"><table><thead><tr><th>Période</th><th>Site</th><th>Service</th><th class="n">Flux</th><th class="n">KO</th><th class="n">Brut</th><th class="n">Réf. KO</th><th>Effet</th></tr></thead><tbody>' +
    list.map(c => {
      const ex = S.cells[cellId(c.periode, c.site, c.service)];
      return "<tr><td class=\"nowrap\"><b>" + perLabel(c.periode) + '</b> <span class="muted" style="font-size:11px">' + weekSpan(c.periode) + "</span></td>" +
        "<td>" + SITES[c.site].l + "</td><td>" + SERVS[c.service].l + "</td>" +
        '<td class="n">' + n0(c.flux) + '</td><td class="n">' + n0(c.ko) + '</td><td class="n">' + pf((c.flux - c.ko) / c.flux) + "</td>" +
        '<td class="n">' + n0(c.refs.length) + "</td>" +
        "<td>" + (ex
          ? '<span class="pill ' + (ex.flux && c.flux < ex.flux ? "rejet" : "demo") + '">' +
            (ex.flux && c.flux < ex.flux ? "▼ " : "") + "remplace " + n0(ex.flux) + " flux · " +
            n0(ex.lignes.length) + " justif. conservées</span>"
          : '<span class="pill manuel">nouvelle période</span>') + "</td></tr>";
    }).join("") + "</tbody></table></div>" +
    (EXPORT_APPLY ? '<div class="actions"><button class="btn pri" id="btn-apply-export">Appliquer ' + list.length + " période(s)</button>" +
      '<span class="muted" style="font-size:12px">Les justifications déjà enregistrées sur ces périodes sont conservées.</span></div>'
      : '<div class="muted" style="font-size:12px;margin-top:10px">Les justifications déjà enregistrées sur ces périodes seront conservées.</div>');
  if (EXPORT_APPLY) $("#btn-apply-export").addEventListener("click", applyExport);
  if (typeof wizReady === "function") wizReady(true);
}
async function applyExport(){
  if (!exportDraft) return;
  const out = exportDraft.list.map(c => {
    const id = cellId(c.periode, c.site, c.service), ex = S.cells[id];
    return {
      id, periode:c.periode, site:c.site, service:c.service, flux:c.flux, ko:c.ko,
      litiges: c.service === "recep" ? (c.litiges || 0) : null,
      litigesKo: c.service === "recep" ? (c.litigesKo || 0) : null,
      /* La note est un champ que vous pouvez écrire (« Note de source » dans la
         fiche de période). L'écraser à chaque import effaçait ce que vous y aviez
         mis ; seule l'étiquette posée par un import précédent se remplace. */
      note: (ex && ex.note && !/^Export du /.test(ex.note))
        ? ex.note : "Export du " + new Date().toLocaleDateString("fr-FR"),
      demo: false, koRefs: c.refs, koDates: c.dates, koPostes: c.postes || [], postesOk: true,
      jours: c.jours || {}, koCtx: ctxFin(c.ctx),
      /* La base de calcul des postes recréés vient de SAP, pas de l'export : un
         réimport PowerBI ne doit pas l'effacer, sans quoi elle serait à refaire
         toutes les semaines — comme l'étaient les justifications manuelles. */
      reed: ex ? ex.reed : null,
      lignes: ex ? ex.lignes : []
    };
  });
  await bulkPut(out);
  exportDraft = null;
  /* Les règles repassent toujours, même sans règle écrite par vous : la réédition
     en fait maintenant partie, et c'est justement au réimport qu'elle doit revenir. */
  const st = await rejouerRegles(true);
  $(EXPORT_OUT).innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>' + out.length + " période(s) enregistrée(s).</b> Le tableau de bord est à jour." +
    (st.reed ? " <b>" + n0(st.reed) + " KO</b> retirés par la règle des postes recréés." : "") +
    (st.total ? " <b>" + n0(st.total) + " KO</b> documentés par vos règles." : "") +
    (st.reprisMain ? " " + n0(st.reprisMain) + " saisie" + sPl(st.reprisMain) + " à la main reprise" + sPl(st.reprisMain) +
      " par une règle — la cause d'origine est gardée dans le commentaire." : "") + "</div>";
  toast(out.length + " période(s) enregistrée(s)");
}
$("#btn-parse-export").addEventListener("click", () => analyseExport(rowsDuChamp("#ta-export") || $("#ta-export").value));
$("#btn-clear-export").addEventListener("click", () => { $("#ta-export").value = ""; $(EXPORT_OUT).innerHTML = ""; exportDraft = null; });
/* Un fichier déposé passe par le lecteur universel : .xlsx, .csv, .txt,
   ou un mail enregistré en .htm / .mht dont on extrait le tableau. */
/* Le champ de texte ne montre qu'un aperçu du fichier : les lignes complètes
   sont gardées ici, sous la clé du champ. Sans cela, relancer l'analyse depuis
   le bouton « Analyser » relirait l'aperçu — soixante lignes — au lieu du
   fichier, et retrancherait en silence tout ce qui vient après. */
const ROWS_CACHE = {};
function rowsDuChamp(ta){
  const c = ROWS_CACHE[ta];
  return c && c.apercu === $(ta).value ? c.rows : null;
}
async function chargeFichier(file, ta, sortie, suite){
  const out = $(sortie);
  if (out) out.innerHTML = '<div class="note" style="margin-top:14px">Lecture de <b>' + esc(file.name) + "</b>…</div>";
  try {
    const rows = await lireFichierRows(file);
    /* le champ ne reçoit qu'un aperçu : les analyseurs travaillent sur les lignes */
    const apercu = rows.slice(0, 60).map(r => r.join("\t")).join("\n") + (rows.length > 60
      ? "\n… " + n0(rows.length - 60) + " autres lignes lues depuis " + file.name : "");
    $(ta).value = apercu;
    ROWS_CACHE[ta] = { apercu, rows, nom:file.name };
    suite(rows);
  } catch(err){
    if (out) out.innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Fichier illisible.</b> ' +
      esc(err && err.message ? err.message : "") + " Formats acceptés : .xlsx, .csv, .txt, et le mail enregistré en .eml, .htm ou .mht.</div>";
  }
}
$("#file-export").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  chargeFichier(f, "#ta-export", EXPORT_OUT, analyseExport);
  e.target.value = "";
});

/* ---------------------------- saisie manuelle ---------------------------- */
function bindWeekHint(dateId, hintId){
  const i = $("#" + dateId), h = $("#" + hintId);
  const up = () => {
    if (!i.value){ h.textContent = "—"; return; }
    const k = weekKey(new Date(i.value + "T12:00:00"));
    h.textContent = "→ " + perLabel(k) + " · " + weekSpan(k) + " " + k.slice(0, 4);
  };
  i.addEventListener("change", up); i.addEventListener("input", up);
  i.value = new Date().toISOString().slice(0, 10); up();
}
bindWeekHint("r-date", "r-week");

/* ---------------------------- relevé ---------------------------- */
let releveDraft = null;
/* Le relevé arrive collé, ou lu depuis un fichier / un mail : dans les deux cas
   on retombe sur des lignes « référence ; catégorie ; commentaire ». */
/* Le numéro de DT tel que le relevé l'écrit : « G 7551829 », « U 7562083 »,
   « n° 7555482 ». La lettre est un marqueur de circuit, pas le numéro. */
/* Un relevé peut désigner ses lignes de deux façons. Par le numéro de DT, quand
   il est saisi à la main. Par l'identifiant de flux PowerBI —
   « 0005392215-0007553086-0001 » — quand il est bâti sur l'export lui-même, ce
   que fait un responsable qui ajoute une colonne « CAUSE » à côté des lignes KO.
   L'outil, lui, range ses KO en DT + poste : l'identifiant doit être éclaté de
   la même manière, sinon les deux ne se rencontrent jamais. Le poste est un
   gain, pas une contrainte : la cause se pose sur la ligne exacte. */
function refPosteReleve(raw, service){
  const s = String(raw == null ? "" : raw).trim().replace(/^n[°o]\s*/i, "");
  if (RE_IDENT.test(s)) return splitRefPoste(s, service || "distri");
  const m = s.match(/\d{4,}/);
  return { ref: m ? sansZeros(m[0]) : sansZeros(s), poste:"" };
}
function refReleve(raw){ return refPosteReleve(raw, "distri").ref; }
/* Reconnaissance des colonnes du relevé par leur en-tête. Un relevé converti en
   tableur porte ses libellés ; se fier à l'ordre des colonnes revient à lire la
   date à la place de la DT. Rend null si aucun en-tête n'est trouvé — on repasse
   alors au format libre « n° ; cause ; commentaire ». */
function releveCols(lignes){
  const veut = {
    /* La référence d'un KO, sous les deux formes rencontrées : le numéro de DT
       quand le relevé est saisi à la main, l'identifiant de flux quand il est
       bâti sur l'export lui-même — ce que fait un responsable qui ajoute une
       colonne « CAUSE » à côté des lignes KO. */
    ref:  h => /identifiant flux( debut)?/.test(h) ||
               (/(^|\b)(n ?[°o] ?)?(dt|dts|demande|demandes|reference|references)(\b|$)/.test(h) && !/date/.test(h)),
    cat:  h => /(categorie|cause|motif|type de retard)/.test(h),
    /* Le commentaire, sans attraper une colonne de résultat : « Statut/Résultat »
       contient « statut » et vaut « KO » — recopié en commentaire, il remplaçait
       la cause écrite par le responsable. */
    com:  h => /(commentaire|observation|remarque)/.test(h) ||
               (/statut/.test(h) && !/(resultat|litige|douane|qualite|avancement)/.test(h)),
    date: h => /(date rapport|date du releve|date releve|date jour|^date$|^jour$)/.test(h),
    nb:   h => /(nb ligne|nombre de ligne|nb ko|ko a justifier|lignes en retard|^lignes$|^nb$)/.test(h)
  };
  for (let i = 0; i < Math.min(lignes.length, 12); i++){
    const h = lignes[i].map(x => normLbl(x));
    const ci = {};
    for (const k in veut){ const j = h.findIndex(veut[k]); if (j >= 0) ci[k] = j; }
    if (ci.ref != null && ci.cat != null) return { ligne:i, ci };
  }
  return null;
}
/* ---------------- les causes écrites en clair ----------------
   Un relevé rédigé par un responsable n'emploie pas le vocabulaire de l'outil :
   « FERMETURE Z34 LOT », « SERVITUDE AU 09/09 »… Plutôt que de les jeter dans
   « Non renseignée » à chaque import, on les lui fait traduire une fois, et on
   garde la traduction. Le relevé suivant qui emploie les mêmes mots tombe juste
   tout seul. */
const LSCAUSES = "taux-net-causes";
const LSCATS = "taux-net-mes-causes";
/* Les réglages d'équipe, tels qu'un instantané de la base les rend : causes
   ajoutées, règles, traduction des libellés. Ils se lisent d'un bloc et avant
   les périodes, dans cet ordre — une règle renvoie à une cause, une période
   renvoie aux deux. */
function lisReglages(docs){
  const d = (docs || []).find(x => x.id === DOC_REGLES);
  if (!d) return;
  const o = d.o || {};
  poseCats(o.cats);
  S.regles = normRegles(o.regles);
  S.causes = normCauses(o.causes);
}
function chargeCatsLocal(){
  try { const raw = localStorage.getItem(LSCATS); if (raw) poseCats(JSON.parse(raw)); } catch(e){}
}
async function sauveCats(){
  try { localStorage.setItem(LSCATS, JSON.stringify(S.cats || [])); } catch(e){}
  const doc = { regles: S.regles, causes: S.causes || {}, cats: S.cats || [], maj: new Date().toISOString() };
  try {
    if (S.backend === "db" && S.db) await S.db.doc(FB_COLLECTION + "/" + DOC_REGLES).set(doc);
    else if (S.backend === "firebase" && S.fb) await S.fb.m.setDoc(S.fb.m.doc(S.fb.db, FB_COLLECTION, DOC_REGLES), doc);
  } catch(e){}
}
/* ---- retirer ou reclasser les saisies à la main d'une cause ----
   `vers` nul : on retire les lignes. Sinon on leur pose la cause choisie, en
   gardant le commentaire et la trace de ce qu'elles étaient. Puis les règles
   repassent : ce qu'elles visent, elles le reprennent. */
async function retireMains(cat, vers){
  const vus = {};
  selCells().forEach(c0 => { const c = realCell(c0) || c0; vus[c.id] = c; });
  const touchees = [];
  let n = 0;
  Object.values(vus).forEach(c => {
    const avant = (c.lignes || []).length;
    let lignes;
    if (vers){
      const anc = CAT[cat] ? CAT[cat].l : cat;
      lignes = (c.lignes || []).map(l => {
        if (l.regle || l.src === "releve" || l.cat !== cat) return l;
        n++;
        return Object.assign({}, l, { cat: vers,
          st: CAT[vers] && CAT[vers].j ? "ok" : "rejet",
          com: coupe([String(l.com || "").replace(/(?:^| · )était « .*? »$/, ""),
            "était « " + anc + " »"].filter(Boolean).join(" · "), 400) });
      });
    } else {
      lignes = (c.lignes || []).filter(l => {
        const vise = !l.regle && l.src !== "releve" && l.cat === cat;
        if (vise) n++;
        return !vise;
      });
    }
    if (vers ? n : lignes.length !== avant) touchees.push(Object.assign({}, c, { lignes }));
  });
  if (!touchees.length){ toast("Rien à changer"); return; }
  await bulkPut(touchees);
  await rejouerRegles(true);
  toast(vers ? n0(n) + " saisie(s) reclassée(s) en « " + (CAT[vers] ? CAT[vers].l : vers) + " »"
             : n0(n) + " saisie(s) retirée(s) — les KO sont revenus à justifier");
  render();
}
function modalDeplaceMain(cat, g){
  const c = CAT[cat];
  openModal('<div class="ph"><h2>Changer la cause de ' + n0(g.lignes) + ' saisie(s)</h2>' +
    '<span class="sub">' + esc(c ? c.l : cat) + " → une autre cause</span></div>" +
    '<div class="pb"><p class="gp">Ces ' + n0(g.ko) + " KO sont qualifiés à la main en <b>" +
      esc(c ? c.l : cat) + "</b>. La nouvelle cause s'applique à toutes ces lignes ; " +
      "l'ancienne reste notée dans leur commentaire.</p>" +
    '<div class="fgrp"><span class="flab">Nouvelle cause</span>' +
    '<select id="mm-cat">' + optCauses("tous", "", true) + "</select></div>" +
    '<div id="mm-out" class="hint" style="margin-top:10px"></div></div>' +
    '<div class="wfoot"><button class="btn" id="mm-cancel">Annuler</button>' +
    '<span class="sp"></span><button class="btn pri" id="mm-ok">Appliquer</button></div>');
  $("#mm-cancel").addEventListener("click", closeModal);
  $("#mm-ok").addEventListener("click", async () => {
    const v = $("#mm-cat").value;
    if (!v || !CAT[v]){ $("#mm-out").textContent = "Choisissez une cause."; return; }
    if (v === cat){ $("#mm-out").textContent = "C'est déjà celle-ci."; return; }
    closeModal();
    await retireMains(cat, v);
  });
}
/* Créer une cause et la rendre utilisable tout de suite. */
async function creeCause(lib, perim, justifie, note){
  const l = String(lib || "").trim();
  if (!l) return null;
  const deja = CATS.find(c => CAT_ALIAS.norm(c.l) === CAT_ALIAS.norm(l));
  if (deja) return deja.k;
  const k = cleCause(l);
  poseCats((S.cats || []).concat([{ k, l, p:perim || "tous", j: justifie !== false, d: note || "" }]));
  await sauveCats();
  return k;
}
async function retireCause(k){
  if (!CAT[k] || !CAT[k].mien) return;
  poseCats((S.cats || []).filter(c => c.k !== k));
  await sauveCats();
}
function causeConnue(brut){
  const n = CAT_ALIAS.norm(brut || "");
  if (!n) return CAT_ALIAS.map[""];
  return CAT_ALIAS.map[n] || (S.causes && CAT[S.causes[n]] ? S.causes[n] : null);
}
function chargeCausesLocal(){
  try { const raw = localStorage.getItem(LSCAUSES);
    if (raw) S.causes = normCauses(JSON.parse(raw)); } catch(e){}
}
function normCauses(o){
  const m = {};
  if (o && typeof o === "object") Object.keys(o).forEach(k => {
    const n = CAT_ALIAS.norm(k);
    if (n && CAT[o[k]]) m[n] = o[k];
  });
  return m;
}
async function sauveCauses(){
  S.causes = normCauses(S.causes);
  try { localStorage.setItem(LSCAUSES, JSON.stringify(S.causes)); } catch(e){}
  const doc = { regles: S.regles, causes: S.causes, cats: S.cats || [], maj: new Date().toISOString() };
  try {
    if (S.backend === "db" && S.db) await S.db.doc(FB_COLLECTION + "/" + DOC_REGLES).set(doc);
    else if (S.backend === "firebase" && S.fb) await S.fb.m.setDoc(S.fb.m.doc(S.fb.db, FB_COLLECTION, DOC_REGLES), doc);
  } catch(e){}
}
/* Les KO chargés, indexés par référence, pour un site et un service donnés.
   C'est cette table que le relevé interroge : il apporte la cause, jamais les
   données. Une DT que l'export ne porte pas n'est pas inventée.
   site = "*" cherche sur tous les sites : c'est alors la période où la référence
   se trouve réellement qui dit de quel site il s'agit. */
function indexKo(site, service){
  const m = {};
  const tous = !site || site === "*";
  Object.values(S.cells).forEach(c => {
    if ((!tous && c.site !== site) || c.service !== service) return;
    (c.koRefs || []).forEach((r, i) => {
      const k = sansZeros(r);
      (m[k] = m[k] || []).push({ cell:c, d:(c.koDates || [])[i] || "",
        p: String((c.koPostes || [])[i] || "") });
    });
  });
  return m;
}
function analyseReleve(src){
  const out = $(RELEVE_OUT);
  const brut = Array.isArray(src) ? src : null;
  const txt = brut ? "" : $(RELEVE_SRC.ta).value.replace(/\r\n?/g, "\n").trim();
  if (!brut && !txt){ out.innerHTML = '<div class="note" style="margin-top:14px">Collez d\'abord les lignes du relevé.</div>'; return; }
  const site = $(RELEVE_SRC.site).value, service = $(RELEVE_SRC.serv).value;
  const dForm = $(RELEVE_SRC.date).value;

  /* 1. lecture : en-têtes si le fichier en a, sinon les trois champs libres */
  const lignes = brut || txt.split("\n").map(l => l.split(/[\t;|]/).map(s => s.trim()));
  const tete = releveCols(lignes);
  const lues = [];
  let inconnues = 0;
  const libelles = {};        /* les causes écrites en clair que l'outil ne sait pas encore lire */
  const prendre = (ref, catRaw, com, dateRaw, nbRaw) => {
    const rp = refPosteReleve(ref, service), r = rp.ref, po = rp.poste;
    if (!/^\d/.test(r)) return;
    const brutCat = String(catRaw == null ? "" : catRaw).trim();
    let ck = causeConnue(brutCat);
    if (!ck){ ck = "nr"; if (brutCat){ inconnues++; libelles[brutCat] = (libelles[brutCat] || 0) + 1; } }
    const dd = parseDate(dateRaw);
    /* Faute de colonne de commentaire, la cause écrite en clair fait office : ce
       sont les mots de celui qui a rempli le relevé, et c'est ce qu'on voudra
       relire dans la fiche — « FERMETURE Z34 LOT » en dit plus que l'étiquette
       de la catégorie où on l'a rangée. */
    let cm = String(com || "").trim();
    if (!cm && brutCat && CAT_ALIAS.norm(brutCat) !== CAT_ALIAS.norm(CAT[ck] ? CAT[ck].l : "")) cm = brutCat;
    lues.push({ ref:r, poste:po, cat:ck, com:cm,
      d: dd ? isoDay(dd) : "", nb: Math.max(0, parseInt(nbRaw, 10) || 0) });
  };
  if (tete){
    const c = tete.ci;
    for (let i = tete.ligne + 1; i < lignes.length; i++){
      const l = lignes[i];
      prendre(l[c.ref], l[c.cat], c.com != null ? l[c.com] : "",
        c.date != null ? l[c.date] : "", c.nb != null ? l[c.nb] : "");
    }
  } else {
    lignes.forEach(l => prendre(l[0], l[1], l[2], "", ""));
  }
  if (!lues.length){
    out.innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Aucune DT reconnue.</b> ' +
      "Il faut soit un tableau avec des en-têtes (<code>N° DT</code> et <code>Catégorie</code> au minimum), " +
      "soit une ligne par DT au format <code>n° ; catégorie ; commentaire</code>." +
      (tete ? "" : " Aucun en-tête n'a été trouvé dans les 12 premières lignes.") + "</div>";
    return;
  }

  /* 2. regroupement par DT : une catégorie qui ne retire pas le KO l'emporte (§ règles) */
  /* Quand le relevé nomme le poste — un identifiant de flux le porte — chaque
     poste fait son propre groupe : la cause se pose sur la ligne exacte plutôt
     que sur la DT entière. Sans poste, on retombe sur le regroupement par DT. */
  const parDT = {};
  lues.forEach(l => {
    const k = l.ref + (l.poste ? "|" + l.poste : "");
    const g = parDT[k] || (parDT[k] = { ref:l.ref, poste:l.poste || "", cats:[], com:[], dates:[], nb:0 });
    g.cats.push(l.cat);
    if (l.com) g.com.push(l.com);
    if (l.d) g.dates.push(l.d);
    if (l.nb) g.nb = Math.max(g.nb, l.nb);
  });

  /* 3. rapprochement avec les KO chargés */
  const idx = indexKo(site, service);
  const perFallback = dForm ? weekKey(new Date(dForm + "T12:00:00")) : null;
  const plan = {}, trouvees = [], absentes = [];
  let koVises = 0;
  Object.values(parDT).forEach(g => {
    let hits = idx[g.ref] || [];
    /* le poste nommé restreint aux KO de ce poste ; s'il n'y en a aucun, la DT
       entière reste visée plutôt que de perdre la ligne */
    if (g.poste){ const f = hits.filter(h => h.p === g.poste); if (f.length) hits = f; }
    if (!hits.length){ absentes.push(g); return; }
    /* la date du relevé ne sert qu'à trancher entre plusieurs périodes */
    let ret = hits;
    if (g.dates.length){
      const f = hits.filter(h => g.dates.indexOf(h.d) >= 0);
      if (f.length) ret = f;
    } else if (perFallback){
      const f = hits.filter(h => h.cell.periode === perFallback);
      if (f.length) ret = f;
    }
    const bad = g.cats.find(c => SANS.indexOf(c) >= 0);
    const good = g.cats.find(c => SANS.indexOf(c) < 0);
    const cat = bad ? bad : (good || "autre");
    const parCell = {};
    ret.forEach(h => { (parCell[h.cell.id] = parCell[h.cell.id] || { cell:h.cell, n:0, d:h.d })
      .n++; });
    let reste = g.nb || 0;                    /* Nb Lignes plafonné par le réel */
    Object.values(parCell).forEach(p => {
      let n = p.n;
      if (g.nb){ n = Math.min(p.n, reste); reste -= n; }
      if (n <= 0) return;
      (plan[p.cell.id] = plan[p.cell.id] || []).push({ id:uid(), ref:g.ref,
        postes: g.poste ? [g.poste] : [],
        cat, nb:n, src:"releve", d:p.d, com:g.com.join(" · ").slice(0, 200),
        st: bad ? "rejet" : "ok" });
      koVises += n;
    });
    trouvees.push({ ref:g.ref, cat, ko:Object.values(parCell).reduce((s, p) => s + p.n, 0),
      cells:Object.keys(parCell), ecart: g.nb && g.nb !== Object.values(parCell).reduce((s, p) => s + p.n, 0) ? g.nb : 0 });
  });

  releveDraft = { plan, site, service, libelles, rows: brut || null };
  const nCell = Object.keys(plan).length;
  const justifs = Object.values(plan).flat();
  const ok = justifs.filter(l => l.st === "ok").reduce((s, l) => s + l.nb, 0);
  const rejet = koVises - ok;
  const cnt = {}; justifs.forEach(l => cnt[l.cat] = (cnt[l.cat] || 0) + l.nb);
  const ecarts = trouvees.filter(t => t.ecart);
  const nLues = Object.keys(parDT).length;
  const perAbs = {};
  absentes.forEach(g => { const p = g.dates.length ? weekKey(new Date(g.dates[0] + "T12:00:00")) : "?";
    perAbs[p] = (perAbs[p] || 0) + 1; });

  out.innerHTML = '<div class="note" style="margin:16px 0 12px">' +
    "<b>" + n0(nLues) + " DT lue" + sPl(nLues) + "</b> dans le relevé · <b>" + n0(trouvees.length) +
    " retrouvée" + sPl(trouvees.length) + "</b> parmi les KO chargés de " + SITES[site].l + " · " + SERVS[service].l +
    ", soit <b>" + n0(koVises) + " KO</b> — " + n0(ok) + " justifié" + sPl(ok) + ", " + n0(rejet) + " écarté" + sPl(rejet) + "." +
    (inconnues ? " " + n0(inconnues) + " catégorie(s) non reconnue(s), classées « Non renseignée »." : "") +
    (tete ? "" : ' <span class="muted">Lu au format libre : aucun en-tête reconnu.</span>') +
    '<div class="muted" style="margin-top:5px">' +
      Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => (CAT[k] ? CAT[k].l : k) + " " + n0(v)).join(" · ") +
    "</div>" +
    (nCell ? '<div class="muted" style="margin-top:5px">Réparti' + (koVises > 1 ? "s" : "") + " sur " + n0(nCell) + " période" + sPl(nCell) + " : " +
      esc(Object.keys(plan).map(id => perLabel(S.cells[id].periode)).sort().join(", ")) + "</div>" : "") +
    "</div>" +
    (absentes.length
      ? '<div class="note" style="margin-bottom:12px;border-left-color:var(--warn)"><b>' + n0(absentes.length) +
        " DT sans KO correspondant</b> — " + (absentes.length > 1 ? "elles ne sont pas ajoutées" : "elle n'est pas ajoutée") +
        " : le relevé pose une cause, il n'invente pas de flux. " +
        esc(absentes.slice(0, 8).map(g => g.ref).join(", ")) + (absentes.length > 8 ? "…" : "") +
        '<div class="muted" style="margin-top:5px">Le plus souvent : la semaine n\'est pas encore importée' +
        (Object.keys(perAbs).length ? " (" + esc(Object.entries(perAbs).map(([p, n]) => (p === "?" ? "sans date" : perLabel(p)) + " : " + n0(n)).join(" · ")) + ")" : "") +
        ", ou la DT n'est pas en KO dans l'export.</div></div>"
      : "") +
    (ecarts.length
      ? '<div class="note" style="margin-bottom:12px;border-left-color:var(--warn)"><b>' + n0(ecarts.length) +
        " écart" + sPl(ecarts.length) + " entre le relevé et les données</b> — le relevé annonce un nombre de lignes différent de ce que porte l'export. " +
        "Le chiffre des données fait foi : " +
        esc(ecarts.slice(0, 6).map(t => t.ref + " (relevé " + t.ecart + ", données " + t.ko + ")").join(" · ")) + "</div>"
      : "") +
    (RELEVE_APPLY && koVises
      ? '<div class="actions"><button class="btn pri" id="btn-apply-releve">Documenter ' + n0(koVises) + " KO</button>" +
        '<span class="muted" style="font-size:12px">Les DT déjà documentées par un relevé sont remplacées.</span></div>'
      : RELEVE_APPLY ? '<div class="note" style="border-left-color:var(--warn)">Rien à documenter : aucune DT du relevé ne correspond à un KO chargé.</div>' : "");
  if (RELEVE_APPLY && koVises) $("#btn-apply-releve").addEventListener("click", applyReleve);
  if (typeof wizReady === "function") wizReady(true);
}
/* ---------------- faire traduire les causes libres, une fois ----------------
   Le dernier relevé passé est gardé en mémoire : traduire un libellé relance son
   analyse et repose les causes, sans redemander le fichier. */
let dernierReleve = null;
function renderCauses(cible, libelles, apres){
  const el = $(cible);
  if (!el) return;
  const liste = Object.entries(libelles || {}).sort((a, b) => b[1] - a[1]);
  if (!liste.length){ el.innerHTML = ""; return; }
  const opts = k => CATS.filter(c => c.j || c.k === "nr")
    .map(c => '<option value="' + c.k + '"' + (c.k === k ? " selected" : "") + ">" + esc(c.l) + "</option>").join("") +
    '<option value="' + OPT_NEW + '">＋ Ajouter une cause…</option>';
  el.innerHTML = '<div class="note" style="margin-top:10px;border-left-color:var(--warn)"><b>' +
    n0(liste.length) + " cause" + sPl(liste.length) + " que l'outil ne sait pas encore lire.</b> " +
    "Dites à quoi elle" + sPl(liste.length) + " correspond" + (liste.length > 1 ? "ent" : "") +
    " : la traduction est gardée, le prochain relevé qui emploie les mêmes mots tombera juste tout seul." +
    '<div class="trad">' + liste.map(([lab, n]) =>
      '<div class="tline"><span class="tlab trunc" title="' + esc(lab) + '">' + esc(lab) + "</span>" +
      '<span class="muted nowrap">' + n0(n) + " ligne" + sPl(n) + "</span>" +
      '<select data-cause="' + esc(lab) + '">' + opts(causeConnue(lab) || "nr") + "</select></div>").join("") +
    "</div></div>";
  $$("select[data-cause]", el).forEach(s => s.addEventListener("change", async () => {
    const n = CAT_ALIAS.norm(s.dataset.cause);
    /* Le libellé du relevé fait un bon point de départ pour la cause qu'on
       s'apprête à créer : c'est exactement les mots qui manquaient. */
    if (s.value === OPT_NEW){
      s.value = causeConnue(s.dataset.cause) || "nr";
      modalCause("tous", async k => {
        if (!k) return;
        S.causes = S.causes || {}; S.causes[n] = k;
        await sauveCauses();
        if (typeof apres === "function") await apres();
      }, s.dataset.cause);
      return;
    }
    S.causes = S.causes || {};
    if (s.value === "nr") delete S.causes[n]; else S.causes[n] = s.value;
    await sauveCauses();
    if (typeof apres === "function") await apres();
  }));
}
/* Rejouer le dernier relevé avec les traductions du moment. */
async function rejoueReleve(){
  if (!dernierReleve || !dernierReleve.rows) return null;
  const si = $("#r-site"), sv = $("#r-serv");
  const memo = [si.value, sv.value];
  si.value = dernierReleve.site; sv.value = dernierReleve.service;
  const gardeOut = RELEVE_OUT, gardeSrc = RELEVE_SRC;
  RELEVE_OUT = "#depot-muet";
  RELEVE_SRC = { ta:"#ta-releve", date:"#r-date", site:"#r-site", serv:"#r-serv" };
  releveDraft = null;
  try {
    analyseReleve(dernierReleve.rows);
    if (releveDraft) await applyReleve();
  } finally {
    RELEVE_OUT = gardeOut; RELEVE_SRC = gardeSrc;
    si.value = memo[0]; sv.value = memo[1];
  }
  await rejouerRegles(true);
  return true;
}
async function applyReleve(){
  if (!releveDraft || !releveDraft.plan) return;
  if (releveDraft.rows) dernierReleve = { rows: releveDraft.rows, site: releveDraft.site, service: releveDraft.service };
  let ecartes = 0, rognes = 0;
  const out = Object.entries(releveDraft.plan).map(([cid, add]) => {
    const c = S.cells[cid]; if (!c) return null;
    const refs = new Set(add.map(l => sansZeros(l.ref)));
    /* Ce que la ligne de relevé d'avant avait pris la place de. Elle va être
       refaite ; sans relever cette mention, réimporter le même relevé effacerait
       la trace de la saisie qu'il avait remplacée au premier passage. */
    const memo = {};
    (c.lignes || []).forEach(l => {
      if (l.src !== "releve") return;
      const m = String(l.com || "").match(/(?:^| · )remplace : .*$/);
      if (m) memo[sansZeros(l.ref)] = m[0].replace(/^ · /, "");
    });
    add.forEach(l => { const v = memo[sansZeros(l.ref)];
      if (v) l.com = [l.com, v].filter(Boolean).join(" · "); });
    /* Un relevé déjà posé sur la même référence est refait, pas empilé. */
    const kept = (c.lignes || []).filter(l => !(l.src === "releve" && refs.has(sansZeros(l.ref))));
    /* Puis chaque référence touchée est ramenée dans son budget de KO : le
       relevé prend la place de ce qu'une règle ou une saisie avait posé sur le
       même KO, sans jamais justifier une référence deux fois. */
    const r = ajusteRef(c, kept.concat(add), refs);
    ecartes += r.ecartes; rognes += r.rognes;
    return Object.assign({}, c, { lignes: r.lignes });
  }).filter(Boolean);
  const gain = out.reduce((s, c) => s + (c.lignes || []).reduce((n, l) =>
    n + (l.src === "releve" && l.st === "ok" ? poidsLigne(c, l) : 0), 0), 0);
  await bulkPut(out);
  $(RELEVE_OUT).innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>' +
    n0(gain) + " KO documenté" + sPl(gain) + "</b> sur " + n0(out.length) + " période" + sPl(out.length) + "." +
    (ecartes || rognes
      ? " " + n0(ecartes + rognes) + " justification" + sPl(ecartes + rognes) +
        " visaient déjà ces KO et cèdent la place au relevé — leur cause est gardée en commentaire."
      : "") + "</div>";
  toast(n0(gain) + " KO documentés"); releveDraft = null;
}
$("#btn-parse-releve").addEventListener("click", () => analyseReleve(rowsDuChamp("#ta-releve")));
$("#file-releve").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  chargeFichier(f, "#ta-releve", RELEVE_OUT, analyseReleve);
  e.target.value = "";
});
$("#btn-clear-releve").addEventListener("click", () => { $("#ta-releve").value = ""; $(RELEVE_OUT).innerHTML = ""; releveDraft = null; });

/* ==================== le dépôt unique ====================
   L'outil sert toutes les semaines. Choisir le bon panneau, se souvenir de
   l'ordre, cliquer trois fois « Appliquer » : c'est du travail que la machine
   peut faire. On dépose tout ce qu'on a, elle reconnaît chaque fichier à ses
   en-têtes — la même lecture qui refusait déjà poliment un fichier mis au
   mauvais endroit — les passe dans l'ordre qu'ils exigent, et rend un seul
   compte rendu.

   L'ordre n'est pas un détail de confort : l'export crée les périodes et les KO,
   SAP et le relevé viennent ensuite se poser dessus. Déposés dans le désordre,
   ils sont remis dans le bon. */
function reconnait(rows){
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const heads = rows[0].map(norm);
  const a = k => findCol(heads, k) >= 0;
  /* export PowerBI : identifiant de flux + code aire + résultat */
  if (a([h => h.includes("identifiant flux"), h => h.includes("identifiant"), h => h.includes("flux debut")]) &&
      a([h => h === "code aire", h => h.includes("code aire"), h => h.includes("aire"), h => h.includes("type magasin")]) &&
      a([h => h === "resultat", h => h.includes("resultat")])) return "export";
  /* extraction SAP : le BR, son poste, le poste de référence */
  if (a([h => h === "n br", h => h.includes("n br") && !h.includes("poste"), h => h.includes("numero br")]) &&
      a([h => h.includes("n poste br"), h => h.includes("poste br") && !h.includes("reference")]) &&
      a([h => h.includes("date") && h.includes("creation") && h.includes("poste") && !h.includes("heure"),
         h => h.includes("creation du poste") && !h.includes("heure")])) return "sap";
  /* relevé : le même juge que l'import du relevé, pour ne pas dire deux choses */
  if (releveCols(rows)) return "releve";
  return null;
}
const DEPOT_LBL = { export:"Export PowerBI", sap:"Extraction SAP", releve:"Relevé journalier" };
const DEPOT_ORDRE = { export:0, sap:1, releve:2 };
/* Le relevé ne dit pas de quel site ni de quel service il parle. Plutôt que de
   le demander, on le lui fait dire : celui des quatre couples où ses DT
   retrouvent le plus de KO est le bon, et on annonce lequel a été retenu. */
function couplePourReleve(rows){
  let best = null;
  ["mag", "log"].forEach(si => ["distri", "recep"].forEach(sv => {
    const idx = indexKo(si, sv);
    const tete = releveCols(rows);
    if (!tete) return;
    const vus = {};
    let n = 0;
    for (let i = tete.ligne + 1; i < rows.length; i++){
      const r = refReleve(rows[i][tete.ci.ref]);
      if (!/^\d/.test(r) || vus[r]) continue;
      vus[r] = 1;
      if ((idx[r] || []).length) n++;
    }
    if (!best || n > best.n) best = { si, sv, n };
  }));
  return best;
}
let depotEnCours = false;
async function deposeTout(fichiers, cible){
  if (depotEnCours) return;
  const out = $(cible || "#depot-out");
  const liste = Array.from(fichiers || []);
  if (!liste.length) return;
  depotEnCours = true;
  const bloc = t => { out.innerHTML = '<div class="note" style="margin-top:14px">' + t + "</div>"; };
  bloc("Lecture de " + n0(liste.length) + " fichier" + sPl(liste.length) + "…");
  /* 1. lire et reconnaître */
  const lus = [];
  for (const f of liste){
    let rows = null, err = "";
    try { rows = await lireFichierRows(f); }
    catch(e){ err = (e && e.message) || "illisible"; }
    lus.push({ f, rows, err, type: rows ? reconnait(rows) : null });
  }
  const connus = lus.filter(x => x.type).sort((a, b) => DEPOT_ORDRE[a.type] - DEPOT_ORDRE[b.type]);
  const inconnus = lus.filter(x => !x.type);
  if (!connus.length){
    out.innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Aucun fichier reconnu.</b> ' +
      "Le dépôt attend l'export PowerBI, l'extraction SAP ou le relevé journalier. " +
      inconnus.map(x => "<code>" + esc(x.f.name) + "</code>" + (x.err ? " — " + esc(x.err) : "")).join(", ") +
      ".<div class=\"muted\" style=\"margin-top:5px\">Les trois blocs détaillés, plus bas, disent ce que chaque fichier doit porter.</div></div>";
    depotEnCours = false; return;
  }
  /* 2. passer chacun dans l'ordre, sans rien afficher au passage */
  const aTraduire = {};
  const gardeE = EXPORT_OUT, gardeS = SAP_OUT, gardeR = RELEVE_OUT, gardeSrc = RELEVE_SRC;
  EXPORT_OUT = SAP_OUT = RELEVE_OUT = "#depot-muet";
  const faits = [];
  try {
    for (let i = 0; i < connus.length; i++){
      const x = connus[i];
      bloc("<b>" + esc(x.f.name) + "</b> — " + DEPOT_LBL[x.type] + " · " + n0(i + 1) + " sur " + n0(connus.length) + "…");
      await new Promise(r => setTimeout(r, 30));      /* laisser l'écran se rafraîchir */
      if (x.type === "export"){
        exportDraft = null; analyseExport(x.rows);
        if (!exportDraft){ faits.push({ x, ko:"aucune ligne exploitable" }); continue; }
        const n = exportDraft.list.length;
        const baisses = exportDraft.list.filter(c => { const ex = S.cells[cellId(c.periode, c.site, c.service)];
          return ex && ex.flux && c.flux < ex.flux; }).length;
        /* applyExport vide exportDraft : ce qu'on veut dire du fichier se relève avant. */
        const sansId = exportDraft.rej.ident, lit = exportDraft.rej.litige, litKo = exportDraft.rej.litigeKo;
        await applyExport();
        faits.push({ x, n, note: n0(n) + " période" + sPl(n) + " enregistrée" + sPl(n), baisses, sansId, lit, litKo });
      } else if (x.type === "sap"){
        sapDraft = null; analyseSap(x.rows);
        if (!sapDraft){ faits.push({ x, ko:"aucun poste BR exploitable" }); continue; }
        const av = Object.values(S.cells).reduce((s, c) => s + Object.keys(c.reed || {}).length, 0);
        await applySap();
        const ap = Object.values(S.cells).reduce((s, c) => s + Object.keys(c.reed || {}).length, 0);
        faits.push({ x, n: ap - av, note: (ap - av > 0 ? n0(ap - av) + " poste" + sPl(ap - av) + " recréé" + sPl(ap - av) + " en plus"
          : "aucune preuve nouvelle — déjà à jour") });
      } else {
        const c = couplePourReleve(x.rows);
        if (!c || !c.n){ faits.push({ x, ko:"aucune DT du relevé ne correspond à un KO chargé" }); continue; }
        RELEVE_SRC = { ta:"#ta-releve", date:"#r-date", site:"#r-site", serv:"#r-serv" };
        const si = $("#r-site"), sv = $("#r-serv");
        const memo = [si.value, sv.value];
        si.value = c.si; sv.value = c.sv;
        releveDraft = null; analyseReleve(x.rows);
        const g = releveDraft ? Object.values(releveDraft.plan).flat().reduce((s, l) => s + l.nb, 0) : 0;
        const lib = releveDraft ? releveDraft.libelles : null;
        if (releveDraft && g) await applyReleve();
        si.value = memo[0]; sv.value = memo[1];
        if (lib && Object.keys(lib).length) Object.assign(aTraduire, lib);
        faits.push({ x, n:g, note: n0(g) + " KO documenté" + sPl(g) + " sur " + SITES[c.si].l + " · " + SERVS[c.sv].l });
      }
    }
  } finally {
    EXPORT_OUT = gardeE; SAP_OUT = gardeS; RELEVE_OUT = gardeR; RELEVE_SRC = gardeSrc;
    depotEnCours = false;
  }
  /* 3. les règles repassent une fois, à la fin */
  const st = await rejouerRegles(true);
  const baisses = faits.reduce((s, f) => s + (f.baisses || 0), 0);
  out.innerHTML =
    '<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>Tableau de bord à jour.</b>' +
      '<div style="margin-top:7px">' + faits.map(f =>
        '<div class="dline">' +
        '<span class="pill ' + (f.ko ? "rejet" : "auto") + '">' + esc(DEPOT_LBL[f.x.type]) + "</span>" +
        '<span class="dnom muted trunc">' + esc(f.x.f.name) + "</span>" +
        '<span class="dres">' + (f.ko ? '<span class="warn-t">' + esc(f.ko) + "</span>" : esc(f.note)) + "</span></div>").join("") +
      "</div>" +
      (st.reed || st.total || st.reprisMain || st.doubles
        ? '<div style="margin-top:7px;padding-top:7px;border-top:1px solid var(--line)">' +
          [st.reed ? "<b>" + n0(st.reed) + "</b> KO retirés par la règle des postes recréés" : "",
           st.total ? "<b>" + n0(st.total) + "</b> KO documentés par vos règles" : "",
           st.reprisMain ? n0(st.reprisMain) + " saisie" + sPl(st.reprisMain) + " reprise" + sPl(st.reprisMain) +
             " — la cause d'origine est gardée en commentaire" : "",
           st.doubles ? n0(st.doubles) + " doublon" + sPl(st.doubles) + " retiré" + sPl(st.doubles) : ""
          ].filter(Boolean).join(" · ") + "</div>"
        : "") +
    "</div>" +
    /* ---- ce que le brut ne dira pas de lui-même ----
       Deux chiffres expliquent la quasi-totalité de l'écart avec PowerBI : les
       lignes sans identifiant (comptées, mais introuvables dans « À justifier »)
       et les réceptions en litige (écartées, quand PowerBI les compte). Les
       taire, c'est laisser chercher. */
    (function(){
      const si = faits.reduce((s, f) => s + (f.sansId || 0), 0);
      const lt = faits.reduce((s, f) => s + (f.lit || 0), 0);
      const lk = faits.reduce((s, f) => s + (f.litKo || 0), 0);
      if (!si && !lt) return "";
      const bouts = [];
      if (si) bouts.push("<b>" + n0(si) + " ligne" + sPl(si) + " sans identifiant de flux</b> — comptée" + sPl(si) +
        " au brut comme les autres, mais absente" + sPl(si) + " d'« À justifier » : il n'y a ni DT ni BR à montrer.");
      if (lt) bouts.push("<b>" + n0(lt) + " réception" + sPl(lt) + " en litige</b> écartée" + sPl(lt) +
        " du décompte, dont " + n0(lk) + " KO — PowerBI, lui, les compte, et affiche donc un brut réception plus bas.");
      return '<div class="note" style="margin-top:10px"><b>Deux écarts connus avec PowerBI.</b><div class="muted" style="margin-top:5px">' +
        bouts.join("<br>") + "</div></div>";
    })() +
    (baisses ? '<div class="note" style="margin-top:10px;border-left-color:var(--warn)"><b>' + n0(baisses) +
      " période" + sPl(baisses) + " a" + (baisses > 1 ? "vaient" : "vait") + " plus de volume avant cet import.</b> " +
      "C'est le signe d'une extraction plus ancienne, ou tirée en milieu de semaine. Le détail est dans le bloc " +
      "<b>Export PowerBI</b> ci-dessous, en y redéposant le fichier.</div>" : "") +
    (inconnus.length ? '<div class="note" style="margin-top:10px;border-left-color:var(--warn)"><b>' +
      n0(inconnus.length) + " fichier" + sPl(inconnus.length) + " non reconnu" + sPl(inconnus.length) + "</b> — " +
      inconnus.map(x => "<code>" + esc(x.f.name) + "</code>").join(", ") + ". Rien n'en a été pris.</div>" : "");
  /* S'il reste des causes écrites en clair que l'outil ne sait pas lire, c'est la
     seule chose qu'il reste à décider : on la pose sous le compte rendu, et
     traduire relance l'analyse du relevé sans redemander le fichier. */
  const idTrad = (cible || "#depot-out").replace("#", "") + "-trad";
  out.insertAdjacentHTML("beforeend", '<div id="' + idTrad + '"></div>');
  renderCauses("#" + idTrad, aTraduire, async () => {
    await rejoueReleve();
    const el = $("#" + idTrad);
    const n = Object.values(S.cells).reduce((s, c) =>
      s + (c.lignes || []).filter(l => l.src === "releve" && l.st === "ok").length, 0);
    if (el) el.insertAdjacentHTML("afterbegin",
      '<div class="note" style="margin-top:10px;border-left-color:var(--good)">Relevé rejoué — <b>' +
      n0(n) + "</b> ligne" + sPl(n) + " de relevé justifie" + (n > 1 ? "nt" : "") + " maintenant.</div>");
    render();
  });
  toast(faits.filter(f => !f.ko).length + " fichier(s) intégré(s)");
  render();
}
/* ---------------------- le volet « Mettre à jour » ----------------------
   Le geste de toutes les semaines : déposer, et voir ce que ça a fait. Il ne
   vit pas dans la page — il s'ouvre par-dessus, depuis le bandeau, et se
   referme. La marche à suivre tient sous le dépôt : quatre vignettes, les
   gestes seulement, rien à lire. */
const MAJ_VIS = {
  bi: '<svg viewBox="0 0 120 76" fill="none" aria-hidden="true">' +
      '<rect x="6" y="8" width="66" height="60" rx="4" fill="var(--surface-2)" stroke="var(--line-2)"/>' +
      '<rect x="14" y="42" width="9" height="18" rx="1.5" fill="var(--accent)" opacity=".55"/>' +
      '<rect x="27" y="32" width="9" height="28" rx="1.5" fill="var(--accent)" opacity=".75"/>' +
      '<rect x="40" y="22" width="9" height="38" rx="1.5" fill="var(--accent)"/>' +
      '<rect x="53" y="36" width="9" height="24" rx="1.5" fill="var(--accent)" opacity=".65"/>' +
      '<path d="M14 16h32" stroke="var(--line-2)" stroke-width="2.5" stroke-linecap="round"/>' +
      '<rect x="78" y="12" width="36" height="52" rx="4" fill="var(--surface)" stroke="var(--warn)" stroke-width="1.6"/>' +
      ['20','32','44','56'].map(y =>
        '<rect x="84" y="' + y + '" width="8" height="8" rx="2" fill="var(--warn)"/>' +
        '<path d="M86 ' + (+y + 4) + 'l1.6 1.8 2.8-3.4" stroke="#3a2a00" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M96 ' + (+y + 4) + 'h12" stroke="var(--line-2)" stroke-width="2" stroke-linecap="round"/>').join("") +
      "</svg>",
  sap: '<svg viewBox="0 0 120 76" fill="none" aria-hidden="true">' +
      '<path d="M14 20c0-4.4 8.1-8 18-8s18 3.6 18 8v36c0 4.4-8.1 8-18 8s-18-3.6-18-8z" fill="var(--surface-2)" stroke="var(--line-2)" stroke-width="1.6"/>' +
      '<path d="M14 20c0 4.4 8.1 8 18 8s18-3.6 18-8M14 38c0 4.4 8.1 8 18 8s18-3.6 18-8" stroke="var(--line-2)" stroke-width="1.6"/>' +
      '<path d="M58 38h18m0 0-6-5.5M76 38l-6 5.5" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="84" y="18" width="28" height="40" rx="3" fill="var(--surface)" stroke="var(--line-2)" stroke-width="1.6"/>' +
      '<path d="M90 28h16M90 36h16M90 44h10" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" opacity=".7"/>' +
      "</svg>",
  rel: '<svg viewBox="0 0 120 76" fill="none" aria-hidden="true">' +
      '<rect x="8" y="20" width="40" height="30" rx="3" fill="var(--surface-2)" stroke="var(--line-2)" stroke-width="1.6"/>' +
      '<path d="m9.5 22 18.5 14 18.5-14" stroke="var(--line-2)" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M56 35h16m0 0-5.5-5M72 35l-5.5 5" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="80" y="14" width="32" height="46" rx="3" fill="var(--surface)" stroke="var(--line-2)" stroke-width="1.6"/>' +
      '<path d="M80 24h32M92 24v36" stroke="var(--line-2)" stroke-width="1.4"/>' +
      '<path d="M84 32h4M84 40h4M84 48h4" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M97 32h10M97 40h10M97 48h7" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" opacity=".7"/>' +
      "</svg>",
  log: '<svg viewBox="0 0 120 76" fill="none" aria-hidden="true">' +
      '<rect x="10" y="10" width="100" height="56" rx="4" fill="var(--surface)" stroke="var(--line-2)" stroke-width="1.6"/>' +
      '<rect x="10" y="10" width="100" height="13" rx="4" fill="var(--surface-2)"/>' +
      '<path d="M10 23h100M44 23v43M72 23v43" stroke="var(--line-2)" stroke-width="1.4"/>' +
      '<rect x="72" y="10" width="38" height="56" rx="0" fill="var(--c-expl)" opacity=".14"/>' +
      '<path d="M72 23h38" stroke="var(--line-2)" stroke-width="1.4"/>' +
      ['32','44','56'].map(y =>
        '<path d="M16 ' + y + 'h22M50 ' + y + 'h16" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M78 ' + y + 'h26" stroke="var(--c-expl)" stroke-width="2.4" stroke-linecap="round"/>').join("") +
      '<path d="M78 17h22" stroke="var(--c-expl-t)" stroke-width="2.4" stroke-linecap="round"/>' +
      "</svg>"
};
const MAJ_PAS = [
  { v:"bi", t:"Export PowerBI", g:["Ouvrir <b>Volume Réception / Distribution LOG + MG</b>",
      "Choisir la <b>période</b>",
      "<b>Détails lignes PowerBI</b> → <b>Dimensions</b> → <mark>tout cocher</mark>",
      "<b>Exporter les données</b>"] },
  { v:"sap", t:"Extraction SAP", g:["L'extraction des <b>réceptions</b>, même période",
      "Exporter en tableur"] },
  { v:"rel", t:"Relevé transcrit", g:["Copier le <b>prompt</b> du bloc 3",
      "Le coller avec les mails de retard",
      "Récupérer le <code>.xlsx</code>"] },
  { v:"log", t:"Export Distri Logistiport", g:["Le fichier du responsable, <b>colonne CAUSE</b> remplie",
      "Le prendre <b>tel quel</b>"] }
];
function openMaj(){
  openModal(
    '<div class="ph"><h2>Mettre à jour</h2><span class="sub">Déposez vos fichiers — l\'outil reconnaît chacun et fait le reste</span></div>' +
    '<div class="pb">' +
      '<div class="drop xl" id="depot">' +
        '<label class="btn pri big" style="cursor:pointer">Choisir les fichiers…' +
        '<input type="file" id="file-depot" multiple accept=".xlsx,.xlsm,.csv,.tsv,.txt,.htm,.html,.mht,.mhtml,.eml" hidden></label>' +
        '<span class="dropi"><b>ou glissez-les ici.</b> Les quatre ensemble ou un seul, ' +
        'dans n\'importe quel ordre.</span></div>' +
      '<div id="depot-out"></div>' +
      '<div class="flab" style="margin-top:18px">Où les prendre</div>' +
      '<div class="majgrid">' + MAJ_PAS.map((s, i) =>
        '<div class="mstep"><div class="mvis">' + MAJ_VIS[s.v] + "</div>" +
        '<div class="mbody"><div class="mtit"><em>' + (i + 1) + "</em>" + esc(s.t) + "</div>" +
        '<ul class="mgo">' + s.g.map(x => "<li>" + x + "</li>").join("") + "</ul></div></div>").join("") +
      "</div></div>" +
    '<div class="wfoot"><button class="lnk" id="maj-wiz">Me guider pas à pas</button>' +
    '<span class="sp"></span><button class="btn pri" id="maj-close">Fermer</button></div>');
  $("#modal").classList.add("wide");
  brancheDepot();
  $("#maj-close").addEventListener("click", closeModal);
  $("#maj-wiz").addEventListener("click", openWizard);
}
/* La liste de fichiers du champ est vivante : la vider avant de l'avoir recopiée
   la vide aussi pour celui qui allait la lire. On prend une copie d'abord.
   Le champ naît et meurt avec le volet : on écoute au niveau du document, sinon
   l'écoute poserait sur un élément qui n'existe pas encore. */
document.addEventListener("change", e => {
  if (!e.target || e.target.id !== "file-depot") return;
  const f = Array.from(e.target.files || []);
  e.target.value = "";
  deposeTout(f);
});
/* Le quatrième type de fichier — l'export et sa colonne CAUSE — passe par le
   même chemin que le dépôt du haut : c'est la reconnaissance qui décide, pas le
   champ où on l'a posé. Seul le compte rendu s'affiche dans son propre bloc. */
const fc = $("#file-cause");
if (fc) fc.addEventListener("change", e => {
  const f = Array.from(e.target.files || []);
  e.target.value = "";
  deposeTout(f, "#cause-out");
});
/* Le glisser-déposer s'attache à la zone elle-même — elle est recréée à chaque
   ouverture du volet, donc on rebranche à chaque fois. */
function brancheDepot(){
  const z = $("#depot");
  if (!z || z.dataset.branche) return;
  z.dataset.branche = "1";
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ["dragenter", "dragover"].forEach(t => z.addEventListener(t, e => { stop(e); z.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => z.addEventListener(t, e => { stop(e); z.classList.remove("over"); }));
  z.addEventListener("drop", e => { const f = e.dataTransfer && e.dataTransfer.files; if (f && f.length) deposeTout(f); });
}

/* ------------------ extraction SAP : rééditions de postes BR ------------------ */
let SAP_OUT = "#sap-out", SAP_APPLY = true, sapDraft = null;
const frDate = d => String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear();
const fmtDelai = (v, u) => u === "h" ? dec(v, 2) + " h" : n0(v) + " j ouvré" + (v > 1 ? "s" : "");
/* L'heure, dans toutes les écritures rencontrées. SAP sort « 104759 » — six
   chiffres collés, sans séparateur — là où le tableur écrit « 10:47 » et où un
   export peut donner une fraction de journée (0,4499 = 10:47). Ne lire que la
   forme à deux points revenait à déclarer sans heure des flux qui en ont une :
   33 postes urgents restaient injustifiés pour cette seule raison. */
function heureDe(v){
  if (v == null) return null;
  const t = String(v).trim(); if (!t) return null;
  const sep = t.match(/(\d{1,2})\s*[:hH]\s*(\d{2})/);
  if (sep) return { h:+sep[1], m:+sep[2] };
  if (/^\d{5,6}$/.test(t)){                       /* HHMMSS ou HMMSS */
    const p = t.padStart(6, "0");
    const h = +p.slice(0, 2), m = +p.slice(2, 4);
    if (h < 24 && m < 60) return { h, m };
  }
  if (/^\d{3,4}$/.test(t)){                       /* HHMM ou HMM */
    const p = t.padStart(4, "0");
    const h = +p.slice(0, 2), m = +p.slice(2, 4);
    if (h < 24 && m < 60) return { h, m };
  }
  const f = parseFloat(t.replace(",", "."));      /* fraction de journée */
  if (isFinite(f) && f > 0 && f < 1){
    const mn = Math.round(f * 1440);
    return { h:Math.floor(mn / 60) % 24, m:mn % 60 };
  }
  return null;
}
function parseDT(dv, tv){
  const d = parseDate(dv); if (!d) return null;
  const hm = heureDe(tv) || heureDe(dv);
  const out = new Date(d.getTime());
  if (hm){ out.setHours(hm.h, hm.m, 0, 0); return { d:out, t:true }; }
  return { d:out, t:false };
}
/* Un poste BR retrouvé parmi les KO chargés : soit la référence porte encore
   « BR-poste » (base ancienne), soit elle est scindée en référence + poste. */
function koCount(c, it){
  const refs = c.koRefs || [], postes = c.koPostes || [];
  let n = 0;
  for (let i = 0; i < refs.length; i++){
    const r = String(refs[i]);
    if (r === it.key){ n++; continue; }
    if (r === it.ref && String(postes[i] || "") === it.poste) n++;
  }
  return n;
}
/* Une quantité SAP : « 2.000 », « 2,000 » ou vide. */
function nbSap(v){
  if (v == null || String(v).trim() === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}
function analyseSap(src){
  const OUT = $(SAP_OUT);
  const rows = Array.isArray(src) ? src : parseTable(src);
  if (rows.length < 2){ OUT.innerHTML = '<div class="note" style="margin-top:14px">Collage vide ou illisible : il faut la ligne d\'en-têtes puis les lignes de postes BR.</div>'; return; }
  const heads = rows[0].map(norm);
  const ci = {
    mag:  findCol(heads, [h => h.includes("type magasin"), h => h === "ty", h => h.includes("magasin")]),
    br:   findCol(heads, [h => h === "n br", h => h.includes("n br") && !h.includes("poste"), h => h.includes("numero br")]),
    ps:   findCol(heads, [h => h.includes("n poste br"), h => h.includes("poste br") && !h.includes("reference")]),
    ref:  findCol(heads, [h => h.includes("poste reference"), h => h.includes("reference")]),
    /* « Date de création du poste » voisine avec « Heure de création du poste » :
       on exige le mot date, sinon l'heure serait lue comme une date. */
    cre:  findCol(heads, [h => h.includes("date") && h.includes("creation") && h.includes("poste") && !h.includes("heure"),
                          h => h.includes("creation du poste") && !h.includes("heure"),
                          h => h.includes("creation poste") && !h.includes("heure")]),
    em:   findCol(heads, [h => h === "date em", h => h.includes("date em") && !h.includes("heure")]),
    cc:   findCol(heads, [h => h.includes("circuit court")]),
    hcre: findCol(heads, [h => h.includes("heure") && h.includes("creation") && h.includes("poste"),
                          h => h.includes("heure") && h.includes("creation")]),
    hem:  findCol(heads, [h => h === "heure em", h => h.includes("heure") && h.includes("em")]),
    /* Une recréation ne porte pas toujours un poste de référence : elle se
       reconnaît alors au poste de commande, repris à l'identique. */
    cmd:  findCol(heads, [h => h === "n commande", h => h.includes("n commande") && !h.includes("poste")]),
    pcmd: findCol(heads, [h => h.includes("n poste commande"), h => h.includes("poste commande")]),
    qc:   findCol(heads, [h => h.includes("qte commandee"), h => h.includes("quantite commandee")]),
    qb:   findCol(heads, [h => h === "qte bl", h => h.includes("qte bl")])
  };
  /* Les colonnes de litige, toutes formes confondues : c'est le signe que le BR a
     bien connu un incident, donc qu'un poste recréé plus tard le résout. */
  const cLit = heads.map((h, k) => k).filter(k => /^litige/.test(heads[k]));
  const miss = ["br", "ps", "ref", "cre", "em"].filter(k => ci[k] < 0);
  if (miss.length){
    OUT.innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Colonnes introuvables.</b> Il faut <code>N° BR</code>, <code>N° poste BR</code>, <code>N° Poste Référence</code>, <code>Date de création du poste BR</code> et <code>Date EM</code>. En-têtes lus : ' + esc(rows[0].slice(0, 40).join(" · ")) + "</div>";
    return;
  }
  /* ---- premier passage : qui remplace qui ----
     Le poste de référence ne couvre qu'une partie des recréations. L'autre forme
     reprend le même poste de commande sur un poste BR créé plus tard : le nouveau
     poste solde ce qui manquait au premier. Mesuré sur l'extraction du 03/09 :
     198 postes recréés, dont 125 portent un poste de référence — les deux signaux
     concordent — et 73 ne se voient qu'ainsi. Les 649 postes créés au même instant
     sont de simples éclatements de ligne, et sont écartés. */
  const grp = {}, brLit = {};
  for (let i = 1; i < rows.length; i++){
    const r = rows[i], br = sansZeros(r[ci.br]);
    if (!br) continue;
    if (cLit.some(k => String(r[k] == null ? "" : r[k]).trim())) brLit[br] = 1;
    if (ci.cmd < 0 || ci.pcmd < 0) continue;
    const cmd = String(r[ci.cmd] == null ? "" : r[ci.cmd]).trim(), pc = sansZeros(r[ci.pcmd]);
    if (!cmd || !pc || pc === "0") continue;
    const cre = parseDT(r[ci.cre], ci.hcre >= 0 ? r[ci.hcre] : null);
    if (!cre) continue;
    const g = grp[br + "|" + cmd + "|" + pc] = grp[br + "|" + cmd + "|" + pc] || [];
    g.push({ t:cre.d.getTime(), poste:sansZeros(r[ci.ps]),
      court: nbSap(r[ci.qb]) != null && nbSap(r[ci.qc]) != null && nbSap(r[ci.qb]) < nbSap(r[ci.qc]) });
  }
  for (const k in grp) grp[k].sort((a, b) => a.t - b.t);
  /* Le poste que celui-ci remplace, ou "" s'il n'en remplace aucun. */
  const remplace = r => {
    const direct = String(r[ci.ref] == null ? "" : r[ci.ref]).trim();
    if (direct && direct !== "0") return { anc: sansZeros(direct), mode:0 };
    if (ci.cmd < 0 || ci.pcmd < 0) return null;
    const br = sansZeros(r[ci.br]);
    const cmd = String(r[ci.cmd] == null ? "" : r[ci.cmd]).trim(), pc = sansZeros(r[ci.pcmd]);
    const cre = parseDT(r[ci.cre], ci.hcre >= 0 ? r[ci.hcre] : null);
    if (!cmd || !pc || pc === "0" || !cre) return null;
    const g = grp[br + "|" + cmd + "|" + pc];
    if (!g || g.length < 2) return null;
    const prem = g[0];
    const ecart = cre.d.getTime() - prem.t;
    if (!(ecart > 0)) return null;                      /* même instant = éclatement */
    /* avec la trace de l'incident que la recréation vient résoudre */
    if (brLit[br] || prem.court) return { anc: prem.poste, mode:1 };
    /* Troisième forme : le poste a été redivisé après coup, sans incident déclaré.
       Il n'existait pas avant sa création, et le KPI compte pourtant depuis
       l'arrivée du BR. Faute de trace d'incident, on exige un décalage d'au moins
       un jour plein : sinon on confondrait avec la saisie étalée sur la journée.
       Sur l'extraction du 03/09, 1 404 postes naissent à la seconde de leur aîné,
       71 dans les 24 heures qui suivent, et 236 au-delà — c'est là que sont les
       redivisions réelles. */
    if (ecart < 24 * 36e5) return null;
    return { anc: prem.poste, mode:2 };
  };

  const items = [], stat = { lignes:rows.length - 1, reed:0, sansDate:0, urgSansHeure:0, deduits:0, redivises:0 };
  for (let i = 1; i < rows.length; i++){
    const r = rows[i];
    const rp = remplace(r);
    if (!rp) continue;
    const anc = rp.anc;
    stat.reed++; if (rp.mode) stat.deduits++; if (rp.mode === 2) stat.redivises++;
    /* SAP remplit ses numéros de zéros à gauche : on les enlève pour retomber
       sur la même écriture que l'export PowerBI et que les saisies. */
    const br = sansZeros(r[ci.br]), ps = sansZeros(r[ci.ps]);
    if (!br || !ps) continue;
    const cre = parseDT(r[ci.cre], ci.hcre >= 0 ? r[ci.hcre] : null);
    const em  = parseDT(r[ci.em],  ci.hem  >= 0 ? r[ci.hem]  : null);
    if (!cre || !em){ stat.sansDate++; continue; }
    const urg = ci.cc >= 0 && /^(x|o|oui|y|yes|1|true|vrai)$/i.test(String(r[ci.cc] == null ? "" : r[ci.cc]).trim());
    let reel = null;
    if (urg){
      if (cre.t && em.t) reel = Math.max(0, (em.d.getTime() - cre.d.getTime()) / 36e5);
      else stat.urgSansHeure++;
    } else reel = joursOuvres(toUTCDay(cre.d), toUTCDay(em.d));
    items.push({ key: br + "-" + ps, ref: br, poste: String(ps), anc, mode: rp.mode, site: AIRE2SITE[String(r[ci.mag] == null ? "" : r[ci.mag]).trim().toUpperCase()] || null,
      per: weekKey(em.d), urg, reel, unite: urg ? "h" : "j", obj: urg ? 3 : 2,
      cre: toUTCDay(cre.d), em: toUTCDay(em.d) });
  }
  const plan = {}, reed = {}, res = { ko:0, doc:0, hors:0, deja:0, tard:0, dort:0, sansPeriode:0 };
  for (const it of items){
    const cands = it.site ? [cellId(it.per, it.site, "recep")]
      : [cellId(it.per, "mag", "recep"), cellId(it.per, "log", "recep")];
    let hit = null, n = 0, dort = null;
    for (const cid of cands){
      const c = S.cells[cid]; if (!c) continue;
      if (!dort) dort = c;                    /* la période existe, le KO pas encore */
      const k = koCount(c, it);
      if (k){ hit = c; n = k; break; }
    }
    /* La recréation est notée pour TOUT poste retrouvé, même quand le délai reste
       au-delà de l'objectif : le KO est alors mérité, mais il doit se lire sur la
       bonne base. Sans cela la fiche continue d'afficher l'arrivée du BR, donc un
       délai que le litige a gonflé. */
    const preuve = {
      cre: it.cre.toISOString().slice(0, 10), anc: String(it.anc), dd: it.mode || 0,
      reel: it.reel == null ? null : Math.round(it.reel * 100) / 100,
      u: it.unite, obj: it.obj };
    if (!hit){
      res.hors++;
      /* La preuve est gardée même sans KO en face. L'extraction se dépose une
         fois ; le KO, lui, peut arriver après — un export élargi, une semaine
         complétée, une correction. Sans cela c'était l'ordre des imports qui
         décidait de ce qui serait justifiable un jour, et la promesse « déposée
         une fois, rejouée toute seule » était fausse. La règle ne pose rien tant
         que le KO n'existe pas : elle attend. */
      if (dort){ (reed[dort.id] = reed[dort.id] || {})[it.key] = preuve; res.dort++; }
      else res.sansPeriode++;
      continue;
    }
    res.ko++;
    (reed[hit.id] = reed[hit.id] || {})[it.key] = preuve;
    if (hit.lignes.some(l => l.cat === "reedition" && l.st === "ok" &&
        (String(l.ref) === it.key || (String(l.ref) === it.ref && (l.postes || []).map(String).indexOf(it.poste) >= 0)))){ res.deja++; continue; }
    if (it.reel == null || it.reel > it.obj){ res.tard++; continue; }
    res.doc++;
    (plan[hit.id] = plan[hit.id] || []).push({ it, n });
  }
  sapDraft = { plan, reed, res, stat };
  const cellsTouched = Object.keys(plan);
  const gain = cellsTouched.reduce((s, id) => s + plan[id].reduce((x, p) => x + p.n, 0), 0);
  /* postes dont la base de calcul n'est pas encore enregistrée sur la période */
  let nReed = 0;
  for (const cid in reed){ const c = S.cells[cid]; if (!c) continue;
    for (const k in reed[cid]) if (!(c.reed && c.reed[k])) nReed++; }
  OUT.innerHTML =
    '<div class="note" style="margin:16px 0 12px"><b>' + n0(stat.reed) + " poste(s) recréé(s)</b> sur " + n0(stat.lignes) +
      " lignes lues" + (stat.deduits ? ", dont " + n0(stat.deduits) + " sans poste de référence, reconnus au poste de commande" : "") + ". " + n0(res.ko) + " correspondent à un flux en KO chargé dans l'outil, dont <b>" + n0(res.doc) +
      " à documenter</b> (délai réel depuis la recréation ≤ objectif)." +
      '<div class="muted" style="margin-top:5px">' +
        (res.tard ? n0(res.tard) + " restent en retard réel · " : "") +
        (res.deja ? n0(res.deja) + " déjà enregistrés · " : "") +
        (res.dort ? n0(res.dort) + " gardés en réserve — pas de KO en face aujourd'hui, la règle les posera si l'export en apporte un · " : "") +
        (res.sansPeriode ? n0(res.sansPeriode) + " sur des semaines non chargées · " : "") +
        (stat.urgSansHeure ? n0(stat.urgSansHeure) + " urgents sans heure — non documentés par prudence · " : "") +
        (stat.sansDate ? n0(stat.sansDate) + " sans date exploitable" : "") +
      "</div></div>" +
    (cellsTouched.length
      ? '<div class="tw" style="border:1px solid var(--line);border-radius:8px"><table><thead><tr><th>Période</th><th>Site</th><th class="n">Postes documentés</th><th class="n">KO retirés</th><th>Exemple</th></tr></thead><tbody>' +
        cellsTouched.sort().map(id => { const c = S.cells[id], l = plan[id], e = l[0].it;
          return "<tr><td class=\"nowrap\"><b>" + perLabel(c.periode) + "</b></td><td>" + SITES[c.site].l + "</td>" +
            '<td class="n">' + n0(l.length) + '</td><td class="n">' + n0(l.reduce((s, p) => s + p.n, 0)) + "</td>" +
            '<td class="muted" style="font-size:12px">' + esc(e.key) + " — recréé le " + frDate(e.cre) + ", délai réel " + fmtDelai(e.reel, e.unite) + " pour " + e.obj + (e.unite === "h" ? " h" : " j") + "</td></tr>"; }).join("") +
        "</tbody></table></div>" +
        (SAP_APPLY ? '<div class="actions"><button class="btn pri" id="btn-apply-sap">Documenter ' + n0(gain) + " KO</button>" +
          '<span class="muted" style="font-size:12px">Enregistré en source « automatique » : la pièce est l\'extraction SAP.</span></div>' : "")
      : "") +
    /* Même sans rien à justifier, il reste quelque chose à enregistrer : la base de
       calcul des postes recréés. Sans ce bouton, les 55 postes encore en retard
       continuaient d'afficher un délai compté depuis l'arrivée du BR. */
    (!cellsTouched.length && nReed
      ? '<div class="note" style="margin-bottom:12px">Aucun KO de plus à justifier — les postes conformes sont déjà enregistrés. ' +
        "Il reste <b>" + n0(nReed) + " poste" + sPl(nReed) + " recréé" + sPl(nReed) + "</b> dont le délai doit se compter " +
        "depuis la recréation et non depuis l'arrivée du BR, " + n0(res.tard) + " étant encore en retard sur cette base.</div>" +
        (SAP_APPLY ? '<div class="actions"><button class="btn pri" id="btn-apply-sap">Corriger la base de calcul de ' +
          n0(nReed) + " poste" + sPl(nReed) + "</button>" +
          '<span class="muted" style="font-size:12px">Aucun taux ne bouge : seule la date de départ du délai est rétablie.</span></div>' : "")
      : (!cellsTouched.length && !nReed
        ? '<div class="note"' + (res.ko ? "" : ' style="border-left-color:var(--warn)"') + ">" +
          (res.ko
            ? "<b>Rien à reprendre — tout est déjà en place.</b> Les " + n0(res.ko) +
              " postes recréés qui correspondent à un KO chargé sont enregistrés, base de calcul comprise. " +
              "Vous pouvez redéposer ce fichier autant de fois que vous voulez."
            : "Rien à reprendre : aucun poste recréé ne correspond à un KO chargé. " +
              "Le plus souvent : la semaine n'est pas importée, ou ces postes ne sont pas en KO dans l'export.") +
          "</div>" : ""));
  if (SAP_APPLY && (cellsTouched.length || nReed)) $("#btn-apply-sap").addEventListener("click", applySap);
  if (typeof wizReady === "function"){
    wizReady(true);
    const nx = $("#wz-next");
    if (nx) nx.textContent = cellsTouched.length ? "Documenter " + n0(gain) + " KO et continuer"
      : nReed ? "Corriger " + n0(nReed) + " base(s) de calcul et continuer" : "Rien à documenter — continuer";
  }
}
async function applySap(){
  if (!sapDraft) return;
  const reed = sapDraft.reed || {};
  /* L'import SAP n'écrit plus de justification : il dépose la preuve — ce que SAP
     dit de chaque poste recréé — et c'est la règle qui justifie, ici et à chaque
     import suivant. Une seule mécanique, donc un seul endroit où elle peut se
     tromper, et elle se défait quand la preuve ne la porte plus. */
  const ids = new Set(Object.keys(reed));
  const out = [...ids].map(cid => {
    const c = S.cells[cid]; if (!c) return null;
    return Object.assign({}, c, { reed: Object.assign({}, c.reed || {}, reed[cid] || {}) });
  }).filter(Boolean);
  await bulkPut(out);
  const st = await rejouerRegles(true);
  const nb = Object.values(reed).reduce((s2, m) => s2 + Object.keys(m).length, 0);
  $(SAP_OUT).innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--good)">' +
    "<b>" + n0(nb) + " poste" + sPl(nb) + " recréé" + sPl(nb) + " enregistré" + sPl(nb) + ".</b> " +
    "La règle en retire <b>" + n0(st.reed) + " KO</b> du décompte" +
    (st.repris ? ", dont " + n0(st.repris) + " qui portai" + (st.repris > 1 ? "ent" : "t") +
      " une autre cause — celle-ci est gardée dans le commentaire de la ligne" : "") +
    ". Les autres restent comptés : leur délai dépasse l'objectif même depuis la recréation." +
    "</div>";
  toast(n0(st.reed) + " KO retirés par la règle"); sapDraft = null;
}
$("#btn-parse-sap").addEventListener("click", () => analyseSap(rowsDuChamp("#ta-sap") || $("#ta-sap").value));
$("#btn-clear-sap").addEventListener("click", () => { $("#ta-sap").value = ""; $("#sap-out").innerHTML = ""; sapDraft = null; });
$("#file-sap").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  chargeFichier(f, "#ta-sap", SAP_OUT, analyseSap);
  e.target.value = "";
});


function causeGridHtml(service, id){
  const list = CATS.filter(c => c.j && (c.p === "tous" || c.p === service));
  return '<div class="cgrid" id="' + id + '" data-serv="' + esc(service || "tous") + '">' + list.map(c =>
    '<button type="button" class="cbtn' + (c.mien ? " mien" : "") + '" data-cat="' + c.k + '">' + esc(c.l) +
    (c.d ? "<small>" + esc(c.d.length > 62 ? c.d.slice(0, 60) + "…" : c.d) + "</small>" : "") + "</button>").join("") +
    '<button type="button" class="cbtn neuve" data-cat="' + OPT_NEW + '">＋ Ajouter une cause' +
    "<small>si aucune de celles-ci ne dit ce qui s'est passé</small></button></div>";
}
function wireCauseGrid(id, onPick){
  $$("#" + id + " .cbtn").forEach(b => b.addEventListener("click", () => {
    /* La tuile de création n'est pas un choix : elle ouvre le formulaire, et
       c'est la cause qui en sort qui devient le choix. */
    if (b.dataset.cat === OPT_NEW){
      const g = $("#" + id), serv = g ? g.dataset.serv || "tous" : "tous";
      modalCause(serv, k => {
        if (!k) return;
        const grid = $("#" + id);
        if (grid){ grid.outerHTML = causeGridHtml(serv, id);
          const n = $("#" + id); if (n) n.dataset.serv = serv;
          wireCauseGrid(id, onPick);
          const cible = $("#" + id + ' .cbtn[data-cat="' + k + '"]');
          if (cible) cible.click();
        } else onPick(k);
      });
      return;
    }
    $$("#" + id + " .cbtn").forEach(x => x.classList.toggle("on", x === b));
    onPick(b.dataset.cat);
  }));
}

/* ------- fiche d'un retard non encore justifié ------- */
/* Fiche d'un retard pas encore justifié.
   Une demande porte plusieurs postes : on en choisit une partie, on lui donne une
   cause, et le reste retourne dans la liste — autant de fois qu'il le faut. */
function openFicheKo(cid, ref, n, d){
  const c = realCell(cid); if (!c) return;
  cid = c.id;
  const q = toQualify().find(x => x.cell.id === cid && String(x.ref) === String(ref));
  const reste = q ? q.n : Math.max(1, +n || 1);
  const total = q ? q.total : reste;
  const postes = q ? q.postes.slice() : [];
  const dd = d || (q && q.d) || dateOfRef(c, ref);
  const st = cellStats(c);
  const brut = c.flux ? (c.flux - c.ko) / c.flux : null;
  const net = c.flux ? (c.flux - c.ko + st.tot) / c.flux : null;
  const f = (k, v, mono) => '<div class="fi"><span class="k">' + k + '</span><span class="v' + (mono ? " mono" : "") + '">' + v + "</span></div>";
  const dejaFait = total - reste;

  /* choix de la part à qualifier : les postes s'ils sont connus, sinon une quantité */
  let bloc = "";
  if (postes.length){
    bloc = '<div class="flab phead" style="margin-top:18px">Postes à qualifier' +
      '<button class="btn sm" id="kf-all" type="button">Tout</button>' +
      '<button class="btn sm" id="kf-none" type="button">Aucun</button>' +
      '<span class="pcount" id="kf-cnt"></span></div>' +
      '<div class="postes" id="kf-postes">' +
      postes.map(p => '<label><input type="checkbox" value="' + esc(p) + '" checked>' + esc(p) + "</label>").join("") + "</div>";
  } else if (reste > 1){
    bloc = '<div class="flab" style="margin-top:18px">Combien de ces ' + n0(reste) + " KO ?</div>" +
      '<div class="form" style="margin-top:8px"><div class="f"><label for="kf-nb">KO à qualifier</label>' +
      '<input type="number" id="kf-nb" min="1" max="' + reste + '" value="' + reste + '"></div>' +
      '<div class="f wide" style="align-self:end"><span class="muted" style="font-size:12px">Le reste retourne dans la liste : ' +
      'vous pourrez lui donner une autre cause.</span></div></div>';
  }

  openModal(
    '<div class="ph"><h2>' + esc(ref) + '</h2><span class="sub">' +
      (dejaFait ? n0(dejaFait) + " KO déjà qualifiés · " + n0(reste) + " restants sur " + n0(total)
                : "Retard sans cause · " + n0(reste) + " KO") + "</span></div>" +
    '<div class="pb"><div class="fgrid">' +
      f("Date du flux", frDay(dd), true) +
      f("Jour", frWeekday(dd)) +
      f("Période", perLabel(c.periode) + " · " + weekSpan(c.periode), true) +
      f("Site", SITES[c.site].l) +
      f("Service", SERVS[c.service].l) +
      f("KO restants", n0(reste) + (dejaFait ? " sur " + n0(total) : ""), true) +
      f("Postes connus", postes.length ? n0(postes.length) : "non — qualification par quantité", true) +
      (c.service === "recep"
        ? f("Opérateur", (q && (q.ops || []).length) ? q.ops.join(", ")
            : '<span class="muted">' + (colOp(c) ? "non renseigné pour ce flux"
                : "absent de l'export chargé") + "</span>", true)
        : "") +
      f("Poids dans la période", c.ko ? dec(reste / c.ko * 100, 1) + " % des KO" : "—", true) + "</div>" +
    /* le détail de l'export : c'est là que se décide la cause, il doit être ici
       autant que sur la fiche d'un retard déjà justifié */
    ctxBloc(c, ref, postes.length ? postes : null) +
    bloc +
    '<div class="flab" style="margin-top:18px">Donner une cause</div>' +
    causeGridHtml(c.service, "kf-grid") +
    '<div class="form" style="margin-top:12px"><div class="f wide"><label for="kf-com">Justification — ce que vous diriez en réunion</label>' +
      '<input type="text" id="kf-com" placeholder="facultatif, sauf pour « Autre »"></div>' +
      '<div class="f wide"><label for="kf-src">Ce que vaut cette justification</label><select id="kf-src">' +
      '<option value="manuel">Mon analyse — compte dans le net</option>' +
      '<option value="releve">Déclaré au relevé — appuyé sur une pièce</option>' +
      '<option value="auto">Lu dans les données ou SAP — appuyé sur une pièce</option></select></div></div>' +
    '<div class="actions"><button class="btn pri big" id="kf-save" disabled>Appliquer</button>' +
    '<button class="btn" id="dl-close">Fermer</button></div>' +
    (dejaFait ? '<div class="flab" style="margin-top:16px">Déjà enregistré sur cette référence</div>' +
      '<div class="blist">' + (c.lignes || []).filter(l => String(l.ref) === String(ref)).map(l =>
        '<div class="bl"><span class="nm">' + esc(CAT[l.cat] ? CAT[l.cat].l : l.cat) +
        ((l.postes || []).length ? ' <span class="muted">postes ' + esc(l.postes.join(", ")) + "</span>" : "") +
        (l.st === "rejet" ? ' <span class="pill rejet" title="Cause enregistrée, mais elle ne retire pas le KO du décompte">KO maintenu</span>' : "") +
        '</span><span class="vl">' + n0(l.nb) + " KO</span></div>").join("") + "</div>" : "") +
    '<div class="flab" style="margin-top:16px">La période</div><div class="fgrid">' +
      f("Flux", n0(c.flux), true) + f("KO", n0(c.ko), true) +
      f("Brut", pf(brut), true) + f("Net", pf(net), true) + "</div></div>");

  const boxes = () => $$("#kf-postes input");
  const choisis = () => boxes().filter(b => b.checked).map(b => b.value);
  const combien = () => postes.length ? choisis().length
    : Math.max(1, Math.min(reste, +($("#kf-nb") ? $("#kf-nb").value : reste) || reste));
  let kcat = null;
  const maj = () => {
    const k = combien();
    if (postes.length && $("#kf-cnt")) $("#kf-cnt").textContent = n0(k) + " sur " + n0(postes.length) + " sélectionnés";
    const b = $("#kf-save");
    b.disabled = !kcat || !k;
    b.textContent = kcat ? "Appliquer à " + n0(k) + " KO" : "Appliquer";
  };
  if (postes.length){
    $("#kf-postes").addEventListener("change", maj);
    $("#kf-all").addEventListener("click", () => { boxes().forEach(b => { b.checked = true; }); maj(); });
    $("#kf-none").addEventListener("click", () => { boxes().forEach(b => { b.checked = false; }); maj(); });
  } else if ($("#kf-nb")) $("#kf-nb").addEventListener("input", maj);
  wireCauseGrid("kf-grid", k => { kcat = k; maj(); });
  maj();

  $("#kf-save").addEventListener("click", async () => {
    if (!kcat) return;
    const com = $("#kf-com").value.trim();
    if (kcat === "autre" && !com){ toast("La cause « Autre » demande un commentaire", true); return; }
    const sel = postes.length ? choisis() : [];
    const nb = postes.length ? sel.length : combien();
    if (!nb){ toast("Choisissez au moins un poste", true); return; }
    const cell = realCell(cid);
    const row = { id:uid(), ref: String(ref), postes: sel, cat:kcat, nb, src:$("#kf-src").value, com,
      d: dd || dateOfRef(cell, ref), st: CAT[kcat].j ? "ok" : "rejet" };
    /* on n'écrase que ce qui portait exactement ces postes : le reste de la
       demande garde ses propres causes */
    const gard = l => {
      if (String(l.ref) !== String(ref)) return true;
      if (!sel.length) return true;
      const ps = (l.postes || []).map(String);
      if (!ps.length) return true;
      return !ps.some(p => sel.indexOf(p) >= 0);
    };
    await putCell(Object.assign({}, cell, { lignes: cell.lignes.filter(gard).concat([row]) }));
    closeModal();
    toast(CAT[kcat].l + " — " + n0(nb) + " KO sur " + ref);
  });
}

/* ---------------------------- fiche d'un retard ---------------------------- */
/* Ce que l'export dit du flux, tel quel. Une justification se défend d'autant
   mieux qu'on lit à côté d'elle les colonnes qui l'ont motivée — sans avoir à
   rouvrir le fichier. Seules les colonnes réellement renseignées s'affichent. */
/* ---- ce que l'export dit du flux ----
   Une justification se défend d'autant mieux qu'on lit à côté d'elle les
   colonnes qui l'ont motivée, sans rouvrir le fichier. Les colonnes qui comptent
   viennent d'abord, sous un nom lisible ; **toutes les autres suivent**, telles
   que l'export les nomme — un détail caché est un détail qui manque. */
const CTX_FICHE = {
  recep: [["Arrivée du BR", "date debut"], ["Entrée marchandise", "date fin"],
    ["Fournisseur", "nom fournisseur"], ["Article", "code objet"],
    ["Emplacement", "emplacement cible"], ["Venant de", "emplacement origine"],
    ["Statut douane", "statut douane"], ["Statut litige", "statut litige"],
    ["Statut qualité", "statut qualite"]],
  distri: [["Demandée le", "date debut"], ["Échéance", "date fin prevue"],
    ["Confirmée le", "date fin"], ["Anticipation", "anticipation demande"],
    ["Article", "code objet"], ["Emplacement", "emplacement cible"],
    ["Venant de", "emplacement origine"], ["Priorité", "priorite"],
    ["Statut douane", "statut douane"], ["Statut litige", "statut litige"]]
};
/* Colonnes que la fiche ne montre pas : soit elles sont déjà dites par l'en-tête
   de la fiche (site, service, KPI), soit elles ne décrivent pas le flux. */
const CTX_MUET = /^(code aire|activite|sous activite|type de flux|calcul|heure |regroupement)/;
/* Une date et son heure se lisent ensemble : deux cases pour un seul instant
   remplissent la fiche sans rien dire de plus. */
const CTX_PAIRE = { "date reference":"heure reference", "date debut":"heure debut",
  "date fin":"heure fin", "date fin prevue":"heure fin prevue" };
/* L'anticipation est un nombre de jours ouvrés dans l'export ; écrite en clair
   elle dit d'un coup si la demande pouvait seulement être tenue. */
function litAnticipation(v){
  const n = parseFloat(String(v).replace(",", "."));
  if (!isFinite(n)) return esc(v);
  const j = a => n0(Math.abs(a)) + " jour" + (Math.abs(a) > 1 ? "s" : "") + " ouvré" + (Math.abs(a) > 1 ? "s" : "");
  if (n < 0) return "créée " + j(n) + " après l'échéance";
  if (n === 0) return "aucune — créée le jour de l'échéance";
  return j(n);
}
function ctxBloc(c, ref, postes){
  const x = c && c.koCtx;
  if (!x || !(x.c || []).length || !ref) return "";
  const cols = x.c || [];
  const trouve = frag => cols.find(n => normCol(n) === frag) ||
    cols.find(n => normCol(n).indexOf(frag) === 0) || "";
  const vus = new Set(), items = [];
  /* l'opérateur est déjà en tête de la fiche en réception, et en distribution la
     colonne porte un code d'emplacement : dans les deux cas elle ne va pas ici */
  if (colOp(c)) vus.add(colOp(c));

  /* Une valeur, l'heure accolée quand la colonne en a une. Un même jour avec
     quarante heures différentes se dit « de 06:20 à 07:05 » : la liste laissait
     croire que c'était la date qui variait. */
  const valeur = col => {
    const v = ctxRef(c, ref, postes, col);
    if (!v.length) return "";
    const h = CTX_PAIRE[normCol(col)];
    const colH = h ? cols.find(n => normCol(n) === h) : "";
    let suf = "";
    if (colH){
      vus.add(colH);
      const hv = ctxRef(c, ref, postes, colH);
      if (hv.length === 1) suf = "  " + hv[0];
      else if (hv.length > 1) suf = "  de " + hv[0] + " à " + hv[hv.length - 1];
    }
    return (v.length <= 3 ? v.join(" · ") : abrege(v)) + (v.length === 1 ? suf : "");
  };
  /* Dire combien il y en a vaut mieux que trois valeurs et des points de
     suspension : on sait alors si on regarde l'exception ou la règle. */
  function abrege(v){
    return v.slice(0, 2).join(" · ") + " … et " + n0(v.length - 2) + " autres";
  }
  const pose = (lbl, col) => {
    if (!col || vus.has(col)) return;
    vus.add(col);
    const v = valeur(col); if (!v) return;
    items.push([lbl, normCol(col).indexOf("anticipation") === 0
      ? v.split(" · ").map(litAnticipation).join(" · ")
      : esc(lbl === "Article" ? v.replace(/\b0+(\d{4,})/g, "$1") : v)]);
  };
  (CTX_FICHE[c.service] || []).forEach(([lbl, frag]) => pose(lbl, trouve(frag)));
  /* mesuré et objectif se lisent ensemble ou pas du tout ; l'unité vient du KPI,
     les codes en .2 étant les flux urgents, comptés en heures */
  /* Poste recréé après litige : le KPI compte depuis l'arrivée du BR, alors que le
     litige a arrêté le temps et qu'une nouvelle ligne a été créée pour le résoudre.
     Les deux mesures sont montrées, et nommées, pour qu'on ne les confonde pas. */
  const rd = reedRef(c, ref, postes);
  const cMes = trouve("valeur kpi"), cObj = trouve("objectif"), cKpi = trouve("kpi");
  const mes = ctxRef(c, ref, postes, cMes), obj = ctxRef(c, ref, postes, cObj),
        kpi = ctxRef(c, ref, postes, cKpi);
  vus.add(cMes); vus.add(cObj); vus.add(cKpi);
  if (rd.length){
    const dates = [...new Set(rd.map(x => frDay(x.cre)))];
    const ancs  = [...new Set(rd.map(x => String(x.anc)))];
    items.push(["Poste recréé le", esc(dates.join(" · ") +
      (ancs.length ? " — en remplacement du poste " + ancs.join(", ") : "")) +
      (rd.some(x => x.dd) ? ' <span class="muted">· rapproché par le poste de commande</span>' : "")]);
    const reels = rd.filter(x => x.reel != null);
    if (reels.length){
      const h = reels[0].u === "h";
      const un = n => h ? " h" : " j ouvré" + (Math.abs(n) > 1 ? "s" : "");
      const v = [...new Set(reels.map(x => dec(x.reel, Number.isInteger(x.reel) ? 0 : 2)))];
      const mx = Math.max.apply(null, reels.map(x => x.reel));
      items.push(["Délai réel", esc((v.length === 1 ? v[0] : "de " + v[0] + " à " + v[v.length - 1]) +
        un(mx) + " depuis la recréation · objectif " + reels[0].obj + un(reels[0].obj))]);
    }
  }
  if (mes.length){
    const u = kpi.some(k => /[25]\.2/.test(k)) ? "h" : "j";
    /* L'export sort ses délais en flottant : « 3.8702999999999999 » n'est pas une
       précision, c'est du bruit. Et quarante valeurs voisines se disent en plage. */
    const num = v => { const n = parseFloat(String(v).replace(",", "."));
      return !isFinite(n) ? String(v) : (Number.isInteger(n) ? n0(n) : dec(n, 2)); };
    const plage = l => { const t = l.map(num); const u2 = [...new Set(t)];
      return u2.length === 1 ? u2[0] : "de " + u2[0] + " à " + u2[u2.length - 1]; };
    /* Un objectif négatif n'est pas une faute de saisie : il veut dire que le
       flux devait être tenu AVANT son échéance. Écrit tel quel, « −1 j » se lit
       comme une anomalie ; écrit en clair, il dit la règle. */
    const litObj = v => {
      const n = parseFloat(String(v).replace(",", "."));
      if (!isFinite(n)) return String(v);
      if (n < 0) return num(-n) + " " + u + " avant l'échéance";
      if (n === 0) return "le jour de l'échéance";
      return num(n) + " " + u;
    };
    items.push([rd.length ? "Mesuré par le KPI" : "Mesuré / objectif",
      esc(plage(mes) + " " + u + (obj.length ? " · objectif " + [...new Set(obj.map(litObj))].join(" · ") : "")) +
      (rd.length ? ' <span class="muted">depuis l\'arrivée du BR — le litige a arrêté le temps</span>' : "")]);
  }
  if (kpi.length) items.push(["KPI", esc(kpi.join(" · "))]);
  /* tout le reste de l'export, sous son propre nom */
  cols.forEach(col => { if (!vus.has(col) && !CTX_MUET.test(normCol(col))) pose(col, col); });
  if (!items.length) return "";
  return '<div class="flab" style="margin-top:16px">Ce que l\'export en dit</div><div class="fgrid">' +
    items.map(([k, v]) => '<div class="fi"><span class="k">' + esc(k) +
      '</span><span class="v mono">' + v + "</span></div>").join("") + "</div>";
}
function openFiche(cid, lid){
  const c = realCell(cid); if (!c) return;
  cid = c.id;
  const l = c.lignes.find(x => x.id === lid); if (!l) return;
  const st = cellStats(c);
  const brut = c.flux ? (c.flux - c.ko) / c.flux : null;
  const net = c.flux ? (c.flux - c.ko + st.tot) / c.flux : null;
  const cat = CAT[l.cat] || { l:l.cat, j:true };
  const ops = opsRef(c, l.ref, l.postes);
  const f = (k, v, mono) => '<div class="fi"><span class="k">' + k + '</span><span class="v' + (mono ? " mono" : "") + '">' + v + "</span></div>";
  openModal(
    '<div class="ph"><h2>' + (l.ref ? esc(l.ref) : "Justification par lot") + "</h2>" +
    '<span class="sub">' + esc(cat.l) + " · " + n0(l.nb) + " KO" + (l.st === "rejet" ? " · KO maintenu" : "") + "</span></div>" +
    '<div class="pb"><div class="fgrid">' +
      f("Date du flux", frDay(l.d || dateOfRef(c, l.ref)), true) +
      f("Jour", frWeekday(l.d || dateOfRef(c, l.ref))) +
      f("Période", perLabel(c.periode) + " · " + weekSpan(c.periode), true) +
      f("Site", SITES[c.site].l) +
      f("Service", SERVS[c.service].l) +
      f("KO concernés", n0(l.nb), true) +
      /* Un poste peut porter plusieurs flux — même demande, même ligne, plusieurs
         codes objet. Le dire ici évite de lire « 1 poste, 4 KO » comme une erreur. */
      f("Postes", (l.postes || []).length
          ? esc(l.postes.join(", ")) + (l.nb > l.postes.length
              ? ' <span class="muted">— ' + n0(l.nb) + " flux sur " +
                (l.postes.length > 1 ? "ces postes" : "ce poste") + "</span>"
              : "")
          : "quantité seule", true) +
      /* En réception la ligne est toujours là : savoir que l'opérateur n'est pas
         renseigné, et pourquoi, vaut mieux qu'une ligne qui disparaît. */
      (c.service === "recep"
        ? f("Opérateur", ops.length
            ? ops.map(o => '<span class="pill op">' + esc(o) + "</span>").join(" ")
            : '<span class="muted">' + (colOp(c)
                ? "non renseigné pour ce flux"
                : "absent de l'export chargé — réimportez l'export PowerBI") + "</span>")
        : "") +
      f("Cause", esc(cat.l)) +
      f("Source", '<span class="pill ' + l.src + '">' + SRC[l.src] + "</span>") +
      f("Effet sur le taux", l.st === "ok"
        ? (l.src === "manuel" ? "compte dans le net" : "compte dans le documenté")
        : "aucun — gardée pour la trace") +
    "</div>" +
    (cat.d ? '<div class="note" style="margin-top:14px"><b>Règle appliquée.</b> ' + esc(cat.d) + "</div>" : "") +
    '<div class="flab" style="margin-top:16px">Justification</div>' +
    '<div class="fq">' + (l.com ? esc(l.com) : '<span class="muted">aucun commentaire enregistré</span>') + "</div>" +
    ctxBloc(c, l.ref, l.postes) +
    '<div class="flab" style="margin-top:16px">La période</div><div class="fgrid">' +
      f("Flux", n0(c.flux), true) + f("KO", n0(c.ko), true) +
      f("Brut", pf(brut), true) + f("Net", pf(net), true) + "</div>" +
    (c.note ? '<div class="muted" style="font-size:11.5px;margin-top:10px">Source du volume&nbsp;: ' + esc(c.note) + "</div>" : "") +
    '<div class="actions"><button class="btn pri" id="fi-edit">Modifier</button>' +
    '<button class="btn" id="dl-close">Fermer</button>' +
    '<span class="sp"></span><button class="btn danger" id="fi-del">Supprimer</button></div></div>');
  $("#fi-edit").addEventListener("click", () => { closeModal(); modalJustif(cid, lid); });
  $("#fi-del").addEventListener("click", async () => {
    await putCell(Object.assign({}, c, { lignes: c.lignes.filter(x => x.id !== lid) }));
    closeModal(); toast("Justification supprimée");
  });
}

/* ---------------------------- modales ---------------------------- */
function catOptions(service, sel){
  const grp = (title, list) => list.length ? '<optgroup label="' + title + '">' +
    list.map(c => '<option value="' + c.k + '"' + (c.k === sel ? " selected" : "") + ">" + esc(c.l) + "</option>").join("") + "</optgroup>" : "";
  const ok = CATS.filter(c => c.j && (c.p === "tous" || c.p === service));
  const no = CATS.filter(c => !c.j && (c.p === "tous" || c.p === service));
  return grp("Retirent le KO du décompte", ok) + grp("Gardées pour la trace — le KO reste compté", no) +
    '<optgroup label="—"><option value="' + OPT_NEW + '">＋ Ajouter une cause…</option></optgroup>';
}
function modalJustif(cellId_, ligneId){
  const cells = Object.values(S.cells).sort((a, b) => b.periode.localeCompare(a.periode));
  if (!cells.length){ toast("Enregistrez d'abord une période dans l'onglet Saisie", true); return; }
  const c = realCell(cellId_) || cells[0];
  const l = ligneId ? c.lignes.find(x => x.id === ligneId) : null;
  openModal(
    '<div class="ph"><h2>' + (l ? "Modifier la justification" : "Nouvelle justification") + '</h2><span class="sub">Une ligne retire des KO du décompte — elle doit pouvoir se défendre</span></div>' +
    '<div class="pb"><div class="form">' +
      '<div class="f wide"><label for="j-cell">Période et périmètre</label><select id="j-cell"' + (l ? " disabled" : "") + ">" +
        cells.map(x => '<option value="' + x.id + '"' + (x.id === c.id ? " selected" : "") + ">" + esc(perLabel(x.periode) + " · " + SITES[x.site].l + " · " + SERVS[x.service].l + " — " + n0(x.ko) + " KO") + "</option>").join("") + "</select></div>" +
      '<div class="f"><label for="j-cat">Cause</label><select id="j-cat">' + catOptions(c.service, l ? l.cat : null) + "</select></div>" +
      '<div class="f"><label for="j-nb">Nombre de KO</label><input type="number" id="j-nb" min="1" step="1" value="' + (l ? l.nb : 1) + '"></div>' +
      '<div class="f"><label for="j-src">Source</label><select id="j-src">' +
        Object.entries(SRC).map(([k, v]) => '<option value="' + k + '"' + ((l ? l.src : "manuel") === k ? " selected" : "") + ">" + v + "</option>").join("") + "</select></div>" +
      '<div class="f"><label for="j-ref">Référence DT / BR</label><input type="text" id="j-ref" value="' + esc(l ? l.ref : "") + '" placeholder="facultatif — vide = lot"></div>' +
      '<div class="f"><label for="j-postes">Postes concernés</label><input type="text" id="j-postes" value="' +
        esc(l && l.postes ? l.postes.join(", ") : "") + '" placeholder="ex. 3, 7, 12 — vide = quantité seule"></div>' +
      '<div class="f wide"><label for="j-com">Justification</label><input type="text" id="j-com" value="' + esc(l ? l.com : "") + '" placeholder="ce que vous diriez en réunion"></div>' +
    '</div><div class="note" style="margin-top:14px" id="j-note"></div>' +
    '<div class="actions"><button class="btn pri" id="j-save">Enregistrer</button><button class="btn" id="j-cancel">Annuler</button>' +
    (l ? '<button class="btn danger" id="j-del" style="margin-left:auto">Supprimer</button>' : "") + "</div></div>");
  const noteEl = $("#j-note");
  const upNote = () => {
    const k = $("#j-cat").value, ct = CAT[k];
    noteEl.innerHTML = ct ? (ct.j
      ? "<b>Cette cause retire le KO du décompte.</b> " + esc(ct.d || "Ces KO sortent du décompte net.")
      : "<b>Cette cause ne retire pas le KO.</b> Une urgence ou un retard expliquent la situation sans l'excuser : la ligne est enregistrée pour la trace, le KO reste compté.") : "";
  };
  $("#j-cat").addEventListener("change", e => {
    if (e.target.value === OPT_NEW){
      const nc = S.cells[$("#j-cell").value] || c;
      e.target.value = (l && l.cat) || "reliquat";
      modalCause(nc.service, k => { if (k) modalJustif(nc.id, ligneId); });
      return;
    }
    upNote();
  });
  upNote();
  $("#j-cell").addEventListener("change", () => {
    const nc = S.cells[$("#j-cell").value];
    $("#j-cat").innerHTML = catOptions(nc.service, $("#j-cat").value); upNote();
  });
  $("#j-cancel").addEventListener("click", closeModal);
  if (l) $("#j-del").addEventListener("click", async () => {
    await putCell(Object.assign({}, c, { lignes: c.lignes.filter(x => x.id !== l.id) }));
    closeModal(); toast("Justification supprimée");
  });
  $("#j-save").addEventListener("click", async () => {
    const target = S.cells[l ? c.id : $("#j-cell").value];
    const cat = $("#j-cat").value, nb = Math.max(1, +$("#j-nb").value || 1);
    const com = $("#j-com").value.trim();
    if (cat === "autre" && !com){ toast("La cause « Autre » demande un commentaire", true); return; }
    const rf = sansZeros($("#j-ref").value);
    const ps = $("#j-postes").value.split(/[,;\s]+/).map(x => sansZeros(x)).filter(Boolean);
    if (ps.length && ps.length !== nb){ toast(ps.length + " poste(s) list\u00e9(s) pour " + nb + " KO — alignez les deux", true); return; }
    const row = { id: l ? l.id : uid(), ref: rf, postes: ps, cat, nb, src: $("#j-src").value, com,
      d: (l && l.d) || dateOfRef(target, rf), st: CAT[cat].j ? "ok" : "rejet" };
    const lignes = l ? target.lignes.map(x => x.id === l.id ? row : x) : target.lignes.concat([row]);
    await putCell(Object.assign({}, target, { lignes }));
    closeModal(); toast(l ? "Justification modifiée" : "Justification ajoutée");
  });
}
function modalCell(id){
  const c = realCell(id); if (!c) return;
  id = c.id;
  openModal('<div class="ph"><h2>' + esc(perLong(c.periode)) + '</h2><span class="sub">' + SITES[c.site].l + " · " + SERVS[c.service].l + "</span></div>" +
    '<div class="pb"><div class="form">' +
    '<div class="f"><label for="c-flux">Flux comptés</label><input type="number" id="c-flux" min="0" value="' + c.flux + '"></div>' +
    '<div class="f"><label for="c-ko">Dont KO</label><input type="number" id="c-ko" min="0" value="' + c.ko + '"></div>' +
    '<div class="f"><label for="c-lit">Litiges exclus</label><input type="number" id="c-lit" min="0" value="' + (c.litiges == null ? "" : c.litiges) + '"></div>' +
    '<div class="f wide"><label for="c-note">Note de source</label><input type="text" id="c-note" value="' + esc(c.note) + '"></div>' +
    '</div><div class="note" style="margin-top:14px">' + n0(c.lignes.length) + " justification(s) et " + n0(c.koRefs.length) + " référence(s) KO rattachées à cette période.</div>" +
    '<div class="actions"><button class="btn pri" id="c-save">Enregistrer</button><button class="btn" id="c-cancel">Annuler</button>' +
    '<button class="btn danger" id="c-del" style="margin-left:auto">Supprimer la période</button></div></div>');
  $("#c-cancel").addEventListener("click", closeModal);
  $("#c-save").addEventListener("click", async () => {
    const flux = +$("#c-flux").value || 0, ko = +$("#c-ko").value || 0;
    if (ko > flux){ toast("Les KO ne peuvent pas dépasser les flux", true); return; }
    await putCell(Object.assign({}, c, { flux, ko, litiges: $("#c-lit").value === "" ? null : +$("#c-lit").value, note: $("#c-note").value, demo:false }));
    closeModal(); toast("Période mise à jour");
  });
  $("#c-del").addEventListener("click", async () => { await dropCell(c.id); closeModal(); toast("Période supprimée"); });
}
function modalQualify(sel){
  sel = sel.map(s => Object.assign({}, s, { cell: realId(s.cell) }));
  const svc = (realCell(sel[0].cell) || {}).service;
  openModal('<div class="ph"><h2>Qualifier ' + n0(sel.length) + " KO</h2><span class=\"sub\">La même cause s'applique à toute la sélection</span></div>" +
    '<div class="pb"><div class="wq" style="font-size:15px;margin-bottom:10px">1 · Choisissez la cause</div>' +
    causeGridHtml(svc, "k-grid") +
    '<div class="wq" style="font-size:15px;margin:18px 0 10px">2 · Dites pourquoi</div><div class="form">' +
    '<div class="f wide"><label for="k-com">Justification — ce que vous diriez en réunion</label><input type="text" id="k-com" placeholder="facultatif, sauf pour « Autre »"></div>' +
    '<div class="f wide"><label for="k-src">Ce que vaut cette justification</label><select id="k-src">' +
      '<option value="manuel">Mon analyse — compte dans le net</option>' +
      '<option value="releve">Déclaré au relevé — appuyé sur une pièce</option>' +
      '<option value="auto">Lu dans les données ou SAP — compte dans le documenté</option></select></div>' +
    '</div><div class="actions"><button class="btn pri big" id="k-save" disabled>Appliquer</button><button class="btn" id="k-cancel">Annuler</button></div></div>');
  let kcat = null;
  wireCauseGrid("k-grid", k => { kcat = k; $("#k-save").disabled = false; });
  $("#k-cancel").addEventListener("click", closeModal);
  $("#k-save").addEventListener("click", async () => {
    const cat = kcat, src = $("#k-src").value, com = $("#k-com").value.trim();
    if (!cat){ toast("Choisissez une cause", true); return; }
    if (cat === "autre" && !com){ toast("La cause « Autre » demande un commentaire", true); return; }
    const byCell = {};
    sel.forEach(s => (byCell[s.cell] = byCell[s.cell] || []).push(s));
    const out = Object.entries(byCell).map(([cid, items]) => {
      const c = realCell(cid);
      /* une clé référence+poste par KO visé : on ne remplace que ceux-là */
      const vises = {};
      items.forEach(i => (i.postes || []).forEach(p => { vises[String(i.ref) + " " + String(p)] = 1; }));
      const refsSansPoste = items.filter(i => !(i.postes || []).length).map(i => String(i.ref));
      const add = items.map(i => ({ id:uid(), ref:String(i.ref), postes:(i.postes || []).slice(), cat,
        nb:Math.max(1, +i.n || 1), src, com, d: dateOfRef(c, i.ref), st: CAT[cat].j ? "ok" : "rejet" }));
      const gard = l => {
        if (!l.ref) return true;
        const r = String(l.ref), ps = (l.postes || []).map(String);
        if (ps.length) return !ps.some(p => vises[r + " " + p]);
        return refsSansPoste.indexOf(r) < 0;
      };
      return Object.assign({}, c, { lignes: c.lignes.filter(gard).concat(add) });
    });
    await bulkPut(out);
    const tot = sel.reduce((s, i) => s + Math.max(1, +i.n || 1), 0);
    closeModal(); toast(n0(tot) + " KO qualifiés");
  });
}
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.edit){ const [ci, li] = b.dataset.edit.split("|"); modalJustif(ci, li); }
  if (b.dataset.del){ const [ci, li] = b.dataset.del.split("|"); const c = realCell(ci);
    if (c) putCell(Object.assign({}, c, { lignes: c.lignes.filter(x => x.id !== li) })).then(() => toast("Justification supprimée")); }
  if (b.dataset.cedit) modalCell(b.dataset.cedit);
  if (b.dataset.cdel){ const c = realCell(b.dataset.cdel);
    if (c && confirm("Supprimer " + perLabel(c.periode) + " · " + SITES[c.site].l + " · " + SERVS[c.service].l + " ? Les justifications rattachées seront perdues.")) dropCell(c.id); }
});
$("#btn-add-j").addEventListener("click", () => modalJustif(null, null));
$("#btn-qual-all").addEventListener("click", () => {
  const sel = $("#q-all").checked
    ? qList.map(r => ({ cell:r.cell.id, ref:r.ref, n:r.n, postes:r.postes.slice() }))
    : $$(".qbox:checked").map(x => {
        const r = qList.find(y => y.cell.id === x.dataset.cell && String(y.ref) === x.dataset.ref);
        return { cell:x.dataset.cell, ref:x.dataset.ref, n:+x.dataset.n || 1, postes: r ? r.postes.slice() : [] };
      });
  if (!sel.length){ toast("Cochez des lignes, ou utilisez « Cocher les N lignes »", true); return; }
  modalQualify(sel);
});
$("#q-all").addEventListener("change", e => { $$(".qbox").forEach(x => { x.checked = e.target.checked; }); });
$("#q-scope").addEventListener("change", e => { S.ui.qscope = e.target.value; S.ui.qshow = 40; render(); });
/* Le clic rapide qualifie tout ce qui reste sur la référence — les postes déjà
   justifiés autrement gardent leur cause. Pour n'en traiter qu'une partie,
   la fiche (clic sur la ligne) laisse choisir les postes. */
async function quickQualify(cellId, ref, cat, n){
  const c = realCell(cellId); if (!c) return;
  cellId = c.id;
  const q = toQualify().find(x => x.cell.id === cellId && String(x.ref) === String(ref));
  const nb = q ? q.n : Math.max(1, +n || 1);
  const sel = q ? q.postes.slice() : [];
  if (cat === "_more"){ modalQualify([{ cell:cellId, ref, n:nb, postes:sel }]); return; }
  const row = { id:uid(), ref:String(ref), postes:sel, cat, nb, src:"manuel", com:"",
    d: (q && q.d) || dateOfRef(c, ref), st: CAT[cat].j ? "ok" : "rejet" };
  const gard = l => {
    if (String(l.ref) !== String(ref)) return true;
    if (!sel.length) return true;
    const ps = (l.postes || []).map(String);
    if (!ps.length) return true;
    return !ps.some(p => sel.indexOf(p) >= 0);
  };
  await putCell(Object.assign({}, c, { lignes: c.lignes.filter(gard).concat([row]) }));
  toast(CAT[cat].l + " — " + ref + (nb > 1 ? " (" + nb + " KO)" : ""));
}
document.addEventListener("click", async e => {
  const fic = e.target.closest("tr[data-fiche]");
  if (fic && !e.target.closest("button")){ const p = fic.dataset.fiche.split("|"); openFiche(p[0], p[1]); return; }
  const fko = e.target.closest("tr[data-ko]");
  if (fko && !e.target.closest("button, input, label")){ const p = fko.dataset.ko.split("|"); openFicheKo(p[0], p[1], +p[2] || 1, p[3] || ""); return; }
  const fcr = e.target.closest("tr[data-cellrow]");
  if (fcr && !e.target.closest("button, input")){ modalCell(fcr.dataset.cellrow); return; }
  const qb = e.target.closest("[data-qq]");
  if (qb){ const p = qb.dataset.qq.split("|"); quickQualify(p[0], p[1], p[2], p[3]); return; }
  if (e.target.closest("#btn-qmore")){ S.ui.qshow += 40; render(); return; }
  const mb = e.target.closest("[data-maille]");
  if (mb){ S.ui.maille = mb.dataset.maille; syncSegs(); render(); return; }
  const dr = e.target.closest("[data-drill]");
  if (dr){ drill(dr.dataset.drill); return; }
  const tg = e.target.closest("[data-tabgo]");
  if (tg){ gotoTab(tg.dataset.tabgo); window.scrollTo({ top:0, behavior:"smooth" }); return; }
  if (e.target.closest("#btn-defs")){ openDefs(); return; }
  /* « Mettre à jour » ouvre le dépôt, pas l'assistant : c'est le geste de toutes
     les semaines, il doit tomber en une fois. L'assistant reste à un clic, pour
     la première fois ou quand on veut être tenu par la main. */
  if (e.target.closest("#btn-wizard, #lien-maj")){ openMaj(); return; }
  if (e.target.closest("#btn-wizard2, #ac-wizard, #lien-assistant")) openWizard();
  if (e.target.closest("#btn-cause-new")){ modalCause("tous"); return; }
  /* ---- retirer ou reclasser des saisies à la main, par cause ----
     Rien n'est perdu : les KO retournent dans « À justifier », et les règles qui
     les visent les reprennent au passage suivant. C'est le seul moyen de défaire
     une qualification ancienne — supprimer une règle n'y touche pas, ce n'est
     pas elle qui l'a posée. */
  const mdel = e.target.closest("[data-maindel]");
  if (mdel){
    const k = mdel.dataset.maindel, g = mainsParCause().find(x => x.cat === k);
    if (!g) return;
    const c = CAT[k];
    if (!confirm("Retirer " + n0(g.lignes) + " saisie(s) à la main en « " + (c ? c.l : k) + " » ?\n\n" +
      n0(g.ko) + " KO repartiront dans « À justifier ». Les règles qui les visent les reprendront " +
      "au passage suivant.\n\nSeules les saisies à la main sont touchées : ni les relevés, ni SAP, " +
      "ni les règles.")) return;
    await retireMains(k, null);
    return;
  }
  const mmv = e.target.closest("[data-mainmv]");
  if (mmv){
    const k = mmv.dataset.mainmv, g = mainsParCause().find(x => x.cat === k);
    if (!g) return;
    modalDeplaceMain(k, g);
    return;
  }
  const cd = e.target.closest("[data-catdel]");
  if (cd){
    const k = cd.dataset.catdel, c = CAT[k];
    let n = 0;
    Object.values(S.cells).forEach(x => (x.lignes || []).forEach(l => { if (l.cat === k) n++; }));
    const nr = (S.regles || []).filter(r => r.cause === k).length;
    if (!confirm("Retirer la cause « " + (c ? c.l : k) + " » ?" +
      (n ? "\n\n" + n + " justification(s) la portent : elles restent, mais s'afficheront en « Autre »." : "") +
      (nr ? "\n" + nr + " règle(s) s'en servent : elles ne poseront plus rien tant qu'on ne leur a pas donné une autre cause." : ""))) return;
    retireCause(k).then(() => { toast("Cause retirée"); render(); });
    return;
  }
});

/* ---------------------------- exports ---------------------------- */
async function offerFile(name, text){
  const inArtifact = !!(window.claude && typeof window.claude.use === "function");
  const bin = typeof text !== "string";
  if (inArtifact){
    let d = null;
    try { d = await window.claude.use("downloads"); } catch(e){}
    if (d){
      try { await d.save({ filename:name, data: bin ? new Blob([text]) : text }); toast("Fichier enregistré"); return; }
      catch(err){ if (err && err.code === "declined") return; }
    }
  } else {
    try {
      const url = URL.createObjectURL(new Blob([text], { type:"application/octet-stream" }));
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      toast("Fichier téléchargé"); return;
    } catch(e){}
  }
  if (bin){ toast("Téléchargement indisponible dans cette vue", true); return; }
  openModal('<div class="ph"><h2>' + esc(name) + '</h2><span class="sub">Le téléchargement direct n\'est pas disponible ici — copiez le contenu</span></div>' +
    '<div class="pb"><textarea rows="12" id="dl-ta"></textarea><div class="actions"><button class="btn pri" id="dl-copy">Copier</button><button class="btn" id="dl-close">Fermer</button></div></div>');
  $("#dl-ta").value = text;
  $("#dl-close").addEventListener("click", closeModal);
  $("#dl-copy").addEventListener("click", () => { $("#dl-ta").select(); try { document.execCommand("copy"); toast("Copié"); } catch(e){ toast("Copie impossible", true); } });
}
const csv = rows => "﻿" + rows.map(r => r.map(v => { const s = String(v == null ? "" : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";")).join("\n");
const stamp = () => new Date().toISOString().slice(0, 10);
$("#btn-exp-json").addEventListener("click", () => offerFile("taux-service-" + stamp() + ".json", JSON.stringify({ v:1, exporte:new Date().toISOString(), cells:Object.values(S.cells) }, null, 1)));
$("#btn-exp-cells").addEventListener("click", () => {
  const rows = [["Periode", "Debut", "Site", "Service", "Flux", "KO", "Justifies documentes", "Justifies manuels", "Brut", "Net", "Reste a qualifier", "Source"]];
  Object.values(S.cells).sort((a, b) => a.periode.localeCompare(b.periode)).forEach(c => {
    const st = cellStats(c);
    rows.push([perLabel(c.periode), weekSpan(c.periode), SITES[c.site].l, SERVS[c.service].l, c.flux, c.ko,
      Math.round(st.doc), Math.round(st.man),
      dec(c.flux ? (c.flux - c.ko) / c.flux * 100 : 0, 2), dec(c.flux ? (c.flux - c.ko + st.tot) / c.flux * 100 : 0, 2),
      Math.max(0, c.ko - st.tot), c.note]);
  });
  offerFile("periodes-" + stamp() + ".csv", csv(rows));
});
$("#btn-exp-just").addEventListener("click", () => {
  const rows = [["Periode", "Site", "Service", "Reference", "Cause", "Justifiante", "Nb KO", "Source", "Statut", "Commentaire"]];
  Object.values(S.cells).sort((a, b) => a.periode.localeCompare(b.periode)).forEach(c => c.lignes.forEach(l => {
    rows.push([perLabel(c.periode), SITES[c.site].l, SERVS[c.service].l, l.ref, CAT[l.cat] ? CAT[l.cat].l : l.cat,
      CAT[l.cat] && CAT[l.cat].j ? "oui" : "non", l.nb, SRC[l.src], l.st === "ok" ? "retenue" : "ecartee", l.com]);
  }));
  offerFile("justifications-" + stamp() + ".csv", csv(rows));
});
/* ---------------- reprise des saisies de l'ancien outil ----------------
   L'ancien suivi enregistrait ses saisies à plat, une clé par référence :
     state : référence → libellé de la cause (c'est la justification saisie)
     note  : référence → commentaire
     mem   : state, plus les dates écrites « 7517863@ » → « 27/08/2026 »
     rel   : les lignes du relevé quotidien { dt, j, n, cat, com, aff, dem }
     mails : la trace des mails de relevé reçus — sans équivalent ici
   Rien n'est recréé : chaque référence est cherchée parmi les KO déjà chargés,
   et ce sont eux qui donnent la période, le site et le nombre de lignes. */
const ANCIEN_CAUSE = {
  "litige fournisseur":"fournisseur", "retard fournisseur":"fournisseur",
  "blocage douane":"douane", "jour ferie":"ferie",
  "litige br":"reedition", "br reedite":"reedition", "reedition de br":"reedition",
  "indisponibilite sap":"si", "indisponibilite si":"si",
  "transport amont":"transport", "demande client tardive":"client",
  "demande irrealisable":"irrealisable", "mise a disposition":"mad"
};
function estAncien(o){
  if (!o || typeof o !== "object" || Array.isArray(o) || Array.isArray(o.cells)) return false;
  return ["distri", "recep"].some(k => o[k] && typeof o[k] === "object" &&
    (o[k].state || o[k].mem || o[k].rel));
}
/* Le libellé de l'ancien outil vers une cause d'ici. Sans correspondance la
   ligne part en « Autre » et le libellé d'origine passe dans le commentaire :
   la saisie est conservée, et ce qu'elle disait reste lisible. */
function causeAncienne(lbl){
  const n = CAT_ALIAS.norm(lbl || "");
  const k = CAT_ALIAS.map[n] || ANCIEN_CAUSE[n];
  if (k && CAT[k]) return { cat:k, garde:false };
  return { cat:"autre", garde:!!String(lbl || "").trim() };
}
/* Les dates de `mem` : la clé « 7517863@ » porte « 27/08/2026 ». */
function datesAncien(mem){
  const d = {};
  for (const k in (mem || {})){
    if (k.slice(-1) !== "@") continue;
    const dd = parseDate(mem[k]);
    if (dd) d[sansZeros(k.slice(0, -1))] = isoDay(dd);
  }
  return d;
}
/* `j` est un rang de jour dans l'année, l'année n'est pas écrite. On la retrouve
   en essayant celles que portent les KO chargés et en gardant celle qui place
   les relevés au plus près des KO qu'ils justifient. */
const jourAncien = (an, j) => new Date(an, 0, 1 + (+j || 0), 12, 0, 0);
function anneeAncien(rel, idx){
  const ans = new Set();
  Object.values(idx).forEach(h => h.forEach(x => { if (x.d) ans.add(+x.d.slice(0, 4)); }));
  ans.add(new Date().getFullYear());
  let best = null;
  for (const a of ans){
    let n = 0;
    for (const r of rel){
      const hits = idx[sansZeros(r.dt)]; if (!hits) continue;
      const t = jourAncien(a, r.j);
      if (hits.some(h => h.d && Math.abs((new Date(h.d + "T12:00:00") - t) / 864e5) <= 2)) n++;
    }
    if (!best || n > best.n) best = { a, n };
  }
  return best || { a:new Date().getFullYear(), n:0 };
}
/* Une sauvegarde de l'ancien outil vient d'un site. Un numéro qui existe sur les
   deux sites serait ambigu : on tranche par le site où tombent les références
   qui, elles, ne le sont pas. */
function siteAncien(refs, idx){
  const seuls = {};
  refs.forEach(r => {
    const hits = idx[r]; if (!hits) return;
    const s = new Set(hits.map(h => h.cell.site));
    if (s.size === 1) seuls[[...s][0]] = (seuls[[...s][0]] || 0) + 1;
  });
  const e = Object.entries(seuls).sort((a, b) => b[1] - a[1]);
  return e.length ? e[0][0] : null;
}
/* Les KO d'une référence, période par période, le site tranché et la date du
   relevé servant seulement à départager. */
function hitsAncien(idx, ref, dom, dates){
  let h = idx[ref];
  if (!h || !h.length) return null;
  if (dom){ const f = h.filter(x => x.cell.site === dom); if (f.length) h = f; }
  if (dates && dates.length){ const f = h.filter(x => dates.indexOf(x.d) >= 0); if (f.length) h = f; }
  return h;
}
/* Pose les lignes d'une référence sans jamais justifier deux fois le même KO :
   ce qu'une règle ou une autre saisie couvre déjà reste à elles. Rien n'est
   remplacé — une reprise ne fait que compléter, et peut donc se rejouer.
   Quand le KO est déjà justifié, la saisie n'est pas perdue pour autant : son
   texte est reporté sur la justification en place (`notes`), sinon elle
   disparaîtrait de la fiche alors que c'est précisément ce qu'on vient chercher. */
/* Coupe un texte sur un mot, pas au milieu d'un : « En co » au bout d'un
   commentaire donne l'impression d'un bug, alors que c'est juste une coupe. */
function coupe(s, n){
  const t = String(s == null ? "" : s).trim();
  if (t.length <= n) return t;
  const c = t.slice(0, n);
  const i = Math.max(c.lastIndexOf(" · "), c.lastIndexOf(" "));
  return (i > n * 0.6 ? c.slice(0, i) : c).replace(/[\s·,;:-]+$/, "") + "…";
}
function placeAncien(plan, couv, notes, hits, mod, nbMax, txt){
  const parCell = {};
  hits.forEach(h => { (parCell[h.cell.id] = parCell[h.cell.id] || { cell:h.cell, n:0, d:h.d }).n++; });
  let reste = nbMax || 0, pose = 0, deja = 0, reporte = 0, refait = 0;
  /* ce qui a réellement été écrit, sans le «&nbsp;Relevé&nbsp;: Reliquat —&nbsp;» de tête :
     la reprise précédente a pu le poser seul, et le seed de l'historique aussi */
  const charge = String(txt || "").replace(/^[^—]{0,40}— ?/, "").trim();
  const mien = l => {
    if (String(l.ref) !== String(mod.ref)) return false;
    const c = String(l.com || "");
    return c.indexOf(txt) >= 0 || (charge.length > 11 && c.indexOf(charge) >= 0);
  };
  Object.values(parCell).forEach(p => {
    const k = p.cell.id + "|" + mod.ref;
    let n = p.n;
    if (nbMax){ n = Math.min(n, reste); reste -= n; }
    if (n <= 0) return;
    /* Déjà repris : cette même saisie est sur place, comme justification ou
       comme texte porté sur celle qui couvrait le KO. C'est ce qui rend la
       reprise rejouable — on la redépose sans rien ajouter. */
    if (txt && (p.cell.lignes || []).some(mien)){ refait++; deja += n; return; }
    const pris = (p.cell.lignes || []).filter(l => String(l.ref) === String(mod.ref))
      .reduce((s, l) => s + Math.max(0, +l.nb || 0), 0) + (couv[k] || 0);
    const prend = Math.min(n, Math.max(0, p.n - pris));
    if (prend <= 0){
      /* le KO est déjà justifié : la saisie ne s'ajoute pas, mais son texte
         rejoint la justification en place — sinon elle resterait invisible,
         et c'est précisément ce qu'on vient chercher */
      deja += n;
      if (txt && !(notes[p.cell.id] || {})[mod.ref]){
        (notes[p.cell.id] = notes[p.cell.id] || {})[mod.ref] = txt;
        reporte++;
      }
      return;
    }
    deja += n - prend;
    (plan[p.cell.id] = plan[p.cell.id] || []).push(Object.assign({}, mod,
      { id:uid(), postes:[], nb:prend, d:p.d || mod.d, com:txt || mod.com || "" }));
    couv[k] = (couv[k] || 0) + prend;
    pose += prend;
  });
  return { pose, deja, reporte, refait };
}
let ancienDraft = null;
function analyseAncien(o){
  const out = $("#imp-out");
  const plan = {}, couv = {}, notes = {}, abs = [], inconnues = {}, lu = {};
  let deja = 0, reporte = 0, refait = 0, an = null, doms = {};
  for (const service of ["distri", "recep"]){
    const b = o[service]; if (!b || typeof b !== "object") continue;
    const idx = indexKo("*", service);
    const st = b.state || {}, notesRef = b.note || {}, dts = datesAncien(b.mem);
    const rel = Array.isArray(b.rel) ? b.rel : [];
    const info = lu[service] = { cause:0, causeOk:0, rel:0, relOk:0 };
    const dom = siteAncien(Object.keys(st).map(sansZeros)
      .concat(rel.map(r => sansZeros(r.dt))), idx);
    if (dom) doms[service] = dom;

    /* 1. les causes saisies à la main */
    for (const brut in st){
      const ref = sansZeros(brut); info.cause++;
      const d = dts[ref] || "";
      const hits = hitsAncien(idx, ref, dom, d ? [d] : null);
      if (!hits){ abs.push({ ref, service }); continue; }
      const c = causeAncienne(st[brut]);
      if (c.garde){ const l = String(st[brut]).trim(); inconnues[l] = (inconnues[l] || 0) + 1; }
      const note = String(notesRef[brut] || "").trim();
      const com = [note, c.garde ? "Cause d'origine : " + String(st[brut]).trim() : ""]
        .filter(Boolean).join(" · ");
      const txt = coupe("Ancien suivi : " + String(st[brut]).trim() + (note ? " — " + note : ""), 170);
      const r = placeAncien(plan, couv, notes, hits, { ref, cat:c.cat, src:"manuel", d, com,
        st:SANS.indexOf(c.cat) >= 0 ? "rejet" : "ok" }, 0, txt);
      deja += r.deja; reporte += r.reporte; refait += r.refait;
      info.causeOk++;
    }

    /* 2. les lignes du relevé quotidien */
    if (rel.length){
      const cal = anneeAncien(rel, idx); if (!an) an = cal;
      const parDT = {};
      rel.forEach(r => {
        const ref = sansZeros(r.dt); if (!/^\d/.test(ref)) return;
        const g = parDT[ref] || (parDT[ref] = { ref, cats:[], com:[], dates:[], nb:0 });
        g.cats.push(CAT_ALIAS.map[CAT_ALIAS.norm(r.cat || "")] || "nr");
        const c = [String(r.com || "").trim(), r.aff ? "Affaire " + String(r.aff).trim() : "",
          r.dem ? "Demandeur " + String(r.dem).trim() : ""].filter(Boolean).join(" · ");
        if (c && g.com.indexOf(c) < 0) g.com.push(c);
        if (r.j != null) g.dates.push(isoDay(jourAncien(cal.a, r.j)));
        if (+r.n) g.nb = Math.max(g.nb, +r.n);
      });
      info.rel = Object.keys(parDT).length;
      Object.values(parDT).forEach(g => {
        const hits = hitsAncien(idx, g.ref, dom, g.dates);
        if (!hits){ abs.push({ ref:g.ref, service }); return; }
        /* une catégorie qui ne retire pas le KO l'emporte sur une qui le retire */
        const bad = g.cats.find(c => SANS.indexOf(c) >= 0), good = g.cats.find(c => SANS.indexOf(c) < 0);
        const cat = bad ? bad : (good || "autre");
        /* une DT qui traîne revient sur plusieurs relevés : on garde ce qui a été
           écrit, les trois derniers jours, pas un paragraphe */
        const gard = g.com.slice(-3), com = gard.join(" · ") +
          (g.com.length > gard.length ? " · +" + n0(g.com.length - gard.length) + " autre" + sPl(g.com.length - gard.length) : "");
        const txt = coupe("Relevé : " + (CAT[cat] ? CAT[cat].l : cat) + (com ? " — " + com : ""), 170);
        const r = placeAncien(plan, couv, notes, hits, { ref:g.ref, cat, src:"releve", d:"", com,
          st:bad ? "rejet" : "ok" }, g.nb, txt);
        deja += r.deja; reporte += r.reporte; refait += r.refait;
        if (r.pose || r.reporte || r.refait) info.relOk++;
      });
    }
  }

  /* ---- le compte rendu, tiré du plan lui-même ---- */
  const just = Object.values(plan).flat();
  const ko = just.reduce((s, l) => s + l.nb, 0);
  const ret = just.filter(l => l.st === "ok").reduce((s, l) => s + l.nb, 0);
  const lus = Object.values(lu).reduce((s, i) => s + i.cause + i.rel, 0);
  if (!just.length && !reporte){
    out.innerHTML = '<div class="note" style="margin-top:12px;border-left-color:' +
      (refait || deja ? "var(--good)" : "var(--crit)") + '">' + (refait || deja
        ? "<b>Ce fichier est déjà repris.</b> Ses " + n0(lus) + " saisies sont en place ici, " +
          n0(refait) + " retrouvée" + sPl(refait) + " à l'identique. " +
          "Rien à ajouter : vous pouvez le redéposer autant de fois que vous voulez, il ne comptera jamais deux fois."
        : "<b>Aucune saisie reprise.</b> Le fichier est bien celui de l'ancien suivi, mais aucune de ses " +
          n0(abs.length) + " références ne correspond à un KO chargé ici. " +
          "Importez d'abord les exports PowerBI des semaines concernées.") + "</div>";
    ancienDraft = null; return;
  }
  const hors = ko - ret;
  const cnt = {}; just.forEach(l => cnt[l.cat] = (cnt[l.cat] || 0) + l.nb);
  const cells = new Set(Object.keys(plan).concat(Object.keys(notes)));
  const per = {}; cells.forEach(id => { const c = S.cells[id];
    per[c.site + "/" + c.service] = (per[c.site + "/" + c.service] || 0) + 1; });
  const absP = {}; abs.forEach(a => absP[a.service] = (absP[a.service] || 0) + 1);
  ancienDraft = { plan, notes, ko, ret, reporte, n:just.length };

  out.innerHTML = '<div class="note" style="margin:12px 0 10px;border-left-color:var(--good)">' +
    "<b>Sauvegarde de l'ancien suivi reconnue</b> — " +
    Object.entries(lu).map(([s, i]) => SERVS[s].l.toLowerCase() + " : " + n0(i.causeOk) + "/" + n0(i.cause) +
      " cause" + sPl(i.cause) + " retrouvée" + sPl(i.causeOk) +
      (i.rel ? ", " + n0(i.relOk) + "/" + n0(i.rel) + " DT de relevé" : "")).join(" · ") +
    (Object.keys(doms).length ? ", sur " + esc([...new Set(Object.values(doms))].map(s => SITES[s].l).join(" et ")) : "") + "." +
    '<div class="muted" style="margin-top:5px">À reprendre : <b>' + n0(just.length) + " justification" + sPl(just.length) +
    "</b> pour <b>" + n0(ko) + " KO</b>" +
    (reporte ? ", et <b>" + n0(reporte) + " saisie" + sPl(reporte) + "</b> reportée" + sPl(reporte) +
      " sur la justification déjà en place" : "") +
    " — sur " + n0(cells.size) + " période" + sPl(cells.size) + ", " +
    esc(Object.entries(per).map(([k, v]) => { const [si, se] = k.split("/");
      return SITES[si].l + " · " + SERVS[se].l + " (" + n0(v) + ")"; }).join(", ")) + ".</div>" +
    (just.length ? '<div class="muted" style="margin-top:5px">' +
      Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => (CAT[k] ? CAT[k].l : k) + " " + n0(v)).join(" · ") +
    "</div>" : "") +
    (an ? '<div class="muted" style="margin-top:5px">Les relevés ne portaient qu\'un rang de jour sans l\'année : lue sur <b>' +
      an.a + "</b>, celle qui place " + n0(an.n) + " de leurs DT à moins de deux jours du KO qu'elles justifient.</div>" : "") +
    "</div>" +
    (deja
      ? '<div class="note" style="margin-bottom:10px"><b>' + n0(deja) + " KO de ce fichier " + (deja > 1 ? "portent" : "porte") +
        " déjà une justification ici</b> — une règle automatique, ou une saisie faite depuis. " +
        (deja > 1 ? "Elles restent" : "Elle reste") + " en place : un KO ne se justifie pas deux fois, et le taux ne bouge donc pas pour " +
        (deja > 1 ? "ceux-là" : "celui-là") + "." +
        (reporte ? " Ce que vous aviez écrit n'est pas perdu pour autant : " + n0(reporte) + " de ces saisies " +
          (reporte > 1 ? "viennent s'inscrire" : "vient s'inscrire") + " sur la justification en place — catégorie, commentaire, affaire, demandeur — " +
          "pour que vous les retrouviez sur la fiche de la demande." : "") +
        " C'est aussi ce qui permet de rejouer cette reprise sans rien compter en double.</div>"
      : "") +
    (hors
      ? '<div class="note" style="margin-bottom:10px"><b>' + n0(hors) + " KO</b> " + (hors > 1 ? "arrivent" : "arrive") +
        " dans une catégorie qui ne retire pas le KO (" + esc(SANS.map(k => CAT[k].l).join(", ")) +
        ") : la saisie reste visible sur la fiche, le taux net ne bouge pas. Les " + n0(ret) +
        " autres comptent dans le net.</div>"
      : "") +
    (Object.keys(inconnues).length
      ? '<div class="note" style="margin-bottom:10px;border-left-color:var(--warn)"><b>' +
        n0(Object.keys(inconnues).length) + " libellé" + sPl(Object.keys(inconnues).length) +
        " sans équivalent ici</b>, repris en « Autre — justifié », le libellé d'origine gardé dans le commentaire : " +
        esc(Object.entries(inconnues).map(([l, n]) => l + " (" + n0(n) + ")").join(", ")) + "</div>"
      : "") +
    (abs.length
      ? '<div class="note" style="margin-bottom:10px;border-left-color:var(--warn)"><b>' + n0(abs.length) +
        " référence" + sPl(abs.length) + " sans KO correspondant</b> — " +
        (abs.length > 1 ? "elles ne sont pas ajoutées" : "elle n'est pas ajoutée") +
        " : une saisie pose une cause, elle n'invente pas de flux. " +
        esc(abs.slice(0, 10).map(a => a.ref).join(", ")) + (abs.length > 10 ? "…" : "") +
        '<div class="muted" style="margin-top:5px">' +
        esc(Object.entries(absP).map(([s, n]) => SERVS[s].l + " : " + n0(n)).join(" · ")) +
        ". Le plus souvent : la semaine n'est pas importée, ou la demande n'est pas en retard dans l'export.</div></div>"
      : "") +
    '<div class="actions"><button class="btn pri" id="btn-apply-ancien">Reprendre ' +
    (just.length ? "ces " + n0(just.length) + " justification" + sPl(just.length) : "") +
    (just.length && reporte ? ", reporter les " + n0(reporte) + " autres saisies" :
      reporte ? "ces " + n0(reporte) + " saisies" : "") +
    "</button>" +
    '<span class="muted" style="font-size:12px">Rien n\'est remplacé : vos saisies et vos règles restent en place.</span></div>';
  $("#btn-apply-ancien").addEventListener("click", applyAncien);
}
async function applyAncien(){
  if (!ancienDraft) return;
  const g = ancienDraft;
  const ids = new Set(Object.keys(g.plan).concat(Object.keys(g.notes)));
  const out = [...ids].map(cid => {
    const c = S.cells[cid]; if (!c) return null;
    /* le texte d'une saisie dont le KO est déjà justifié rejoint la justification
       en place — une seule fois par référence, et jamais deux fois la même */
    const pat = g.notes[cid] || {}, fait = new Set();
    const lignes = (c.lignes || []).map(l => {
      const r = String(l.ref), t = pat[r];
      if (!t || fait.has(r)) return l;
      fait.add(r);
      const c0 = String(l.com || "");
      if (c0.indexOf(t) >= 0) return l;
      return Object.assign({}, l, { com: (c0 ? c0 + " · " : "") + t });
    }).concat(g.plan[cid] || []);
    return Object.assign({}, c, { lignes });
  }).filter(Boolean);
  await bulkPut(out);
  $("#imp-out").innerHTML = '<div class="note" style="margin-top:12px;border-left-color:var(--good)"><b>' +
    (g.n ? n0(g.n) + " justification" + sPl(g.n) + " reprise" + sPl(g.n) : "Reprise faite") + "</b> sur " +
    n0(out.length) + " période" + sPl(out.length) +
    (g.n ? " — " + n0(g.ret) + " KO " + (g.ret > 1 ? "comptent" : "compte") + " dans le taux net" : "") +
    (g.reporte ? ", et " + n0(g.reporte) + " saisie" + sPl(g.reporte) + " reportée" + sPl(g.reporte) +
      " sur la justification qui couvrait déjà le KO" : "") +
    ". Tout cela se lit sur la fiche de chaque demande et dans les retards qualifiés, " +
    "au même titre que vos autres saisies.</div>";
  toast(n0(g.ko + g.reporte) + " retards repris de l'ancien suivi");
  ancienDraft = null;
}
async function importJson(txt){
  const out = $("#imp-out"); if (out) out.innerHTML = "";
  let o; try { o = JSON.parse(txt); } catch(e){ toast("JSON illisible", true); return; }
  /* Une sauvegarde de l'ancien outil n'a pas de périodes : elle n'a que des
     saisies, à rapprocher des KO déjà chargés. */
  if (estAncien(o)){ analyseAncien(o); return; }
  const list = Array.isArray(o) ? o : (o && Array.isArray(o.cells) ? o.cells : null);
  if (!list){ toast("Format inattendu : il faut { cells: [...] }", true); return; }
  const ok = list.filter(c => c && c.periode && SITES[c.site] && SERVS[c.service]);
  if (!ok.length){ toast("Aucune période valide dans ce fichier", true); return; }
  await bulkPut(ok.map(normCell));
  $("#ta-import").value = "";
  toast(ok.length + " période(s) restaurée(s)");
}
$("#btn-imp-json").addEventListener("click", () => importJson($("#ta-import").value));
$("#file-json").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader(); r.onload = () => importJson(String(r.result)); r.readAsText(f, "utf-8");
  e.target.value = "";
});
$("#btn-reseed").addEventListener("click", async () => {
  const base = seedCells(), list = Object.values(base);
  if (!list.length){ toast("Aucun historique embarqué dans ce fichier", true); return; }
  if (!confirm("Recharger les " + list.length + " périodes d'origine (S27 → S36) ? Les justifications que vous avez ajoutées sur ces périodes seront remplacées.")) return;
  await bulkPut(list);
  toast(list.length + " périodes rechargées");
});
$("#btn-wipe").addEventListener("click", async () => {
  if (!confirm("Effacer toutes les périodes et toutes les justifications ? Exportez d'abord si besoin.")) return;
  for (const id of Object.keys(S.cells)) await dropCell(id);
  toast("Base vidée");
});

/* ---------------------------- base partagée ---------------------------- */
function fbConfig(){
  if (typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) return FIREBASE_CONFIG;
  try { const raw = localStorage.getItem(CFGKEY); if (raw){ const o = JSON.parse(raw); if (o && o.projectId) return o; } } catch(e){}
  return null;
}
const FB_RULES = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /" +
  FB_COLLECTION + "/{document} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}";

/* ------------------- Firestore sans SDK, en REST -------------------
   Le SDK Firebase se charge depuis gstatic.com. Beaucoup de réseaux
   d'entreprise bloquent ce domaine : la page n'a alors aucune base, alors que
   l'API REST de Firestore — sur googleapis.com — suffirait. Ce bloc parle
   directement à cette API : aucun script externe, comme le lecteur XLSX.

   Firestore encode ses valeurs par type (stringValue, mapValue, arrayValue…) ;
   ces deux fonctions traduisent dans les deux sens. Un tableau ne peut toujours
   pas contenir un tableau — pourBase s'en charge en amont. */
function fsEnc(v){
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsEnc) } };
  if (typeof v === "object"){
    const f = {}; for (const k in v) f[k] = fsEnc(v[k]);
    return { mapValue: { fields: f } };
  }
  return { stringValue: String(v) };
}
function fsDec(v){
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return !!v.booleanValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsDec);
  if ("mapValue" in v){
    const o = {}, f = v.mapValue.fields || {};
    for (const k in f) o[k] = fsDec(f[k]);
    return o;
  }
  return null;
}
const fsFields = o => { const f = {}; for (const k in o) f[k] = fsEnc(o[k]); return f; };
const fsObj = d => { const o = {}, f = (d && d.fields) || {}; for (const k in f) o[k] = fsDec(f[k]); return o; };

const REST = { tok:"", exp:0, cfg:null };
function restBase(){
  return "https://firestore.googleapis.com/v1/projects/" + REST.cfg.projectId +
    "/databases/(default)/documents/";
}
/* Session anonyme : le même geste que signInAnonymously, en une requête. */
async function restAuth(){
  if (REST.tok && Date.now() < REST.exp - 60000) return REST.tok;
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" +
    encodeURIComponent(REST.cfg.apiKey), { method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ returnSecureToken:true }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok){
    const e = new Error((j.error && j.error.message) || "auth-failed");
    e.code = (j.error && j.error.message) || "auth-failed";
    if (/ADMIN_ONLY|OPERATION_NOT_ALLOWED/i.test(e.code)) e.code = "auth/operation-not-allowed";
    throw e;
  }
  REST.tok = j.idToken;
  REST.exp = Date.now() + (parseInt(j.expiresIn, 10) || 3600) * 1000;
  return REST.tok;
}
async function restCall(path, opts){
  const tok = await restAuth();
  const r = await fetch(restBase() + path, Object.assign({}, opts, {
    headers: Object.assign({ "Content-Type":"application/json", "Authorization":"Bearer " + tok },
      (opts && opts.headers) || {}) }));
  if (r.status === 404) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok){
    const e = new Error((j.error && j.error.message) || ("HTTP " + r.status));
    e.code = r.status === 403 || r.status === 401 ? "permission-denied"
      : r.status === 400 ? "invalid-argument" : ("http-" + r.status);
    throw e;
  }
  return j;
}
async function restGetAll(){
  const out = [];
  let page = "";
  for (let i = 0; i < 30; i++){
    const j = await restCall(FB_COLLECTION + "?pageSize=300" + (page ? "&pageToken=" + encodeURIComponent(page) : ""));
    if (!j) break;
    (j.documents || []).forEach(d => {
      const id = String(d.name || "").split("/").pop();
      out.push({ id, data: fsObj(d) });
    });
    page = j.nextPageToken || "";
    if (!page) break;
  }
  return out;
}
const restSet = (id, obj) => restCall(FB_COLLECTION + "/" + encodeURIComponent(id),
  { method:"PATCH", body: JSON.stringify({ fields: fsFields(obj) }) });
const restDel = id => restCall(FB_COLLECTION + "/" + encodeURIComponent(id), { method:"DELETE" });

/* Rafraîchissement périodique : le REST n'a pas d'écoute temps réel, on relit
   la collection de loin en loin et après chaque écriture. */
let restTimer = null;
async function restRefresh(){
  try {
    const docs = await restGetAll();
    const m = {};
    /* Le document des réglages d'abord : les périodes qui suivent renvoient aux
       causes qu'il porte. Lu après elles, une cause ajoutée serait perdue. */
    lisReglages(docs.map(x => ({ id:x.id, o:x.data })));
    docs.forEach(({ id, data:o }) => {
      if (id === DOC_REGLES) return;
      if (o && o.periode && SITES[o.site] && SERVS[o.service]){ const c = normCell(o); c.id = id; m[c.id] = c; }
    });
    S.cells = mergeSnapshot(m); saveLocal();
    if (!S.pending && !S.writeErr) setStatus("ok", "Enregistré dans la base");
    if (!afterLoad()) render();
    return true;
  } catch(e){ return false; }
}
async function connectRest(cfg){
  REST.cfg = cfg; REST.tok = ""; REST.exp = 0;
  await restAuth();                                   /* lève si l'auth est refusée */
  const docs = await restGetAll();
  S.backend = "rest"; S.fbAuth = true;
  if (!docs.length){
    for (const c of Object.values(S.cells)){
      try { await restSet(c.id, pourBase(normCell(c))); }
      catch(e){ if (!S.writeErr) writeFail(1, Object.keys(S.cells).length, e); }
    }
  }
  await restRefresh();
  clearInterval(restTimer);
  restTimer = setInterval(() => { if (!S.pending) restRefresh(); }, 60000);
  setStatus("ok", "Enregistré dans la base");
  render();
  return true;
}

/* Ce que le réseau laisse passer, domaine par domaine : de quoi savoir si le
   problème vient du CDN, de l'API, ou des deux — et quoi demander à la DSI. */
async function netProbe(cfg){
  const out = [];
  const essai = async (nom, url, opts) => {
    const t0 = Date.now();
    try { await fetch(url, Object.assign({ cache:"no-store" }, opts || {}));
      out.push({ nom, ok:true, ms:Date.now() - t0 });
    } catch(e){ out.push({ nom, ok:false, err:String(e.message || e).slice(0, 70) }); }
  };
  await essai("gstatic.com — le SDK Firebase",
    "https://www.gstatic.com/firebasejs/" + FIREBASE_SDK_VERSION + "/firebase-app.js");
  await essai("identitytoolkit.googleapis.com — la session",
    "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(cfg.apiKey),
    { method:"POST", headers:{ "Content-Type":"application/json" }, body:"{}" });
  await essai("firestore.googleapis.com — les données",
    "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/(default)/documents/" + FB_COLLECTION + "?pageSize=1");
  return out;
}

async function connectFirebase(cfg){
  S.fbError = "";
  setStatus("busy", "Connexion à la base…");
  const base = "https://www.gstatic.com/firebasejs/" + FIREBASE_SDK_VERSION + "/";
  try {
    if (S.fbUnsub){ try { S.fbUnsub(); } catch(e){} S.fbUnsub = null; }
    let appMod, fsMod;
    try {
      appMod = await import(base + "firebase-app.js");
      fsMod = await import(base + "firebase-firestore.js");
    } catch(e){
      /* CDN bloqué : on parle à Firestore en REST, sans aucun script externe. */
      S.fbSdk = false;
      try { return await connectRest(cfg); }
      catch(e2){ S.fbError = errCode(e2); S.backend = "local"; S.fb = null;
        connectFail(S.fbError); setStatus("local", "Base injoignable — copie locale"); render(); return false; }
    }
    S.fbSdk = true;
    if (appMod.getApps){
      const old = appMod.getApps().find(a => a.name === "brutnet");
      if (old && appMod.deleteApp){ try { await appMod.deleteApp(old); } catch(e){} }
    }
    const app = appMod.initializeApp(cfg, "brutnet");
    try {
      const authMod = await import(base + "firebase-auth.js");
      await authMod.signInAnonymously(authMod.getAuth(app));
      S.fbAuth = true;
    } catch(e){ S.fbAuth = false; S.fbAuthErr = errCode(e); /* les règles trancheront */ }
    const db = fsMod.getFirestore(app);
    const col = fsMod.collection(db, FB_COLLECTION);
    const snap = await fsMod.getDocs(col);
    S.fb = { db, m: fsMod, app }; S.backend = "firebase";
    /* Semis d'une base vide : le document doit passer par pourBase comme
       n'importe quelle autre écriture, sinon un tableau imbriqué fait échouer
       la connexion entière et l'outil se déclare « injoignable ». */
    if (snap.empty){
      for (const c of Object.values(S.cells)){
        try { await fsMod.setDoc(fsMod.doc(db, FB_COLLECTION, c.id), pourBase(normCell(c))); }
        catch(e){ if (!S.writeErr) writeFail(1, Object.keys(S.cells).length, e); }
      }
    }
    S.fbUnsub = fsMod.onSnapshot(col, s => {
      const m = {};
      lisReglages(s.docs ? s.docs.map(d => ({ id:d.id, o:d.data() })) : []);
      s.forEach(d => { const o = d.data();
        if (d.id === DOC_REGLES) return;
        if (o && o.periode && SITES[o.site] && SERVS[o.service]){ const c = normCell(o); c.id = d.id; m[c.id] = c; } });
      S.cells = mergeSnapshot(m); saveLocal();
      if (!S.pending && !S.writeErr) setStatus("ok", "Enregistré dans la base");
      if (!afterLoad()) render();
    }, err => {
      S.fbError = errCode(err); S.backend = "local"; S.fb = null;
      setStatus("local", "Base interrompue — copie locale"); render();
    });
    setStatus("ok", "Enregistré dans la base");
    render();
    return true;
  } catch(e){
    /* l'échec de l'authentification explique souvent le refus qui suit */
    S.fbError = (S.fbAuth === false && S.fbAuthErr) ? S.fbAuthErr : errCode(e);
    S.backend = "local"; S.fb = null;
    connectFail(S.fbError);
    setStatus("local", "Base injoignable — copie locale"); render();
    return false;
  }
}
function bindFb(){
  const c = $("#fb-connect"); if (!c) return;
  c.addEventListener("click", async () => {
    let o;
    try {
      const raw = $("#fb-cfg").value.trim().replace(/^const\s+\w+\s*=\s*/, "").replace(/;\s*$/, "");
      o = JSON.parse(raw.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"'));
    } catch(e){ toast("Configuration illisible — collez l'objet firebaseConfig complet", true); return; }
    if (!o || !o.projectId || !o.apiKey){ toast("Il manque apiKey ou projectId", true); return; }
    try { localStorage.setItem(CFGKEY, JSON.stringify(o)); } catch(e){}
    const ok = await connectFirebase(o);
    $("#fb-out").innerHTML = ok
      ? '<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>Base jointe.</b> ' + n0(Object.keys(S.cells).length) + " période(s) synchronisée(s).</div>"
      : '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Connexion impossible.</b> ' + esc(S.fbError) +
        "<br>À vérifier : Firestore créé, authentification <b>anonyme</b> activée, et règles posées sur la collection <code>" + FB_COLLECTION + "</code>.</div>";
  });
  $("#fb-line").addEventListener("click", () => {
    const cfg = fbConfig();
    if (!cfg){ toast("Connectez d'abord une configuration", true); return; }
    openModal('<div class="ph"><h2>À coller dans index.html</h2><span class="sub">Remplacez la ligne <code>const FIREBASE_CONFIG = null;</code> par celle-ci</span></div>' +
      '<div class="pb"><textarea rows="11" id="dl-ta"></textarea><div class="actions"><button class="btn pri" id="dl-copy">Copier</button><button class="btn" id="dl-close">Fermer</button></div>' +
      '<div class="note" style="margin-top:14px">Ces clés sont publiques par conception : elles identifient le projet, elles ne l\'ouvrent pas. Ce sont les règles Firestore qui décident qui écrit.</div></div>');
    $("#dl-ta").value = "const FIREBASE_CONFIG = " + JSON.stringify(cfg, null, 2) + ";";
    $("#dl-close").addEventListener("click", closeModal);
    $("#dl-copy").addEventListener("click", () => { $("#dl-ta").select(); try { document.execCommand("copy"); toast("Copié"); } catch(e){} });
  });
  $("#fb-rules").addEventListener("click", () => {
    openModal('<div class="ph"><h2>Règles Firestore</h2><span class="sub">Console Firebase → Firestore Database → Règles</span></div>' +
      '<div class="pb"><textarea rows="10" id="dl-ta"></textarea><div class="actions"><button class="btn pri" id="dl-copy">Copier</button><button class="btn" id="dl-close">Fermer</button></div>' +
      '<div class="note" style="margin-top:14px"><b>Avant de poser de vrais chiffres.</b> Ces règles exigent une session, mais toute personne qui ouvre la page en obtient une : elles écartent les robots, pas quelqu\'un à qui on a donné le lien. Pour des données d\'exploitation réelles, faites valider l\'hébergement en interne, ou gardez la page publique pour la démonstration et le suivi réel sur un espace fermé.</div></div>');
    $("#dl-ta").value = FB_RULES;
    $("#dl-close").addEventListener("click", closeModal);
    $("#dl-copy").addEventListener("click", () => { $("#dl-ta").select(); try { document.execCommand("copy"); toast("Copié"); } catch(e){} });
  });
  $("#fb-push").addEventListener("click", async () => {
    if (S.backend !== "firebase"){ toast("Connectez d'abord la base", true); return; }
    const local = loadLocal();
    if (!local || !Object.keys(local).length){ toast("Aucune donnée locale à envoyer", true); return; }
    await bulkPut(Object.values(local));
    toast(Object.keys(local).length + " période(s) envoyée(s)");
  });
  /* Dire, sous le champ, exactement ce que le plancher met de côté. Une donnée
     qu'on ne voit plus sans savoir pourquoi passe vite pour une donnée perdue. */
  window.majPlancherHint = function(){
    const h = $("#opt-plancher-h");
    if (!h) return;
    const hs = horsPlancher();
    if (!S.plancher){ h.textContent = "tout l'historique enregistré est affiché"; return; }
    const ks = Array.from(new Set(hs.map(c => c.periode))).sort();
    h.innerHTML = hs.length
      ? "les semaines d'avant restent enregistrées et justifiées, sans être affichées — <b>" +
        n0(ks.length) + " semaine" + sPl(ks.length) + "</b> de côté" +
        (ks.length ? " (" + esc(perLabel(ks[0])) + (ks.length > 1 ? " → " + esc(perLabel(ks[ks.length - 1])) : "") + ")" : "")
      : "aucune période enregistrée n'est antérieure à cette date";
  };
  const ci = $("#opt-cible");
  if (ci){
    ci.value = S.cible;
    ci.addEventListener("change", () => {
      const v = Math.max(50, Math.min(100, +ci.value || 99));
      S.cible = v; ci.value = v;
      try { localStorage.setItem(LSCIBLE, String(v)); } catch(e){}
      render(); toast("Cible à " + dec(v, 0) + " %");
    });
  }
  /* Le plancher ne supprime rien : il décide seulement de ce que le tableau de
     bord montre. Le compte des semaines mises de côté est affiché sous le champ
     pour qu'on ne se demande jamais où sont passées les données. */
  const pl = $("#opt-plancher");
  if (pl){
    pl.value = S.plancher || "";
    majPlancherHint();
    pl.addEventListener("change", () => {
      const v = /^\d{4}-\d{2}-\d{2}$/.test(pl.value) ? pl.value : "";
      S.plancher = v; pl.value = v;
      try {
        if (v) localStorage.setItem(LSPLANCHER, v);
        else localStorage.removeItem(LSPLANCHER);
      } catch(e){}
      Object.assign(S.ui, { preset:"all", from:null, to:null, d1:null, d2:null });
      syncSegs(); majPlancherHint(); render();
      toast(v ? "Tableau de bord à partir du " + frDay(v) : "Tableau de bord sur tout l'historique");
    });
  }
  const bnet = $("#fb-net");
  if (bnet) bnet.addEventListener("click", async () => {
    const cfg = fbConfig();
    if (!cfg){ toast("Aucune configuration à tester", true); return; }
    const out = $("#fb-out");
    out.innerHTML = '<div class="note" style="margin-top:14px">Test en cours…</div>';
    const r = await netProbe(cfg);
    const bloques = r.filter(x => !x.ok);
    out.innerHTML = '<div class="note" style="margin-top:14px;border-left-color:' +
      (bloques.length ? "var(--warn)" : "var(--good)") + '"><b>' +
      (bloques.length ? n0(bloques.length) + " domaine(s) bloqué(s) sur 3" : "Les trois domaines répondent") + "</b>" +
      '<div class="facts" style="margin-top:9px;border-radius:8px;border:1px solid var(--line)">' +
      r.map(x => '<div class="fact"><span class="k">' + esc(x.nom) + '</span><span class="v">' +
        (x.ok ? '<span class="pill manuel">joignable</span> <span class="muted">' + x.ms + " ms</span>"
              : '<span class="pill rejet">bloqué</span>') + "</span></div>").join("") + "</div>" +
      (bloques.length
        ? '<div class="muted" style="margin-top:9px;font-size:12px">À demander à la DSI : autoriser ' +
          esc(bloques.map(x => x.nom.split(" —")[0]).join(", ")) + ". " +
          (r[0] && !r[0].ok && r[1] && r[1].ok && r[2] && r[2].ok
            ? "<b>Seul le CDN est bloqué</b> : l\'outil sait s\'en passer, il parle directement à l\'API Firestore."
            : "") + "</div>"
        : '<div class="muted" style="margin-top:9px;font-size:12px">Si la base reste injoignable, la cause est ailleurs : règles Firestore, ou authentification anonyme non activée.</div>') +
      "</div>";
  });
  $("#fb-forget").addEventListener("click", () => {
    try { localStorage.removeItem(CFGKEY); } catch(e){}
    if (S.fbUnsub){ try { S.fbUnsub(); } catch(e){} S.fbUnsub = null; }
    clearInterval(restTimer);
    S.fb = null; S.backend = "local"; S.fbError = "";
    setStatus("local", "Enregistré sur ce navigateur");
    $("#fb-out").innerHTML = "";
    toast("Configuration oubliée sur ce navigateur"); render();
  });
}
bindFb();

/* ---------------------------- mode d'emploi ---------------------------- */
$$(".codeblk[data-copy]").forEach(el => {
  const txt = el.textContent.replace(/\s+$/, "");
  const b = document.createElement("button");
  b.className = "btn sm cp"; b.type = "button"; b.textContent = "Copier";
  b.addEventListener("click", () => {
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(txt)
        .then(() => toast(el.classList.contains("rl") ? "Prompt copié" : "Format copié"))
        .catch(() => toast("Copie impossible", true));
    else toast("Copie impossible sur ce navigateur", true);
  });
  el.appendChild(b);
});
/* ---------------- aller-retour Excel avec l'exploitation ---------------- */
const XLS_CAUSES = CATS.filter(c => c.j).map(c => c.l);
function ajList(){
  const all = toQualify();
  return (S.ui.qscope ? all.filter(r => r.cell.id === S.ui.qscope) : all)
    .slice().sort((a, b) => b.n - a.n || a.cell.periode.localeCompare(b.cell.periode));
}
/* Une ligne par poste quand les postes sont connus — l'exploitation peut alors
   donner une cause différente à chaque poste d'une même demande. Sinon une ligne
   par demande, et la colonne « KO à justifier » se réduit pour n'en traiter
   qu'une partie. */
function ajRows(list){
  const out = [];
  list.forEach(r => {
    const base = [frDay(r.d), perLabel(r.cell.periode) + " (" + weekSpan(r.cell.periode) + ")",
      SITES[r.cell.site].l, SERVS[r.cell.service].l];
    if (r.postes.length){
      r.postes.forEach(p => out.push([r.ref, p, 1].concat(base, ["", "", r.cell.id])));
      const sansPoste = r.n - r.postes.length;
      if (sansPoste > 0) out.push([r.ref, "", sansPoste].concat(base, ["", "", r.cell.id]));
    } else {
      out.push([r.ref, "", r.n].concat(base, ["", "", r.cell.id]));
    }
  });
  return out;
}
$("#btn-xls-out").addEventListener("click", async () => {
  const list = ajList();
  if (!list.length){ toast("Rien à faire justifier sur ce périmètre", true); return; }
  const head = ["Référence", "Poste", "KO à justifier", "Date", "Période", "Site", "Service",
                "Cause", "Commentaire", "Clé — ne pas modifier"];
  const body = ajRows(list);
  const rows = [head].concat(body);
  const buf = xlsxBuild([
    { name:"À justifier", rows, opts:{ widths:[16, 9, 13, 12, 22, 14, 15, 26, 44, 24],
      validation:{ col:7, from:"Causes", n:XLS_CAUSES.length, rows:rows.length - 1 } } },
    { name:"Causes", rows:[["Causes possibles"]].concat(XLS_CAUSES.map(c => [c])), opts:{ widths:[32] } }
  ]);
  const name = "retards-a-justifier-" + stamp() + ".xlsx";
  await offerFile(name, buf);
  const avecPoste = body.filter(r => r[1]).length;
  $("#xls-out-hint").textContent = n0(body.length) + " lignes · " + n0(list.reduce((s, r) => s + r.n, 0)) + " KO" +
    (avecPoste ? " · " + n0(avecPoste) + " au poste" : "");
});
/* --------- Excel des retards déjà justifiés ---------
   Reprend exactement ce que le registre affiche : plage de périodes, filtres et
   tri compris. Une ligne par justification, le détail des postes en clair. */
$("#btn-xls-just").addEventListener("click", async () => {
  const list = regList || [];
  if (!list.length){ toast("Aucune justification sur ce filtre", true); return; }
  const head = ["Date du flux", "Jour", "Période", "Site", "Service", "Référence", "Postes",
                "Opérateur", "Cause", "Justifie le net", "KO retirés", "Source", "Statut", "Commentaire"];
  const rows = [head].concat(list.map(({ c, l }) => {
    const d = l.d || dateOfRef(c, l.ref);
    return [ frDay(d), d ? frWeekday(d) : "", perLabel(c.periode) + " (" + weekSpan(c.periode) + ")",
      SITES[c.site].l, SERVS[c.service].l,
      l.ref || "lot", (l.postes || []).join(", "),
      opsRef(c, l.ref, l.postes).join(", "),
      CAT[l.cat] ? CAT[l.cat].l : l.cat, (CAT[l.cat] && CAT[l.cat].j) ? "oui" : "non",
      l.st === "ok" ? l.nb : 0, SRC[l.src] || l.src,
      l.st === "rejet" ? "KO maintenu" : "KO retiré", l.com || "" ];
  }));
  /* une ligne de total, pour que le fichier se défende tout seul */
  const tot = list.reduce((s, x) => s + (x.l.st === "ok" ? x.l.nb : 0), 0);
  rows.push([]);
  rows.push(["Total", "", rangeLabel(), "", "", "", "", "", "", "", tot, "", "", n0(list.length) + " justification(s)"]);
  const buf = xlsxBuild([
    { name:"Retards justifiés", rows, opts:{ widths:[13, 11, 22, 13, 14, 15, 14, 13, 24, 14, 11, 13, 11, 46] } }
  ]);
  const per = rangeKeys();
  const bornes = per.length ? per[0].replace(/-/g, "") + "-" + per[per.length - 1].replace(/-/g, "") : stamp();
  await offerFile("retards-justifies-" + bornes + ".xlsx", buf);
  toast(n0(list.length) + " lignes exportées");
});

let xlsDraft = null;
const normLbl = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const CAUSE_BY_LABEL = (() => { const m = {}; CATS.forEach(c => { m[normLbl(c.l)] = c.k; }); return m; })();
async function readFilled(file){
  const out = $("#xls-in-out");
  let rows;
  try {
    if (/\.xlsx$/i.test(file.name)) rows = await xlsxRead(await file.arrayBuffer());
    else rows = parseTable(await file.text());
  } catch(e){
    out.innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Fichier illisible.</b> ' +
      esc(e && e.message ? e.message : "") + " Réenregistrez-le au format .xlsx, ou en CSV.</div>";
    return;
  }
  if (!rows || rows.length < 2){ out.innerHTML = '<div class="note" style="margin-top:14px">Le fichier ne contient aucune ligne.</div>'; return; }
  const heads = rows[0].map(normLbl);
  const ci = {
    ref: heads.findIndex(h => h.indexOf("reference") === 0),
    ko: (() => { const i = heads.findIndex(h => h.indexOf("ko a justifier") === 0); return i >= 0 ? i : heads.findIndex(h => h === "ko"); })(),
    poste: heads.findIndex(h => h.indexOf("poste") === 0),
    cause: heads.findIndex(h => h.indexOf("cause") === 0),
    com: heads.findIndex(h => h.indexOf("commentaire") === 0),
    cle: heads.findIndex(h => h.indexOf("cle") === 0)
  };
  if (ci.ref < 0 || ci.cause < 0 || ci.cle < 0){
    out.innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--crit)"><b>Ce n\'est pas le fichier généré par l\'outil.</b> Il faut les colonnes <i>Référence</i>, <i>Cause</i> et <i>Clé</i>. Regénérez-le à l\'étape 1.</div>';
    return;
  }
  const plan = {}, res = { lues:0, remplies:0, inconnues:{}, horsBase:0, ok:0, ecart:0, auPoste:0 };
  for (let i = 1; i < rows.length; i++){
    const r = rows[i];
    const ref = sansZeros(r[ci.ref]);
    if (!ref) continue;
    res.lues++;
    const lbl = String(r[ci.cause] == null ? "" : r[ci.cause]).trim();
    if (!lbl) continue;
    res.remplies++;
    const cat = CAUSE_BY_LABEL[normLbl(lbl)];
    if (!cat){ res.inconnues[lbl] = (res.inconnues[lbl] || 0) + 1; continue; }
    const cid = String(r[ci.cle] == null ? "" : r[ci.cle]).trim();
    const c = S.cells[cid];
    if (!c){ res.horsBase++; continue; }
    const poste = ci.poste >= 0 ? sansZeros(r[ci.poste]) : "";
    let n = Math.max(1, +String(r[ci.ko] == null ? 1 : r[ci.ko]).replace(",", ".") || 1);
    if (poste) n = 1;                       /* une ligne au poste vaut un KO */
    const com = ci.com >= 0 ? String(r[ci.com] == null ? "" : r[ci.com]).trim().slice(0, 220) : "";
    if (CAT[cat].j) res.ok++; else res.ecart++;
    if (poste) res.auPoste++;
    (plan[cid] = plan[cid] || []).push({ ref, poste, cat, nb:n, com });
  }
  xlsDraft = { plan, res };
  const nCells = Object.keys(plan).length;
  const gain = Object.values(plan).reduce((s, l) => s + l.filter(x => CAT[x.cat].j).reduce((t, x) => t + x.nb, 0), 0);
  const inc = Object.keys(res.inconnues);
  out.innerHTML = '<div class="note" style="margin:16px 0 12px"><b>' + n0(res.remplies) + " ligne(s) remplie(s)</b> sur " +
    n0(res.lues) + " · <b>" + n0(gain) + " KO</b> sortiraient du décompte sur " + nCells + " période(s)." +
    (res.auPoste ? " " + n0(res.auPoste) + " au poste près." : "") +
    (res.ecart || inc.length || res.horsBase
      ? '<div class="muted" style="margin-top:5px">' +
        (res.ecart ? n0(res.ecart) + " en cause qui ne retire pas le KO (gardées pour la trace) · " : "") +
        (inc.length ? inc.length + " libellé(s) non reconnu(s) : " + esc(inc.slice(0, 4).join(", ")) + " · " : "") +
        (res.horsBase ? n0(res.horsBase) + " sur des périodes absentes de l'outil" : "") + "</div>"
      : "") + "</div>" +
    (nCells ? '<div class="actions"><button class="btn pri big" id="btn-xls-apply">Intégrer ces justifications</button>' +
      '<span class="muted" style="font-size:12px">Enregistrées comme «&nbsp;relevé&nbsp;» — elles comptent dans le documenté.</span></div>'
      : '<div class="note" style="border-left-color:var(--warn)">Aucune ligne exploitable : vérifiez que la colonne <i>Cause</i> a bien été remplie.</div>');
  if (nCells) $("#btn-xls-apply").addEventListener("click", applyFilled);
}
async function applyFilled(){
  if (!xlsDraft) return;
  const out = Object.entries(xlsDraft.plan).map(([cid, items]) => {
    const c = S.cells[cid];
    /* les lignes au poste ne remplacent que leur poste ; celles sans poste
       remplacent la qualification par quantité de la même référence */
    const vises = {}, refsSansPoste = [];
    items.forEach(i => { if (i.poste) vises[String(i.ref) + " " + i.poste] = 1; else refsSansPoste.push(String(i.ref)); });
    const add = items.map(i => ({ id:uid(), ref:String(i.ref), postes: i.poste ? [i.poste] : [],
      cat:i.cat, nb:i.nb, src:"releve", com:i.com,
      d: dateOfRef(c, i.ref), st: CAT[i.cat].j ? "ok" : "rejet" }));
    const gard = l => {
      if (!l.ref) return true;
      const r = String(l.ref), ps = (l.postes || []).map(String);
      if (ps.length) return !ps.some(p => vises[r + " " + p]);
      return refsSansPoste.indexOf(r) < 0;
    };
    return Object.assign({}, c, { lignes: c.lignes.filter(gard).concat(add) });
  });
  const gain = Object.values(xlsDraft.plan).reduce((s, l) => s + l.filter(x => CAT[x.cat].j).reduce((t, x) => t + x.nb, 0), 0);
  await bulkPut(out);
  $("#xls-in-out").innerHTML = '<div class="note" style="margin-top:14px;border-left-color:var(--good)"><b>' + n0(gain) +
    " KO intégrés.</b> Ils apparaissent dans l'onglet <i>Retards qualifiés</i>.</div>";
  toast(n0(gain) + " KO intégrés"); xlsDraft = null;
}
$("#file-xls-in").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  readFilled(f); e.target.value = "";
});

/* ---------------------------- éditeur de règle ----------------------------
   Trois formes, un seul écran : on choisit la forme, on remplit, et l'aperçu
   dit combien de KO la règle prendrait avant d'enregistrer quoi que ce soit. */
function optCols(sel){
  return ctxColonnes().map(c => '<option value="' + esc(c) + '"' + (c === sel ? " selected" : "") + ">" + esc(c) + "</option>").join("");
}
/* Les colonnes de date seulement : un écart entre « Activité » et « Priorité »
   n'a pas de sens, autant ne pas le proposer. */
function colsDate(){
  const d = ctxColonnes().filter(c => ctxKind(c) === "date");
  return d.length ? d : ctxColonnes();
}
function optDates(sel){
  return colsDate().map(c => '<option value="' + esc(c) + '"' + (c === sel ? " selected" : "") + ">" + esc(c) + "</option>").join("");
}
/* Une condition à qui il manque sa valeur : « est » sans rien à comparer ne
   prend aucun KO. On le dit plutôt que de rendre « 0 KO » sans explication. */
function condIncomplete(c){
  const o = OPS_COL.find(x => x.k === c.op);
  return !c.col || (o && o.val && !String(c.val || "").trim());
}
function regleIncomplete(r){
  if (!r.nom) return "Donnez un nom à la règle.";
  if (r.type === "liste") return (r.refs || []).length ? "" : "Collez au moins une référence.";
  if (r.type === "colonne" && !(r.conds || []).length) return "Ajoutez au moins une condition.";
  if (r.type === "dates" && (!r.dateA || !r.dateB))
    return "Choisissez les deux colonnes de date.";
  if (r.type === "dates" && r.dateA === r.dateB)
    return "Les deux dates sont la même colonne : l'écart vaudrait toujours zéro.";
  const mauvaise = (r.conds || []).findIndex(condIncomplete);
  if (mauvaise >= 0){
    const c = r.conds[mauvaise];
    return "La condition sur « " + (c.col || "?") + " » attend une valeur à comparer" +
      (r.type === "dates" ? " — retirez-la si vous n'en voulez pas." : ".");
  }
  return "";
}
/* Le menu des causes, avec vos ajouts à part et, en dernier, de quoi en créer
   une sans quitter la règle qu'on est en train d'écrire. */
const OPT_NEW = "__new";
function optCauses(service, sel, sansAjout){
  const vis = c => c.p === "tous" || c.p === service || service === "tous";
  const opt = c => '<option value="' + c.k + '"' + (c.k === sel ? " selected" : "") + ">" +
    esc(c.l) + (c.j ? "" : " — le KO reste compté") + "</option>";
  const four = CATS.filter(c => vis(c) && !c.mien), mien = CATS.filter(c => vis(c) && c.mien);
  return '<optgroup label="Causes de l\'outil">' + four.map(opt).join("") + "</optgroup>" +
    (mien.length ? '<optgroup label="Vos causes">' + mien.map(opt).join("") + "</optgroup>" : "") +
    (sansAjout ? "" : '<optgroup label="—"><option value="' + OPT_NEW + '">＋ Ajouter une cause…</option></optgroup>');
}
/* Le petit formulaire de création. Trois champs, dont un seul demande à
   réfléchir : est-ce que cette cause retire le retard du net, ou est-ce qu'elle
   l'explique sans l'effacer ? */
function modalCause(perim, apres, depart){
  openModal('<div class="ph"><h2>Ajouter une cause</h2>' +
    '<span class="sub">Elle rejoint la liste et sert partout — règles, relevés, saisie</span></div>' +
    '<div class="pb">' +
    '<div class="form"><div class="f wide"><label for="nc-lib">Nom de la cause</label>' +
      '<input type="text" id="nc-lib" maxlength="60" value="' + esc(depart || "") + '" placeholder="ex. Fermeture de zone"></div>' +
      '<div class="f"><label for="nc-per">Service concerné</label><select id="nc-per">' +
        '<option value="tous"' + (perim === "tous" || !perim ? " selected" : "") + ">Les deux</option>" +
        '<option value="distri"' + (perim === "distri" ? " selected" : "") + ">Distribution</option>" +
        '<option value="recep"' + (perim === "recep" ? " selected" : "") + ">Réception</option></select></div></div>" +
    '<div class="flab" style="margin-top:16px">Ce qu\'elle fait au chiffre</div>' +
    '<div class="cgrid" style="margin-top:8px">' +
      '<button class="cbtn on" id="nc-oui" data-j="1">Elle justifie le retard' +
        "<small>le KO sort du décompte : il est expliqué, pièce ou analyse à l'appui</small></button>" +
      '<button class="cbtn" id="nc-non" data-j="0">Elle l\'explique seulement' +
        "<small>le KO reste compté : on sait pourquoi, mais il pèse quand même</small></button>" +
    "</div>" +
    '<div class="f wide" style="margin-top:14px"><label for="nc-note">Précision, si besoin</label>' +
      '<input type="text" id="nc-note" maxlength="200" placeholder="à quoi la reconnaît-on ? (facultatif)"></div>' +
    '<div id="nc-out"></div></div>' +
    '<div class="wfoot"><button class="btn" data-close>Annuler</button><span class="sp"></span>' +
    '<button class="btn pri" id="nc-ok">Ajouter</button></div>');
  let justifie = true;
  const maj = () => { $("#nc-oui").classList.toggle("on", justifie); $("#nc-non").classList.toggle("on", !justifie); };
  $("#nc-oui").addEventListener("click", () => { justifie = true; maj(); });
  $("#nc-non").addEventListener("click", () => { justifie = false; maj(); });
  setTimeout(() => { const i = $("#nc-lib"); if (i) i.focus(); }, 40);
  $("#nc-ok").addEventListener("click", async () => {
    const lib = $("#nc-lib").value.trim();
    const out = $("#nc-out");
    if (!lib){ out.innerHTML = '<div class="note" style="margin-top:12px;border-left-color:var(--crit)">Il faut un nom.</div>';
      $("#nc-lib").focus(); return; }
    const deja = CATS.find(c => CAT_ALIAS.norm(c.l) === CAT_ALIAS.norm(lib));
    if (deja && !deja.mien){
      out.innerHTML = '<div class="note" style="margin-top:12px;border-left-color:var(--warn)"><b>' +
        esc(deja.l) + "</b> existe déjà dans la liste de l'outil — c'est elle qu'il faut choisir.</div>";
      return;
    }
    const k = await creeCause(lib, $("#nc-per").value, justifie, $("#nc-note").value.trim());
    closeModal();
    toast("Cause « " + lib + " » ajoutée");
    if (typeof apres === "function") apres(k);
    render();
  });
}
function ligneCond(i, c){
  const cols = optCols(c.col);
  return '<div class="form" data-cond="' + i + '" style="margin-bottom:8px">' +
    '<div class="f"><label>Colonne</label><select class="c-col">' + cols + "</select></div>" +
    '<div class="f"><label>Test</label><select class="c-op">' +
      OPS_COL.map(o => '<option value="' + o.k + '"' + (o.k === c.op ? " selected" : "") + ">" + o.l + "</option>").join("") + "</select></div>" +
    '<div class="f"><label>Valeur</label><input type="text" class="c-val" list="rg-vals" value="' + esc(c.val || "") + '" placeholder="laisser vide si le test n\'en demande pas"></div>' +
    (i > 0 ? '<div class="f" style="align-self:end"><button class="btn sm danger" data-condel="' + i + '">Retirer</button></div>' : "") +
    "</div>";
}
function modalRegle(id, preset){
  const dispo = ctxColonnes();
  if (!dispo.length){ toast("Importez d'abord un export : les règles lisent ses colonnes", true); return; }
  const base = preset || S.regles.find(r => r.id === id);
  const dts = colsDate();
  const r = base ? JSON.parse(JSON.stringify(base))
    : { id:uid(), nom:"", actif:true, service:"tous", cause:"irrealisable", src:"auto",
        type:"colonne", conds:[{ col:dispo[0], op:"est", val:"" }],
        dateA:dts[0], dateB:dts[1] || dts[0],
        opD:"le", nD:0, ouvres:true, refs:[] };
  if (!r.conds) r.conds = [];
  /* La forme « colonne » a besoin d'au moins une ligne ; la forme « écart de
     dates » n'en veut aucune par défaut — une ligne vide y exigerait « colonne
     vide » et la règle ne prendrait plus rien. */
  if (r.type === "colonne" && !r.conds.length) r.conds = [{ col:dispo[0], op:"est", val:"" }];

  openModal('<div class="ph"><h2>' + (preset ? "Règle prête à l'emploi" : base ? "Modifier la règle" : "Nouvelle règle") + '</h2>' +
    '<span class="sub">Elle s\'appliquera aux périodes déjà chargées comme aux prochains imports</span></div>' +
    '<div class="pb">' +
    '<div class="form"><div class="f wide"><label for="rg-nom">Nom de la règle</label>' +
      '<input type="text" id="rg-nom" value="' + esc(r.nom) + '" placeholder="ex. Blocage douane terminé"></div>' +
      '<div class="f"><label for="rg-serv">Service concerné</label><select id="rg-serv">' +
        '<option value="tous"' + (r.service === "tous" ? " selected" : "") + ">Les deux</option>" +
        '<option value="distri"' + (r.service === "distri" ? " selected" : "") + ">Distribution</option>" +
        '<option value="recep"' + (r.service === "recep" ? " selected" : "") + ">Réception</option></select></div>" +
      '<div class="f"><label for="rg-type">Forme de la règle</label><select id="rg-type">' +
        '<option value="colonne"' + (r.type === "colonne" ? " selected" : "") + ">Une ou plusieurs colonnes</option>" +
        '<option value="dates"' + (r.type === "dates" ? " selected" : "") + ">Un écart entre deux dates</option>" +
        '<option value="liste"' + (r.type === "liste" ? " selected" : "") + ">Une liste de références</option></select></div></div>" +
    '<datalist id="rg-vals"></datalist>' +
    '<div class="flab" style="margin-top:16px">La condition</div><div id="rg-corps"></div>' +
    '<div class="flab" style="margin-top:16px">Ce qu\'on en fait</div>' +
    '<div class="form"><div class="f"><label for="rg-cause">Cause posée</label><select id="rg-cause"></select></div>' +
      '<div class="f"><label for="rg-src">Ce que vaut la justification</label><select id="rg-src">' +
        '<option value="auto"' + (r.src === "auto" ? " selected" : "") + ">Lue dans les données — appuyée sur une pièce</option>" +
        '<option value="releve"' + (r.src === "releve" ? " selected" : "") + ">Déclarée au relevé — appuyée sur une pièce</option>" +
        '<option value="manuel"' + (r.src === "manuel" ? " selected" : "") + ">Mon analyse — compte dans le net</option></select></div></div>" +
    '<div class="note" id="rg-apercu" style="margin-top:16px">Complétez la règle pour voir son effet.</div>' +
    '<div class="actions"><button class="btn pri big" id="rg-save">Enregistrer la règle</button>' +
      '<button class="btn" id="rg-test">Mesurer l\'effet</button>' +
      '<button class="btn" id="dl-close">Annuler</button></div></div>');

  const corps = $("#rg-corps");
  const dessineCorps = () => {
    if (r.type === "liste"){
      corps.innerHTML = '<p class="gp">Collez les numéros de DT ou de BR, un par ligne. Un numéro suivi d\'un tiret et d\'un poste ne vise que ce poste.</p>' +
        '<textarea id="rg-refs" rows="6" placeholder="7484785&#10;90140105-20">' + esc((r.refs || []).join("\n")) + "</textarea>";
    } else if (r.type === "dates"){
      corps.innerHTML = '<div class="form">' +
        '<div class="f"><label for="rg-da">Première date</label><select id="rg-da">' + optDates(r.dateA) + "</select></div>" +
        '<div class="f"><label for="rg-db">Seconde date</label><select id="rg-db">' + optDates(r.dateB) + "</select></div>" +
        '<div class="f"><label for="rg-opd">L\'écart est</label><select id="rg-opd">' +
          OPS_ECART.map(o => '<option value="' + o.k + '"' + (o.k === r.opD ? " selected" : "") + ">" + o.l + "</option>").join("") + "</select></div>" +
        '<div class="f"><label for="rg-nd">Jours</label><input type="number" id="rg-nd" value="' + (+r.nD || 0) + '"></div>' +
        '<div class="f"><label for="rg-ouv">Décompte</label><select id="rg-ouv">' +
          '<option value="1"' + (r.ouvres !== false ? " selected" : "") + ">Jours ouvrés</option>" +
          '<option value="0"' + (r.ouvres === false ? " selected" : "") + ">Jours calendaires</option></select></div></div>" +
        '<p class="gp">L\'écart se compte de la première date vers la seconde : il est <b>négatif</b> si la seconde ' +
        'est la plus ancienne. Un retard livré après son échéance donne donc un écart négatif de « Date fin » vers ' +
        '« Date fin prévue ». Ajoutez au besoin une condition sur une colonne :</p>' +
        '<div id="rg-conds">' + (r.conds || []).map((c, i) => ligneCond(i, c)).join("") + "</div>" +
        '<button class="btn sm" id="rg-addcond">+ Condition</button>';
    } else {
      corps.innerHTML = '<div id="rg-conds">' + r.conds.map((c, i) => ligneCond(i, c)).join("") + "</div>" +
        '<button class="btn sm" id="rg-addcond">+ Condition</button>' +
        '<p class="gp" style="margin-top:8px">Toutes les conditions doivent être vraies en même temps.</p>';
    }
    const add = $("#rg-addcond");
    if (add) add.addEventListener("click", () => { lis(); r.conds.push({ col:dispo[0], op:"est", val:"" }); dessineCorps(); });
    majValeurs();
  };
  const majValeurs = () => {
    const sel = corps.querySelector(".c-col");
    const dl = $("#rg-vals");
    if (!sel || !dl) return;
    dl.innerHTML = ctxValeurs(sel.value, 40).map(([v, n]) => '<option value="' + esc(v) + '">' + esc(v) + " — " + n0(n) + " KO</option>").join("");
  };
  /* Lit ce que le formulaire montre à cet instant : au changement de forme,
     les champs de l'ancienne forme ont déjà disparu. */
  const lis = () => {
    const v = (sel, def) => { const e = $(sel); return e ? e.value : def; };
    r.nom = (v("#rg-nom", r.nom) || "").trim();
    r.service = v("#rg-serv", r.service); r.type = v("#rg-type", r.type);
    r.cause = v("#rg-cause", r.cause); r.src = v("#rg-src", r.src);
    const ta = $("#rg-refs");
    if (ta) r.refs = ta.value.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
    if ($("#rg-da")){
      r.dateA = v("#rg-da", r.dateA); r.dateB = v("#rg-db", r.dateB);
      r.opD = v("#rg-opd", r.opD); r.nD = +v("#rg-nd", r.nD) || 0;
      r.ouvres = v("#rg-ouv", "1") === "1";
    }
    const lignes = $$("#rg-conds [data-cond]");
    if (lignes.length) r.conds = lignes.map(d => ({
      col: $(".c-col", d).value, op: $(".c-op", d).value, val: $(".c-val", d).value.trim() }));
    delete r.refsSet;
    return r;
  };
  const majCauses = () => { $("#rg-cause").innerHTML = optCauses($("#rg-serv").value, r.cause); };
  /* Choisir « Ajouter une cause… » ouvre le formulaire et repose le menu sur la
     cause qui vient d'être créée : la règle en cours n'est pas perdue. */
  $("#rg-cause").addEventListener("change", e => {
    if (e.target.value !== OPT_NEW) return;
    const avant = r.cause;
    e.target.value = avant;
    modalCause($("#rg-serv").value, k => {
      r.cause = k || avant;
      modalRegle(null, r);       /* on rouvre la règle, la cause neuve choisie */
    });
  });
  const apercu = () => {
    lis();
    const pb = regleIncomplete(r);
    const box = $("#rg-apercu");
    box.style.borderLeftColor = "";
    if (pb && r.nom){ box.style.borderLeftColor = "var(--warn)"; box.innerHTML = "<b>À compléter.</b> " + esc(pb); return; }
    if (pb){ box.innerHTML = "Complétez la règle pour voir son effet."; return; }
    const e = simuleEffet(r);
    if (!e.n){
      box.innerHTML = "Aucun KO ne correspond à cette règle sur la plage affichée. Vérifiez la colonne et la valeur — la liste de suggestions du champ montre ce qui existe vraiment.";
      return;
    }
    const av = e.avant.net == null ? 0 : e.avant.net * 100;
    const ap = e.apres.net == null ? 0 : e.apres.net * 100;
    const dj = e.apres.jtot - e.avant.jtot;
    let s = "<b>" + n0(e.n) + " KO</b> correspondent à cette règle sur " + esc(rangeLabel()) + ".";
    if (!(CAT[r.cause] && CAT[r.cause].j)){
      s += " Cette cause ne retire pas le KO : il resterait compté, la ligne servant de trace.";
    } else if (ap > av + 0.004){
      s += " Le taux net passerait de <b>" + dec(av, 2) + " %</b> à <b>" + dec(ap, 2) +
        " %</b>, soit <b>+" + dec(ap - av, 2) + " pt</b>.";
      if (dj < e.n){
        const k = e.n - dj;
        s += " " + n0(k) + (k > 1 ? " d'entre eux sont déjà couverts" : " d'entre eux est déjà couvert") +
          " par une justification existante : " +
          (k > 1 ? "ils ne rapportent rien de plus, ils changent seulement de cause."
                 : "il ne rapporte rien de plus, il change seulement de cause.");
      }
    } else {
      s += " Le taux net ne bougerait pas : ces KO sont déjà tous couverts par une justification existante. " +
        "La règle ne ferait que leur donner cette cause.";
    }
    box.innerHTML = s;
  };
  $("#dl-close").addEventListener("click", closeModal);
  $("#rg-type").addEventListener("change", () => {
    lis();
    if (r.type === "colonne" && !r.conds.length) r.conds = [{ col:dispo[0], op:"est", val:"" }];
    else if (r.type === "dates") r.conds = r.conds.filter(c => !condIncomplete(c));
    dessineCorps();
  });
  $("#rg-serv").addEventListener("change", majCauses);
  corps.addEventListener("change", e => { if (e.target.classList.contains("c-col")) majValeurs(); });
  corps.addEventListener("click", e => {
    const d = e.target.closest("[data-condel]"); if (!d) return;
    lis(); r.conds.splice(+d.dataset.condel, 1); dessineCorps();
  });
  $("#rg-test").addEventListener("click", apercu);
  $("#rg-save").addEventListener("click", async () => {
    lis();
    const pb = regleIncomplete(r);
    if (pb){ toast(pb, true); apercu(); return; }
    const i = S.regles.findIndex(x => x.id === r.id);
    if (i >= 0) S.regles[i] = r; else S.regles.push(r);
    await sauveRegles();
    const st = await rejouerRegles(true);
    closeModal();
    toast("Règle enregistrée — " + n0(st.total) + " KO documentés au total");
  });
  majCauses(); dessineCorps(); apercu();
}
$("#btn-regle-new").addEventListener("click", () => modalRegle(null));
$("#btn-regles-run").addEventListener("click", async () => {
  if (!S.regles.length){ toast("Aucune règle enregistrée", true); return; }
  const st = await rejouerRegles(false);
  $("#regles-msg").textContent = n0(st.total) + " KO documentés sur " + n0(st.cellules) + " période(s)";
});
document.addEventListener("click", async e => {
  if (e.target.closest("#btn-go-sap")){
    const p = $("#pan-sap");
    if (p){ p.open = true; p.scrollIntoView({ behavior:"smooth", block:"start" });
      setTimeout(() => { const t = $("#ta-sap"); if (t) t.focus(); }, 400); }
    return;
  }
  const mo = e.target.closest("[data-rmod]");
  if (mo){
    const m = MODELES.find(x => x.k === mo.dataset.rmod);
    if (m) modalRegle(null, modeleRegle(m));
    return;
  }
  const ed = e.target.closest("[data-redit]");
  if (ed){ modalRegle(ed.dataset.redit); return; }
  /* L'ordre de la liste décide qui pose sa cause quand deux règles visent le
     même KO. Le rendre modifiable, c'est rendre ce départage au lecteur. */
  const mv = e.target.closest("[data-rup]") || e.target.closest("[data-rdn]");
  if (mv){
    const id = mv.dataset.rup || mv.dataset.rdn, pas = mv.dataset.rup ? -1 : 1;
    const i = S.regles.findIndex(x => x.id === id), j = i + pas;
    if (i < 0 || j < 0 || j >= S.regles.length) return;
    const t = S.regles[i]; S.regles[i] = S.regles[j]; S.regles[j] = t;
    await sauveRegles(); await rejouerRegles(true);
    toast("« " + S.regles[j].nom + " » passe " + (pas < 0 ? "avant" : "après")); render();
    return;
  }
  const de = e.target.closest("[data-rdel]");
  if (de){
    const r = S.regles.find(x => x.id === de.dataset.rdel);
    if (!r || !confirm("Supprimer la règle « " + r.nom + " » ? Les justifications qu'elle a posées disparaissent.")) return;
    S.regles = S.regles.filter(x => x.id !== de.dataset.rdel);
    await sauveRegles(); await rejouerRegles(true);
    toast("Règle supprimée"); render();
  }
});
document.addEventListener("change", async e => {
  const sw = e.target.closest("[data-ract]"); if (!sw) return;
  const r = S.regles.find(x => x.id === sw.dataset.ract); if (!r) return;
  r.actif = sw.checked;
  await sauveRegles(); await rejouerRegles(true); render();
});

/* ---------------------------- assistant de mise à jour ---------------------------- */
const WIZ = { step:1, before:null };
function wizReady(v){ const b = $("#wz-next"); if (b) b.disabled = !v; }
function wizHead(){
  return '<div class="wsteps">' + [[1, "Export"], [2, "SAP"], [3, "Relevé"], [4, "Bilan"]].map(([n, l]) =>
    '<div class="wst ' + (WIZ.step === n ? "on" : WIZ.step > n ? "done" : "") + '"><span class="wnum">' +
    (WIZ.step > n ? "✓" : n) + '</span><span>' + l + '</span><span class="wln"></span></div>').join("") + "</div>";
}
function wizFoot(skip, next, disabled){
  return '<div class="wfoot"><button class="btn" id="wz-close">Fermer</button><span class="sp"></span>' +
    (skip ? '<button class="btn" id="wz-skip">' + skip + "</button>" : "") +
    '<button class="btn pri big" id="wz-next"' + (disabled ? " disabled" : "") + ">" + next + "</button></div>";
}
function openWizard(){
  WIZ.step = 1; WIZ.before = agg(Object.values(S.cells));
  wizRender();
}
function wizRender(){ WIZ.step === 1 ? wiz1() : WIZ.step === 2 ? wizSap() : WIZ.step === 3 ? wiz2() : wiz3(); }
function wizCommon(){
  $("#wz-close").addEventListener("click", closeModal);
  const sk = $("#wz-skip");
  if (sk) sk.addEventListener("click", () => { WIZ.step++; wizRender(); });
}
function wiz1(){
  EXPORT_OUT = "#wz-out"; EXPORT_APPLY = false; exportDraft = null;
  openModal('<div class="ph"><h2>Mettre à jour la semaine</h2><span class="sub">Étape 1 sur 4 — environ 5 minutes en tout</span></div>' +
    wizHead() +
    '<div class="pb" style="padding-top:0">' +
    '<div class="wq">L\'export PowerBI</div>' +
    '<p class="wh"><b>Volume Réception / Distribution LOG + MG</b> → choisir la période → onglet de gauche, ' +
    '<b>Détails lignes PowerBI</b> et <b>Dimensions</b>, <b>tout cocher</b> → <b>Exporter les données</b>. ' +
    'Puis <i>Ouvrir un fichier…</i> ci-dessous avec le <code>.xlsx</code> — inutile de le convertir ou de le coller. ' +
    'Le « tout cocher » n\'est pas un détail&nbsp;: sans lui il manque <code>Statut litige</code>, et les litiges de ' +
    'réception ne sont plus écartés. L\'outil compte le brut tout seul et vous montre ce qu\'il a trouvé&nbsp;: ' +
    '<b>rien n\'est enregistré</b> avant que vous validiez.</p>' +
    '<textarea id="wz-ta" rows="6" placeholder="Identifiant flux début&#9;Code aire&#9;KPI (Code - Libellé)&#9;Résultat&#9;Date fin&#9;Statut litige"></textarea>' +
    '<div class="actions"><button class="btn pri" id="wz-an">Analyser le collage</button>' +
    '<label class="btn" style="cursor:pointer">Ouvrir un fichier…<input type="file" id="wz-file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.htm,.html,.mht,.mhtml,.eml" hidden></label></div>' +
    '<div id="wz-out"></div></div>' +
    wizFoot("Je n'ai pas l'export", "Enregistrer et continuer", true));
  wizCommon();
  $("#wz-an").addEventListener("click", () => analyseExport($("#wz-ta").value));
  $("#wz-file").addEventListener("change", ev => {
    const f = ev.target.files[0]; if (!f) return;
    chargeFichier(f, "#wz-ta", EXPORT_OUT, analyseExport);
    ev.target.value = "";
  });
  $("#wz-next").addEventListener("click", async () => {
    if (!exportDraft) return;
    $("#wz-next").disabled = true;
    await applyExport();
    S.ui.preset = "all"; S.ui.qshow = 40;
    WIZ.step = 2; wizRender();
  });
}
function wizSap(){
  SAP_OUT = "#wz-out"; SAP_APPLY = false; sapDraft = null;
  openModal('<div class="ph"><h2>Mettre à jour la semaine</h2><span class="sub">Étape 2 sur 4 — réception uniquement</span></div>' +
    wizHead() +
    '<div class="pb" style="padding-top:0">' +
    '<div class="wq">L\'extraction SAP des postes BR</div>' +
    '<p class="wh"><b>Suivi_BR</b> sur la date choisie, exporter, puis <i>Ouvrir un fichier…</i> ci-dessous. ' +
    'Extrayez <b>après</b> la période&nbsp;: un poste recréé plus tard n\'y figurerait pas. ' +
    'C\'est la colonne qui manque à l\'export PowerBI. Quand un litige se résout, SAP <b>recrée le poste BR</b> sous un nouveau numéro&nbsp;: le KPI, lui, continue de compter depuis la première création. L\'outil recalcule le délai réel depuis la recréation et documente les postes qui tiennent l\'objectif. Sans cette étape, ces KO restent comptés comme des retards.</p>' +
    '<textarea id="wz-ta" rows="6" placeholder="Type Magasin&#9;N° BR&#9;N° poste BR&#9;N° Poste Référence&#9;Date de création du poste BR&#9;Date EM&#9;Circuit Court"></textarea>' +
    '<div class="actions"><button class="btn pri" id="wz-an">Analyser l\'extraction</button>' +
    '<label class="btn" style="cursor:pointer">Ouvrir un fichier…<input type="file" id="wz-file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.htm,.html,.mht,.mhtml,.eml" hidden></label></div>' +
    '<div id="wz-out"></div></div>' +
    wizFoot("Je n'ai pas l'extraction SAP", "Documenter et continuer", true));
  wizCommon();
  $("#wz-an").addEventListener("click", () => analyseSap($("#wz-ta").value));
  $("#wz-file").addEventListener("change", ev => {
    const f = ev.target.files[0]; if (!f) return;
    chargeFichier(f, "#wz-ta", SAP_OUT, analyseSap);
    ev.target.value = "";
  });
  $("#wz-next").addEventListener("click", async () => {
    if (!sapDraft) return;
    $("#wz-next").disabled = true;
    if (Object.keys(sapDraft.plan).length) await applySap();
    WIZ.step = 3; wizRender();
  });
}
function wiz2(){
  RELEVE_OUT = "#wz-out"; RELEVE_APPLY = false; releveDraft = null;
  RELEVE_SRC = { ta:"#wz-ta", date:"#wz-date", site:"#wz-site", serv:"#wz-serv" };
  const keys = periodKeys(Object.values(S.cells));
  const last = keys.length ? keys[keys.length - 1] : weekKey(new Date());
  const mid = new Date(weekMonday(last).getTime() + 2 * 864e5).toISOString().slice(0, 10);
  openModal('<div class="ph"><h2>Mettre à jour la semaine</h2><span class="sub">Étape 3 sur 4</span></div>' +
    wizHead() +
    '<div class="pb" style="padding-top:0">' +
    '<div class="wq">Le relevé journalier Distri MG</div>' +
    '<p class="wh">Le relevé arrive en capture d\'écran&nbsp;: <b>Imprimer → Enregistrer en PDF</b> le ou les mails ' +
    '(une conversation de plusieurs jours convient), puis demander à <b>ChatGPT</b> ou <b>Gemini</b> ' +
    'de le transcrire — le prompt complet est dans l\'onglet <b>Import</b>, au bloc du relevé — et ouvrir le ' +
    '<code>.xlsx</code> obtenu ci-dessous. L\'ordre des colonnes n\'a pas d\'importance, elles sont reconnues par ' +
    'leur nom. L\'outil <b>cherche</b> chaque DT parmi les KO déjà importés et les documente là où ils sont, à leur ' +
    'vraie date&nbsp;: il n\'ajoute jamais une DT que l\'export ne porte pas. Les catégories <i>Urgences</i>, ' +
    '<i>Retard</i> et <i>Non renseignée</i> sont gardées pour la trace mais ne justifient rien.</p>' +
    '<div class="form" style="margin-bottom:11px">' +
    '<div class="f"><label for="wz-date">Semaine, si besoin</label><input type="date" id="wz-date" value="' + mid + '"><span class="hint" id="wz-week">' + esc(perLong(last)) + "</span></div>" +
    '<div class="f"><label for="wz-site">Site</label><select id="wz-site"><option value="mag">MG</option><option value="log">Logistiport</option></select></div>' +
    '<div class="f"><label for="wz-serv">Service</label><select id="wz-serv"><option value="distri">Distribution</option><option value="recep">Réception</option></select></div>' +
    "</div>" +
    '<textarea id="wz-ta" rows="6" placeholder="7512783 ; Reliquat ; attente appro&#10;7462231 ; Grues ; grue indisponible"></textarea>' +
    '<div class="actions"><button class="btn pri" id="wz-an">Analyser le relevé</button>' +
    '<label class="btn" style="cursor:pointer">Ouvrir le mail ou un fichier…<input type="file" id="wz-file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.htm,.html,.mht,.mhtml,.eml" hidden></label></div>' +
    '<div id="wz-out"></div></div>' +
    wizFoot("Pas de relevé cette semaine", "Enregistrer et continuer", true));
  wizCommon();
  const up = () => { const d = $("#wz-date").value;
    $("#wz-week").textContent = d ? perLong(weekKey(new Date(d + "T12:00:00"))) : "—"; };
  $("#wz-date").addEventListener("change", up);
  $("#wz-an").addEventListener("click", analyseReleve);
  $("#wz-file").addEventListener("change", ev => {
    const f = ev.target.files[0]; if (!f) return;
    chargeFichier(f, "#wz-ta", RELEVE_OUT, analyseReleve);
    ev.target.value = "";
  });
  $("#wz-next").addEventListener("click", async () => {
    if (!releveDraft) return;
    $("#wz-next").disabled = true;
    await applyReleve();
    WIZ.step = 4; wizRender();
  });
}
function wiz3(){
  const after = agg(Object.values(S.cells)), b = WIZ.before || after;
  const dF = after.flux - b.flux, dK = after.ko - b.ko, dJ = Math.round(after.jtot - b.jtot);
  const ctr = controls();
  const crit = ctr.filter(c => c.k === "crit"), warn = ctr.filter(c => c.k === "warn");
  const cur = agg(selCells());
  const line = (k, v) => '<div class="fact"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
  openModal('<div class="ph"><h2>Mise à jour terminée</h2><span class="sub">Étape 4 sur 4</span></div>' +
    wizHead() +
    '<div class="pb" style="padding-top:0">' +
    '<div class="wq">' + (dF > 0 ? n0(dF) + " flux ajoutés" : "Rien ajouté au volume") + (dJ > 0 ? " · " + n0(dJ) + " KO justifiés en plus" : "") + "</div>" +
    '<p class="wh">Sur ' + esc(rangeLabel()) + ", le taux net est de <b>" + pf(cur.net) + "</b> contre <b>" + pf(cur.brut) + "</b> en brut.</p>" +
    '<div class="facts" style="border:1px solid var(--line);border-radius:9px;border-top:1px solid var(--line)">' +
      line("Flux ajoutés", n0(dF)) + line("KO ajoutés", n0(dK)) + line("Justifications ajoutées", n0(dJ)) +
      line("Reste à qualifier", n0(cur.reste)) + "</div>" +
    '<div style="margin-top:15px;border:1px solid var(--line);border-radius:9px;overflow:hidden">' +
      (crit.length || warn.length
        ? ctr.slice(0, 3).map(c => '<div class="alert ' + c.k + '"><span class="ic">' + (c.k === "ok" ? "✓" : "!") + '</span><span class="tx"><b>' + esc(c.t) + "</b><br>" + esc(c.d) + "</span></div>").join("")
        : '<div class="alert ok"><span class="ic">✓</span><span class="tx"><b>Aucun contrôle en défaut</b><br>Le taux est publiable avec le brut et la couverture.</span></div>') +
    "</div></div>" +
    '<div class="wfoot"><button class="btn" id="wz-close">Terminer</button><span class="sp"></span>' +
    (cur.reste > 0 ? '<button class="btn pri big" id="wz-qual">Qualifier les ' + n0(cur.reste) + " KO restants</button>" : "") + "</div>");
  $("#wz-close").addEventListener("click", () => { closeModal(); gotoTab("dash"); });
  const q = $("#wz-qual");
  if (q) q.addEventListener("click", () => { closeModal(); gotoTab("justif"); window.scrollTo({ top:0 }); });
}

/* ---------------------------- initialisation ---------------------------- */
(function init(){
  /* Les causes ajoutées se posent avant tout : les périodes qu'on va relire y
     renvoient, et une justification dont la cause n'existe pas encore retombe
     en « Autre ». */
  chargeCatsLocal();
  const local = loadLocal();
  if (local && Object.keys(local).length) S.cells = local;
  else { S.cells = seedCells(); saveLocal(); }
  chargeReglesLocal();
  chargeCausesLocal();
  setStatus("local", "Enregistré sur ce navigateur");
  /* Cible et plancher se lisent avant le premier rendu : sinon l'écran s'ouvre
     sur toute la série puis se recadre sous les yeux. */
  try { const c = parseFloat(localStorage.getItem(LSCIBLE)); if (isFinite(c) && c > 0) S.cible = c; } catch(e){}
  try {
    const p = localStorage.getItem(LSPLANCHER);
    if (p != null) S.plancher = /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : "";
  } catch(e){}
  if (!afterLoad()) render();
  connectStore();
})();

async function connectStore(){
  if (window.claude && typeof window.claude.use === "function"){
    let db = null;
    try { db = await window.claude.use("db"); } catch(e){}
    if (db){
      S.db = db; S.backend = "db";
      setStatus("busy", "Connexion à la base…");
      try {
        const snap = await db.collection(FB_COLLECTION).get();
        if (snap.empty) for (const c of Object.values(S.cells)){
          try { await db.doc(FB_COLLECTION + "/" + c.id).set(pourBase(normCell(c))); }
          catch(e){ if (!S.writeErr) writeFail(1, Object.keys(S.cells).length, e); }
        }
      } catch(e){
        S.backend = "local"; S.db = null;
        setStatus("local", "Base indisponible — copie locale"); render(); return;
      }
      db.collection(FB_COLLECTION).onSnapshot(snap => {
        const m = {};
          lisReglages(snap.docs.map(d => ({ id:d.id, o:d.data() })));
        snap.docs.forEach(d => { const o = d.data();
          if (d.id === DOC_REGLES) return;
          if (o && o.periode && SITES[o.site] && SERVS[o.service]){ const c = normCell(o); c.id = d.id; m[c.id] = c; } });
        S.cells = mergeSnapshot(m); saveLocal();
        if (!S.pending && !S.writeErr) setStatus("ok", "Enregistré en ligne");
        if (!afterLoad()) render();
      }, () => { S.backend = "local"; S.db = null; setStatus("local", "Base interrompue — copie locale"); render(); });
      setStatus("ok", "Enregistré en ligne"); render();
      return;
    }
  }
  const cfg = fbConfig();
  if (cfg) await connectFirebase(cfg);
}
