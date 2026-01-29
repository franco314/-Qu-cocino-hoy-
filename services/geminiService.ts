import { Recipe } from "../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

export interface DietFilters {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
}

/**
 * Service to generate recipes using Firebase Cloud Functions.
 * This keeps the Gemini API key secure on the server side.
 */
export const generateRecipes = async (
  ingredients: string[],
  useStrictMatching: boolean,
  excludeRecipes: string[] = [],
  isPremium: boolean = false,
  dietFilters: DietFilters = { vegetarian: false, vegan: false, glutenFree: false },
  shouldGenerateImage: boolean = true
): Promise<Recipe[]> => {
  try {
    const generateRecipesFunction = httpsCallable(functions, "generateRecipes");

    const response = await generateRecipesFunction({
      ingredients,
      useStrictMatching,
      excludeRecipes,
      isPremium,
      dietFilters,
      shouldGenerateImage,
    });

    const data = response.data as { recipes: Recipe[] };

    if (!data || !data.recipes || !Array.isArray(data.recipes)) {
      throw new Error("Respuesta inválida del servidor");
    }

    return data.recipes;
  } catch (error: any) {
    console.error("Error generating recipes:", error);

    // Handle Firebase Function errors
    if (error.code === "functions/unauthenticated") {
      throw new Error("Debes iniciar sesión para generar recetas");
    }

    if (error.code === "functions/invalid-argument") {
      throw new Error("Por favor ingresá al menos un ingrediente");
    }

    if (error.message) {
      throw new Error(error.message);
    }

    throw new Error("No se pudo generar las recetas. Intente nuevamente.");
  }
};

/**
 * Response type for image generation including quota information
 */
export interface ImageGenerationResult {
  imageUrl: string;
  quota?: {
    remaining: number;
    limit: number;
    isFreeTrial: boolean;
  };
}

/**
 * Generates a single image for a recipe title.
 * - Pro users: 5 images/day (resets daily)
 * - Free users: 3 images one-time gift (never resets)
 * Login is REQUIRED.
 */
export const generateSingleImage = async (
  title: string
): Promise<ImageGenerationResult> => {
  try {
    const generateImageFunction = httpsCallable(functions, "generateSingleRecipeImage");
    const response = await generateImageFunction({ title });
    const data = response.data as ImageGenerationResult;

    if (!data || !data.imageUrl) {
      throw new Error("No se pudo obtener la imagen");
    }

    return data;
  } catch (error: any) {
    console.error("Error generating single image:", error);

    // Handle Firebase Cloud Function errors
    const errorCode = error.code || '';
    let errorMessage = error.message || '';

    // Clean up Firebase's error code format
    const cleanErrorCode = errorCode.replace('functions/', '');

    // Try to extract the actual error message
    if (!errorMessage && error.details) {
      errorMessage = error.details;
    }

    // If we got a specific error message from the backend, use it as-is
    if (errorMessage && errorMessage.trim().length > 0) {
      throw new Error(errorMessage);
    }

    // Fallback messages for specific error codes
    const fallbackMessages: { [key: string]: string } = {
      'resource-exhausted':
        "¡Agotaste tus imágenes! Pasate a Chef Pro para tener 5 nuevas imágenes cada día.",
      'unauthenticated':
        "Debes iniciar sesión para generar imágenes",
      'invalid-argument':
        "Se requiere el título de la receta",
      'internal':
        "No se pudo generar la imagen en este momento. Intenta nuevamente.",
    };

    const fallbackMessage = fallbackMessages[cleanErrorCode];
    if (fallbackMessage) {
      throw new Error(fallbackMessage);
    }

    throw new Error("No se pudo generar la imagen. Intenta nuevamente.");
  }
};