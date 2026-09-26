/* =========================================================
   Titanware · tienda
   Vistas: #/ (inicio) · #/armar · #/pcs · #/catalogo/<categoría> · #/pedido
   ========================================================= */
(function () {
  const CFG = window.TW_CONFIG, U = TW.UI, esc = TW.esc, norm = TW.norm;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NEG = CFG.negocio;

  let data = { products: [], byId: {}, pcs: [] };
  const cat = { q: "", cat: "Todos", sub: "", brand: "", sort: "destacados" };
  let pcFilter = "Todas";
  let currentView = "";

  /* ---------- Textos y links fijos ---------- */
  function setupStatic() {
    const general = TW.waLink(`Hola ${NEG.nombre}! Quería hacer una consulta.`);
    ["#topWa", "#floatWa", "#footWa"].forEach((s) => ($(s).href = general));
    $$(".top-phone").forEach((a) => { a.href = general; a.textContent = NEG.whatsappVisible; });
    setupTicker();
    $("#footPlace").textContent = NEG.ubicacion;
    $("#bandWa").href = TW.waLink(`Hola ${NEG.nombre}! Quería asesoramiento para elegir mi PC.`);
    $("#footIg").href = `https://instagram.com/${NEG.instagram}`;
    $("#footIg span").textContent = `@${NEG.instagram}`;
    $("#year").textContent = new Date().getFullYear();
    $("#mainnav").insertAdjacentHTML("beforeend", CFG.categorias.map((c) =>
      `<a href="#/catalogo/${encodeURIComponent(c)}" data-route="catalogo" data-cat="${esc(c)}">${esc(c)}</a>`).join(""));
    $("#tileIcoBuild").innerHTML = TW.ICONS.Procesadores;
    $("#tileIcoPcs").innerHTML = TW.ICONS.Gabinetes;
    $("#tileIcoCat").innerHTML = TW.ICONS["Placas de video"];
  }

  /* ---------- Cinta de la barra superior ---------- */
  // Repite la lista las veces necesarias para que la cinta pase sin cortes en cualquier ancho de pantalla
  function setupTicker() {
    const track = $(".ticker-track"), list = track && $(".ticker-list", track);
    if (!list) return;
    const fill = () => {
      $$(".ticker-list[aria-hidden]", track).forEach((l) => l.remove());
      const need = Math.ceil(innerWidth / Math.max(1, list.offsetWidth)) + 1;
      for (let i = 0; i < need; i++) {
        const c = list.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        $$("a", c).forEach((a) => (a.tabIndex = -1));
        track.appendChild(c);
      }
      track.style.setProperty("--ticker-time", `${Math.round(list.offsetWidth / 45)}s`);
    };
    fill();
    let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fill, 200); });
  }

  /* ---------- Aviso flotante ---------- */
  let toastTimer;
  function toast(msg, withCart = false) {
    const t = $("#toast");
    t.innerHTML = `${U.check}<span>${esc(msg)}</span>${withCart ? '<button type="button" data-opencart>Ver carrito</button>' : ""}`;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3800);
  }

  /* ---------- Router ---------- */
  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [view = "", ...rest] = h.split("/");
    return { view: ["armar", "pcs", "catalogo", "pedido"].includes(view) ? view : "home", arg: rest.join("/") };
  }
  function route() {
    const { view, arg } = parseHash();
    $$("[data-view]").forEach((s) => (s.hidden = s.dataset.view !== view));
    document.body.classList.toggle("building", view === "armar");
    $$("#mainnav a").forEach((a) => {
      const on = a.dataset.route === view && (view !== "catalogo" || (a.dataset.cat || "") === (arg || "") || (!a.dataset.cat && !arg));
      a.toggleAttribute("aria-current", false);
      if (on) a.setAttribute("aria-current", "page");
    });
    if (view === "catalogo") {
      const next = CFG.categorias.includes(arg) || (arg === "Ofertas" && data.products.some((p) => p.oferta)) ? arg : "Todos";
      if (next !== cat.cat) {
        cat.cat = next; cat.sub = "";
        if (next !== "Todos") { cat.q = ""; $("#q").value = ""; }
      }
      renderCatalog();
    }
    if (view === "pcs") { pcFilter = arg || "Todas"; renderPCs(); }
    if (view === "armar") renderBuilder();
    if (view === "home") renderHome();
    if (view === "pedido") renderOrder();
    const titles = { home: "Componentes y PCs armadas", armar: "Armá tu PC", pcs: "PC Armadas", pedido: "Tu pedido", catalogo: cat.cat === "Todos" ? "Catálogo" : cat.cat };
    document.title = `Titanware · ${titles[view]}`;
    if (currentView !== view || view === "catalogo" || view === "pcs") scrollTo({ top: 0 });
    currentView = view;
  }

  /* =========================================================
     PRODUCTOS
     ========================================================= */
  function productCard(p) {
    return `
    <button class="card${p.stock === "sin stock" ? " is-off" : ""}" type="button" data-product="${esc(p.id)}" aria-label="${esc(p.titulo)}, ver detalle">
      ${p.destacado ? `<span class="badge">${U.star} Destacado</span>` : ""}
      <div class="thumb">${TW.thumb(p, true)}${TW.offerTag(p)}</div>
      <div class="card-body">
        <div class="meta"><span>${esc(p.marca)}</span><span>${esc(p.sub || p.categoria)}</span></div>
        <h3>${esc(p.titulo)}</h3>
        <p class="specs-short">${esc(p.specs.slice(0, 2).join(", "))}</p>
        <div class="card-foot">${TW.productPrice(p)}<span class="stock ${p.stock.replace(" ", "-")}">${TW.STOCK[p.stock]}</span></div>
        <div class="card-cta">Ver detalle ${U.arrow}</div>
      </div>
    </button>`;
  }

  function openProduct(id) {
    const p = data.byId[id];
    if (!p) return;
    const msg = `Hola ${NEG.nombre}! Quería consultar por: ${p.titulo}${p.precio ? ` (${TW.money(p.precio)})` : ""}. ¿Tienen stock?`;
    const m = $("#modal");
    m.className = "";
    m.innerHTML = `
      <button class="close" type="button" aria-label="Cerrar" data-close>${U.close}</button>
      <div class="modal">
        <div class="thumb">${TW.thumb(p, true)}${TW.offerTag(p)}</div>
        <div class="modal-body">
          <div class="meta"><span>${esc(p.marca)} · ${esc(p.categoria)}${p.sub ? ` · ${esc(p.sub)}` : ""}</span></div>
          <h2 id="mTitle">${esc(p.titulo)}</h2>
          <div class="modal-price">${TW.productPrice(p)}<span class="stock ${p.stock.replace(" ", "-")}">${TW.STOCK[p.stock]}</span></div>
          ${p.specs.length ? `<p class="spec-title">Características</p><ul class="spec-list">${p.specs.map((s) => `<li>${U.check}<span>${esc(s)}</span></li>`).join("")}</ul>` : ""}
          <div class="modal-actions">
            <button class="btn" type="button" data-add="${esc(p.id)}"${p.stock === "sin stock" ? " disabled" : ""}>${U.cart} Agregar al carrito</button>
            <a class="btn ghost" href="#/armar" data-close>${U.wrench} Armá tu PC</a>
            <a class="btn wa" href="${TW.waLink(msg)}" target="_blank" rel="noopener">${U.wa} Consultar por WhatsApp</a>
          </div>
          <p class="note">Precios y stock sujetos a cambios. Te los confirmamos por WhatsApp antes de tu compra.</p>
        </div>
      </div>`;
    m.showModal();
  }

  /* ---------- Catálogo ---------- */
  function renderCatalog() {
    renderCats(); renderBrands(); renderGrid();
  }
  function renderCats() {
    const counts = data.products.reduce((a, p) => ((a[p.categoria] = (a[p.categoria] || 0) + 1), a), {});
    const extra = Object.keys(counts).filter((c) => !CFG.categorias.includes(c));
    const nOff = data.products.filter((p) => p.oferta).length;
    const cats = ["Todos", ...(nOff ? ["Ofertas"] : []), ...CFG.categorias, ...extra];
    counts.Ofertas = nOff;
    $("#cats").innerHTML = cats.map((c) =>
      `<a class="cat${c === "Ofertas" ? " is-offer" : ""}" href="#/catalogo/${c === "Todos" ? "" : encodeURIComponent(c)}" aria-pressed="${c === cat.cat}">${esc(c)} <small>${c === "Todos" ? data.products.length : counts[c] || 0}</small></a>`).join("");

    updateCatsFade();
    renderSubs();
  }
  function renderSubs() {
    const subs = cat.cat === "Todos" || cat.cat === "Ofertas" ? [] : [...new Set(data.products.filter((p) => p.categoria === cat.cat && p.sub).map((p) => p.sub))];
    $("#subcats").hidden = subs.length < 2;
    $("#subcats").innerHTML = ["", ...subs].map((s) =>
      `<button class="sub" type="button" data-sub="${esc(s)}" aria-pressed="${s === cat.sub}">${s ? esc(s) : "Todas"}</button>`).join("");
  }
  function updateCatsFade() {
    const el = $("#cats");
    el.parentElement.classList.toggle("overflow", el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }
  const inCat = (p) => cat.cat === "Todos" || (cat.cat === "Ofertas" ? p.oferta : p.categoria === cat.cat);
  function renderBrands() {
    const counts = {};
    for (const p of data.products) {
      if (!inCat(p)) continue;
      if (cat.sub && p.sub !== cat.sub) continue;
      if (p.marca && p.marca !== "Genérico") counts[p.marca] = (counts[p.marca] || 0) + 1;
    }
    const brands = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    if (!counts[cat.brand]) cat.brand = "";
    $("#brand").innerHTML = `<option value="">Todas las marcas</option>` +
      brands.map((b) => `<option value="${esc(b)}"${b === cat.brand ? " selected" : ""}>${esc(b)} (${counts[b]})</option>`).join("");
  }
  function filteredProducts() {
    const words = norm(cat.q).split(/\s+/).filter(Boolean);
    const list = data.products.filter((p) => {
      if (!inCat(p)) return false;
      if (cat.sub && p.sub !== cat.sub) return false;
      if (cat.brand && p.marca !== cat.brand) return false;
      const hay = norm([p.titulo, p.nombre, p.marca, p.categoria, p.sub, ...p.specs].join(" "));
      return words.every((w) => hay.includes(w));
    });
    const byPrice = (dir) => (a, b) => (a.precio == null) - (b.precio == null) || dir * ((a.precio || 0) - (b.precio || 0));
    const sorters = {
      destacados: (a, b) => b.oferta - a.oferta || b.destacado - a.destacado || (a.stock === "sin stock") - (b.stock === "sin stock"),
      az: (a, b) => a.titulo.localeCompare(b.titulo),
      "precio-asc": byPrice(1),
      "precio-desc": byPrice(-1),
    };
    return list.sort(sorters[cat.sort]);
  }
  function renderGrid() {
    const list = filteredProducts();
    $("#count").textContent = `${list.length} ${list.length === 1 ? "producto" : "productos"}`;
    $("#resultsTitle").textContent = cat.q.trim() ? `Resultados para “${cat.q.trim()}”` : cat.cat === "Todos" ? "Todos los productos" : cat.cat + (cat.sub ? ` · ${cat.sub}` : "");
    if (!list.length) {
      const ask = TW.waLink(`Hola ${NEG.nombre}! Estoy buscando: ${cat.q.trim() || "un producto"}. ¿Lo tienen o lo pueden conseguir?`);
      $("#grid").innerHTML = `<div class="empty"><strong>No encontramos productos con esos filtros</strong>Probá con otra búsqueda o consultanos: capaz lo conseguimos.<div class="actions"><button class="btn ghost" type="button" id="reset">Ver todo el catálogo</button><a class="btn wa" href="${ask}" target="_blank" rel="noopener">${U.wa} Consultar por WhatsApp</a></div></div>`;
      return;
    }
    $("#grid").innerHTML = list.map(productCard).join("");
  }

  /* =========================================================
     PCs ARMADAS
     ========================================================= */
  // Imagen de una PC armada: su foto propia, o la del gabinete con el logo del procesador, o un ícono
  function pcArt(pc, s) {
    const cpuLogo = s.cpuMarca ? TW.logoHtml(s.cpuMarca, TW.LOGOS[s.cpuMarca]) : "";
    if (pc.imagen) return { html: `<img src="${esc(pc.imagen)}" alt="${esc(pc.nombre)}" loading="lazy">`, photo: true };
    const gab = TW.pcLines(pc, data.byId).find((l) => l.p.categoria === "Gabinetes" && l.p.imagen);
    if (gab) return { html: `<img src="${esc(gab.p.imagen)}" alt="${esc(pc.nombre)}" loading="lazy">${cpuLogo ? `<span class="cpu-badge">${cpuLogo}</span>` : ""}`, photo: true };
    return { html: `<span class="case">${TW.ICONS.Gabinetes}</span>${cpuLogo}`, photo: false };
  }

  function pcCard(pc) {
    const s = TW.pcSummary(pc, data.byId), price = TW.pcPrice(pc, data.byId);
    const { html: art, photo } = pcArt(pc, s);
    const li = (ico, t) => (t ? `<li>${ico}<span>${esc(t)}</span></li>` : "");
    return `
    <article class="pc-card">
      <button class="pc-thumb${photo ? " photo" : ""}" type="button" data-pc="${esc(pc.id)}" aria-label="Ver ${esc(pc.nombre)}">${pc.destacado ? `<span class="badge">${U.star} Destacada</span>` : ""}${art}</button>
      <div class="pc-body">
        <div class="meta"><span>${esc(pc.categoria)}</span></div>
        <h3>${esc(pc.nombre)}</h3>
        <ul class="pc-specs">
          ${li(TW.ICONS.Procesadores, s.cpu)}${li(TW.ICONS["Memorias RAM"], s.ram)}${li(TW.ICONS.Almacenamientos, s.disco)}${li(TW.ICONS["Placas de video"], s.video)}
        </ul>
        <div class="pc-foot">${TW.priceHtml(price)}
          <div class="btns"><button class="btn sm ghost" type="button" data-pc="${esc(pc.id)}">Ver</button><button class="btn sm" type="button" data-addpc="${esc(pc.id)}">${U.cart} Agregar</button></div>
        </div>
      </div>
    </article>`;
  }

  function renderPCs() {
    const cats = ["Todas", ...CFG.categoriasPC.filter((c) => data.pcs.some((p) => p.categoria === c))];
    if (!cats.includes(pcFilter)) pcFilter = "Todas";
    $("#pcTabs").innerHTML = cats.map((c) => `<a class="cat" href="#/pcs/${c === "Todas" ? "" : encodeURIComponent(c)}" aria-pressed="${c === pcFilter}">${esc(c)}</a>`).join("");
    const list = data.pcs.filter((p) => pcFilter === "Todas" || p.categoria === pcFilter);
    $("#pcGrid").innerHTML = list.length ? list.map(pcCard).join("")
      : `<div class="empty"><strong>Todavía no hay PCs armadas en esta categoría</strong>Armá la tuya en el armador o consultanos.<div class="actions"><a class="btn" href="#/armar">Armá tu PC</a></div></div>`;
  }

  function openPc(id) {
    const pc = data.pcs.find((x) => x.id === id);
    if (!pc) return;
    const lines = TW.pcLines(pc, data.byId), price = TW.pcPrice(pc, data.byId), s = TW.pcSummary(pc, data.byId);
    const msg = `Hola ${NEG.nombre}! Me interesa la ${pc.nombre} (${TW.money(price)}). ¿Está disponible?`;
    const m = $("#modal");
    m.className = "pc-modal";
    m.innerHTML = `
      <button class="close" type="button" aria-label="Cerrar" data-close>${U.close}</button>
      <div class="modal">
        <div class="thumb">${(() => { const a = pcArt(pc, s); return a.photo ? a.html.replace(/<span class="cpu-badge">[\s\S]*<\/span>$/, "") : `<span class="t-bg">${TW.ICONS.Gabinetes}</span>${s.cpuMarca ? TW.logoHtml(s.cpuMarca, TW.LOGOS[s.cpuMarca]) : ""}`; })()}</div>
        <div class="modal-body">
          <div class="meta"><span>PC Armada · ${esc(pc.categoria)}</span></div>
          <h2 id="mTitle">${esc(pc.nombre)}</h2>
          ${pc.descripcion ? `<p style="margin:0;color:var(--text-2);font-size:.92rem">${esc(pc.descripcion)}</p>` : ""}
          <ul class="comp-list">${lines.map((l) => `
            <li><span class="mini">${TW.thumb(l.p)}</span><span><small>${esc(TW.stepForCategory(l.p.categoria)?.label || l.p.categoria)}</small>${l.qty > 1 ? `${l.qty}x ` : ""}${esc(l.p.titulo)}</span></li>`).join("")}
          </ul>
          <div class="modal-price">${TW.priceHtml(price)}<span class="stock consultar">Consultar</span></div>
          <div class="modal-actions">
            <button class="btn" type="button" data-addpc="${esc(pc.id)}">${U.cart} Agregar al carrito</button>
            <button class="btn ghost" type="button" data-custom="${esc(pc.id)}">${U.wrench} Personalizar</button>
            <a class="btn wa" href="${TW.waLink(msg)}" target="_blank" rel="noopener">${U.wa} Consultar por WhatsApp</a>
          </div>
          <p class="note">Incluye armado y prueba. Precios sujetos a confirmación de stock.</p>
        </div>
      </div>`;
    m.showModal();
  }

  /* =========================================================
     INICIO
     ========================================================= */
  function renderHome() {
    const pcs = data.pcs.filter((p) => p.destacado);
    const show = (pcs.length ? pcs : data.pcs).slice(0, 4);
    $("#homePcsSec").hidden = !show.length;
    $("#homePcs").innerHTML = show.map(pcCard).join("");
    const offers = data.products.filter((p) => p.oferta);
    $("#homeOffersSec").hidden = !offers.length;
    $("#homeOffers").innerHTML = offers.slice(0, 8).map(productCard).join("");
    const dest = data.products.filter((p) => p.destacado);
    $("#homeProducts").innerHTML = (dest.length ? dest : data.products).slice(0, 12).map(productCard).join("");
  }

  /* =========================================================
     ARMÁ TU PC
     ========================================================= */
  const BKEY = "tw_build_v1";
  let B = { sel: TW.emptyBuild(), step: 0, q: "", sort: "precio-asc" };
  try { const saved = JSON.parse(localStorage.getItem(BKEY)); if (saved && saved.sel) B = { ...B, ...saved, q: "" }; } catch {}
  const saveBuild = () => { try { localStorage.setItem(BKEY, JSON.stringify({ sel: B.sel, step: B.step, sort: B.sort })); } catch {} };
  const STEPS = TW.STEPS;
  const chosen = (key) => (B.sel[key] || []).filter((c) => data.byId[c.id]);

  function optionalReason(key) {
    const sel = B.sel, byId = data.byId;
    const cpu = chosen("cpu")[0] && byId[chosen("cpu")[0].id], gab = chosen("case")[0] && byId[chosen("case")[0].id];
    if (key === "gpu" && cpu && cpu.attrs.video) return "Usa el video integrado";
    if (key === "cooler" && cpu && cpu.attrs.cooler) return "Incluido con el procesador";
    if (key === "psu" && gab && gab.attrs.fuente >= TW.power(sel, byId).min) return `Incluida en el gabinete (${gab.attrs.fuente} W)`;
    return "Opcional";
  }

  // Armador estilo "paso a paso": panel con los componentes a la izquierda y las opciones a la derecha
  function renderBuilder() {
    const root = $("#builder");
    const n = STEPS.length;
    B.step = Math.max(0, Math.min(n, B.step));
    root.innerHTML = `
      <div class="bz">
        <aside class="bz-side" id="bSide">${panelHtml()}</aside>
        <div class="bz-main" id="bMain">${B.step < n ? stepView(STEPS[B.step]) : summaryView()}</div>
      </div>`;
    if (B.step < n) renderOptions();
  }

  // Panel izquierdo: grilla de componentes + consumo, total y botones
  function panelHtml() {
    const n = STEPS.length, lines = TW.buildLines(B.sel, data.byId), total = TW.linesTotal(lines);
    const pw = TW.power(B.sel, data.byId), step = STEPS[B.step];
    const canSkip = step && !TW.isRequired(step.key, B.sel, data.byId);
    const tiles = STEPS.map((s, i) => {
      const items = chosen(s.key), p = items[0] && data.byId[items[0].id];
      const stock = s.key === "cooler" && usingStock();
      const qty = items.reduce((t, c) => t + c.qty, 0);
      return `<button class="bz-tile${p || stock ? " done" : ""}" type="button" data-goto="${i}"${B.step === i ? ' aria-current="step"' : ""} title="${esc(p ? p.titulo : stock ? "Cooler incluido con el procesador" : s.label)}">
        <span class="ico">${p && (p.imagen || p.caja) ? TW.thumb(p) : TW.ICONS[s.cat]}</span>
        <span class="lbl">${esc(s.label)}</span>
        ${p || stock ? `<i class="ok">${U.check}</i>` : ""}${qty > 1 ? `<i class="n">x${qty}</i>` : ""}
      </button>`;
    }).join("");
    return `
      <div class="bz-card">
        <div class="bz-tiles">${tiles}</div>
        <button class="bz-sum${B.step === n ? " cur" : ""}" type="button" data-goto="${n}">${U.cart} Ver resumen</button>
        <button class="linkish redo" type="button" data-reset>${U.redo} Rehacer armado</button>
      </div>
      <div class="bz-card bz-tot">
        <div class="row"><span>${U.bolt} ~${lines.length ? pw.est : 0} W</span><span>Total: <strong>${TW.money(total)}</strong></span></div>
        <div class="btns">
          <button class="btn sm ghost" type="button" data-goto="${Math.max(0, B.step - 1)}"${B.step === 0 ? " disabled" : ""}>${U.back} Volver atrás</button>
          ${B.step < n ? `<button class="btn sm ghost" type="button" data-skip="${step.key}"${canSkip ? "" : ' disabled title="Este componente es necesario"'}>Saltear paso ${U.arrow}</button>` : ""}
        </div>
      </div>`;
  }
  function refreshPanel() { const s = $("#bSide"); if (s) s.innerHTML = panelHtml(); }

  const firstOf = (key) => chosen(key)[0] && data.byId[chosen(key)[0].id];
  // Cooler que viene en la caja del procesador (se puede elegir como opción en el paso del cooler)
  const stockCooler = () => { const cpu = firstOf("cpu"); return cpu && cpu.attrs.cooler ? cpu : null; };
  const usingStock = () => !!(B.sel.coolerStock && stockCooler() && !chosen("cooler").length);

  // Chequeos de compatibilidad, uno por uno: ok · wait (falta elegir) · bad
  function compatChecks() {
    const cpu = firstOf("cpu"), mobo = firstOf("mobo"), ram = firstOf("ram"), gab = firstOf("case"), psu = firstOf("psu"), cool = firstOf("cooler"), gpu = firstOf("gpu");
    const pw = TW.power(B.sel, data.byId);
    const errs = TW.checkBuild(B.sel, data.byId).filter((x) => x.level === "error");
    const err = (k) => errs.find((x) => x.key === k);
    const c = (label, key, ok, okTxt, waitTxt) => { const e = err(key); return { label, state: e ? "bad" : ok ? "ok" : "wait", txt: e ? e.msg.replace(/^[^:]+: /, "") : ok ? okTxt : waitTxt }; };
    const psuW = psu ? psu.attrs.watts : !TW.isRequired("psu", B.sel, data.byId) && gab ? gab.attrs.fuente : 0;
    return [
      c("Socket", "mobo", cpu && mobo, `${cpu?.attrs.socket || ""} en procesador y mother`, cpu ? `Tu procesador es ${cpu.attrs.socket}` : "Según el procesador"),
      c("Memoria", "ram", mobo && ram, `${ram?.attrs.ddr || mobo?.attrs.ddr || ""} compatible con la mother`.trim(), mobo ? `Tu mother usa ${mobo.attrs.ddr}` : "Según la mother"),
      c("Gabinete", "case", mobo && gab, `Entra la mother${mobo?.attrs.formato ? ` ${mobo.attrs.formato}` : ""}`, "Según el tamaño de la mother"),
      c("Energía", "psu", psuW, `${psuW} W para ~${pw.est} W de consumo`, `Recomendada: ${pw.rec} W o más`),
      c("Refrigeración", "cooler", cool || (cpu && cpu.attrs.cooler), cool ? "Cooler compatible con el procesador" : "Cooler incluido con el procesador", "Según el procesador"),
      c("Video", "gpu", gpu || (cpu && cpu.attrs.video), gpu ? "Placa de video dedicada" : "Video integrado del procesador", cpu ? "Tu procesador necesita placa de video" : "Según el procesador"),
    ];
  }

  function stepView(step) {
    const i = STEPS.indexOf(step), req = TW.isRequired(step.key, B.sel, data.byId);
    const pw = TW.power(B.sel, data.byId);
    let note = "";
    if (!req && step.key === "gpu") note = "Tu procesador tiene video integrado: podés saltear este paso.";
    if (!req && step.key === "cooler") note = "Tu procesador ya trae cooler: podés saltear este paso.";
    if (!req && step.key === "psu") note = `${optionalReason("psu")}: podés saltear este paso.`;
    if (req && step.key === "psu") note = `Tu PC consume ~${pw.est} W. Te recomendamos una fuente de ${pw.rec} W o más.`;
    const mobo = firstOf("mobo");
    if (step.key === "ram" && mobo) note = `Tu mother usa memorias ${mobo.attrs.ddr}: te mostramos solo esas.`;
    const plat = B.brand || "";
    return `
      <div class="bz-head">
        <h2>${i > 0 ? `<button class="bz-back" type="button" data-goto="${i - 1}" aria-label="Paso anterior">${U.back}</button>` : ""}Elegí tu ${esc(step.label.charAt(0).toLowerCase() + step.label.slice(1))}${req ? "" : " <small>(opcional)</small>"}</h2>
        <p>${esc(step.tip)}</p>
      </div>
      <div class="bz-tools">
        ${step.key === "cpu" ? `<div class="bz-brands" role="group" aria-label="Marca">
          ${["AMD", "Intel"].map((b) => `<button type="button" data-brand="${b}" aria-pressed="${plat === b}">${TW.logoHtml(b, TW.LOGOS[b])}</button>`).join("")}
        </div>` : ""}
        <label class="hsearch">${U.search}<input id="bq" type="search" placeholder="Buscar…" value="${esc(B.q)}" autocomplete="off"></label>
        <div class="select"><select id="bsort" aria-label="Ordenar">
          <option value="precio-asc"${B.sort === "precio-asc" ? " selected" : ""}>Menor precio</option>
          <option value="precio-desc"${B.sort === "precio-desc" ? " selected" : ""}>Mayor precio</option>
          <option value="az"${B.sort === "az" ? " selected" : ""}>Nombre</option>
        </select></div>
        <span class="bz-count" id="optCount"></span>
      </div>
      ${note ? `<div class="b-note">${U.bolt}<span>${esc(note)}</span></div>` : ""}
      ${step.maxQty ? `<div id="qtyBar"></div>` : ""}
      <div class="bz-grid" id="optGrid"></div>`;
  }

  function renderOptions() {
    const step = STEPS[B.step], grid = $("#optGrid");
    if (!grid) return;
    const words = norm(B.q).split(/\s+/).filter(Boolean);
    let opts = TW.options(step.key, B.sel, data)
      .filter((p) => step.key !== "cpu" || !B.brand || p.attrs.plataforma === B.brand)
      .filter((p) => words.every((w) => norm(p.titulo + " " + p.marca + " " + p.specs.join(" ")).includes(w)));
    const sorters = { "precio-asc": (a, b) => (a.precio || 1e12) - (b.precio || 1e12), "precio-desc": (a, b) => (b.precio || 0) - (a.precio || 0), az: (a, b) => a.titulo.localeCompare(b.titulo) };
    opts.sort(sorters[B.sort] || sorters["precio-asc"]);
    const count = $("#optCount");
    if (count) count.textContent = `${opts.length} ${opts.length === 1 ? "opción compatible" : "opciones compatibles"}`;
    const picked = new Set(chosen(step.key).map((c) => c.id));
    const rec = TW.power(B.sel, data.byId).rec;
    const isRec = (p) => step.key === "psu" && p.attrs.watts >= rec && /80 PLUS/i.test(p.nombre);
    const cpuBox = step.key === "cooler" && stockCooler();
    const stockCard = cpuBox ? `
      <button class="bz-opt stock${usingStock() ? " sel" : ""}" type="button" data-stockcooler>
        <span class="bz-rec">${U.check} Sin costo</span>
        <span class="bz-img">${TW.thumb(cpuBox)}</span>
        <span class="bz-info">
          <span class="bz-name">Cooler incluido con el procesador</span>
          <span class="bz-spec">Viene en la caja del ${esc(cpuBox.titulo)}</span>
          <span class="bz-foot"><span class="bz-price">$ 0</span><span class="bz-ok">${U.check} ${usingStock() ? "Elegido" : "Incluido"}</span></span>
        </span>
      </button>` : "";
    grid.innerHTML = stockCard + (opts.length ? opts.map((p) => `
      <button class="bz-opt${picked.has(p.id) ? " sel" : ""}" type="button" data-pick="${esc(p.id)}">
        ${p.oferta ? `<span class="bz-off">Oferta${p.descuento ? ` -${p.descuento}%` : ""}</span>` : isRec(p) ? `<span class="bz-rec">${U.bolt} Recomendada</span>` : ""}
        <span class="bz-img">${TW.thumb(p)}</span>
        <span class="bz-info">
          <span class="bz-name">${esc(p.titulo)}</span>
          <span class="bz-spec">${esc(p.specs.slice(0, 2).join(" · "))}</span>
          <span class="bz-foot">
            <span class="bz-price">${p.oferta && p.precioLista ? `<s>${TW.money(p.precioLista)}</s>` : ""}${p.precio ? TW.money(p.precio) : "Consultar"}</span>
            <span class="bz-ok">${picked.has(p.id) ? `${U.check} Elegido` : `${U.check} Compatible`}</span>
          </span>
        </span>
      </button>`).join("")
      : `<div class="b-empty">${B.q ? "No hay resultados para tu búsqueda." : "No hay opciones compatibles con lo que elegiste antes."} <br>Consultanos por WhatsApp y te ayudamos.</div>`);
    renderQtyBar();
  }

  // Pasos con cantidad (memorias): después de elegir, se indica cuántas antes de seguir
  function renderQtyBar() {
    const step = STEPS[B.step], bar = $("#qtyBar");
    if (!bar || !step || !step.maxQty) return;
    const c = chosen(step.key)[0], p = c && data.byId[c.id];
    if (!p) { bar.innerHTML = `<div class="qty-bar empty">${U.warn}<span>Elegí una memoria y después indicás cuántas llevás.</span></div>`; return; }
    const i = STEPS.indexOf(step);
    bar.innerHTML = `
      <div class="qty-bar">
        <span class="mini">${TW.thumb(p)}</span>
        <div class="q-txt"><small>Elegiste</small><strong>${esc(p.titulo)}</strong></div>
        <div class="q-pick" role="group" aria-label="Cantidad">
          <span>¿Cuántas?${firstOf("mobo") && firstOf("mobo").attrs.slots ? `<small>Tu mother tiene ${firstOf("mobo").attrs.slots} slots</small>` : ""}</span>
          ${Array.from({ length: TW.maxQty(step.key, B.sel, data.byId) }, (_, k) => k + 1).map((n) => `<button type="button" data-qset="${step.key}|${esc(p.id)}|${n}" aria-pressed="${c.qty === n}">${n}${n === 2 || n === 4 ? "<small>Dual channel</small>" : ""}</button>`).join("")}
        </div>
        <button class="btn" type="button" data-goto="${i + 1}">Siguiente paso ${U.arrow}</button>
      </div>`;
  }

  // Último paso: resumen, compatibilidad y acciones
  function summaryView() {
    const lines = TW.buildLines(B.sel, data.byId), total = TW.linesTotal(lines);
    const issues = TW.checkBuild(B.sel, data.byId), faltan = issues.filter((x) => x.level === "falta");
    const okAll = !faltan.length && !issues.some((x) => x.level === "error");
    const checks = compatChecks(), pw = TW.power(B.sel, data.byId);
    return `
      <div class="bz-head">
        <h2><button class="bz-back" type="button" data-goto="${STEPS.length - 1}" aria-label="Paso anterior">${U.back}</button>${okAll ? "¡Tu PC está lista!" : "Resumen de tu PC"}</h2>
        <p>${okAll ? "Todos los componentes son compatibles. Agregala al carrito o consultanos por WhatsApp." : `Te falta elegir: ${faltan.map((x) => `<button class="linkish" type="button" data-goto="${STEPS.findIndex((s) => s.key === x.key)}">${esc(TW.stepOf(x.key).label.toLowerCase())}</button>`).join(", ")}.`}</p>
      </div>
      <div class="sum-grid">
        <div>
          ${lines.length ? `<ul class="comp-list">${lines.map((l) => `
            <li><span class="mini">${TW.thumb(l.p)}</span><span><small>${esc(l.step.label)}</small>${l.qty > 1 ? `${l.qty}x ` : ""}${esc(l.p.titulo)}</span><span class="p">${l.p.precio ? TW.money(l.p.precio * l.qty) : "Consultar"}</span></li>`).join("")}
            ${usingStock() ? `<li><span class="mini">${TW.ICONS.Coolers}</span><span><small>Cooler</small>Incluido con el procesador</span><span class="p">$ 0</span></li>` : ""}
          </ul>` : `<div class="b-empty">Todavía no elegiste componentes.</div>`}
          <div class="modal-price" style="margin-top:1.25rem"><span style="color:var(--muted)">Total · ~${pw.est} W</span><span class="price" style="font-size:1.6rem">${TW.money(total)}</span></div>
          <div class="bz-actions">
            <button class="btn" type="button" data-addbuild${okAll ? "" : " disabled"}>${U.cart} Agregar al carrito</button>
            <button class="btn wa" type="button" data-wabuild${okAll ? "" : " disabled"}>${U.wa} Consultar esta PC</button>
          </div>
          ${okAll ? "" : `<p class="fine lock">Completá todos los componentes para agregarla al carrito o consultarla.</p>`}
        </div>
        <ul class="check-grid">${checks.map((x) => `<li class="${x.state}"><span class="dot">${x.state === "ok" ? U.check : x.state === "bad" ? U.close : ""}</span><span><strong>${esc(x.label)}</strong>${esc(x.txt)}</span></li>`).join("")}</ul>
      </div>`;
  }

  function pick(id) {
    const step = STEPS[B.step], p = data.byId[id];
    if (!step || !p) return;
    const list = B.sel[step.key];
    if (step.multi) {
      const at = list.findIndex((c) => c.id === id);
      if (at >= 0) list.splice(at, 1);
      else if (list.length >= step.multi) { toast(`Podés elegir hasta ${step.multi} ${step.label.toLowerCase()}. Quitá uno para sumar otro.`); return; }
      else list.push({ id, qty: 1 });
    } else {
      const prevQty = list[0] && list[0].id === id ? list[0].qty : 1;
      B.sel[step.key] = [{ id, qty: prevQty }];
    }
    if (step.key === "cpu") { B.sel.plataforma = p.attrs.plataforma || ""; if (!p.attrs.cooler) B.sel.coolerStock = false; }
    if (step.key === "cooler") B.sel.coolerStock = false;
    const removed = TW.pruneBuild(B.sel, data.byId);
    if (removed.length) toast(`Quitamos ${removed.join(", ")} porque ya no era compatible.`);
    // Avanza solo en pasos de una única elección; en memorias primero se elige la cantidad
    const advance = !step.multi && !step.maxQty;
    if (advance) { B.step++; B.q = ""; }
    saveBuild(); renderBuilder();
    if (advance) scrollTo({ top: $("#builder").offsetTop - 130, behavior: "smooth" });
    else if (step.maxQty) $("#qtyBar")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function buildMessage() {
    const lines = TW.buildLines(B.sel, data.byId), total = TW.linesTotal(lines);
    return `Hola ${NEG.nombre}! Armé esta PC en la web y quería consultarles:\n\n` +
      lines.map((l) => `• ${l.step.label}: ${l.qty > 1 ? l.qty + "x " : ""}${l.p.titulo} — ${l.p.precio ? TW.money(l.p.precio * l.qty) : "consultar"}`).join("\n") +
      (usingStock() ? "\n• Cooler: incluido con el procesador" : "") +
      `\n\nTotal estimado: ${TW.money(total)}\n¿Tienen stock de todo?`;
  }

  /* =========================================================
     TU PEDIDO (se envía por WhatsApp, sin pago online)
     ========================================================= */
  const NKEY = "tw_pedido_nota";
  let orderNote = "";
  try { orderNote = localStorage.getItem(NKEY) || ""; } catch {}

  function renderCartCount() {
    const n = TW.cart.count(), el = $("#cartCount");
    el.textContent = n; el.hidden = !n;
  }
  function orderLines() { return TW.cart.items.map((i) => TW.cartLine(i, data)).filter(Boolean); }

  function renderOrder() {
    const root = $("#order"); if (!root) return;
    const lines = orderLines();
    const total = lines.reduce((t, l) => t + l.unit * l.item.qty, 0);
    const ahorro = lines.reduce((t, l) => t + (l.lista ? (l.lista - l.unit) * l.item.qty : 0), 0);
    const count = lines.reduce((t, l) => t + l.item.qty, 0);
    const thumbOf = (l) => l.thumb || `<span class="t-bg" style="opacity:.9">${TW.ICONS.Gabinetes}</span>`;
    root.innerHTML = `
      <div class="o-layout">
        <div class="o-main">
          <div class="o-card">
            <div class="o-head"><div><h2>Tu carrito</h2><p>Revisá los productos y mandanos el pedido por WhatsApp.</p></div>${lines.length ? `<button class="linkish" type="button" data-clear>Vaciar carrito</button>` : ""}</div>
            ${lines.length ? `<ul class="o-items">${lines.map((l) => `
              <li>
                <span class="mini">${thumbOf(l)}</span>
                <div class="o-it">
                  <strong>${esc(l.titulo)}</strong>
                  ${l.lista ? `<span class="o-off">Oferta · antes ${TW.money(l.lista)}</span>` : l.unit ? `<small>${TW.money(l.unit)} c/u</small>` : ""}
                  ${l.detalle.length ? `<details><summary>${l.detalle.length} componentes</summary><ul>${l.detalle.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
                </div>
                <span class="qty"><button type="button" data-cq="${l.item.key}|-1" aria-label="Menos"${l.item.qty <= 1 ? " disabled" : ""}>${U.minus}</button><span>${l.item.qty}</span><button type="button" data-cq="${l.item.key}|1" aria-label="Más">${U.plus}</button></span>
                <span class="o-pr">${l.unit ? TW.money(l.unit * l.item.qty) : "Consultar"}</span>
                <button class="icon-btn" type="button" data-crm="${l.item.key}" aria-label="Quitar ${esc(l.titulo)}">${U.trash}</button>
              </li>`).join("")}</ul>`
            : `<div class="cart-empty">${U.cart}<strong>Tu carrito está vacío</strong>Sumá productos del catálogo, una PC armada o la PC que armes a tu medida.<br><a class="btn" href="#/armar">Armá tu PC</a></div>`}
            <a class="btn ghost" href="#/catalogo">${U.back} Seguir comprando</a>
          </div>
        </div>
        <aside class="o-card o-sum">
          <h3>Detalle de tu pedido</h3>
          <span class="o-count">Productos (${count})</span>
          <ul class="o-mini">${lines.map((l) => `<li><span class="mini">${thumbOf(l)}</span><span>${esc(l.titulo)}<small>x${l.item.qty}</small></span><b>${l.unit ? TW.money(l.unit * l.item.qty) : "Consultar"}</b></li>`).join("") || `<li class="none">Sin productos</li>`}</ul>
          ${ahorro ? `<div class="o-row"><span>Precio de lista</span><span>${TW.money(total + ahorro)}</span></div><div class="o-row save"><span>Ahorro en ofertas</span><span>-${TW.money(ahorro)}</span></div>` : ""}
          <div class="o-row"><span>Envío</span><span>A coordinar</span></div>
          <div class="o-total"><span>Total estimado</span><strong>${TW.money(total)}</strong></div>
          ${lines.length ? `<label class="o-fld">Nota <small>(opcional)</small><textarea id="oNota" placeholder="Tu nombre, localidad para el envío, dudas…">${esc(orderNote)}</textarea></label>` : ""}
          <button class="btn wa block o-send" type="button" data-send${lines.length ? "" : " disabled"}>${U.wa} Enviar pedido por WhatsApp</button>
          <p class="fine">${U.shield} No se cobra nada online. Te respondemos por WhatsApp para confirmar stock, envío y forma de pago.</p>
        </aside>
      </div>`;
  }

  /* =========================================================
     EVENTOS
     ========================================================= */
  function bindEvents() {
    addEventListener("hashchange", route);
    document.addEventListener("tw:cart", () => {
      renderCartCount();
      const b = $("#cartBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
      if (parseHash().view === "pedido") renderOrder();
    });
    $("#cartBtn").addEventListener("click", () => { location.hash = "#/pedido"; });

    // Buscador del header → catálogo
    const q = $("#q");
    q.addEventListener("input", () => {
      cat.q = q.value;
      if (parseHash().view !== "catalogo") location.hash = "#/catalogo";
      else renderGrid();
    });
    $("#hsearch").addEventListener("submit", (e) => { e.preventDefault(); if (parseHash().view !== "catalogo") location.hash = "#/catalogo"; });

    $("#brand").addEventListener("change", (e) => { cat.brand = e.target.value; renderGrid(); });
    $("#sort").addEventListener("change", (e) => { cat.sort = e.target.value; renderGrid(); });
    $("#subcats").addEventListener("click", (e) => {
      const b = e.target.closest(".sub"); if (!b) return;
      cat.sub = b.dataset.sub; renderSubs(); renderBrands(); renderGrid();
    });
    $("#cats").addEventListener("scroll", updateCatsFade, { passive: true });
    addEventListener("resize", updateCatsFade);

    // Clicks generales (tarjetas, botones de agregar, armador, carrito)
    document.addEventListener("click", (e) => {
      const t = e.target;
      const el = (sel) => t.closest(sel);
      let x;
      if ((x = el("[data-opencart]"))) { location.hash = "#/pedido"; $("#toast").classList.remove("show"); if ($("#modal").open) $("#modal").close(); return; }
      if ((x = el("[data-product]"))) { openProduct(x.dataset.product); return; }
      if ((x = el("[data-add]"))) { TW.cart.add({ type: "producto", id: x.dataset.add }); toast("Producto agregado al carrito", true); $("#modal").close(); return; }
      if ((x = el("[data-addpc]"))) { TW.cart.add({ type: "pc", id: x.dataset.addpc }); toast("PC agregada al carrito", true); if ($("#modal").open) $("#modal").close(); return; }
      if ((x = el("[data-pc]"))) { openPc(x.dataset.pc); return; }
      if ((x = el("[data-custom]"))) {
        const pc = data.pcs.find((p) => p.id === x.dataset.custom);
        if (pc) { B.sel = TW.buildFromComponents(pc.componentes, data.byId); B.step = STEPS.length; saveBuild(); }
        $("#modal").close(); location.hash = "#/armar"; renderBuilder(); toast("Cargamos la PC en el armador: cambiá lo que quieras");
        return;
      }
      if ((x = el("#reset"))) { Object.assign(cat, { q: "", sub: "", brand: "" }); $("#q").value = ""; location.hash = "#/catalogo"; renderCatalog(); return; }

      // Armador
      if ((x = el("[data-brand]"))) { B.brand = B.brand === x.dataset.brand ? "" : x.dataset.brand; $$("[data-brand]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.brand === B.brand)); renderOptions(); return; }
      if ((x = el("[data-goto]"))) { B.step = Number(x.dataset.goto); B.q = ""; saveBuild(); renderBuilder(); scrollTo({ top: $("#builder").offsetTop - 130, behavior: "smooth" }); return; }
      if ((x = el("[data-pick]"))) { pick(x.dataset.pick); return; }
      if ((x = el("[data-stockcooler]"))) {
        B.sel.cooler = []; B.sel.coolerStock = true; B.step++; B.q = "";
        saveBuild(); renderBuilder(); scrollTo({ top: $("#builder").offsetTop - 130, behavior: "smooth" }); return;
      }
      if ((x = el("[data-skip]"))) { B.sel[x.dataset.skip] = []; B.step++; B.q = ""; saveBuild(); renderBuilder(); return; }
      if ((x = el("[data-qset]"))) {
        const [key, id, n] = x.dataset.qset.split("|");
        const c = B.sel[key].find((c) => c.id === id);
        if (c) c.qty = Number(n);
        saveBuild(); renderQtyBar(); refreshPanel(); return;
      }
      if ((x = el("[data-reset]"))) {
        if (confirm("¿Rehacer el armado? Se borran todos los componentes elegidos.")) { B.sel = TW.emptyBuild(); B.step = 0; B.brand = ""; saveBuild(); renderBuilder(); }
        return;
      }
      if ((x = el("[data-addbuild]"))) {
        const lines = TW.buildLines(B.sel, data.byId);
        TW.cart.add({ type: "armado", nombre: `PC armada a medida (${B.sel.plataforma})`, comps: lines.map((l) => ({ id: l.p.id, qty: l.qty })), ...(usingStock() ? { coolerStock: true } : {}) });
        toast("Tu PC se agregó al carrito", true); return;
      }
      if ((x = el("[data-wabuild]"))) { window.open(TW.waLink(buildMessage()), "_blank", "noopener"); return; }

      // Carrito
      if ((x = el("[data-cq]"))) { const [k, d] = x.dataset.cq.split("|"); const it = TW.cart.items.find((i) => i.key === k); if (it) TW.cart.setQty(k, it.qty + Number(d)); return; }
      if ((x = el("[data-crm]"))) { TW.cart.remove(x.dataset.crm); return; }
      if ((x = el("[data-clear]"))) { if (confirm("¿Vaciar el carrito?")) TW.cart.clear(); return; }
      if ((x = el("[data-send]"))) { window.open(TW.waLink(TW.cartMessage(data, orderNote.trim() ? `Nota: ${orderNote.trim()}` : "")), "_blank", "noopener"); return; }

      // Cerrar diálogos
      if ((x = el("[data-close]"))) { x.closest("dialog")?.close(); return; }
      if (t.tagName === "DIALOG") t.close(); // click en el fondo
    });

    // Buscador y orden del armador (sin redibujar todo) · nota del pedido
    document.addEventListener("input", (e) => {
      if (e.target.id === "bq") { B.q = e.target.value; renderOptions(); }
      if (e.target.id === "oNota") { orderNote = e.target.value; try { localStorage.setItem(NKEY, orderNote); } catch {} }
    });
    document.addEventListener("change", (e) => { if (e.target.id === "bsort") { B.sort = e.target.value; saveBuild(); renderOptions(); } });
  }

  /* ---------- Inicio ---------- */
  async function init() {
    setupStatic();
    bindEvents();
    TW.cart.load(); renderCartCount();
    try {
      data = await TW.loadData();
    } catch (err) {
      console.error(err);
      $("main").insertAdjacentHTML("afterbegin", `<div class="wrap"><div class="empty" style="margin:2rem 0"><strong>No pudimos cargar los productos</strong>Probá recargar la página o escribinos por WhatsApp.</div></div>`);
    }
    TW.pruneBuild(B.sel, data.byId);
    if (data.products.some((p) => p.oferta))
      $('#mainnav a[href="#/catalogo"]').insertAdjacentHTML("afterend", `<a class="offer-link" href="#/catalogo/Ofertas" data-route="catalogo" data-cat="Ofertas">Ofertas</a>`);
    route();
  }
  init();
})();
