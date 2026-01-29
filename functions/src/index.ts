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
 * Helper: Retry a Mercado Pago operation with exponential backoff.
 * Handles transient errors (429 rate limit, 500 server errors).
 * Max 3 retries by default.
 */
const retryWithExponentialBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = "MP Operation"
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isRetryableError = [429, 500, 502, 503, 504].includes(error?.status);
      const isLastAttempt = attempt === maxRetries;

      if (!isRetryableError || isLastAttempt) {
        // Not a retryable error or last attempt - throw immediately
        throw error;
      }

      // Calculate exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      logger.warn(`[${operationName}] Retryable error (status ${error?.status}). Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Max retries exceeded");
};

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
        logger.info("🔧 [createSubscription] Petición desde entorno local detectada");
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

      logger.info("💰 [createSubscription] Configuración del plan:", planConfig);

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
        const status = subscription.status as string;

        if (!userId) {
          logger.warn("⚠️ [Webhook] No se encontró userId en external_reference");
          response.status(200).send("OK");
          return;
        }

        if (!status) {
          logger.error("⚠️ [Webhook] No se recibió status de Mercado Pago para subscription ${data.id}");
          response.status(200).send("OK");
          return;
        }

        logger.info(`👤 [Webhook] Usuario identificado: ${userId}`);

        // Validate status is one of the expected values
        const validStatuses = ["pending", "authorized", "active", "cancelled", "paused", "suspended"];
        if (!validStatuses.includes(status)) {
          logger.warn(`⚠️ [Webhook] Estado inesperado recibido de MP: ${status} (userId: ${userId})`);
          // Still update Firestore so we have record of this state
        }

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

        // Sync premium status with subscription state
        // Active/Authorized: User has access
        if (status === "authorized" || status === "active") {
          await db.collection("users").doc(userId).set({
            isPremium: true,
            premiumSince: now,
            subscriptionId: subscription.id,
            premiumUpdatedAt: now,
          }, {merge: true});

          logger.info(`✨ [Webhook] ¡Usuario ${userId} activado como Premium! (status: ${status})`);
        }
        // Cancelled/Paused: User loses access
        else if (status === "cancelled" || status === "paused") {
          await db.collection("users").doc(userId).set({
            isPremium: false,
            premiumEndedAt: now,
            premiumUpdatedAt: now,
          }, {merge: true});

          logger.info(`🌑 [Webhook] Acceso Premium revocado para ${userId} (status: ${status})`);
        }
        // Pending/Suspended/Other: No immediate action, keep current premium status
        else {
          logger.info(`ℹ️ [Webhook] Estado ${status} - no cambia estado premium de ${userId} (requiere confirmación manual si es necesario)`);
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
      logger.info(`[cancelSubscription] Starting for user ${userId}`);

      // Get the subscription ID from Firestore
      const subDoc = await db.collection("subscriptions").doc(userId).get();

      if (!subDoc.exists) {
        logger.warn(`[cancelSubscription] ❌ No subscription document found for user ${userId}`);
        throw new HttpsError(
          "not-found",
          "No se encontró una suscripción activa"
        );
      }

      const subscriptionData = subDoc.data();
      const subscriptionId = subscriptionData?.mpId;
      const currentStatus = subscriptionData?.status;

      // Validate subscription ID is present and looks valid
      if (!subscriptionId) {
        logger.error(`[cancelSubscription] ❌ CRITICAL: mpId is missing for user ${userId}. Current data:`, {
          status: currentStatus,
          email: subscriptionData?.email,
          createdAt: subscriptionData?.createdAt,
        });
        throw new HttpsError(
          "failed-precondition",
          "Suscripción encontrada pero sin ID válido. Por favor contacta soporte."
        );
      }

      if (typeof subscriptionId !== "string" || subscriptionId.trim().length === 0) {
        logger.error(`[cancelSubscription] ❌ CRITICAL: mpId is invalid (type: ${typeof subscriptionId}, value: "${subscriptionId}"). User: ${userId}`);
        throw new HttpsError(
          "failed-precondition",
          "El ID de suscripción no es válido. Por favor contacta soporte."
        );
      }

      logger.info(`[cancelSubscription] Found subscription mpId: ${subscriptionId}, status: ${currentStatus}`);

      // CRITICAL: Only cancel in Firestore if Mercado Pago cancellation succeeds
      // If MP fails, throw error immediately to prevent inconsistent state
      const rawToken = mercadoPagoAccessToken.value();
      if (!rawToken) {
        logger.error(`[cancelSubscription] MERCADOPAGO_ACCESS_TOKEN not configured`);
        throw new HttpsError(
          "failed-precondition",
          "Configuración de pagos no disponible"
        );
      }

      const accessToken = rawToken.trim();
      const client = new MercadoPagoConfig({
        accessToken: accessToken,
      });

      const preApproval = new PreApproval(client);

      try {
        logger.info(`[cancelSubscription] Attempting to cancel subscription ${subscriptionId} in Mercado Pago...`);

        // Use retry logic for transient errors (rate limit, server errors)
        await retryWithExponentialBackoff(
          () => preApproval.update({
            id: subscriptionId,
            body: {status: "cancelled"},
          }),
          3,
          `cancelSubscription[${userId}]`
        );

        logger.info(`[cancelSubscription] ✅ Successfully cancelled in Mercado Pago for user ${userId}`);
      } catch (mpErr: any) {
        // CRITICAL: If Mercado Pago cancellation fails, DO NOT update Firestore
        // This ensures consistency: local DB reflects reality
        const errorMessage = mpErr?.message || "Unknown error";
        const errorStatus = mpErr?.status || "unknown";

        logger.error(`[cancelSubscription] ❌ CRITICAL ERROR - Mercado Pago cancellation FAILED for user ${userId}`);
        logger.error(`[cancelSubscription] Subscription ID: ${subscriptionId}`);
        logger.error(`[cancelSubscription] HTTP Status: ${errorStatus}`);
        logger.error(`[cancelSubscription] Error message: ${errorMessage}`);

        // Diagnose the specific error type
        let diagnosticInfo = "";
        if (errorStatus === 401) {
          diagnosticInfo = "PROBABLE CAUSE: Access token expired or invalid. Token expires every 180 days.";
        } else if (errorStatus === 404) {
          diagnosticInfo = "PROBABLE CAUSE: PreApproval ID does not exist in Mercado Pago. Check if ID is correct or if subscription was already deleted.";
        } else if (errorStatus === 429) {
          diagnosticInfo = "PROBABLE CAUSE: Rate limit exceeded. Too many requests to Mercado Pago API. Retry with exponential backoff.";
        } else if (errorStatus === 400) {
          diagnosticInfo = "PROBABLE CAUSE: Invalid request format or subscription state is not cancellable (e.g., already closed).";
        } else if (errorStatus === 500) {
          diagnosticInfo = "PROBABLE CAUSE: Mercado Pago internal server error. This is temporary, retry after waiting.";
        }

        if (diagnosticInfo) {
          logger.error(`[cancelSubscription] DIAGNOSIS: ${diagnosticInfo}`);
        }

        // Log full error details for debugging billing issues
        if (mpErr?.cause) {
          logger.error(`[cancelSubscription] Error cause:`, JSON.stringify(mpErr.cause, null, 2));
        }
        if (mpErr?.response?.data) {
          logger.error(`[cancelSubscription] API response data:`, JSON.stringify(mpErr.response.data, null, 2));
        }

        // Log the entire error object for edge cases
        logger.error(`[cancelSubscription] Full error object:`, JSON.stringify(mpErr, null, 2));

        // Provide user-friendly error message based on status
        let userMessage = `No se pudo cancelar la suscripción en Mercado Pago: ${errorMessage}.`;
        if (errorStatus === 401) {
          userMessage += " Por favor intenta nuevamente en unos momentos.";
        } else if (errorStatus === 404) {
          userMessage += " La suscripción no fue encontrada. Contacta soporte si crees que esto es un error.";
        } else if (errorStatus === 429) {
          userMessage += " Demasiados intentos. Espera unos minutos e intenta nuevamente.";
        } else {
          userMessage += " Por favor intenta nuevamente o contacta soporte si el problema persiste.";
        }

        // Throw error to client - user knows cancellation did NOT happen
        throw new HttpsError(
          "internal",
          userMessage
        );
      }

      // ONLY reach here if Mercado Pago cancellation succeeded
      // Now safely update Firestore to reflect the reality
      logger.info(`[cancelSubscription] Updating Firestore for user ${userId}...`);

      const now = new Date().toISOString();

      await db.collection("subscriptions").doc(userId).update({
        status: "cancelled",
        cancelledAt: now,
        mpCancelled: true,
        mpError: null,
      });

      await db.collection("users").doc(userId).update({
        isPremium: false,
        premiumEndedAt: now,
      });

      logger.info(`[cancelSubscription] ✅ Subscription successfully cancelled for user ${userId} in both MP and Firestore`);

      return {
        success: true,
        mpCancelled: true,
        message: "Suscripción cancelada exitosamente. No recibirás más cobros.",
      };
    } catch (error: unknown) {
      logger.error("[cancelSubscription] Error:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      // Extract more details from the error
      const errorMsg = error instanceof Error ? error.message : "Error desconocido";
      logger.error(`[cancelSubscription] Unhandled error: ${errorMsg}`);

      throw new HttpsError(
        "internal",
        `Error al cancelar la suscripción: ${errorMsg}`
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

// Helper function to generate an image for a recipe using Gemini Flash Image
const generateRecipeImage = async (
  ai: GoogleGenAI,
  title: string
): Promise<{imageUrl?: string; error?: string}> => {
  try {
    logger.info(`🖼️ [generateRecipeImage] Generando imagen para: "${title}" con Gemini Flash Image`);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{
          text: `Professional food photography of a ${title}, full plate visible, wide shot, high angle, showing the entire dish and side dishes. Clean composition, sharp focus on all food, cinematic lighting, no text, no watermarks.`,
        }],
      },
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        logger.info(`✅ [generateRecipeImage] Imagen generada exitosamente con Gemini Flash Image`);
        return {imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`};
      }
    }

    logger.warn(`⚠️ [generateRecipeImage] No se encontró imagen en la respuesta`);
    return {error: "La API no devolvió una imagen"};
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`❌ [generateRecipeImage] Error: ${errorMessage}`, error);
    return {error: errorMessage};
  }
};

interface DietFilters {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
}

// Interface for raw Gemini API response (structured output)
interface RawGeminiRecipe {
  title?: string;
  description?: string;
  preparationTime?: string;
  difficulty?: string;
  calories?: number;
  ingredientsNeeded?: string[];
  missingIngredients?: string[];
  instructions?: string[];
  macros?: {
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

// ==========================================
// IMAGE QUOTA SYSTEM
// ==========================================

/**
 * Daily image limits by plan type (Pro users)
 */
const IMAGE_LIMITS = {
  monthly: 5,
  yearly: 5,
};

/**
 * One-time image gift for free users (never resets, use it or lose it)
 */
const FREE_TRIAL_IMAGE_LIMIT = 3;

/**
 * Gets today's date in DD-MM-YYYY format for quota tracking
 */
const getTodayDateKey = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Checks if user has remaining image quota and returns current usage info.
 * - Pro users: daily limits (5/day, resets each day)
 * - Free users: one-time gift of 3 images (never resets)
 */
const checkImageQuota = async (
  userId: string
): Promise<{
  canGenerate: boolean;
  currentCount: number;
  limit: number;
  planType: string;
  isFreeTrial?: boolean;
  lifetimeCount?: number;
}> => {
  const todayKey = getTodayDateKey();

  // Get user document first
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  const isPremium = userData?.isPremium === true;

  // Get user's subscription to determine plan type
  const subscriptionDoc = await db.collection("subscriptions").doc(userId).get();
  const subscriptionData = subscriptionDoc.exists ? subscriptionDoc.data() : null;

  // Determine if user has an active subscription
  const hasActiveSubscription = isPremium &&
    subscriptionData &&
    (subscriptionData.status === "authorized" || subscriptionData.status === "active");

  // FREE USER LOGIC: Check lifetime image count
  if (!hasActiveSubscription) {
    const lifetimeCount = userData?.lifetimeImageCount || 0;
    const canGenerate = lifetimeCount < FREE_TRIAL_IMAGE_LIMIT;

    logger.info(`🎁 [checkImageQuota] Usuario FREE ${userId}: ${lifetimeCount}/${FREE_TRIAL_IMAGE_LIMIT} imágenes de regalo usadas`);

    return {
      canGenerate,
      currentCount: lifetimeCount,
      limit: FREE_TRIAL_IMAGE_LIMIT,
      planType: "free",
      isFreeTrial: true,
      lifetimeCount,
    };
  }

  // PRO USER LOGIC: Check daily quota
  const planType = subscriptionData?.planType || "monthly";
  const limit = IMAGE_LIMITS[planType as keyof typeof IMAGE_LIMITS] || IMAGE_LIMITS.monthly;

  logger.info(`📊 [checkImageQuota] Usuario PRO ${userId}: plan=${planType}, límite diario=${limit}`);

  const dailyImageUsage = userData?.dailyImageUsage || {date: "", count: 0};

  // If date doesn't match today, reset counter
  if (dailyImageUsage.date !== todayKey) {
    logger.info(`🔄 [checkImageQuota] Nuevo día detectado, reseteando contador para ${userId}`);
    return {canGenerate: true, currentCount: 0, limit, planType, isFreeTrial: false};
  }

  const currentCount = dailyImageUsage.count || 0;
  const canGenerate = currentCount < limit;

  logger.info(`📈 [checkImageQuota] Usuario PRO ${userId}: ${currentCount}/${limit} imágenes hoy`);

  return {canGenerate, currentCount, limit, planType, isFreeTrial: false};
};

/**
 * Increments the image counter after successful generation.
 * - Daily counter: resets each day (used for Pro quota)
 * - Lifetime counter: never resets (tracks one-time free gift usage)
 */
const incrementImageCounter = async (userId: string, isFreeTrial: boolean = false): Promise<void> => {
  const todayKey = getTodayDateKey();

  // Get current usage
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : null;
  const dailyImageUsage = userData?.dailyImageUsage || {date: "", count: 0};
  const currentLifetimeCount = userData?.lifetimeImageCount || 0;

  // If it's a new day, start fresh; otherwise increment
  const newDailyCount = dailyImageUsage.date === todayKey
    ? (dailyImageUsage.count || 0) + 1
    : 1;

  // Always increment lifetime count for tracking purposes
  const newLifetimeCount = currentLifetimeCount + 1;

  await db.collection("users").doc(userId).set({
    dailyImageUsage: {
      date: todayKey,
      count: newDailyCount,
    },
    lifetimeImageCount: newLifetimeCount,
  }, {merge: true});

  if (isFreeTrial) {
    logger.info(`🎁 [incrementImageCounter] Usuario FREE ${userId}: ${newLifetimeCount}/${FREE_TRIAL_IMAGE_LIMIT} imágenes de regalo usadas`);
  } else {
    logger.info(`✅ [incrementImageCounter] Usuario PRO ${userId}: contador diario=${newDailyCount}, lifetime=${newLifetimeCount}`);
  }
};

// ==========================================
// RECIPE GENERATION FUNCTIONS
// ==========================================

export const generateRecipes = onCall(
  {
    secrets: [geminiApiKey],
    cors: true,
    maxInstances: 10
  },
  async (request) => {
    try {
      const {
        ingredients,
        useStrictMatching,
        excludeRecipes,
        dietFilters,
        shouldGenerateImage,
      } = request.data;

      // Process diet filters
      const dietRestrictions: string[] = [];
      const filters: DietFilters = dietFilters || {vegetarian: false, vegan: false, glutenFree: false};

      // Note: vegan filter removed from UI but kept in interface for backwards compatibility
      if (filters.vegetarian) {
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
      // Gemini 3 Flash Preview: modelo más avanzado con razonamiento Pro
      const modelId = "gemini-3-flash-preview";

      const ingredientsList = ingredients.join(", ");

      const strategyInstruction = useStrictMatching
        ? "MODO DESAFÍO: Buscá una forma de usar los ingredientes en un plato casero, rico y fácil de entender."
        : "MODO FLEXIBLE: Priorizá la practicidad. Recetas de pocos pasos y mucho sabor.";

      const exclusions = excludeRecipes && excludeRecipes.length > 0
        ? `IMPORTANTE: El usuario ya vio las siguientes recetas, así que POR FAVOR GENERÁ OPCIONES COMPLETAMENTE DISTINTAS a estas: ${excludeRecipes.join(", ")}. Buscá variedad en métodos de cocción o perfiles de sabor.`
        : "";

      const prompt = `
<INGREDIENTES_DISPONIBLES>
${ingredientsList}
</INGREDIENTES_DISPONIBLES>

<MODO_DE_OPERACIÓN>
${strategyInstruction}
</MODO_DE_OPERACIÓN>

${exclusions ? `<EXCLUSIONES>\n${exclusions}\n</EXCLUSIONES>` : ""}
${dietInstruction ? `<RESTRICCIONES_DIETÉTICAS>\n${dietInstruction}\n</RESTRICCIONES_DIETÉTICAS>` : ""}

<TAREA>
Generá una receta rica y simple. 
1. Título simple. Sin palabras fancy como rösti, emulsión, reducción, corazón de.
2. Instrucciones claras, sin caer en complejidades innecesarias.
3. Cantidades exactas en gramos para el cálculo de macros.
</TAREA>
`;

      // Generate Text Recipes using Gemini 3 Flash Preview
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: `Sos un muy buen cocinero argentino con experiencia.

REGLA #1 - TÍTULOS (MUY IMPORTANTE):
- Usá nombres atractivos que no por eso sean rimbombantes. El titulo debe reflejar lo que expresa la receta.
- CAPITALIZACIÓN: Solo la primera letra del título debe estar en mayúscula. El resto en minúsculas. Ejemplo: "Arroz campero con pollo y queso derretido" (CORRECTO), NO "Arroz Campero Con Pollo Y Queso Derretido" (INCORRECTO).
- PALABRAS 100% PROHIBIDAS en títulos: rösti, emulsión, reducción, fondant, confitado, carpaccio, tataki, velouté, coulant, crème, brunoise, chiffonade, glasé, flambeado, escabeche gourmet
- Ni el titulo ni el contenido deben ser complejos, pero tampoco caigas en la simplicidad de "Pollo con arroz" o "Fideos con manteca y queso", buscá un término medio.

OTRAS REGLAS:
- Hablá con voseo (cortá, mezclá, poné)
- Vocabulario argentino: manteca, morrón, verdeo, zapallo, palta, choclo
- Calculá macros en silencio usando USDA, solo ponelos en el JSON`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {type: Type.STRING, description: "Nombre simple y atractivo con solo la primera letra en mayúscula, el resto en minúsculas. PROHIBIDO: rösti, emulsión, reducción, crocante, corazón de, confitado, y cualquier palabra de restaurante fancy."},
              description: {type: Type.STRING, description: "Breve descripción apetitosa y formal (máximo 35 palabras)"},
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

        let rawRecipe: RawGeminiRecipe | null = null;
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
          ingredientsNeeded: Array.isArray(rawRecipe.ingredientsNeeded)
            ? rawRecipe.ingredientsNeeded.map(String)
            : [],
          missingIngredients: Array.isArray(rawRecipe.missingIngredients)
            ? rawRecipe.missingIngredients.map(String)
            : [],
          instructions: Array.isArray(rawRecipe.instructions)
            ? rawRecipe.instructions.map(String)
            : [],
          imageUrl: undefined,
          macros: rawRecipe.macros && typeof rawRecipe.macros === "object" ? {
            protein: typeof rawRecipe.macros.protein === "number" ? rawRecipe.macros.protein : 0,
            carbs: typeof rawRecipe.macros.carbs === "number" ? rawRecipe.macros.carbs : 0,
            fat: typeof rawRecipe.macros.fat === "number" ? rawRecipe.macros.fat : 0,
          } : undefined,
        };

        // Generate image if shouldGenerateImage is true AND user has quota available
        // Works for both Pro users (daily quota) and Free users (lifetime trial)
        // Login is REQUIRED to generate images
        if (shouldGenerateImage !== false) {
          const userId = request.auth?.uid;

          if (!userId) {
            // No authenticated user - login required for image generation
            logger.info("🔒 [generateRecipes] Login requerido para generar imágenes");
          } else {
            // Check quota before generating (works for both Pro and Free users)
            const quota = await checkImageQuota(userId);

            if (quota.canGenerate) {
              const imageResult = await generateRecipeImage(ai, recipe.title);
              if (imageResult.imageUrl) {
                recipe.imageUrl = imageResult.imageUrl;
                // Increment counter after successful generation
                await incrementImageCounter(userId, quota.isFreeTrial);
                const quotaType = quota.isFreeTrial ? "regalo" : "diarias";
                logger.info(`🖼️ [generateRecipes] Imagen generada para usuario ${userId} (${quota.currentCount + 1}/${quota.limit} ${quotaType})`);
              }
            } else {
              const quotaType = quota.isFreeTrial ? "imágenes de regalo" : "imágenes diarias";
              logger.info(`🚫 [generateRecipes] Usuario ${userId} alcanzó límite de ${quotaType} (${quota.currentCount}/${quota.limit})`);
            }
          }
        }

        // Always return an array with one recipe for frontend compatibility
        return {recipes: [recipe]};
      }

      throw new HttpsError("internal", "No se recibieron recetas");
    } catch (error: unknown) {
      logger.error("Error generating recipes:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Error interno del servidor");
    }
  }
);

/**
 * Generates an image for a specific recipe title.
 * Available for both Pro users (daily quota) and Free users (lifetime trial).
 * Login is REQUIRED.
 */
export const generateSingleRecipeImage = onCall(
  {
    secrets: [geminiApiKey],
    cors: true,
    maxInstances: 10
  },
  async (request) => {
    logger.info("🎨 [generateSingleRecipeImage] Iniciando generación bajo demanda...");

    try {
      // Verify user is authenticated - LOGIN IS REQUIRED
      if (!request.auth) {
        logger.warn("❌ [generateSingleRecipeImage] Usuario no autenticado");
        throw new HttpsError(
          "unauthenticated",
          "Debes iniciar sesión para generar imágenes"
        );
      }

      const userId = request.auth.uid;
      const {title} = request.data;

      logger.info(`📋 [generateSingleRecipeImage] Usuario: ${userId}, Título: ${title}`);

      if (!title) {
        logger.warn("❌ [generateSingleRecipeImage] Título ausente");
        throw new HttpsError(
          "invalid-argument",
          "Se requiere el título de la receta"
        );
      }

      // Check quota BEFORE calling Gemini - works for both Pro and Free users
      const quota = await checkImageQuota(userId);

      if (!quota.canGenerate) {
        const quotaType = quota.isFreeTrial ? "de regalo" : "diarias";
        const nextAction = quota.isFreeTrial
          ? "¡Pasate a Chef Pro para tener 5 imágenes nuevas cada día!"
          : "Mañana tendrás nuevas imágenes disponibles.";

        logger.warn(`🚫 [generateSingleRecipeImage] Usuario ${userId} alcanzó el límite ${quotaType} (${quota.currentCount}/${quota.limit})`);
        throw new HttpsError(
          "resource-exhausted",
          `¡Agotaste tus ${quota.limit} imágenes ${quotaType}! ${nextAction}`
        );
      }

      const quotaType = quota.isFreeTrial ? "regalo" : quota.planType;
      logger.info(`✅ [generateSingleRecipeImage] Cuota verificada: ${quota.currentCount}/${quota.limit} (${quotaType})`);

      const ai = new GoogleGenAI({apiKey: geminiApiKey.value()});

      logger.info("📡 [generateSingleRecipeImage] Llamando a Gemini Flash Image...");
      const imageResult = await generateRecipeImage(ai, title);

      if (imageResult.error) {
        logger.error(`❌ [generateSingleRecipeImage] Error de Gemini: ${imageResult.error}`);
        throw new HttpsError(
          "internal",
          `No se pudo generar la imagen: ${imageResult.error}`
        );
      }

      if (!imageResult.imageUrl) {
        logger.error("❌ [generateSingleRecipeImage] Gemini no devolvió ninguna imagen");
        throw new HttpsError(
          "internal",
          "No se pudo generar la imagen en este momento. Intentá nuevamente."
        );
      }

      // Increment counter ONLY after successful generation
      await incrementImageCounter(userId, quota.isFreeTrial);

      // Return quota info along with the image for frontend display
      const remaining = quota.limit - quota.currentCount - 1;
      logger.info(`✅ [generateSingleRecipeImage] Imagen generada. Quedan ${remaining}/${quota.limit} imágenes`);

      return {
        imageUrl: imageResult.imageUrl,
        quota: {
          remaining,
          limit: quota.limit,
          isFreeTrial: quota.isFreeTrial,
        },
      };
    } catch (error: unknown) {
      logger.error("💥 [generateSingleRecipeImage] Error crítico:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Error al generar la imagen");
    }
  }
);


