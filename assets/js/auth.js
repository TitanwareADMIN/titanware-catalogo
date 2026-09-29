/* =========================================================
   Titanware · cuentas y pedidos (Firebase Auth + Firestore)
   Lo usan la tienda (Mi cuenta) y el panel (Pedidos, Clientes).
   Datos en Firestore:
     usuarios/{uid}   nombre, email, telefono, ofertas
     pedidos/{id}     lo que el cliente mandó por WhatsApp estando logueado
     admins/{email}   mails con acceso al panel
     ajustes/{clave}  configuración del panel (solo administradores)
   Los permisos reales están en firestore.rules (se pegan en la consola de Firebase).
   ========================================================= */
(function () {
  const TW = (window.TW = window.TW || {});
  const CFG = window.TW_FIREBASE || {};
  const SDK = window.TW_FIREBASE_SDK || "https://www.gstatic.com/firebasejs/12.3.0/"; // TW_FIREBASE_SDK: solo para pruebas locales
  const A = (TW.auth = {
    enabled: !!(CFG.apiKey && CFG.projectId),
    failed: false, // no se pudo cargar Firebase (sin internet, config mal pegada…)
    user: null, profile: null, isAdmin: false, adminPending: false,
  });
  let F = null; // { au, fs, auth, db }

  const emit = () => document.dispatchEvent(new CustomEvent("tw:auth"));
  const lower = (s) => String(s || "").trim().toLowerCase();

  async function boot() {
    const [app, au, fs] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")]);
    const inst = app.initializeApp(CFG);
    const auth = au.getAuth(inst);
    auth.languageCode = "es";
    F = { au, fs, auth, db: fs.getFirestore(inst) };
    await new Promise((ready) => {
      let first = true;
      au.onAuthStateChanged(auth, async (u) => {
        await load(u);
        emit();
        if (first) { first = false; ready(); }
      });
    });
  }

  // Perfil y permiso de administrador del usuario actual
  async function load(u) {
    A.user = u || null; A.profile = null; A.isAdmin = false; A.adminPending = false;
    if (!u) return;
    const { fs, db } = F;
    try { const s = await fs.getDoc(fs.doc(db, "usuarios", u.uid)); A.profile = s.exists() ? s.data() : null; } catch (e) { console.warn(e); }
    if (u.email) {
      try {
        const s = await fs.getDoc(fs.doc(db, "admins", lower(u.email)));
        // Un admin que entró con mail y contraseña tiene que verificar el mail (si no, cualquiera podría registrarse con ese mail)
        A.isAdmin = s.exists() && u.emailVerified;
        A.adminPending = s.exists() && !u.emailVerified;
      } catch (e) { console.warn(e); }
    }
  }

  A.ready = A.enabled
    ? boot().catch((e) => { console.error("Firebase:", e); A.failed = true; emit(); })
    : Promise.resolve();

  /* ---------- Errores en castellano ---------- */
  const MSG = {
    "auth/invalid-email": "El mail no es válido.",
    "auth/missing-email": "Escribí tu mail.",
    "auth/missing-password": "Escribí tu contraseña.",
    "auth/user-not-found": "Mail o contraseña incorrectos.",
    "auth/wrong-password": "Mail o contraseña incorrectos.",
    "auth/invalid-credential": "Mail o contraseña incorrectos.",
    "auth/invalid-login-credentials": "Mail o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya hay una cuenta con ese mail. Ingresá o recuperá tu contraseña.",
    "auth/weak-password": "La contraseña tiene que tener al menos 6 caracteres.",
    "auth/password-does-not-meet-requirements": "La contraseña tiene que tener al menos 6 caracteres.",
    "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
    "auth/user-disabled": "Esta cuenta está deshabilitada.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes y probá de nuevo.",
    "auth/network-request-failed": "No hay conexión. Revisá tu internet y probá de nuevo.",
    "auth/unauthorized-domain": "Esta página no está autorizada en Firebase (Authentication → Configuración → Dominios autorizados).",
    "auth/operation-not-allowed": "Este método de ingreso no está activado en Firebase (Authentication → Método de acceso).",
    "auth/configuration-not-found": "El ingreso no está activado en Firebase (Authentication → Comenzar).",
    "auth/account-exists-with-different-credential": "Ese mail ya está registrado con otro método. Ingresá con tu mail y contraseña.",
    "auth/requires-recent-login": "Por seguridad, volvé a ingresar y probá de nuevo.",
    "permission-denied": "No tenés permiso para hacer esto.",
    "unavailable": "No hay conexión. Revisá tu internet y probá de nuevo.",
  };
  const SILENT = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);
  function friendly(e) {
    const code = (e && e.code) || "";
    const err = new Error(MSG[code] || (e && e.friendly ? e.message : "Algo salió mal. Probá de nuevo en un momento."));
    err.code = code; err.silent = SILENT.has(code); err.friendly = true;
    if (!MSG[code] && !(e && e.friendly)) console.error(e);
    return err;
  }
  const fail = (msg) => Object.assign(new Error(msg), { friendly: true });

  // Espera a Firebase, corre la acción y traduce los errores
  const run = (fn) => async (...args) => {
    await A.ready;
    if (!F) throw friendly(fail(A.enabled ? "No se pudo conectar con el servidor de cuentas. Recargá la página." : "Las cuentas todavía no están activadas."));
    try { return await fn(F, ...args); } catch (e) { throw friendly(e); }
  };
  // Firestore no acepta undefined: se limpia todo antes de guardar
  const plain = (o) => JSON.parse(JSON.stringify(o));
  const toObj = (d) => { const x = d.data(); return { id: d.id, ...x, fecha: x.creado && x.creado.toDate ? x.creado.toDate() : new Date() }; };
  const byDate = (a, b) => b.fecha - a.fecha;

  async function refresh() { await load(F.auth.currentUser); emit(); }

  /* ---------- Ingreso ---------- */
  A.loginEmail = run(async ({ au, auth }, email, pass) => { await au.signInWithEmailAndPassword(auth, String(email).trim(), pass); });

  A.register = run(async ({ au, fs, auth, db }, { nombre, email, pass, telefono, ofertas }) => {
    const { user } = await au.createUserWithEmailAndPassword(auth, String(email).trim(), pass);
    await au.updateProfile(user, { displayName: nombre });
    await fs.setDoc(fs.doc(db, "usuarios", user.uid), {
      nombre: nombre.slice(0, 80), email: user.email, telefono: (telefono || "").slice(0, 30), ofertas: !!ofertas,
      creado: fs.serverTimestamp(), actualizado: fs.serverTimestamp(),
    });
    au.sendEmailVerification(user).catch(() => {});
    await refresh();
  });

  // Devuelve { nuevo: true } la primera vez, para pedirle el teléfono y si quiere recibir ofertas
  A.loginGoogle = run(async ({ au, fs, auth, db }) => {
    const { user } = await au.signInWithPopup(auth, new au.GoogleAuthProvider());
    const ref = fs.doc(db, "usuarios", user.uid);
    const s = await fs.getDoc(ref);
    if (s.exists()) return { nuevo: false };
    await fs.setDoc(ref, {
      nombre: (user.displayName || "").slice(0, 80), email: user.email, telefono: "", ofertas: false,
      creado: fs.serverTimestamp(), actualizado: fs.serverTimestamp(),
    });
    await refresh();
    return { nuevo: true };
  });

  A.resetPassword = run(async ({ au, auth }, email) => { await au.sendPasswordResetEmail(auth, String(email).trim()); });
  A.resendVerification = run(async ({ au, auth }) => { if (auth.currentUser) await au.sendEmailVerification(auth.currentUser); });
  // Después de tocar el link del mail de verificación
  A.checkVerified = run(async ({ auth }) => {
    const u = auth.currentUser; if (!u) return false;
    await u.reload(); await u.getIdToken(true); await refresh();
    return u.emailVerified;
  });
  A.logout = run(async ({ au, auth }) => { await au.signOut(auth); });

  A.saveProfile = run(async ({ au, fs, auth, db }, { nombre, telefono, ofertas }) => {
    const u = auth.currentUser; if (!u) throw fail("Tu sesión se cerró. Volvé a ingresar.");
    await fs.setDoc(fs.doc(db, "usuarios", u.uid), {
      nombre: String(nombre || "").trim().slice(0, 80), email: u.email, telefono: String(telefono || "").trim().slice(0, 30), ofertas: !!ofertas,
      actualizado: fs.serverTimestamp(),
    }, { merge: true });
    if (nombre && nombre !== u.displayName) await au.updateProfile(u, { displayName: nombre }).catch(() => {});
    await refresh();
  });

  A.firstName = () => {
    const n = (A.profile && A.profile.nombre) || (A.user && A.user.displayName) || "";
    return n.trim().split(/\s+/)[0] || (A.user && A.user.email ? A.user.email.split("@")[0] : "");
  };

  /* ---------- Pedidos del cliente ---------- */
  // Código corto para identificar el pedido en el chat de WhatsApp (sin letras que se confunden)
  A.newCode = () => { const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };

  A.saveOrder = run(async ({ fs, auth, db }, o) => {
    const u = auth.currentUser; if (!u) return null;
    const p = A.profile || {};
    const data = plain({
      uid: u.uid, codigo: o.codigo, nombre: p.nombre || u.displayName || "", email: u.email || "", telefono: p.telefono || "",
      items: o.items.slice(0, 100), total: Number(o.total) || 0, nota: (o.nota || "").slice(0, 1000), origen: o.origen, estado: "nuevo",
    });
    const ref = await fs.addDoc(fs.collection(db, "pedidos"), { ...data, creado: fs.serverTimestamp() });
    return ref.id;
  });

  A.myOrders = run(async ({ fs, auth, db }) => {
    const u = auth.currentUser; if (!u) return [];
    const s = await fs.getDocs(fs.query(fs.collection(db, "pedidos"), fs.where("uid", "==", u.uid)));
    return s.docs.map(toObj).sort(byDate);
  });

  /* ---------- Panel (solo administradores; Firestore lo controla con las reglas) ---------- */
  A.admin = {
    orders: run(async ({ fs, db }) => (await fs.getDocs(fs.query(fs.collection(db, "pedidos"), fs.orderBy("creado", "desc"), fs.limit(2000)))).docs.map(toObj)),
    setStatus: run(async ({ fs, db }, id, estado) => { await fs.updateDoc(fs.doc(db, "pedidos", id), { estado, actualizado: fs.serverTimestamp() }); }),
    removeOrder: run(async ({ fs, db }, id) => { await fs.deleteDoc(fs.doc(db, "pedidos", id)); }),
    users: run(async ({ fs, db }) => (await fs.getDocs(fs.collection(db, "usuarios"))).docs.map((d) => ({ ...toObj(d), uid: d.id })).sort(byDate)),
    admins: run(async ({ fs, db }) => (await fs.getDocs(fs.collection(db, "admins"))).docs.map((d) => d.id).sort()),
    addAdmin: run(async ({ fs, auth, db }, email) => {
      await fs.setDoc(fs.doc(db, "admins", lower(email)), { agregadoPor: auth.currentUser.email, creado: fs.serverTimestamp() });
    }),
    removeAdmin: run(async ({ fs, db }, email) => { await fs.deleteDoc(fs.doc(db, "admins", email)); }),
    getSetting: run(async ({ fs, db }, key) => { const s = await fs.getDoc(fs.doc(db, "ajustes", key)); return s.exists() ? s.data() : null; }),
    setSetting: run(async ({ fs, db }, key, value) => { await fs.setDoc(fs.doc(db, "ajustes", key), plain(value)); }),
    delSetting: run(async ({ fs, db }, key) => { await fs.deleteDoc(fs.doc(db, "ajustes", key)); }),
  };
})();
