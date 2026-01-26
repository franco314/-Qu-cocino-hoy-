import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Service to handle Firebase Storage operations.
 */
export const storageService = {
  /**
   * Persists a recipe image to Firebase Storage for permanent access.
   * Handles both Base64 data and external HTTP URLs.
   * @param userId - The ID of the user owning the recipe
   * @param recipeId - The ID of the recipe
   * @param imageSrc - The image source (Base64 or URL)
   * @returns The permanent download URL from Firebase Storage
   */
  persistRecipeImage: async (userId: string, recipeId: string, imageSrc: string): Promise<string> => {
    try {
      // 1. Prepare the reference (Unified path as requested)
      // Path: recipes/{userId}/{recipeId}.png
      const storageRef = ref(storage, `recipes/${userId}/${recipeId}.png`);
      
      let blob: Blob;
      let contentType: string;

      // 2. Determine source type and convert to Blob
      if (imageSrc.startsWith('data:image')) {
        // Handle Base64
        const parts = imageSrc.split(';base64,');
        contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);

        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        blob = new Blob([uInt8Array], { type: contentType });
      } else if (imageSrc.startsWith('http')) {
        // Handle External URL (Gemini temporary link)
        const response = await fetch(imageSrc);
        if (!response.ok) throw new Error(`Failed to fetch external image: ${response.statusText}`);
        blob = await response.blob();
        contentType = blob.type || 'image/png';
      } else {
        throw new Error('Unsupported image source format');
      }

      // 3. Upload to Storage with professional metadata
      await uploadBytes(storageRef, blob, {
        contentType: contentType,
        cacheControl: 'public,max-age=31536000', // Browser Caching optimization (1 year)
        customMetadata: {
          recipeId: recipeId,
          userId: userId,
          persistenceType: 'permanent_premium',
          uploadedAt: new Date().toISOString()
        }
      });

      // 4. Get and return permanent download URL
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error("Error persisting image to Storage:", error);
      throw new Error(`Failed to persist image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};
