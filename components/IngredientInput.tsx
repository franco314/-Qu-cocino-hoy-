import React, { useState, useRef } from 'react';
import { X, Plus, Search, Clock } from 'lucide-react';

interface IngredientInputProps {
  ingredients: string[];
  onAdd: (ingredient: string) => void;
  onRemove: (ingredient: string) => void;
  history?: string[][];
  onSelectHistory?: (ingredients: string[]) => void;
}

const COMMON_INGREDIENTS = [
  "Huevos", "Cebolla", "Tomate", "Arroz", "Pollo", 
  "Papas", "Leche", "Queso", "Fideos", "Aceite", 
  "Ajo", "Zanahoria", "Limón", "Harina", "Manteca"
];

export const IngredientInput: React.FC<IngredientInputProps> = ({ 
  ingredients, 
  onAdd, 
  onRemove,
  history = [],
  onSelectHistory
}) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addIngredient();
    } else if (e.key === 'Backspace' && inputValue === '' && ingredients.length > 0) {
      onRemove(ingredients[ingredients.length - 1]);
    }
  };

  const addIngredient = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      onAdd(trimmed);
      setInputValue("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Si el valor contiene una coma, dividir y agregar el ingrediente
    if (value.includes(',')) {
      const parts = value.split(',');
      // Agregar todos los ingredientes excepto el último (que puede estar incompleto)
      for (let i = 0; i < parts.length - 1; i++) {
        const trimmed = parts[i].trim();
        if (trimmed && !ingredients.includes(trimmed)) {
          onAdd(trimmed);
        }
      }
      // Mantener la última parte (después de la última coma) en el input
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(value);
    }
  };

  const handleQuickAdd = (ing: string) => {
    if (!ingredients.includes(ing)) {
      onAdd(ing);
    }
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Main Input Container */}
      <label 
        htmlFor="ingredient-input"
        className="bg-white p-4 rounded-2xl border border-gray-300 shadow-sm focus-within:ring-2 focus-within:ring-black/10 focus-within:border-gray-400 transition-all duration-300 cursor-text relative z-20 block"
        onClick={(e) => {
          // Prevent focus loop if clicking on the input itself
          if (e.target !== inputRef.current) {
            inputRef.current?.focus();
          }
        }}
      >
        <span className="sr-only">Ingresá los ingredientes que tenés en tu cocina</span>
        <div className="flex flex-wrap gap-2 items-center">
          <Search className="text-gray-500 w-5 h-5 mr-1" aria-hidden="true" />
          
          {ingredients.map((ing, index) => (
            <span 
              key={index} 
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-900 animate-fadeIn"
            >
              {ing}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(ing);
                }}
                aria-label={`Eliminar ingrediente ${ing}`}
                className="ml-2 p-0.5 rounded-full hover:bg-gray-200 text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-black/20"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ))}

          <input
            id="ingredient-input"
            ref={inputRef}
            type="text"
            className="flex-grow min-w-[150px] outline-none bg-transparent text-lg placeholder-gray-500 text-gray-900 h-10"
            placeholder={ingredients.length === 0 ? "Escribí lo que tenés (ej: pollo, arroz...)" : "Agregá otro ingrediente..."}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={addIngredient}
            autoComplete="off"
          />
        </div>
      </label>

      {/* History Section - Compact & Horizontal */}
      {history && history.length > 0 && onSelectHistory && (
        <div 
          className="mt-3 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide mask-gradient-right"
          role="group"
          aria-label="Combinaciones recientes"
        >
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex-shrink-0 mr-1 select-none" aria-hidden="true">
            Recientes
          </span>
          {history.map((histSet, idx) => {
            // Defensive check: ensure histSet is an array before trying to access it
            if (!Array.isArray(histSet)) return null;
            
            return (
              <button
                key={idx}
                onClick={() => onSelectHistory(histSet)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-white hover:border-orange-300 hover:text-orange-700 hover:shadow-sm text-xs text-gray-600 transition-all duration-200 group whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                aria-label={`Usar combinación reciente: ${histSet.join(', ')}`}
              >
                <Clock size={12} className="text-gray-400 group-hover:text-orange-500" aria-hidden="true" />
                <span>
                  {histSet.slice(0, 2).join(', ')}
                  {histSet.length > 2 && ` (+${histSet.length - 2})`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick Add Suggestions */}
      <div className="mt-6">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1" id="quick-add-label">
          Agregá rápido los básicos
        </p>
        <div 
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="quick-add-label"
        >
          {COMMON_INGREDIENTS.map((ing) => {
            const isSelected = ingredients.includes(ing);
            return (
              <button
                key={ing}
                onClick={() => handleQuickAdd(ing)}
                disabled={isSelected}
                aria-pressed={isSelected}
                aria-label={isSelected ? `${ing} agregado` : `Agregar ${ing}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-black/10
                  ${isSelected 
                    ? 'bg-green-100 text-green-800 border-green-200 opacity-70 cursor-default' 
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:text-gray-900 hover:shadow-sm active:scale-95'
                  }`}
              >
                {isSelected ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                {ing}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};