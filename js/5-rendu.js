/* =========================================================================
   Bloc 2 : rendu, graphiques, interactions
   ========================================================================= */

let toastTimer = null;
function toast(msg, bad){
  const t = $("#toast"); t.textContent = msg; t.className = "toast on" + (bad ? " bad" : "");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = "toast" + (bad ? " bad" : ""); }, 3200);
}
function closeModal(){
  $("#ovl").classList.remove("on"); $("#modal").innerHTML = ""; $("#modal").className = "modal";
  EXPORT_OUT = "#export-out"; EXPORT_APPLY = true; RELEVE_OUT = "#releve-out"; RELEVE_APPLY = true;
  SAP_OUT = "#sap-out"; SAP_APPLY = true;
  RELEVE_SRC = { ta:"#ta-releve", date:"#r-date", site:"#r-site", serv:"#r-serv" };
}
function openModal(html){ $("#modal").innerHTML = html; $("#ovl").classList.add("on"); const f = $("#modal input,#modal select,#modal textarea"); if (f) f.focus(); }
$("#ovl").addEventListener("mousedown", e => { if (e.target.id === "ovl") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ------------------------------- SVG ------------------------------- */
const SVGNS = 'xmlns="http://www.w3.org/2000/svg"';
function svgText(x, y, t, o){
  o = o || {};
  return '<text x="' + x + '" y="' + y + '" fill="' + (o.fill || "var(--muted)") + '" font-size="' + (o.size || 11) +
    '" font-family="' + (o.mono ? "var(--f-mono)" : "var(--f-body)") + '" font-weight="' + (o.w || 400) +
    '" text-anchor="' + (o.anchor || "start") + '"' + (o.dom ? ' dominant-baseline="' + o.dom + '"' : "") + '>' + esc(t) + "</text>";
}

/* La boîte de dessin. Hors plein écran la hauteur est fixe et la largeur suit
   le cadre ; en plein écran c'est l'inverse qui compte — le graphique prend ce
   que la colonne lui laisse, et le viewBox épouse la boîte pour ne rien étirer. */
function boxChart(wrap, defH){
  const cs = getComputedStyle(wrap);
  const px = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const py = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const W = Math.max(wrap.clientWidth - px, 320);
  const plein = document.body.classList.contains("fs");
  const H = plein ? Math.max(wrap.clientHeight - py, 180) : defH;
  return { W, H };
}
/* ---------------------------- évolution ---------------------------- */
let evoData = [];
function drawEvo(){
  const wrap = $("#evo-wrap"); if (!wrap || !wrap.clientWidth) return;
  const cs = selCells();
  const keys = rangeKeys();
  evoData = keys.map(k => { const a = agg(cs.filter(c => pkey(c) === k)); a.key = k; return a; });
  $("#evo-sub").textContent = keys.length
    ? "Brut, documenté et net — " + rangeLabel()
    : "Brut, documenté et net période par période";
  if (!keys.length){ $("#evo-legend").innerHTML = ""; wrap.innerHTML = '<div class="empty"><b>Aucune période dans la plage</b>Élargissez la plage, ou enregistrez une période dans l\'onglet Saisie.</div>'; return; }
  if (keys.length === 1){
    $("#evo-legend").innerHTML = "";
    wrap.innerHTML = '<div class="empty"><b>Une seule période sélectionnée</b>La courbe demande au moins deux points — choisissez une plage plus large pour voir la tendance.</div>';
    return;
  }

  const { W, H } = boxChart(wrap, 300);
  const m = { t: 18, r: 52, b: 34, l: 48 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vals = evoData.flatMap(d => [d.brut, d.net]).filter(v => v != null);
  let lo = Math.min.apply(null, vals) * 100, hi = Math.max.apply(null, vals) * 100;
  const pad = Math.max((hi - lo) * 0.3, 0.6);
  lo = Math.max(0, lo - pad); hi = Math.min(100, hi + pad);
  const n = evoData.length;
  const x = i => n === 1 ? m.l + iw / 2 : m.l + iw * i / (n - 1);
  const y = v => m.t + ih - (v * 100 - lo) / (hi - lo) * ih;

  let s = '<svg ' + SVGNS + ' viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Évolution des taux brut, documenté et net">';
  for (let i = 0; i <= 4; i++){
    const v = lo + (hi - lo) * i / 4, yy = m.t + ih - i / 4 * ih;
    s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="var(--grid)" stroke-width="1"/>';
    s += svgText(m.l - 8, yy, dec(v, 1), { anchor:"end", dom:"middle", mono:true, size:10.5 });
  }
  s += '<line x1="' + m.l + '" x2="' + m.l + '" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="var(--axis)"/>';
  s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (m.t + ih) + '" y2="' + (m.t + ih) + '" stroke="var(--axis)"/>';

  if (n > 1){
    const up = evoData.map((d, i) => x(i).toFixed(1) + "," + y(d.net).toFixed(1));
    const dn = evoData.map((d, i) => x(i).toFixed(1) + "," + y(d.brut).toFixed(1)).reverse();
    s += '<path d="M' + up.join("L") + "L" + dn.join("L") + 'Z" fill="var(--ink)" opacity="0.07"/>';
  }
  const line = (get, col) => {
    const pts = evoData.map((d, i) => x(i).toFixed(1) + "," + y(get(d)).toFixed(1));
    let o = n > 1 ? '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' : "";
    evoData.forEach((d, i) => {
      o += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(get(d)).toFixed(1) + '" r="' + (n > 12 ? 3 : 4.5) + '" fill="' + col + '" stroke="var(--surface)" stroke-width="2"/>';
    });
    const lastD = evoData[n - 1];
    o += svgText(x(n - 1) + 9, y(get(lastD)), dec(get(lastD) * 100, 1), { dom:"middle", size:11, mono:true, w:500, fill:col });
    return o;
  };
  const fondu = evoData.every(d => d.net != null && d.docu != null && Math.abs(d.net - d.docu) < 5e-5);
  s += line(d => d.brut, "var(--c-brut)");
  if (!fondu) s += line(d => d.docu, "var(--c-expl)");
  s += line(d => d.net,  "var(--c-net)");
  $("#evo-legend").innerHTML =
    '<span><i style="background:var(--c-brut)"></i>Brut</span>' +
    (fondu
      ? '<span><i style="background:linear-gradient(90deg,var(--c-expl) 50%,var(--c-net) 50%)"></i>Documenté et net confondus</span>'
      : '<span><i style="background:var(--c-expl)"></i>Documenté</span><span><i style="background:var(--c-net)"></i>Net</span>') +
    '<span class="muted">La bande grisée mesure l\'écart brut → net.' +
    (fondu ? " Toutes les justifications s’appuient ici sur une pièce." : "") + "</span>";
  evoData.forEach((d, i) => {
    const step = n > 14 ? Math.ceil(n / 10) : 1;
    if (i % step === 0 || i === n - 1)
      s += svgText(x(i), m.t + ih + 17, perLabel(d.key), { anchor:"middle", size:10.5, fill:"var(--ink-2)", w:500 });
  });
  s += '<line id="evo-cross" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="var(--axis)" stroke-width="1" opacity="0"/>';
  s += '<rect id="evo-hit" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>';
  s += "</svg>";
  wrap.innerHTML = s + '<div class="tip" id="evo-tip"></div>';

  const svg = wrap.querySelector("svg"), hit = $("#evo-hit"), cross = $("#evo-cross"), tip = $("#evo-tip");
  const move = ev => {
    const r = svg.getBoundingClientRect(), sc = W / r.width;
    const px = (ev.clientX - r.left) * sc;
    let i = n === 1 ? 0 : Math.round((px - m.l) / (iw / Math.max(n - 1, 1)));
    i = Math.max(0, Math.min(n - 1, i));
    const d = evoData[i];
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", "1");
    tip.innerHTML = '<div class="tt">' + esc(perLong(d.key)) + "</div>" +
      '<div class="tr"><span>Brut</span><b>' + pf(d.brut) + "</b></div>" +
      '<div class="tr"><span>Documenté</span><b>' + pf(d.docu) + "</b></div>" +
      '<div class="tr"><span>Net</span><b>' + pf(d.net) + "</b></div>" +
      '<div class="tr" style="margin-top:5px;border-top:1px solid var(--line);padding-top:5px"><span>Flux · KO</span><b>' + n0(d.flux) + " · " + n0(d.ko) + "</b></div>" +
      '<div class="tr"><span>KO justifiés</span><b>' + n0(d.jtot) + "</b></div>";
    tip.style.opacity = "1";
    const left = Math.min(Math.max(x(i) / sc - 80, 4), r.width - 175);
    tip.style.left = left + "px"; tip.style.top = "10px";
  };
  hit.addEventListener("mousemove", move);
  hit.addEventListener("mouseleave", () => { tip.style.opacity = "0"; cross.setAttribute("opacity", "0"); });
}

/* ------------------------- volume, en barres -------------------------
   La courbe d'évolution donne le taux ; elle ne dit rien du volume. Deux
   semaines à 95 % ne pèsent pas pareil si l'une porte 200 KO et l'autre 20.
   Ces barres montrent le nombre de KO, coupé en deux : ce qui est retiré du
   décompte, et ce qui reste compté. La hauteur est la matière, la couleur dit
   ce qu'on en a fait — vert ce qui est expliqué, orange ce qui pèse encore sur
   le taux, comme partout ailleurs dans l'outil.

   Deux séries seulement : le partage pièce / analyse a sa place dans le panneau
   des causes, pas ici. Deux tons d'un même vert ne se distinguent pas de façon
   fiable en aplat — ils échouent au contrôle de séparation — et à soixante
   barres la lecture n'y survivrait pas. Le détail reste dans l'infobulle. */
let volData = [];
function niceStep(v, n){
  const brut = v / Math.max(1, n);
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(brut, 1e-9))));
  const r = brut / p;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p;
}
/* Coins hauts arrondis, pied carré : la barre pousse depuis la ligne de base. */
function colPath(x, y, w, h, r){
  r = Math.max(0, Math.min(r, w / 2, h));
  if (h <= 0.4) return "";
  return "M" + x.toFixed(1) + "," + (y + h).toFixed(1) +
    "V" + (y + r).toFixed(1) + "a" + r + "," + r + " 0 0 1 " + r + "," + (-r) +
    "h" + (w - 2 * r).toFixed(1) + "a" + r + "," + r + " 0 0 1 " + r + "," + r +
    "V" + (y + h).toFixed(1) + "Z";
}
function drawVol(){
  const wrap = $("#vol-wrap"); if (!wrap || !wrap.clientWidth) return;
  const leg = $("#vol-legend"), sub = $("#vol-sub");
  const unite = S.ui.maille === "mois" ? "mois" : S.ui.maille === "jour" ? "jour" : "semaine";
  const cs = selCells(), keys = rangeKeys();
  volData = keys.map(k => { const a = agg(cs.filter(c => pkey(c) === k)); a.key = k; return a; });
  if (sub) sub.textContent = keys.length ? "KO retirés et KO restants, " + unite + " par " + unite : "";
  if (!keys.length){
    if (leg) leg.innerHTML = "";
    wrap.innerHTML = '<div class="empty"><b>Aucune période dans la plage</b>Élargissez la plage, ou importez un export dans l\'onglet Import.</div>';
    return;
  }
  const maxKo = Math.max.apply(null, volData.map(d => d.ko).concat([1]));
  if (maxKo < 0.5){
    if (leg) leg.innerHTML = "";
    wrap.innerHTML = '<div class="empty"><b>Aucun KO sur cette plage</b>Rien à répartir : le brut est à 100 % sur toutes les périodes affichées.</div>';
    return;
  }

  const n = volData.length;
  const m = { t: 16, r: 16, b: 34, l: 46 };
  /* Chaque barre garde une largeur minimale : au-delà, le graphique défile
     plutôt que de se tasser en traits illisibles. */
  /* clientWidth englobe le rembourrage du cadre : mesurer sans le retirer
     donnait un SVG quelques pixels trop large, et donc une barre de défilement
     à toutes les largeurs, même avec trois barres. */
  const bx = boxChart(wrap, 260);
  const slotMin = n > 40 ? 11 : 16;
  const W = Math.max(bx.W, m.l + m.r + n * slotMin);
  const H = bx.H;
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  /* Trois barres étalées sur toute la largeur donneraient trois bâtonnets
     perdus. Au-delà d'un pas confortable le groupe se centre au lieu de
     s'étirer — la barre, elle, reste plafonnée à 24 px. */
  /* Trois mois ne se dessinent pas comme quarante jours : sous cinq barres on
     laisse la barre s'épaissir, sans quoi le graphique n'est plus que trois
     bâtonnets perdus au milieu d'un panneau large. L'air dans le pas reste
     majoritaire dans les deux cas. */
  const capBw = n <= 5 ? 44 : 24;
  const slot = Math.min(iw / n, n <= 5 ? 110 : 88);
  const x0g = m.l + (iw - slot * n) / 2;
  /* La grille s'arrête où les barres s'arrêtent : des lignes qui courent dans le
     vide bien au-delà de la dernière barre font flotter le graphique. */
  const pl = x0g, pr = x0g + slot * n;
  const bw = Math.max(3, Math.min(capBw, slot * 0.6));

  const pas = niceStep(maxKo, 4);
  const hi = Math.max(pas, Math.ceil(maxKo / pas) * pas);
  const y = v => m.t + ih - (v / hi) * ih;
  const xc = i => x0g + slot * (i + 0.5);

  let s = '<svg ' + SVGNS + ' viewBox="0 0 ' + W + " " + H + '" width="' + W + '" role="img" ' +
    'aria-label="KO retirés et KO restants, ' + unite + ' par ' + unite + '">';
  for (let v = 0; v <= hi + 1e-6; v += pas){
    const yy = y(v);
    s += '<line x1="' + pl.toFixed(1) + '" x2="' + pr.toFixed(1) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) +
      '" stroke="var(--grid)" stroke-width="1"/>';
    s += svgText(pl - 9, yy, n0(v), { anchor:"end", dom:"middle", mono:true, size:10.5 });
  }
  s += '<line x1="' + pl.toFixed(1) + '" x2="' + pr.toFixed(1) + '" y1="' + (m.t + ih) + '" y2="' + (m.t + ih) + '" stroke="var(--axis)"/>';
  /* La bande de survol se pose DERRIÈRE les barres et ne prend pas le pointeur :
     dessinée par-dessus, elle interceptait le survol et le clic de la barre
     qu'elle venait justement désigner. */
  s += '<rect id="vol-band" x="0" y="' + m.t + '" width="0" height="' + ih + '" rx="3" fill="var(--ink)" opacity="0" pointer-events="none"/>';

  const GAP = 2;                       /* le vide qui sépare, jamais un contour */
  volData.forEach((d, i) => {
    const x0 = xc(i) - bw / 2;
    const ret = Math.min(d.jtot, d.ko), res = Math.max(0, d.ko - ret);
    const hTot = ih - (y(d.ko) - m.t);
    const hRes = ih - (y(res) - m.t);
    const hRet = Math.max(0, hTot - hRes);
    const r = Math.min(4, bw / 2);
    /* le sommet arrondi appartient au segment le plus haut qui existe */
    if (res > 0.4){
      s += '<path d="' + colPath(x0, y(d.ko), bw, hRes, r) + '" fill="var(--c-brut)"/>';
      if (hRet > GAP + 0.4)
        s += '<path d="' + colPath(x0, y(d.ko) + hRes + GAP, bw, hRet - GAP, 0) + '" fill="var(--c-expl)"/>';
    } else if (hRet > 0.4){
      s += '<path d="' + colPath(x0, y(d.ko), bw, hTot, r) + '" fill="var(--c-expl)"/>';
    }
    /* une valeur sur chaque barre serait du bruit : le total ne s'écrit que
       lorsqu'il y a la place de le lire */
    if (n <= 14 && slot >= 30)
      s += svgText(xc(i), y(d.ko) - 6, n0(d.ko), { anchor:"middle", size:10.5, mono:true, fill:"var(--ink-2)", w:600 });
    s += '<rect class="vhit" data-i="' + i + '" x="' + (xc(i) - slot / 2).toFixed(1) + '" y="' + m.t +
      '" width="' + slot.toFixed(1) + '" height="' + ih + '" fill="transparent" style="cursor:pointer"/>';
  });

  const step = n > 16 ? Math.ceil(n / 12) : 1;
  volData.forEach((d, i) => {
    if (i % step === 0 || i === n - 1)
      s += svgText(xc(i), m.t + ih + 17, perLabel(d.key), { anchor:"middle", size:10.5, fill:"var(--ink-2)", w:500 });
  });
  s += "</svg>";
  /* Le SVG défile, l'infobulle non : elle reste posée sur le cadre, sinon elle
     part avec le défilement et sort de l'écran. */
  wrap.innerHTML = '<div class="cscroll">' + s + '</div><div class="tip" id="vol-tip"></div>';

  const tot = volData.reduce((o, d) => { o.ko += d.ko; o.j += d.jtot; return o; }, { ko:0, j:0 });
  if (leg) leg.innerHTML =
    '<span><i style="background:var(--c-expl)"></i>KO retirés du décompte</span>' +
    '<span><i style="background:var(--c-brut)"></i>KO restants</span>' +
    '<span class="muted">La hauteur est le nombre de KO de la période. ' +
    (tot.ko ? n0(tot.j) + " retirés sur " + n0(tot.ko) + " au total — cliquez une barre pour n'afficher qu'elle." 
            : "Cliquez une barre pour n'afficher qu'elle.") + "</span>";

  const svg = wrap.querySelector("svg"), tip = $("#vol-tip"), band = $("#vol-band");
  const montre = (i, ev) => {
    const d = volData[i]; if (!d) return;
    const r = wrap.getBoundingClientRect(), rs = svg.getBoundingClientRect(), sc = W / rs.width;
    const ret = Math.min(d.jtot, d.ko), res = Math.max(0, d.ko - ret);
    band.setAttribute("x", (xc(i) - slot / 2).toFixed(1));
    band.setAttribute("width", slot.toFixed(1));
    band.setAttribute("opacity", "0.05");
    tip.innerHTML = '<div class="tt">' + esc(perLong(d.key)) + "</div>" +
      '<div class="tr"><span>Flux</span><b>' + n0(d.flux) + "</b></div>" +
      '<div class="tr"><span>KO</span><b>' + n0(d.ko) + "</b></div>" +
      '<div class="tr" style="margin-top:5px;border-top:1px solid var(--line);padding-top:5px">' +
        '<span><i class="tk" style="background:var(--c-expl)"></i>Retirés</span><b>' + n0(ret) + "</b></div>" +
      (d.jtot > 0.5
        ? '<div class="tr sm"><span>dont sur pièce</span><b>' + n0(d.jdoc) + "</b></div>" +
          '<div class="tr sm"><span>par votre analyse</span><b>' + n0(d.jtot - d.jdoc) + "</b></div>"
        : "") +
      '<div class="tr"><span><i class="tk" style="background:var(--c-brut)"></i>Restants</span><b>' + n0(res) + "</b></div>" +
      '<div class="tr" style="margin-top:5px;border-top:1px solid var(--line);padding-top:5px"><span>Brut → net</span><b>' +
        pf(d.brut) + " → " + pf(d.net) + "</b></div>";
    tip.style.opacity = "1";
    const cx = ev ? (ev.clientX - r.left) : (rs.left - r.left + xc(i) / sc);
    tip.style.left = Math.min(Math.max(cx - 85, 4), Math.max(4, r.width - 190)) + "px";
    tip.style.top = "6px";
  };
  wrap.querySelectorAll(".vhit").forEach(h => {
    const i = +h.dataset.i;
    h.addEventListener("mousemove", ev => montre(i, ev));
    h.addEventListener("mouseenter", ev => montre(i, ev));
    h.addEventListener("click", () => {
      const k = volData[i].key;
      S.ui.preset = "custom";
      const b = jourBornes(k);
      if (b){ S.ui.d1 = b[0]; S.ui.d2 = b[1]; }
      syncSegs(); render();
      toast(perLong(k) + " — plage réduite");
      window.scrollTo({ top:0, behavior:"smooth" });
    });
  });
  svg.addEventListener("mouseleave", () => { tip.style.opacity = "0"; band.setAttribute("opacity", "0"); });
}
/* Les bornes en dates d'une clé de période, pour que le clic sur une barre
   recadre la plage exactement dessus. */
