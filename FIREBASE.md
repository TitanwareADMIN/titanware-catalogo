# Activar las cuentas de clientes (Firebase)

Se hace **una sola vez**, en unos 15 minutos. Es gratis (plan Spark, sin tarjeta).
Mientras no se haga, la tienda funciona igual que siempre, solo que sin cuentas.

> Conviene hacerlo con la **cuenta de Google del dueño de la tienda**: así el proyecto queda a su nombre.

## 1. Crear el proyecto

1. Entrar a <https://console.firebase.google.com> con la cuenta de Google del dueño.
2. **Crear un proyecto** → nombre: `Titanware` → Google Analytics: **desactivado** (no hace falta) → Crear.

## 2. Registrar la página web

1. En la pantalla del proyecto, tocar el ícono **`</>`** (Web).
2. Apodo: `Tienda`. **No** marcar Firebase Hosting → Registrar app.
3. Aparece un bloque que empieza con `const firebaseConfig = {`. **Copiarlo** (hasta el `};`).

## 3. Activar el ingreso

1. Menú izquierdo → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Método de acceso**:
   - **Correo electrónico/contraseña** → activar solo el primer interruptor → Guardar.
   - **Agregar proveedor nuevo → Google** → activar → elegir el mail de asistencia → Guardar.
3. Pestaña **Configuración → Dominios autorizados → Agregar dominio**:
   `valentinmz.github.io` (o el dominio propio de la tienda, si tiene uno; se pueden agregar los dos).

## 4. Crear la base de datos

1. Menú izquierdo → **Compilación → Firestore Database** → **Crear base de datos**.
2. Ubicación: **`southamerica-east1 (São Paulo)`** → Siguiente.
3. Elegir **modo de producción** → Crear.
4. Pestaña **Reglas**: borrar todo lo que hay, pegar el contenido del archivo
   [`firestore.rules`](firestore.rules) de este repositorio y tocar **Publicar**.

## 5. Cargar al primer administrador

1. En Firestore, pestaña **Datos** → **Iniciar colección**.
2. ID de la colección: `admins` → Siguiente.
3. ID del documento: **el mail del dueño, en minúsculas** (ej. `titanware@gmail.com`).
4. Campo: `nombre` · tipo `string` · valor: `Dueño` → Guardar.

Los demás administradores (empleados, etc.) se agregan después desde el panel: **Ajustes → Administradores**.

## 6. Conectar la página con Firebase

1. En GitHub, abrir el archivo [`assets/js/firebase-config.js`](assets/js/firebase-config.js) → ícono del lápiz (Editar).
2. Reemplazar el bloque `const firebaseConfig = { … };` por el que se copió en el paso 2.
3. **Commit changes**. En 1 o 2 minutos la tienda ya tiene cuentas.

> Esos datos (apiKey, etc.) **no son secretos**: Firebase los hace públicos a propósito. Lo que protege la información son las reglas del paso 4.

## 7. Probar

1. Abrir la tienda → **Ingresar** → **Continuar con Google** con el mail del dueño.
2. En el menú de la cuenta aparece **Panel de administración**.
3. La primera vez, el panel pide conectar GitHub (el token de siempre). Queda guardado en la cuenta: después ningún administrador lo tiene que volver a cargar.
4. Hacer un pedido de prueba estando logueado: tiene que aparecer en **Mi cuenta → Mis pedidos** y en el panel, en **Pedidos**.

## Cómo se usa después

- **Pedidos:** cada pedido que un cliente logueado manda por WhatsApp aparece con su N° (el mismo que figura en el mensaje). Se le cambia el estado: Nuevo → Respondido → Vendido (o Cancelado).
- **Clientes:** lista de registrados. **Descargar mails para ofertas** baja un Excel con los que aceptaron recibir promociones.
- **Administradores:** en Ajustes. Para que alguien entre al panel, se agrega su mail. Si entra con mail y contraseña, tiene que verificar el mail (le llega un link).

## Si algo no anda

| Mensaje | Qué hacer |
|---|---|
| "Esta página no está autorizada en Firebase" | Falta el dominio en Authentication → Configuración → Dominios autorizados (paso 3.3). |
| "Este método de ingreso no está activado" | Activar Correo/contraseña o Google (paso 3.2). |
| "No tenés permiso para hacer esto" | Revisar que las reglas estén publicadas (paso 4.4) y que el mail esté en `admins` en minúsculas (paso 5). |
| "No tenés acceso al panel" | Ese mail no está en `admins`. Agregarlo (paso 5 o Ajustes → Administradores). |
| No llegan los mails de verificación o de contraseña | Revisar spam. Salen de `noreply@…firebaseapp.com`. |
