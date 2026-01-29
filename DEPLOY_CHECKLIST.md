# 🚀 Checklist de Deploy Manual

**Úsalo cada vez que hayas hecho cambios y quieras desplegar a producción.**

---

## 🌿 Git Branches (Ramas)

### ¿Qué es una rama?

Una **rama** es una copia independiente de tu código donde puedes hacer cambios sin afectar `main` (la rama de producción).

```
main (producción)
  ↓
  ├─ feature/agregar-atajos (tu trabajo)
  ├─ fix/bug-subtitulos (tu trabajo)
  └─ otro-trabajo
```

### ¿Por qué usar ramas?

| Problema | Solución |
|----------|----------|
| Hago cambios y rompo la app | Los cambios están en otra rama, main está seguro |
| Tengo 2 features a la vez | Una rama por feature, trabajo en paralelo |
| Quiero probar sin romper nada | Hago cambios en la rama, si funciona mergeo a main |
| Tengo un bug urgente | Creo rama `fix/` y corrijo sin tocar el trabajo actual |

### Flujo correcto con ramas

```
1. Creas rama nueva
   git checkout -b feature/mi-cambio

2. Haces cambios en la rama
   (editas archivos)

3. Haces commits en la rama
   git add .
   git commit -m "descripción"

4. Subes la rama a GitHub
   git push origin feature/mi-cambio

5. Mergeas a main (juntas los cambios)
   git checkout main
   git merge feature/mi-cambio
   git push origin main

6. Deployás main a producción
   npm run build
   firebase deploy --only hosting,functions
```

### Comandos de ramas - Referencia rápida

**Ver en qué rama estás:**
```bash
git branch
# Output:
# * main         ← asterisco = rama actual
#   feature/agregar-atajos
```

**Crear una rama nueva:**
```bash
git checkout -b feature/mi-cambio
# O con comando más nuevo:
git switch -c feature/mi-cambio
```

**Cambiar de rama:**
```bash
git checkout main
# O:
git switch main
```

**Ver todas las ramas:**
```bash
git branch -a
```

**Mergear una rama a main:**
```bash
git checkout main           # Cambio a main
git merge feature/mi-cambio # Junto los cambios
git push origin main        # Subo a GitHub
```

**Borrar una rama:**
```bash
git branch -d feature/mi-cambio  # Borrar local
git push origin --delete feature/mi-cambio  # Borrar en GitHub
```

### Ejemplo real: Agregar feature "Buscar recetas"

```bash
# 1. Crear rama
git checkout -b feature/buscar-recetas

# 2. Editar archivos (SearchBar.tsx, App.tsx, etc.)
# Probas en http://localhost:5000

# 3. Hacer commits en la rama
git add components/SearchBar.tsx
git commit -m "feat: agregar componente de búsqueda"

git add App.tsx
git commit -m "feat: integrar búsqueda en App"

# 4. Subir rama a GitHub
git push origin feature/buscar-recetas

# 5. Mergear a main (cuando está listo)
git checkout main
git merge feature/buscar-recetas

# 6. Subir main a GitHub
git push origin main

# 7. Desplegar
npm run build
firebase deploy --only hosting,functions

# 8. Borrar rama (ya no la necesitas)
git branch -d feature/buscar-recetas
git push origin --delete feature/buscar-recetas
```

### Convención de nombres para ramas

**Usa este formato:**

| Tipo | Ejemplo | Descripción |
|------|---------|-------------|
| Feature | `feature/agregar-atajos` | Nueva funcionalidad |
| Fix | `fix/bug-subtitulos` | Arreglando un bug |
| Hotfix | `hotfix/error-critico` | Bug urgente en producción |
| Docs | `docs/actualizar-readme` | Cambios en documentación |

**✅ BUENO:**
```
feature/agregar-busqueda
fix/error-en-login
hotfix/crash-produccion
```

**❌ MALO:**
```
mi-rama
cambios
test
hola
```

### ⚠️ IMPORTANTE: Nunca hagas commits directamente a `main`