function jourBornes(k){
  if (estJour(k)) return [k, k];
  if (k.includes("-W")){
    const a = weekMonday(k), b = new Date(a); b.setUTCDate(a.getUTCDate() + 6);
    return [a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)];
  }
  const [y, mo] = k.split("-M").map(Number);
  const a = new Date(Date.UTC(y, mo - 1, 1)), b = new Date(Date.UTC(y, mo, 0));
  return [a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)];
}

/* ---------------------------- tableau de bord ----------------------------
   Jauge en demi-cercle. Les deux jauges d'un écran partagent la même échelle —
   sans quoi 94,0 et 95,5 pourraient paraître identiques, ou inversés. L'échelle
   ne part pas de zéro : à 93-97 %, tout se jouerait sur le dernier degré. */
function demiCercle(val, lo, col, lbl, fond){
  const R = 82, CX = 100, CY = 100, W = 14;
  const f = val == null ? 0 : Math.max(0, Math.min(1, (val * 100 - lo) / (100 - lo)));
  const pt = fr => { const th = Math.PI * (1 - fr);
    return [(CX + R * Math.cos(th)).toFixed(2), (CY - R * Math.sin(th)).toFixed(2)]; };
  const [x2, y2] = pt(f);
  return '<svg class="gg" viewBox="0 0 200 128" role="img" aria-label="' + esc(lbl) + " " + pf(val) +
      ", échelle " + dec(lo, 0) + ' à 100 %">' +
    '<path d="M' + (CX - R) + "," + CY + " A" + R + "," + R + " 0 0 1 " + (CX + R) + "," + CY +
      '" fill="none" stroke="' + (fond || "var(--surface-3)") + '" stroke-width="' + W + '" stroke-linecap="round"/>' +
    (f > 0.002
      ? '<path d="M' + (CX - R) + "," + CY + " A" + R + "," + R + " 0 0 1 " + x2 + "," + y2 +
        '" fill="none" stroke="' + col + '" stroke-width="' + W + '" stroke-linecap="round"/>'
      : "") +
    '<text x="' + CX + '" y="' + (CY - 14) + '" text-anchor="middle" fill="var(--ink)" ' +
      'font-family="var(--f-disp)" font-weight="700" font-size="38" letter-spacing="-1.4">' +
      dec(val * 100, 1) + '<tspan font-size="17" fill="var(--ink-2)" dx="2"> %</tspan></text>' +
    '<text x="' + (CX - R) + '" y="' + (CY + 20) + '" text-anchor="middle" fill="var(--muted)" ' +
      'font-family="var(--f-mono)" font-size="11">' + dec(lo, 0) + "</text>" +
    '<text x="' + (CX + R) + '" y="' + (CY + 20) + '" text-anchor="middle" fill="var(--muted)" ' +
      'font-family="var(--f-mono)" font-size="11">100</text></svg>';
}

