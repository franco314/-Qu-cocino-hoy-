import { getFirestore, collection, doc, getDocs, setDoc, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const HISTORY_KEY = 'que_cocino_hoy_history';
const MAX_HISTORY_ITEMS = 3;

/**
 * Service to handle search history.
 * Now uses Firestore for cloud synchronization across devices.
 * Falls back to localStorage if user is not authenticated.
 */
export const historyService = {
  /**
   * Get the list of recent ingredient sets with strict validation.
   */
  getHistory: async (): Promise<string[][]> => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      // If user is authenticated, use Firestore
      if (user) {
        const db = getFirestore();
        const historyRef = collection(db, 'users', user.uid, 'searchHistory');
        const q = query(historyRef, orderBy('timestamp', 'desc'), limit(MAX_HISTORY_ITEMS));
        const querySnapshot = await getDocs(q);

        const history: string[][] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data && Array.isArray(data.ingredients) && data.ingredients.every((i: any) => typeof i === 'string')) {
            history.push(data.ingredients);
          }
        });

        return history;
      }

      // Fallback to localStorage if not authenticated
      const stored = localStorage.getItem(HISTORY_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);

      if (!Array.isArray(parsed)) return [];

      return parsed.filter(item =>
        Array.isArray(item) && item.every(i => typeof i === 'string')
      );
    } catch (error) {
      console.error("Error loading history", error);
      return [];
    }
  },

  /**
   * Add a new set of ingredients to history.
   * Maintains only the last MAX_HISTORY_ITEMS.
   */
  addToHistory: async (ingredients: string[]): Promise<string[][]> => {
    if (!ingredients || ingredients.length === 0) return await historyService.getHistory();

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      // If user is authenticated, use Firestore
      if (user) {
        const db = getFirestore();
        const newSetSignature = [...ingredients].sort().join(',');

        // Get current history to check for duplicates
        const history = await historyService.getHistory();

        // Remove duplicate if exists (we'll re-add it with new timestamp)
        const historyRef = collection(db, 'users', user.uid, 'searchHistory');
        const querySnapshot = await getDocs(historyRef);

        for (const docSnapshot of querySnapshot.docs) {
          const data = docSnapshot.data();
          if (data && Array.isArray(data.ingredients)) {
            const existingSignature = [...data.ingredients].sort().join(',');
            if (existingSignature === newSetSignature) {
              await deleteDoc(docSnapshot.ref);
            }
          }
        }

        // Add new entry with current timestamp
        const timestamp = Date.now();
        const historyDocRef = doc(db, 'users', user.uid, 'searchHistory', `search_${timestamp}`);
        await setDoc(historyDocRef, {
          ingredients: [...ingredients],
          timestamp
        });

        // Get all history and trim to MAX_HISTORY_ITEMS
        const allHistory = await getDocs(query(historyRef, orderBy('timestamp', 'desc')));
        const docs = allHistory.docs;

        // Delete older entries if we exceed the limit
        if (docs.length > MAX_HISTORY_ITEMS) {
          for (let i = MAX_HISTORY_ITEMS; i < docs.length; i++) {
            await deleteDoc(docs[i].ref);
          }
        }

        return await historyService.getHistory();
      }

      // Fallback to localStorage if not authenticated
      let history = await historyService.getHistory();

      const newSetSignature = [...ingredients].sort().join(',');

      // Remove existing duplicate if present (to move it to top)
      history = history.filter(set => [...set].sort().join(',') !== newSetSignature);

      // Add new set to the beginning
      history.unshift([...ingredients]);

      // Trim to max size
      if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      return history;
    } catch (error) {
      console.error("Error saving history", error);
      return [];
    }
  }
};
