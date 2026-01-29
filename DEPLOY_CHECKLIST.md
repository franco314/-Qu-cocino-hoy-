# 🚀 Checklist de Deploy Manual

**Úsalo cada vez que hayas hecho cambios y quieras desplegar a producción.**

---

## ✅ ANTES de desplegar

- [ ] Hice todos los cambios necesarios
- [ ] El código funciona en local (`npm run dev`)
- [ ] Probé los cambios en http://localhost:5000 (emulador)
- [ ] No hay errores en la consola
- [ ] Hice commit de todos los cambios:
  ```bash
  git add .
  git commit -m "mi cambio aquí"
  ```
- [ ] Hice push a GitHub:
  ```bash
  git push origin main
  ```

---

## 🔨 DESPLEGAR a Producción

### 1️⃣ Compilar el proyecto

```bash
npm run build
```

**¿Qué hace?** Convierte React/TypeScript en HTML/CSS/JS optimizado
**Resultado:** Se crea carpeta `dist/`
**Tiempo:** 3-5 segundos

---

### 2️⃣ Desplegar a Firebase

```bash
firebase deploy --only hosting,functions
```

**¿Qué hace?**
- Sube el contenido de `dist/` a Firebase Hosting
- Compila y sube las Cloud Functions

**Resultado:**
```
✅ Hosting URL: https://que-cocino-hoy-f06bd.web.app
✅ Functions actualizado
```

**Tiempo:** 2-5 minutos (depende de Google)

---

## ✨ DESPUÉS de desplegar

- [ ] Espera 1-2 minutos
- [ ] Abre https://que-cocino-hoy-f06bd.web.app en incógnito (limpia caché)
- [ ] Probá los cambios:
  - ¿Se ve el cambio?
  - ¿Funciona sin errores?
  - ¿Carga rápido?
- [ ] Verifica en Firebase Console:
  - https://console.firebase.google.com/project/que-cocino-hoy-f06bd/hosting
  - Deberías ver un deploy reciente

---

## 🆘 Si algo sale mal

### Error: "Command not found: firebase"

```bash
npm install -g firebase-tools
```

### Error: "Hosting error: Cannot read property of undefined"

1. Verifica que exista `dist/`:
   ```bash
   ls dist/
   ```
2. Si no existe, corre:
   ```bash
   npm run build
   ```

### El sitio se ve viejo (caché)

1. Abre en navegador incógnito (Ctrl+Shift+P)
2. O limpia caché: Ctrl+Shift+Supr → Cookies y cache

### Deploy tardó más de 10 minutos y no terminó

- Es normal que Google Cloud sea lento
- Espera 15 minutos más
- Si sigue sin funcionar:
  ```bash
  firebase deploy --only hosting,functions --force
  ```

---

## 🔄 Flujo Rápido (Resumen)

```bash
# 1. Hacer cambios y commit
git add .
git commit -m "mi cambio"
git push origin main

# 2. Compilar
npm run build

# 3. Desplegar
firebase deploy --only hosting,functions

# 4. Verificar en browser
# Abre: https://que-cocino-hoy-f06bd.web.app
```

---

## 📝 Ejemplo Real

Acabas de agregar "Banana" a los atajos:

```bash
# 1. Editaste IngredientInput.tsx
# 2. Probaste en local con npm run dev
# 3. Está listo

# Commit
git add components/IngredientInput.tsx
git commit -m "feat: agregar Banana a atajos"
git push origin main

# Deploy
npm run build
firebase deploy --only hosting,functions

# Verificar
# Abrí https://que-cocino-hoy-f06bd.web.app
# ✅ Veo "Banana" en los atajos
# ✅ El toggle funciona
# ¡Listo!
```

---

## ⚠️ Recordatorio IMPORTANTE

```
Git push ≠ Deploy

❌ INCORRECTO:
git push
// El código está en GitHub pero NO en producción

✅ CORRECTO:
git push
npm run build
firebase deploy --only hosting,functions
// El código está en GitHub Y en producción
```

---

## 📞 Contacto rápido

Si algo sale mal y necesitas ayuda:

1. Lee el error en la terminal
2. Googleá el error
3. Intenta correr nuevamente:
   ```bash
   npm run build
   firebase deploy --only hosting,functions --force
   ```

---

**Última actualización:** 29 de enero de 2026