function perimAgg(){
  const out = [], eff = effCells();
  Object.keys(SITES).forEach(si => Object.keys(SERVS).forEach(sv => {
    const list = eff.filter(c => c.site === si && c.service === sv && dansPlage(c));
    out.push({ si, sv, l: SITES[si].l + " · " + (sv === "distri" ? "Distribution" : "Réception"), a: agg(list) });
  }));
  return out;
}
function renderDash(){
  const a = agg(selCells());
  const ctr = controls();
  const crit = ctr.filter(c => c.k === "crit").length, warn = ctr.filter(c => c.k === "warn").length;
  const per = perimAgg();

  if (!a.flux){
    const sd = sansDetail();
    const jourVide = S.ui.maille === "jour" && sd.length;
    $("#board").innerHTML = '<div class="wt"><h3>' +
      (jourVide ? "Le détail au jour manque sur ces périodes" : "Aucune donnée sur ce périmètre") + "</h3>" +
      '<div class="wnum-l" style="margin-top:10px">' + (jourVide
        ? n0(sd.length) + " période(s) sont bien enregistrées, mais leur export a été chargé avant que l'outil compte les flux <b>par date</b>. " +
          "Réimportez un export pour les lire au jour — ou revenez en maille <b>Semaine</b>."
        : "Élargissez la plage de périodes, ou importez un export dans l'onglet <b>Import</b>.") + "</div>" +
      '<div class="bcta">' + (jourVide ? '<button class="btn pri" data-maille="semaine">Revenir à la semaine</button> ' : "") +
      '<button class="btn" data-tabgo="import">Aller à l\'import</button></div></div>';
    $("#ctrl-sub").textContent = "";
    $("#ctrls").innerHTML = "";
    drawEvo(); drawVol();
    return;
  }

  const cible = (+S.cible || 99) / 100;
  /* Le meter part d'un plancher qui laisse voir l'écart : à 93-97 % pour une
     cible à 99, une échelle 0-100 tasserait tout dans le dernier centimètre. */
  const vals = [a.brut, a.net].concat(per.map(p => p.a.net)).filter(v => v != null);
  const bas = Math.min.apply(null, vals.concat([cible])) * 100;
  const lo = Math.max(0, Math.floor((bas - 1) / 2) * 2);
  const px = v => v == null ? 0 : Math.max(0, Math.min(100, (v * 100 - lo) / (100 - lo) * 100));

  /* ---- deux cases côte à côte : le brut, puis le net ---- */
  /* l'anneau de fond prend la teinte pâle de la jauge : ton sur ton, plus doux
     qu'un gris qui n'appartient à rien */
  const jauge = (titre, val, col, sous, tag, fond) =>
    '<div class="wt gt"><h3><i class="chip-c" style="background:' + col + '"></i>' + titre +
      (tag ? '<span class="btag">' + esc(tag) + "</span>" : "") + "</h3>" +
    demiCercle(val, lo, col, titre, fond) +
    '<div class="gsub">' + sous + "</div></div>";

  const t1 = jauge("Taux brut", a.brut, "var(--c-brut)",
    n0(a.flux) + " flux · <b>" + n0(a.ko) + " KO</b> comptés en retard", rangeLabel(), "var(--c-brut-f)");
  const t2 = jauge("Taux net", a.net, "var(--c-net)",
    "<b>" + ptf(a.net - a.brut) + "</b> d'écart expliqué · " + n0(a.jtot) + " KO justifiés" +
    (a.jtot - a.jdoc < 0.5
      ? ", tous appuyés sur une pièce"
      : " — " + n0(a.jdoc) + " sur pièce, " + n0(a.jtot - a.jdoc) + " par votre analyse"),
    n0(a.reste) + " restent", "var(--c-net-f)");

  /* ---- les causes, en barres ---- */
  const cats = Object.entries(a.cat).map(([k, v]) => ({ k, l: CAT[k] ? CAT[k].l : k, n: v.doc + v.man }))
    .filter(r => r.n > 0.5).sort((x, y) => y.n - x.n).slice(0, 6);
  const maxC = cats.length ? cats[0].n : 1;
  const t3 = '<div class="wt"><h3><i class="chip-c" style="background:var(--c-expl)"></i>Retards expliqués' +
      '<span class="btag">' + n0(a.jtot) + " KO</span></h3>" +
    (cats.length
      ? '<div class="hbars">' + cats.map(c =>
          '<div class="hb" data-drill="cat|' + esc(c.k) + '" title="Voir les retards « ' + esc(c.l) + ' »">' +
          '<span class="hbl">' + esc(c.l) + '</span><span class="hbv">' + n0(c.n) + "</span>" +
          '<span class="hbt"><i style="width:' + Math.max(2, c.n / maxC * 100).toFixed(1) + '%"></i></span></div>').join("") + "</div>"
      : '<div class="wempty">Aucune cause enregistrée sur cette plage.</div>') +
    '<div class="bcta"><button class="btn sm" data-tabgo="qualif">Voir le registre</button>' +
      ' <button class="btn sm" id="btn-defs">Brut, documenté, net&nbsp;?</button></div></div>';

  /* ---- rangée de tuiles : un périmètre chacune ---- */
  const actif = (si, sv) => S.ui.site === si && S.ui.serv === sv;
  const tuiles = per.map(p => {
    if (!p.a.flux) return '<div class="kt vide"><span class="ktt">' + esc(p.l) + "</span>" +
      '<span class="ktv">—</span><span class="ktd">aucun flux</span></div>';
    return '<div class="kt' + (actif(p.si, p.sv) ? " on" : "") + '" data-drill="perim|' + p.si + "|" + p.sv + '|dash"' +
      ' title="N\'afficher que ' + esc(p.l) + '">' +
      '<span class="ktt">' + esc(p.l) + "</span>" +
      '<span class="ktv">' + dec(p.a.net * 100, 1) + " %</span>" +
      '<span class="ktd"><span class="kbrut">brut ' + pf(p.a.brut) + '</span> · <span class="kgain">' +
        ptf(p.a.net - p.a.brut) + "</span></span>" +
      '<span class="ktr">' + n0(p.a.ko) + " KO · " + n0(p.a.reste) + " à justifier</span></div>";
  }).join("");

  $("#board").innerHTML =
    '<div class="wrow g">' + t1 + t2 + t3 + "</div>" +
    '<div class="wrow b">' + tuiles + "</div>";
  $("#ctrl-sub").textContent = crit ? crit + " point(s) à corriger" : warn ? warn + " point(s) à trancher" : "Rien à signaler";
  $("#ctrls").innerHTML = ctr.map(c =>
    '<div class="alert ' + c.k + '"><span class="ic">' + (c.k === "ok" ? "✓" : "!") + '</span>' +
    '<span class="tx"><b>' + esc(c.t) + "</b><br>" + esc(c.d) + "</span></div>").join("");
  drawEvo(); drawVol();
}

