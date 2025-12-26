import { useState, useEffect } from 'react';
import { X, Lock, Star, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface FavoriteLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => Promise<void>;
}

export const FavoriteLimitModal = ({ isOpen, onClose, onUpgrade }: FavoriteLimitModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset error when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onUpgrade();
      // No cerramos el modal aquí porque onUpgrade abre Mercado Pago en nueva pestaña
      // El usuario puede cerrar manualmente si quiere
    } catch (err: unknown) {
      // Capturar mensaje detallado del error
      let errorMessage = 'Error al iniciar la suscripción.';
      if (err instanceof Error && err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error('Error en handleUpgrade:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleUpgrade();
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

        {/* Error message with retry */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700 text-sm font-medium mb-2">{error}</p>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                >
                  <RefreshCw size={12} />
                  Reintentar
                </button>
              </div>
            </div>
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
