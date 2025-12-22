import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChefHat, ArrowLeft, Sparkles, UtensilsCrossed } from 'lucide-react';
import { Recipe } from '../types';
import { RecipeSpotlight } from '../components/RecipeSpotlight';
import { sharedRecipesService } from '../services/sharedRecipesService';
import { useAuth } from '../contexts/AuthContext';

type LoadingState = 'loading' | 'success' | 'error' | 'not_found';

export const SharedRecipePage: React.FC = () => {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const { isPremium } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');

  useEffect(() => {
    const loadRecipe = async () => {
      if (!recipeId) {
        setLoadingState('not_found');
        return;
      }

      try {
        const sharedRecipe = await sharedRecipesService.getSharedRecipe(recipeId);

        if (sharedRecipe) {
          setRecipe(sharedRecipe);
          setLoadingState('success');
        } else {
          setLoadingState('not_found');
        }
      } catch (error) {
        console.error('Error loading shared recipe:', error);
        setLoadingState('error');
      }
    };

    loadRecipe();
  }, [recipeId]);

  const handleGoHome = () => {
    navigate('/');
  };

  // Loading state
  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-2xl animate-pulse"></div>
            <ChefHat size={64} className="relative text-orange-500 animate-bounce" />
          </div>
          <p className="text-gray-600 font-medium">Cargando receta...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (loadingState === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🍽️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Receta no encontrada
          </h1>
          <p className="text-gray-600 mb-8">
            Esta receta no existe o el enlace es incorrecto.
            ¡Pero no te preocupes! Podés crear tus propias recetas deliciosas.
          </p>
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Sparkles size={20} />
            Crear mi receta
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Algo salió mal
          </h1>
          <p className="text-gray-600 mb-8">
            No pudimos cargar la receta. Por favor, intentá de nuevo más tarde.
          </p>
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft size={20} />
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  // Success state - show the recipe
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2 text-gray-600 hover:text-orange-500 transition-colors font-medium"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Volver al inicio</span>
          </button>

          <div className="flex items-center gap-2">
            <ChefHat className="w-8 h-8 text-orange-500" />
            <span className="text-xl font-bold text-gray-900">¿Qué cocino hoy?</span>
          </div>

          <button
            onClick={handleGoHome}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 text-sm"
          >
            <span className="hidden sm:inline">Crear mi receta</span>
            <Sparkles size={18} className="sm:hidden" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-8">
        {recipe && (
          <RecipeSpotlight
            recipe={recipe}
            isPremium={isPremium}
          />
        )}
      </main>

      {/* Viral CTA Section - Always visible */}
      <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-500 py-10 px-4 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-yellow-300/20 rounded-full blur-3xl"></div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full mb-4">
            <UtensilsCrossed size={32} className="text-white" />
          </div>

          {/* Headline */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 drop-shadow-md">
            Hacé tu propia receta con lo que tenés en la heladera
          </h2>

          {/* Subheadline */}
          <p className="text-white/90 text-lg mb-6 max-w-xl mx-auto">
            Ingresá tus ingredientes y nuestra IA te genera recetas deliciosas en segundos. ¡Gratis!
          </p>

          {/* CTA Button */}
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-orange-600 font-bold text-lg rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group"
          >
            <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
            <span>Crear mi receta ahora</span>
          </button>

          {/* Social proof */}
          <p className="text-white/70 text-sm mt-4">
            +10.000 recetas generadas esta semana
          </p>
        </div>
      </div>
    </div>
  );
};