/* ---------------------------- retards qualifiés ---------------------------- */
let regList = [];
function triReg(x, y){
  const s = S.ui.regSens || -1, cle = S.ui.regTri || "date";
  let d = 0;
  if (cle === "date") d = String(x.l.d || dateOfRef(x.c, x.l.ref) || "").localeCompare(String(y.l.d || dateOfRef(y.c, y.l.ref) || ""));
  else if (cle === "per") d = x.c.periode.localeCompare(y.c.periode);
  else if (cle === "perim") d = (SITES[x.c.site].l + x.c.service).localeCompare(SITES[y.c.site].l + y.c.service);
  else if (cle === "ref") d = String(x.l.ref).localeCompare(String(y.l.ref), "fr", { numeric:true });
  else if (cle === "cause") d = String(CAT[x.l.cat] ? CAT[x.l.cat].l : x.l.cat).localeCompare(String(CAT[y.l.cat] ? CAT[y.l.cat].l : y.l.cat));
  else if (cle === "ko") d = x.l.nb - y.l.nb;
  else if (cle === "src") d = String(x.l.src).localeCompare(String(y.l.src));
  else if (cle === "op") d = String((x.ops || [])[0] || "").localeCompare(String((y.ops || [])[0] || ""), "fr");
  return s * d || y.c.periode.localeCompare(x.c.periode) || (y.l.nb - x.l.nb);
}
function renderQualifies(){
  const cs = selCells(), a = agg(cs);
  const rows = Object.entries(a.cat).map(([k, v]) => ({ k, l: CAT[k] ? CAT[k].l : k, n: v.doc + v.man, doc: v.doc, man: v.man }))
    .filter(r => r.n > 0.0001).sort((x, y) => y.n - x.n);
  const mx = rows.length ? rows[0].n : 1;
  $("#causes-sub").textContent = a.jtot ? n0(a.jtot) + " KO retirés · " + ptf(a.net - a.brut) + " de taux" : "";
  $("#causes").innerHTML = rows.length
    ? rows.map(r => {
        const pts = r.n / (a.flux || 1) * 100;
        /* La barre montre la part sur pièce et la part d'analyse au lieu de teindre
           toute la cause selon sa majorité : à 51 % contre 49 % l'ancienne version
           basculait d'une couleur à l'autre sans que rien n'ait vraiment changé. */
        const wd = (r.doc / mx * 100).toFixed(1), wm = (r.man / mx * 100).toFixed(1);
        return '<div style="display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;margin-bottom:11px">' +
          '<div style="font-size:13px;display:flex;align-items:center;gap:7px"><i class="chip-c" style="background:var(--c-expl)"></i>' + esc(r.l) + "</div>" +
          '<div class="ref nowrap">' + n0(r.n) + " KO · +" + dec(pts, 2) + " pt</div>" +
          '<div class="cbar">' +
            (r.doc > 0.05 ? '<i class="piece" style="width:' + wd + '%"></i>' : "") +
            (r.man > 0.05 ? '<i class="analyse" style="width:' + wm + '%"></i>' : "") +
          "</div></div>";
      }).join("") +
      '<div class="ckey"><span><i class="piece"></i>appuyé sur une pièce</span>' +
      '<span><i class="analyse"></i>établi par votre analyse</span></div>'
    : '<div class="empty"><b>Rien de retiré pour l\'instant</b>Le net est égal au brut sur ce périmètre.</div>';

  const flat = [];
  /* L'opérateur est lu une fois par ligne : il sert à la fois à la recherche,
     au tri et à la colonne — le relire trois fois coûterait un parcours du
     contexte des KO à chaque frappe. */
  cs.forEach(c => c.lignes.forEach(l => flat.push({ c, l, ops: opsRef(c, l.ref, l.postes) })));
  /* La colonne apparaît dès qu'il y a de la réception à l'écran, même sans
     valeur : une colonne qui disparaît laisse croire à un défaut d'affichage,
     alors qu'il ne manque qu'une colonne dans l'export. */
  const opDsp = opDispo(cs);
  const opCol = flat.some(x => x.c.service === "recep");
  /* Un numéro tapé avec ses zéros de tête doit retrouver la DT enregistrée sans. */
  const qs = sansZeros(S.ui.q).toLowerCase();
  const sel = flat.filter(({ c, l, ops }) =>
    (!S.ui.qsrc || l.src === S.ui.qsrc) && (!S.ui.qst || l.st === S.ui.qst) && (!S.ui.qcat || l.cat === S.ui.qcat) &&
    (!qs || (l.ref + " " + (l.postes || []).join(" ") + " " + (CAT[l.cat] ? CAT[l.cat].l : l.cat) +
             " " + l.com + " " + perLabel(c.periode) + " " + ops.join(" ")
            ).toLowerCase().includes(qs)))
    .sort(triReg);
  const cs2 = $("#q-cat");
  if (cs2 && document.activeElement !== cs2){
    const present = Array.from(new Set(flat.map(x => x.l.cat)));
    cs2.innerHTML = '<option value="">Toutes causes</option>' +
      CATS.filter(c => present.indexOf(c.k) >= 0).map(c => '<option value="' + c.k + '">' + esc(c.l) + "</option>").join("");
    cs2.value = S.ui.qcat;
  }
  regList = sel;                       /* ce que l'export Excel reprendra */
  const filt = S.ui.q || S.ui.qcat || S.ui.qsrc || S.ui.qst;
  $("#reg-foot").innerHTML = '<span class="muted" style="font-size:12px">' +
    n0(sel.length) + (sel.length > 1 ? " lignes" : " ligne") + " sur " + n0(flat.length) + " · " +
    n0(sel.filter(x => x.l.st === "ok").reduce((s, x) => s + x.l.nb, 0)) + " KO retirés</span>" +
    (filt ? ' <button class="btn sm" id="btn-clear-q" style="margin-left:10px">Retirer les filtres</button>' : "") +
    /* dire pourquoi la colonne est vide vaut mieux que la faire disparaître */
    (opCol && !opDsp.col
      ? '<div class="note" style="margin-top:10px;border-left-color:var(--warn)"><b>Colonne Opérateur vide.</b> ' +
        (opDsp.ctx
          ? "L'export chargé porte bien les colonnes de contexte, mais aucune ne nomme le collaborateur. " +
            "Au moment d'exporter depuis PowerBI, cochez tout dans <b>Détails lignes PowerBI</b> et <b>Dimensions</b> — " +
            "c'est là que sort <code>ID Collaborateur</code>."
          : "Les périodes affichées ont été chargées avant que l'outil ne conserve le contexte des KO. " +
            "Réimportez l'export PowerBI de ces semaines depuis l'onglet <b>Import</b> : l'opérateur apparaîtra " +
            "sans que vos justifications bougent.") +
        ' <button class="btn sm" data-tabgo="import" style="margin-top:8px">Aller à l\'import</button></div>'
      : "");
  $("#reg").innerHTML = sel.length
    ? '<table data-tritable="reg"><thead><tr>' +
      th("date", "Date", S.ui.regTri, S.ui.regSens) +
      th("per", "Période", S.ui.regTri, S.ui.regSens) +
      th("perim", "Périmètre", S.ui.regTri, S.ui.regSens) +
      th("ref", "Réf.", S.ui.regTri, S.ui.regSens) +
      th("cause", "Cause", S.ui.regTri, S.ui.regSens) +
      th("ko", "KO", S.ui.regTri, S.ui.regSens, "n") +
      (opCol ? th("op", "Opérateur", S.ui.regTri, S.ui.regSens, "", "Le collaborateur qui a traité le flux — la réception seulement") : "") +
      th("src", "Source", S.ui.regTri, S.ui.regSens) +
      "<th>Note</th><th></th></tr></thead><tbody>" +
      sel.slice(0, 400).map(({ c, l, ops }) =>
        '<tr data-fiche="' + c.id + "|" + l.id + '"><td class="ref nowrap">' + frDay(l.d || dateOfRef(c, l.ref)) + "</td>" +
        '<td class="nowrap">' + perLabel(c.periode) + "</td>" +
        '<td class="nowrap muted">' + SITES[c.site].l + " · " + (c.service === "distri" ? "Distri" : "Récep") + "</td>" +
        '<td class="ref">' + (l.ref ? esc(l.ref) : '<span class="muted">lot</span>') +
          ((l.postes || []).length ? ' <span class="pill po" title="poste ' + esc(l.postes.join(", ")) + '">p. ' + esc(l.postes.slice(0, 3).join(", ")) + (l.postes.length > 3 ? "…" : "") + "</span>" : "") + "</td>" +
        "<td>" + esc(CAT[l.cat] ? CAT[l.cat].l : l.cat) + (l.st === "rejet" ? ' <span class="pill rejet" title="La cause est enregistrée, mais elle ne retire pas le KO du décompte">KO maintenu</span>' : "") + "</td>" +
        '<td class="n">' + n0(l.nb) + "</td>" +
        /* Une case vide dit « sans objet » — la distribution n'a pas d'opérateur ;
           un tiret dit « pas de valeur » pour une réception qui devrait en avoir. */
        (opCol ? '<td class="nowrap">' + (ops.length
            ? ops.slice(0, 3).map(o => '<span class="pill op">' + esc(o) + "</span>").join(" ") +
              (ops.length > 3 ? ' <span class="muted">+' + (ops.length - 3) + "</span>" : "")
            : c.service !== "recep" ? ""
            : '<span class="muted" title="' + (opDsp.col
                ? "non renseigné pour ce flux dans l'export chargé"
                : "l'export chargé ne porte pas la colonne du collaborateur") + '">—</span>') + "</td>" : "") +
        '<td><span class="pill ' + l.src + '">' + SRC[l.src] + "</span></td>" +
        '<td class="muted trunc" style="max-width:230px" title="' + esc(l.com) + '">' + esc(l.com) + "</td>" +
        '<td class="nowrap"><button class="btn sm" data-edit="' + c.id + "|" + l.id + '">Éditer</button> <button class="btn sm danger" data-del="' + c.id + "|" + l.id + '">×</button></td></tr>').join("") +
      "</tbody></table>"
    : '<div class="empty"><b>Aucune justification sur ce filtre</b>Qualifiez des retards dans l\'onglet « À justifier ».</div>';
}

/* ---------------------------- à justifier ---------------------------- */
let qList = [];
/* Tri des tableaux de détail : une colonne, un sens, mémorisés dans S.ui. */
function cmpTri(a, b, cle){
  switch (cle){
    case "date":   return String(a.d || "").localeCompare(String(b.d || ""));
    case "ref":    return String(a.ref).localeCompare(String(b.ref), "fr", { numeric:true });
    case "ko":     return a.n - b.n;
    case "per":    return a.cell.periode.localeCompare(b.cell.periode);
    case "op":     return String((a.ops || [])[0] || "").localeCompare(String((b.ops || [])[0] || ""), "fr");
    /* les retards inconnus en fin de liste, dans les deux sens */
    case "ret":    { const x = a.ret ? a.ret.v : null, y = b.ret ? b.ret.v : null;
                     if (x == null && y == null) return 0;
                     if (x == null) return 1; if (y == null) return -1;
                     return x - y; }
    default:       return 0;
  }
}
function triAJ(a, b){
  const s = S.ui.ajSens || -1;
  return s * cmpTri(a, b, S.ui.ajTri || "ko")
    || b.n - a.n || a.cell.periode.localeCompare(b.cell.periode) || (a.ref > b.ref ? 1 : -1);
}
/* En-tête cliquable : la flèche dit la colonne et le sens en cours. */
function th(cle, libelle, tri, sens, cls, aide){
  const actif = tri === cle;
  return '<th data-tri="' + cle + '"' + (cls ? ' class="' + cls + '"' : "") +
    ' title="' + (aide ? esc(aide) + " — cliquer pour trier" : "Trier par " + esc(libelle.toLowerCase())) + '">' + esc(libelle) +
    '<span class="tri' + (actif ? " on" : "") + '">' + (actif ? (sens < 0 ? "▼" : "▲") : "↕") + "</span></th>";
}
function renderAJustifier(){
  const qAll = toQualify();
  const lots = {};
  qAll.forEach(r => { lots[r.cell.id] = (lots[r.cell.id] || 0) + r.n; });
  const sc = $("#q-scope");
  if (sc && document.activeElement !== sc){
    if (!lots[S.ui.qscope]) S.ui.qscope = "";
    sc.innerHTML = '<option value="">Tous les lots — ' + n0(qAll.reduce((s, r) => s + r.n, 0)) + " KO</option>" +
      Object.keys(lots).sort().reverse().map(id => { const c = realCell(id);
        if (!c) return "";
        return '<option value="' + esc(id) + '"' + (id === S.ui.qscope ? " selected" : "") + ">" +
          esc(perLabel(c.periode) + " · " + SITES[c.site].l + " · " + (c.service === "distri" ? "Distri" : "Récep")) +
          " — " + n0(lots[id]) + " KO</option>"; }).join("");
  }
  const ajq = sansZeros(S.ui.ajq || "").toLowerCase();
  /* La colonne n'apparaît que si la sélection contient de la réception : en
     distribution, « ID Collaborateur » porte un emplacement, pas une personne. */
  const opVisible = qAll.some(r => (r.ops || []).length);
  qList = (S.ui.qscope ? qAll.filter(r => r.cell.id === S.ui.qscope) : qAll)
    .filter(r => !ajq || (String(r.ref) + " " + r.postes.join(" ") + " " + (r.ops || []).join(" ")).toLowerCase().includes(ajq))
    .slice().sort(triAJ);
  const qKo = qList.reduce((s, r) => s + r.n, 0);
  $("#q-all-lbl").textContent = "Tout cocher (" + n0(qList.length) + ")";
  const nPostes = qList.reduce((s, r) => s + r.postes.length, 0);
  $("#q-count").textContent = qList.length
    ? n0(qKo) + " KO · " + n0(qList.length) + " demandes" + (nPostes ? " · " + n0(nPostes) + " postes identifiés" : "") : "";
  $("#cnt-aj").textContent = n0(qAll.reduce((s, r) => s + r.n, 0));
  const show = Math.min(S.ui.qshow, qList.length);
  $("#aqualifier").innerHTML = qList.length
    ? '<div class="tw"><table data-tritable="aj"><thead><tr><th style="width:26px"></th>' +
      th("ref", "Référence", S.ui.ajTri, S.ui.ajSens) +
      th("date", "Date", S.ui.ajTri, S.ui.ajSens) +
      th("ret", "Retard", S.ui.ajTri, S.ui.ajSens, "n",
        "L'écart entre l'attendu et le réel, compté en jours ouvrés — samedis, dimanches et fériés déduits, " +
        "d'après le calendrier que l'export applique lui-même. " +
        "En distribution, l'écart à l'échéance : J+0 veut dire terminé le jour de l'échéance, alors que la confirmation " +
        "devait tomber la veille ouvrée ; J−1 et au-delà, le flux s'est terminé avant son échéance. " +
        "En réception, ce qui dépasse l'objectif de délai. " +
        "Les flux urgents — KPI 5.2 et 2.2 — se comptent en heures : « +3,3 h ».") +
      th("ko", "KO", S.ui.ajTri, S.ui.ajSens, "n") +
      (opVisible ? th("op", "Opérateur", S.ui.ajTri, S.ui.ajSens) : "") +
      th("per", "Période · périmètre", S.ui.ajTri, S.ui.ajSens) +
      '<th class="n">Qualifier en un clic</th></tr></thead><tbody>' +
      qList.slice(0, show).map(r => {
        const qk = QUICK[r.cell.service] || [], tail = "|" + esc(r.ref) + "|";
        const part = r.total > r.n;
        return '<tr data-ko="' + esc(r.cell.id) + "|" + esc(r.ref) + "|" + r.n + "|" + esc(r.d || "") + '"><td><input type="checkbox" class="qbox" data-cell="' + esc(r.cell.id) + '" data-ref="' + esc(r.ref) + '" data-n="' + r.n + '"></td>' +
          '<td class="ref nowrap">' + esc(r.ref) +
            (r.postes.length ? ' <span class="pill po" title="postes ' + esc(r.postes.slice(0, 14).join(", ")) + (r.postes.length > 14 ? "…" : "") + '">' + r.postes.length + " poste" + (r.postes.length > 1 ? "s" : "") + "</span>" : "") + "</td>" +
          '<td class="ref nowrap muted">' + frDay(r.d) + "</td>" +
          '<td class="n nowrap' + (r.ret ? (r.ret.v > 0 ? " ret-tard" : r.ret.v < 0 ? " ret-tot" : " ret-jour") : " muted") + '"' +
            (r.ret && r.ret.d ? ' title="' + esc(r.ret.d) + '"' : "") + ">" +
            (r.ret ? esc(r.ret.t) : "—") + "</td>" +
          '<td class="n"' + (r.n > 1 ? ' style="color:var(--ink)"' : ' style="color:var(--muted)"') + ">" + r.n +
            (part ? '<span class="muted" style="font-weight:400"> / ' + r.total + "</span>" : "") + "</td>" +
          (opVisible ? '<td class="nowrap">' + ((r.ops || []).length
              ? (r.ops || []).slice(0, 3).map(o => '<span class="pill op">' + esc(o) + "</span>").join(" ") +
                ((r.ops || []).length > 3 ? ' <span class="muted">+' + ((r.ops || []).length - 3) + "</span>" : "")
              : '<span class="muted">—</span>') + "</td>" : "") +
          '<td class="nowrap muted">' + perLabel(r.cell.periode) + " · " + SITES[r.cell.site].l + " · " + (r.cell.service === "distri" ? "Distri" : "Récep") + "</td>" +
          '<td><div class="qq">' + qk.map(k => '<button data-qq="' + r.cell.id + tail + k + "|" + r.n + '">' + esc(CAT[k].l) + "</button>").join("") +
          '<button class="more" data-qq="' + r.cell.id + tail + "_more|" + r.n + '">Autre…</button></div></td></tr>';
      }).join("") + "</tbody></table></div>" +
      (show < qList.length ? '<div style="padding:11px 18px;border-top:1px solid var(--line)"><button class="btn" id="btn-qmore">Afficher 40 de plus <span class="muted">(' + n0(qList.length - show) + " restants)</span></button></div>" : "")
    : '<div class="empty"><b>' + (qAll.length ? "Ce lot est entièrement qualifié" : "Rien en attente") + "</b>" +
      (qAll.length ? "Choisissez un autre lot ci-dessus." : "Les références apparaissent ici après un import d'export.") + "</div>";
}

