import { Recipe } from '../types';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Service to handle shared recipes.
 * Stores recipes in Firestore so they can be accessed via shareable links.
 */
export const sharedRecipesService = {

  /**
   * Save a recipe to the shared_recipes collection.
   * Uses the recipe's existing ID as the document ID.
   * Returns the recipe ID for building the share URL.
   */
  shareRecipe: async (recipe: Recipe): Promise<string> => {
    try {
      if (!recipe || !recipe.id) {
        throw new Error('Invalid recipe');
      }

      const db = getFirestore();
      const recipeRef = doc(db, 'shared_recipes', recipe.id);

      // Check if already shared
      const existingDoc = await getDoc(recipeRef);
      if (existingDoc.exists()) {
        // Already shared, just return the ID
        return recipe.id;
      }

      // Save the recipe (without imageUrl to save storage space)
      const { imageUrl, ...recipeWithoutImage } = recipe;
      await setDoc(recipeRef, {
        ...recipeWithoutImage,
        sharedAt: new Date().toISOString(),
      });

      return recipe.id;
    } catch (error) {
      console.error('Error sharing recipe:', error);
      throw error;
    }
  },

  /**
   * Retrieve a shared recipe by its ID.
   * Returns null if not found.
   */
  getSharedRecipe: async (recipeId: string): Promise<Recipe | null> => {
    try {
      if (!recipeId) return null;

      const db = getFirestore();
      const recipeRef = doc(db, 'shared_recipes', recipeId);
      const docSnap = await getDoc(recipeRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return data as Recipe;
      }

      return null;
    } catch (error) {
      console.error('Error getting shared recipe:', error);
      return null;
    }
  },

  /**
   * Generate the share URL for a recipe.
   */
  getShareUrl: (recipeId: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/recipe/${recipeId}`;
  },

  /**
   * Generate WhatsApp share link with recipe URL.
   */
  getWhatsAppShareUrl: (recipeId: string, recipeTitle: string): string => {
    const shareUrl = sharedRecipesService.getShareUrl(recipeId);
    const message = `¡Mirá esta receta que encontré! ${recipeTitle} ${shareUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
};
