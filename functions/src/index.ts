import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {GoogleGenAI, Type} from "@google/genai";
import {defineSecret} from "firebase-functions/params";
import {initializeApp, getApps} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {MercadoPagoConfig, PreApproval} from "mercadopago";

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// Define secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const mercadoPagoAccessToken = defineSecret("MERCADOPAGO_ACCESS_TOKEN");

setGlobalOptions({maxInstances: 10});

// ==========================================
// MERCADO PAGO SUBSCRIPTION FUNCTIONS
// ==========================================

/**
 * Creates a subscription link for a user to subscribe to Plan Chef Pro.
 * This uses Mercado Pago's PreApproval (recurring payments) API.
 * Supports 'monthly' and 'yearly' plan types.
 */
export const createSubscription = onCall(
  {secrets: [mercadoPagoAccessToken]},
  async (request) => {
    logger.info("🚀 [createSubscription] Iniciando...");

    try {
      // Verify user is authenticated
      if (!request.auth) {
        logger.warn("❌ [createSubscription] Usuario no autenticado");
        throw new HttpsError(
          "unauthenticated",
          "Debes iniciar sesión para suscribirte"
        );
      }

      const userId = request.auth.uid;
      const userEmail = request.auth.token.email || request.data.email;
      const planType = request.data.planType || "monthly"; // 'monthly' or 'yearly'

      logger.info(`📋 [createSubscription] Plan seleccionado: ${planType}`);

      logger.info(`👤 [createSubscription] Usuario: ${userId}, Email: ${userEmail}`);

      if (!userEmail) {
        logger.warn("❌ [createSubscription] Email no proporcionado");
        throw new HttpsError(
          "invalid-argument",
          "Se requiere un email para la suscripción"
        );
      }

      // Verify access token is available and clean it (remove any whitespace/newlines)
      const rawToken = mercadoPagoAccessToken.value();
      if (!rawToken) {
        logger.error("❌ [createSubscription] MERCADOPAGO_ACCESS_TOKEN no está configurado");
        throw new HttpsError(
          "failed-precondition",
          "Configuración de pagos no disponible"
        );
      }
      // CRITICAL: trim() removes any trailing newlines that break HTTP headers
      const accessToken = rawToken.trim();
      logger.info(`🔑 [createSubscription] Access token disponible (${accessToken.substring(0, 15)}..., length: ${accessToken.length})`);

      // Initialize Mercado Pago client
      const client = new MercadoPagoConfig({
        accessToken: accessToken,
      });

      const preApproval = new PreApproval(client);

      // URL de producción - dominio principal de la app
      const PRODUCTION_URL = "https://que-cocino-hoy-f06bd.web.app";

      // Get the frontend URL from request (useful for debugging)
      const requestedUrl = request.data.frontendUrl || PRODUCTION_URL;

      // Detectar si la petición viene de desarrollo local
      const isLocalDev = requestedUrl.includes("localhost") || requestedUrl.includes("127.0.0.1");

      // Para la back_url de Mercado Pago:
      // - SIEMPRE usar la URL de producción para back_url
      // - Mercado Pago requiere URLs públicas válidas
      // - Esto garantiza que el usuario siempre vuelva a la app correctamente
      const backUrl = `${PRODUCTION_URL}/subscription/success`;

      logger.info(`🔗 [createSubscription] back_url: ${backUrl}`);
      if (isLocalDev) {
        logger.info(`🔧 [createSubscription] Petición desde entorno local detectada`);
      }

      // Use the real user email for production
      // For test mode, both access token AND payer must be test users
      const payerEmail = userEmail;
      logger.info(`💳 [createSubscription] Usando payer_email: ${payerEmail}`);

      // Configure plan based on planType
      const isYearly = planType === "yearly";
      const planConfig = isYearly
        ? {
            reason: "Plan Chef Pro Anual",
            frequency: 12,
            frequency_type: "months" as const,
            transaction_amount: 29400,
          }
        : {
            reason: "Plan Chef Pro Mensual",
            frequency: 1,
            frequency_type: "months" as const,
            transaction_amount: 3500,
          };

      logger.info(`💰 [createSubscription] Configuración del plan:`, planConfig);

      // Build subscription request body
      const subscriptionBody = {
        reason: planConfig.reason,
        auto_recurring: {
          frequency: planConfig.frequency,
          frequency_type: planConfig.frequency_type,
          transaction_amount: planConfig.transaction_amount,
          currency_id: "ARS",
        },
        back_url: backUrl,
        payer_email: payerEmail,
        external_reference: userId,
        status: "pending" as const,
      };

      // Log the request body (without sensitive data)
      logger.info("📦 [createSubscription] Request body:", {
        reason: subscriptionBody.reason,
        auto_recurring: subscriptionBody.auto_recurring,
        back_url: subscriptionBody.back_url,
        payer_email: subscriptionBody.payer_email,
        external_reference: subscriptionBody.external_reference,
        status: subscriptionBody.status,
      });

      // Create the subscription (PreApproval)
      logger.info("📡 [createSubscription] Llamando a Mercado Pago API...");
      const subscriptionData = await preApproval.create({
        body: subscriptionBody,
      });

      logger.info("✅ [createSubscription] Respuesta de Mercado Pago:", {
        id: subscriptionData.id,
        status: subscriptionData.status,
        init_point: subscriptionData.init_point ? "presente" : "ausente",
      });

      if (!subscriptionData.init_point) {
        logger.error("❌ [createSubscription] init_point no recibido de Mercado Pago");
        throw new HttpsError(
          "internal",
          "Mercado Pago no devolvió el link de pago"
        );
      }

      // Save subscription info to Firestore
      // Esta información es CRÍTICA para que el webhook pueda identificar al usuario
      logger.info("💾 [createSubscription] Guardando en Firestore...");
      await db.collection("subscriptions").doc(userId).set({
        // ID de Mercado Pago - usado por el webhook para consultar la suscripción
        mpId: subscriptionData.id,
        // Estado inicial de la suscripción
        status: "pending",
        // Email del usuario (para referencia y debugging)
        email: userEmail,
        // Timestamps para tracking
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Información del plan
        plan: "chef-pro",
        planType: planType, // 'monthly' or 'yearly'
        planName: planConfig.reason,
        amount: planConfig.transaction_amount,
        currency: "ARS",
        // ID del usuario de Firebase (redundante pero útil para queries)
        userId: userId,
        // Origen del frontend (para debugging)
        requestedUrl: requestedUrl,
        // Indica si fue creado en modo desarrollo
        isLocalDev: isLocalDev,
      }, {merge: true});

      logger.info(`🎉 [createSubscription] Suscripción creada exitosamente para ${userId}`);

      return {
        success: true,
        initPoint: subscriptionData.init_point,
        subscriptionId: subscriptionData.id,
      };
    } catch (error: unknown) {
      // Detailed error logging
      logger.error("💥 [createSubscription] Error capturado:");

      if (error instanceof HttpsError) {
        logger.error(`   HttpsError: ${error.code} - ${error.message}`);
        throw error;
      }

      // Handle Mercado Pago specific errors
      if (error && typeof error === "object") {
        const mpError = error as {
          message?: string;
          cause?: unknown;
          status?: number;
          response?: {data?: unknown};
        };

        logger.error("   Tipo: Error de Mercado Pago o desconocido");
        logger.error(`   Message: ${mpError.message || "No message"}`);
        logger.error(`   Status: ${mpError.status || "No status"}`);

        if (mpError.cause) {
          logger.error("   Cause:", JSON.stringify(mpError.cause, null, 2));
        }

        if (mpError.response?.data) {
          logger.error("   Response Data:", JSON.stringify(mpError.response.data, null, 2));
        }

        // Return more specific error message to frontend
        const errorMessage = mpError.message || "Error desconocido de Mercado Pago";
        throw new HttpsError(
          "internal",
          `Error de Mercado Pago: ${errorMessage}`
        );
      }

      logger.error("   Error completo:", JSON.stringify(error, null, 2));
      throw new HttpsError(
        "internal",
        "Error inesperado al crear la suscripción"
      );
    }
  }
);