/* ---------------------------- saisie ---------------------------- */
function renderCellsTable(){
  const list = Object.values(S.cells).sort((a, b) => b.periode.localeCompare(a.periode) || a.site.localeCompare(b.site) || a.service.localeCompare(b.service));
  const ps = $("#per-sub");
  if (ps){ const ks = periodKeys(Object.values(S.cells)), hp = horsPlancher().length;
    ps.textContent = list.length
      ? n0(list.length) + " lignes · " + (ks.length ? perLabel(ks[0]) + " → " + perLabel(ks[ks.length - 1]) : "") +
        (hp ? " · " + n0(hp) + " hors affichage" : "")
      : "Rien d'enregistré"; }
  if (typeof majPlancherHint === "function") majPlancherHint();
  $("#cells-tbl").innerHTML = list.length
    ? '<table><thead><tr><th>Période</th><th>Site</th><th>Service</th><th class="n">Flux</th><th class="n">KO</th><th class="n">Brut</th><th class="n">Justifiés</th><th class="n">Net</th><th>Source</th><th></th></tr></thead><tbody>' +
      list.map(c => { const st = cellStats(c), br = c.flux ? (c.flux - c.ko) / c.flux : null, ne = c.flux ? (c.flux - c.ko + st.tot) / c.flux : null;
        return '<tr data-cellrow="' + c.id + '"><td class="nowrap"><b>' + perLabel(c.periode) + '</b> <span class="muted" style="font-size:11px">' + weekSpan(c.periode) + "</span>" +
          (c.demo ? ' <span class="pill demo">exemple</span>' : "") +
          (apresPlancher(c) ? "" : ' <span class="pill" title="Enregistrée et justifiée, mais antérieure à la date de début du tableau de bord">hors affichage</span>') + "</td>" +
          "<td>" + SITES[c.site].l + "</td><td>" + SERVS[c.service].l + "</td>" +
          '<td class="n">' + n0(c.flux) + '</td><td class="n">' + n0(c.ko) + '</td><td class="n">' + pf(br) + "</td>" +
          '<td class="n">' + n0(st.tot) + '</td><td class="n">' + pf(ne) + "</td>" +
          '<td class="muted trunc" style="max-width:190px;font-size:12px" title="' + esc(c.note) + '">' + esc(c.note) + "</td>" +
          '<td class="nowrap"><button class="btn sm" data-cedit="' + c.id + '">Éditer</button> <button class="btn sm danger" data-cdel="' + c.id + '">×</button></td></tr>'; }).join("") +
      "</tbody></table>"
    : '<div class="empty"><b>Aucune période enregistrée</b>Collez un export, ou saisissez le brut ci-dessus.</div>';
}

/* ---------------------------- règles ---------------------------- */
function phraseRegle(r){
  const op = k => (OPS_COL.find(o => o.k === k) || {}).l || k;
  if (r.type === "liste")
    return "les références d'une liste de " + n0((r.refs || []).length) + " numéro(s)";
  if (r.type === "dates"){
    const o = (OPS_ECART.find(x => x.k === r.opD) || {}).l || r.opD;
    return "l'écart entre <code>" + esc(r.dateA) + "</code> et <code>" + esc(r.dateB) + "</code> est " +
      o + " " + n0(r.nD) + (r.ouvres !== false ? " jour(s) ouvré(s)" : " jour(s)") +
      ((r.conds || []).length ? ", et " + r.conds.map(c => "<code>" + esc(c.col) + "</code> " + op(c.op) +
        (c.val ? " « " + esc(c.val) + " »" : "")).join(", et ") : "");
  }
  return (r.conds || []).map(c => "<code>" + esc(c.col) + "</code> " + op(c.op) +
    (c.val ? " « " + esc(c.val) + " »" : "")).join(", et ") || "aucune condition";
}
/* La réédition de poste BR : une justification automatique, mais fournie par
   l'outil et non par une règle. Elle a sa carte ici pour que les deux mécanismes
   se voient au même endroit — en lecture seule, elle ne se règle pas. */
/* ------------------ pourquoi le brut diffère de celui de PowerBI ------------------
   PowerBI compte les réceptions en litige ; l'outil les écarte, exprès. C'est la
   principale source d'écart sur la réception, et elle n'était écrite nulle part :
   on voyait deux taux « bruts » différents sans savoir lequel croire. Ici on
   affiche les deux, et d'où vient la différence. */
function ecartLitige(recep, ecartes){
  const f = recep.reduce((s, c) => s + (c.flux || 0), 0);
  const k = recep.reduce((s, c) => s + (c.ko || 0), 0);
  if (!f || !ecartes) return "";
  const kl = recep.reduce((s, c) => s + (c.litigesKo || 0), 0);
  const inconnu = recep.some(c => (c.litiges || 0) > 0 && c.litigesKo == null);
  const brut = 100 * (f - k) / f;
  const tout = 100 * (f + ecartes - k - kl) / (f + ecartes);
  return "<b>PowerBI, lui, les compte.</b> C'est de là que vient l'essentiel de l'écart entre les deux " +
    "chiffres&nbsp;: sur la plage affichée, l'outil lit <b>" + dec(brut, 2) + "&nbsp;%</b> de brut sur " +
    n0(f) + " flux" +
    (inconnu
      ? ", et PowerBI en compte " + n0(ecartes) + " de plus. Un réimport de ces semaines dira combien d'entre eux sont KO."
      : ", PowerBI <b>" + dec(tout, 2) + "&nbsp;%</b> sur " + n0(f + ecartes) + " — " +
        n0(kl) + " des " + n0(ecartes) + " flux écartés étaient KO, d'où " +
        (tout < brut ? "un brut PowerBI plus bas de " + dec(brut - tout, 2) : "un brut PowerBI plus haut de " + dec(tout - brut, 2)) +
        "&nbsp;point" + (Math.abs(brut - tout) >= 2 ? "s" : "") + ".") +
    " Aucun des deux n'est faux&nbsp;: ils ne répondent pas à la même question.";
}
/* Les règles que l'outil applique de lui-même, avec leur effet réel sur la plage
   affichée. Elles étaient invisibles ou décrites à tort comme manuelles : une règle
   qu'on ne voit pas est une règle qu'on ne peut pas contester. */
