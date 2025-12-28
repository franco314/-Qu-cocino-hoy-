import { useState, useEffect } from 'react';
import { X, Lock, Star, Loader2, AlertCircle, RefreshCw, Check, Sparkles } from 'lucide-react';

type PlanType = 'monthly' | 'yearly';

// Context types for different modal behaviors
export type ModalContext = 'home' | 'favorites' | 'limit';

interface FavoriteLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (planType: PlanType) => Promise<void>;
  context?: ModalContext; // 'home' = aspirational, 'favorites'/'limit' = restriction
}

export const FavoriteLimitModal = ({ isOpen, onClose, onUpgrade, context = 'limit' }: FavoriteLimitModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');

  // Reset error and selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedPlan('yearly');
    }
  }, [isOpen]);

  // Dynamic content based on context
  const isAspirational = context === 'home';

  const modalContent = {
    title: isAspirational
      ? 'Subí de nivel con el Plan Chef Pro'
      : '¡Llegaste al límite del plan gratuito!',
    description: isAspirational
      ? 'Accedé a fotos ultra-realistas de tus platos y recetas ilimitadas.'
      : 'Guardá recetas ilimitadas y desbloqueá fotos generadas con IA con el',
    showPlanBadge: !isAspirational,
  };

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onUpgrade(selectedPlan);
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

  const plans = {
    monthly: {
      price: '$3.500',
      period: '/mes',
      label: 'Mensual',
      buttonText: 'Suscribirme Mensualmente',
    },
    yearly: {
      price: '$29.400',
      period: '/año',
      label: 'Anual',
      buttonText: 'Suscribirme Anualmente',
      savings: 'AHORRÁ 30%',
    },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-6 animate-fade-in border border-white/30"
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

        {/* Icon - Different based on context */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              isAspirational
                ? 'bg-gradient-to-br from-orange-400 to-orange-600'
                : 'bg-gradient-to-br from-orange-100 to-orange-200'
            }`}>
              {isAspirational ? (
                <Sparkles className="w-10 h-10 text-white" />
              ) : (
                <Lock className="w-10 h-10 text-orange-600" />
              )}
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
              <Star className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
        </div>

        {/* Title - Dynamic based on context */}
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-3">
          {modalContent.title}
        </h2>

        {/* Message - Dynamic based on context */}
        <p className="text-center text-gray-600 mb-6">
          {modalContent.description}
          {modalContent.showPlanBadge && (
            <span className="font-bold text-orange-600"> Plan Chef Pro</span>
          )}
        </p>

        {/* Plan Selection Cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Monthly Plan Card */}
          <button
            onClick={() => setSelectedPlan('monthly')}
            disabled={isLoading}
            className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
              selectedPlan === 'monthly'
                ? 'border-orange-500 bg-orange-50/80 shadow-md'
                : 'border-gray-200 bg-white/80 hover:border-gray-300'
            } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Selection indicator */}
            <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selectedPlan === 'monthly'
                ? 'border-orange-500 bg-orange-500'
                : 'border-gray-300 bg-white'
            }`}>
              {selectedPlan === 'monthly' && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>

            <p className="text-sm font-medium text-gray-500 mb-1">{plans.monthly.label}</p>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800">{plans.monthly.price}</span>
              <span className="text-sm text-gray-500 ml-1">{plans.monthly.period}</span>
            </div>
          </button>

          {/* Yearly Plan Card (Recommended) */}
          <button
            onClick={() => setSelectedPlan('yearly')}
            disabled={isLoading}
            className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
              selectedPlan === 'yearly'
                ? 'border-orange-500 bg-orange-50/80 shadow-md'
                : 'border-gray-200 bg-white/80 hover:border-gray-300'
            } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Savings Badge */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full shadow-sm">
              <span className="text-[10px] font-bold text-white tracking-wide">{plans.yearly.savings}</span>
            </div>

            {/* Selection indicator */}
            <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selectedPlan === 'yearly'
                ? 'border-orange-500 bg-orange-500'
                : 'border-gray-300 bg-white'
            }`}>
              {selectedPlan === 'yearly' && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>

            <p className="text-sm font-medium text-gray-500 mb-1 mt-1">{plans.yearly.label}</p>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-gray-800">{plans.yearly.price}</span>
              <span className="text-sm text-gray-500 ml-1">{plans.yearly.period}</span>
            </div>
          </button>
        </div>

        {/* Benefits */}
        <div className="bg-orange-500/10 backdrop-blur-sm rounded-2xl p-4 mb-5 space-y-2 border border-orange-500/20">
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
          <div className="mb-4 p-4 bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl">
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
              plans[selectedPlan].buttonText
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
