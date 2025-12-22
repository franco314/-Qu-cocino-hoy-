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
  dietFilters: DietFilters = { vegetarian: false, vegan: false, glutenFree: false }
): Promise<Recipe[]> => {
  try {
    const generateRecipesFunction = httpsCallable(functions, "generateRecipes");

    const response = await generateRecipesFunction({
      ingredients,
      useStrictMatching,
      excludeRecipes,
      isPremium,
      dietFilters,
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