/**
 * Webhook endpoint to receive Mercado Pago notifications.
 * This updates the user's premium status when payment is confirmed.
 */
export const mercadoPagoWebhook = onRequest(
  {secrets: [mercadoPagoAccessToken]},
  async (request, response) => {
    try {
      // Mercado Pago sends notifications via POST
      if (request.method !== "POST") {
        response.status(405).send("Method not allowed");
        return;
      }

      const {type, data} = request.body;

      logger.info("🔔 [Webhook] Notificación recibida:", {type, dataId: data?.id});

      // Handle subscription (preapproval) updates
      if (type === "subscription_preapproval" && data?.id) {
        logger.info("📋 [Webhook] Procesando actualización de suscripción...");

        const rawToken = mercadoPagoAccessToken.value();
        const accessToken = rawToken.trim();

        const client = new MercadoPagoConfig({
          accessToken: accessToken,
        });

        const preApproval = new PreApproval(client);

        // Get the full subscription details from Mercado Pago
        const subscription = await preApproval.get({id: data.id});

        logger.info("📦 [Webhook] Detalles de suscripción de MP:", {
          id: subscription.id,
          status: subscription.status,
          externalReference: subscription.external_reference,
          payerEmail: subscription.payer_email,
        });

        // CRÍTICO: El external_reference contiene el userId de Firebase
        const userId = subscription.external_reference;
        const status = subscription.status;

        if (!userId) {
          logger.warn("⚠️ [Webhook] No se encontró userId en external_reference");
          response.status(200).send("OK");
          return;
        }

        logger.info(`👤 [Webhook] Usuario identificado: ${userId}`);

        // Update subscription status in Firestore
        const now = new Date().toISOString();
        await db.collection("subscriptions").doc(userId).set({
          mpId: subscription.id,
          status: status,
          updatedAt: now,
          lastWebhookAt: now,
          payerEmail: subscription.payer_email,
        }, {merge: true});

        logger.info(`💾 [Webhook] Suscripción actualizada en Firestore: status=${status}`);

        // If subscription is authorized/active, grant premium access INSTANTLY
        if (status === "authorized" || status === "active") {
          await db.collection("users").doc(userId).set({
            isPremium: true,
            premiumSince: now,
            subscriptionId: subscription.id,
            premiumUpdatedAt: now,
          }, {merge: true});

          logger.info(`✨ [Webhook] ¡Usuario ${userId} activado como Premium!`);
        } else if (status === "cancelled" || status === "paused") {
          // If subscription is cancelled, remove premium access
          await db.collection("users").doc(userId).set({
            isPremium: false,
            premiumEndedAt: now,
            premiumUpdatedAt: now,
          }, {merge: true});

          logger.info(`🌑 [Webhook] Acceso Premium revocado para ${userId}`);
        } else {
          logger.info(`ℹ️ [Webhook] Estado no actionable: ${status} para ${userId}`);
        }
      } else {
        logger.info(`ℹ️ [Webhook] Tipo de notificación ignorado: ${type}`);
      }

      // Always respond 200 to acknowledge receipt
      response.status(200).send("OK");
    } catch (error) {
      logger.error("💥 [Webhook] Error procesando notificación:", error);
      // Still respond 200 to prevent retries for unrecoverable errors
      response.status(200).send("OK");
    }
  }
);

