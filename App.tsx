import React, { useState, useCallback, useEffect } from 'react';
import {
  ChefHat,
  Utensils,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Heart,
  Search,
  Layers,
  CheckCircle2,
  Shuffle,
  XCircle
} from 'lucide-react';
import { IngredientInput } from './components/IngredientInput';
import { RecipeCard } from './components/RecipeCard';
import { LoginButton } from './components/LoginButton';
import { UserProfile } from './components/UserProfile';
import { useAuth } from './contexts/AuthContext';
import { generateRecipes } from './services/geminiService';
import { favoritesService } from './services/favoritesService';
import { historyService } from './services/historyService';
import { Recipe, AppState } from './types';

type Tab = 'SEARCH' | 'FAVORITES';

export default function App() {
  const { user } = useAuth();

  // State changed from object to array of strings
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [history, setHistory] = useState<string[][]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.INPUT);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('SEARCH');
  const [useStrictMatching, setUseStrictMatching] = useState(false);
  // Track all titles generated in this session to avoid duplicates on regenerate
  const [allGeneratedTitles, setAllGeneratedTitles] = useState<string[]>([]);
  
  // Load favorites and history on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const favs = await favoritesService.getFavorites();
        setFavorites(favs);
        const hist = await historyService.getHistory();
        setHistory(hist);
      } catch (e) {
        console.error("Initialization error", e);
      }
    };
    loadData();
  }, []);

  // Session storage persistence
  useEffect(() => {
    const savedSession = sessionStorage.getItem('qch_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.ingredients && Array.isArray(parsed.ingredients)) setIngredients(parsed.ingredients);
        if (parsed.recipes && Array.isArray(parsed.recipes)) setRecipes(parsed.recipes);
        
        // CRITICAL FIX: Prevent getting stuck in LOADING state on reload
        if (parsed.appState === AppState.LOADING) {
          // If we have recipes, go to results, otherwise go back to input
          if (parsed.recipes && Array.isArray(parsed.recipes) && parsed.recipes.length > 0) {
            setAppState(AppState.RESULTS);
          } else {
            setAppState(AppState.INPUT);
          }
        } else if (parsed.appState) {
          setAppState(parsed.appState);
        }

        if (parsed.allGeneratedTitles && Array.isArray(parsed.allGeneratedTitles)) setAllGeneratedTitles(parsed.allGeneratedTitles);
      } catch (e) {
        console.error("Failed to restore session", e);
        // Clear corrupt session
        sessionStorage.removeItem('qch_session');
      }
    }
  }, []);

  // Save session on change
  useEffect(() => {
    // We do NOT save LOADING state to prevent getting stuck if user closes tab during generation
    if (appState !== AppState.LOADING) {
      try {
        // IMPORTANT: Strip heavy Base64 images before saving to session storage
        // Browsers have small storage limits (5MB). Base64 images exceed this quickly and crash the app.
        const recipesWithoutImages = recipes.map(r => {
          const { imageUrl, ...rest } = r;
          return rest;
        });

        const sessionData = {
          ingredients,
          recipes: recipesWithoutImages,
          appState,
          allGeneratedTitles
        };
        sessionStorage.setItem('qch_session', JSON.stringify(sessionData));
      } catch (e) {
        // If quota is exceeded, we just don't save the session, but we DO NOT crash the app
        console.warn("Could not save session (likely quota exceeded):", e);
      }
    }
  }, [ingredients, recipes, appState, allGeneratedTitles]);

  const handleAddIngredient = (ing: string) => {
    setIngredients(prev => [...prev, ing]);
  };

  const handleRemoveIngredient = (ing: string) => {
    setIngredients(prev => prev.filter(i => i !== ing));
  };

  const handleSelectHistory = (selectedIngredients: string[]) => {
    setIngredients(selectedIngredients);
  };

  const handleGenerate = async () => {
    if (ingredients.length === 0) {
      setError("Por favor ingresá al menos un ingrediente para comenzar.");
      return;
    }

    setError(null);
    setAppState(AppState.LOADING);
    setAllGeneratedTitles([]); // Reset history on fresh search

    try {
       // Save to history wrapped in try-catch to prevent crash
      try {
        const updatedHistory = await historyService.addToHistory(ingredients);
        setHistory(updatedHistory);
      } catch (hErr) {
        console.warn("Could not save history", hErr);
      }

      // First generation: no exclusions needed yet, or pass empty array
      const result = await generateRecipes(ingredients, useStrictMatching, []);
      setRecipes(result);
      setAllGeneratedTitles(result.map(r => r.title));
      setAppState(AppState.RESULTS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setAppState(AppState.ERROR);
    }
  };

  const handleRegenerate = async () => {
    setError(null);
    setAppState(AppState.LOADING);
    
    try {
      // Pass the list of titles we've already seen to exclude them
      const result = await generateRecipes(ingredients, useStrictMatching, allGeneratedTitles);
      setRecipes(result);
      // Add new titles to our exclusion list
      setAllGeneratedTitles(prev => [...prev, ...result.map(r => r.title)]);
      setAppState(AppState.RESULTS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado al regenerar.");
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = useCallback(() => {
    setAppState(AppState.INPUT);
    setRecipes([]);
    setAllGeneratedTitles([]);
    setError(null);
    sessionStorage.removeItem('qch_session');
  }, []);

  const handleToggleFavorite = async (recipe: Recipe) => {
    try {
        const newFavorites = await favoritesService.toggleFavorite(recipe);
        setFavorites(newFavorites);
    } catch (e) {
        console.error("Error toggling favorite", e);
    }
  };

  const isFavorite = (recipeId: string) => favorites.some(f => f && f.id === recipeId);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900 flex flex-col">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Fixed Logo */}
            <div className="bg-black text-white p-2 rounded-xl shadow-sm w-10 h-10 flex items-center justify-center">
               <ChefHat size={24} />
            </div>

            {/* Title - Navigates Home */}
            <h1
              className="text-lg md:text-xl font-bold tracking-tight hidden xs:block cursor-pointer hover:text-gray-600 transition-colors"
              onClick={() => {
                setActiveTab('SEARCH');
                if (appState === AppState.RESULTS) handleReset();
              }}
            >
              ¿Qué cocino hoy?
            </h1>
          </div>

          {/* Navigation Tabs and Auth */}
          <div className="flex items-center gap-3">
            <nav className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('SEARCH')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'SEARCH' 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Search size={16} />
              <span className="hidden sm:inline">Buscar</span>
            </button>
            <button
              onClick={() => setActiveTab('FAVORITES')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'FAVORITES' 
                  ? 'bg-white text-red-500 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Heart size={16} className={activeTab === 'FAVORITES' ? "fill-red-500" : ""} />
              <span className="hidden sm:inline">Guardadas</span>
              {favorites.length > 0 && (
                <span className="bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full ml-1">
                  {favorites.length}
                </span>
              )}
            </button>
          </nav>

          {/* Auth Section */}
          {user ? <UserProfile /> : <LoginButton />}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24 w-full flex-grow">
        
        {/* FAVORITES VIEW */}
        {activeTab === 'FAVORITES' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Mis Recetas Guardadas</h2>
              <p className="text-gray-500">Tus platos favoritos listos para volver a cocinar.</p>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Heart className="text-gray-300" size={32} />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aún no guardaste recetas</h3>
                <p className="text-gray-500 mb-6 max-w-xs mx-auto">Cuando encuentres una receta que te guste, presioná el corazón para guardarla aquí.</p>
                <button 
                  onClick={() => setActiveTab('SEARCH')}
                  className="text-orange-600 font-medium hover:text-orange-700 hover:underline"
                >
                  Ir a buscar recetas
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites
                  .filter(recipe => recipe && recipe.id) // Filter valid recipes only
                  .map((recipe) => (
                  <RecipeCard 
                    key={recipe.id} 
                    recipe={recipe} 
                    index={0} 
                    isFavorite={true}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEARCH VIEW */}
        {activeTab === 'SEARCH' && (
          <>
            {/* Hero Section (Only on Input State) */}
            {appState === AppState.INPUT && (
              <div className="text-center mb-12 max-w-2xl mx-auto animate-fade-in-down">
                <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-gray-900 tracking-tight">
                  Decime qué tenés,<br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
                    te digo qué comer.
                  </span>
                </h2>
                <p className="text-lg text-gray-500 leading-relaxed">
                  Ingresá los ingredientes disponibles en tu heladera o alacena y dejá que la IA diseñe el menú ideal.
                </p>
              </div>
            )}

            {/* Input Form (New Omnibox) */}
            {appState === AppState.INPUT && (
              <div className="space-y-8 animate-fade-in-up">
                <IngredientInput 
                  ingredients={ingredients}
                  onAdd={handleAddIngredient}
                  onRemove={handleRemoveIngredient}
                  history={history}
                  onSelectHistory={handleSelectHistory}
                />

                {error && (
                  <div className="p-4 rounded-xl bg-red-50 text-red-600 text-center text-sm font-medium animate-shake max-w-xl mx-auto">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Mode Selection & Generate Button (Input State) */}
            {appState === AppState.INPUT && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-lg border-t border-gray-200 z-40 flex flex-col items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                
                {/* Toggle Switch */}
                <div className="bg-gray-100 p-1 rounded-full flex mb-4 w-full max-w-[340px] relative">
                   <button
                     onClick={() => setUseStrictMatching(false)}
                     className={`flex-1 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 z-10 ${
                       !useStrictMatching ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                     }`}
                   >
                     <Layers size={16} />
                     <span>Usar algunos</span>
                   </button>
                   <button
                     onClick={() => setUseStrictMatching(true)}
                     className={`flex-1 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 z-10 ${
                       useStrictMatching ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                     }`}
                   >
                     <CheckCircle2 size={16} />
                     <span>Usar todo</span>
                   </button>
                </div>

                <button
                  onClick={handleGenerate}
                  className="group w-full max-w-md bg-black text-white px-8 py-3.5 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    Generar Recetas
                  </span>
                  <div className="absolute inset-0 bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>
                
                <div className="mt-2 text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                   {useStrictMatching ? "Modo Desafío: Usaremos todo lo que tenés" : "Modo Flexible: Priorizamos sabor sobre cantidad"}
                </div>
              </div>
            )}

            {/* Space filler for fixed footer */}
            {appState === AppState.INPUT && <div className="h-40" />}

            {/* Loading State */}
            {appState === AppState.LOADING && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] animate-pulse">
                <div className="relative">
                  <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                  <Utensils className="w-16 h-16 text-orange-500 animate-bounce relative z-10" />
                </div>
                <h3 className="mt-8 text-xl font-semibold text-gray-800">
                   {allGeneratedTitles.length > 0 ? "Buscando otras opciones..." : "Analizando ingredientes..."}
                </h3>
                <p className="text-gray-500 mt-2">
                  {useStrictMatching ? "Buscando cómo combinar todo..." : "El chef está pensando la mejor opción."}
                </p>
                <button 
                  onClick={() => setAppState(AppState.INPUT)}
                  className="mt-8 px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:text-gray-800 transition-colors flex items-center gap-2"
                >
                  <XCircle size={14} /> Cancelar y volver
                </button>
              </div>
            )}

            {/* Error State */}
            {appState === AppState.ERROR && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
                <div className="bg-red-100 p-4 rounded-full mb-4">
                  <Utensils className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Algo salió mal</h3>
                <p className="text-gray-600 mb-8 max-w-md">{error}</p>
                <div className="flex gap-4">
                    <button
                    onClick={() => {
                        // Retry the last action based on if we have titles or not
                        if (allGeneratedTitles.length > 0) handleRegenerate();
                        else handleGenerate();
                    }}
                    className="bg-gray-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                    Reintentar
                    </button>
                    <button
                    onClick={handleReset}
                    className="bg-white text-gray-700 border border-gray-300 px-6 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                    Volver al inicio
                    </button>
                </div>
              </div>
            )}

            {/* Results State */}
            {appState === AppState.RESULTS && (
              <div className="animate-fade-in">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Recetas sugeridas</h2>
                    <p className="text-gray-500">
                      {useStrictMatching ? "Desafío completado: Usando tus ingredientes." : "Selección especial basada en tus ingredientes."}
                    </p>
                  </div>
                  <button 
                    onClick={handleReset}
                    className="text-sm font-medium text-gray-500 hover:text-black transition-colors flex items-center gap-1 bg-white px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 shadow-sm"
                  >
                    <RefreshCw size={14} />
                    <span className="hidden sm:inline">Nueva búsqueda</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recipes
                    .filter(r => r && r.id) // Filter valid recipes only
                    .map((recipe, index) => (
                    <RecipeCard 
                      key={recipe.id} 
                      recipe={recipe} 
                      index={index} 
                      isFavorite={isFavorite(recipe.id)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
                
                <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={handleReset}
                    className="inline-flex items-center text-gray-500 hover:text-black font-medium transition-colors px-6 py-3"
                  >
                    <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                    Volver a mis ingredientes
                  </button>

                  <button
                    onClick={handleRegenerate}
                    className="group inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-900 px-8 py-3 rounded-2xl font-semibold shadow-sm hover:shadow-md hover:border-orange-200 hover:bg-orange-50 transition-all duration-300"
                  >
                    <Shuffle className="w-4 h-4 text-orange-500 group-hover:rotate-180 transition-transform duration-500" />
                    Generar otras opciones
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </main>
      
      {/* Simple Footer - Hidden when input is active to avoid clash with fixed button */}
      {appState !== AppState.INPUT && (
        <footer className="bg-white border-t border-gray-100 py-8 mt-auto">
          <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} ¿Qué cocino hoy? · Powered by Gemini AI</p>
          </div>
        </footer>
      )}
    </div>
  );
}