```
❌ MALO:
git checkout main
git add .
git commit -m "cambios"  # ← Directo a producción, peligroso

✅ BUENO:
git checkout -b feature/cambios
git add .
git commit -m "cambios"
git push origin feature/cambios
# Mergear después de revisar
```

---

## ✅ ANTES de desplegar

- [ ] Estoy en la rama `main`:
  ```bash
  git branch  # Verifica que veas * main
  ```
- [ ] Hice todos los cambios necesarios en mi rama de feature
- [ ] El código funciona en local (`npm run dev`)
- [ ] Probé los cambios en http://localhost:5000 (emulador)
- [ ] No hay errores en la consola
- [ ] Hice commit de todos los cambios:
  ```bash
  git add .
  git commit -m "mi cambio aquí"
  ```
- [ ] Mergée mi rama a `main`:
  ```bash
  git checkout main
  git merge feature/mi-rama
  ```
- [ ] Hice push a GitHub (desde main):
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

### Opción A: Sin ramas (simple)
```bash
# 1. Hacer cambios y commit (directo en main)
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

### Opción B: Con ramas (recomendado) ⭐
```bash
# 1. Crear rama
git checkout -b feature/mi-cambio

# 2. Hacer cambios y commits en la rama
git add .
git commit -m "mi cambio"
git push origin feature/mi-cambio

# 3. Mergear a main
git checkout main
git merge feature/mi-cambio
git push origin main

# 4. Compilar
npm run build

# 5. Desplegar
firebase deploy --only hosting,functions

# 6. Borrar rama (opcional pero buena práctica)
git branch -d feature/mi-cambio
git push origin --delete feature/mi-cambio

# 7. Verificar en browser
# Abre: https://que-cocino-hoy-f06bd.web.app
```

---

## 📝 Ejemplo Real

Acabas de agregar "Banana" a los atajos:

### SIN ramas
```bash
# 1. Editaste IngredientInput.tsx
# 2. Probaste en local con npm run dev
# 3. Está listo

# Commit directo a main
git add components/IngredientInput.tsx
git commit -m "feat: agregar Banana a atajos"
git push origin main

# Deploy
npm run build
firebase deploy --only hosting,functions

# Verificar
# Abrí https://que-cocino-hoy-f06bd.web.app
# ✅ Veo "Banana" en los atajos
# ¡Listo!
```

### CON ramas (mejor)
```bash
 

# 4. Subir rama a GitHub
git push origin feature/agregar-banana-atajo

# 5. Mergear a main (cuando confirmes que funciona)
git checkout main
git merge feature/agregar-banana-atajo
git push origin main

# 6. Deploy
npm run build
firebase deploy --only hosting,functions

# 7. Borrar rama
git branch -d feature/agregar-banana-atajo
git push origin --delete feature/agregar-banana-atajo

# Verificar
# Abrí https://que-cocino-hoy-f06bd.web.app
# ✅ Veo "Banana" en los atajos
# ✅ "main" está segura porque lo probé primero en la rama
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

## 🧠 Resumen: El flujo COMPLETO

```
INICIO
  ↓
1️⃣ Crear rama: git checkout -b feature/mi-cambio
  ↓
2️⃣ Editar archivos y probar en local (npm run dev)
  ↓
3️⃣ Hacer commits: git add . && git commit -m "..."
  ↓
4️⃣ Subir rama: git push origin feature/mi-cambio
  ↓
5️⃣ Mergear a main: git checkout main && git merge feature/mi-cambio
  ↓
6️⃣ Subir main: git push origin main
  ↓
7️⃣ Compilar: npm run build
  ↓
8️⃣ Desplegar: firebase deploy --only hosting,functions
  ↓
9️⃣ Verificar en: https://que-cocino-hoy-f06bd.web.app
  ↓
🔟 Limpiar: git branch -d feature/mi-cambio
  ↓
✅ FIN - Tu código está en producción
```

---

**Última actualización:** 29 de enero de 2026
