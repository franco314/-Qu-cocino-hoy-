import { Recipe } from '../types';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { storageService } from './storageService';

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
   * @param recipe - The recipe to toggle
   * @param isPremium - If true, preserves imageUrl for persistent image storage (Premium feature)
   * @param currentFavorites - Optional: pass current favorites to avoid redundant Firestore read
   */
  toggleFavorite: async (recipe: Recipe, isPremium: boolean = false, currentFavorites?: Recipe[]): Promise<Recipe[]> => {
    try {
      // Validate input recipe
      if (!recipe || !recipe.id) return [];

      const auth = getAuth();
      const user = auth.currentUser;

      // If user is authenticated, use Firestore
      if (user) {
        const db = getFirestore();
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', recipe.id);

        // Use provided favorites or fetch from Firestore (optimization: avoid extra read)
        const favorites = currentFavorites ?? await favoritesService.getFavorites();
        const exists = favorites.some(f => f && f.id === recipe.id);

        if (exists) {
          // Remove from favorites
          await deleteDoc(favoriteRef);
          return favorites.filter(f => f && f.id !== recipe.id);
        } else {
          // Add to favorites
          // Premium users: preserve imageUrl for persistent visualization
          // Free users: strip imageUrl to save Firestore storage
          let recipeToSave: Recipe = { ...recipe };
          
          if (isPremium) {
            // If image is Base64 OR it's an external URL (not already in our storage)
            // persist it to Storage to ensure it's permanent and avoid size limits
            const isBase64 = recipeToSave.imageUrl?.startsWith('data:image');
            const isExternalUrl = recipeToSave.imageUrl?.startsWith('http') && !recipeToSave.imageUrl?.includes('firebasestorage.googleapis.com');
            
            if (recipeToSave.imageUrl && (isBase64 || isExternalUrl)) {
              try {
                const downloadUrl = await storageService.persistRecipeImage(user.uid, recipe.id, recipeToSave.imageUrl);
                recipeToSave.imageUrl = downloadUrl;
              } catch (storageErr) {
                console.error("Storage upload failed, attempting to save with original imageUrl anyway:", storageErr);
              }
            }
          } else {
            const { imageUrl, ...recipeWithoutImage } = recipe;
            recipeToSave = recipeWithoutImage as Recipe;
          }
          await setDoc(favoriteRef, recipeToSave);
          return [...favorites, recipeToSave];
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
        // Same logic: Premium preserves image, Free strips it
        let recipeToSave: Recipe;
        if (isPremium) {
          recipeToSave = { ...recipe };
        } else {
          const { imageUrl, ...recipeWithoutImage } = recipe;
          recipeToSave = recipeWithoutImage as Recipe;
        }
        favorites.push(recipeToSave);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      return favorites;
    } catch (error) {
      console.error("Error saving favorite:", error);
      // Re-throw the error so the caller can handle it appropriately
      throw error;
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