function renderFournies(){
  const host = $("#regles-fournies"); if (!host) return;
  const cs = selCells().map(c => realCell(c) || c).filter((c, i, l) => l.findIndex(x => x.id === c.id) === i);
  const a = agg(selCells());
  const flux = a.flux || 1;

  /* 1. la réception hors litiges, appliquée au moment de l'import */
  const recep = cs.filter(c => c.service === "recep");
  const ecartes = recep.reduce((s, c) => s + (c.litiges || 0), 0);
  const sansCompte = recep.filter(c => c.litiges == null).length;

  /* 2. les postes recréés : ce que la règle retire vraiment, et ce qui lui manque */
  let reedKo = 0, reedLignes = 0, reedConnus = 0, reedTard = 0;
  cs.forEach(c => {
    (c.lignes || []).forEach(l => { if (l.regle === REGLE_REED && l.st === "ok"){ reedLignes++; reedKo += l.nb; } });
    for (const k in (c.reed || {})){ reedConnus++;
      const v = c.reed[k]; if (!(v.reel != null && v.reel <= v.obj)) reedTard++; }
  });
  const sansPreuve = recep.filter(c => c.ko > 0 && !Object.keys(c.reed || {}).length);

  const carte = (titre, quoi, meta, etat, impact, bouton) =>
    '<div class="mcard fixe"><div class="mmain"><b>' + titre + "</b>" +
      '<div class="rcond">' + quoi + "</div>" +
      '<div class="rmeta">' + meta.map(x => "<span>" + x + "</span>").join("") + "</div>" +
      (etat ? '<div class="rcond" style="margin-top:7px">' + etat + "</div>" : "") +
    '</div><div class="ract"><span class="rimpact">' + impact + "</span>" + (bouton || "") + "</div></div>";

  host.innerHTML = '<div class="flab">Règles de l\'outil — appliquées toutes seules</div>' +
    '<p class="gp">Elles repassent à chaque import, sans rien à valider. Elles se défont d\'elles-mêmes ' +
    'si la donnée cesse de les porter.</p>' +
    '<div class="mlist">' +
    carte("Réception hors litiges",
      "À l'import, tout flux de réception dont le <code>Statut litige</code> n'est pas « Non concerné » " +
      "sort du décompte : le litige a arrêté le temps, le flux n'est ni OK ni KO.",
      ["Réception", "S'applique à l'import", "retire le flux du décompte"],
      sansCompte
        ? '<span class="wtxt">' + n0(sansCompte) + " période(s) chargée(s) avant que l'outil ne compte les litiges</span> — " +
          "leur nombre n'est pas connu. Un réimport de ces semaines le rétablit."
        : (recep.length && !ecartes
          ? "Aucun flux en litige dans les exports chargés : le filtre est probablement déjà appliqué en amont, "
            + "dans PowerBI. La règle reste en place — elle agira le jour où un export en portera."
          /* C'est ici que se loge l'essentiel de l'écart avec PowerBI sur la
             réception : PowerBI compte ces flux, l'outil non. Autant l'écrire,
             avec le chiffre, plutôt que de laisser chercher. */
          : (ecartes ? ecartLitige(recep, ecartes) : "")),
      ecartes ? n0(ecartes) + " flux écartés"
        : (recep.length ? "rien à écarter" : "aucune réception"), "") +
    carte("Litige BR réédité",
      "Quand SAP recrée un poste BR après un litige, le KPI continue de compter depuis la première " +
      "création. La règle recompte le délai <b>depuis la recréation</b> et retire les postes qui " +
      "tiennent l'objectif — 3 h si le flux est urgent, 2 jours ouvrés sinon. Trois formes la " +
      "déclenchent : un <code>N° Poste Référence</code> ; le même poste de commande repris plus tard " +
      "sur un BR en litige ; et un poste <b>redivisé après coup</b> — même poste de commande, créé " +
      "plus d'un jour après ses voisins, sans incident déclaré. Les postes nés avec le BR, eux, " +
      "sont de simples éclatements de ligne : ils restent comptés.",
      ["Réception", "Compte comme : Automatique", "retire les KO du décompte",
       "passe avant les vôtres et avant une saisie à la main"],
      reedConnus
        ? "La preuve vient de l'extraction SAP, déposée une fois : la règle la rejoue ensuite seule, " +
          "à chaque import. <b>" + n0(reedConnus) + " poste" + sPl(reedConnus) + " recréé" + sPl(reedConnus) +
          "</b> connu" + sPl(reedConnus) + " sur la plage" +
          (reedTard ? ". " + n0(reedTard) + " d'entre eux dépassent l'objectif même depuis la recréation : " +
            "ils restent comptés, et leur fiche montre les deux mesures" : "") + "." +
          (sansPreuve.length
            ? ' <span class="wtxt">' + n0(sansPreuve.length) + " période(s) de réception sans aucune donnée SAP</span> — " +
              esc(sansPreuve.slice(0, 3).map(c => perLabel(c.periode) + " · " + SITES[c.site].l).join(", ")) +
              (sansPreuve.length > 3 ? " et " + n0(sansPreuve.length - 3) + " autre(s)" : "") +
              ". Chargez l'extraction qui les couvre."
            : "")
        : "<b>En attente de l'extraction SAP.</b> La date de recréation n'existe que dans SAP : " +
          "l'export PowerBI ne porte pas cette colonne. Une fois l'extraction déposée, la règle " +
          "tourne seule et n'a plus besoin du fichier.",
      reedKo ? n0(reedKo) + " KO · " + ptf(reedKo / flux) : "aucun KO",
      '<button class="btn sm" id="btn-go-sap">' + (reedConnus ? "Mettre à jour depuis SAP" : "Charger l\'extraction SAP") + "</button>") +
    "</div>";
}
function renderModeles(){
  const host = $("#regles-modeles"); if (!host) return;
  const posees = {}; S.regles.forEach(r => { posees[normVal(r.nom)] = 1; });
  const list = MODELES.filter(m => modeleDispo(m) && !posees[normVal(m.r.nom)]);
  if (!list.length){ host.innerHTML = ""; return; }
  host.innerHTML = '<div class="flab">Règles prêtes à l\'emploi</div>' +
    '<p class="gp">Mesurées sur les périodes affichées. Le bouton ouvre la règle pré-remplie : ' +
    'rien n\'est enregistré avant que vous validiez.</p>' +
    '<div class="mlist">' + list.map(m => {
      const e = simuleEffet(modeleRegle(m));
      const pt = e.n && e.avant.net != null && e.apres.net != null
        ? (e.apres.net - e.avant.net) * 100 : 0;
      return '<div class="mcard"><div class="mmain"><b>' + esc(m.titre) + "</b>" +
        '<div class="rcond">' + esc(m.pour) + "</div></div>" +
        '<div class="ract"><span class="rimpact">' +
          (e.n ? n0(e.n) + " KO" + (pt > 0.004 ? " · +" + dec(pt, 2) + " pt" : " · déjà couverts") : "aucun KO") +
        "</span>" +
        '<button class="btn sm" data-rmod="' + m.k + '"' + (e.n ? "" : " disabled") + ">Voir la règle</button></div></div>";
    }).join("") + "</div>";
}
/* ---- vos saisies à la main, par cause ----
   Une saisie posée il y a deux mois survit à tout : au réimport, au changement
   de règles, à la suppression de la règle qui porte la même cause — puisque ce
   n'est pas la règle qui l'a posée. Sans un endroit pour les revoir, on cherche
   longtemps pourquoi une cause « reste » alors qu'on a tout retiré. */
function mainsParCause(){
  const par = {};
  const vus = {};
  selCells().forEach(c0 => { const c = realCell(c0) || c0; vus[c.id] = c; });
  /* Toute ligne qui n'est ni une règle ni un relevé. Une ligne « automatique »
     sans règle est une orpheline d'un vieil import : elle se comporte comme une
     saisie, elle doit donc se voir et se défaire comme une saisie — tant qu'on
     ne listait que `manuel`, elle était introuvable. */
  Object.values(vus).forEach(c => (c.lignes || []).forEach(l => {
    if (l.regle || l.src === "releve") return;
    const g = par[l.cat] || (par[l.cat] = { cat:l.cat, lignes:0, ko:0, refs:new Set(), srcs:new Set() });
    g.lignes++; g.ko += Math.max(0, +l.nb || 0); g.refs.add(sansZeros(l.ref));
    g.srcs.add(l.src === "manuel" ? "manuel" : "orpheline");
  }));
  return Object.values(par).sort((a, b) => b.ko - a.ko);
}
function renderMains(){
  const host = $("#mains-liste"); if (!host) return;
  const list = mainsParCause();
  const tot = list.reduce((s, g) => s + g.ko, 0);
  const sub = $("#mains-sub");
  if (sub) sub.textContent = tot
    ? n0(tot) + " KO qualifiés à la main, en " + n0(list.length) + " cause" + (list.length > 1 ? "s" : "")
    : "Rien de saisi à la main sur cette plage";
  if (!list.length){
    host.innerHTML = '<div class="empty"><b>Aucune saisie à la main ici</b>' +
      "Tout ce qui est qualifié vient d'un relevé, de SAP ou d'une règle.</div>";
    return;
  }
  host.innerHTML = '<div class="rlist">' + list.map(g => {
    const c = CAT[g.cat];
    return '<div class="rcard"><div class="rmain"><b>' + esc(c ? c.l : g.cat) + "</b>" +
      '<div class="rcond">' + n0(g.ko) + " KO · " + n0(g.lignes) + " ligne" + (g.lignes > 1 ? "s" : "") +
        " · " + n0(g.refs.size) + " référence" + (g.refs.size > 1 ? "s" : "") + "</div>" +
      '<div class="rmeta"><span>' +
        (c && c.j ? "retire les KO du décompte" : "gardée pour la trace — le KO reste compté") + "</span>" +
        "<span>une règle peut la reprendre</span>" +
        (g.srcs.has("orpheline")
          ? '<span class="warn-t">dont des lignes « automatique » sans règle — un vieil import</span>' : "") +
        "</div></div>" +
      '<div class="ract"><button class="btn sm" data-mainmv="' + esc(g.cat) + '">Changer la cause</button>' +
      '<button class="btn sm danger" data-maindel="' + esc(g.cat) + '">Retirer</button></div></div>';
  }).join("") + "</div>";
}
/* Vos causes, telles qu'on les revoit : ce qu'elles font au chiffre, et de quoi
   les retirer. Une cause retirée ne supprime pas les justifications déjà
   posées — elles retombent en « Autre » et restent lisibles. */
