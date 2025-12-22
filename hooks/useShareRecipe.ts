import { useState, useCallback } from 'react';
import { Recipe } from '../types';
import { sharedRecipesService } from '../services/sharedRecipesService';

interface UseShareRecipeReturn {
  isSharing: boolean;
  shareViaWhatsApp: (recipe: Recipe) => Promise<void>;
  getShareUrl: (recipeId: string) => string;
}

/**
 * Centralized hook for sharing recipes via WhatsApp with dynamic links.
 * This ensures viral growth by directing users to the app instead of just sharing text.
 *
 * Usage:
 * const { isSharing, shareViaWhatsApp } = useShareRecipe();
 * <button onClick={() => shareViaWhatsApp(recipe)} disabled={isSharing}>Compartir</button>
 */
export const useShareRecipe = (): UseShareRecipeReturn => {
  const [isSharing, setIsSharing] = useState(false);

  /**
   * Share a recipe via WhatsApp with a dynamic link.
   * 1. Saves the recipe to Firestore (shared_recipes collection)
   * 2. Generates a shareable URL
   * 3. Opens WhatsApp with a viral message
   */
  const shareViaWhatsApp = useCallback(async (recipe: Recipe) => {
    if (!recipe || !recipe.id) {
      console.error('Cannot share: invalid recipe');
      return;
    }

    if (isSharing) return;
    setIsSharing(true);

    try {
      // Save recipe to Firestore for public access
      await sharedRecipesService.shareRecipe(recipe);

      // Generate viral WhatsApp message with link
      const shareUrl = sharedRecipesService.getShareUrl(recipe.id);
      const message = `¡Mirá esta receta de ${recipe.title} que encontré en Qué Cocino Hoy! \n\n${shareUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error sharing recipe:', error);
      // Silent fail - user can try again
    } finally {
      setIsSharing(false);
    }
  }, [isSharing]);

  /**
   * Get the shareable URL for a recipe (without opening WhatsApp)
   */
  const getShareUrl = useCallback((recipeId: string): string => {
    return sharedRecipesService.getShareUrl(recipeId);
  }, []);

  return {
    isSharing,
    shareViaWhatsApp,
    getShareUrl,
  };
};