/**
 * Check if a user has an active premium subscription.
 * Called from frontend to verify premium status.
 */
export const checkPremiumStatus = onCall(
  async (request) => {
    try {
      if (!request.auth) {
        return {isPremium: false};
      }

      const userId = request.auth.uid;
      const userDoc = await db.collection("users").doc(userId).get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        return {
          isPremium: userData?.isPremium === true,
          premiumSince: userData?.premiumSince || null,
        };
      }

      return {isPremium: false};
    } catch (error) {
      logger.error("Error checking premium status:", error);
      return {isPremium: false};
    }
  }
);

/**
 * Cancel a user's subscription.
 */
export const cancelSubscription = onCall(
  {secrets: [mercadoPagoAccessToken]},
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Debes iniciar sesión"
        );
      }

      const userId = request.auth.uid;

      // Get the subscription ID from Firestore
      const subDoc = await db.collection("subscriptions").doc(userId).get();

      if (!subDoc.exists || !subDoc.data()?.mpId) {
        throw new HttpsError(
          "not-found",
          "No se encontró una suscripción activa"
        );
      }

      const subscriptionId = subDoc.data()?.mpId;

      // Cancel the subscription in Mercado Pago
      const client = new MercadoPagoConfig({
        accessToken: mercadoPagoAccessToken.value(),
      });

      const preApproval = new PreApproval(client);
      await preApproval.update({
        id: subscriptionId,
        body: {status: "cancelled"},
      });

      // Update Firestore
      await db.collection("subscriptions").doc(userId).update({
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      });

      await db.collection("users").doc(userId).update({
        isPremium: false,
        premiumEndedAt: new Date().toISOString(),
      });

      logger.info(`Subscription cancelled for user ${userId}`);

      return {success: true};
    } catch (error: unknown) {
      logger.error("Error cancelling subscription:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Error al cancelar la suscripción"
      );
    }
  }
);

