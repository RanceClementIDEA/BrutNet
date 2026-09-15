/* =========================================================================
   Bloc 4 : fichier Excel — génération et relecture, sans dépendance
   ========================================================================= */

const CRCT = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++){ let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0; }
  return t;
})();
function crc32(u8){
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRCT[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const TE = new TextEncoder();
function zipStore(files){
  const parts = [], central = [];
  let off = 0;
  const DATE = 20513, TIME = 0;
  files.forEach(f => {
    const name = TE.encode(f.name), data = f.data, crc = crc32(data);
    const lh = new Uint8Array(30 + name.length), d = new DataView(lh.buffer);
    d.setUint32(0, 0x04034b50, true); d.setUint16(4, 20, true); d.setUint16(6, 0, true);
    d.setUint16(8, 0, true); d.setUint16(10, TIME, true); d.setUint16(12, DATE, true);
    d.setUint32(14, crc, true); d.setUint32(18, data.length, true); d.setUint32(22, data.length, true);
    d.setUint16(26, name.length, true); d.setUint16(28, 0, true);
    lh.set(name, 30);
    parts.push(lh, data);
    const ch = new Uint8Array(46 + name.length), e = new DataView(ch.buffer);
    e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true);
    e.setUint16(8, 0, true); e.setUint16(10, 0, true); e.setUint16(12, TIME, true); e.setUint16(14, DATE, true);
    e.setUint32(16, crc, true); e.setUint32(20, data.length, true); e.setUint32(24, data.length, true);
    e.setUint16(28, name.length, true); e.setUint16(30, 0, true); e.setUint16(32, 0, true);
    e.setUint16(34, 0, true); e.setUint16(36, 0, true); e.setUint32(38, 0, true); e.setUint32(42, off, true);
    ch.set(name, 46);
    central.push(ch);
    off += lh.length + data.length;
  });
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eo = new Uint8Array(22), v = new DataView(eo.buffer);
  v.setUint32(0, 0x06054b50, true); v.setUint16(4, 0, true); v.setUint16(6, 0, true);
  v.setUint16(8, files.length, true); v.setUint16(10, files.length, true);
  v.setUint32(12, cdSize, true); v.setUint32(16, off, true); v.setUint16(20, 0, true);
  const all = parts.concat(central, [eo]);
  const total = all.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0; all.forEach(a => { out.set(a, p); p += a.length; });
  return out;
}
const xmlEsc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const colName = i => { let s = "", n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };

/* rows : tableau de tableaux ; la 1re ligne est l'en-tête.
   opts : {widths:[], validation:{col:index0, from:"Causes", n:nbCauses, rows:nbLignes}} */
function sheetXml(rows, opts){
  opts = opts || {};
  const cols = (opts.widths || []).map((w, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("");
  const body = rows.map((r, ri) => {
    const cells = r.map((val, ci) => {
      const ref = colName(ci) + (ri + 1);
      const st = ri === 0 ? ' s="1"' : "";
      if (typeof val === "number" && isFinite(val)) return '<c r="' + ref + '"' + st + '><v>' + val + "</v></c>";
      const t = xmlEsc(val);
      if (t === "") return '<c r="' + ref + '"' + st + "/>";
      return '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + t + "</t></is></c>";
    }).join("");
    return '<row r="' + (ri + 1) + '">' + cells + "</row>";
  }).join("");
  let dv = "";
  if (opts.validation){
    const c = colName(opts.validation.col), last = opts.validation.rows + 1;
    dv = '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"' +
      ' sqref="' + c + "2:" + c + last + '"><formula1>' + opts.validation.from + "!$A$2:$A$" +
      (opts.validation.n + 1) + "</formula1></dataValidation></dataValidations>";
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    (cols ? "<cols>" + cols + "</cols>" : "") +
    "<sheetData>" + body + "</sheetData>" + dv + "</worksheet>";
}
function xlsxBuild(sheets){
  const enc = s => TE.encode(s);
  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
      '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
    "</Types>";
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((s, i) => '<sheet name="' + xmlEsc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") +
    "</sheets></workbook>";
  const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
    '<Relationship Id="rId' + (sheets.length + 1) +
    '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1C5CAB"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const files = [
    { name:"[Content_Types].xml", data: enc(ct) },
    { name:"_rels/.rels", data: enc(rels) },
    { name:"xl/workbook.xml", data: enc(wb) },
    { name:"xl/_rels/workbook.xml.rels", data: enc(wbRels) },
    { name:"xl/styles.xml", data: enc(styles) }
  ];
  sheets.forEach((s, i) => files.push({ name:"xl/worksheets/sheet" + (i + 1) + ".xml", data: enc(sheetXml(s.rows, s.opts)) }));
  return zipStore(files);
}

/* ---------------------------- relecture ---------------------------- */
async function inflateRaw(u8){
  if (typeof DecompressionStream === "undefined") throw new Error("Ce navigateur ne sait pas décompresser les .xlsx — utilisez un export CSV.");
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/* Répertoire du zip : on note où se trouve chaque entrée sans rien décompresser. */
function zipIndex(buf){
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eo = -1;
  for (let i = u8.length - 22; i >= 0 && i > u8.length - 65558; i--){ if (dv.getUint32(i, true) === 0x06054b50){ eo = i; break; } }
  if (eo < 0) throw new Error("Ce fichier n'est pas un classeur lisible.");
  const n = dv.getUint16(eo + 10, true);
  let p = dv.getUint32(eo + 16, true);
  const out = {}, dec = new TextDecoder();
  for (let i = 0; i < n; i++){
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), cmtLen = dv.getUint16(p + 32, true);
    const method = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true);
    const taille = dv.getUint32(p + 24, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    const lNameLen = dv.getUint16(lo + 26, true), lExtra = dv.getUint16(lo + 28, true);
    const start = lo + 30 + lNameLen + lExtra;
    out[name] = { method, taille, data: u8.subarray(start, start + comp) };
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}
async function zipEntry(e){ return e.method === 0 ? e.data : await inflateRaw(e.data); }
/* Flux de texte d'une entrée : une feuille de 200 Mo ne tient pas en mémoire. */
function zipStream(e){
  const src = new Blob([e.data]).stream();
  const bin = e.method === 0 ? src : src.pipeThrough(new DecompressionStream("deflate-raw"));
  return bin.pipeThrough(new TextDecoderStream("utf-8"));
}

/* Entités XML : le texte des cellules revient échappé. */
function xmlText(s){
  return String(s == null ? "" : s)
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/* ---------------------------- lecture d'un classeur ----------------------------
   Deux libertés que prennent les exports réels et qu'il faut accepter :
   les balises peuvent être préfixées (<x:row>, <x:c>), et les cellules peuvent
   n'avoir aucune référence A1 — leur place est alors donnée par leur ordre. */
const LIM_LIGNES = 300000;
const T = n => "(?:[A-Za-z0-9_.-]+:)?" + n;      /* balise avec ou sans préfixe */

function celluleVal(attr, inner, shared){
  const ty = (attr.match(/\bt="([^"]+)"/) || [])[1] || "";
  if (ty === "inlineStr"){
    const ts = inner.match(new RegExp("<" + T("t") + "[^>]*>([\\s\\S]*?)</" + T("t") + ">", "g")) || [];
    return xmlText(ts.map(x => x.replace(/<[^>]+>/g, "")).join(""));
  }
  const v = inner.match(new RegExp("<" + T("v") + "[^>]*>([\\s\\S]*?)</" + T("v") + ">"));
  if (!v) return "";
  if (ty === "s") return shared[+v[1]] || "";
  return ty === "str" ? xmlText(v[1]) : v[1];
}
/* Balayage des cellules d'une ligne. Une cellule vide s'écrit « <c /> » : il faut
   la distinguer d'une cellule ouverte, sinon elle avale la suivante et toute la
   fin de la ligne glisse d'un cran. */
function ligneCellules(xml, shared, compte){
  const cells = [];
  const ouvre = new RegExp("<" + T("c") + "((?:\"[^\"]*\"|[^>\"])*)>", "g");
  const ferme = new RegExp("</" + T("c") + ">", "g");
  let m, auto = 0;
  while ((m = ouvre.exec(xml))){
    let attr = m[1] || "", inner = "";
    const seule = /\/\s*$/.test(attr);          /* <c ... /> */
    if (seule) attr = attr.replace(/\/\s*$/, "");
    else {
      ferme.lastIndex = ouvre.lastIndex;
      const f = ferme.exec(xml);
      if (!f) break;
      inner = xml.slice(ouvre.lastIndex, f.index);
      ouvre.lastIndex = ferme.lastIndex;
    }
    const r = (attr.match(/\br="([A-Z]+)\d+"/) || [])[1];
    let ci;
    if (r){ ci = 0; for (const ch of r) ci = ci * 26 + (ch.charCodeAt(0) - 64); ci--; if (compte) compte.avecRef++; }
    else { ci = auto; if (compte) compte.sansRef++; }
    auto = ci + 1;
    cells[ci] = celluleVal(attr, inner, shared);
  }
  for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
  return cells;
}
/* ---- un classeur peut porter plusieurs feuilles ----
   Une feuille de garde devant les données, un onglet par service, un export
   collé à côté d'un récapitulatif : on lisait la première feuille et on
   déclarait le fichier illisible. `xlsxRead` rend désormais la première feuille
   EXPLOITABLE, et `xlsxFeuilles` les rend toutes, pour les traiter chacune. */
async function xlsxRead(buf){
  const fs = await xlsxFeuilles(buf);
  if (!fs.length) throw new Error("Le classeur ne contient aucune ligne lisible.");
  /* la première qui a au moins un en-tête et une ligne : une feuille de garde
     n'en a qu'une, elle ne doit pas masquer les données qui suivent */
  return fs.find(f => f.length >= 2) || fs[0];
}
async function xlsxFeuilles(buf){
  const files = zipIndex(buf);
  const cles = Object.keys(files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => (parseInt(a.replace(/\D+/g, ""), 10) || 0) - (parseInt(b.replace(/\D+/g, ""), 10) || 0));
  if (!cles.length) throw new Error("Aucune feuille trouvée dans le classeur.");
  const out = [];
  for (const k of cles.slice(0, 12)){
    try { const r = await xlsxUneFeuille(buf, files, k); if (r && r.length) out.push(r); }
    catch(e){ /* une feuille illisible n'empêche pas de lire les autres */ }
  }
  return out;
}
async function xlsxUneFeuille(buf, files, key){
  const dec = new TextDecoder();
  const shared = [];
  if (files["xl/sharedStrings.xml"]){
    const x = dec.decode(await zipEntry(files["xl/sharedStrings.xml"]));
    const re = new RegExp("<" + T("si") + "[^>]*>([\\s\\S]*?)</" + T("si") + ">", "g");
    let m;
    while ((m = re.exec(x))){
      const ts = m[1].match(new RegExp("<" + T("t") + "[^>]*>([\\s\\S]*?)</" + T("t") + ">", "g")) || [];
      shared.push(xmlText(ts.map(t => t.replace(/<[^>]+>/g, "")).join("")));
    }
  }
  const e = files[key];
  const rows = [];
  const finRow = new RegExp("</" + T("row") + ">");
  const debRow = new RegExp("<" + T("row") + "(?:\\s[^>]*)?>");

  const compte = { avecRef:0, sansRef:0 };
  const reader = zipStream(e).getReader();
  let buffer = "", fini = false;
  while (!fini){
    const { value, done } = await reader.read();
    if (done) fini = true; else buffer += value;
    /* on ne garde en mémoire que la ligne en cours de lecture */
    let i;
    while ((i = buffer.search(finRow)) >= 0){
      const bloc = buffer.slice(0, i);
      const j = bloc.search(debRow);
      if (j >= 0) rows.push(ligneCellules(bloc.slice(j), shared, compte));
      buffer = buffer.slice(i + bloc.slice(i).length + (buffer.slice(i).match(finRow) || [""])[0].length);
      if (rows.length >= LIM_LIGNES){ try { await reader.cancel(); } catch(err){} fini = true; break; }
    }
    if (buffer.length > 4e6) buffer = buffer.slice(-2e6);   /* garde-fou */
  }
  const utiles = rows.filter(r => r.some(c => String(c).trim() !== ""));
  if (!utiles.length) throw new Error("Le classeur ne contient aucune ligne lisible.");
  /* Sans référence de cellule, une cellule vide omise décale tout ce qui suit :
     l'appelant doit le savoir avant de faire confiance aux colonnes. */
  utiles.sansReperes = compte.sansRef > 0 && compte.avecRef === 0;
  return utiles;
}

/* =========================================================================
   Lecture d'un fichier déposé : tableur, texte, ou mail enregistré.
   Tout revient sous la même forme — des lignes séparées par des tabulations —
   que les analyseurs savent déjà lire.
   ========================================================================= */

/* Un tableau HTML (mail Outlook, page enregistrée) → lignes de cellules. */
function htmlTables(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = [];
  doc.querySelectorAll("table").forEach(tb => {
    const lignes = [];
    tb.querySelectorAll("tr").forEach(tr => {
      const cs = Array.from(tr.querySelectorAll("th,td"))
        .map(td => (td.textContent || "").replace(/\s+/g, " ").trim());
      if (cs.some(x => x !== "")) lignes.push(cs);
    });
    if (lignes.length > 1) out.push(lignes);
  });
  /* on garde le plus grand tableau : dans un mail, les autres sont la mise en page */
  out.sort((a, b) => b.length * (b[0] || []).length - a.length * (a[0] || []).length);
  return out.length ? out[0] : null;
}

/* Un mail enregistré (.eml, .mht) est un document MIME : on suit ses séparateurs
   déclarés plutôt que de deviner, sinon une ligne de CSS commençant par « -- »
   tronque le message. */
function qpDecode(corps, charset){
  const sansSaut = corps.replace(/=\r?\n/g, "");
  const octets = [];
  for (let k = 0; k < sansSaut.length; k++){
    if (sansSaut[k] === "=" && /^[0-9A-Fa-f]{2}$/.test(sansSaut.substr(k + 1, 2))){
      octets.push(parseInt(sansSaut.substr(k + 1, 2), 16)); k += 2;
    } else octets.push(sansSaut.charCodeAt(k) & 0xff);
  }
  return decodeOctets(new Uint8Array(octets), charset);
}
function decodeOctets(u8, charset){
  try { return new TextDecoder(charset || "utf-8").decode(u8); }
  catch(e){ return new TextDecoder("windows-1252").decode(u8); }
}
function b64Decode(corps, charset){
  try {
    const bin = atob(corps.replace(/\s+/g, ""));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return decodeOctets(u8, charset);
  } catch(e){ return ""; }
}
/* Parcourt les parties d'un message et rend le plus grand corps text/html. */
function mimeHtml(texte){
  const coupe = texte.search(/\r?\n\r?\n/);
  if (coupe < 0) return "";
  const entete = texte.slice(0, coupe), corps = texte.slice(coupe).replace(/^\r?\n\r?\n/, "");
  const ct = (entete.match(/content-type:\s*([^\r\n;]+)/i) || [])[1] || "";
  const cs = (entete.match(/charset="?([\w-]+)"?/i) || [])[1] || "";
  const cte = ((entete.match(/content-transfer-encoding:\s*([^\r\n;]+)/i) || [])[1] || "").toLowerCase().trim();
  if (/^multipart\//i.test(ct)){
    const bd = (entete.match(/boundary="?([^";\r\n]+)"?/i) || [])[1];
    if (!bd) return "";
    const parts = corps.split(new RegExp("\r?\n?--" + bd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    let best = "";
    for (const p of parts){
      if (!p || /^--/.test(p.trim())) continue;
      const h = mimeHtml(p.replace(/^\r?\n/, ""));
      if (h.length > best.length) best = h;
    }
    return best;
  }
  if (!/text\/html/i.test(ct)) return "";
  if (cte === "quoted-printable") return qpDecode(corps, cs);
  if (cte === "base64") return b64Decode(corps, cs);
  return corps;
}
function mhtHtml(buf){
  return mimeHtml(new TextDecoder("latin1").decode(buf));
}
const enTsv = rows => rows.map(r => r.map(c => String(c == null ? "" : c).replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");

/* Point d'entrée : rend le contenu d'un fichier sous forme de lignes de cellules.
   Les analyseurs les prennent telles quelles — un gros export n'a donc pas à
   transiter par le champ de collage, qui serait vite saturé. */
async function lireFichierRows(file){
  const nom = (file.name || "").toLowerCase();
  if (/\.(xlsx|xlsm|xltx)$/.test(nom)){
    const rows = await xlsxRead(await file.arrayBuffer());
    if (!rows || !rows.length) throw new Error("Le classeur ne contient aucune ligne lisible.");
    return rows;
  }
  if (/\.(mht|mhtml|eml)$/.test(nom)){
    const html = mhtHtml(await file.arrayBuffer());
    const rows = html ? htmlTables(html) : null;
    if (rows) return rows;
    if (html && /<img/i.test(html))
      throw new Error("Ce mail ne contient pas de tableau : le relevé y est une capture d'image, que l'outil ne sait pas lire. Demandez l'envoi du tableau lui-même, ou d'un fichier joint.");
    throw new Error("Aucun tableau trouvé dans ce mail.");
  }
  if (/\.(html?|htm)$/.test(nom)){
    const rows = htmlTables(await file.text());
    if (!rows) throw new Error("Aucun tableau trouvé dans cette page.");
    return rows;
  }
  return parseTable(await file.text());
}

/* ---- tous les tableaux d'un fichier, pas seulement le premier ----
   Un classeur a des onglets, un mail peut porter deux tableaux à la suite. On
   les rend tous, nommés, et l'appelant reconnaît chacun pour lui-même. */
async function lireFichierJeux(file){
  const nom = (file.name || "").toLowerCase();
  if (/\.(xlsx|xlsm|xltx)$/.test(nom)){
    const fs = await xlsxFeuilles(await file.arrayBuffer());
    if (!fs.length) throw new Error("Le classeur ne contient aucune ligne lisible.");
    return fs.map((rows, i) => ({ nom: "feuille " + (i + 1), rows }));
  }
  if (/\.(mht|mhtml|eml)$/.test(nom)){
    const html = mhtHtml(await file.arrayBuffer());
    const jeux = html ? htmlTablesTous(html) : null;
    if (jeux && jeux.length) return jeux;
    if (html && /<img/i.test(html))
      throw new Error("Ce mail ne contient pas de tableau : le relevé y est une capture d'image, que l'outil ne sait pas lire. Demandez l'envoi du tableau lui-même, ou d'un fichier joint.");
    throw new Error("Aucun tableau trouvé dans ce mail.");
  }
  if (/\.(html?|htm)$/.test(nom)){
    const jeux = htmlTablesTous(await file.text());
    if (!jeux || !jeux.length) throw new Error("Aucun tableau trouvé dans cette page.");
    return jeux;
  }
  const rows = parseTable(await file.text());
  return rows && rows.length ? [{ nom:"", rows }] : [];
}
/* Chaque <table> de la page, séparément — `htmlTables` les recolle en un seul
   jeu, ce qui convient au relevé d'un mail mais noie deux tableaux distincts. */
function htmlTablesTous(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = [];
  doc.querySelectorAll("table").forEach((tb, i) => {
    const lignes = [];
    tb.querySelectorAll("tr").forEach(tr => {
      const cs = Array.from(tr.querySelectorAll("th,td"))
        .map(td => (td.textContent || "").replace(/\s+/g, " ").trim());
      if (cs.some(x => x !== "")) lignes.push(cs);
    });
    if (lignes.length >= 2) out.push({ nom: "tableau " + (i + 1), rows: lignes });
  });
  return out;
}
