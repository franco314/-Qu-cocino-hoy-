import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Sparkles, Check, Crown, Camera, Heart, Leaf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const SubscriptionSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshPremiumStatus } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Refresh premium status from Firestore
    const verifySubscription = async () => {
      try {
        if (refreshPremiumStatus) {
          await refreshPremiumStatus();
        }
      } catch (error) {
        console.error('Error verifying subscription:', error);
      } finally {
        setIsVerifying(false);
      }
    };

    // Small delay to allow webhook to process
    const timer = setTimeout(verifySubscription, 2000);
    return () => clearTimeout(timer);
  }, [refreshPremiumStatus]);

  const handleGoHome = () => {
    navigate('/');
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-2xl animate-pulse"></div>
            <Crown size={64} className="relative text-orange-500 animate-bounce" />
          </div>
          <p className="text-gray-600 font-medium text-lg">Verificando tu suscripción...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Confetti-like decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-4 h-4 bg-orange-400 rounded-full opacity-60 animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-20 right-20 w-3 h-3 bg-yellow-400 rounded-full opacity-60 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="absolute top-40 left-1/4 w-2 h-2 bg-red-400 rounded-full opacity-60 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        <div className="absolute top-32 right-1/3 w-3 h-3 bg-orange-300 rounded-full opacity-60 animate-bounce" style={{ animationDelay: '0.6s' }}></div>
        <div className="absolute top-16 left-1/2 w-2 h-2 bg-yellow-500 rounded-full opacity-60 animate-bounce" style={{ animationDelay: '0.8s' }}></div>
      </div>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-lg w-full text-center">
          {/* Success Icon */}
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-green-400/30 rounded-full blur-3xl scale-150"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-2xl">
              <Check size={48} className="text-white" strokeWidth={3} />
            </div>
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Crown size={20} className="text-white" />
            </div>
          </div>

          {/* Welcome Message */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            ¡Bienvenido al Plan Chef!
          </h1>

          <p className="text-xl text-gray-600 mb-8">
            {user?.displayName ? `${user.displayName}, tus` : 'Tus'} funciones premium ya están activas
          </p>

          {/* Benefits Card */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-6 mb-8 border border-white/30">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-center gap-2">
              <Sparkles className="text-orange-500" size={20} />
              Ahora podés disfrutar de:
            </h2>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-orange-500/10 backdrop-blur-sm rounded-xl border border-orange-500/20">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Camera size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Fotos IA Profesionales</p>
                  <p className="text-sm text-gray-700">Imágenes únicas para cada receta</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Leaf size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Filtros de Dieta Premium</p>
                  <p className="text-sm text-gray-700">Vegano, Sin TACC y más</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/20">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Heart size={20} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Favoritos Ilimitados</p>
                  <p className="text-sm text-gray-700">Guardá todas las recetas que quieras</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-lg rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group"
          >
            <ChefHat size={24} className="group-hover:rotate-12 transition-transform" />
            <span>Empezar a cocinar</span>
          </button>

          <p className="text-gray-500 text-sm mt-6">
            Tu suscripción se renovará automáticamente cada mes
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <ChefHat size={20} />
          <span className="font-medium">¿Qué cocino hoy?</span>
        </div>
      </footer>
    </div>
  );
};
