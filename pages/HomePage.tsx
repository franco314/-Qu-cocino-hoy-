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
  Wheat,
  BookOpen,
  Image
} from 'lucide-react';
import { IngredientInput } from '../components/IngredientInput';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeSpotlight } from '../components/RecipeSpotlight';
import { LoginButton } from '../components/LoginButton';
import { UserProfile } from '../components/UserProfile';
import { FavoriteLimitModal, ModalContext } from '../components/FavoriteLimitModal';
import { PWAInstallPrompt, PWAInstallButton } from '../components/PWAInstallPrompt';
import { useAuth } from '../contexts/AuthContext';
import { generateRecipes, generateSingleImage } from '../services/geminiService';
import { favoritesService } from '../services/favoritesService';
import { storageService } from '../services/storageService';
import { historyService } from '../services/historyService';
import { db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Recipe, AppState } from '../types';

type Tab = 'SEARCH' | 'FAVORITES';

interface DietFilters {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
}

export const HomePage = () => {
  const { user, isPremium, isSubscribing, startSubscription } = useAuth();

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
  // Image generation toggle (Premium only, default OFF to save API costs)
  const [withImage, setWithImage] = useState(false);
  // Saving state for loading feedback and preventing double-clicks
  const [isSaving, setIsSaving] = useState(false);
  // Save error state for user feedback
  const [saveError, setSaveError] = useState<string | null>(null);

  // Favorite limit modal state
  const [showFavoriteLimitModal, setShowFavoriteLimitModal] = useState(false);
  const [modalContext, setModalContext] = useState<ModalContext>('limit');

  // Helper to open modal with specific context
  const openPremiumModal = (context: ModalContext) => {
    setModalContext(context);
    setShowFavoriteLimitModal(true);
  };

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

      const result = await generateRecipes(ingredients, useStrictMatching, excludeTitles, isPremium, dietFilters, withImage);
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

  const handleGenerateImage = async (recipe: Recipe) => {
    if (!isPremium || !user) return;

    try {
      // 1. Generate image Base64 from Gemini
      const imageUrlBase64 = await generateSingleImage(recipe.title, isPremium);

      // 2. Persist to Firebase Storage
      const permanentUrl = await storageService.persistRecipeImage(
        user.uid,
        recipe.id,
        imageUrlBase64
      );

      // 3. Update local recipes state
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipe.id ? { ...r, imageUrl: permanentUrl } : r
        )
      );

      // 4. If it's a favorite, update Firestore and local favorites state
      const isFav = favorites.some((f) => f.id === recipe.id);
      if (isFav) {
        const favoriteRef = doc(db, "users", user.uid, "favorites", recipe.id);
        await updateDoc(favoriteRef, { imageUrl: permanentUrl });
        setFavorites((prev) =>
          prev.map((f) =>
            f.id === recipe.id ? { ...f, imageUrl: permanentUrl } : f
          )
        );
      }
    } catch (e: any) {
      console.error("Error generating image on demand:", e);

      // Extract error message - the generateSingleImage service already
      // returns user-friendly messages from the backend
      const errorMessage =
        e instanceof Error ? e.message : "No se pudo generar la imagen";

      setSaveError(errorMessage);
      // Don't auto-dismiss if it's a quota message (user needs to know when they can try again)
      const isQuotaMessage = errorMessage.includes("límite");
      if (!isQuotaMessage) {
        setTimeout(() => setSaveError(null), 5000);
      }
    }
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    // Prevent double-click while saving
    if (isSaving) return;
    
    // Clear any previous error
    setSaveError(null);
    
    try {
        // Check if recipe is already a favorite
        const isCurrentlyFavorite = favorites.some(f => f && f.id === recipe.id);

        // If trying to ADD a new favorite (not remove)
        if (!isCurrentlyFavorite) {
          // Check if user is FREE and already has 3 favorites
          if (!isPremium && favorites.length >= FREE_FAVORITES_LIMIT) {
            // Show modal instead of adding - 'limit' context for restriction message
            openPremiumModal('limit');
            return;
          }
        }

        // Set saving state for visual feedback
        setIsSaving(true);
        
        // Proceed with toggle - pass current favorites to avoid redundant Firestore read
        const newFavorites = await favoritesService.toggleFavorite(recipe, isPremium, favorites);
        setFavorites(newFavorites);
    } catch (e) {
        console.error("Error toggling favorite:", e);
        // Show user-friendly error message
        const errorMessage = e instanceof Error ? e.message : 'Error al guardar la receta';
        // Check if it's a Firestore size limit error
        if (errorMessage.includes('exceeds the maximum') || errorMessage.includes('too large')) {
          setSaveError('La imagen es demasiado grande. Intentá guardar sin imagen.');
        } else {
          setSaveError(`Error: ${errorMessage}`);
        }
        // Auto-clear error after 5 seconds
        setTimeout(() => setSaveError(null), 5000);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteFavorite = async (recipe: Recipe) => {
    // Prevent double-click while saving
    if (isSaving) return;
    
    setSaveError(null);
    
    try {
        setIsSaving(true);
        // Pass current favorites to avoid redundant Firestore read
        const newFavorites = await favoritesService.toggleFavorite(recipe, isPremium, favorites);
        setFavorites(newFavorites);
    } catch (e) {
        console.error("Error deleting favorite:", e);
        const errorMessage = e instanceof Error ? e.message : 'Error al eliminar la receta';
        setSaveError(`Error: ${errorMessage}`);
        setTimeout(() => setSaveError(null), 5000);
    } finally {
        setIsSaving(false);
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

  // Check if we should show the hero background
  const showHeroBackground = appState === AppState.INPUT && activeTab === 'SEARCH';

  // Universal transparent header mode (all views except non-transparent states)
  // Transparent header: Hero, Favorites, Loading, Results
  const useTransparentHeader = showHeroBackground || activeTab === 'FAVORITES' || appState === AppState.LOADING || appState === AppState.RESULTS;

  // Show background image on: Favorites, Loading, Results, Error
  const showBackgroundImage = activeTab === 'FAVORITES' || appState === AppState.LOADING || appState === AppState.RESULTS || appState === AppState.ERROR;

  return (
    <div className={`min-h-screen text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900 flex flex-col relative z-0 ${
      showBackgroundImage ? 'bg-fixed bg-cover bg-center' : ''
    }`} style={showBackgroundImage ? { backgroundImage: 'url(/bg-chef.jpg)' } : undefined}>

      {/* Header - Universal Transparente */}
      <header className={`z-50 transition-all duration-300 ${
        useTransparentHeader
          ? 'absolute top-0 left-0 right-0 bg-transparent'
          : 'sticky top-0 bg-white/70 backdrop-blur-md shadow-sm'
      }`}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-between">
          {/* Left: Logo - adapts to background */}
          <div className="flex items-center gap-2.5">
            <ChefHat
              size={28}
              strokeWidth={1.5}
              className={`${useTransparentHeader ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'text-gray-800 drop-shadow-sm'}`}
            />
            {/* Mostrar nombre solo cuando NO estamos en modo transparente */}
            {!useTransparentHeader && (
              <span className="text-lg font-light tracking-wide text-gray-800">
                ¿Qué cocinamos hoy?
              </span>
            )}
          </div>

          {/* Center: Navigation Tabs (only show when in RESULTS state, not transparent) */}
          {!useTransparentHeader && appState !== AppState.INPUT && (
            <nav className="flex p-0.5 rounded-full bg-gray-100/80 backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('SEARCH')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-1.5 ${
                  activeTab === 'SEARCH'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Search size={13} />
                <span className="hidden sm:inline">Buscar</span>
              </button>
              <button
                onClick={() => setActiveTab('FAVORITES')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-1.5 ${
                  activeTab === 'FAVORITES'
                    ? 'bg-white text-red-500 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Heart size={13} className={activeTab === 'FAVORITES' ? "fill-red-500" : ""} />
                <span className="hidden sm:inline">Guardadas</span>
              </button>
            </nav>
          )}

          {/* Right: Actions - Glassmorphism */}
          <div className="flex items-center gap-2">
            {/* Mis Recetas Button - Visible when logged in, hidden on favorites view */}
            {user && activeTab !== 'FAVORITES' && (
              <button
                onClick={() => setActiveTab('FAVORITES')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-300 ${
                  useTransparentHeader
                    ? 'bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20'
                    : 'bg-gray-100/80 hover:bg-gray-200/80 text-gray-700'
                }`}
                title="Mis Recetas Guardadas"
              >
                <BookOpen
                  size={16}
                  className={`${
                    useTransparentHeader
                      ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
                      : 'text-gray-600'
                  }`}
                />
                <span className={`text-xs font-medium hidden sm:inline ${
                  useTransparentHeader
                    ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
                    : 'text-gray-700'
                }`}>
                  Mis Recetas
                </span>
                {/* Badge with count - only show when not on favorites page */}
                {favorites.length > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    useTransparentHeader
                      ? 'bg-white/30 text-white'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {favorites.length}
                  </span>
                )}
              </button>
            )}

            {/* PWA Install Button - Desktop only, to the left of login */}
            <PWAInstallButton isHeroMode={useTransparentHeader} />

            {/* User Profile / Login */}
            {user ? (
              <UserProfile
                onShowPremiumModal={() => openPremiumModal(useTransparentHeader ? 'home' : 'favorites')}
                isHeroMode={useTransparentHeader}
              />
            ) : (
              <LoginButton isHeroMode={useTransparentHeader} />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24 w-full flex-grow relative z-10">

        {/* FAVORITES VIEW */}
        {activeTab === 'FAVORITES' && (
          <div className="animate-fade-in pt-16">
            {/* Gradient overlay for top readability */}
            <div className="fixed top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/50 via-black/20 to-transparent pointer-events-none z-40" />

            {/* Header section with improved legibility */}
            <div className="mb-8">
              {/* Back button - Glassmorphism style */}
              <button
                onClick={() => setActiveTab('SEARCH')}
                className="mb-6 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-300"
              >
                <ArrowRight className="w-4 h-4 rotate-180 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                <span className="text-sm font-medium text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  Volver a buscar
                </span>
              </button>

              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-1">
                    Mis Recetas Guardadas
                  </h2>
                  <p className="text-white/90 font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                    Tus platos favoritos listos para volver a cocinar.
                  </p>
                </div>
                {/* Favorites counter and Premium CTA - only show for Free users */}
                {!isPremium && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`px-4 py-2 rounded-full backdrop-blur-sm flex items-center gap-2 ${
                      favorites.length >= FREE_FAVORITES_LIMIT
                        ? 'bg-red-500/20 border border-red-400/50 text-white'
                        : 'bg-white/10 border border-white/30 text-white'
                    }`}>
                      <Heart size={16} className={favorites.length >= FREE_FAVORITES_LIMIT ? 'fill-red-400 text-red-400' : 'text-white'} />
                      <span className="font-semibold text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                        {favorites.length}/{FREE_FAVORITES_LIMIT} recetas
                      </span>
                      {favorites.length >= FREE_FAVORITES_LIMIT && (
                        <Lock size={14} className="text-red-300" />
                      )}
                    </div>
                    {/* Premium CTA Button */}
                    <button
                      onClick={() => openPremiumModal('favorites')}
                      className="px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 flex items-center gap-2"
                    >
                      <span>✨</span>
                      <span>Plan Chef Pro</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-20 bg-white/80 backdrop-blur-md rounded-3xl border border-white/30 shadow-lg">
                <div className="mx-auto w-16 h-16 bg-white/60 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
                  <Heart className="text-gray-300" size={32} />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aún no guardaste recetas</h3>
                <p className="text-gray-700 mb-6 max-w-xs mx-auto">Cuando encuentres una receta que te guste, presioná el corazón para guardarla aquí.</p>
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
                    isPremium={isPremium}
                    onGenerateImage={handleGenerateImage}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEARCH VIEW */}
        {activeTab === 'SEARCH' && (
          <>
            {/* Hero Section with Floating UI (Only on Input State) */}
            {appState === AppState.INPUT && (
              <div className="flex flex-col items-center justify-center min-h-[80vh] pt-32 md:pt-20">
                {/* Hero Title - Floating over background */}
                <div className="text-center mb-8 animate-fade-in-down">
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-3 tracking-tight drop-shadow-lg">
                    <span className="text-orange-500">
                      ¿Qué cocino hoy?
                    </span>
                  </h2>
                  <p className="text-lg md:text-xl text-slate-100 drop-shadow-lg font-medium md:text-slate-800">
                    Decime qué tenés, te digo qué comer.
                  </p>
                </div>

                {/* Floating UI Container - Glassmorphism sutil */}
                <div className="w-full max-w-2xl bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 animate-fade-in-up shadow-lg border border-white/30">
                  <IngredientInput
                    ingredients={ingredients}
                    onAdd={handleAddIngredient}
                    onRemove={handleRemoveIngredient}
                    history={history}
                    onSelectHistory={handleSelectHistory}
                  />

                  {error && (
                    <div className="mt-4 p-4 rounded-xl bg-red-500/90 text-white text-center text-sm font-medium animate-shake backdrop-blur-sm">
                      {error}
                    </div>
                  )}

                  {/* Toggle Switch - Glassmorphism style */}
                  <div className="mt-6 flex justify-center">
                    <div className="bg-white/80 backdrop-blur-sm p-1 rounded-full flex w-full max-w-[340px] shadow-lg">
                      <button
                        onClick={() => setUseStrictMatching(false)}
                        className={`flex-1 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                          !useStrictMatching ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        <Layers size={16} />
                        <span>Usar algunos</span>
                      </button>
                      <button
                        onClick={() => setUseStrictMatching(true)}
                        className={`flex-1 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                          useStrictMatching ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        <CheckCircle2 size={16} />
                        <span>Usar todo</span>
                      </button>
                    </div>
                  </div>

                  {/* Diet Filters - Floating chips */}
                  <div className="mt-5 flex gap-2 justify-center flex-wrap">
                    {/* Vegetariano - Available for all */}
                    <button
                      onClick={() => setDietFilters(prev => ({ ...prev, vegetarian: !prev.vegetarian }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 shadow-md backdrop-blur-sm ${
                        dietFilters.vegetarian
                          ? 'bg-green-500 text-white'
                          : 'bg-white/90 text-gray-700 hover:bg-white'
                      }`}
                    >
                      <Leaf size={14} />
                      <span>Vegetariano</span>
                    </button>

                    {/* Sin TACC - Premium only */}
                    <button
                      onClick={() => {
                        if (!isPremium) {
                          openPremiumModal('home');
                        } else {
                          setDietFilters(prev => ({ ...prev, glutenFree: !prev.glutenFree }));
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 shadow-md backdrop-blur-sm ${
                        !isPremium
                          ? 'bg-white/60 text-gray-400 hover:bg-white/80'
                          : dietFilters.glutenFree
                            ? 'bg-amber-500 text-white'
                            : 'bg-white/90 text-gray-700 hover:bg-white'
                      }`}
                      title={!isPremium ? 'Disponible en Plan Chef Pro' : 'Filtrar recetas sin gluten'}
                    >
                      {!isPremium && <Lock size={12} />}
                      <Wheat size={14} />
                      <span>Sin TACC</span>
                    </button>

                    {/* Generate Image Toggle - Premium feature */}
                    <button
                      onClick={() => {
                        if (!isPremium) {
                          openPremiumModal('home');
                        } else {
                          setWithImage(prev => !prev);
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 shadow-md backdrop-blur-sm ${
                        !isPremium
                          ? 'bg-white/60 text-gray-400 hover:bg-white/80'
                          : withImage
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/90 text-gray-700 hover:bg-white'
                      }`}
                      title={!isPremium ? 'Disponible en Plan Chef Pro' : withImage ? 'Generar imagen del plato (activo)' : 'Generar imagen del plato (desactivado)'}
                    >
                      {!isPremium && <Lock size={12} />}
                      <Image size={14} />
                      <span>Con imagen</span>
                    </button>
                  </div>

                  {/* Generate Button - Prominent CTA */}
                  <button
                    onClick={handleGenerate}
                    className="mt-8 w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:from-orange-600 hover:to-orange-700 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    <Sparkles className="w-5 h-5" />
                    Crear con AI
                  </button>
                </div>
              </div>
            )}

            {/* Loading State - Glassmorphism over background */}
            {appState === AppState.LOADING && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] pt-20">
                {/* Gradient overlay for readability */}
                <div className="fixed top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none z-40" />

                {/* Glassmorphism container */}
                <div className="bg-white/20 backdrop-blur-md rounded-3xl p-10 border border-white/30 shadow-2xl flex flex-col items-center">
                  {/* Animated spinner with Glassmorphism */}
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-white/30 backdrop-blur-sm border border-white/40 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-white/20 border-t-orange-500 animate-spin"></div>
                      <Utensils className="w-10 h-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                    </div>
                  </div>

                  {/* Loading text with drop-shadow for legibility */}
                  <h3 className="text-2xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-2 text-center">
                    {allGeneratedTitles.length > 0 ? "Buscando otras opciones..." : "Cocinando tu receta..."}
                  </h3>
                  <p className="text-white/90 font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] text-center mb-6">
                    {useStrictMatching ? "Combinando todos tus ingredientes..." : "El chef está pensando la mejor opción."}
                  </p>

                  {/* Cancel button - Glassmorphism */}
                  <button
                    onClick={() => setAppState(AppState.INPUT)}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 rounded-full transition-all duration-300 flex items-center gap-2"
                  >
                    <XCircle size={14} /> Cancelar y volver
                  </button>
                </div>
              </div>
            )}

            {/* Error State - Glassmorphism over background */}
            {appState === AppState.ERROR && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] pt-20">
                {/* Gradient overlay for readability */}
                <div className="fixed top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none z-40" />

                {/* Glassmorphism container */}
                <div className="bg-white/20 backdrop-blur-md rounded-3xl p-10 border border-white/30 shadow-2xl flex flex-col items-center max-w-md">
                  <div className="w-20 h-20 rounded-full bg-red-500/30 backdrop-blur-sm border border-red-400/50 flex items-center justify-center mb-6">
                    <Utensils className="w-10 h-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                  </div>
                  <h3 className="text-2xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] mb-2 text-center">
                    Algo salió mal
                  </h3>
                  <p className="text-white/90 font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] text-center mb-6">
                    {error}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (allGeneratedTitles.length > 0) handleRegenerate();
                        else handleGenerate();
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300"
                    >
                      Reintentar
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-5 py-2.5 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 rounded-full font-medium transition-all duration-300"
                    >
                      Volver al inicio
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Results State - Single Spotlight Recipe */}
            {appState === AppState.RESULTS && recipes.length > 0 && (
              <div className="animate-fade-in pb-12 pt-16">
                {/* Gradient overlay for top readability */}
                <div className="fixed top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/40 via-black/15 to-transparent pointer-events-none z-40" />

                {/* Navigation Header - Glassmorphism */}
                <div className="flex justify-between items-center mb-8 max-w-6xl mx-auto px-4">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-300"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                    <span className="text-sm font-medium text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      Volver a ingredientes
                    </span>
                  </button>

                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-300"
                  >
                    <Search className="w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                    <span className="text-sm font-medium text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      Nueva búsqueda
                    </span>
                  </button>
                </div>

                {/* El Nuevo Componente Spotlight */}
                <RecipeSpotlight
                  recipe={recipes[0]}
                  isFavorite={isFavorite(recipes[0].id)}
                  onToggleFavorite={handleToggleFavorite}
                  onDeleteFavorite={handleDeleteFavorite}
                  isPremium={isPremium}
                  canAddToFavorites={canAddMoreFavorites(recipes[0].id)}
                  isSaving={isSaving}
                  saveError={saveError}
                  onLimitReached={() => openPremiumModal('limit')}
                  onShowPremiumInfo={() => openPremiumModal('home')}
                  onGenerateImage={handleGenerateImage}
                />

                {/* Botonera de Regeneración - Glassmorphism */}
                <div className="mt-10 flex flex-col items-center justify-center">
                  <p className="text-white/80 text-sm mb-4 font-medium uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    ¿No es lo que buscabas?
                  </p>
                  <button
                    onClick={handleRegenerate}
                    className="group relative inline-flex items-center gap-3 bg-white/20 backdrop-blur-md border border-white/30 text-white px-8 py-4 rounded-full font-bold shadow-lg hover:shadow-xl hover:bg-white/30 hover:scale-105 transition-all duration-300 overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      <Shuffle className="w-5 h-5 text-orange-300 group-hover:rotate-180 transition-transform duration-500" />
                      Probar otra opción
                    </span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* Minimal Footer - Transparent, adapts to all screens */}
      {appState !== AppState.INPUT && (
        <footer className="bg-transparent py-6 mt-auto">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <p className={`text-xs font-medium ${
              showBackgroundImage
                ? 'text-white/70 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
                : 'text-stone-400'
            }`}>
              © 2025 ¿Qué cocino hoy? · @ffran.co
            </p>
          </div>
        </footer>
      )}

      {/* Favorite Limit Modal - Context-aware messaging */}
      <FavoriteLimitModal
        isOpen={showFavoriteLimitModal}
        onClose={() => setShowFavoriteLimitModal(false)}
        onUpgrade={startSubscription}
        context={modalContext}
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

      {/* PWA Install Prompt - Shows contextual install banner/button */}
      <PWAInstallPrompt />
    </div>
  );
};
