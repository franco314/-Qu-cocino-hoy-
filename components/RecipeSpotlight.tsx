import React from 'react';
import { Clock, ChefHat, Flame, AlertCircle, List, Heart, Loader2, Trash2, Lock } from 'lucide-react';
import { Recipe } from '../types';
import { useShareRecipe } from '../hooks/useShareRecipe';

interface RecipeSpotlightProps {
  recipe: Recipe;
  isFavorite?: boolean;
  onToggleFavorite?: (recipe: Recipe) => void;
  onDeleteFavorite?: (recipe: Recipe) => void;
  isPremium?: boolean;
  canAddToFavorites?: boolean;
  onLimitReached?: () => void;
}

export const RecipeSpotlight: React.FC<RecipeSpotlightProps> = ({
  recipe,
  isFavorite = false,
  onToggleFavorite,
  onDeleteFavorite,
  isPremium = false,
  canAddToFavorites = true,
  onLimitReached
}) => {
  const { isSharing, shareViaWhatsApp } = useShareRecipe();

  // CRITICAL SAFETY CHECK: If recipe is undefined/null, do not render anything to avoid crash
  if (!recipe) return null;

  // Ensure arrays exist to prevent crashes
  const ingredients = Array.isArray(recipe.ingredientsNeeded) ? recipe.ingredientsNeeded : [];
  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const missingIngredients = Array.isArray(recipe.missingIngredients) ? recipe.missingIngredients : [];

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    shareViaWhatsApp(recipe);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If limit reached and trying to add (not remove), show modal
    if (!isFavorite && !canAddToFavorites && onLimitReached) {
      onLimitReached();
      return;
    }
    if (onToggleFavorite) {
      onToggleFavorite(recipe);
    }
  };

  return (
    <article
      className="bg-white/85 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border border-white/40 transition-all duration-500 hover:shadow-3xl w-full max-w-6xl mx-auto"
      role="article"
      aria-label={`Receta destacada: ${recipe.title}`}
    >
      {/* Hero Layout Container */}
      <div className="flex flex-col md:flex-row">

        {/* Image Section - The Nuclear Fix */}
        <div className="relative w-full md:w-1/2 h-64 md:h-auto overflow-hidden">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="absolute inset-0 w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
            />
          ) : (
            /* Premium Upsell - Locked Image View */
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
              {/* Blurred Pattern Background */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-10 left-10 w-32 h-32 bg-orange-200 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 right-10 w-40 h-40 bg-yellow-200 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gray-300 rounded-full blur-3xl"></div>
              </div>

              {/* Locked Content */}
              <div className="relative z-10 flex flex-col items-center text-center px-8">
                {/* Lock Icon with Camera Slash */}
                <div className="relative mb-4">
                  <div className="w-20 h-20 rounded-full bg-gray-200/80 backdrop-blur-sm flex items-center justify-center border-2 border-gray-300/50">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  {/* Slash Diagonal */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-0.5 bg-red-400 rotate-45"></div>
                  </div>
                </div>

                {/* Premium Message */}
                <p className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Imagen Premium
                </p>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                  Las fotos gastronómicas profesionales son una función exclusiva de la versión Premium
                </p>

                {/* Premium Badge */}
                <div className="mt-4 px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                  ✨ Disponible en Premium
                </div>
              </div>

              {/* Decorative Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent pointer-events-none"></div>
            </div>
          )}

          {/* Gradient Overlay for text readability if needed (only for real images) */}
          {recipe.imageUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent md:hidden" aria-hidden="true" />
          )}

          {/* Difficulty Badge - Top Left */}
          <div className="absolute top-6 left-6 z-10">
            <span className={`px-5 py-2 rounded-full text-sm font-bold tracking-wider uppercase shadow-lg backdrop-blur-md ${
              recipe.difficulty === 'Fácil' ? 'bg-green-600/90 text-white' :
              recipe.difficulty === 'Media' ? 'bg-yellow-300/95 text-yellow-900' :
              'bg-red-600/90 text-white'
            }`}>
              {recipe.difficulty}
            </span>
          </div>
        </div>

        {/* Right: Content Section (50%) */}
        <div className="w-full md:w-1/2 flex flex-col p-8 md:p-12">

          {/* Header */}
          <div className="mb-6">
            {/* Meta Info */}
            <div className="flex items-center gap-6 text-gray-500 text-sm font-bold uppercase tracking-wider mb-4">
              <div className="flex items-center gap-2" title={`${recipe.calories} calorías`}>
                <Flame size={18} className="text-orange-600" aria-hidden="true" />
                <span aria-label={`${recipe.calories} calorías`}>{recipe.calories} kcal</span>
              </div>
              <div className="flex items-center gap-2" title={`Tiempo de preparación: ${recipe.preparationTime}`}>
                <Clock size={18} className="text-blue-600" aria-hidden="true" />
                <span aria-label={`Tiempo de preparación: ${recipe.preparationTime}`}>{recipe.preparationTime}</span>
              </div>
            </div>

            {/* Macros Section */}
            {recipe.macros && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/40 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  {/* Proteínas */}
                  <div className="flex-1 text-center">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                      Proteínas
                    </p>
                    {isPremium ? (
                      <p className="text-lg font-bold text-orange-600">
                        {recipe.macros.protein}g
                      </p>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <p className="text-lg font-bold text-gray-400 blur-sm select-none">
                          {recipe.macros.protein}g
                        </p>
                        <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Carbohidratos */}
                  <div className="flex-1 text-center border-l border-r border-orange-200">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                      Carbos
                    </p>
                    {isPremium ? (
                      <p className="text-lg font-bold text-orange-600">
                        {recipe.macros.carbs}g
                      </p>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <p className="text-lg font-bold text-gray-400 blur-sm select-none">
                          {recipe.macros.carbs}g
                        </p>
                        <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Grasas */}
                  <div className="flex-1 text-center">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                      Grasas
                    </p>
                    {isPremium ? (
                      <p className="text-lg font-bold text-orange-600">
                        {recipe.macros.fat}g
                      </p>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <p className="text-lg font-bold text-gray-400 blur-sm select-none">
                          {recipe.macros.fat}g
                        </p>
                        <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-[9px] text-gray-400 text-center mt-2 leading-tight">
                  Valores nutricionales estimados basados en ingredientes estándar
                </p>
              </div>
            )}

            {/* Title - High contrast for readability */}
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 leading-tight tracking-tight">
              {recipe.title}
            </h1>

            {/* Description */}
            <p className="text-lg text-gray-600 leading-relaxed">
              {recipe.description}
            </p>
          </div>

          {/* Missing Ingredients Alert */}
          {missingIngredients.length > 0 && (
            <div
              className="bg-orange-500/10 backdrop-blur-sm px-5 py-4 rounded-2xl border-2 border-orange-500/30 flex items-start gap-4 mb-6 shadow-sm"
              role="note"
              aria-label="Ingredientes sugeridos"
            >
              <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-orange-900 uppercase tracking-wide mb-1.5">
                  Le quedaría bien agregar:
                </p>
                <p className="text-base text-orange-800 font-medium leading-relaxed">
                  {missingIngredients.join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Ingredients Section */}
          <div className="mb-6">
            <h2 className="flex items-center text-xl font-extrabold text-gray-900 mb-4 tracking-tight">
              <List size={20} className="mr-2 text-orange-600" aria-hidden="true" />
              Ingredientes
            </h2>
            <ul className="text-base text-gray-700 space-y-2.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex items-start">
                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 mr-3 flex-shrink-0" aria-hidden="true"></span>
                  <span className="leading-relaxed">{ing}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions Section */}
          <div className="mb-8 flex-grow">
            <h2 className="flex items-center text-xl font-extrabold text-gray-900 mb-4 tracking-tight">
              <ChefHat size={20} className="mr-2 text-orange-600" aria-hidden="true" />
              Preparación
            </h2>
            <ol className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {instructions.map((step, i) => (
                <li key={i} className="flex gap-4 text-base text-gray-700">
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center text-sm font-bold shadow-md"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="mt-1 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-auto pt-6 border-t border-gray-200">
            {/* Favorite Button */}
            {onToggleFavorite && (
              <button
                onClick={handleFavoriteClick}
                className={`flex-1 py-4 px-6 rounded-2xl font-bold text-base transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 flex items-center justify-center gap-3 relative ${
                  isFavorite
                    ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-300'
                    : !canAddToFavorites
                      ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white border-2 border-orange-400 hover:from-orange-500 hover:to-orange-600 cursor-pointer'
                      : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-red-500 hover:text-red-500 focus:ring-gray-300'
                }`}
                aria-label={
                  !isFavorite && !canAddToFavorites
                    ? 'Límite de favoritos alcanzado'
                    : isFavorite
                      ? `Quitar ${recipe.title} de guardadas`
                      : `Guardar receta ${recipe.title}`
                }
                aria-pressed={isFavorite}
                title={!isFavorite && !canAddToFavorites ? 'Límite de favoritos alcanzado (Plan Free)' : undefined}
              >
                {!isFavorite && !canAddToFavorites ? (
                  <>
                    <span className="text-lg">✨</span>
                    <span>Desbloquear Premium</span>
                  </>
                ) : (
                  <>
                    <Heart
                      size={22}
                      className={`transition-all duration-300 ${
                        isFavorite ? 'fill-white' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>{isFavorite ? 'Guardada' : 'Guardar Receta'}</span>
                  </>
                )}
              </button>
            )}

            {/* Delete Button (only shown if isFavorite and onDeleteFavorite is provided) */}
            {isFavorite && onDeleteFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFavorite(recipe);
                }}
                className="flex-1 py-4 px-6 rounded-2xl bg-white text-red-600 border-2 border-red-300 font-bold text-base transition-all duration-300 shadow-md hover:shadow-lg hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-300 flex items-center justify-center gap-3"
                aria-label={`Eliminar receta ${recipe.title}`}
                title="Eliminar receta"
              >
                <Trash2
                  size={22}
                  aria-hidden="true"
                />
                <span>Eliminar</span>
              </button>
            )}

            {/* WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              disabled={isSharing}
              className={`flex-1 py-4 px-6 rounded-2xl bg-[#25D366] text-white font-bold text-base transition-all duration-300 shadow-md hover:shadow-lg hover:bg-[#20ba5a] focus:outline-none focus:ring-4 focus:ring-green-300 flex items-center justify-center gap-3 group ${isSharing ? 'opacity-75 cursor-wait' : ''}`}
              aria-label={`Compartir ${recipe.title} por WhatsApp`}
              title="Compartir por WhatsApp"
            >
              {isSharing ? (
                <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6 transition-transform duration-300 group-hover:scale-110"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              )}
              <span>{isSharing ? 'Compartiendo...' : 'Compartir'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fb923c;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `}</style>
    </article>
  );
};
