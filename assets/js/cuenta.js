/* =========================================================
   Titanware · Mi cuenta (tienda)
   Botón de cuenta del header, ventana de ingreso / registro,
   y la página #/cuenta con los datos y los pedidos del cliente.
   ========================================================= */
(function () {
  const A = TW.auth, U = TW.UI, esc = TW.esc, NEG = window.TW_CONFIG.negocio;
  const $ = (s, r = document) => r.querySelector(s);
  const toast = (m) => TW.shop && TW.shop.toast(m);
  const onCuenta = () => /^#\/?cuenta/.test(location.hash);
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    bag: svg('<path d="M6 7h12l1 14H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/>'),
    panel: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    out: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  };
  const ESTADO = { nuevo: "Recibido", respondido: "Respondido", vendido: "Concretado", cancelado: "Cancelado" };
  const fdate = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const IN_APP = () => /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|TikTok|musical_ly|Snapchat/i.test(navigator.userAgent || "");
  const IN_APP_MSG = "Estás en el navegador de Instagram o Facebook, y ahí Google no deja ingresar. Tocá los tres puntitos (···) → <b>Abrir en el navegador</b>, o ingresá con tu mail y contraseña.";

  let booted = !A.enabled;
  let orders = null, ordersFor = "", ordersErr = "";

  /* ---------- Botón del header ---------- */
  function header() {
    const box = $("#acct"); if (!box) return;
    box.hidden = !A.enabled || A.failed;
    if (box.hidden) return;
    const u = A.user, btn = $("#acctBtn");
    $("#acctName").textContent = u ? A.firstName() : "Ingresar";
    btn.classList.toggle("in", !!u);
    btn.setAttribute("aria-label", u ? `Tu cuenta (${u.email})` : "Ingresar o crear cuenta");
    const m = $("#acctMenu");
    if (!u) { closeMenu(); m.innerHTML = ""; return; }
    m.innerHTML = `
      <div class="am-head"><span class="acc-av">${esc(A.firstName().charAt(0).toUpperCase() || "?")}</span><div><strong>${esc(A.firstName())}</strong><small>${esc(u.email)}</small></div></div>
      <a href="#/cuenta" role="menuitem">${ICON.user} Mi cuenta</a>
      <a href="#/cuenta/pedidos" role="menuitem">${ICON.bag} Mis pedidos</a>
      ${A.isAdmin ? `<a class="am-admin" href="admin.html" role="menuitem">${ICON.panel} Panel de administración</a>` : ""}
      <button type="button" role="menuitem" data-logout>${ICON.out} Cerrar sesión</button>`;
  }
  const openMenu = () => { $("#acctMenu").hidden = false; $("#acctBtn").setAttribute("aria-expanded", "true"); };
  function closeMenu() { const m = $("#acctMenu"); if (m) m.hidden = true; const b = $("#acctBtn"); if (b) b.setAttribute("aria-expanded", "false"); }

  /* ---------- Ventana de ingreso ---------- */
  let afterLogin = null; // qué hacer cuando termina de ingresar (por ejemplo, volver al carrito)

  function openAuth(mode = "login", note = "") {
    const m = $("#modal");
    m.className = "auth-dlg";
    m.innerHTML = `<button class="close" type="button" aria-label="Cerrar" data-close>${U.close}</button><div class="auth">${authBody(mode, note)}</div>`;
    if (!m.open) m.showModal();
    const first = m.querySelector("form input:not([type=checkbox])");
    if (first) first.focus();
  }

  function authBody(mode, note) {
    const top = (t, p) => `<div class="auth-top"><img src="img/logo/emblema.png" alt="" width="65" height="34"><h2 id="mTitle">${t}</h2><p>${p}</p></div>`;
    const err = `<p class="auth-err" role="alert" hidden></p>`;
    if (mode === "reset") return `
      ${top("Recuperá tu contraseña", "Te mandamos un mail con un link para crear una contraseña nueva.")}
      <form id="authReset" class="auth-form" novalidate>
        <label class="o-fld">Mail<input name="email" type="email" autocomplete="email" required></label>
        ${err}
        <button class="btn block" type="submit">Mandarme el link</button>
        <button class="linkish back" type="button" data-auth="login">Volver a ingresar</button>
      </form>`;
    if (mode === "datos") return `
      ${top(`¡Bienvenido${A.firstName() ? ", " + esc(A.firstName()) : ""}!`, "Un último paso para que tus pedidos lleguen con tus datos.")}
      <form id="authDatos" class="auth-form" novalidate>
        <label class="o-fld"><span>WhatsApp / teléfono <small>(opcional)</small></span><input name="telefono" type="tel" autocomplete="tel" maxlength="30" placeholder="11 2345-6789"></label>
        <label class="chk"><input type="checkbox" name="ofertas"> Quiero recibir ofertas y novedades por mail</label>
        ${err}
        <button class="btn block" type="submit">Guardar</button>
        <button class="linkish back" type="button" data-close>Ahora no</button>
      </form>`;
    const reg = mode === "registro";
    const inApp = IN_APP();
    return `
      ${top(reg ? "Creá tu cuenta" : "Ingresá a tu cuenta", note ? esc(note) : reg ? "Guardá tus pedidos y tus datos para comprar más rápido." : "Mirá tus pedidos y comprá más rápido.")}
      <div class="auth-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${!reg}" data-auth="login">Ingresar</button>
        <button type="button" role="tab" aria-selected="${reg}" data-auth="registro">Crear cuenta</button>
      </div>
      <button class="gbtn" type="button" data-google>${ICON.google} Continuar con Google</button>
      ${inApp ? `<p class="auth-inapp">${U.warn}<span>${IN_APP_MSG}</span></p>` : ""}
      <div class="auth-or"><span>o con tu mail</span></div>
      ${reg ? `
      <form id="authReg" class="auth-form" novalidate>
        <label class="o-fld">Nombre y apellido<input name="nombre" autocomplete="name" maxlength="80" required></label>
        <label class="o-fld">Mail<input name="email" type="email" autocomplete="email" required></label>
        <label class="o-fld"><span>WhatsApp / teléfono <small>(opcional)</small></span><input name="telefono" type="tel" autocomplete="tel" maxlength="30" placeholder="11 2345-6789"></label>
        <label class="o-fld">Contraseña<input name="pass" type="password" autocomplete="new-password" minlength="6" placeholder="Mínimo 6 caracteres" required></label>
        <label class="chk"><input type="checkbox" name="ofertas"> Quiero recibir ofertas y novedades por mail</label>
        ${err}
        <button class="btn block" type="submit">Crear cuenta</button>
      </form>` : `
      <form id="authLogin" class="auth-form" novalidate>
        <label class="o-fld">Mail<input name="email" type="email" autocomplete="email" required></label>
        <label class="o-fld">Contraseña<input name="pass" type="password" autocomplete="current-password" required></label>
        <button class="linkish forgot" type="button" data-auth="reset">¿Olvidaste tu contraseña?</button>
        ${err}
        <button class="btn block" type="submit">Ingresar</button>
      </form>`}
      <p class="auth-fine">${U.shield} Usamos tus datos solo para tus pedidos en ${esc(NEG.nombre)}. No los compartimos con nadie.</p>`;
  }

  function showErr(form, msg) { const p = form && form.querySelector(".auth-err"); if (p) { p.innerHTML = msg === IN_APP_MSG ? msg : esc(msg); p.hidden = !msg; } }
  function busy(form, on) {
    const b = form.querySelector("[type=submit]"); if (!b) return;
    if (on) { b.dataset.label = b.textContent; b.textContent = "Un momento…"; } else if (b.dataset.label) b.textContent = b.dataset.label;
    b.disabled = on;
  }
  function welcome(nuevo) {
    const m = $("#modal");
    if (nuevo) { openAuth("datos"); return; }
    if (m.open) m.close();
    toast(`¡Hola, ${A.firstName()}!`);
    const fn = afterLogin; afterLogin = null; if (fn) fn();
  }

  async function google() {
    const form = $("#modal .auth-form");
    // Google no deja ingresar desde el navegador interno de Instagram / Facebook
    if (IN_APP()) { showErr(form, IN_APP_MSG); return; }
    try { const r = await A.loginGoogle(); welcome(r && r.nuevo); }
    catch (e) { if (!e.silent) showErr(form, e.message); }
  }

  document.addEventListener("submit", async (e) => {
    const f = e.target;
    if (!["authLogin", "authReg", "authReset", "authDatos", "accDatos"].includes(f.id)) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const email = (v.email || "").trim();
    showErr(f, "");
    if ((f.id === "authLogin" || f.id === "authReg" || f.id === "authReset") && !/^\S+@\S+\.\S+$/.test(email)) { showErr(f, "Escribí un mail válido."); return; }
    if (f.id === "authLogin" && !v.pass) { showErr(f, "Escribí tu contraseña."); return; }
    if (f.id === "authReg" && !(v.nombre || "").trim()) { showErr(f, "Escribí tu nombre."); return; }
    if (f.id === "authReg" && (v.pass || "").length < 6) { showErr(f, "La contraseña tiene que tener al menos 6 caracteres."); return; }
    if (f.id === "accDatos" && !(v.nombre || "").trim()) { toast("Escribí tu nombre."); return; }
    busy(f, true);
    try {
      if (f.id === "authLogin") { await A.loginEmail(email, v.pass); welcome(false); }
      if (f.id === "authReg") {
        await A.register({ nombre: v.nombre.trim(), email, pass: v.pass, telefono: (v.telefono || "").trim(), ofertas: !!v.ofertas });
        $("#modal").close();
        toast("¡Listo! Tu cuenta está creada. Te mandamos un mail para verificarla.");
        const fn = afterLogin; afterLogin = null; if (fn) fn();
      }
      if (f.id === "authReset") {
        await A.resetPassword(email);
        f.outerHTML = `<div class="auth-ok">${ICON.mail}<p>Listo: si <b>${esc(email)}</b> tiene una cuenta, te llega un mail para crear una contraseña nueva. Revisá también la carpeta de spam.</p><button class="btn block" type="button" data-auth="login">Volver a ingresar</button></div>`;
        return;
      }
      if (f.id === "authDatos") {
        await A.saveProfile({ nombre: (A.profile && A.profile.nombre) || A.user.displayName || "", telefono: v.telefono, ofertas: !!v.ofertas });
        $("#modal").close(); toast("¡Listo! Guardamos tus datos.");
        const fn = afterLogin; afterLogin = null; if (fn) fn();
      }
      if (f.id === "accDatos") { await A.saveProfile({ nombre: v.nombre, telefono: v.telefono, ofertas: !!v.ofertas }); toast("Guardamos tus datos"); }
    } catch (err) {
      if (f.id === "accDatos") toast(err.message); else showErr(f, err.message);
    }
    if (f.isConnected) busy(f, false);
  });

  document.addEventListener("click", async (e) => {
    const el = (s) => e.target.closest(s);
    let x;
    if ((x = el("#acctBtn"))) {
      await A.ready;
      if (!A.user) { openAuth("login"); return; }
      if ($("#acctMenu").hidden) openMenu(); else closeMenu();
      return;
    }
    if (!el("#acct")) closeMenu();
    else if (el("#acctMenu a")) closeMenu();
    if ((x = el("[data-auth-open]"))) {
      if (x.dataset.after === "pedido") afterLogin = () => { location.hash = "#/pedido"; };
      openAuth(x.dataset.authOpen);
      return;
    }
    if ((x = el("[data-auth]"))) { openAuth(x.dataset.auth); return; }
    if ((x = el("[data-google]"))) { google(); return; }
    if ((x = el("[data-logout]"))) {
      closeMenu();
      try { await A.logout(); toast("Cerraste sesión"); } catch (err) { toast(err.message); }
      return;
    }
    if ((x = el("[data-resend]"))) { try { await A.resendVerification(); toast("Te mandamos de nuevo el mail de verificación"); } catch (err) { toast(err.message); } return; }
    if ((x = el("[data-verified]"))) {
      try { toast((await A.checkVerified()) ? "¡Mail verificado!" : "Todavía no aparece verificado. Tocá el link del mail y probá de nuevo."); } catch (err) { toast(err.message); }
      return;
    }
    if ((x = el("[data-reorder]"))) { reorder(x.dataset.reorder); return; }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  /* ---------- Página Mi cuenta ---------- */
  function render(arg) {
    const root = $("#cuenta"); if (!root) return;
    if (!A.enabled) {
      root.innerHTML = `<div class="empty"><strong>Las cuentas todavía no están activadas</strong>Podés comprar igual: armá tu carrito y mandanos el pedido por WhatsApp.<div class="actions"><a class="btn" href="#/catalogo">Ver catálogo</a></div></div>`;
      return;
    }
    if (A.failed) {
      root.innerHTML = `<div class="empty"><strong>No pudimos conectar con tu cuenta</strong>Revisá tu conexión y recargá la página.<div class="actions"><button class="btn" type="button" onclick="location.reload()">Recargar</button></div></div>`;
      return;
    }
    if (!booted) { root.innerHTML = `<div class="empty-mini acc-load">Cargando tu cuenta…</div>`; return; }
    const u = A.user;
    if (!u) {
      root.innerHTML = `
        <div class="o-card acc-guest">
          <span class="acc-ico">${ICON.user}</span>
          <h2>Ingresá a tu cuenta</h2>
          <ul class="acc-perks">
            <li>${U.check} Todos tus pedidos guardados en un solo lugar</li>
            <li>${U.check} Tus datos cargados para pedir más rápido</li>
            <li>${U.check} Volvé a pedir lo mismo con un clic</li>
          </ul>
          <div class="actions"><button class="btn" type="button" data-auth-open="login">Ingresar</button><button class="btn ghost" type="button" data-auth-open="registro">Crear cuenta</button></div>
        </div>`;
      return;
    }
    if (ordersFor !== u.uid) loadOrders();
    const p = A.profile || {};
    const byPassword = u.providerData.some((x) => x.providerId === "password");
    root.innerHTML = `
      <div class="acc-layout">
        <aside class="o-card acc-side">
          <div class="acc-me"><span class="acc-av lg">${esc(A.firstName().charAt(0).toUpperCase() || "?")}</span><div><strong>${esc(p.nombre || u.displayName || A.firstName())}</strong><small>${esc(u.email)}</small></div></div>
          ${byPassword && !u.emailVerified ? `<div class="acc-note">${U.warn}<div>Verificá tu mail: te mandamos un link a <b>${esc(u.email)}</b>.<span><button class="linkish" type="button" data-verified>Ya lo verifiqué</button> · <button class="linkish" type="button" data-resend>Reenviar mail</button></span></div></div>` : ""}
          ${A.adminPending ? `<div class="acc-note">${U.warn}<div>Tu mail es administrador. Verificalo para entrar al panel.</div></div>` : ""}
          ${A.isAdmin ? `<a class="btn block acc-admin" href="admin.html">${ICON.panel} Panel de administración</a>` : ""}
          <form id="accDatos" class="auth-form" novalidate>
            <h3>Mis datos</h3>
            <label class="o-fld">Nombre y apellido<input name="nombre" autocomplete="name" maxlength="80" value="${esc(p.nombre || u.displayName || "")}" required></label>
            <label class="o-fld">Mail<input value="${esc(u.email)}" disabled></label>
            <label class="o-fld">WhatsApp / teléfono<input name="telefono" type="tel" autocomplete="tel" maxlength="30" value="${esc(p.telefono || "")}" placeholder="11 2345-6789"></label>
            <label class="chk"><input type="checkbox" name="ofertas"${p.ofertas ? " checked" : ""}> Quiero recibir ofertas y novedades por mail</label>
            <button class="btn ghost block" type="submit">Guardar cambios</button>
          </form>
          <button class="btn ghost block acc-out" type="button" data-logout>${ICON.out} Cerrar sesión</button>
        </aside>
        <section class="o-card acc-orders" id="misPedidos">
          <div class="o-head"><div><h2>Mis pedidos</h2><p>Lo que nos mandaste por WhatsApp con tu cuenta iniciada.</p></div></div>
          ${ordersHtml()}
        </section>
      </div>`;
    if (arg === "pedidos") requestAnimationFrame(() => $("#misPedidos").scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function ordersHtml() {
    if (orders === null) return `<div class="empty-mini">Cargando tus pedidos…</div>`;
    if (ordersErr) return `<div class="empty-mini">${esc(ordersErr)}</div>`;
    if (!orders.length) return `<div class="cart-empty">${ICON.bag}<strong>Todavía no hiciste pedidos con tu cuenta</strong>Cuando mandes un pedido por WhatsApp estando logueado, lo vas a ver acá.<br><a class="btn" href="#/catalogo">Ver catálogo</a></div>`;
    return `<div class="ords">${orders.map((o) => `
      <article class="ord">
        <header>
          <div><strong>Pedido N° ${esc(o.codigo || o.id.slice(0, 6).toUpperCase())}</strong><small>${fdate(o.fecha)} · ${o.origen === "armador" ? "Armado a medida" : "Carrito"}</small></div>
          <span class="st st-${esc(o.estado)}">${esc(ESTADO[o.estado] || o.estado)}</span>
        </header>
        <ul class="ord-items">${(o.items || []).map((i) => `
          <li><span>${i.cant > 1 ? `${i.cant}x ` : ""}${esc(i.titulo)}${(i.detalle || []).length ? `<details><summary>${i.detalle.length} componentes</summary><ul>${i.detalle.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>` : ""}</span><b>${i.precio ? TW.money(i.precio * (i.cant || 1)) : "Consultar"}</b></li>`).join("")}
        </ul>
        <footer>
          <span>Total <strong>${TW.money(o.total)}</strong></span>
          <div class="btns">
            <a class="btn sm wa" href="${TW.waLink(`Hola ${NEG.nombre}! Quería consultar por mi pedido N° ${o.codigo || ""}.`)}" target="_blank" rel="noopener">${U.wa} Consultar</a>
            ${(o.items || []).some((i) => i.ref) ? `<button class="btn sm ghost" type="button" data-reorder="${esc(o.id)}">${U.redo} Volver a pedir</button>` : ""}
          </div>
        </footer>
      </article>`).join("")}</div>`;
  }

  async function loadOrders() {
    const uid = A.user && A.user.uid; if (!uid) return;
    ordersFor = uid; orders = null; ordersErr = "";
    try { orders = await A.myOrders(); } catch (e) { orders = []; ordersErr = e.message; }
    if (ordersFor === uid && onCuenta()) render();
  }

  // Vuelve a cargar el pedido en el carrito (con los precios de hoy)
  function reorder(id) {
    const o = (orders || []).find((x) => x.id === id); if (!o) return;
    let n = 0;
    for (const i of o.items || []) if (i.ref && i.ref.type) { TW.cart.add({ ...i.ref, qty: i.cant || 1 }); n++; }
    if (!n) { toast("No pudimos cargar ese pedido."); return; }
    location.hash = "#/pedido";
    toast("Cargamos el pedido en tu carrito, con los precios de hoy");
  }

  /* ---------- Cambios de sesión ---------- */
  document.addEventListener("tw:auth", () => {
    if (!A.user) { orders = null; ordersFor = ""; }
    header();
    if (onCuenta()) render();
  });
  A.ready.then(() => { booted = true; header(); if (onCuenta()) render(); });
  header();

  TW.cuenta = { render, openAuth, invalidate() { orders = null; ordersFor = ""; if (onCuenta()) render(); } };
})();
