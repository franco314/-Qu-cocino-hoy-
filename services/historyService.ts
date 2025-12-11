const HISTORY_KEY = 'que_cocino_hoy_history';
const MAX_HISTORY_ITEMS = 3;

export const historyService = {
  /**
   * Get the list of recent ingredient sets with strict validation.
   */
  getHistory: (): string[][] => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      
      // Strict validation: Must be an array
      if (!Array.isArray(parsed)) return [];
      
      // Filter out any items that are not arrays of strings
      // This prevents "white screen" crashes if corrupted data (like nulls or objects) gets in.
      return parsed.filter(item => 
        Array.isArray(item) && item.every(i => typeof i === 'string')
      );
    } catch (error) {
      console.error("Error loading history", error);
      // In case of corruption, clear storage to fix the app for the user
      try { localStorage.removeItem(HISTORY_KEY); } catch {}
      return [];
    }
  },

  /**
   * Add a new set of ingredients to history.
   * Maintains only the last MAX_HISTORY_ITEMS.
   */
  addToHistory: (ingredients: string[]): string[][] => {
    if (!ingredients || ingredients.length === 0) return historyService.getHistory();

    try {
      let history = historyService.getHistory();
      
      // Create a sorted string signature to check for duplicates (ignoring order)
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
      // Fallback: return current safe history or empty array
      return []; 
    }
  }
};