import { Recipe } from '../types';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const STORAGE_KEY = 'que_cocino_hoy_favorites'; // Keep as fallback

/**
 * Service to handle favorite recipes.
 * Now uses Firestore for cloud synchronization across devices.
 * Falls back to localStorage if user is not authenticated.
 */
export const favoritesService = {

  /**
   * Retrieve all favorite recipes.
   */
  getFavorites: async (): Promise<Recipe[]> => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      // If user is authenticated, use Firestore
      if (user) {
        const db = getFirestore();
        const favoritesRef = collection(db, 'users', user.uid, 'favorites');
        const q = query(favoritesRef);
        const querySnapshot = await getDocs(q);

        const favorites: Recipe[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data && typeof data === 'object' && data.id) {
            favorites.push(data as Recipe);
          }
        });

        return favorites;
      }

      // Fallback to localStorage if not authenticated
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
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

      const auth = getAuth();
      const user = auth.currentUser;

      // If user is authenticated, use Firestore
      if (user) {
        const db = getFirestore();
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', recipe.id);

        // Check if already exists
        const favorites = await favoritesService.getFavorites();
        const exists = favorites.some(f => f && f.id === recipe.id);

        if (exists) {
          // Remove from favorites
          await deleteDoc(favoriteRef);
          return favorites.filter(f => f && f.id !== recipe.id);
        } else {
          // Add to favorites (strip imageUrl to save storage)
          const { imageUrl, ...recipeWithoutImage } = recipe;
          await setDoc(favoriteRef, recipeWithoutImage);
          return [...favorites, recipeWithoutImage as Recipe];
        }
      }

      // Fallback to localStorage if not authenticated
      const stored = localStorage.getItem(STORAGE_KEY);
      let favorites: Recipe[] = stored ? JSON.parse(stored) : [];

      if (!Array.isArray(favorites)) favorites = [];

      const exists = favorites.some(f => f && f.id === recipe.id);

      if (exists) {
        favorites = favorites.filter(f => f && f.id !== recipe.id);
      } else {
        const { imageUrl, ...recipeWithoutImage } = recipe;
        favorites.push(recipeWithoutImage as Recipe);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      return favorites;
    } catch (error) {
      console.error("Error saving favorite", error);
      // Return current favorites to keep UI stable
      return await favoritesService.getFavorites();
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
