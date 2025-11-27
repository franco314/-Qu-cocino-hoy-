import { Recipe } from '../types';

const STORAGE_KEY = 'que_cocino_hoy_favorites';

/**
 * Service to handle favorite recipes.
 * Designed with async methods to easily swap localStorage with Firestore/API calls in the future.
 */
export const favoritesService = {
  
  /**
   * Retrieve all favorite recipes.
   */
  getFavorites: async (): Promise<Recipe[]> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Filter out corrupted data
        return parsed.filter(item => item && typeof item === 'object' && item.id);
      }
      return [];
    } catch (error) {
      console.error("Error loading favorites", error);
      return [];
    }
  },

  /**
   * Toggle a recipe as favorite.
   * Returns the new list of favorites.
   */
  toggleFavorite: async (recipe: Recipe): Promise<Recipe[]> => {
    try {
      // Validate input recipe
      if (!recipe || !recipe.id) return [];

      const stored = localStorage.getItem(STORAGE_KEY);
      let favorites: Recipe[] = stored ? JSON.parse(stored) : [];
      
      // Ensure favorites is an array
      if (!Array.isArray(favorites)) favorites = [];
      
      const exists = favorites.some(f => f && f.id === recipe.id);
      
      if (exists) {
        favorites = favorites.filter(f => f && f.id !== recipe.id);
      } else {
        // IMPORTANT: Strip imageUrl before saving to local storage
        // This prevents exceeding localStorage quota (usually 5MB) which causes crashes
        const { imageUrl, ...recipeWithoutImage } = recipe;
        favorites.push(recipeWithoutImage as Recipe);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      return favorites;
    } catch (error) {
      console.error("Error saving favorite", error);
      // Even if saving fails (e.g. quota full), return current favorites to keep UI stable
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
  },

  /**
   * Check if a recipe is in favorites (synchronous helper for UI rendering if needed, 
   * though usually we rely on the state list)
   */
  isFavoriteSync: (recipeId: string): boolean => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    try {
      const favorites: Recipe[] = JSON.parse(stored);
      if (!Array.isArray(favorites)) return false;
      return favorites.some(f => f && f.id === recipeId);
    } catch {
      return false;
    }
  }
};