// ==========================================
// RECIPE GENERATION FUNCTIONS
// ==========================================

interface Recipe {
  id: string;
  title: string;
  description: string;
  preparationTime: string;
  difficulty: string;
  calories: number;
  ingredientsNeeded: string[];
  missingIngredients: string[];
  instructions: string[];
  imageUrl?: string;
  macros?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Helper function to generate an image for a recipe
const generateRecipeImage = async (
  ai: GoogleGenAI,
  title: string
): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{
          text: `Fotografía gastronómica profesional, realista y muy apetitosa de un plato de ${title}. Iluminación de estudio, alta resolución, estilo revista de cocina, 4k. IMPORTANTE: Imagen limpia, SIN TEXTO, sin letras, sin tipografía, sin marcas de agua sobre la imagen. Solo comida.`,
        }],
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    logger.warn(`No se pudo generar la imagen para "${title}":`, error);
    return undefined;
  }
  return undefined;
};

interface DietFilters {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
}

export const generateRecipes = onCall(
  {secrets: [geminiApiKey]},
  async (request) => {
    try {
      const {ingredients, useStrictMatching, excludeRecipes, isPremium, dietFilters} = request.data;

      // Process diet filters
      const dietRestrictions: string[] = [];
      const filters: DietFilters = dietFilters || { vegetarian: false, vegan: false, glutenFree: false };

      if (filters.vegan) {
        dietRestrictions.push("La receta debe ser 100% VEGANA: sin ningún ingrediente de origen animal (sin carne, pescado, huevos, lácteos, miel ni derivados animales)");
      } else if (filters.vegetarian) {
        dietRestrictions.push("La receta debe ser VEGETARIANA: sin carne ni pescado, pero puede incluir huevos y lácteos");
      }

      if (filters.glutenFree) {
        dietRestrictions.push("La receta debe ser SIN TACC (apta para celíacos): sin trigo, avena, cebada ni centeno. Evitar harinas de trigo, pan rallado común, pastas regulares, y cualquier ingrediente que contenga gluten");
      }

      const dietInstruction = dietRestrictions.length > 0
        ? `\n\nRESTRICCIONES DIETÉTICAS OBLIGATORIAS:\n${dietRestrictions.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nEs FUNDAMENTAL que respetes estas restricciones. Si algún ingrediente proporcionado no cumple con las restricciones, NO lo uses y sugiere alternativas compatibles.`
        : "";

      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Se requiere una lista de ingredientes válida"
        );
      }

      const ai = new GoogleGenAI({apiKey: geminiApiKey.value()});
      // Gemini 3 Flash Preview: modelo más avanzado con razonamiento Pro, velocidad optimizada y precisión superior
      const modelId = "gemini-3-flash-preview";

      const ingredientsList = ingredients.join(", ");

      const strategyInstruction = useStrictMatching ?
      "MODO DESAFÍO ACTIVADO: El usuario requiere utilizar ABSOLUTAMENTE TODOS los ingredientes listados en cada receta. Es un ejercicio de creatividad culinaria. Solo podés omitir ingredientes si son condimentos obvios que no combinan. Buscá la forma de integrar todo." :
      "MODO FLEXIBLE: Utilizá los ingredientes listados como inspiración principal. Tu prioridad es que el plato sea delicioso y coherente. Si algún ingrediente no combina bien con el resto, omitilo sin problemas. Priorizá el sabor sobre la cantidad de ingredientes usados.";

      const exclusions = excludeRecipes && excludeRecipes.length > 0 ?
      `IMPORTANTE: El usuario ya vio las siguientes recetas, así que POR FAVOR GENERÁ OPCIONES COMPLETAMENTE DISTINTAS a estas: ${excludeRecipes.join(", ")}. Buscá variedad en métodos de cocción o perfiles de sabor.` :
      "";

      const prompt = `
<CONTEXTO>
Sos un chef profesional de alta cocina con formación en nutrición clínica. Tenés acceso a tu conocimiento profundo de técnicas culinarias internacionales y bases de datos nutricionales como USDA FoodData Central.
</CONTEXTO>

<INGREDIENTES_DISPONIBLES>
${ingredientsList}
</INGREDIENTES_DISPONIBLES>

<MODO_DE_OPERACIÓN>
${strategyInstruction}
</MODO_DE_OPERACIÓN>

${exclusions ? `<EXCLUSIONES>\n${exclusions}\n</EXCLUSIONES>` : ""}
${dietInstruction ? `<RESTRICCIONES_DIETÉTICAS>\n${dietInstruction}\n</RESTRICCIONES_DIETÉTICAS>` : ""}

<INSTRUCCIONES_DE_RAZONAMIENTO>
Antes de generar la receta, realizá un análisis interno (no lo incluyas en la respuesta):

1. **Análisis de Ingredientes**: Evaluá qué perfiles de sabor predominan (ácido, dulce, umami, etc.) y qué técnicas de cocción serían óptimas.

2. **Creatividad Culinaria**: Pensá en combinaciones no obvias. Si el usuario tiene pollo y limón, no sugieras "pollo al limón" genérico - buscá una preparación más interesante como un pollo glaseado con cítricos y hierbas, o una técnica específica como sous vide o confitado.

3. **Cálculo Nutricional Preciso**: Para cada ingrediente que uses, calculá los macros basándote en porciones realistas:
   - Consultá mentalmente valores de USDA (ej: 100g pechuga de pollo = 31g proteína, 3.6g grasa, 0g carbs)
   - Sumá los totales y dividí por el número de porciones
   - Los valores deben ser coherentes: una receta con 200g de pollo no puede tener solo 10g de proteína

4. **Equilibrio del Plato**: Asegurá que la receta tenga sentido gastronómico - textura, color, temperatura y balance de sabores.
</INSTRUCCIONES_DE_RAZONAMIENTO>

<FORMATO_DE_SALIDA>
Generá UNA SOLA receta excepcional. Debe ser:
- Realizable en una cocina hogareña argentina
- Con instrucciones precisas y tiempos específicos
- Con cantidades exactas en cada ingrediente (ej: "200g de pechuga de pollo", no solo "pollo")
- Con macros calculados rigurosamente basados en las cantidades especificadas

Si faltan ingredientes básicos de alacena (sal, aceite, especias comunes), asumí que están disponibles.
Si falta algún ingrediente específico y clave, listalo en 'missingIngredients'.

IMPORTANTE sobre títulos: Usá capitalización correcta del español (Sentence case).
✓ Correcto: "Milanesas a la napolitana con puré"
✗ Incorrecto: "Milanesas A La Napolitana Con Puré"
</FORMATO_DE_SALIDA>
    `;

      // Generate Text Recipes using Gemini 3 Flash with Pro-level reasoning
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: `Sos un chef ejecutivo con 20 años de experiencia en restaurantes de alta cocina internacionales y formación certificada en nutrición deportiva. Tu especialidad es crear platos que sorprendan por su creatividad sin sacrificar la practicidad, usando técnicas avanzadas de cocción moderna.

INSTRUCCIONES DE RAZONAMIENTO (Gemini 3 Flash):
Tu modelo tiene acceso a capacidades de razonamiento de nivel Pro. Usalo para:
1. Analizar profundamente perfiles de sabor y técnicas óptimas ANTES de generar
2. Crear combinaciones NO-OBVIAS que muestren maestría culinaria
3. Verificar coherencia matemática de macros basándote en valores USDA reales
4. Asegurar que cada paso instruccional sea preciso y ejecutable

IDIOMA Y ESTILO:
- Español rioplatense (Argentina) con vocabulario local: heladera, bife, morrón, manteca, crema, palta, choclo
- Tono profesional, formal y elegante
- Voseo gramatical argentino ("cortá", "agregá", "mezclá")
- EVITAR TERMINANTEMENTE: lunfardo, muletillas ("che", "viste", "tipo"), expresiones coloquiales

CREATIVIDAD CULINARIA (MÁXIMA PRIORIDAD):
- Rechazá recetas genéricas. Si ves "pollo + limón" no sugieras "Pollo al limón" básico
- Buscá técnicas específicas: glaseados complejos, marinados con profundidad, confitados, sous vide conceptual (simulado en cocina casera)
- Combiná sabores con propósito: ácido para cortar richness, umami para redondez, dulce para balance
- Priorizá contrastes: textura (crocante vs cremoso), temperatura (contraste calor-frío si aplica), color visual

PRECISIÓN NUTRICIONAL (CRÍTICO - USAR RAZONAMIENTO):
- Especificá cantidades EXACTAS en gramos (ej: "200g pechuga de pollo sin piel", no "pollo")
- Calculá macros usando base de datos USDA mental:
  * 100g pechuga pollo sin piel: 31.0g proteína, 3.6g grasa, 0g carbs
  * 100g arroz cocido: 2.7g proteína, 0.3g grasa, 28g carbs
  * 1 huevo grande (50g): 6.3g proteína, 5.3g grasa, 0.6g carbs
  * 100g papa cocida: 2g proteína, 0.1g grasa, 17g carbs
- VERIFICA: suma de macros debe ser coherente (si usa 200g pollo, mínimo 62g proteína)
- Indicá porciones EXACTAS y macros POR PORCIÓN (no totales)

FORMATO DE RESPUESTA:
- Títulos en Sentence case: "Bife de chorizo con reducción de vino tinto" ✓ (no "Bife De Chorizo...")
- Ingredientes con medidas precisas: "250g de bife de chorizo" (no "1 bife")
- Instrucciones numeradas con tiempos ESPECÍFICOS: "Cocinar 7-8 minutos a fuego fuerte, hasta dorar ambas caras"
- Dificultad realista para cocina hogareña argentina (no recetas de Michelin, sí recetas de buen chef casero)`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {type: Type.STRING, description: "Nombre de la receta (Solo primera letra mayúscula, resto minúsculas)"},
              description: {type: Type.STRING, description: "Breve descripción apetitosa y formal (max 20 palabras)"},
              preparationTime: {type: Type.STRING, description: "Tiempo estimado (ej. 30 min)"},
              difficulty: {type: Type.STRING, description: "Fácil, Media o Difícil"},
              calories: {type: Type.INTEGER, description: "Calorías estimadas por porción"},
              ingredientsNeeded: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
                description: "Lista completa de ingredientes con medidas estimadas",
              },
              missingIngredients: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
                description: "Ingredientes clave que el usuario no mencionó",
              },
              instructions: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
                description: "Pasos de preparación numerados, redactados formalmente",
              },
              macros: {
                type: Type.OBJECT,
                properties: {
                  protein: {type: Type.INTEGER, description: "Proteínas en gramos por porción"},
                  carbs: {type: Type.INTEGER, description: "Carbohidratos en gramos por porción"},
                  fat: {type: Type.INTEGER, description: "Grasas en gramos por porción"},
                },
                description: "Macronutrientes calculados basándose en cantidades propuestas y bases de datos nutricionales",
              },
            },
            required: ["title", "description", "preparationTime", "difficulty", "ingredientsNeeded", "instructions", "macros"],
          },
        },
      });

      if (response.text) {
        let rawData = response.text;

        // Clean JSON response
        rawData = rawData.replace(/```json\s*/g, "").replace(/```\s*/g, "");

        // Since we expect a single object now, look for object brackets
        const firstBrace = rawData.indexOf("{");
        const lastBrace = rawData.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          rawData = rawData.substring(firstBrace, lastBrace + 1);
        }

        let rawRecipe: any = null;
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && typeof parsed === "object") {
            rawRecipe = parsed;
          }
        } catch (e) {
          logger.error("JSON Parse error:", e);
          throw new HttpsError(
            "internal",
            "Error al procesar la respuesta del servidor"
          );
        }

        if (!rawRecipe) {
          throw new HttpsError(
            "internal",
            "No se pudo interpretar la receta"
          );
        }

        // Convert single recipe to Recipe object
        const recipe: Recipe = {
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          title: String(rawRecipe.title || "Receta sin título"),
          description: String(rawRecipe.description || "Sin descripción disponible."),
          preparationTime: String(rawRecipe.preparationTime || "-- min"),
          difficulty: String(rawRecipe.difficulty || "Media"),
          calories: typeof rawRecipe.calories === "number" ? rawRecipe.calories : 0,
          ingredientsNeeded: Array.isArray(rawRecipe.ingredientsNeeded) ?
          rawRecipe.ingredientsNeeded.map(String) :
          [],
          missingIngredients: Array.isArray(rawRecipe.missingIngredients) ?
          rawRecipe.missingIngredients.map(String) :
          [],
          instructions: Array.isArray(rawRecipe.instructions) ?
          rawRecipe.instructions.map(String) :
          [],
          imageUrl: undefined,
          macros: rawRecipe.macros && typeof rawRecipe.macros === "object" ? {
            protein: typeof rawRecipe.macros.protein === "number" ? rawRecipe.macros.protein : 0,
            carbs: typeof rawRecipe.macros.carbs === "number" ? rawRecipe.macros.carbs : 0,
            fat: typeof rawRecipe.macros.fat === "number" ? rawRecipe.macros.fat : 0,
          } : undefined,
        };

        // Generate image only if isPremium is EXPLICITLY true
        if (isPremium === true) {
          const imageUrl = await generateRecipeImage(ai, recipe.title);
          recipe.imageUrl = imageUrl;
        }

        // Always return an array with one recipe for frontend compatibility
        return {recipes: [recipe]};
      }

      throw new HttpsError("internal", "No se recibieron recetas");
    } catch (error: any) {
      logger.error("Error generating recipes:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error interno del servidor");
    }
  }
);
