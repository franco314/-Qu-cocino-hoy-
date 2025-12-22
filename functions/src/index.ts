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
 * Creates a subscription link for a user to subscribe to Plan Chef.
 * This uses Mercado Pago's PreApproval (recurring payments) API.
 */
export const createSubscription = onCall(
  {secrets: [mercadoPagoAccessToken]},
  async (request) => {
    try {
      // Verify user is authenticated
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Debes iniciar sesión para suscribirte"
        );
      }

      const userId = request.auth.uid;
      const userEmail = request.auth.token.email || request.data.email;

      if (!userEmail) {
        throw new HttpsError(
          "invalid-argument",
          "Se requiere un email para la suscripción"
        );
      }

      // Initialize Mercado Pago client
      const client = new MercadoPagoConfig({
        accessToken: mercadoPagoAccessToken.value(),
      });

      const preApproval = new PreApproval(client);

      // Get the frontend URL for redirects
      const frontendUrl = request.data.frontendUrl || "https://quecocinohoy.com";

      // Create the subscription (PreApproval)
      const subscriptionData = await preApproval.create({
        body: {
          reason: "Plan Chef - ¿Qué Cocino Hoy?",
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: 3500,
            currency_id: "ARS",
          },
          back_url: `${frontendUrl}/subscription/success`,
          payer_email: userEmail,
          external_reference: userId, // Link subscription to user
          status: "pending",
        },
      });

      // Save subscription info to Firestore
      await db.collection("subscriptions").doc(userId).set({
        odId: subscriptionData.id,
        status: "pending",
        email: userEmail,
        createdAt: new Date().toISOString(),
        plan: "chef",
        amount: 3500,
        currency: "ARS",
      }, {merge: true});

      logger.info(`Subscription created for user ${userId}`, {
        subscriptionId: subscriptionData.id,
      });

      return {
        success: true,
        initPoint: subscriptionData.init_point,
        subscriptionId: subscriptionData.id,
      };
    } catch (error: unknown) {
      logger.error("Error creating subscription:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Error al crear la suscripción. Intenta nuevamente."
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

      logger.info("Webhook received:", {type, dataId: data?.id});

      // Handle subscription (preapproval) updates
      if (type === "subscription_preapproval" && data?.id) {
        const client = new MercadoPagoConfig({
          accessToken: mercadoPagoAccessToken.value(),
        });

        const preApproval = new PreApproval(client);

        // Get the full subscription details
        const subscription = await preApproval.get({id: data.id});

        logger.info("Subscription details:", {
          id: subscription.id,
          status: subscription.status,
          externalReference: subscription.external_reference,
        });

        const userId = subscription.external_reference;
        const status = subscription.status;

        if (!userId) {
          logger.warn("No user ID in external_reference");
          response.status(200).send("OK");
          return;
        }

        // Update subscription status in Firestore
        await db.collection("subscriptions").doc(userId).set({
          mpId: subscription.id,
          status: status,
          lastUpdated: new Date().toISOString(),
          payerEmail: subscription.payer_email,
        }, {merge: true});

        // If subscription is authorized/active, grant premium access
        if (status === "authorized" || status === "active") {
          await db.collection("users").doc(userId).set({
            isPremium: true,
            premiumSince: new Date().toISOString(),
            subscriptionId: subscription.id,
          }, {merge: true});

          logger.info(`User ${userId} upgraded to Premium!`);
        } else if (status === "cancelled" || status === "paused") {
          // If subscription is cancelled, remove premium access
          await db.collection("users").doc(userId).set({
            isPremium: false,
            premiumEndedAt: new Date().toISOString(),
          }, {merge: true});

          logger.info(`User ${userId} premium access revoked`);
        }
      }

      // Always respond 200 to acknowledge receipt
      response.status(200).send("OK");
    } catch (error) {
      logger.error("Webhook error:", error);
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
      const modelId = "gemini-2.5-flash";

      const ingredientsList = ingredients.join(", ");

      const strategyInstruction = useStrictMatching ?
      "MODO DESAFÍO ACTIVADO: El usuario requiere utilizar ABSOLUTAMENTE TODOS los ingredientes listados en cada receta. Es un ejercicio de creatividad culinaria. Solo podés omitir ingredientes si son condimentos obvios que no combinan. Buscá la forma de integrar todo." :
      "MODO FLEXIBLE: Utilizá los ingredientes listados como inspiración principal. Tu prioridad es que el plato sea delicioso y coherente. Si algún ingrediente no combina bien con el resto, omitilo sin problemas. Priorizá el sabor sobre la cantidad de ingredientes usados.";

      const exclusions = excludeRecipes && excludeRecipes.length > 0 ?
      `IMPORTANTE: El usuario ya vio las siguientes recetas, así que POR FAVOR GENERÁ OPCIONES COMPLETAMENTE DISTINTAS a estas: ${excludeRecipes.join(", ")}. Buscá variedad en métodos de cocción o perfiles de sabor.` :
      "";

      const prompt = `
      Actuá como un chef profesional. Tengo los siguientes ingredientes disponibles en mi cocina:

      Lista de ingredientes: ${ingredientsList}

      ${strategyInstruction}

      ${exclusions}
      ${dietInstruction}

      Por favor, sugerime LA MEJOR receta posible (solo 1 receta, no 3). Debe ser realizable y bien equilibrada.
      Si faltan ingredientes básicos de alacena (como sal, aceite, especias comunes), asumí que los tengo. Si falta algún ingrediente específico y clave para la receta, listalo en 'missingIngredients'.

      Redactá las instrucciones de manera clara, paso a paso y en español rioplatense (Argentina). El tono debe ser formal y educado.
      IMPORTANTE: Los títulos de las recetas deben respetar las reglas de ortografía del español: solo la primera letra en mayúscula (salvo nombres propios). Ejemplo: "Milanesas a la napolitana con puré" (Correcto), "Milanesas A La Napolitana Con Puré" (Incorrecto).
    `;

      // Generate Text Recipes
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: "Sos un asistente culinario experto y nutricionista. Generá recetas en español rioplatense (Argentina), utilizando vocabulario local correcto (ej: heladera, bife, morrón, manteca, crema). El tono debe ser profesional, formal y elegante. Mantené el voseo gramatical propio de Argentina pero evitá terminantemente el uso de lunfardo, muletillas informales (como 'che', 'viste') o expresiones coloquiales excesivas. Priorizá la claridad expositiva y la buena redacción. Asegurate de escribir los títulos con la capitalización correcta del español (Sentence case). IMPORTANTE: Actuá como nutricionista experto y calculá los macronutrientes (proteínas, carbohidratos y grasas en gramos) para el total de los ingredientes propuestos en la receta, utilizando bases de datos nutricionales estándar como USDA o similares. Los valores deben ser realistas y basados en las cantidades exactas que especifiques.",
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
