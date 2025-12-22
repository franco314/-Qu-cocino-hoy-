# Instrucciones para Ejecutar el Proyecto Localmente

## Resumen Rápido

Necesitas **2 terminales abiertas simultáneamente**:
1. **Terminal 1:** Frontend (Vite)
2. **Terminal 2:** Emulador de Firebase (Backend)

---

## Paso a Paso

### Terminal 1: Iniciar el Frontend

```bash
cd "c:\Users\rolda\Downloads\-Que-cocino-hoy\-Qu-cocino-hoy--main"
npm run dev
```

Deberías ver:
```
  VITE v6.4.1  ready in 409 ms

  ➜  Local:   http://localhost:3000/
```

Copia la URL y abre en el navegador.

---

### Terminal 2: Iniciar el Emulador de Firebase

```bash
cd "c:\Users\rolda\Downloads\-Que-cocino-hoy\-Qu-cocino-hoy--main\functions"
npm run build
cd ..
firebase emulators:start --only functions
```

Deberías ver:
```
+  functions[us-central1-generateRecipes]: http function initialized (http://127.0.0.1:5001/...)

┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
└─────────────────────────────────────────────────────────────┘
```

---

## Verificar que Todo Funciona

1. En el navegador (`http://localhost:3000/`), abre la **Consola (F12 > Console)**
2. Deberías ver: `🔧 Connected to Firebase Functions Emulator`
3. En la esquina inferior derecha, verás los botones:
   - **Modo Free** (verde)
   - **Modo Premium** (naranja)

---

## Probar el Cambio Free ↔ Premium

1. **Selecciona ingredientes** (ej: tomate, cebolla, ajo)
2. Haz clic en **"Generar Receta"**
3. Verifica en **Terminal 2** los logs:
   - Si está en **Free**: `🌑 [BACKEND] Skipping image generation for Free user`
   - Si está en **Premium**: `✨ [BACKEND] Generating image for Premium user`

---

## Cambios que se Vieron Reflejados

Ahora cuando cambies entre Free y Premium, la botonera funciona correctamente porque:
- ✅ El frontend envía `isPremium: true/false` a las Cloud Functions
- ✅ El emulador recibe el parámetro y decide si genera imagen o no
- ✅ En modo Free: solo genera **texto**
- ✅ En modo Premium: genera **texto + imagen**

---

## Troubleshooting

### ❌ "ERR_CONNECTION_REFUSED en puerto 5001"
**Solución:** Asegúrate de haber iniciado el emulador en Terminal 2

### ❌ "firebase: command not found"
**Solución:** Instala Firebase CLI globalmente
```bash
npm install -g firebase-tools
```

### ❌ "GEMINI_API_KEY not found"
**Solución:** Verifica que exista el archivo `functions/.secret.local` con tu API key

### ❌ El frontend no se conecta al emulador
**Solución:** Asegúrate de estar en `http://localhost:3000/` (no en otro puerto)

---

## Parar Todo

Presiona **Ctrl+C** en ambas terminales cuando quieras parar el desarrollo.

