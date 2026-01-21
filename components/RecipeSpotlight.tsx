import React from 'react';
import { Clock, ChefHat, Flame, AlertCircle, List, Heart, Loader2, Trash2 } from 'lucide-react';
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

  if (!recipe) return null;

  const ingredients = Array.isArray(recipe.ingredientsNeeded) ? recipe.ingredientsNeeded : [];
  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const missingIngredients = Array.isArray(recipe.missingIngredients) ? recipe.missingIngredients : [];

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    shareViaWhatsApp(recipe);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 w-full max-w-6xl mx-auto"
      role="article"
      aria-label={`Receta destacada: ${recipe.title}`}
    >
      {/* ══════════════════════════════════════════════════════
          FILA SUPERIOR: FOTO (izq) + INFO (der)
          ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row">
        
        {/* BLOQUE 1: FOTO (cuadrada) - object-cover */}
        <div className="w-full md:w-1/2 aspect-square relative overflow-hidden">
          {recipe.imageUrl ? (
            <>
              {/* Imagen principal - llena todo el espacio */}
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
              {/* Badge de dificultad */}
              <div className="absolute top-3 left-3">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase shadow ${
                  recipe.difficulty === 'Fácil' ? 'bg-emerald-500 text-white' :
                  recipe.difficulty === 'Media' ? 'bg-amber-400 text-amber-900' :
                  'bg-red-500 text-white'
                }`}>
                  {recipe.difficulty}
                </span>
              </div>
            </>
          ) : (
            /* Premium Upsell */
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-3 shadow">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-700 uppercase">Imagen Premium</p>
              <div className="px-4 py-1.5 bg-gradient-to-r from-orange-400 to-amber-500 text-white text-xs font-bold rounded-full mt-2">
                ✨ Desbloquear
              </div>
            </div>
          )}
        </div>

        {/* BLOQUE 2: INFO (título, macros, ingredientes, botones) */}
        <div className="w-full md:w-1/2 p-5 md:p-6 flex flex-col">
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">
            <span className="flex items-center gap-1">
              <Flame size={14} className="text-orange-500" />
              {recipe.calories} kcal
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} className="text-blue-500" />
              {recipe.preparationTime}
            </span>
          </div>
          
          {/* Título */}
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight mb-2">
            {recipe.title}
          </h1>
          
          <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2">
            {recipe.description}
          </p>

          {/* Macros */}
          {recipe.macros && (
            <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
              <div className="flex items-center justify-between text-center">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Proteínas</p>
                  {isPremium ? (
                    <p className="text-base font-bold text-orange-600">{recipe.macros.protein}g</p>
                  ) : (
                    <p className="text-base font-bold text-gray-300 blur-[2px]">{recipe.macros.protein}g</p>
                  )}
                </div>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Carbos</p>
                  {isPremium ? (
                    <p className="text-base font-bold text-orange-600">{recipe.macros.carbs}g</p>
                  ) : (
                    <p className="text-base font-bold text-gray-300 blur-[2px]">{recipe.macros.carbs}g</p>
                  )}
                </div>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Grasas</p>
                  {isPremium ? (
                    <p className="text-base font-bold text-orange-600">{recipe.macros.fat}g</p>
                  ) : (
                    <p className="text-base font-bold text-gray-300 blur-[2px]">{recipe.macros.fat}g</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Missing Ingredients */}
          {missingIngredients.length > 0 && (
            <div className="bg-orange-50 px-3 py-2 rounded-lg border border-orange-100 flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <p className="text-xs text-orange-700 font-medium truncate">
                Agregar: {missingIngredients.join(', ')}
              </p>
            </div>
          )}

          {/* Ingredientes */}
          <div className="flex-1 mb-3">
            <h2 className="flex items-center text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">
              <List size={14} className="mr-1.5 text-orange-500" />
              Ingredientes ({ingredients.length})
            </h2>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm text-gray-700">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex items-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 mr-2 flex-shrink-0"></span>
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
            {onToggleFavorite && (
              <button
                onClick={handleFavoriteClick}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 ${
                  isFavorite
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : !canAddToFavorites
                      ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-pressed={isFavorite}
              >
                {!isFavorite && !canAddToFavorites ? (
                  <><span>✨</span><span>Premium</span></>
                ) : (
                  <>
                    <Heart size={16} className={isFavorite ? 'fill-white' : ''} />
                    <span>{isFavorite ? 'Guardada' : 'Guardar'}</span>
                  </>
                )}
              </button>
            )}

            {isFavorite && onDeleteFavorite && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteFavorite(recipe); }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white text-red-600 border border-red-200 font-bold text-sm transition-all shadow-sm hover:shadow-md hover:bg-red-50 flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                <span>Eliminar</span>
              </button>
            )}

            <button
              onClick={handleWhatsAppShare}
              disabled={isSharing}
              className={`flex-1 py-2.5 px-4 rounded-xl bg-[#25D366] text-white font-bold text-sm transition-all shadow-sm hover:shadow-md hover:bg-[#20ba5a] flex items-center justify-center gap-2 ${isSharing ? 'opacity-75' : ''}`}
            >
              {isSharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              )}
              <span>{isSharing ? '...' : 'WhatsApp'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          FILA INFERIOR: PREPARACIÓN (full width)
          ══════════════════════════════════════════════════════ */}
      <div className="border-t border-gray-100 p-5 md:p-6 bg-gray-50/50">
        <h2 className="flex items-center text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
          <ChefHat size={16} className="mr-2 text-orange-500" />
          Preparación ({instructions.length} pasos)
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
          {instructions.map((step, i) => (
            <li key={i} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-100">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
};
