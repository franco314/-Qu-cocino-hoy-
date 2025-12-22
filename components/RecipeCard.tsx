import React, { useState } from 'react';
import { Clock, ChefHat, Flame, AlertCircle, ChevronDown, ChevronUp, List, Heart, Trash2, Lock, Loader2 } from 'lucide-react';
import { Recipe } from '../types';
import { useShareRecipe } from '../hooks/useShareRecipe';

interface RecipeCardProps {
  recipe: Recipe;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: (recipe: Recipe) => void;
  onDeleteFavorite?: (recipe: Recipe) => void;
  canAddToFavorites?: boolean;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, index, isFavorite, onToggleFavorite, onDeleteFavorite, canAddToFavorites = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isSharing, shareViaWhatsApp } = useShareRecipe();

  // CRITICAL SAFETY CHECK: If recipe is undefined/null, do not render anything to avoid crash
  if (!recipe) return null;

  const instructionsId = `instructions-${recipe.id}`;

  // Ensure arrays exist to prevent crashes
  const ingredients = Array.isArray(recipe.ingredientsNeeded) ? recipe.ingredientsNeeded : [];
  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const missingIngredients = Array.isArray(recipe.missingIngredients) ? recipe.missingIngredients : [];

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    shareViaWhatsApp(recipe);
  };

  return (
    <article 
      className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-500 flex flex-col relative focus-within:ring-2 focus-within:ring-orange-500/50"
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Image Section */}
      <div className="relative h-56 w-full bg-gray-100 overflow-hidden group-image">
        {recipe.imageUrl ? (
          <img 
            src={recipe.imageUrl} 
            alt={`Foto del plato terminado: ${recipe.title}`} 
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-100 relative overflow-hidden" aria-hidden="true">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/30 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-yellow-200/30 rounded-full blur-2xl"></div>

            {/* Icon and text */}
            <div className="relative z-10 flex flex-col items-center">
              <ChefHat size={56} className="mb-3 text-orange-400/60" strokeWidth={1.5} />
              <span className="text-xs uppercase tracking-widest font-bold text-orange-600/70">Receta guardada</span>
              <span className="text-[10px] text-orange-500/50 mt-1">Sin imagen</span>
            </div>
          </div>
        )}
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-50 pointer-events-none" aria-hidden="true" />
        
        {/* Difficulty Badge - Adjusted colors for contrast */}
        <div className="absolute top-4 left-4 z-10">
           <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-sm backdrop-blur-md ${
            recipe.difficulty === 'Fácil' ? 'bg-green-600/90 text-white' : // Darker green for white text
            recipe.difficulty === 'Media' ? 'bg-yellow-300/95 text-yellow-900' : // Dark text on yellow bg
            'bg-red-600/90 text-white' // Darker red
          }`}>
            {recipe.difficulty}
          </span>
        </div>

        {/* Action Buttons (WhatsApp, Favorite & Delete) */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">

            {/* WhatsApp Button */}
            <button
                onClick={handleWhatsAppShare}
                disabled={isSharing}
                className={`p-2.5 rounded-full bg-white/90 backdrop-blur-md shadow-md transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-500 hover:bg-[#25D366] hover:text-white hover:shadow-green-300/40 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center ${isSharing ? 'opacity-75 cursor-wait' : ''}`}
                aria-label={`Compartir receta ${recipe.title} por WhatsApp`}
                title="Compartir por WhatsApp"
            >
                {isSharing ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                )}
            </button>

            {/* Favorite Button */}
            <button
                onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(recipe);
                }}
                disabled={!isFavorite && !canAddToFavorites}
                className={`p-2.5 rounded-full backdrop-blur-md shadow-md transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-red-500 relative ${
                  !isFavorite && !canAddToFavorites
                    ? 'bg-gray-100 cursor-not-allowed opacity-60'
                    : 'bg-white/90 hover:bg-white'
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
                {!isFavorite && !canAddToFavorites && (
                  <Lock className="w-3 h-3 text-gray-400 absolute -top-1 -right-1 bg-white rounded-full p-0.5" />
                )}
                <Heart
                className={`w-5 h-5 transition-colors duration-300 ${
                    isFavorite
                    ? "fill-red-500 text-red-500 scale-110"
                    : !canAddToFavorites
                      ? "text-gray-400"
                      : "text-gray-500 group-hover:text-red-500"
                }`}
                aria-hidden="true"
                />
            </button>

            {/* Delete Button (only shown if isFavorite and onDeleteFavorite is provided) */}
            {isFavorite && onDeleteFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFavorite(recipe);
                }}
                className="p-2.5 rounded-full bg-white/90 backdrop-blur-md hover:bg-red-50 shadow-md transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label={`Eliminar receta ${recipe.title}`}
                title="Eliminar receta"
              >
                <Trash2
                  className="w-5 h-5 text-gray-500 group-hover:text-red-600 transition-colors duration-300"
                  aria-hidden="true"
                />
              </button>
            )}
        </div>

      </div>

      {/* Header Section */}
      <div className="p-6 pt-5 bg-white">
        <div className="flex items-center text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 space-x-4">
            <div className="flex items-center" title={`${recipe.calories} calorías`}>
                <Flame size={14} className="mr-1 text-orange-600" aria-hidden="true" />
                <span aria-label={`${recipe.calories} calorías`}>{recipe.calories} kcal</span>
            </div>
            <div className="flex items-center" title={`Tiempo de preparación: ${recipe.preparationTime}`}>
                <Clock size={14} className="mr-1 text-blue-600" aria-hidden="true" />
                <span aria-label={`Tiempo de preparación: ${recipe.preparationTime}`}>{recipe.preparationTime}</span>
            </div>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
          {recipe.title}
        </h3>
        
        <p className="text-gray-600 text-sm mb-2 leading-relaxed line-clamp-2">
          {recipe.description}
        </p>
      </div>

      {/* Missing Ingredients Warning */}
      {missingIngredients.length > 0 && (
        <div className="bg-orange-50 px-6 py-3 border-t border-orange-100 flex items-start gap-3" role="note" aria-label="Sugerencia de ingredientes">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-1">Le quedaría bien agregar:</p>
            <p className="text-sm text-orange-800 font-medium">
              {missingIngredients.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Ingredients List */}
      <div className="px-6 py-4 border-t border-gray-100">
         <h4 className="flex items-center text-sm font-bold text-gray-900 mb-3">
            <List size={16} className="mr-2 text-gray-500" aria-hidden="true" />
            Ingredientes
         </h4>
         <ul className="text-sm text-gray-700 space-y-1 mb-2">
            {ingredients.slice(0, isExpanded ? undefined : 4).map((ing, i) => (
                <li key={i} className="flex items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 mr-2 flex-shrink-0" aria-hidden="true"></span>
                    {ing}
                </li>
            ))}
            {!isExpanded && ingredients.length > 4 && (
                <li className="text-gray-500 italic text-xs pl-4">
                    ...y {ingredients.length - 4} más
                </li>
            )}
         </ul>
      </div>

      {/* Instructions (Toggle) */}
      {isExpanded && (
        <div 
          id={instructionsId}
          className="px-6 py-4 border-t border-gray-100 bg-gray-50 animate-fadeIn"
          role="region"
          aria-label={`Instrucciones para ${recipe.title}`}
        >
          <h4 className="flex items-center text-sm font-bold text-gray-900 mb-3">
            <ChefHat size={16} className="mr-2 text-gray-500" aria-hidden="true" />
            Instrucciones
          </h4>
          <ol className="space-y-4">
            {instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 shadow-sm" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="mt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer Action */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={instructionsId}
        className="mt-auto w-full py-3 px-6 bg-white hover:bg-gray-50 border-t border-gray-100 text-gray-700 text-sm font-medium flex items-center justify-center transition-colors focus:outline-none focus:bg-gray-50 focus:text-black focus:ring-inset focus:ring-2 focus:ring-gray-200"
      >
        {isExpanded ? (
            <>
                <ChevronUp size={16} className="mr-2" aria-hidden="true" /> Ocultar receta completa
            </>
        ) : (
            <>
                <ChevronDown size={16} className="mr-2" aria-hidden="true" /> Ver receta completa
            </>
        )}
      </button>
    </article>
  );
};