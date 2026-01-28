# Debugging: Fallos en Cancelación de Suscripciones de Mercado Pago

## Resumen Ejecutivo

Si la cancelación de suscripciones falla en Mercado Pago, la nueva implementación:
- ❌ **NO** marca la suscripción como cancelada en Firestore
- ✅ Retorna error claro al usuario
- ✅ Logea diagnósticos específicos para identificar la causa raíz
- ✅ Reintentar automáticamente errores transientes (429, 5xx)

---

## Causas Comunes de Fallo (en orden de probabilidad)

### 1. 🔴 Token de Acceso Expirado (MÁS PROBABLE)

**Error HTTP**: `401 Unauthorized`

**Descripción**:
- Los tokens de Mercado Pago expiran cada **180 días** (15,552,000 segundos)
- Si tu app fue creada hace >6 meses sin renovar el token, ya expiró
- La SDK intenta usar un token inválido/expirado

**Cómo detectar en logs**:
```
[cancelSubscription] ❌ CRITICAL ERROR - Mercado Pago cancellation FAILED
[cancelSubscription] HTTP Status: 401
[cancelSubscription] Error message: Unauthorized
[cancelSubscription] DIAGNOSIS: Access token expired or invalid. Token expires every 180 days.
```

**Solución**:
1. Ve a tu consola de Mercado Pago
2. Obtén un nuevo `MERCADOPAGO_ACCESS_TOKEN`
3. Actualiza la variable de entorno en Firebase:
   ```bash
   firebase functions:config:set mercadopago.access_token="tu_nuevo_token"
   firebase deploy --only functions
   ```

---

### 2. 🔴 PreApproval ID No Existe en Mercado Pago (MUY PROBABLE)

**Error HTTP**: `404 Not Found`

**Descripción**:
- El `mpId` guardado en Firestore no existe en Mercado Pago
- Posibles causas:
  - ID fue mal guardado/corrupto
  - Suscripción fue eliminada manualmente en MP
  - ID vacío o string inválido

**Cómo detectar en logs**:
```
[cancelSubscription] ❌ CRITICAL ERROR
[cancelSubscription] HTTP Status: 404
[cancelSubscription] Subscription ID: [el_id_que_fallo]
[cancelSubscription] DIAGNOSIS: PreApproval ID does not exist in Mercado Pago
```

**Cómo verificar manualmente**:
```bash
# En Firebase Console:
# 1. Abre Firestore > subscriptions > [userId]
# 2. Copia el valor de "mpId"
# 3. En Postman, haz GET a:
#    https://api.mercadopago.com/preapproval/{mpId}
#    Header: Authorization: Bearer {ACCESS_TOKEN}
# 4. Si devuelve 404, el ID es inválido o no existe
```

**Solución**:
1. Contacta soporte para investigar por qué se perdió el ID
2. Si es un caso aislado, limpia ese documento en Firestore
3. Implementa validación en `createSubscription` para asegurar que `mpId` es válido

---

### 3. 🟠 Suscripción en Estado No Cancelable (PROBABLE)

**Error HTTP**: `400 Bad Request`

**Descripción**:
- La suscripción está en un estado que no permite cancelación
- Estados permitidos para cancelar: `pending`, `active`, `authorized`
- Estados que bloquean cancelación: `closed`, ya cancelada, suspendida
- **Ejemplo**: Si hay 3 cobros fallidos, MP cierra automáticamente la suscripción → ya no se puede cambiar su estado

**Cómo detectar en logs**:
```
[cancelSubscription] ❌ CRITICAL ERROR
[cancelSubscription] HTTP Status: 400
[cancelSubscription] Error message: Cannot change subscription state from {actual} to {target}
[cancelSubscription] DIAGNOSIS: Invalid request format or subscription state is not cancellable
```

**Cómo verificar**:
```bash
# GET a https://api.mercadopago.com/preapproval/{mpId}
# Busca el campo "status"
# Si es "closed", ya no se puede cambiar
```

**Solución**:
1. Verificar en Mercado Pago cuál es el estado actual de la suscripción
2. Si está `closed`, la cancelación es irreversible (ya está desactivada)
3. Actualizar Firestore manualmente para reflejar la realidad:
   ```javascript
   db.collection("subscriptions").doc(userId).update({
     status: "closed",
     syncedAt: new Date()
   });
   ```

---

### 4. 🟡 Rate Limiting - Demasiadas Solicitudes (MENOS PROBABLE)

**Error HTTP**: `429 Too Many Requests`

**Descripción**:
- Se enviaron demasiadas solicitudes a Mercado Pago en poco tiempo
- La nueva implementación **reintentar automáticamente** con exponential backoff
- Esperas progresivas: 1s → 2s → 4s

**Cómo detectar en logs**:
```
[cancelSubscription] Retryable error (status 429)
[cancelSubscription] Retrying in 1000ms (attempt 1/3)
[cancelSubscription] Retrying in 2000ms (attempt 2/3)
```