function renderMesCauses(){
  const host = $("#mes-causes"); if (!host) return;
  const list = mesCauses();
  if (!list.length){ host.innerHTML = '<p class="hint" style="margin:10px 0 0">Aucune pour l\'instant — ' +
    "l'outil en propose vingt-six, elles suffisent souvent.</p>"; return; }
  const usage = k => {
    let n = 0;
    Object.values(S.cells).forEach(c => (c.lignes || []).forEach(l => { if (l.cat === k) n++; }));
    return n + (S.regles || []).filter(r => r.cause === k).length * 0;
  };
  host.innerHTML = '<div class="mlist" style="margin-top:10px">' + list.map(c => {
    const n = usage(c.k), nr = (S.regles || []).filter(r => r.cause === c.k).length;
    return '<div class="mcard fixe"><div class="mmain"><b>' + esc(c.l) + "</b>" +
      '<div class="rcond">' + (c.j
        ? "Retire le KO du décompte."
        : '<span class="wtxt">Ne retire pas le KO</span> — la ligne est gardée pour la trace.') +
      " " + (c.p === "tous" ? "Les deux services." : c.p === "distri" ? "Distribution." : "Réception.") +
      (c.d ? ' <span class="muted">' + esc(c.d) + "</span>" : "") + "</div>" +
      '<div class="rmeta">' + (n ? n0(n) + " justification" + sPl(n) + " posée" + sPl(n) : "pas encore employée") +
        (nr ? " · " + n0(nr) + " règle" + sPl(nr) + " s'en sert" : "") + "</div></div>" +
      '<div class="ract"><button class="btn sm danger" data-catdel="' + esc(c.k) + '">Retirer</button></div></div>';
  }).join("") + "</div>";
}
function renderRegles(){
  renderFournies();
  renderModeles();
  const host = $("#regles-liste"); if (!host) return;
  const sub = $("#reg-sub");
  const dispo = ctxColonnes().length;
  if (sub) sub.textContent = S.regles.length
    ? n0(S.regles.filter(r => r.actif).length) + " active(s) sur " + n0(S.regles.length)
    : "Justifier tout seul ce que les données montrent";
  if (!dispo){
    host.innerHTML = '<div class="note" style="border-left-color:var(--warn)"><b>Aucune colonne disponible pour l\'instant.</b> ' +
      "Les règles lisent les colonnes de l'export conservées avec chaque KO. Importez un export PowerBI pour les rendre accessibles.</div>";
    return;
  }
  if (!S.regles.length){
    host.innerHTML = '<div class="empty"><b>Aucune règle pour l\'instant</b>' +
      n0(dispo) + " colonnes de l'export sont disponibles pour en écrire une.</div>";
    return;
  }
  const cfl = conflitsRegles();
  /* une règle aveugle reste affichée comme active : le dire sur sa carte */
  const aveugles = {};
  const cellsKo = Object.values(S.cells).filter(c => (c.koRefs || []).length);
  S.regles.filter(r => r.actif).forEach(r => {
    const n = cellsKo.filter(c => !regleEvaluable(r, c)).length;
    if (n) aveugles[r.id] = n;
  });
  const perdu = {}, gagne = {};
  cfl.forEach(c => { perdu[c.b] = (perdu[c.b] || 0) + c.n; (gagne[c.b] = gagne[c.b] || []).push(c.na); });
  const imp = impactsRegles();
  host.innerHTML = (cfl.length
    ? '<div class="note" style="border-left-color:var(--warn)"><b>Deux règles visent les mêmes KO.</b> ' +
      "Un KO ne reçoit qu'une cause : c'est la règle la plus haute dans la liste qui la pose. " +
      cfl.slice(0, 3).map(c => "<b>" + esc(c.na) + "</b> prend " + n0(c.n) + " KO à <b>" + esc(c.nb) + "</b>").join(" · ") +
      (cfl.length > 3 ? " · et " + n0(cfl.length - 3) + " autre(s)" : "") +
      ". Les flèches ↑ ↓ changent qui passe en premier — le compte de chaque règle suit.</div>"
    : "") +
    '<div class="rlist">' + S.regles.map((r, idx) => {
    /* Ce qu'elle pose, les autres en place — et sa portée seule quand les deux
       diffèrent : c'est là que se lit le départage. */
    const n = r.actif ? (imp.pose[r.id] || 0) : 0;
    const seule = simuleRegle(r);
    const tenu = (r.actif && imp.tenus[r.id]) || null;
    return '<div class="rcard' + (r.actif ? "" : " off") + '">' +
      '<label class="sw" title="' + (r.actif ? "Désactiver" : "Activer") + '"><input type="checkbox" data-ract="' + r.id + '"' +
        (r.actif ? " checked" : "") + '><i></i></label>' +
      '<div class="rmain"><b>' + esc(r.nom) + "</b>" +
        '<div class="rcond">Quand ' + phraseRegle(r) + " → <b>" + esc(CAT[r.cause] ? CAT[r.cause].l : r.cause) + "</b></div>" +
        '<div class="rmeta"><span>' + (r.service === "tous" ? "Les deux services" : SERVS[r.service].l) + "</span>" +
        "<span>Compte comme : " + esc(SRC[r.src] || r.src) + "</span>" +
        "<span>" + (CAT[r.cause] && CAT[r.cause].j ? "retire les KO du décompte" : "gardée pour la trace — le KO reste compté") + "</span>" +
        "<span>passe devant une saisie à la main, jamais devant le relevé</span>" +
        (perdu[r.id] ? '<span class="warn-t">' + n0(perdu[r.id]) + " KO pris par " + esc(gagne[r.id].join(", ")) + "</span>" : "") +
        /* Remonter la règle ne les lui rendra pas : ce n'est pas une autre règle
           qui les tient, et c'est la seule chose que l'écran ne disait pas. */
        (tenu ? Object.keys(tenu).sort((a, b) => tenu[b] - tenu[a]).map(k =>
          '<span class="warn-t">' + n0(tenu[k]) + " KO visés, " + esc(TENU_LBL[k] || TENU_LBL.autre) + "</span>").join("") : "") +
        (aveugles[r.id] ? '<span class="warn-t">illisible sur ' + n0(aveugles[r.id]) + " période" +
          (aveugles[r.id] > 1 ? "s" : "") + " — colonne absente de l'export</span>" : "") +
        "</div></div>" +
      '<div class="ract"><span class="rimpact" title="' +
        (r.actif
          ? "Ce que cette règle pose réellement sur la plage affichée, les autres règles en place" +
            (seule > n ? " — elle en vise " + n0(seule) + ", les " + n0(seule - n) + " autres sont pris par une règle placée avant elle." : ".")
          : "Règle désactivée — elle ne pose rien. Activée, elle viserait " + n0(seule) + " KO.") + '">' +
        (r.actif ? (n ? n0(n) + " KO" : "—") : n0(seule) + " KO si active") +
        (r.actif && seule > n ? '<i class="sur">sur ' + n0(seule) + "</i>" : "") + "</span>" +
        (S.regles.length > 1
          ? '<button class="btn sm ico" data-rup="' + r.id + '" title="Passer avant"' + (idx === 0 ? " disabled" : "") + ">↑</button>" +
            '<button class="btn sm ico" data-rdn="' + r.id + '" title="Passer après"' + (idx === S.regles.length - 1 ? " disabled" : "") + ">↓</button>"
          : "") +
        '<button class="btn sm" data-redit="' + r.id + '">Modifier</button>' +
        '<button class="btn sm danger" data-rdel="' + r.id + '">×</button></div></div>';
  }).join("") + "</div>";
}

/* ---------------------------- données ---------------------------- */
function renderDonnees(){
  const cells = Object.values(S.cells);
  const nl = cells.reduce((s, c) => s + c.lignes.length, 0);
  const maj = cells.length ? cells.map(c => c.maj).sort().pop() : null;
  const back = (S.backend === "firebase" || S.backend === "rest")
    ? '<span class="pill manuel">Base partagée</span> Les saisies partent dans Firebase : tout le monde voit et alimente les mêmes chiffres' +
      (S.backend === "rest" ? ", relus toutes les minutes (le SDK est bloqué par le réseau, l'outil passe par l'API directe)." : ", en direct.")
    : S.backend === "db"
    ? '<span class="pill manuel">Base en ligne</span> Les saisies sont enregistrées dans l\'outil : elles vous suivent d\'un appareil à l\'autre et restent visibles par les personnes avec qui vous partagez le lien.'
    : '<span class="pill rejet">Navigateur seul</span> Aucune base connectée : les saisies restent sur ce navigateur. Exportez le JSON pour ne rien perdre, ou connectez la base partagée ci-dessous.';
  $("#store-state").innerHTML =
    '<div class="note" style="margin-bottom:14px">' + back + "</div>" +
    '<div class="facts" style="border-radius:8px;border:1px solid var(--line);border-top:1px solid var(--line)">' +
    [["Mode", BACKEND_LBL[S.backend] || S.backend], ["Périodes", n0(cells.length)], ["Justifications", n0(nl)],
     ["Dernière écriture", maj ? new Date(maj).toLocaleString("fr-FR", {dateStyle:"short", timeStyle:"short"}) : "—"],
     ["Jeu d'exemple", cells.some(c => c.demo) ? "présent" : "retiré"]]
      .map(([k, v]) => '<div class="fact"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>").join("") + "</div>";

  renderFb();
  $("#ref-tbl").innerHTML = '<table><thead><tr><th>Périmètre</th><th class="n">Flux</th><th class="n">KO</th><th class="n">Brut</th><th class="n">Net</th><th>Reprise</th></tr></thead><tbody>' +
    REFERENCE.map(r => {
      const a = agg(Object.values(S.cells).filter(c => c.service === r.s && (r.z === "tous" || c.site === r.z)));
      let pill = '<span class="pill rejet">non chargée</span>';
      if (a.flux){
        /* Le flux et le brut ne dépendent que des données : ils doivent coller.
           Le net, lui, monte dès qu'on justifie un retard de plus — un net
           au-dessus de la consolidation n'est pas un écart, c'est du travail fait. */
        const db = Math.abs(a.brut - r.brut) * 100, dn = (a.net - r.net) * 100, df = a.flux - r.flux;
        const tt = "Recalculé : " + n0(a.flux) + " flux · brut " + pf(a.brut) + " · net " + pf(a.net);
        pill = df
          ? '<span class="pill demo" title="' + tt + '">' + (df > 0 ? "+" : "−") + n0(Math.abs(df)) + " flux</span>"
          : db >= 0.06
            ? '<span class="pill demo" title="' + tt + '">brut ' + dec(db, 2) + " pt d'écart</span>"
            : dn <= -0.06
              ? '<span class="pill demo" title="' + tt + '">net −' + dec(-dn, 2) + " pt</span>"
              : dn >= 0.06
                ? '<span class="pill manuel" title="' + tt + '">net +' + dec(dn, 2) + " pt</span>"
                : '<span class="pill manuel">conforme</span>';
      }
      return '<tr><td>' + SERVS[r.s].l + ' · <span class="muted">' + (r.z === "tous" ? "Tous" : SITES[r.z].l) + "</span></td>" +
        '<td class="n">' + n0(r.flux) + '</td><td class="n">' + n0(r.ko) + '</td><td class="n">' + pf(r.brut) + '</td><td class="n">' + pf(r.net) + "</td><td>" + pill + "</td></tr>";
    }).join("") + "</tbody></table>";
}

function renderFb(){
  const el = $("#fb-state"); if (!el) return;
  const panel = $("#fb-panel");
  if (S.backend === "db"){
    panel.hidden = true; return;
  }
  panel.hidden = false;
  const cfg = fbConfig();
  const fromFile = !!(FIREBASE_CONFIG && FIREBASE_CONFIG.projectId);
  const sub = $("#fb-sub");
  const jointe = S.backend === "firebase" || S.backend === "rest";
  if (sub) sub.textContent = jointe
    ? "Connectée au projet " + cfg.projectId + (S.backend === "rest" ? " — sans SDK" : "")
    : cfg ? "Configuration présente, base non jointe" : "Non connectée — les saisies restent sur ce navigateur";
  if (jointe){
    el.innerHTML = '<div class="note" style="border-left-color:var(--good)"><b>Connecté au projet <code>' + esc(cfg.projectId) + "</code>.</b> " +
      (fromFile ? "La configuration est écrite dans le fichier : tous ceux qui ouvrent la page arrivent sur la même base."
                : "La configuration n'est enregistrée que sur ce navigateur — collez-la dans <code>index.html</code> pour que l'équipe l'ait aussi.") +
      (S.backend === "rest"
        ? " <b>Le SDK Firebase est bloqué par le réseau</b> : l'outil parle directement à l'API Firestore, sans script externe. " +
          "Tout fonctionne, à ceci près que les changements d'un collègue arrivent à la minute plutôt qu'à la seconde."
        : "") + "</div>";
  } else if (cfg){
    const dg = fbDiag(S.fbError);
    el.innerHTML = '<div class="note" style="border-left-color:var(--crit)"><b>' +
      (dg ? esc(dg.t) : "Configuration présente, base non jointe") + ".</b> " +
      (dg ? dg.d : "Vérifiez la connexion, les règles de sécurité et l'authentification anonyme.") +
      (S.fbError ? '<div class="muted" style="margin-top:6px;font-size:11.5px">Message reçu&nbsp;: <code>' + esc(S.fbError) + "</code></div>" : "") +
      "</div>";
  } else {
    el.innerHTML = '<div class="note">Aucune base connectée. Créez un projet sur <b>console.firebase.google.com</b>, ajoutez-y une application Web, activez <b>Firestore</b> et l\'authentification <b>anonyme</b>, puis collez la configuration ci-dessous.</div>';
  }
  const ta = $("#fb-cfg");
  if (ta && document.activeElement !== ta) ta.value = cfg ? JSON.stringify(cfg, null, 2) : "";
}

/* ---------------------------- rendu global ---------------------------- */
function renderRange(){
  syncRange();
  const cal = $("#f-cal");
  cal.hidden = S.ui.preset !== "custom";
  if (!cal.hidden){
    const b = bornesJours(), d1 = $("#f-d1"), d2 = $("#f-d2");
    /* borner le calendrier aux données évite de chercher un mois qui n'existe pas */
    if (b){ d1.min = d2.min = b[0]; d1.max = d2.max = b[1]; }
    if (document.activeElement !== d1) d1.value = S.ui.d1 || "";
    if (document.activeElement !== d2) d2.value = S.ui.d2 || "";
    const k = rangeKeys();
    /* Les semaines que la plage coupe sans pouvoir les découper : leur volume
       entier entre dans le total, on ne peut pas faire autrement, mais on ne le
       laisse pas deviner. */
    const ce = coupeesEntieres();
    $("#f-calh").innerHTML = k.length
      ? esc(perLabel(k[0]) + (k.length > 1 ? " → " + perLabel(k[k.length - 1]) : "")) +
        ' <span class="muted">· ' + n0(k.length) + " " +
        (S.ui.maille === "mois" ? "mois" : S.ui.maille === "jour" ? "jour" + sPl(k.length) : "semaine" + sPl(k.length)) + "</span>" +
        (ce.length
          ? ' <span class="warn-t" title="' + esc(ce.map(c => perLabel(c.periode) + " " + SITES[c.site].l + " · " + SERVS[c.service].l).join(" · ")) +
            '">· ' + n0(ce.length) + " comptée" + sPl(ce.length) + " entière" + sPl(ce.length) + "</span>"
          : "")
      : '<span class="warn-t">aucune période dans cette plage</span>';
  }
  $("#btn-reset").hidden = !filtersActive();
}
let rafPending = false;
function render(){
  if (rafPending) return; rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    renderBanner();
    renderRange();
    document.body.classList.toggle("simple", S.ui.vue === "simple");
    $("#rail").style.display = (S.ui.tab === "reglages" || S.ui.tab === "import") ? "none" : "";
    if (S.ui.tab === "dash") renderDash();
    if (S.ui.tab === "justif") renderAJustifier();
    if (S.ui.tab === "qualif"){ renderQualifies(); renderMains(); renderPourquoi(); }
    if (S.ui.tab === "import"){ renderCellsTable(); renderRegles(); renderMesCauses(); }
    if (S.ui.tab === "reglages") renderDonnees();
    renderCounts();
  });
}
/* Bandeau d'écriture refusée : il reste tant que le problème n'est pas passé,
   dit ce qui n'a pas été écrit, où sont les données, et le geste qui répare. */
