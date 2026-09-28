/* =========================================================
   Titanware · núcleo compartido (tienda + panel admin)
   - Lectura de nombres de productos (marca, nombre prolijo, características)
   - Datos de compatibilidad y reglas del armador de PC
   - Carrito y mensajes de WhatsApp
   ========================================================= */
(function () {
  const CFG = window.TW_CONFIG;
  const TW = (window.TW = {});

  /* ---------- Utilidades ---------- */
  TW.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  TW.norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const moneyFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  TW.money = (n) => moneyFmt.format(n || 0);
  TW.waLink = (text) => `https://wa.me/${CFG.negocio.whatsapp}?text=${encodeURIComponent(text)}`;
  TW.slug = (s) => TW.norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "");
  const esc = TW.esc;

  /* ---------- Íconos ---------- */
  const svg = (d) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">${d}</svg>`;
  TW.ICONS = {
    "Procesadores": svg('<rect x="16" y="16" width="32" height="32"/><rect x="24" y="24" width="16" height="16"/><path d="M22 8v8M32 8v8M42 8v8M22 48v8M32 48v8M42 48v8M8 22h8M8 32h8M8 42h8M48 22h8M48 32h8M48 42h8"/>'),
    "Placas de video": svg('<path d="M6 18h52v26H6zM12 44v6h20v-6"/><circle cx="22" cy="31" r="8"/><circle cx="42" cy="31" r="8"/>'),
    "Memorias RAM": svg('<path d="M6 20h52v20H6z"/><path d="M13 26h6v8h-6zM23 26h6v8h-6zM35 26h6v8h-6zM45 26h6v8h-6zM10 40v6M16 40v6M22 40v6M28 40v6M36 40v6M42 40v6M48 40v6M54 40v6"/>'),
    "Almacenamientos": svg('<path d="M6 24h52v16H6z"/><path d="M12 29h14v6H12zM32 29h8v6h-8zM52 28v8"/>'),
    "Motherboards": svg('<path d="M10 8h44v48H10z"/><path d="M18 16h14v14H18zM40 14v22M46 14v22M18 38h28M18 46h20"/>'),
    "Fuentes de poder": svg('<path d="M8 16h48v32H8z"/><circle cx="26" cy="32" r="10"/><path d="M26 22v20M16 32h20M44 24h6M44 30h6M44 40l4-6h-4l4-6"/>'),
    "Coolers": svg('<path d="M10 10h44v44H10z"/><circle cx="32" cy="32" r="4"/><path d="M32 28c-2-8 4-14 10-12-2 6-6 10-10 12zM36 32c8-2 14 4 12 10-6-2-10-6-12-10zM32 36c2 8-4 14-10 12 2-6 6-10 10-12zM28 32c-8 2-14-4-12-10 6 2 10 6 12 10z"/>'),
    "Gabinetes": svg('<path d="M18 6h28v52H18z"/><path d="M24 14h16M24 20h16"/><circle cx="32" cy="38" r="8"/>'),
    "Periféricos": svg('<rect x="20" y="8" width="24" height="40" rx="12"/><path d="M32 8v14M20 22h24M32 48v8"/>'),
    "default": svg('<path d="M10 14h44v30H10zM24 50h16M32 44v6"/>'),
  };
  const ui = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  TW.UI = {
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-wa"/></svg>',
    arrow: ui('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    back: ui('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
    check: ui('<path d="m5 12 5 5 9-10"/>', 'stroke-width="2.5"'),
    star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3 6.9 7.5.7-5.7 5 1.7 7.4L12 18.3 5.5 22l1.7-7.4-5.7-5 7.5-.7z"/></svg>',
    close: ui('<path d="M6 6l12 12M18 6 6 18"/>', 'stroke-width="2.2"'),
    cart: ui('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6"/>'),
    plus: ui('<path d="M12 5v14M5 12h14"/>'),
    minus: ui('<path d="M5 12h14"/>'),
    trash: ui('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>'),
    search: ui('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    warn: ui('<path d="M12 3 2 21h20L12 3zM12 10v5M12 18h.01"/>'),
    bolt: ui('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    edit: ui('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>'),
    redo: ui('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    wrench: ui('<path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L2 10l8-8z"/>'),
    truck: ui('<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),
    chat: ui('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    pin: ui('<path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
    shield: ui('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  };

  /* ---------- Logos de marca ---------- */
  TW.LOGOS = {
    AMD: "amd.svg", Intel: "intel.svg", ASUS: "asus.svg", MSI: "msi.svg", NVIDIA: "nvidia.svg", Corsair: "corsair.svg", Seagate: "seagate.svg",
    WD: "westerndigital.svg", "Cooler Master": "coolermaster.svg", ADATA: "adata.png", XPG: "xpg.png", Hiksemi: "hiksemi.png", Gigabyte: "gigabyte.png",
    Thermaltake: "thermaltake.png", Evolabs: "evolabs.png", Kingston: "kingston.png", Aureox: "aureox.png", Sentey: "sentey.png",
  };
  TW.logoFor = (p) => (p.marca === "ADATA" && /\bXPG\b/i.test(p.nombre) ? TW.LOGOS.XPG : TW.LOGOS[p.marca]);
  TW.logoHtml = (marca, file) => file
    ? `<span class="t-logo" style="--logo:url('${new URL("img/marcas/" + file, document.baseURI).href}')" role="img" aria-label="${esc(marca)}"></span>`
    : `<span class="t-word">${esc(marca)}</span>`;
  TW.thumb = (p, withBox) => {
    const main = p.imagen || p.caja;
    if (main) return `<img class="prod" src="${esc(main)}" alt="${esc(p.titulo)}" loading="lazy">`
      + (withBox && p.imagen && p.caja ? `<img class="box" src="${esc(p.caja)}" alt="Caja de ${esc(p.titulo)}" loading="lazy" onerror="this.remove()">` : "");
    const bg = `<span class="t-bg">${TW.ICONS[p.categoria] || TW.ICONS.default}</span>`;
    if (p.marca === "Genérico") return bg.replace("t-bg", "t-bg solo");
    return bg + TW.logoHtml(p.marca, TW.logoFor(p));
  };
  TW.priceHtml = (precio) => precio ? `<span class="price">${TW.money(precio)}</span>` : `<span class="price ask">Consultar precio</span>`;
  // Precio de un producto: si está en oferta muestra también el precio anterior tachado
  TW.productPrice = (p) => p.oferta && p.precioLista
    ? `<span class="price-off"><s>${TW.money(p.precioLista)}</s>${TW.priceHtml(p.precio)}</span>` : TW.priceHtml(p.precio);
  TW.offerTag = (p) => (p.oferta ? `<span class="offer-tag">${p.descuento ? `-${p.descuento}%` : "Oferta"}<small>OFERTA</small></span>` : "");
  TW.STOCK = { disponible: "En stock", "sin stock": "Sin stock" };

  /* ---------- Lectura de nombres ---------- */
  const BRANDS = ["COOLERMASTER", "COOLER MASTER", "THERMALTAKE", "ARKHAM", "ADATA", "XPG", "ASUS", "MSI", "GIGABYTE", "ZOTAC", "KINGSTON", "CORSAIR",
    "PATRIOT", "LEXAR", "CRUCIAL", "HIKSEMI", "HIKVISION", "MEMOX", "WICGTYP", "STARMEMORY", "SEAGATE", "WD", "RAPTOR", "EVOLABS", "KELYX",
    "AUREOX", "SENTEY", "GAMEMAX", "RAIDMAX", "TEROS", "NOVA", "LNZ", "PERFORMANCE", "AURUS", "SAMSUNG", "AMD", "INTEL"];
  const BRAND_NAME = { COOLERMASTER: "Cooler Master", "COOLER MASTER": "Cooler Master", STARMEMORY: "StarMemory", GAMEMAX: "GameMax", WICGTYP: "Wicgtyp" };
  const UPPER = new Set(["AMD", "ASUS", "MSI", "ADATA", "XPG", "WD", "LNZ", "RGB", "ARGB", "FRGB", "DDR3", "DDR4", "DDR5", "SSD", "HDD", "SATA", "III", "USB", "ATX", "SFX",
    "OC", "LP", "TG", "CSM", "VGA", "HDMI", "DVI", "GT", "RTX", "RX", "CPU", "KVR", "ECC", "OEM", "PRO", "MAG", "SE", "V2", "V3", "H", "K", "A", "B", "G", "S", "M", "SN350",
    "D4", "R2.0", "LPX", "RS", "ARX", "ICE", "CX550", "NQ100", "SU650", "A400", "S270", "P300", "P320", "S65G", "S70", "XS2000", "SNVS", "ARXE", "ARXGP", "RAM", "NO-ECC"]);
  const SPECIAL = { NVME: "NVMe", PCIE: "PCIe", GEFORCE: "GeForce", I3: "i3", I5: "i5", I7: "i7", I9: "i9", SODIMM: "SODIMM", COOLERMASTER: "Cooler Master", STARMEMORY: "StarMemory",
    GAMEMAX: "GameMax", MASTERAIR: "MasterAir", COREFROZR: "CoreFrozr", HIKER: "Hiker", Y: "y", DE: "de", CON: "con", BY: "by", VIDRO: "Vidrio", TERMICO: "Térmico", BLANCA: "Blanca" };

  function niceToken(t) {
    const up = t.toUpperCase();
    if (SPECIAL[up]) return SPECIAL[up];
    if (/^GEN\d/.test(up)) return "Gen" + up.slice(3).toLowerCase();
    if (/^[CSP]\/./.test(up)) {
      const r = niceToken(t.slice(2));
      return up[0].toLowerCase() + "/" + (/^[A-Z][a-z]+$/.test(r) ? r.toLowerCase() : r);
    }
    if (up.includes("/")) return up.split("/").map(niceToken).join("/");
    if (UPPER.has(up) || /\d/.test(up) || up.length <= 2) return up;
    return up[0] + up.slice(1).toLowerCase();
  }

  // Notas de venta dentro del nombre ("+Q A320", "SIMIL 5600G"...) → pasan a características
  function splitNotes(name) {
    const notes = [];
    name = name
      .replace(/\s+IDEAL (?:PC )?OFICINA/i, () => (notes.push("Ideal para PC de oficina"), ""))
      .replace(/\s+(?:\+Q|MEJOR Q|SUPERIOR(?: AL)?)\s+(\S+)/gi, (_, m) => (notes.push(`Mejor que ${m}`), ""))
      .replace(/\s+SIMIL\s+(\S+)/gi, (_, m) => (notes.push(`Similar a ${m}`), ""));
    return [name, notes];
  }

  const PREFIX = /^(MOTHER|MICRO|CPU COOLER|MEMORIA|HD|DISCO|PLACA DE VIDEO|FUENTE|GABINETE)\s+/i;
  const CORES = { "3000G": "2 núcleos / 4 hilos", "3200G": "4 núcleos / 4 hilos", "3400G": "4 núcleos / 8 hilos", "3500X": "6 núcleos / 6 hilos",
    "5600": "6 núcleos / 12 hilos", "5600GT": "6 núcleos / 12 hilos", "5700": "8 núcleos / 16 hilos", "5700G": "8 núcleos / 16 hilos",
    "8400F": "6 núcleos / 12 hilos", "8500G": "6 núcleos / 12 hilos", "8600G": "6 núcleos / 12 hilos", "7600X": "6 núcleos / 12 hilos",
    "G5925": "2 núcleos / 2 hilos", "G7400": "2 núcleos / 4 hilos", "10105F": "4 núcleos / 8 hilos", "12100": "4 núcleos / 8 hilos", "12100F": "4 núcleos / 8 hilos",
    "13100F": "4 núcleos / 8 hilos", "14100": "4 núcleos / 8 hilos", "14100F": "4 núcleos / 8 hilos", "12400": "6 núcleos / 12 hilos", "12400F": "6 núcleos / 12 hilos",
    "14400F": "10 núcleos / 16 hilos" };
  const SOCKET = { AM4: "AM4", AM5: "AM5", S1200: "LGA 1200", S1700: "LGA 1700", S1851: "LGA 1851" };
  TW.SOCKETS = ["AM4", "AM5", "LGA 1200", "LGA 1700", "LGA 1851"];

  function autoSpecs(N, cat) {
    const s = [], has = (re) => re.test(N), cap = N.match(/\b(\d+)\s?(GB|TB)\b/);
    const sockets = [...N.matchAll(/\b(AM4|AM5|S1200|S1700|S1851)\b/g)].map((m) => SOCKET[m[1]]);
    const light = has(/\bARGB\b/) ? "Iluminación ARGB" : has(/\bF?RGB\b/) ? "Iluminación RGB" : "";
    const white = has(/\b(WHITE|BLANCO|BLANCA)\b/) ? "Color blanco" : "";
    if (cat === "Motherboards") {
      const chip = N.match(/\b([ABHXZ]\d{3})M?\b/);
      if (sockets[0]) s.push(`Socket ${sockets[0]}`);
      if (chip) s.push(`Chipset ${chip[1]}`);
      const ddr = N.match(/\bDDR(\d)\b/); if (ddr) s.push(`Memoria DDR${ddr[1]}`);
      if (has(/\b[ABH]\d{3}M\b|\b[ABH]\d{3}M-/)) s.push("Formato Micro-ATX");
      if (has(/\bGEN5\b/)) s.push("Slot PCIe Gen5");
      if (light) s.push(light);
    } else if (cat === "Procesadores") {
      const model = Object.keys(CORES).sort((a, b) => b.length - a.length).find((k) => new RegExp(`\\b${k}\\b`).test(N));
      if (model) s.push(CORES[model]);
      if (sockets[0]) s.push(`Socket ${sockets[0]}`);
      if (has(/C\/VIDEO|VEGA|CELERON|PENTIUM/)) s.push("Gráficos integrados");
      if (has(/S\/VIDEO/)) s.push("Requiere placa de video");
      if (has(/C\/COOLER/) || (has(/\bBOX\b/) && !has(/S\/COOLER/))) s.push("Incluye cooler");
      if (has(/S\/COOLER/)) s.push("No incluye cooler");
      if (has(/\bBOX\b/)) s.push("Versión Box (en caja)");
      if (has(/\bTRAY\b/)) s.push("Versión Tray");
    } else if (cat === "Coolers") {
      s.push("Refrigeración por aire");
      const w = N.match(/\b(\d+)W\b/); if (w) s.push(`Soporta hasta ${w[1]} W`);
      if (sockets.length > 1) s.push(`Compatible ${sockets.join(" / ")}`);
      else if (sockets[0]) s.push(`Compatible ${sockets[0]}`);
      else if (has(/AMD\/INTEL/)) s.push("Compatible AMD e Intel");
      if (light) s.push(light);
      if (white) s.push(white);
      if (has(/SILENT/)) s.push("Ventilador silencioso");
    } else if (cat === "Memorias RAM") {
      if (cap) s.push(`Capacidad ${cap[1]} ${cap[2]}`);
      const sp = N.match(/\bDDR(\d)\s+(?:\d+GB\s+DDR\d\s+)?(\d{4})\b/); if (sp) s.push(`DDR${sp[1]} ${sp[2]} MHz`);
      s.push(has(/SODIMM/) ? "SODIMM (notebook)" : "DIMM (PC de escritorio)");
      if (has(/DISIPADOR|FURY|VENGEANCE|GAMMIX|SPECTRIX|ARMOR/)) s.push("Con disipador");
      if (light) s.push(light);
      if (white) s.push(white);
    } else if (cat === "Almacenamientos") {
      if (cap) s.push(`Capacidad ${cap[1]} ${cap[2]}`);
      s.push(has(/\bSSD\b/) ? "Disco sólido (SSD)" : "Disco rígido (HDD)");
      const gen = N.match(/GEN(\d)\b/);
      if (has(/EXTERNO/)) s.push(`Externo${has(/USB/) ? " · USB " + (N.match(/USB\s([\d.]+)/) || [, ""])[1] : ""}`.trim());
      else if (has(/NVME/)) s.push(`M.2 NVMe${gen ? " PCIe Gen" + gen[1] : ""}`);
      else if (has(/2\.5"/)) s.push('SATA III · 2.5"');
      else if (has(/3\.5"|SATA3|SATA III/)) s.push('SATA III · 3.5"');
      if (has(/PURPLE|SKYHAWK/)) s.push("Ideal para videovigilancia");
      if (light) s.push(light);
    } else if (cat === "Placas de video") {
      const chip = N.match(/\b(GT|RTX|RX)\s(\d{3,4})\b/);
      if (chip) s.push(`${chip[1] === "RX" ? "AMD Radeon" : "NVIDIA GeForce"} ${chip[1]} ${chip[2]}`);
      if (cap) s.push(`Memoria ${cap[1]} GB`);
      if (has(/LOW PROFILE|\bLP\b/)) s.push("Perfil bajo (low profile)");
      if (has(/\b3X\b/)) s.push("Triple ventilador"); else if (has(/\b2X\b|TWIN|DUAL|WINDFORCE/)) s.push("Doble ventilador");
      if (has(/\bOC\b/)) s.push("Overclock de fábrica");
      if (has(/VGA HDMI DVI/)) s.push("Salidas VGA / HDMI / DVI");
    } else if (cat === "Fuentes de poder") {
      const w = N.match(/(\d{3})W\b/); if (w) s.push(`Potencia ${w[1]} W`);
      const plus = N.match(/80 PLUS (WHITE|BRONZE|SILVER|GOLD|PLATINUM)/);
      if (plus) s.push(`Certificación 80 Plus ${niceToken(plus[1])}`);
      if (has(/SEMI MODULAR/)) s.push("Semi modular");
      if (has(/ATX 3\.1/)) s.push("ATX 3.1 · PCIe 5.1");
      if (has(/\bSFX\b/)) s.push("Formato SFX");
      if (has(/ICE|BLANCA/)) s.push("Color blanco");
      if (light) s.push(light);
    } else if (cat === "Gabinetes") {
      if (has(/\bTG\b|VIDRO/)) s.push("Vidrio templado");
      const fans = N.match(/\b(\d)\s?(?:FAN|COOLERS)\b/); if (fans) s.push(`${fans[1]} ${fans[1] === "1" ? "ventilador incluido" : "ventiladores incluidos"}`);
      if (has(/MESH/)) s.push("Frente mesh");
      const psu = N.match(/FUENTE\s(\d{3})W/); if (psu) s.push(`Incluye fuente de ${psu[1]} W`);
      const extras = [has(/TECLADO/) && "teclado", has(/MOUSE/) && "mouse", has(/PARLANTE/) && "parlantes", has(/AURICULAR/) && "auriculares"].filter(Boolean);
      if (extras.length) s.push(`Incluye ${extras.join(", ").replace(/, ([^,]*)$/, " y $1")}`);
      if (has(/MICRO ATX/)) s.push("Formato Micro-ATX"); else if (has(/MID TOWER/)) s.push("Mid tower");
      if (light) s.push(light);
      if (white) s.push(white);
    }
    return s;
  }

  /* ---------- Datos de compatibilidad ---------- */
  // Consumo aproximado (W) para estimar la fuente. Si un modelo no está, se estima por la gama.
  const TDP_CPU = { "3000G": 35, "3200G": 65, "3400G": 65, "3500X": 65, "5600": 65, "5600GT": 65, "5700": 65, "5700G": 65, "8400F": 65, "8500G": 65,
    "8600G": 65, "7600X": 105, "G5925": 58, "G7400": 46, "10105F": 65, "12100": 60, "12100F": 58, "13100F": 58, "14100": 60, "14100F": 58, "12400": 65,
    "12400F": 65, "14400F": 65 };
  const TDP_GPU = { "GT 210": 31, "GT 710": 19, "GT 1030": 30, "RTX 3050": 70, "RTX 5050": 130, "RX 7600": 165 };

  function cpuTdp(N) {
    const k = Object.keys(TDP_CPU).sort((a, b) => b.length - a.length).find((m) => new RegExp(`\\b${m}\\b`).test(N));
    if (k) return TDP_CPU[k];
    if (/RYZEN 9|I9\b/.test(N)) return 120;
    if (/X3D|\d{4}X\b|I7\b/.test(N)) return 105;
    return 65;
  }
  function gpuTdp(N) {
    const m = N.match(/\b(GT|RTX|GTX|RX)\s(\d{3,4})\b/);
    if (!m) return 150;
    const key = `${m[1]} ${m[2]}`;
    if (TDP_GPU[key]) return TDP_GPU[key];
    if (m[1] === "GT") return 35;
    const tier = Number(m[2].slice(-2, -1)) || 0; // 4060 → 6, 7800 → 8
    return m[1] === "RX" ? ({ 6: 165, 7: 245, 8: 265, 9: 315 }[m[2][1]] || 200) : ({ 5: 130, 6: 170, 7: 250, 8: 320, 9: 450 }[tier] || 200);
  }

  function computeAttrs(raw, cat) {
    const N = raw.toUpperCase(), a = {};
    const sockets = [...N.matchAll(/\b(AM4|AM5|S1200|S1700|S1851)\b/g)].map((m) => SOCKET[m[1]]);
    const ddr = (N.match(/\bDDR(\d)\b/) || [])[1];
    const gb = (() => { const m = N.match(/\b(\d+)\s?(GB|TB)\b/); return m ? Number(m[1]) * (m[2] === "TB" ? 1000 : 1) : null; })();
    if (cat === "Procesadores") {
      a.socket = sockets[0] || "";
      a.plataforma = /INTEL/.test(N) || /^LGA/.test(a.socket) ? "Intel" : "AMD";
      a.video = /C\/VIDEO|VEGA|CELERON|PENTIUM/.test(N) && !/S\/VIDEO/.test(N);
      a.cooler = /C\/COOLER/.test(N) || (/\bBOX\b/.test(N) && !/S\/COOLER/.test(N));
      a.tdp = cpuTdp(N);
    } else if (cat === "Motherboards") {
      a.socket = sockets[0] || "";
      a.ddr = ddr ? `DDR${ddr}` : "";
      a.formato = /\b[ABHXZ]\d{3}M\b|\b[ABHXZ]\d{3}M-|MICRO|MATX/.test(N) ? "Micro-ATX" : "ATX";
    } else if (cat === "Memorias RAM") {
      a.ddr = ddr ? `DDR${ddr}` : "";
      a.sodimm = /SODIMM/.test(N);
      a.gb = gb;
    } else if (cat === "Almacenamientos") {
      a.tipo = /\bSSD\b/.test(N) ? "SSD" : "HDD";
      a.interfaz = /EXTERNO/.test(N) ? "Externo" : /NVME/.test(N) ? "M.2 NVMe" : /\bM\.?2\b/.test(N) ? "M.2 SATA" : "SATA";
      a.gb = gb;
    } else if (cat === "Placas de video") {
      a.tdp = gpuTdp(N);
      a.gb = gb;
    } else if (cat === "Fuentes de poder") {
      a.watts = Number((N.match(/(\d{3})W\b/) || [])[1]) || 0;
    } else if (cat === "Gabinetes") {
      a.fuente = Number((N.match(/FUENTE\s(\d{3})W/) || [])[1]) || 0;
      a.formato = /MICRO ATX/.test(N) ? "Micro-ATX" : "ATX";
    } else if (cat === "Coolers") {
      a.sockets = sockets.length ? sockets : []; // vacío = universal
      a.maxTdp = Number((N.match(/\b(\d+)W\b/) || [])[1]) || 0; // 0 = sin límite conocido
      a.tipo = /WATER\s?COOL|\bAIO\b|LIQUID/.test(N) ? "Watercooler" : "Aire";
      if (a.tipo === "Watercooler") a.radiador = Number((N.match(/\b(120|240|280|360|420)\s?MM\b|\b[A-Z]*(120|240|280|360|420)\b/) || []).slice(1).find(Boolean)) || 0;
    }
    return a;
  }

  /* ---------- Producto completo a partir de los datos guardados ---------- */
  TW.buildProduct = function (d) {
    const raw = String(d.nombre || "").trim();
    let [name, notes] = splitNotes(raw);
    const N = name.toUpperCase();
    if (name === name.toUpperCase()) {
      name = name.replace(PREFIX, "").replace(/\s+CPU(?=\s+(AM4|AM5)\b)/, "").replace(/\s+/g, " ");
      name = name.split(" ").map(niceToken).join(" ");
    }
    let marca = String(d.marca || "").trim();
    if (!marca) {
      const b = BRANDS.find((b) => new RegExp(`(^|[\\s/])${b}($|[\\s/])`).test(N));
      marca = b ? BRAND_NAME[b] || niceToken(b) : /GEFORCE/.test(N) ? "NVIDIA" : /RADEON/.test(N) ? "AMD" : "Genérico";
    }
    const given = (Array.isArray(d.specs) ? d.specs : String(d.specs || "").split("|")).map((s) => s.trim()).filter(Boolean);
    const lista = Number(String(d.precio ?? "").replace(/[^\d]/g, "")) || null;
    // Oferta: un precioOferta menor al de lista pasa a ser el precio, y se guarda el anterior
    const off = Number(String(d.precioOferta ?? "").replace(/[^\d]/g, "")) || null;
    const oferta = !!(off && (!lista || off < lista));
    const precio = oferta ? off : lista;
    const stock = /^sin/i.test(d.stock || "") ? "sin stock" : "disponible";
    return {
      id: d.id || TW.slug(raw),
      nombre: raw,
      titulo: name.trim(),
      marca,
      categoria: String(d.categoria || "Otros").trim(),
      sub: String(d.sub || "").trim(),
      specs: (given.length ? given : autoSpecs(N, d.categoria).concat(d.categoria === "Motherboards" && d.attrs && d.attrs.slots ? [`${d.attrs.slots} slots de memoria`] : [])).concat(notes),
      attrs: Object.assign(computeAttrs(N, d.categoria), d.attrs || {}),
      precio, stock, oferta, precioLista: oferta ? lista : null,
      descuento: oferta && lista ? Math.round((1 - off / lista) * 100) : 0,
      destacado: d.destacado === true || /^(si|sí|true|1|x)$/i.test(String(d.destacado || "")),
      imagen: String(d.imagen || "").trim(),
      caja: String(d.caja || "").trim(),
      desc: String(d.desc || "").trim(),
      // Tabla de especificaciones: [["Socket", "AM4"], ...] o texto "Socket: AM4 | Chipset: A520"
      ficha: (Array.isArray(d.ficha) ? d.ficha : String(d.ficha || "").split("|").map((r) => r.split(/:\s*/))).map(([k, ...v]) => [String(k || "").trim(), v.join(": ").trim()]).filter(([k, v]) => k && v),
    };
  };

  // Categoría y subcategoría sugeridas para una línea nueva del mayorista
  TW.guessCategory = function (raw) {
    const N = raw.toUpperCase();
    const cat = /^MOTHER/.test(N) ? "Motherboards" : /^MICRO/.test(N) ? "Procesadores" : /^CPU COOLER|^COOLER/.test(N) ? "Coolers"
      : /^MEMORIA/.test(N) ? "Memorias RAM" : /^(HD|DISCO|SSD)/.test(N) ? "Almacenamientos" : /^PLACA DE VIDEO/.test(N) ? "Placas de video"
      : /^FUENTE/.test(N) ? "Fuentes de poder" : /^GABINETE/.test(N) ? "Gabinetes" : "";
    const a = computeAttrs(N, cat);
    let sub = "";
    if (cat === "Motherboards") sub = a.socket === "AM4" ? "AMD AM4" : a.socket === "AM5" ? "AMD AM5" : a.socket ? "Intel" : "";
    if (cat === "Procesadores") sub = a.socket === "AM4" ? "AMD AM4" : a.socket === "AM5" ? "AMD AM5" : a.socket ? `Intel ${a.socket}` : "";
    if (cat === "Coolers") sub = "Coolers CPU";
    if (cat === "Memorias RAM") sub = a.ddr;
    if (cat === "Almacenamientos") sub = a.tipo;
    return { categoria: cat, sub };
  };

  // Precio "$95.013" o "$44.851,11" → pesos enteros (se descartan los centavos)
  TW.parsePrice = (s) => Number(String(s).replace(/[^\d.,]/g, "").replace(/,\d{1,2}$/, "").replace(/[.,]/g, "")) || 0;
  // Línea "NOMBRE — $precio" (acepta también guion común)
  TW.parseLine = function (line) {
    const m = String(line).trim().match(/^(.*?)\s*[—–-]\s*\$\s*([\d.,]+)\s*$/);
    return m ? { nombre: m[1].trim(), precio: TW.parsePrice(m[2]) } : null;
  };
  // Lista completa, con líneas "# Categoría | Subcategoría" opcionales
  TW.parseList = function (text) {
    const out = []; let categoria = "", sub = "";
    for (const rawLine of String(text).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith("#")) { [categoria, sub = ""] = line.slice(1).split("|").map((s) => s.trim()); continue; }
      const p = TW.parseLine(line);
      if (p) out.push({ ...p, categoria, sub });
    }
    return out;
  };

  /* ---------- Carga de datos ---------- */
  TW.loadData = async function () {
    const v = Math.floor(Date.now() / 60000); // evita quedarse con una versión vieja en caché
    const get = (f) => fetch(`data/${f}?v=${v}`).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); });
    const [cat, pcs] = await Promise.all([get("catalogo.json"), get("pcs.json").catch(() => [])]);
    return TW.indexData(cat, pcs);
  };
  TW.indexData = function (catRaw, pcsRaw) {
    const products = catRaw.map(TW.buildProduct).filter((p) => p.nombre);
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    return { products, byId, pcs: pcsRaw || [] };
  };

  /* =========================================================
     ARMADOR DE PC · reglas de compatibilidad
     ========================================================= */
  TW.STEPS = [
    { key: "cpu", cat: "Procesadores", label: "Procesador", tip: "Elegí tu procesador: define la potencia de tu PC." },
    { key: "mobo", cat: "Motherboards", label: "Motherboard", tip: "Solo te mostramos las mothers con el mismo socket que tu procesador." },
    { key: "cooler", cat: "Coolers", label: "Cooler", tip: "Te mostramos los coolers compatibles con tu procesador. Si ya trae uno, este paso es opcional." },
    { key: "ram", cat: "Memorias RAM", label: "Memoria RAM", tip: "Mostramos las memorias que soporta tu mother. Tocá una y elegí cuántas: con 2 o 4 módulos usás dual channel. Podés combinar distintas hasta llenar los slots.", slots: true },
    { key: "storage", cat: "Almacenamientos", label: "Almacenamiento", tip: "Sumá todos los discos que quieras hasta llenar los puertos de tu mother. Un SSD hace que todo arranque mucho más rápido.", slots: true },
    { key: "gpu", cat: "Placas de video", label: "Placa de video", tip: "Necesaria para jugar. Si tu procesador tiene video integrado, es opcional." },
    { key: "psu", cat: "Fuentes de poder", label: "Fuente", tip: "Te mostramos las fuentes con potencia suficiente para tu configuración." },
    { key: "case", cat: "Gabinetes", label: "Gabinete", tip: "El último paso: elegí dónde va todo. Algunos gabinetes ya incluyen fuente, teclado o mouse." },
  ];
  TW.stepOf = (key) => TW.STEPS.find((s) => s.key === key);
  TW.stepForCategory = (cat) => TW.STEPS.find((s) => s.cat === cat);
  TW.emptyBuild = () => ({ plataforma: "", cpu: [], mobo: [], ram: [], storage: [], gpu: [], case: [], psu: [], cooler: [] });

  const first = (sel, key, byId) => (sel[key] && sel[key][0] ? byId[sel[key][0].id] : null);

  // Consumo estimado y fuente mínima recomendada
  TW.power = function (sel, byId) {
    const cpu = first(sel, "cpu", byId), gpu = first(sel, "gpu", byId);
    const est = Math.round((cpu ? cpu.attrs.tdp * 1.4 : 90) + (gpu ? gpu.attrs.tdp : 0) + 60);
    const min = Math.ceil((est * 1.25) / 50) * 50;
    // Recomendada: la del fabricante de la placa de video si la informa, con un piso de 550 W (450 W sin placa)
    const rec = Math.max(min, gpu ? Math.max(550, Number(gpu.attrs.psuRec) || 0) : 450);
    return { est, min, rec };
  };

  TW.isRequired = function (key, sel, byId) {
    const cpu = first(sel, "cpu", byId), gab = first(sel, "case", byId);
    if (key === "gpu") return !cpu || !cpu.attrs.video;
    if (key === "cooler") return !cpu || !cpu.attrs.cooler;
    if (key === "psu") return !(gab && gab.attrs.fuente >= TW.power(sel, byId).min);
    return true;
  };

  /* ---------- Slots de la mother (memorias y discos) ---------- */
  // Módulos que ocupa una memoria (un kit 2x8GB ocupa 2 slots)
  TW.modules = (p) => Math.max(1, Number(p && p.attrs.modulos) || (/\b2\s?X\s?\d+\s?GB\b|\(2X/i.test(p ? p.nombre : "") ? 2 : 1));
  const isM2 = (p) => /^M.2/.test(p.attrs.interfaz || "");
  // Capacidad de la mother: slots de RAM, slots M.2 y puertos SATA (si no se sabe: 2 RAM, 1 M.2, 4 SATA)
  TW.capacity = function (sel, byId) {
    const mobo = first(sel, "mobo", byId), n = (v, d) => (v === 0 || v ? Number(v) : d);
    return { ram: n(mobo && mobo.attrs.slots, mobo ? 2 : 4), m2: n(mobo && mobo.attrs.m2, 1), sata: n(mobo && mobo.attrs.sata, 4) };
  };
  // Lo que ya está ocupado con lo elegido
  TW.usage = function (sel, byId) {
    const u = { ram: 0, m2: 0, sata: 0 };
    for (const c of sel.ram || []) if (byId[c.id]) u.ram += (c.qty || 1) * TW.modules(byId[c.id]);
    for (const c of sel.storage || []) { const p = byId[c.id]; if (p) u[isM2(p) ? "m2" : "sata"] += c.qty || 1; }
    return u;
  };
  TW.slotOf = (key, p) => (key === "ram" ? "ram" : isM2(p) ? "m2" : "sata");
  // Cuántas unidades más de este producto entran en la mother
  TW.room = function (key, p, sel, byId) {
    const cap = TW.capacity(sel, byId), used = TW.usage(sel, byId), slot = TW.slotOf(key, p);
    return Math.max(0, Math.floor((cap[slot] - used[slot]) / (key === "ram" ? TW.modules(p) : 1)));
  };
  // Cantidad máxima de un componente (la usa el panel para las PCs armadas)
  TW.maxQty = function (key, sel, byId) {
    const cap = TW.capacity(sel, byId);
    if (key === "ram") return Math.max(1, Math.min(8, cap.ram));
    if (key === "storage") return Math.max(1, cap.m2 + cap.sata);
    return 1;
  };

  // null si el producto es compatible con lo elegido; si no, el motivo
  TW.incompatibility = function (key, p, sel, byId) {
    if (p.stock === "sin stock") return "Sin stock";
    const cpu = first(sel, "cpu", byId), mobo = first(sel, "mobo", byId);
    const socketPlat = (s) => (/^LGA/.test(s) ? "Intel" : "AMD");
    switch (key) {
      case "cpu":
        return null; // el procesador define la plataforma: se puede cambiar de AMD a Intel en cualquier momento
      case "mobo":
        if (!p.attrs.socket) return null;
        if (cpu && cpu.attrs.socket && p.attrs.socket !== cpu.attrs.socket) return `Socket ${p.attrs.socket} (tu procesador es ${cpu.attrs.socket})`;
        if (!cpu && sel.plataforma && socketPlat(p.attrs.socket) !== sel.plataforma) return `No es ${sel.plataforma}`;
        return null;
      case "ram": {
        if (p.attrs.sodimm) return "Es de notebook (SODIMM)";
        const want = mobo ? mobo.attrs.ddr : cpu ? ({ AM5: "DDR5", AM4: "DDR4", "LGA 1200": "DDR4", "LGA 1851": "DDR5" }[cpu.attrs.socket] || "") : "";
        if (want && p.attrs.ddr && p.attrs.ddr !== want) return `Es ${p.attrs.ddr} (tu mother usa ${want})`;
        const slots = TW.capacity(sel, byId).ram;
        if (mobo && TW.modules(p) > slots) return `Es un kit de ${TW.modules(p)} módulos y tu mother tiene ${slots} slots`;
        return null;
      }
      case "storage": {
        if (p.attrs.interfaz === "Externo") return "Es un disco externo";
        if (mobo && isM2(p) && TW.capacity(sel, byId).m2 === 0) return "Tu mother no tiene slot M.2";
        return null;
      }
      case "gpu": {
        const gab = first(sel, "case", byId);
        if (gab && gab.attrs.maxGpu && p.attrs.largo && p.attrs.largo > gab.attrs.maxGpu) return `Mide ${p.attrs.largo} mm y en tu gabinete entran hasta ${gab.attrs.maxGpu} mm`;
        return null;
      }
      case "case": {
        if (mobo && mobo.attrs.formato === "ATX" && p.attrs.formato === "Micro-ATX") return "Es Micro-ATX y tu mother es ATX";
        if (mobo && mobo.attrs.formato && mobo.attrs.formato !== "Mini-ITX" && p.attrs.formato === "Mini-ITX") return `Es Mini-ITX y tu mother es ${mobo.attrs.formato}`;
        const gpu = first(sel, "gpu", byId), cool = first(sel, "cooler", byId);
        if (gpu && gpu.attrs.largo && p.attrs.maxGpu && gpu.attrs.largo > p.attrs.maxGpu) return `Tu placa de video mide ${gpu.attrs.largo} mm y entran hasta ${p.attrs.maxGpu} mm`;
        if (cool && cool.attrs.altura && p.attrs.maxCooler && cool.attrs.altura > p.attrs.maxCooler) return `Tu cooler mide ${cool.attrs.altura} mm de alto y entran hasta ${p.attrs.maxCooler} mm`;
        if (cool && cool.attrs.radiador && p.attrs.radiador != null && p.attrs.radiador !== "" && cool.attrs.radiador > Number(p.attrs.radiador))
          return Number(p.attrs.radiador) ? `Tu watercooler es de ${cool.attrs.radiador} mm y entran radiadores de hasta ${p.attrs.radiador} mm` : "No tiene lugar para el radiador de tu watercooler";
        return null;
      }
      case "psu": {
        const { min } = TW.power(sel, byId);
        return p.attrs.watts && p.attrs.watts < min ? `${p.attrs.watts} W no alcanza (mínimo ${min} W)` : null;
      }
      case "cooler":
        if (cpu && p.attrs.sockets && p.attrs.sockets.length && !p.attrs.sockets.includes(cpu.attrs.socket)) return `No es compatible con ${cpu.attrs.socket}`;
        if (cpu && p.attrs.maxTdp && p.attrs.maxTdp < cpu.attrs.tdp) return `Soporta ${p.attrs.maxTdp} W y tu procesador necesita ${cpu.attrs.tdp} W`;
        { const gab = first(sel, "case", byId);
          if (gab && gab.attrs.maxCooler && p.attrs.altura && p.attrs.altura > gab.attrs.maxCooler) return `Mide ${p.attrs.altura} mm de alto y en tu gabinete entran hasta ${gab.attrs.maxCooler} mm`;
          if (gab && p.attrs.radiador && gab.attrs.radiador != null && gab.attrs.radiador !== "" && p.attrs.radiador > Number(gab.attrs.radiador)) return `Radiador de ${p.attrs.radiador} mm: en tu gabinete entran hasta ${gab.attrs.radiador || 0} mm`; }
        return null;
      default:
        return null;
    }
  };

  TW.options = function (key, sel, data) {
    const step = TW.stepOf(key);
    return data.products.filter((p) => p.categoria === step.cat && !TW.incompatibility(key, p, sel, data.byId));
  };

  // Revisa una configuración completa: faltantes e incompatibilidades
  TW.checkBuild = function (sel, byId) {
    const issues = [];
    for (const step of TW.STEPS) {
      const chosen = (sel[step.key] || []).filter((c) => byId[c.id]);
      if (!chosen.length && TW.isRequired(step.key, sel, byId)) issues.push({ key: step.key, level: "falta", msg: `Falta elegir ${step.label.toLowerCase()}` });
      for (const c of chosen) {
        const why = TW.incompatibility(step.key, byId[c.id], sel, byId);
        if (why && why !== "Sin stock") issues.push({ key: step.key, level: "error", msg: `${step.label}: ${why}` });
        if (why === "Sin stock") issues.push({ key: step.key, level: "aviso", msg: `${byId[c.id].titulo} figura sin stock` });
      }
      if ((sel[step.key] || []).some((c) => !byId[c.id])) issues.push({ key: step.key, level: "aviso", msg: `${step.label}: un componente ya no está en el catálogo` });
    }
    // Más memorias o discos de los que entran en la mother
    const cap = TW.capacity(sel, byId), used = TW.usage(sel, byId);
    if (used.ram > cap.ram) issues.push({ key: "ram", level: "error", msg: `Memoria RAM: son ${used.ram} módulos y tu mother tiene ${cap.ram} slots` });
    if (used.m2 > cap.m2) issues.push({ key: "storage", level: "error", msg: `Almacenamiento: son ${used.m2} discos M.2 y tu mother tiene ${cap.m2} slot${cap.m2 === 1 ? "" : "s"} M.2` });
    if (used.sata > cap.sata) issues.push({ key: "storage", level: "error", msg: `Almacenamiento: son ${used.sata} discos SATA y tu mother tiene ${cap.sata} puertos SATA` });
    return issues;
  };

  // Saca lo que dejó de ser compatible después de un cambio (devuelve lo que se quitó)
  TW.pruneBuild = function (sel, byId) {
    const removed = [];
    for (const step of TW.STEPS) {
      sel[step.key] = (sel[step.key] || []).filter((c) => {
        const p = byId[c.id];
        const ok = p && !TW.incompatibility(step.key, p, sel, byId);
        if (!ok && p) removed.push(p.titulo);
        return ok;
      });
    }
    // Si la nueva mother tiene menos slots, se sacan memorias o discos desde el último elegido
    const cap = TW.capacity(sel, byId);
    const trim = (key, slot) => {
      const list = sel[key];
      for (let i = list.length - 1; i >= 0 && TW.usage(sel, byId)[slot] > cap[slot]; i--) {
        const p = byId[list[i].id];
        if (TW.slotOf(key, p) !== slot) continue;
        while (list[i].qty > 1 && TW.usage(sel, byId)[slot] > cap[slot]) list[i].qty--;
        if (TW.usage(sel, byId)[slot] > cap[slot]) { removed.push(p.titulo); list.splice(i, 1); }
      }
    };
    trim("ram", "ram"); trim("storage", "m2"); trim("storage", "sata");
    return removed;
  };

  TW.buildLines = function (sel, byId) {
    const lines = [];
    for (const step of TW.STEPS) for (const c of sel[step.key] || []) if (byId[c.id]) lines.push({ step, p: byId[c.id], qty: c.qty || 1 });
    return lines;
  };
  TW.linesTotal = (lines) => lines.reduce((t, l) => t + (l.p.precio || 0) * l.qty, 0);

  // Configuración a partir de una lista de componentes (PC armada → armador)
  TW.buildFromComponents = function (comps, byId) {
    const sel = TW.emptyBuild();
    for (const c of comps || []) {
      const p = byId[c.id];
      const step = p && TW.stepForCategory(p.categoria);
      if (step) sel[step.key].push({ id: c.id, qty: c.qty || 1 });
    }
    const cpu = first(sel, "cpu", byId);
    sel.plataforma = cpu ? cpu.attrs.plataforma : "";
    return sel;
  };

  /* ---------- PCs armadas ---------- */
  TW.pcLines = (pc, byId) => (pc.componentes || []).filter((c) => byId[c.id]).map((c) => ({ p: byId[c.id], qty: c.qty || 1 }));
  TW.pcSum = (pc, byId) => TW.linesTotal(TW.pcLines(pc, byId));
  TW.pcPrice = (pc, byId) => Number(pc.precio) || TW.pcSum(pc, byId);
  TW.pcSummary = function (pc, byId) {
    const lines = TW.pcLines(pc, byId);
    const find = (cat) => lines.filter((l) => l.p.categoria === cat);
    const cpu = find("Procesadores")[0], gpu = find("Placas de video")[0];
    const ramGb = find("Memorias RAM").reduce((t, l) => t + (l.p.attrs.gb || 0) * l.qty, 0);
    const disks = find("Almacenamientos").map((l) => `${l.p.attrs.tipo} ${l.p.attrs.gb >= 1000 ? l.p.attrs.gb / 1000 + " TB" : l.p.attrs.gb + " GB"}`);
    const short = (p) => p.titulo.replace(/\s+(c|s)\/.*$/i, "").replace(/\s+(AM4|AM5|S1200|S1700)$/i, "");
    return {
      cpu: cpu ? short(cpu.p) : "", cpuMarca: cpu ? cpu.p.marca : "",
      ram: ramGb ? `${ramGb} GB RAM` : "",
      disco: disks.join(" + "),
      video: gpu ? (gpu.p.specs[0] || gpu.p.titulo).replace(/^NVIDIA |^AMD /, "") : cpu && cpu.p.attrs.video ? "Video integrado" : "",
    };
  };

  /* =========================================================
     CARRITO (se guarda en el navegador del cliente)
     ========================================================= */
  const CART_KEY = "tw_cart_v1";
  TW.cart = {
    items: [],
    load() { try { this.items = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { this.items = []; } return this; },
    save() { try { localStorage.setItem(CART_KEY, JSON.stringify(this.items)); } catch {} document.dispatchEvent(new CustomEvent("tw:cart")); },
    add(item) {
      const same = this.items.find((i) => i.type === item.type && i.type !== "armado" && i.id === item.id);
      if (same) same.qty += item.qty || 1;
      else this.items.push({ key: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), qty: 1, ...item });
      this.save();
    },
    setQty(key, qty) { const i = this.items.find((x) => x.key === key); if (i) i.qty = Math.max(1, Math.min(99, qty)); this.save(); },
    remove(key) { this.items = this.items.filter((x) => x.key !== key); this.save(); },
    clear() { this.items = []; this.save(); },
    count() { return this.items.reduce((t, i) => t + i.qty, 0); },
  };

  // Resuelve un ítem del carrito con los datos actuales (precios al día)
  TW.cartLine = function (item, data) {
    if (item.type === "producto") {
      const p = data.byId[item.id];
      return p ? { item, titulo: p.titulo, unit: p.precio || 0, lista: p.oferta ? p.precioLista : 0, detalle: [], thumb: TW.thumb(p) } : null;
    }
    if (item.type === "pc") {
      const pc = data.pcs.find((x) => x.id === item.id);
      if (!pc) return null;
      const gab = TW.pcLines(pc, data.byId).find((l) => l.p.categoria === "Gabinetes" && l.p.imagen);
      const img = pc.imagen || (gab && gab.p.imagen);
      return { item, titulo: pc.nombre, unit: TW.pcPrice(pc, data.byId), detalle: TW.pcLines(pc, data.byId).map((l) => `${l.qty > 1 ? l.qty + "x " : ""}${l.p.titulo}`), thumb: img ? `<img src="${esc(img)}" alt="">` : null };
    }
    if (item.type === "armado") {
      const lines = (item.comps || []).filter((c) => data.byId[c.id]).map((c) => ({ p: data.byId[c.id], qty: c.qty || 1 }));
      if (!lines.length) return null;
      const gab = lines.find((l) => l.p.categoria === "Gabinetes" && l.p.imagen);
      const detalle = lines.map((l) => `${l.qty > 1 ? l.qty + "x " : ""}${l.p.titulo}`);
      if (item.coolerStock) detalle.push("Cooler incluido con el procesador");
      if (item.gpuInt) detalle.push("Video integrado del procesador");
      return { item, titulo: item.nombre || "PC armada a medida", unit: TW.linesTotal(lines), detalle, thumb: gab ? `<img src="${esc(gab.p.imagen)}" alt="">` : null };
    }
    return null;
  };

  TW.cartMessage = function (data, nota) {
    const lines = TW.cart.items.map((i) => TW.cartLine(i, data)).filter(Boolean);
    const total = lines.reduce((t, l) => t + l.unit * l.item.qty, 0);
    let msg = `Hola ${CFG.negocio.nombre}! Quiero hacer este pedido:\n\n`;
    for (const l of lines) {
      msg += `• ${l.item.qty}x ${l.titulo} — ${l.unit ? TW.money(l.unit * l.item.qty) : "consultar precio"}\n`;
      for (const d of l.detalle) msg += `   - ${d}\n`;
    }
    msg += `\nTotal estimado: ${TW.money(total)}\n`;
    if (nota && nota.trim()) msg += `\n${nota.trim()}\n`;
    msg += `\n¿Me confirman stock y forma de pago/envío? Gracias!`;
    return msg;
  };
})();
