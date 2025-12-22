export interface Recipe {
  id: string;
  title: string;
  description: string;
  preparationTime: string;
  difficulty: string;
  calories: number;
  ingredientsNeeded: string[];
  missingIngredients: string[];
  instructions: string[];
  imageUrl?: string;
  macros?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

export enum AppState {
  INPUT = 'INPUT',
  LOADING = 'LOADING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}