import { useState } from 'react';
import { X, Lock, Star, Loader2 } from 'lucide-react';

interface FavoriteLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => Promise<void>;
}

export const FavoriteLimitModal = ({ isOpen, onClose, onUpgrade }: FavoriteLimitModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onUpgrade();
      onClose();
    } catch (err) {
      setError('Error al iniciar la suscripción. Intentá de nuevo.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-orange-600" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
              <Star className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-3">
          ¡Llegaste al límite del plan gratuito!
        </h2>

        {/* Message */}
        <p className="text-center text-gray-600 mb-6">
          Guardá recetas ilimitadas y desbloqueá fotos generadas con IA con el <span className="font-bold text-orange-600">Plan Chef</span>
        </p>

        {/* Benefits */}
        <div className="bg-orange-50 rounded-2xl p-4 mb-6 space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
            <p className="text-sm text-gray-700">Guardá recetas ilimitadas</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
            <p className="text-sm text-gray-700">Fotos IA profesionales para cada receta</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
            <p className="text-sm text-gray-700">Filtros de dieta Vegano y Sin TACC</p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* Price */}
        <div className="text-center mb-4">
          <span className="text-3xl font-bold text-gray-800">$3.500</span>
          <span className="text-gray-500 text-sm">/mes</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full py-3 px-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Procesando...
              </>
            ) : (
              'Suscribirme al Plan Chef'
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full py-3 px-6 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Ahora no
          </button>
        </div>

        {/* Payment info */}
        <p className="text-xs text-gray-400 text-center mt-4">
          Pago seguro con Mercado Pago. Cancelá cuando quieras.
        </p>
      </div>
    </div>
  );
};
