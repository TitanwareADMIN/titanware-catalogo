/* =========================================================
   CUENTAS DE CLIENTES (Firebase) — se completa UNA sola vez
   ---------------------------------------------------------
   1. En la consola de Firebase: ⚙ Configuración del proyecto →
      Tus apps → la app web → "Configuración del SDK" → Config.
   2. Reemplazá el bloque de abajo (desde "const firebaseConfig"
      hasta "};") por el que te muestra Firebase.
   Mientras esté vacío, la tienda funciona igual pero sin cuentas.
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBjUQ1rsuHUrSdkrPbH-ItssZ_g976F-4M",
  authDomain: "titanware-39823.firebaseapp.com",
  projectId: "titanware-39823",
  storageBucket: "titanware-39823.firebasestorage.app",
  messagingSenderId: "56724313524",
  appId: "1:56724313524:web:a096ecd7885842481ccee1"
};

window.TW_FIREBASE = firebaseConfig;
