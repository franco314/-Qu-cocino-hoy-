import { useState, useCallback, useEffect } from 'react';
import {
  ChefHat,
  Utensils,
  Sparkles,
  ArrowRight,
  Heart,
  Search,
  Layers,
  CheckCircle2,
  Shuffle,
  XCircle,
  Lock,
  Leaf,
  Wheat
} from 'lucide-react';
import { IngredientInput } from '../components/IngredientInput';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeSpotlight } from '../components/RecipeSpotlight';
import { LoginButton } from '../components/LoginButton';
import { UserProfile } from '../components/UserProfile';
import { FavoriteLimitModal } from '../components/FavoriteLimitModal';
import { useAuth } from '../contexts/AuthContext';
import { generateRecipes } from '../services/geminiService';
import { favoritesService } from '../services/favoritesService';
import { historyService } from '../services/historyService';
import { Recipe, AppState } from '../types';

type Tab = 'SEARCH' | 'FAVORITES';

interface DietFilters {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
}

export const HomePage = () => {
  const { user, isPremium, isSubscribing, startSubscription, devTogglePremium } = useAuth();

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
  // Diet filters state
  const [dietFilters, setDietFilters] = useState<DietFilters>({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
  });

  // Favorite limit modal state
  const [showFavoriteLimitModal, setShowFavoriteLimitModal] = useState(false);

  // Constants
  const FREE_FAVORITES_LIMIT = 3;

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

  // Unified recipe generation logic
  const executeGeneration = async (excludeTitles: string[], isRegeneration: boolean) => {
    setError(null);
    setAppState(AppState.LOADING);

    if (!isRegeneration) {
      setAllGeneratedTitles([]);
    }

    try {
      // Save to history only on first generation
      if (!isRegeneration) {
        try {
          const updatedHistory = await historyService.addToHistory(ingredients);
          setHistory(updatedHistory);
        } catch (hErr) {
          console.warn("Could not save history", hErr);
        }
      }

      const result = await generateRecipes(ingredients, useStrictMatching, excludeTitles, isPremium, dietFilters);
      setRecipes(result);

      // Update titles: reset on fresh search, append on regeneration
      if (isRegeneration) {
        setAllGeneratedTitles(prev => [...prev, ...result.map(r => r.title)]);
      } else {
        setAllGeneratedTitles(result.map(r => r.title));
      }

      setAppState(AppState.RESULTS);
    } catch (err) {
      const errorMessage = isRegeneration
        ? "Ocurrió un error inesperado al regenerar."
        : "Ocurrió un error inesperado.";
      setError(err instanceof Error ? err.message : errorMessage);
      setAppState(AppState.ERROR);
    }
  };

  const handleGenerate = async () => {
    if (ingredients.length === 0) {
      setError("Por favor ingresá al menos un ingrediente para comenzar.");
      return;
    }
    await executeGeneration([], false);
  };

  const handleRegenerate = async () => {
    await executeGeneration(allGeneratedTitles, true);
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
        // Check if recipe is already a favorite
        const isCurrentlyFavorite = favorites.some(f => f && f.id === recipe.id);

        // If trying to ADD a new favorite (not remove)
        if (!isCurrentlyFavorite) {
          // Check if user is FREE and already has 3 favorites
          if (!isPremium && favorites.length >= FREE_FAVORITES_LIMIT) {
            // Show modal instead of adding
            setShowFavoriteLimitModal(true);
            return;
          }
        }

        // Proceed with toggle (either removing or adding within limits)
        const newFavorites = await favoritesService.toggleFavorite(recipe);
        setFavorites(newFavorites);
    } catch (e) {
        console.error("Error toggling favorite", e);
    }
  };

  const handleDeleteFavorite = async (recipe: Recipe) => {
    try {
        const newFavorites = await favoritesService.toggleFavorite(recipe);
        setFavorites(newFavorites);
    } catch (e) {
        console.error("Error deleting favorite", e);
    }
  };

  const isFavorite = (recipeId: string) => favorites.some(f => f && f.id === recipeId);

  // Check if user can add more favorites (Premium = unlimited, Free = max 3)
  const canAddMoreFavorites = (recipeId: string) => {
    // If already a favorite, user can always toggle it off
    if (isFavorite(recipeId)) return true;

    // Premium users have no limit
    if (isPremium) return true;

    // Free users can only have up to FREE_FAVORITES_LIMIT
    return favorites.length < FREE_FAVORITES_LIMIT;
  };

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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Mis Recetas Guardadas</h2>
                  <p className="text-gray-500">Tus platos favoritos listos para volver a cocinar.</p>
                </div>
                {/* Favorites counter and Premium CTA - only show for Free users */}
                {!isPremium && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`px-4 py-2 rounded-full border-2 flex items-center gap-2 ${
                      favorites.length >= FREE_FAVORITES_LIMIT
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}>
                      <Heart size={16} className={favorites.length >= FREE_FAVORITES_LIMIT ? 'fill-red-500 text-red-500' : ''} />
                      <span className="font-semibold text-sm">
                        {favorites.length}/{FREE_FAVORITES_LIMIT} recetas guardadas
                      </span>
                      {favorites.length >= FREE_FAVORITES_LIMIT && (
                        <Lock size={14} className="text-red-600" />
                      )}
                    </div>
                    {/* Premium CTA Button - Calls startSubscription directly */}
                    <button
                      onClick={startSubscription}
                      disabled={isSubscribing}
                      className="px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-300 flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                    >
                      {isSubscribing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Procesando...</span>
                        </>
                      ) : (
                        <>
                          <span>✨</span>
                          <span>Plan Chef</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
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
                    onDeleteFavorite={handleDeleteFavorite}
                    canAddToFavorites={canAddMoreFavorites(recipe.id)}
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

                {/* Diet Filters */}
                <div className="flex gap-2 mb-4 w-full max-w-md justify-center flex-wrap">
                  {/* Vegetariano - Available for all */}
                  <button
                    onClick={() => setDietFilters(prev => ({ ...prev, vegetarian: !prev.vegetarian }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border ${
                      dietFilters.vegetarian
                        ? 'bg-green-500 text-white border-green-500 shadow-md'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'
                    }`}
                  >
                    <Leaf size={14} />
                    <span>Vegetariano</span>
                  </button>

                  {/* Vegano - Premium only */}
                  <button
                    onClick={() => isPremium && setDietFilters(prev => ({ ...prev, vegan: !prev.vegan }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border ${
                      !isPremium
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : dietFilters.vegan
                          ? 'bg-green-600 text-white border-green-600 shadow-md'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-green-500 hover:text-green-600'
                    }`}
                    disabled={!isPremium}
                    title={!isPremium ? 'Disponible en Premium' : 'Filtrar recetas veganas'}
                  >
                    {!isPremium && <Lock size={12} className="text-gray-400" />}
                    <Leaf size={14} />
                    <span>Vegano</span>
                  </button>

                  {/* Sin TACC - Premium only */}
                  <button
                    onClick={() => isPremium && setDietFilters(prev => ({ ...prev, glutenFree: !prev.glutenFree }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border ${
                      !isPremium
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : dietFilters.glutenFree
                          ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-amber-500 hover:text-amber-600'
                    }`}
                    disabled={!isPremium}
                    title={!isPremium ? 'Disponible en Premium' : 'Filtrar recetas sin gluten'}
                  >
                    {!isPremium && <Lock size={12} className="text-gray-400" />}
                    <Wheat size={14} />
                    <span>Sin TACC</span>
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

            {/* Results State - Single Spotlight Recipe */}
            {appState === AppState.RESULTS && recipes.length > 0 && (
              <div className="animate-fade-in pb-12">
                {/* Header Minimalista */}
                <div className="flex justify-between items-center mb-8 max-w-6xl mx-auto px-4">
                  <button
                    onClick={handleReset}
                    className="text-gray-500 hover:text-black font-medium transition-colors flex items-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    Volver a ingredientes
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={handleReset}
                      className="text-sm font-medium text-gray-500 hover:text-black transition-colors bg-white px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300 shadow-sm"
                    >
                      Nueva búsqueda
                    </button>
                  </div>
                </div>

                {/* El Nuevo Componente Spotlight */}
                <RecipeSpotlight
                  recipe={recipes[0]}
                  isFavorite={isFavorite(recipes[0].id)}
                  onToggleFavorite={handleToggleFavorite}
                  onDeleteFavorite={handleDeleteFavorite}
                  isPremium={isPremium}
                  canAddToFavorites={canAddMoreFavorites(recipes[0].id)}
                  onLimitReached={() => setShowFavoriteLimitModal(true)}
                />

                {/* Botonera de Regeneración */}
                <div className="mt-10 flex flex-col items-center justify-center">
                  <p className="text-gray-400 text-sm mb-4 font-medium uppercase tracking-wider">
                    ¿No es lo que buscabas?
                  </p>
                  <button
                    onClick={handleRegenerate}
                    className="group relative inline-flex items-center gap-3 bg-white border-2 border-orange-100 text-gray-800 px-8 py-4 rounded-full font-bold shadow-sm hover:shadow-xl hover:border-orange-200 hover:scale-105 transition-all duration-300 overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Shuffle className="w-5 h-5 text-orange-500 group-hover:rotate-180 transition-transform duration-500" />
                      Probar otra opción
                    </span>
                    <div className="absolute inset-0 bg-orange-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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

      {/* DEV TOOLS - Toggle para testing */}
      <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-xl z-50 text-xs shadow-2xl backdrop-blur-md border border-gray-700">
        <p className="font-bold mb-2 text-gray-400 uppercase tracking-wider">DEV: Estado</p>
        <div className="flex gap-2">
          <button
            onClick={devTogglePremium}
            className={`px-3 py-1.5 rounded transition-colors ${isPremium ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white font-bold' : 'bg-gray-700 text-gray-300'}`}
          >
            {isPremium ? '✨ Premium' : '🌑 Free'}
          </button>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-600 text-[10px] text-gray-400 text-center">
          {isPremium ? 'Generando Img + Filtros' : 'Solo Texto'}
        </div>
      </div>

      {/* Favorite Limit Modal */}
      <FavoriteLimitModal
        isOpen={showFavoriteLimitModal}
        onClose={() => setShowFavoriteLimitModal(false)}
        onUpgrade={startSubscription}
      />

      {/* Global Subscription Loading Overlay */}
      {isSubscribing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 animate-fade-in max-w-sm mx-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ChefHat size={24} className="text-orange-500" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Preparando tu suscripción</h3>
              <p className="text-sm text-gray-500">Conectando con Mercado Pago...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
