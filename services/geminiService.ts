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
    throw new Error(error.message || "Error al disparar la generación de imagen");
  }
};