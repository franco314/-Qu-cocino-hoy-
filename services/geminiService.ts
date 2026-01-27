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
 * Generates a single image for a recipe title.
 * Firebase Cloud Functions errors are caught and translated to user-friendly messages.
 * The backend sends specific error messages that we extract here for the user.
 */
export const generateSingleImage = async (
  title: string,
  isPremium: boolean = false
): Promise<string> => {
  try {
    const generateImageFunction = httpsCallable(functions, "generateSingleRecipeImage");
    const response = await generateImageFunction({ title, isPremium });
    const data = response.data as { imageUrl: string };

    if (!data || !data.imageUrl) {
      throw new Error("No se pudo obtener la imagen");
    }

    return data.imageUrl;
  } catch (error: any) {
    console.error("Error generating single image:", error);

    // Handle Firebase Cloud Function errors
    // Extract error code and message - Firebase preserves the message from backend HttpsError
    const errorCode = error.code || '';
    let errorMessage = error.message || '';

    // Clean up Firebase's error code format (remove 'functions/' prefix for matching)
    const cleanErrorCode = errorCode.replace('functions/', '');

    // Try to extract the actual error message from various possible locations
    // Firebase Cloud Functions may put the message in different places
    if (!errorMessage && error.details) {
      errorMessage = error.details;
    }

    // If we got a specific error message from the backend, use it as-is
    // The backend sends descriptive messages like:
    // - "Has alcanzado el límite de imágenes diarias..."
    // - "No se pudo generar la imagen: {specific error}"
    if (errorMessage && errorMessage.trim().length > 0) {
      throw new Error(errorMessage);
    }

    // Fallback messages for specific error codes
    // These act as defaults if the backend message wasn't extracted
    const fallbackMessages: { [key: string]: string } = {
      'resource-exhausted':
        "Has alcanzado el límite de imágenes diarias de tu plan Chef Pro. Mañana tendrás nuevas imágenes disponibles.",
      'permission-denied':
        "Esta función es exclusiva para usuarios Chef Pro",
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