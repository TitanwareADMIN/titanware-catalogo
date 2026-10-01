/* =========================================================
   Titanware · panel de administración
   Edita data/catalogo.json y data/pcs.json y los publica en el
   repositorio de GitHub con un token del dueño (queda solo en su navegador).
   ========================================================= */
(function () {
  const CFG = window.TW_CONFIG, U = TW.UI, esc = TW.esc, norm = TW.norm;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FILES = { catalogo: "data/catalogo.json", pcs: "data/pcs.json" };
  const AUTH_KEY = "tw_admin_github";

  const S = {
    cat: [], pcs: [],
    sha: { catalogo: null, pcs: null },
    dirty: { catalogo: false, pcs: false },
    changedIds: new Set(),
    conn: { owner: CFG.github.owner, repo: CFG.github.repo, branch: CFG.github.branch || "main", token: "" },
    online: false, loaded: false,
    tab: "productos",
    f: { q: "", cat: "" },
    imp: null,
    // Cuentas (Firebase): pedidos, clientes y administradores
    fb: { orders: null, users: null, admins: null, err: "", at: 0, f: { q: "", estado: "" }, uq: "" },
  };
  const A = TW.auth;
  const fbOn = () => !!(A && A.enabled && A.isAdmin);
  try { Object.assign(S.conn, JSON.parse(localStorage.getItem(AUTH_KEY)) || {}); } catch {}

  /* ---------- Utilidades ---------- */
  let toastTimer;
  function toast(msg, ok = true) {
    const t = $("#toast");
    t.innerHTML = `${ok ? U.check : U.warn}<span>${esc(msg)}</span>`;
    t.querySelector("svg").style.color = ok ? "var(--ok)" : "var(--warn)";
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 4200);
  }
  const toB64 = (str) => {
    const bytes = new TextEncoder().encode(str); let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const fromB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const built = () => TW.indexData(S.cat, S.pcs);
  const markDirty = (file) => { S.dirty[file] = true; updatePublish(); };
  const uniqueId = (base, taken) => { let id = base || "item", n = 2; while (taken.has(id)) id = `${base}-${n++}`; return id; };
  const cleanName = (s) => norm(s).replace(/\s+/g, " ").trim();

  /* ---------- GitHub ---------- */
  async function gh(path, opts = {}) {
    const { owner, repo, token } = S.conn;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(body.message || res.statusText); e.status = res.status; throw e; }
    return body;
  }
  const getFile = async (path) => {
    const f = await gh(`/contents/${path}?ref=${encodeURIComponent(S.conn.branch)}&t=${Date.now()}`);
    return { text: fromB64(f.content), sha: f.sha };
  };
  const putFile = (path, b64, sha, message) =>
    gh(`/contents/${path}`, { method: "PUT", body: JSON.stringify({ message, content: b64, branch: S.conn.branch, ...(sha ? { sha } : {}) }) });

  async function connect(conn) {
    S.conn = { ...S.conn, ...conn };
    const repo = await gh("");
    if (!repo.permissions || !repo.permissions.push) throw new Error("El token no tiene permiso para escribir en el repositorio.");
    localStorage.setItem(AUTH_KEY, JSON.stringify(S.conn));
    S.online = true;
    await loadData();
  }
  function disconnect() {
    localStorage.removeItem(AUTH_KEY);
    S.conn.token = ""; S.online = false;
    if (fbOn()) A.admin.delSetting("github").catch(() => {});
    render();
  }

  async function loadData() {
    if (S.online) {
      const [c, p] = await Promise.all([getFile(FILES.catalogo), getFile(FILES.pcs).catch(() => ({ text: "[]", sha: null }))]);
      S.cat = JSON.parse(c.text); S.pcs = JSON.parse(p.text);
      S.sha = { catalogo: c.sha, pcs: p.sha };
    } else {
      const v = Date.now();
      S.cat = await fetch(`${FILES.catalogo}?v=${v}`).then((r) => r.json());
      S.pcs = await fetch(`${FILES.pcs}?v=${v}`).then((r) => r.json()).catch(() => []);
    }
    S.dirty = { catalogo: false, pcs: false }; S.changedIds.clear();
    S.loaded = true;
    render(); updatePublish();
  }

  async function publish() {
    if (!S.online) { toast("Conectá el panel a GitHub para publicar (pestaña Ajustes).", false); return; }
    const btn = $("#publishBtn"); btn.disabled = true; btn.textContent = "Publicando…";
    const stamp = new Date().toLocaleString("es-AR");
    try {
      for (const key of ["catalogo", "pcs"]) {
        if (!S.dirty[key]) continue;
        const json = JSON.stringify(key === "catalogo" ? S.cat : S.pcs, null, 2) + "\n";
        const r = await putFile(FILES[key], toB64(json), S.sha[key], `Panel: actualización de ${key === "catalogo" ? "productos" : "PCs armadas"} (${stamp})`);
        S.sha[key] = r.content.sha; S.dirty[key] = false;
      }
      S.changedIds.clear();
      toast("¡Publicado! La tienda se actualiza en 1 o 2 minutos.");
      render();
    } catch (e) {
      if (e.status === 409 || e.status === 422) toast("Los datos cambiaron en GitHub desde que abriste el panel. Descargá tus cambios (Ajustes) y recargá.", false);
      else toast(`No se pudo publicar: ${e.message}`, false);
    }
    updatePublish();
  }

  // Sube una foto (achicada a 900 px) a img/productos y devuelve la ruta
  async function uploadImage(file, baseName) {
    if (!S.online) throw new Error("Conectá el panel a GitHub para subir fotos, o pegá el link de una imagen.");
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = URL.createObjectURL(file); });
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/webp", 0.86));
    const b64 = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
    const path = `img/productos/${TW.slug(baseName).slice(0, 50)}-${Date.now().toString(36)}.webp`;
    await putFile(path, b64, null, `Panel: foto ${baseName}`);
    return path;
  }

  function updatePublish() {
    const n = (S.dirty.catalogo ? 1 : 0) + (S.dirty.pcs ? 1 : 0);
    const btn = $("#publishBtn");
    btn.disabled = !n || !S.online;
    btn.textContent = n ? "Publicar cambios" : "Sin cambios";
    $("#publishBar").hidden = !n;
    $("#publishMsg").textContent = S.online ? "Tenés cambios sin publicar" : "Tenés cambios sin publicar. Conectá GitHub o descargá los archivos.";
    $("#publishBar [data-publish]").textContent = S.online ? "Publicar ahora" : "Descargar archivos";
    const pill = $("#connPill");
    pill.className = "pill " + (S.online ? "on" : "off");
    pill.querySelector("span").textContent = S.online ? `Conectado · ${S.conn.owner}/${S.conn.repo}` : "Sin conexión a GitHub";
  }
  addEventListener("beforeunload", (e) => { if (S.dirty.catalogo || S.dirty.pcs) { e.preventDefault(); e.returnValue = ""; } });

  function download(key) {
    const json = JSON.stringify(key === "catalogo" ? S.cat : S.pcs, null, 2) + "\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = FILES[key].split("/").pop();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* =========================================================
     RENDER
     ========================================================= */
  function render() {
    const app = $("#app");
    if (!S.loaded) { app.innerHTML = connectView(); return; }
    const tabs = [["productos", "Productos", S.cat.length], ["pcs", "PCs armadas", S.pcs.length],
      ...(fbOn() ? [["pedidos", "Pedidos", S.fb.orders ? S.fb.orders.filter((o) => o.estado === "nuevo").length || "" : ""], ["clientes", "Clientes", S.fb.users ? S.fb.users.length : ""]] : []),
      ["importar", "Actualizar precios", ""], ["ajustes", "Ajustes", ""]];
    app.innerHTML = `
      <div class="adm-tabs" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}${n !== "" ? `<b>${n}</b>` : ""}</button>`).join("")}</div>
      <div id="tabBody"></div>`;
    renderTab();
  }
  function renderTab() {
    const body = $("#tabBody");
    if (!body) return;
    if (S.tab === "productos") body.innerHTML = productsView();
    if (S.tab === "pcs") body.innerHTML = pcsView();
    if (S.tab === "importar") body.innerHTML = importView();
    if (S.tab === "ajustes") body.innerHTML = settingsView();
    if (S.tab === "pedidos") body.innerHTML = ordersView();
    if (S.tab === "clientes") body.innerHTML = usersView();
    if (S.tab === "productos") renderProductRows();
    if (S.tab === "pedidos") renderOrderRows();
    if (S.tab === "clientes") renderUserRows();
  }

  /* ---------- Conexión ---------- */
  function connectView() {
    return `
      <div class="panel-card connect">
        <h2>Conectá el panel con GitHub</h2>
        <p>La tienda guarda sus productos en el repositorio de GitHub. Para que este panel pueda publicar cambios, necesita un <strong>token</strong>: una llave que se crea una sola vez y queda guardada solo en este navegador.</p>
        <details>
          <summary style="cursor:pointer;color:var(--violet-soft);font-weight:600;font-size:.9rem;margin-bottom:.5rem">Cómo crear el token (2 minutos)</summary>
          <ol>
            <li>Entrá a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a> con la cuenta dueña del repositorio.</li>
            <li>Nombre: <code>Panel Titanware</code>. Vencimiento: el que prefieras (por ejemplo 1 año).</li>
            <li>En <strong>Repository access</strong> elegí <em>Only select repositories</em> y marcá <code>${esc(S.conn.repo)}</code>.</li>
            <li>En <strong>Permissions → Repository permissions</strong>, poné <strong>Contents</strong> en <em>Read and write</em>.</li>
            <li>Tocá <strong>Generate token</strong>, copialo y pegalo acá abajo.</li>
          </ol>
        </details>
        <form id="connForm" class="form-grid">
          <label class="fld">Usuario u organización<input name="owner" value="${esc(S.conn.owner)}" required></label>
          <label class="fld">Repositorio<input name="repo" value="${esc(S.conn.repo)}" required></label>
          <label class="fld">Rama<input name="branch" value="${esc(S.conn.branch)}" required></label>
          <label class="fld">Token<input name="token" type="password" value="${esc(S.conn.token)}" placeholder="github_pat_…" autocomplete="off" required></label>
          <div class="full row-actions" style="margin:0">
            <button class="btn" type="submit">Conectar y cargar productos</button>
            <button class="btn ghost" type="button" data-offline>Entrar sin conexión</button>
            <span class="hint">${fbOn() ? "Se hace una sola vez: queda guardado en la cuenta para todos los administradores. Sin conexión igual podés ver pedidos y clientes." : "Sin conexión podés editar todo y descargar los archivos para subirlos a mano."}</span>
          </div>
        </form>
      </div>`;
  }

  function settingsView() {
    return `
      ${fbOn() ? adminsCard() : ""}
      <div class="panel-card" style="max-width:820px${fbOn() ? ";margin-top:1rem" : ""}">
        <h2>Conexión con GitHub</h2>
        ${S.online ? `<p>Conectado a <strong>${esc(S.conn.owner)}/${esc(S.conn.repo)}</strong> (rama ${esc(S.conn.branch)}). Los cambios se publican directo en la tienda.${fbOn() ? " La conexión queda guardada en la cuenta: los demás administradores no tienen que volver a cargar el token." : ""}</p>
          <div class="row-actions"><button class="btn ghost" type="button" data-reload>Recargar desde GitHub</button><button class="btn ghost" type="button" data-disconnect>${fbOn() ? "Desconectar GitHub" : "Desconectar este navegador"}</button></div>`
        : `<p>Estás trabajando sin conexión: podés editar y descargar los archivos, pero no publicar.</p><div class="row-actions"><button class="btn" type="button" data-goconnect>Conectar con GitHub</button></div>`}
      </div>
      <div class="panel-card" style="max-width:820px;margin-top:1rem">
        <h2>Datos de la tienda</h2>
        <p>El WhatsApp, Instagram, la ubicación y las categorías se configuran en el archivo <code>assets/js/config.js</code>.</p>
        <p class="hint" style="margin:0">WhatsApp actual: ${esc(CFG.negocio.whatsappVisible)} · Instagram: @${esc(CFG.negocio.instagram)}</p>
      </div>`;
  }

  /* =========================================================
     PRODUCTOS
     ========================================================= */
  function productsView() {
    const cats = [...new Set([...CFG.categorias, ...S.cat.map((p) => p.categoria)])];
    return `
      <div class="bar">
        <label class="hsearch">${U.search}<input id="fq" type="search" placeholder="Buscar producto…" value="${esc(S.f.q)}" autocomplete="off"></label>
        <div class="select"><select id="fcat"><option value="">Todas las categorías</option><option value="__oferta"${S.f.cat === "__oferta" ? " selected" : ""}>★ En oferta</option><option value="__sinfoto"${S.f.cat === "__sinfoto" ? " selected" : ""}>Sin foto (no se ven en la tienda)</option>${cats.map((c) => `<option${c === S.f.cat ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
        <span class="count" id="fcount"></span>
        <span class="grow"></span>
        <button class="btn" type="button" data-newprod>${U.plus} Agregar producto</button>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Oferta</th><th>Destacado</th><th>Stock</th><th></th></tr></thead>
        <tbody id="prodRows"></tbody>
      </table></div>
      <p class="hint" style="margin-top:.75rem">Los cambios de precio, destacado y stock se guardan al instante en el panel. Acordate de tocar <strong>Publicar cambios</strong> para que se vean en la tienda.</p>`;
  }

  function renderProductRows() {
    const rows = $("#prodRows"); if (!rows) return;
    const words = norm(S.f.q).split(/\s+/).filter(Boolean);
    const list = S.cat.filter((d) => (!S.f.cat || (S.f.cat === "__oferta" ? d.precioOferta : S.f.cat === "__sinfoto" ? !(d.imagen || d.caja) : d.categoria === S.f.cat)) && words.every((w) => norm(`${d.nombre} ${d.sub}`).includes(w)));
    $("#fcount").textContent = `${list.length} de ${S.cat.length}`;
    rows.innerHTML = list.map((d) => {
      const p = TW.buildProduct(d);
      return `<tr data-id="${esc(d.id)}"${S.changedIds.has(d.id) ? ' class="changed"' : ""}>
        <td><span class="mini">${TW.thumb(p)}</span></td>
        <td class="name"><strong>${esc(p.titulo)}</strong><small>${esc(d.nombre)}${d.imagen || d.caja ? "" : ' · <b style="color:var(--warn)">Sin foto: no se ve en la tienda</b>'}</small></td>
        <td><span style="white-space:nowrap">${esc(d.categoria)}</span><br><small style="color:var(--muted)">${esc(d.sub || "")}</small></td>
        <td><input class="inp price-in" type="number" min="0" step="1" value="${d.precio ?? ""}" data-f="precio" placeholder="Consultar" aria-label="Precio"></td>
        <td><input class="inp price-in offer-in${p.oferta ? " on" : ""}" type="number" min="0" step="1" value="${d.precioOferta ?? ""}" data-f="precioOferta" placeholder="—" aria-label="Precio de oferta" title="Precio de oferta: dejalo vacío si no está en oferta"></td>
        <td style="text-align:center"><input type="checkbox" data-f="destacado"${d.destacado ? " checked" : ""} aria-label="Destacado" style="accent-color:var(--violet);width:17px;height:17px"></td>
        <td><select class="inp stock-in" data-f="stock" aria-label="Stock">
          ${["disponible", "sin stock"].map((s) => `<option value="${s}"${(/^sin/i.test(d.stock || "") ? "sin stock" : "disponible") === s ? " selected" : ""}>${TW.STOCK[s]}</option>`).join("")}
        </select></td>
        <td><div class="acts"><button class="ibtn" type="button" data-editprod="${esc(d.id)}" aria-label="Editar">${U.edit}</button><button class="ibtn danger" type="button" data-delprod="${esc(d.id)}" aria-label="Eliminar">${U.trash}</button></div></td>
      </tr>`;
    }).join("") || `<tr><td colspan="8"><div class="empty-mini">No hay productos con ese filtro.</div></td></tr>`;
  }

  // Formulario de producto (nuevo o edición)
  const ATTR_FIELDS = {
    "Procesadores": [["socket", "Socket", "sel", TW.SOCKETS], ["plataforma", "Marca", "sel", ["AMD", "Intel"]], ["video", "Tiene video integrado", "bool"], ["cooler", "Trae cooler", "bool"], ["tdp", "Consumo (W)", "num"]],
    "Motherboards": [["socket", "Socket", "sel", TW.SOCKETS], ["ddr", "Memoria", "sel", ["DDR4", "DDR5", "DDR3"]], ["formato", "Formato", "sel", ["Micro-ATX", "ATX", "Mini-ITX"]], ["slots", "Slots de memoria", "sel", ["1", "2", "4"]], ["m2", "Slots M.2", "num"], ["sata", "Puertos SATA", "num"]],
    "Memorias RAM": [["ddr", "Tipo", "sel", ["DDR4", "DDR5", "DDR3"]], ["sodimm", "Es de notebook (SODIMM)", "bool"], ["gb", "Capacidad total (GB)", "num"], ["modulos", "Módulos que trae (2 = kit)", "sel", ["1", "2"]]],
    "Almacenamientos": [["tipo", "Tipo", "sel", ["SSD", "HDD"]], ["interfaz", "Conexión", "sel", ["M.2 NVMe", "M.2 SATA", "SATA", "Externo"]], ["gb", "Capacidad (GB)", "num"]],
    "Placas de video": [["tdp", "Consumo (W)", "num"], ["gb", "Memoria (GB)", "num"], ["largo", "Largo (mm)", "num"], ["psuRec", "Fuente recomendada (W)", "num"]],
    "Fuentes de poder": [["watts", "Potencia (W)", "num"]],
    "Gabinetes": [["fuente", "Fuente incluida (W, 0 = no trae)", "num"], ["formato", "Formato máximo de mother", "sel", ["ATX", "Micro-ATX", "Mini-ITX"]], ["maxGpu", "Placa de video hasta (mm)", "num"], ["maxCooler", "Cooler hasta (mm de alto)", "num"], ["radiador", "Radiador hasta (mm)", "num"]],
    "Coolers": [["tipo", "Tipo", "sel", ["Aire", "Watercooler"]], ["sockets", "Sockets (separados por coma, vacío = todos)", "list"], ["maxTdp", "Soporta hasta (W, 0 = sin límite)", "num"], ["altura", "Altura (mm, aire)", "num"], ["radiador", "Radiador (mm, watercooler)", "num"]],
  };

  function productForm(d) {
    const isNew = !d;
    d = d || { nombre: "", categoria: "", sub: "", precio: "", destacado: false, stock: "disponible", imagen: "" };
    const cats = [...new Set([...CFG.categorias, ...S.cat.map((p) => p.categoria)])];
    const subs = [...new Set(S.cat.filter((p) => p.categoria === d.categoria && p.sub).map((p) => p.sub))];
    const dlg = $("#dlg");
    dlg.innerHTML = `
      <form id="prodForm">
        <div class="dlg-head"><h2>${isNew ? "Agregar producto" : "Editar producto"}</h2><button class="close" type="button" data-close aria-label="Cerrar">${U.close}</button></div>
        <div class="dlg-body">
          <div class="form-grid">
            <label class="fld full">Nombre (como viene del mayorista)
              <input name="nombre" value="${esc(d.nombre)}" required placeholder="MICRO AMD RYZEN 5 5600 S/VIDEO C/COOLER AM4">
              <span class="hint">Podés pegar la línea completa “NOMBRE — $precio” y se separa sola. El nombre prolijo, la marca y las características se arman a partir de acá.</span>
            </label>
            <label class="fld">Categoría
              <select name="categoria" required><option value="">Elegí…</option>${cats.map((c) => `<option${c === d.categoria ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
            </label>
            <label class="fld">Subcategoría <span class="hint" style="display:inline">(opcional)</span>
              <input name="sub" value="${esc(d.sub || "")}" list="subList" placeholder="Ej: AMD AM4, DDR4, SSD">
              <datalist id="subList">${subs.map((s) => `<option value="${esc(s)}">`).join("")}</datalist>
            </label>
            <label class="fld">Precio (vacío = “Consultar precio”)<input name="precio" type="number" min="0" step="1" value="${d.precio ?? ""}"></label>
            <label class="fld">Precio de oferta <span class="hint" style="display:inline">(opcional: menor al precio, muestra el cartel de oferta)</span><input name="precioOferta" type="number" min="0" step="1" value="${d.precioOferta ?? ""}" placeholder="Sin oferta"></label>
            <label class="fld">Stock<select name="stock">${["disponible", "sin stock"].map((s) => `<option value="${s}"${(/^sin/i.test(d.stock || "") ? "sin stock" : "disponible") === s ? " selected" : ""}>${TW.STOCK[s]}</option>`).join("")}</select></label>
            <label class="check full"><input type="checkbox" name="destacado"${d.destacado ? " checked" : ""}> Mostrar como destacado (aparece primero y en el inicio)</label>
            <div class="fld full">Foto (opcional: si no hay, se muestra el logo de la marca)
              <div class="img-box"><span class="mini" id="imgPrev"></span>
                <div style="flex:1;display:grid;gap:.4rem">
                  <input class="inp" name="imagen" value="${esc(d.imagen || "")}" placeholder="Link de la imagen o subí una foto">
                  <div class="row-actions" style="margin:0"><label class="btn sm ghost" style="cursor:pointer">Subir foto<input type="file" accept="image/*" id="imgFile" hidden></label><span class="hint" id="imgStatus">${S.online ? "Se achica y se sube sola al repositorio." : "Para subir fotos, conectá GitHub."}</span></div>
                </div>
              </div>
            </div>
            <div class="fld full">Foto de la caja (opcional: se muestra al lado del producto)
              <div class="img-box"><span class="mini" id="cajaPrev"></span>
                <div style="flex:1;display:grid;gap:.4rem">
                  <input class="inp" name="caja" value="${esc(d.caja || "")}" placeholder="Link de la imagen o subí una foto">
                  <div class="row-actions" style="margin:0"><label class="btn sm ghost" style="cursor:pointer">Subir foto de la caja<input type="file" accept="image/*" id="cajaFile" hidden></label><span class="hint" id="cajaStatus"></span></div>
                </div>
              </div>
            </div>
            <label class="fld">Marca <span class="hint" style="display:inline">(vacío = automática)</span><input name="marca" value="${esc(d.marca || "")}" placeholder="Automática"></label>
            <label class="fld">Características <span class="hint" style="display:inline">(una por línea · vacío = automáticas)</span><textarea name="specs" placeholder="Automáticas">${esc((d.specs || []).join("\n"))}</textarea></label>
            <label class="fld full">Descripción <span class="hint" style="display:inline">(se ve al abrir el producto)</span><textarea name="desc" rows="4" placeholder="Qué es, para qué sirve y sus puntos fuertes">${esc(d.desc || "")}</textarea></label>
            <label class="fld full">Especificaciones <span class="hint" style="display:inline">(una por línea: “Campo: valor”)</span><textarea name="ficha" rows="6" placeholder="Socket: AM4&#10;Chipset: AMD B550&#10;Formato: Micro-ATX">${esc((d.ficha || []).map(([k, v]) => `${k}: ${v}`).join("\n"))}</textarea></label>
          </div>
          <div class="detect" id="detect"></div>
        </div>
        <div class="dlg-foot"><button class="btn ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit">${isNew ? "Agregar" : "Guardar"}</button></div>
      </form>`;
    dlg.dataset.editing = isNew ? "" : d.id;
    dlg.showModal();
    refreshDetect();
  }

  // Vista previa de cómo se lee el producto + corrección de datos de compatibilidad
  function formData() {
    const f = $("#prodForm"), fd = new FormData(f);
    const d = {
      nombre: String(fd.get("nombre") || "").trim(), categoria: fd.get("categoria"), sub: String(fd.get("sub") || "").trim(),
      precio: fd.get("precio") === "" ? null : Number(fd.get("precio")), stock: fd.get("stock"), destacado: !!fd.get("destacado"),
      ...(fd.get("precioOferta") ? { precioOferta: Number(fd.get("precioOferta")) } : {}),
      imagen: String(fd.get("imagen") || "").trim(),
      caja: String(fd.get("caja") || "").trim(),
    };
    const marca = String(fd.get("marca") || "").trim(); if (marca) d.marca = marca;
    const specs = String(fd.get("specs") || "").split("\n").map((s) => s.trim()).filter(Boolean); if (specs.length) d.specs = specs;
    const desc = String(fd.get("desc") || "").trim(); if (desc) d.desc = desc;
    // Ficha técnica: una fila por línea, "Campo: valor"
    const ficha = String(fd.get("ficha") || "").split("\n").map((l) => l.split(/:\s*/)).map(([k, ...v]) => [k.trim(), v.join(": ").trim()]).filter(([k, v]) => k && v);
    if (ficha.length) d.ficha = ficha;
    const attrs = {};
    $$("[data-attr]", f).forEach((el) => {
      if (!el.dataset.touched) return;
      const k = el.dataset.attr;
      attrs[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) || 0
        : el.dataset.kind === "list" ? el.value.split(",").map((s) => s.trim()).filter(Boolean) : el.value;
    });
    if (Object.keys(attrs).length) d.attrs = attrs;
    return d;
  }
  function refreshDetect() {
    const box = $("#detect"); if (!box) return;
    const editing = $("#dlg").dataset.editing;
    const prev = editing ? S.cat.find((x) => x.id === editing) : null;
    const d = formData();
    if (prev && prev.attrs && !d.attrs) d.attrs = prev.attrs;
    const auto = TW.buildProduct({ ...d, attrs: undefined });
    const p = TW.buildProduct(d);
    $("#imgPrev").innerHTML = TW.thumb(p);
    $("#cajaPrev").innerHTML = p.caja ? `<img src="${esc(p.caja)}" alt="">` : "";
    const fields = ATTR_FIELDS[d.categoria] || [];
    box.innerHTML = `
      <div><strong style="color:var(--text)">Así se ve en la tienda:</strong> ${esc(p.titulo || "—")} · <span class="tag">${esc(p.marca)}</span></div>
      <div class="chips">${p.specs.map((s) => `<span class="tag">${esc(s)}</span>`).join("") || '<span class="hint">Sin características</span>'}</div>
      ${fields.length ? `<div><strong style="color:var(--text)">Compatibilidad para el armador</strong> <span class="hint">(se detecta del nombre; corregilo si hace falta)</span></div>
      <div class="form-grid">${fields.map(([k, label, type, opts]) => {
        const v = p.attrs[k], overridden = d.attrs && k in d.attrs;
        const mark = overridden && auto.attrs[k] !== v ? ' <span class="tag warn">corregido</span>' : "";
        if (type === "bool") return `<label class="check"><input type="checkbox" data-attr="${k}"${overridden ? ' data-touched="1"' : ""}${v ? " checked" : ""}> ${label}${mark}</label>`;
        if (type === "sel") return `<label class="fld">${label}${mark}<select data-attr="${k}"${overridden ? ' data-touched="1"' : ""}><option value="">—</option>${opts.map((o) => `<option${String(o) === String(v) ? " selected" : ""}>${o}</option>`).join("")}</select></label>`;
        if (type === "list") return `<label class="fld">${label}${mark}<input data-attr="${k}" data-kind="list"${overridden ? ' data-touched="1"' : ""} value="${esc((v || []).join(", "))}" placeholder="AM4, AM5, LGA 1700"></label>`;
        return `<label class="fld">${label}${mark}<input type="number" min="0" data-attr="${k}"${overridden ? ' data-touched="1"' : ""} value="${v ?? ""}"></label>`;
      }).join("")}</div>` : ""}`;
  }

  function saveProduct() {
    const d = formData();
    if (!d.nombre || !d.categoria) { toast("Completá el nombre y la categoría.", false); return; }
    const editing = $("#dlg").dataset.editing;
    if (editing) {
      const i = S.cat.findIndex((x) => x.id === editing);
      const prev = S.cat[i];
      if (prev.attrs && !d.attrs) d.attrs = prev.attrs;
      // Se conservan los datos que el formulario no edita (ej. el nombre original de la lista de precios)
      const keep = Object.fromEntries(Object.entries(prev).filter(([k]) => !["precioOferta", "marca", "specs", "desc", "ficha"].includes(k)));
      S.cat[i] = { ...keep, ...d, id: prev.id };
      S.changedIds.add(prev.id);
    } else {
      const id = uniqueId(TW.slug(d.nombre), new Set(S.cat.map((x) => x.id)));
      S.cat.push({ id, ...d });
      S.changedIds.add(id);
    }
    markDirty("catalogo");
    $("#dlg").close();
    renderTab();
    toast(editing ? "Producto guardado" : "Producto agregado");
  }

  function deleteProduct(id) {
    const d = S.cat.find((x) => x.id === id); if (!d) return;
    const inPcs = S.pcs.filter((pc) => (pc.componentes || []).some((c) => c.id === id));
    const warn = inPcs.length ? `\n\nEstá en ${inPcs.length} PC(s) armada(s): ${inPcs.map((p) => p.nombre).join(", ")}. Se va a quitar de ellas.` : "";
    if (!confirm(`¿Eliminar "${TW.buildProduct(d).titulo}"?${warn}`)) return;
    S.cat = S.cat.filter((x) => x.id !== id);
    if (inPcs.length) { inPcs.forEach((pc) => (pc.componentes = pc.componentes.filter((c) => c.id !== id))); markDirty("pcs"); }
    markDirty("catalogo");
    render();
    toast("Producto eliminado");
  }

  /* =========================================================
     PCs ARMADAS
     ========================================================= */
  function pcsView() {
    const data = built();
    return `
      <div class="bar"><p class="hint" style="margin:0">Estas PCs aparecen en la sección “PC Armadas” y las destacadas también en el inicio. El precio es la suma de los componentes, salvo que pongas un precio final.</p><span class="grow"></span><button class="btn" type="button" data-newpc>${U.plus} Nueva PC</button></div>
      <div class="pc-rows">${S.pcs.map((pc, i) => {
        const issues = TW.checkBuild(TW.buildFromComponents(pc.componentes, data.byId), data.byId).filter((x) => x.level !== "falta" || !["gpu", "cooler", "psu"].includes(x.key));
        const errs = issues.filter((x) => x.level === "error").length, falta = issues.filter((x) => x.level === "falta").length, avisos = issues.filter((x) => x.level === "aviso").length;
        return `<div class="pc-row">
          <div><h3>${esc(pc.nombre)} ${pc.destacado ? '<span class="tag">Destacada</span>' : ""}</h3>
            <div class="sub"><span>${esc(pc.categoria)}</span>·<span>${(pc.componentes || []).length} componentes</span>
              ${errs ? `<span class="tag err">${errs} incompatible(s)</span>` : ""}${falta ? `<span class="tag warn">Incompleta</span>` : ""}${avisos ? `<span class="tag warn">${avisos} aviso(s)</span>` : ""}${!errs && !falta && !avisos ? '<span class="tag ok">Compatible</span>' : ""}</div></div>
          <div class="price">${TW.money(TW.pcPrice(pc, data.byId))}${pc.precio ? ' <span class="tag">precio fijo</span>' : ""}</div>
          <div class="acts" style="display:flex;gap:.3rem">
            <button class="ibtn" type="button" data-mvpc="${i}|-1" aria-label="Subir"${i === 0 ? " disabled" : ""}>▲</button>
            <button class="ibtn" type="button" data-mvpc="${i}|1" aria-label="Bajar"${i === S.pcs.length - 1 ? " disabled" : ""}>▼</button>
            <button class="ibtn" type="button" data-editpc="${esc(pc.id)}" aria-label="Editar">${U.edit}</button>
            <button class="ibtn" type="button" data-duppc="${esc(pc.id)}" aria-label="Duplicar">${U.plus}</button>
            <button class="ibtn danger" type="button" data-delpc="${esc(pc.id)}" aria-label="Eliminar">${U.trash}</button>
          </div>
        </div>`;
      }).join("") || '<div class="empty-mini">Todavía no hay PCs armadas. Creá la primera con “Nueva PC”.</div>'}</div>`;
  }

  let pcSel = null;   // configuración que se está editando
  let pcPick = null;  // componente que se está eligiendo: { key, idx, q, all }
  function pcForm(pc) {
    const isNew = !pc;
    pc = pc || { nombre: "", categoria: "", descripcion: "", destacado: false, precio: null, imagen: "", componentes: [] };
    const data = built();
    pcSel = TW.buildFromComponents(pc.componentes, data.byId);
    pcPick = null;
    const dlg = $("#dlg");
    dlg.innerHTML = `
      <form id="pcForm">
        <div class="dlg-head"><h2>${isNew ? "Nueva PC armada" : "Editar PC armada"}</h2><button class="close" type="button" data-close aria-label="Cerrar">${U.close}</button></div>
        <div class="dlg-body">
          <div class="pc-quick">
            <div><strong>¿La armaste en la tienda?</strong><span class="hint">Armala en “Armá tu PC” desde este navegador y traela acá con un clic.</span></div>
            <button class="btn sm ghost" type="button" data-frombuild>${U.plus} Traer del armador</button>
          </div>
          <div><strong>Componentes</strong> <span class="hint">Tocá cada uno para elegirlo. Solo se muestran los compatibles.</span></div>
          <div class="slots2" id="slots"></div>
          <div class="detect"><div class="issues" id="pcIssues"></div><div id="pcSum" style="font-weight:600"></div></div>
          <div class="form-grid">
            <label class="fld full">Nombre <span class="hint" style="display:inline">(vacío = se arma solo con el procesador y la placa de video)</span><input name="nombre" value="${esc(pc.nombre)}" id="pcNombre" placeholder=""></label>
            <label class="fld">Categoría<select name="categoria" id="pcCat"><option value="">Automática</option>${CFG.categoriasPC.map((c) => `<option${c === pc.categoria ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
            <label class="check" style="align-self:end;padding-bottom:.5rem"><input type="checkbox" name="destacado"${pc.destacado ? " checked" : ""}> Destacada (aparece en el inicio)</label>
          </div>
          <details class="more"${pc.descripcion || pc.imagen || pc.precio ? " open" : ""}>
            <summary>Más opciones (precio final, descripción, foto)</summary>
            <div class="form-grid" style="margin-top:.8rem">
              <label class="fld">Precio final <span class="hint" style="display:inline">(vacío = suma de componentes)</span><input name="precio" type="number" min="0" step="1" value="${pc.precio ?? ""}" id="pcPrecio"></label>
              <label class="fld">Foto <span class="hint" style="display:inline">(vacío = la del gabinete)</span><div class="row-actions" style="margin:0"><input class="inp" name="imagen" value="${esc(pc.imagen || "")}" placeholder="Link de la imagen" style="flex:1"><label class="btn sm ghost" style="cursor:pointer">Subir<input type="file" accept="image/*" id="pcImgFile" hidden></label></div></label>
              <label class="fld full">Descripción corta<textarea name="descripcion" style="min-height:60px" placeholder="Para qué sirve esta PC">${esc(pc.descripcion || "")}</textarea></label>
            </div>
          </details>
        </div>
        <div class="dlg-foot"><button class="btn ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit">${isNew ? "Crear PC" : "Guardar"}</button></div>
      </form>`;
    dlg.dataset.editing = isNew ? "" : pc.id;
    dlg.showModal();
    renderSlots();
  }

  // Nombre y categoría automáticos a partir de los componentes
  function pcAutoName() {
    const byId = built().byId, cpu = pcSel.cpu[0] && byId[pcSel.cpu[0].id], gpu = pcSel.gpu[0] && byId[pcSel.gpu[0].id];
    if (!cpu) return "";
    const short = (p) => p.titulo.replace(/\s+(s|c)\/.*$/i, "").replace(/^(AMD|Intel)\s+/i, "").replace(/\s+(Box|Tray)\b.*$/i, "");
    const g = gpu ? gpu.titulo.match(/(RTX|GTX|GT|RX)\s*\d{3,4}\s*(Ti|XT|Super)?/i) : null;
    return gpu ? `PC Gamer ${short(cpu)}${g ? " + " + g[0].replace(/\s+/g, " ") : ""}` : `PC ${cpu.attrs.video ? "Hogar" : "Oficina"} ${short(cpu)}`;
  }
  const pcAutoCat = () => (pcSel.gpu.length ? "Gamer" : CFG.categoriasPC.find((c) => /hogar|oficina/i.test(c)) || CFG.categoriasPC[0]);

  function renderSlots() {
    const data = built(), box = $("#slots"); if (!box) return;
    const slotHtml = (step, idx) => {
      const cur = (pcSel[step.key] || [])[idx], p = cur && data.byId[cur.id];
      const label = step.multi ? `${step.label} ${idx + 1}` : step.label;
      const open = pcPick && pcPick.key === step.key && pcPick.idx === idx;
      let picker = "";
      if (open) {
        const words = norm(pcPick.q).split(/\s+/).filter(Boolean);
        const list = data.products.filter((x) => TW.inStep(step, x) && (pcPick.all || !TW.incompatibility(step.key, x, pcSel, data.byId))
          && words.every((w) => norm(`${x.titulo} ${x.marca}`).includes(w))).sort((a, b) => (a.precio || 1e12) - (b.precio || 1e12));
        picker = `<div class="picker">
          <div class="picker-bar"><input class="inp" id="slotQ" placeholder="Buscar ${esc(step.label.toLowerCase())}…" value="${esc(pcPick.q)}" autocomplete="off">
            <label class="check"><input type="checkbox" id="slotAll"${pcPick.all ? " checked" : ""}> Ver también no compatibles</label></div>
          <div class="picker-list">${list.map((x) => {
            const why = TW.incompatibility(step.key, x, pcSel, data.byId);
            return `<button type="button" class="pick-it${cur && cur.id === x.id ? " sel" : ""}" data-slotset="${step.key}|${idx}|${esc(x.id)}"><span class="mini">${TW.thumb(x)}</span><span>${esc(x.titulo)}${why ? `<small class="warn">⚠ ${esc(why)}</small>` : ""}</span><b>${x.precio ? TW.money(x.precio) : "Consultar"}</b></button>`;
          }).join("") || `<div class="empty-mini">No hay opciones${pcPick.q ? " con esa búsqueda" : " compatibles"}.</div>`}</div>
        </div>`;
      }
      return `<div class="slot2${p ? " done" : ""}${open ? " open" : ""}">
        <button type="button" class="slot-row" data-slotpick="${step.key}|${idx}">
          <span class="mini">${p ? TW.thumb(p) : TW.ICONS[step.icon || step.cat]}</span>
          <span class="slot-txt"><small>${esc(label)}</small>${p ? esc(p.titulo) : `<em>Elegir ${esc(step.label.toLowerCase())}…</em>`}</span>
          <b>${p ? (p.precio ? TW.money(p.precio * (cur.qty || 1)) : "Consultar") : ""}</b>
        </button>
        ${p && step.maxQty ? `<label class="slot-qty">Cant.<input class="inp" type="number" min="1" max="${TW.maxQty(step.key, pcSel, data.byId)}" value="${cur.qty}" data-slotqty="${step.key}|${idx}"></label>` : ""}
        ${p ? `<button type="button" class="ibtn danger" data-slotclear="${step.key}|${idx}" aria-label="Quitar">${U.trash}</button>` : ""}
        ${picker}
      </div>`;
    };
    box.innerHTML = TW.STEPS.map((s) => {
      const n = s.multi ? Math.min(s.multi, (pcSel[s.key] || []).length + 1) : 1;
      return Array.from({ length: n }, (_, i) => slotHtml(s, i)).join("");
    }).join("");
    const issues = TW.checkBuild(pcSel, data.byId);
    $("#pcIssues").innerHTML = issues.map((x) => `<div class="${x.level}">${x.level === "falta" ? "○" : "⚠"} ${esc(x.msg)}</div>`).join("") || `<div class="ok">✓ Todos los componentes son compatibles</div>`;
    const sum = TW.linesTotal(TW.buildLines(pcSel, data.byId));
    const fixed = Number($("#pcPrecio")?.value) || 0;
    $("#pcSum").innerHTML = `Suma de componentes: ${TW.money(sum)}${fixed ? ` · Precio final: ${TW.money(fixed)} <span class="tag ${fixed < sum ? "warn" : "ok"}">${fixed < sum ? "menor" : "+" + Math.round(((fixed - sum) / (sum || 1)) * 100) + "%"}</span>` : ""}`;
    const nm = $("#pcNombre"); if (nm) nm.placeholder = pcAutoName() || "PC Gamer Ryzen 5 5600 + RTX 3050";
    const q = $("#slotQ"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  function setSlot(key, idx, id) {
    const arr = pcSel[key] || (pcSel[key] = []);
    const prevQty = arr[idx] ? arr[idx].qty : 1;
    if (id) arr[idx] = { id, qty: prevQty }; else arr.splice(idx, 1);
    pcSel[key] = arr.filter(Boolean);
    if (key === "cpu") { const p = built().byId[id]; pcSel.plataforma = p ? p.attrs.plataforma : ""; }
    // Pasa solo al siguiente componente vacío
    const next = TW.STEPS.find((s) => !s.opcional && !(pcSel[s.key] || []).length);
    pcPick = id && next ? { key: next.key, idx: 0, q: "", all: false } : null;
    renderSlots();
  }

  function pcFromBuilder() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("tw_build_v1")); } catch {}
    const byId = built().byId;
    const comps = saved && saved.sel ? TW.STEPS.flatMap((s) => (saved.sel[s.key] || []).filter((c) => byId[c.id])) : [];
    if (!comps.length) { toast("No hay ninguna PC en el armador de este navegador. Armala en la tienda (Armá tu PC) y volvé a tocar el botón.", false); return; }
    pcSel = TW.buildFromComponents(comps, byId); pcPick = null;
    renderSlots(); toast(`Traje ${comps.length} componentes del armador`);
  }

  function savePc() {
    const f = $("#pcForm"), fd = new FormData(f);
    const nombre = String(fd.get("nombre") || "").trim() || pcAutoName();
    if (!nombre) { toast("Elegí al menos el procesador o poné un nombre.", false); return; }
    const componentes = TW.STEPS.flatMap((s) => (pcSel[s.key] || []).filter((c) => c && c.id).map((c) => ({ id: c.id, qty: c.qty || 1 })));
    if (!componentes.length) { toast("Elegí al menos un componente.", false); return; }
    const pc = {
      nombre, categoria: fd.get("categoria") || pcAutoCat(), descripcion: String(fd.get("descripcion") || "").trim(),
      destacado: !!fd.get("destacado"), precio: fd.get("precio") ? Number(fd.get("precio")) : null,
      imagen: String(fd.get("imagen") || "").trim(), componentes,
    };
    const editing = $("#dlg").dataset.editing;
    if (editing) { const i = S.pcs.findIndex((x) => x.id === editing); S.pcs[i] = { id: editing, ...pc }; }
    else S.pcs.push({ id: uniqueId("pc-" + TW.slug(nombre), new Set(S.pcs.map((x) => x.id))), ...pc });
    markDirty("pcs");
    $("#dlg").close();
    render();
    toast(editing ? "PC guardada" : "PC creada");
  }

  /* =========================================================
     ACTUALIZAR PRECIOS (pegar la lista del mayorista)
     ========================================================= */
  function importView() {
    const r = S.imp;
    const cats = [...new Set([...CFG.categorias, ...S.cat.map((p) => p.categoria)])];
    return `
      <div class="panel-card">
        <h2>Actualizar precios pegando la lista</h2>
        <p>Pegá la lista del mayorista (una línea por producto: <code>NOMBRE — $precio</code>). Podés agregar líneas <code># Categoría | Subcategoría</code> para indicar dónde van los productos nuevos. Antes de aplicar te mostramos qué cambia.</p>
        <textarea class="inp" id="impText" style="min-height:180px;font-family:ui-monospace,Consolas,monospace;font-size:.82rem" placeholder="MICRO AMD RYZEN 5 5600 S/VIDEO C/COOLER AM4 — $250.574&#10;MOTHER GIGABYTE B550M K DDR4 AM4 — $142.991">${esc(r ? r.text : "")}</textarea>
        <div class="row-actions"><button class="btn" type="button" data-analyze>Analizar lista</button>${r ? '<button class="btn ghost" type="button" data-impclear>Limpiar</button>' : ""}</div>
      </div>
      ${r ? `
      <div class="imp-sec"><h3>Cambios de precio <span class="tag">${r.changes.length}</span></h3>
        ${r.changes.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th><input type="checkbox" data-allchk="chg" checked></th><th>Producto</th><th>Antes</th><th>Ahora</th><th>Dif.</th></tr></thead><tbody>
          ${r.changes.map((c, i) => { const pct = c.old ? Math.round(((c.precio - c.old) / c.old) * 100) : 0; return `<tr><td><input type="checkbox" data-chg="${i}"${c.on ? " checked" : ""}></td><td class="name"><strong>${esc(TW.buildProduct(c.d).titulo)}</strong></td><td class="num">${c.old ? TW.money(c.old) : "—"}</td><td class="num">${TW.money(c.precio)}</td><td class="num ${pct > 0 ? "up" : "down"}">${pct > 0 ? "+" : ""}${pct}%</td></tr>`; }).join("")}
        </tbody></table></div>` : '<div class="empty-mini">Ningún precio cambió.</div>'}
      </div>
      <div class="imp-sec"><h3>Productos nuevos <span class="tag">${r.nuevos.length}</span></h3>
        ${r.nuevos.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th><input type="checkbox" data-allchk="new" checked></th><th>Producto</th><th>Precio</th><th>Categoría</th><th>Subcategoría</th></tr></thead><tbody>
          ${r.nuevos.map((n, i) => `<tr><td><input type="checkbox" data-new="${i}"${n.on ? " checked" : ""}></td><td class="name"><strong>${esc(TW.buildProduct(n).titulo)}</strong><small>${esc(n.nombre)}</small></td><td class="num">${TW.money(n.precio)}</td>
            <td><select class="inp" data-newcat="${i}" style="min-width:160px"><option value="">Elegí…</option>${cats.map((c) => `<option${c === n.categoria ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></td>
            <td><input class="inp" data-newsub="${i}" value="${esc(n.sub)}" style="min-width:130px"></td></tr>`).join("")}
        </tbody></table></div>` : '<div class="empty-mini">No hay productos nuevos.</div>'}
      </div>
      <div class="imp-sec"><h3>En la tienda pero no en la lista <span class="tag">${r.faltan.length}</span></h3>
        ${r.faltan.length ? `<p class="hint" style="margin:0 0 .5rem">Si pegaste la lista completa, estos productos ya no los tiene el mayorista. Elegí qué hacer con cada uno.
          <button class="linkish" type="button" data-allmiss="keep">Dejar todos</button> · <button class="linkish" type="button" data-allmiss="nostock">Todos sin stock</button> · <button class="linkish" type="button" data-allmiss="delete">Eliminar todos</button></p>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th>Precio actual</th><th>Qué hacer</th></tr></thead><tbody>
          ${r.faltan.map((m, i) => `<tr><td class="name"><strong>${esc(TW.buildProduct(m.d).titulo)}</strong><small>${esc(m.d.categoria)}</small></td><td class="num">${m.d.precio ? TW.money(m.d.precio) : "—"}</td>
            <td><select class="inp" data-miss="${i}" style="min-width:170px"><option value="keep"${m.act === "keep" ? " selected" : ""}>Dejar igual</option><option value="nostock"${m.act === "nostock" ? " selected" : ""}>Marcar sin stock</option><option value="delete"${m.act === "delete" ? " selected" : ""}>Eliminar</option></select></td></tr>`).join("")}
        </tbody></table></div>` : '<div class="empty-mini">Todos los productos de la tienda están en la lista.</div>'}
      </div>
      <div class="row-actions" style="margin-top:1.5rem"><button class="btn" type="button" data-apply>Aplicar cambios</button><span class="hint">Después revisá y tocá “Publicar cambios”.</span></div>` : ""}`;
  }

  function analyze(text) {
    const lines = TW.parseList(text);
    if (!lines.length) { toast("No encontramos líneas con el formato “NOMBRE — $precio”.", false); return; }
    const byName = new Map(S.cat.map((d) => [cleanName(d.nombre), d]));
    const seen = new Set(), changes = [], nuevos = [];
    for (const l of lines) {
      const key = cleanName(l.nombre);
      const d = byName.get(key);
      if (d) {
        seen.add(d.id);
        if (Number(d.precio) !== l.precio) changes.push({ d, old: Number(d.precio) || 0, precio: l.precio, on: true });
      } else if (!nuevos.some((n) => cleanName(n.nombre) === key)) {
        const g = TW.guessCategory(l.nombre);
        nuevos.push({ nombre: l.nombre, precio: l.precio, categoria: l.categoria || g.categoria, sub: l.sub || g.sub, on: !!(l.categoria || g.categoria) });
      }
    }
    const faltan = S.cat.filter((d) => !seen.has(d.id)).map((d) => ({ d, act: "keep" }));
    S.imp = { text, changes, nuevos, faltan };
    renderTab();
  }

  function applyImport() {
    const r = S.imp; if (!r) return;
    let nC = 0, nN = 0, nS = 0, nD = 0;
    for (const c of r.changes) if (c.on) { c.d.precio = c.precio; S.changedIds.add(c.d.id); nC++; }
    const taken = new Set(S.cat.map((x) => x.id));
    for (const n of r.nuevos) {
      if (!n.on) continue;
      if (!n.categoria) { toast(`Elegí la categoría de “${n.nombre}” o destildalo.`, false); return; }
      const id = uniqueId(TW.slug(n.nombre), taken); taken.add(id);
      S.cat.push({ id, nombre: n.nombre, categoria: n.categoria, sub: n.sub, precio: n.precio, destacado: false, stock: "disponible", imagen: "" });
      S.changedIds.add(id); nN++;
    }
    const del = new Set();
    for (const m of r.faltan) {
      if (m.act === "nostock") { m.d.stock = "sin stock"; S.changedIds.add(m.d.id); nS++; }
      if (m.act === "delete") { del.add(m.d.id); nD++; }
    }
    if (del.size) {
      S.cat = S.cat.filter((d) => !del.has(d.id));
      let touched = false;
      for (const pc of S.pcs) { const before = pc.componentes.length; pc.componentes = pc.componentes.filter((c) => !del.has(c.id)); if (pc.componentes.length !== before) touched = true; }
      if (touched) markDirty("pcs");
    }
    if (nC || nN || nS || nD) markDirty("catalogo");
    S.imp = null; S.tab = "productos";
    render();
    toast(`Listo: ${nC} precios actualizados, ${nN} productos nuevos, ${nS} sin stock, ${nD} eliminados.`);
  }

  /* =========================================================
     EVENTOS
     ========================================================= */
  document.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (e.target.id === "connForm") {
      const fd = new FormData(e.target);
      const btn = e.target.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Conectando…";
      try {
        await connect(Object.fromEntries(fd));
        // Queda guardado en la cuenta para que cualquier administrador publique desde cualquier dispositivo
        if (fbOn()) { const { owner, repo, branch, token } = S.conn; A.admin.setSetting("github", { owner, repo, branch, token }).catch((err) => console.warn(err)); }
        toast("Conectado. Ya podés editar y publicar.");
      }
      catch (err) { toast(err.status === 401 ? "El token no es válido o venció." : err.status === 404 ? "No encontramos el repositorio (revisá usuario, nombre y que el token tenga acceso)." : err.message, false); btn.disabled = false; btn.textContent = "Conectar y cargar productos"; }
    }
    if (e.target.id === "prodForm") saveProduct();
    if (e.target.id === "pcForm") savePc();
  });

  document.addEventListener("click", async (e) => {
    const el = (s) => e.target.closest(s);
    let x;
    if ((x = el("[data-close]"))) { x.closest("dialog").close(); return; }
    if (e.target.tagName === "DIALOG") { e.target.close(); return; }
    if ((x = el("[data-offline]"))) { S.online = false; try { await loadData(); } catch { toast("No se pudieron leer los archivos de datos.", false); } return; }
    if ((x = el("[data-tab]"))) { S.tab = x.dataset.tab; render(); return; }
    if ((x = el("#publishBtn")) || (x = el("[data-publish]"))) {
      if (S.online) publish(); else { if (S.dirty.catalogo) download("catalogo"); if (S.dirty.pcs) download("pcs"); }
      return;
    }
    if ((x = el("[data-newprod]"))) { productForm(null); return; }
    if ((x = el("[data-editprod]"))) { productForm(S.cat.find((d) => d.id === x.dataset.editprod)); return; }
    if ((x = el("[data-delprod]"))) { deleteProduct(x.dataset.delprod); return; }
    if ((x = el("[data-slotpick]"))) {
      const [key, idx] = x.dataset.slotpick.split("|");
      const same = pcPick && pcPick.key === key && pcPick.idx === Number(idx);
      pcPick = same ? null : { key, idx: Number(idx), q: "", all: false };
      renderSlots(); return;
    }
    if ((x = el("[data-slotset]"))) { const [key, idx, id] = x.dataset.slotset.split("|"); setSlot(key, Number(idx), id); return; }
    if ((x = el("[data-slotclear]"))) { const [key, idx] = x.dataset.slotclear.split("|"); pcPick = null; setSlot(key, Number(idx), ""); return; }
    if ((x = el("[data-frombuild]"))) { pcFromBuilder(); return; }
    if ((x = el("[data-newpc]"))) { pcForm(null); return; }
    if ((x = el("[data-editpc]"))) { pcForm(S.pcs.find((p) => p.id === x.dataset.editpc)); return; }
    if ((x = el("[data-duppc]"))) {
      const src = S.pcs.find((p) => p.id === x.dataset.duppc);
      const copy = JSON.parse(JSON.stringify(src)); copy.nombre += " (copia)";
      copy.id = uniqueId(src.id + "-copia", new Set(S.pcs.map((p) => p.id)));
      S.pcs.splice(S.pcs.indexOf(src) + 1, 0, copy); markDirty("pcs"); render(); return;
    }
    if ((x = el("[data-delpc]"))) {
      const pc = S.pcs.find((p) => p.id === x.dataset.delpc);
      if (confirm(`¿Eliminar la PC "${pc.nombre}"?`)) { S.pcs = S.pcs.filter((p) => p !== pc); markDirty("pcs"); render(); }
      return;
    }
    if ((x = el("[data-mvpc]"))) {
      const [i, d] = x.dataset.mvpc.split("|").map(Number), j = i + d;
      if (j < 0 || j >= S.pcs.length) return;
      [S.pcs[i], S.pcs[j]] = [S.pcs[j], S.pcs[i]]; markDirty("pcs"); render(); return;
    }
    if ((x = el("[data-analyze]"))) { analyze($("#impText").value); return; }
    if ((x = el("[data-impclear]"))) { S.imp = null; renderTab(); return; }
    if ((x = el("[data-apply]"))) { applyImport(); return; }
    if ((x = el("[data-allmiss]"))) { S.imp.faltan.forEach((m) => (m.act = x.dataset.allmiss)); renderTab(); return; }
    if ((x = el("[data-reload]"))) {
      if ((S.dirty.catalogo || S.dirty.pcs) && !confirm("Tenés cambios sin publicar. Si recargás se pierden. ¿Seguir?")) return;
      try { await loadData(); toast("Datos recargados desde GitHub"); } catch (err) { toast(err.message, false); }
      return;
    }
    if ((x = el("[data-disconnect]"))) { if (confirm(fbOn() ? "¿Desconectar GitHub? Se borra el token del panel y hay que volver a cargarlo para publicar." : "¿Desconectar? Se borra el token de este navegador.")) { disconnect(); S.loaded = false; render(); } return; }
    if ((x = el("[data-goconnect]"))) { S.loaded = false; render(); return; }
  });

  // Enter en el buscador de componentes elige el primero en vez de guardar la PC
  document.addEventListener("keydown", (e) => {
    if (e.target.id !== "slotQ" || e.key !== "Enter") return;
    e.preventDefault();
    $(".picker-list .pick-it")?.click();
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "fq") { S.f.q = t.value; renderProductRows(); return; }
    if (t.closest("#prodForm")) {
      if (t.name === "nombre") {
        const p = TW.parseLine(t.value);
        if (p) { t.value = p.nombre; $("#prodForm [name=precio]").value = p.precio; }
        const f = $("#prodForm [name=categoria]");
        if (!f.value) { const g = TW.guessCategory(t.value); if (g.categoria) { f.value = g.categoria; $("#prodForm [name=sub]").value = g.sub; } }
      }
      if (t.dataset.attr) { t.dataset.touched = "1"; return; } // se refresca al salir del campo
      refreshDetect();
      return;
    }
    if (t.id === "pcPrecio") { renderSlots(); return; }
    if (t.id === "slotQ" && pcPick) { pcPick.q = t.value; renderSlots(); return; }
    if (t.dataset.slotqty) {
      const [key, idx] = t.dataset.slotqty.split("|"); const c = pcSel[key][Number(idx)];
      if (c) c.qty = Math.max(1, Math.min(TW.maxQty(key, pcSel, built().byId), Number(t.value) || 1));
      return;
    }
  });

  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.id === "fcat") { S.f.cat = t.value; renderProductRows(); return; }
    // Edición rápida en la tabla de productos
    const row = t.closest("#prodRows tr[data-id]");
    if (row && t.dataset.f) {
      const d = S.cat.find((x) => x.id === row.dataset.id);
      if (t.dataset.f === "precio") d.precio = t.value === "" ? null : Number(t.value);
      if (t.dataset.f === "precioOferta") { if (t.value === "") delete d.precioOferta; else d.precioOferta = Number(t.value); }
      if (t.dataset.f === "destacado") d.destacado = t.checked;
      if (t.dataset.f === "stock") d.stock = t.value;
      S.changedIds.add(d.id); row.classList.add("changed");
      markDirty("catalogo");
      return;
    }
    if (t.closest("#prodForm") && (t.dataset.attr || t.tagName === "SELECT" || t.type === "checkbox")) {
      if (t.dataset.attr) t.dataset.touched = "1";
      refreshDetect(); return;
    }
    if (t.dataset.slotqty) { renderSlots(); return; }
    if (t.id === "slotAll" && pcPick) { pcPick.all = t.checked; renderSlots(); return; }
    if (t.id === "imgFile" || t.id === "pcImgFile" || t.id === "cajaFile") {
      const file = t.files[0]; if (!file) return;
      const form = t.closest("form");
      const caja = t.id === "cajaFile";
      const status = $(caja ? "#cajaStatus" : "#imgStatus");
      try {
        if (status) status.textContent = "Subiendo…";
        const path = await uploadImage(file, (form.querySelector("[name=nombre]").value || "foto") + (caja ? " caja" : ""));
        form.querySelector(caja ? "[name=caja]" : "[name=imagen]").value = path;
        if (status) status.textContent = "Foto subida ✓";
        if (t.id !== "pcImgFile") refreshDetect();
        toast("Foto subida");
      } catch (err) { if (status) status.textContent = err.message; toast(err.message, false); }
      return;
    }
    // Importación
    if (t.dataset.chg) { S.imp.changes[Number(t.dataset.chg)].on = t.checked; return; }
    if (t.dataset.new) { S.imp.nuevos[Number(t.dataset.new)].on = t.checked; return; }
    if (t.dataset.newcat) { S.imp.nuevos[Number(t.dataset.newcat)].categoria = t.value; return; }
    if (t.dataset.newsub) { S.imp.nuevos[Number(t.dataset.newsub)].sub = t.value; return; }
    if (t.dataset.miss) { S.imp.faltan[Number(t.dataset.miss)].act = t.value; return; }
    if (t.dataset.allchk) {
      const list = t.dataset.allchk === "chg" ? S.imp.changes : S.imp.nuevos;
      list.forEach((x) => (x.on = t.checked)); renderTab(); return;
    }
  });

  /* =========================================================
     CUENTAS: ingreso al panel, pedidos, clientes y administradores
     ========================================================= */
  const ESTADOS = [["nuevo", "Nuevo"], ["respondido", "Respondido"], ["vendido", "Vendido"], ["cancelado", "Cancelado"]];
  const fdate = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const ftime = (d) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const G_ICON = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  // Link de WhatsApp al teléfono que cargó el cliente (formato argentino)
  function waTo(tel, text) {
    let d = String(tel || "").replace(/\D/g, "");
    if (!d) return "";
    if (!d.startsWith("54")) { d = d.replace(/^0/, ""); if (d.length === 10) d = "549" + d; }
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  }

  /* ---------- Pantalla de ingreso ---------- */
  function gateView() {
    const u = A.user;
    const card = (title, body, actions = "") => `
      <div class="panel-card gate">
        <img class="gate-logo" src="img/logo/emblema.png" alt="" width="65" height="34">
        <h2>${title}</h2>${body}
        ${actions ? `<div class="gate-actions">${actions}</div>` : ""}
      </div>`;
    if (A.failed) return card("No se pudo conectar", `<p>No pudimos conectar con el servidor de cuentas. Revisá tu internet y recargá la página.</p>`, `<button class="btn" type="button" onclick="location.reload()">Recargar</button>`);
    if (!u) return card("Panel de administración", `<p>Ingresá con tu cuenta de administrador.</p>
      <button class="gbtn" type="button" data-glogin>${G_ICON} Continuar con Google</button>
      <div class="auth-or"><span>o con tu mail</span></div>
      <form id="admLogin" class="auth-form" novalidate>
        <label class="o-fld">Mail<input name="email" type="email" autocomplete="email" required></label>
        <label class="o-fld">Contraseña<input name="pass" type="password" autocomplete="current-password" required></label>
        <p class="auth-err" role="alert" hidden></p>
        <button class="btn block" type="submit">Ingresar</button>
        <button class="linkish" type="button" data-aforgot>¿Olvidaste tu contraseña?</button>
      </form>`);
    if (A.adminPending) return card("Verificá tu mail", `<p>Te mandamos un link a <strong>${esc(u.email)}</strong>. Abrilo, y después tocá <em>Ya lo verifiqué</em>. Revisá también la carpeta de spam.</p>`,
      `<button class="btn" type="button" data-averified>Ya lo verifiqué</button><button class="btn ghost" type="button" data-aresend>Reenviar mail</button><button class="btn ghost" type="button" data-alogout>Salir</button>`);
    return card("No tenés acceso al panel", `<p>La cuenta <strong>${esc(u.email)}</strong> no es administradora. Pedile a un administrador que agregue tu mail en <em>Ajustes → Administradores</em>.</p>`,
      `<a class="btn" href="index.html">Ir a la tienda</a><button class="btn ghost" type="button" data-alogout>Ingresar con otra cuenta</button>`);
  }

  function lockPanel(locked) {
    document.body.classList.toggle("locked", locked);
    const pill = $("#userPill"), out = $("#logoutBtn");
    if (pill) { pill.hidden = locked || !A.user; pill.querySelector("span").textContent = A.user ? A.user.email : ""; }
    if (out) out.hidden = locked || !A.user;
  }

  let started = false;
  async function startPanel() {
    if (started) return;
    started = true;
    lockPanel(false);
    loadFb();
    // La conexión con GitHub guardada en la cuenta (así se publica desde cualquier dispositivo)
    if (!S.conn.token) {
      try { const g = await A.admin.getSetting("github"); if (g && g.token) Object.assign(S.conn, { owner: g.owner || S.conn.owner, repo: g.repo || S.conn.repo, branch: g.branch || S.conn.branch, token: g.token }); } catch (e) { console.warn(e); }
    }
    if (S.conn.token) {
      try { await connect({}); return; } catch (err) { toast(`No se pudo conectar con GitHub: ${err.message}`, false); }
    }
    render();
  }

  function onAuthChange() {
    if (A.isAdmin) { startPanel(); lockPanel(false); return; }
    // Cerró sesión o dejó de ser administrador: se bloquea el panel
    started = false; S.loaded = false; S.online = false;
    S.fb.orders = S.fb.users = S.fb.admins = null;
    lockPanel(true);
    $("#app").innerHTML = gateView();
  }

  async function loadFb(msg) {
    S.fb.err = "";
    try {
      const [orders, users, admins] = await Promise.all([A.admin.orders(), A.admin.users(), A.admin.admins()]);
      Object.assign(S.fb, { orders, users, admins, at: Date.now() });
      if (msg) toast(msg);
    } catch (e) { S.fb.err = e.message; }
    if (S.loaded) render();
  }

  /* ---------- Pedidos ---------- */
  function ordersView() {
    const F = S.fb;
    if (F.err) return `<div class="empty-mini">${esc(F.err)}<div class="row-actions" style="justify-content:center"><button class="btn sm" type="button" data-fbreload>Reintentar</button></div></div>`;
    if (!F.orders) return `<div class="empty-mini">Cargando pedidos…</div>`;
    const now = new Date(), thisMonth = (d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const mes = F.orders.filter((o) => thisMonth(o.fecha));
    const count = (e) => F.orders.filter((o) => o.estado === e).length;
    return `
      <div class="stats">
        <div class="stat hi"><small>Sin responder</small><strong>${count("nuevo")}</strong></div>
        <div class="stat"><small>Pedidos este mes</small><strong>${mes.length}</strong></div>
        <div class="stat"><small>Vendido este mes</small><strong>${TW.money(mes.filter((o) => o.estado === "vendido").reduce((t, o) => t + (o.total || 0), 0))}</strong></div>
      </div>
      <div class="bar">
        <label class="hsearch">${U.search}<input id="oq" type="search" placeholder="Buscar pedido…" value="${esc(F.f.q)}" autocomplete="off"></label>
        <div class="chips">${[["", "Todos", F.orders.length], ...ESTADOS.map(([k, l]) => [k, l + "s", count(k)])].map(([k, l, n]) =>
          `<button class="chip" type="button" data-ofil="${k}" aria-pressed="${F.f.estado === k}">${l} <b>${n}</b></button>`).join("")}</div>
        <span class="grow"></span>
        <button class="btn ghost sm" type="button" data-fbreload>${U.redo} Actualizar</button>
      </div>
      <div class="tbl-wrap"><table class="tbl ords-tbl">
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Pedido</th><th style="text-align:right">Total</th><th>Estado</th><th></th></tr></thead>
        <tbody id="ordRows"></tbody>
      </table></div>
      <p class="hint" style="margin-top:.75rem">Acá aparecen los pedidos que los clientes mandan por WhatsApp con su cuenta iniciada. El N° de pedido también figura en el mensaje de WhatsApp. El estado se guarda al instante (no hace falta publicar).</p>`;
  }

  function renderOrderRows() {
    const rows = $("#ordRows"); if (!rows || !S.fb.orders) return;
    const words = norm(S.fb.f.q).split(/\s+/).filter(Boolean);
    const list = S.fb.orders.filter((o) => (!S.fb.f.estado || o.estado === S.fb.f.estado) &&
      words.every((w) => norm([o.codigo, o.nombre, o.email, o.telefono, ...(o.items || []).map((i) => i.titulo)].join(" ")).includes(w)));
    rows.innerHTML = list.map((o) => {
      const items = o.items || [], first = items[0];
      const wa = waTo(o.telefono, `Hola ${(o.nombre || "").split(" ")[0]}! Te escribimos de ${CFG.negocio.nombre} por tu pedido N° ${o.codigo}.`);
      return `<tr data-oid="${esc(o.id)}">
        <td class="nowrap"><strong>${fdate(o.fecha)}</strong><br><small class="muted">${ftime(o.fecha)} · N° ${esc(o.codigo || "")}</small></td>
        <td class="name"><strong>${esc(o.nombre || "(sin nombre)")}</strong><small>${esc(o.email || "")}${o.telefono ? ` · ${esc(o.telefono)}` : ""}</small></td>
        <td class="ord-sum">${first ? `<details><summary>${first.cant > 1 ? first.cant + "x " : ""}${esc(first.titulo)}${items.length > 1 ? ` <em>y ${items.length - 1} más</em>` : ""}</summary>
          <ul>${items.map((i) => `<li><span>${i.cant > 1 ? i.cant + "x " : ""}${esc(i.titulo)}${(i.detalle || []).length ? `<small>${i.detalle.map(esc).join(" · ")}</small>` : ""}</span><b>${i.precio ? TW.money(i.precio * (i.cant || 1)) : "Consultar"}</b></li>`).join("")}</ul>
          ${o.nota ? `<p class="ord-nota"><b>Nota:</b> ${esc(o.nota)}</p>` : ""}</details>` : "—"}
          <small class="muted">${o.origen === "armador" ? "Desde el armador" : "Desde el carrito"}</small></td>
        <td class="num"><strong>${TW.money(o.total)}</strong></td>
        <td><select class="inp st-sel st-${esc(o.estado)}" data-ost="${esc(o.id)}" aria-label="Estado del pedido">${ESTADOS.map(([k, l]) => `<option value="${k}"${o.estado === k ? " selected" : ""}>${l}</option>`).join("")}</select></td>
        <td><div class="acts">
          ${wa ? `<a class="ibtn wa-ibtn" href="${wa}" target="_blank" rel="noopener" aria-label="Escribirle por WhatsApp" title="Escribirle por WhatsApp">${U.wa}</a>` : ""}
          ${o.email ? `<a class="ibtn" href="mailto:${esc(o.email)}?subject=${encodeURIComponent(`Tu pedido N° ${o.codigo} en ${CFG.negocio.nombre}`)}" aria-label="Mandarle un mail" title="Mandarle un mail">${MAIL_ICON}</a>` : ""}
          <button class="ibtn danger" type="button" data-odel="${esc(o.id)}" aria-label="Eliminar pedido" title="Eliminar pedido">${U.trash}</button>
        </div></td>
      </tr>`;
    }).join("") || `<tr><td colspan="6"><div class="empty-mini">${S.fb.orders.length ? "No hay pedidos con ese filtro." : "Todavía no hay pedidos. Cuando un cliente con cuenta mande un pedido por WhatsApp, aparece acá."}</div></td></tr>`;
  }
  const MAIL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';

  /* ---------- Clientes ---------- */
  function usersView() {
    const F = S.fb;
    if (F.err) return `<div class="empty-mini">${esc(F.err)}<div class="row-actions" style="justify-content:center"><button class="btn sm" type="button" data-fbreload>Reintentar</button></div></div>`;
    if (!F.users) return `<div class="empty-mini">Cargando clientes…</div>`;
    const nOf = F.users.filter((u) => u.ofertas).length;
    return `
      <div class="stats">
        <div class="stat"><small>Clientes registrados</small><strong>${F.users.length}</strong></div>
        <div class="stat hi"><small>Aceptan recibir ofertas</small><strong>${nOf}</strong></div>
        <div class="stat"><small>Con al menos un pedido</small><strong>${F.users.filter((u) => ordersOf(u).length).length}</strong></div>
      </div>
      <div class="bar">
        <label class="hsearch">${U.search}<input id="uq" type="search" placeholder="Buscar por nombre, mail o teléfono…" value="${esc(F.uq)}" autocomplete="off"></label>
        <span class="count" id="ucount"></span>
        <span class="grow"></span>
        <button class="btn sm" type="button" data-csv="ofertas"${nOf ? "" : " disabled"}>Descargar mails para ofertas (${nOf})</button>
        <button class="btn ghost sm" type="button" data-csv="todos"${F.users.length ? "" : " disabled"}>Descargar todos</button>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Cliente</th><th>Teléfono</th><th>Ofertas por mail</th><th>Pedidos</th><th>Registrado</th><th></th></tr></thead>
        <tbody id="userRows"></tbody>
      </table></div>
      <p class="hint" style="margin-top:.75rem">Los archivos se abren con Excel. Para mandar promociones usá solo <strong>“mails para ofertas”</strong>: son los clientes que aceptaron recibirlas.</p>`;
  }
  const ordersOf = (u) => (S.fb.orders || []).filter((o) => o.uid === u.uid);

  function renderUserRows() {
    const rows = $("#userRows"); if (!rows || !S.fb.users) return;
    const words = norm(S.fb.uq).split(/\s+/).filter(Boolean);
    const list = S.fb.users.filter((u) => words.every((w) => norm([u.nombre, u.email, u.telefono].join(" ")).includes(w)));
    $("#ucount").textContent = `${list.length} de ${S.fb.users.length}`;
    rows.innerHTML = list.map((u) => {
      const n = ordersOf(u).length;
      const wa = waTo(u.telefono, `Hola ${(u.nombre || "").split(" ")[0]}! Te escribimos de ${CFG.negocio.nombre}.`);
      return `<tr>
        <td class="name"><strong>${esc(u.nombre || "(sin nombre)")}</strong><small>${esc(u.email || "")}</small></td>
        <td class="nowrap">${u.telefono ? (wa ? `<a href="${wa}" target="_blank" rel="noopener">${esc(u.telefono)}</a>` : esc(u.telefono)) : '<span class="muted">—</span>'}</td>
        <td>${u.ofertas ? '<span class="tag ok">Sí</span>' : '<span class="muted">No</span>'}</td>
        <td>${n ? `<button class="linkish lk" type="button" data-uorders="${esc(u.email || "")}">${n} ${n === 1 ? "pedido" : "pedidos"}</button>` : '<span class="muted">—</span>'}</td>
        <td class="nowrap">${fdate(u.fecha)}</td>
        <td><div class="acts"><button class="ibtn danger" type="button" data-udel="${esc(u.uid)}" aria-label="Borrar los datos de ${esc(u.nombre || u.email || "")}" title="Borrar sus datos">${U.trash}</button></div></td>
      </tr>`;
    }).join("") || `<tr><td colspan="6"><div class="empty-mini">${S.fb.users.length ? "No hay clientes con esa búsqueda." : "Todavía no se registró ningún cliente."}</div></td></tr>`;
  }

  // Planilla para Excel (separada con punto y coma, como la usa Excel en castellano)
  function downloadCsv(kind) {
    const list = (S.fb.users || []).filter((u) => kind === "todos" || u.ofertas);
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Nombre", "Mail", "Teléfono", "Acepta ofertas", "Pedidos", "Registrado"],
      ...list.map((u) => [u.nombre, u.email, u.telefono, u.ofertas ? "Sí" : "No", ordersOf(u).length, fdate(u.fecha)])];
    const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `titanware-clientes-${kind === "todos" ? "todos" : "ofertas"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- Administradores (en Ajustes) ---------- */
  function adminsCard() {
    const me = (A.user.email || "").toLowerCase(), list = S.fb.admins;
    return `
      <div class="panel-card" style="max-width:820px">
        <h2>Administradores</h2>
        <p>Estas cuentas pueden entrar al panel y ver los pedidos y los clientes. Cada uno ingresa desde la tienda con ese mismo mail (con Google, o con mail y contraseña) y le aparece el botón <em>Panel de administración</em>.</p>
        ${list ? `<ul class="adm-list">${list.map((e) => `
          <li><span class="acc-av">${esc(e.charAt(0).toUpperCase())}</span><span class="grow">${esc(e)}${e === me ? ' <small class="muted">(vos)</small>' : ""}</span>
          ${e === me ? "" : `<button class="ibtn danger" type="button" data-admdel="${esc(e)}" aria-label="Quitar a ${esc(e)}" title="Quitar">${U.trash}</button>`}</li>`).join("")}</ul>`
        : `<div class="empty-mini">Cargando…</div>`}
        <form id="admAdd" class="adm-add" novalidate>
          <input class="inp" name="email" type="email" placeholder="mail@ejemplo.com" autocomplete="off" aria-label="Mail del nuevo administrador" required>
          <button class="btn" type="submit">${U.plus} Agregar administrador</button>
        </form>
      </div>
      <div class="panel-card" style="max-width:820px;margin-top:1rem">
        <h2>Tu cuenta</h2>
        <p>Ingresaste como <strong>${esc(A.user.email)}</strong>.</p>
        <div class="row-actions"><button class="btn ghost" type="button" data-alogout>Cerrar sesión</button></div>
      </div>`;
  }

  async function logout() {
    if ((S.dirty.catalogo || S.dirty.pcs) && !confirm("Tenés cambios sin publicar. Si salís se pierden. ¿Salir igual?")) return;
    S.dirty = { catalogo: false, pcs: false };
    try { await A.logout(); } catch (err) { toast(err.message, false); }
  }

  document.addEventListener("click", async (e) => {
    const el = (s) => e.target.closest(s);
    let x;
    if ((x = el("[data-glogin]"))) {
      const err = $("#admLogin .auth-err");
      try { await A.loginGoogle(); } catch (ex) { if (!ex.silent && err) { err.textContent = ex.message; err.hidden = false; } }
      return;
    }
    if ((x = el("[data-aforgot]"))) {
      const email = ($("#admLogin [name=email]").value || "").trim(), err = $("#admLogin .auth-err");
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Escribí tu mail arriba y tocá de nuevo “¿Olvidaste tu contraseña?”."; err.hidden = false; return; }
      try { await A.resetPassword(email); toast("Te mandamos un mail para crear una contraseña nueva"); } catch (ex) { err.textContent = ex.message; err.hidden = false; }
      return;
    }
    if ((x = el("[data-averified]"))) {
      try { if (!(await A.checkVerified())) toast("Todavía no aparece verificado. Tocá el link del mail y probá de nuevo.", false); } catch (ex) { toast(ex.message, false); }
      return;
    }
    if ((x = el("[data-aresend]"))) { try { await A.resendVerification(); toast("Te mandamos el mail de nuevo"); } catch (ex) { toast(ex.message, false); } return; }
    if ((x = el("[data-alogout]")) || (x = el("#logoutBtn"))) { logout(); return; }
    if ((x = el("[data-fbreload]"))) { S.fb.orders = S.fb.users = null; renderTab(); loadFb("Datos actualizados"); return; }
    if ((x = el("[data-ofil]"))) { S.fb.f.estado = x.dataset.ofil; renderTab(); return; }
    if ((x = el("[data-uorders]"))) { S.fb.f = { q: x.dataset.uorders, estado: "" }; S.tab = "pedidos"; render(); return; }
    if ((x = el("[data-csv]"))) { downloadCsv(x.dataset.csv); return; }
    if ((x = el("[data-odel]"))) {
      const o = S.fb.orders.find((y) => y.id === x.dataset.odel);
      if (!o || !confirm(`¿Eliminar el pedido N° ${o.codigo} de ${o.nombre || o.email}? El cliente tampoco lo va a ver en su cuenta.`)) return;
      try { await A.admin.removeOrder(o.id); S.fb.orders = S.fb.orders.filter((y) => y !== o); render(); toast("Pedido eliminado"); } catch (ex) { toast(ex.message, false); }
      return;
    }
    if ((x = el("[data-udel]"))) {
      const u = S.fb.users.find((y) => y.uid === x.dataset.udel);
      if (!u || !confirm(`¿Borrar los datos de ${u.nombre || u.email}? Deja de aparecer en Clientes y en el Excel de ofertas. Sus pedidos quedan en la pestaña Pedidos.`)) return;
      try { await A.admin.removeUser(u.uid); S.fb.users = S.fb.users.filter((y) => y !== u); render(); toast("Datos del cliente borrados"); } catch (ex) { toast(ex.message, false); }
      return;
    }
    if ((x = el("[data-admdel]"))) {
      const email = x.dataset.admdel;
      if (!confirm(`¿Quitar a ${email} de los administradores? Ya no va a poder entrar al panel.`)) return;
      try { await A.admin.removeAdmin(email); S.fb.admins = S.fb.admins.filter((y) => y !== email); renderTab(); toast("Administrador quitado"); } catch (ex) { toast(ex.message, false); }
      return;
    }
    // Al volver a Pedidos o Clientes, se traen los datos nuevos si pasó más de un minuto
    if ((x = el('[data-tab="pedidos"], [data-tab="clientes"]')) && Date.now() - S.fb.at > 60000) loadFb();
  });

  document.addEventListener("submit", async (e) => {
    const f = e.target;
    if (f.id === "admLogin") {
      const v = Object.fromEntries(new FormData(f)), err = f.querySelector(".auth-err"), btn = f.querySelector("[type=submit]");
      err.hidden = true;
      if (!/^\S+@\S+\.\S+$/.test((v.email || "").trim()) || !v.pass) { err.textContent = "Escribí tu mail y tu contraseña."; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = "Ingresando…";
      try { await A.loginEmail(v.email, v.pass); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; }
      if (btn.isConnected) { btn.disabled = false; btn.textContent = "Ingresar"; }
    }
    if (f.id === "admAdd") {
      const email = (f.email.value || "").trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Escribí un mail válido.", false); return; }
      if ((S.fb.admins || []).includes(email)) { toast("Ese mail ya es administrador.", false); return; }
      try { await A.admin.addAdmin(email); S.fb.admins = [...(S.fb.admins || []), email].sort(); renderTab(); toast(`Listo: ${email} ya puede entrar al panel`); }
      catch (ex) { toast(ex.message, false); }
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "oq") { S.fb.f.q = e.target.value; renderOrderRows(); }
    if (e.target.id === "uq") { S.fb.uq = e.target.value; renderUserRows(); }
  });

  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (!t.dataset.ost) return;
    const o = S.fb.orders.find((y) => y.id === t.dataset.ost), prev = o.estado;
    t.disabled = true;
    try {
      await A.admin.setStatus(o.id, t.value);
      o.estado = t.value;
      render(); // actualiza el contador de la pestaña y los totales
      toast("Estado actualizado");
    } catch (ex) { t.value = prev; toast(ex.message, false); }
    t.disabled = false;
  });

  /* ---------- Inicio ---------- */
  (async function init() {
    updatePublish();
    // Con las cuentas activadas, el panel pide ingresar con un mail administrador
    if (A && A.enabled) {
      lockPanel(true);
      $("#app").innerHTML = `<div class="empty-mini">Cargando…</div>`;
      await A.ready;
      document.addEventListener("tw:auth", onAuthChange);
      onAuthChange();
      return;
    }
    if (S.conn.token) {
      try { await connect({}); return; }
      catch (err) { toast(`No se pudo conectar: ${err.message}`, false); }
    }
    render();
  })();
})();