**Solución**:
- El retry automático debería resolver esto
- Si sigue fallando después de 3 intentos, esperar 5+ minutos antes de reintentar

---

### 5. 🟡 Error de Servidor de Mercado Pago (POCO PROBABLE)

**Error HTTP**: `500`, `502`, `503`, `504`

**Descripción**:
- Mercado Pago tiene un problema interno temporal
- La nueva implementación **reintentar automáticamente**

**Cómo detectar en logs**:
```
[cancelSubscription] ❌ CRITICAL ERROR
[cancelSubscription] HTTP Status: 500
[cancelSubscription] DIAGNOSIS: Mercado Pago internal server error. This is temporary, retry after waiting.
```

**Solución**:
- El retry automático debería resolver esto
- Si sigue fallando, esperar 30 minutos y reintentar

---

## Checklist de Debugging

Cuando un usuario reporta que no puede cancelar:

- [ ] **Paso 1**: Ir a Firebase Console → Firestore → subscriptions → [userId]
  - [ ] ¿Existe el documento?
  - [ ] ¿Tiene `mpId`? (no vacío)
  - [ ] ¿Cuál es el `status`?

- [ ] **Paso 2**: Verificar en Mercado Pago
  - [ ] `GET https://api.mercadopago.com/preapproval/{mpId}` con token válido
  - [ ] ¿Devuelve 404? → ID inválido/no existe
  - [ ] ¿Devuelve 2xx? → Verificar campo `status` en respuesta

- [ ] **Paso 3**: Verificar token
  - [ ] ¿Cuándo se creó el token? (>180 días = expirado)
  - [ ] Probar con un token nuevo

- [ ] **Paso 4**: Revisar logs de Firebase
  - [ ] Buscar errores de cancelación para ese usuario
  - [ ] Ver `HTTP Status` y `DIAGNOSIS`

---

## Monitoreo Recomendado

Agregar alertas en Firebase para detectar patrones:

### Alert 1: Demasiadas cancelaciones fallidas (por hora)
```
Métrica: Función "cancelSubscription" con status != success
Umbral: >5 errores por hora
```

### Alert 2: Demasiados errores 401 (token expirado)
```
Métrica: Logs con "[cancelSubscription] HTTP Status: 401"
Umbral: >1 error
Acción: Renovar token inmediatamente
```

### Alert 3: Demasiados errores 404 (IDs inválidos)
```
Métrica: Logs con "[cancelSubscription] HTTP Status: 404"
Umbral: >3 errores por día
Acción: Investigar corrupción de datos en Firestore
```

---

## Flujo Actual de Cancelación (POST-FIX)

```
Usuario hace click en "Cancelar suscripción"
    ↓
cancelSubscription() ejecuta:
    ↓
1. Validar userId autenticado ✓
2. Buscar subscription en Firestore ✓
3. Validar mpId existe y es válido ✓
4. Inicializar cliente de Mercado Pago ✓
5. **RETRY LOOP (hasta 3 intentos)**:
   → Llamar preApproval.update({status: "cancelled"})
   → Si error 429/5xx: esperar y reintentar
   → Si otro error: salir del loop
    ↓
❌ SI FALLA:
   - No tocar Firestore
   - Logar error detallado con diagnóstico
   - Retornar error al usuario
   - Usuario sabe que NO se canceló
    ↓
✅ SI FUNCIONA:
   - Actualizar Firestore: status="cancelled"
   - Actualizar users: isPremium=false
   - Retornar éxito al usuario
   - Usuario sabe que SÍ se canceló
```

---

## Preguntas Frecuentes

### P: ¿Qué pasa si se cancela en Mercado Pago pero no en Firestore?
R: El webhook de Mercado Pago debería actualizar Firestore cuando el status cambie. Si no ocurre:
- Firestore sigue mostrando `status: "active"`
- Pero el usuario realmente no está suscrito en MP
- **Fix**: Ejecutar webhook manualmente o esperar el próximo evento de MP

### P: ¿Cada cuánto expira el token?
R: **180 días** desde que se creó. Después, ya no funciona.

### P: ¿Hay límites de rate limit conocidos?
R: Mercado Pago no publica límites exactos, pero el retry automático con backoff maneja esto.

### P: ¿Cómo sé si un usuario está "stuck" esperando para cancelar?
R: Busca en Firebase Logs:
```
[cancelSubscription] HTTP Status: 429
[cancelSubscription] Retrying in 4000ms
```
Si ves esto repetido >3 veces, el usuario probablemente debería esperar y reintentar.

---

## Recursos Útiles

- [Documentación de PreApproval - Mercado Pago](https://www.mercadopago.com.ar/developers/en/reference/subscriptions/_preapproval_id/put)
- [SDK NodeJS de Mercado Pago](https://github.com/mercadopago/sdk-nodejs)
- [OAuth Token Refresh - Mercado Pago](https://www.mercadopago.com.ar/developers/en/reference/oauth/_oauth_token/post)