function renderBanner(){
  const host = $("#wbanner"); if (!host) return;
  const e = S.writeErr;
  if (!e){ host.innerHTML = ""; return; }
  host.innerHTML = '<div class="wban"><div class="wb-main"><b>' + esc(e.t) + "</b> — " +
    (e.connexion
      ? "l'outil travaille sur la copie de ce navigateur."
      : n0(e.ko) + " période" + sPl(e.ko) + " sur " + n0(e.total) + " n'ont pas été écrites dans la base.") +
    '<div class="wb-d">' + (e.d || "") +
      " <b>Rien n'est perdu</b> : tout est enregistré sur ce navigateur. Réessayez une fois le " +
      "problème réglé, ou exportez la sauvegarde JSON depuis les réglages." + "</div>" +
      '<div class="wb-c">' + esc(e.code) + "</div></div>" +
    '<div class="wb-act"><button class="btn sm" id="wb-retry">Réessayer</button>' +
      '<button class="btn sm" id="wb-hide">Masquer</button></div></div>';
  $("#wb-hide").addEventListener("click", () => { S.writeErr = null; render(); });
  $("#wb-retry").addEventListener("click", async () => {
    const cnx = e.connexion;
    S.writeErr = null; render();
    if (cnx){
      const cfg = fbConfig();
      if (cfg && await connectFirebase(cfg)){ toast("Base rejointe"); return; }
      if (!cfg) toast("Aucune base configurée", true);
      return;
    }
    await bulkPut(Object.values(S.cells));
    if (!S.writeErr) toast("Base à jour");
  });
}
/* ---- les deux chiffres du bandeau ----
   Ils se lisent côte à côte, ils doivent donc compter la même chose, sur le même
   périmètre : des KO, sur la plage affichée. « À justifier » ceux qui n'ont pas
   encore de cause, « Retards qualifiés » ceux qui en ont une ; leur somme est le
   nombre de KO de la plage.

   Ce n'était pas le cas. « Retards qualifiés » comptait des LIGNES, sur TOUT
   l'historique — plancher et filtres compris. Une ligne posée en quantité pour
   douze KO comptait pour une, une semaine masquée comptait quand même, et le
   chiffre ne bougeait jamais quand l'autre bougeait : d'où l'impression qu'ils
   sautent sans raison. Il vient maintenant de la même agrégation que le tableau
   de bord, celle-là même qui écrit « N KO retirés » en tête du panneau. */
function renderCounts(){
  const aj = toQualify().reduce((s, r) => s + r.n, 0);
  const ko = agg(selCells()).ko;
  /* Qualifiés, pas « retirés » : une cause gardée pour la trace qualifie le KO
     sans le sortir du décompte, et l'onglet la montre quand même. Le panneau
     précise le sous-ensemble réellement retiré, sous son titre. */
  $("#cnt-aj").textContent = n0(aj);
  $("#cnt-justif").textContent = n0(Math.max(0, ko - aj));
}

/* ====================== « Pourquoi cette cause ? » ======================
   Le panneau qui répond à la question posée devant l'écran : cette DT est en
   irréalisable, elle devrait être en rebut — qu'est-ce qui a décidé ?
   On regroupe les KO qui ont la même histoire : une DT de quarante postes tous
   traités pareil tient en une ligne, et le cas isolé ressort. */
function renderPourquoi(){
  const host = $("#pq-out"); if (!host) return;
  const saisi = ($("#pq-ref") || {}).value || "";
  if (!String(saisi).trim()){ host.innerHTML = ""; return; }
  const d = diagRef(saisi);
  if (!d || !d.ko.length){
    host.innerHTML = '<div class="note" style="border-left-color:var(--warn)"><b>Aucun KO sur cette référence</b> ' +
      "dans la plage et le périmètre affichés. Élargissez la période, ou remettez site et service sur «&nbsp;Tous&nbsp;»." +
      "</div>";
    return;
  }
  /* même cause, même règle gagnante, même verdict pour chaque règle → une ligne */
  const groupes = new Map();
  d.ko.forEach(k => {
    const cle = [k.per, k.site, k.service, k.ligne ? k.ligne.cat : "",
      k.ligne ? (k.ligne.regle || "") + "/" + k.ligne.src : "",
      k.vues.map(v => v ? v.k + ":" + v.t : "ok").join("|")].join("§");
    const g = groupes.get(cle) || { n:0, postes:[], k };
    g.n++; if (k.poste) g.postes.push(k.poste);
    groupes.set(cle, g);
  });

  const nomRegle = id => (S.regles.find(r => r.id === id) || {}).nom || "";
  const blocs = Array.from(groupes.values()).sort((a, b) => b.n - a.n).map(g => {
    const k = g.k, l = k.ligne;
    const posePar = !l
      ? '<span class="warn-t">aucune cause — ce KO est encore à justifier</span>'
      : l.regle === REGLE_REED
        ? "la règle de l'outil <b>Litige BR réédité</b>"
        : l.regle
          ? "la règle <b>" + esc(nomRegle(l.regle) || "supprimée") + "</b>"
          : l.src === "releve"
            ? "<b>le relevé de l'exploitation</b>" + (l.d ? " du " + esc(dayLabel(l.d)) : "")
            : "<b>une saisie à la main</b>" + (l.d ? " du " + esc(dayLabel(l.d)) : "");
    const lignes = d.regles.map(({ rang, r }) => {
      const v = k.vues[rang - 1];
      const gagnante = l && l.regle === r.id;
      const ic = gagnante ? "✔" : v ? "✗" : "·";
      const cls = gagnante ? "pq-ok" : v ? "pq-no" : "pq-perd";
      const dit = gagnante ? "c'est elle qui pose la cause"
        : v ? esc(v.t)
        : l && !l.regle && l.src === "releve"
          ? "elle vise ce KO, mais <b>un relevé le tient</b> — une règle ne reprend pas un relevé"
          : "elle vise ce KO aussi, mais elle est <b>plus bas dans la liste</b>";
      return '<div class="pqr ' + cls + '"><i>' + ic + "</i><b>" + n0(rang) + ". " + esc(r.nom) + "</b>" +
        "<span>" + dit + "</span></div>";
    }).join("");
    /* le conseil, quand il y en a un : une règle qui vise mais qui perd au rang */
    const perdantes = d.regles.filter(({ rang, r }) =>
      !k.vues[rang - 1] && !(l && l.regle === r.id));
    /* Formulé au conditionnel : quand l'ordre est déjà le bon, un conseil qui
       pousse à le changer est un piège. C'est à vous de dire quelle cause vous
       attendiez — l'outil dit seulement comment l'obtenir. */
    const conseil = (l && !l.regle && l.src === "releve" && perdantes.length)
      ? "Le relevé prime sur toutes les règles&nbsp;: c'est l'exploitation qui a dit la cause, l'outil ne la reprend pas. " +
        "Si c'est « " + esc(perdantes[0].r.nom) + " » que vous attendiez, il faut retirer cette ligne de relevé " +
        "— dans <b>Vos saisies à la main</b> ci-dessous, ou sur la ligne elle-même."
      : (l && l.regle && perdantes.length)
        ? "Si c'est « " + esc(perdantes[0].r.nom) + " » que vous attendiez, remontez-la au-dessus de « " +
          esc(nomRegle(l.regle)) + " » dans <b>Vos règles automatiques</b>, onglet Import."
        : (l && !l.regle && l.src !== "releve" && perdantes.length)
          ? "Une saisie à la main ne cède la place qu'à une règle qui la vise&nbsp;: « " +
            esc(perdantes[0].r.nom) + " » la reprendra au prochain <b>Rejouer sur tout l'historique</b>."
          : "";
    const postes = g.postes.length
      ? " · poste" + sPl(g.postes.length) + " " + esc(g.postes.slice(0, 8).sort(cmpPoste).join(", ")) +
        (g.postes.length > 8 ? " +" + n0(g.postes.length - 8) : "")
      : "";
    return '<div class="pqbloc">' +
      '<div class="pqh"><b>' + n0(g.n) + " KO</b> · " + esc(perLabel(k.per)) + " · " +
        esc(SITES[k.site].l) + " · " + esc(SERVS[k.service].l) + '<span class="muted">' + postes + "</span></div>" +
      '<div class="pqcause">Cause&nbsp;: <b>' + (l ? esc(CAT[l.cat] ? CAT[l.cat].l : l.cat) : "—") +
        "</b> — posée par " + posePar + "</div>" +
      '<div class="pqlist">' + (lignes || '<div class="muted">Aucune règle enregistrée.</div>') + "</div>" +
      (conseil ? '<div class="pqfix">' + conseil + "</div>" : "") +
      "</div>";
  }).join("");

  host.innerHTML = '<div class="note" style="margin-bottom:12px"><b>' + esc(d.ref) + "</b> — " +
    n0(d.ko.length) + " KO sur la plage affichée, " + n0(groupes.size) + " cas distinct" + sPl(groupes.size) +
    ".</div>" + blocs;
}
