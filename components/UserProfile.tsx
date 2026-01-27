import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, Crown, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileProps {
  onShowPremiumModal?: () => void;
  isHeroMode?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onShowPremiumModal, isHeroMode = false }) => {
  const { user, signOut, isPremium, cancelSubscription } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsOpen(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelSubscription();
      setShowCancelConfirm(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Cancel subscription failed:', error);
      // Show the specific error message from the backend via AuthContext
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'No se pudo cancelar la suscripción. Intenta nuevamente.';
      setCancelError(errorMessage);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Avatar Button - Glassmorphism */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-sm transition-all duration-300 cursor-pointer ${
          isHeroMode
            ? 'bg-white/10 hover:bg-white/20 border border-white/20'
            : 'bg-white/70 hover:bg-white/80'
        }`}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className={`w-7 h-7 rounded-full ${
              isHeroMode ? 'border-2 border-white/30' : 'border border-gray-300'
            }`}
          />
        ) : (
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
            isHeroMode ? 'bg-white/20' : 'bg-gray-300'
          }`}>
            <UserIcon size={14} className={isHeroMode ? 'text-stone-50' : 'text-gray-700'} />
          </div>
        )}
        <span className={`text-xs font-medium max-w-[120px] truncate hidden sm:inline ${
          isHeroMode ? 'text-stone-50 drop-shadow-sm' : 'text-gray-800'
        }`}>
          {user.displayName || 'Usuario'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 min-w-[200px] bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-white/30 p-2 z-50 animate-fade-in flex flex-col">

          {/* Premium Badge - Always visible */}
          {isPremium ? (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 rounded-lg border border-orange-500/30">
                <Crown size={13} className="text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">Plan Chef Pro Activo</span>
              </div>

              {/* Cancel Subscription Section */}
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full px-4 py-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 transition-colors rounded-lg"
                >
                  <XCircle size={12} />
                  Cancelar suscripción
                </button>
              ) : (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-2">
                  <p className="text-xs text-red-800 text-center font-medium">
                    ¿Seguro que querés cancelar tu suscripción?
                  </p>
                  <p className="text-[10px] text-red-600 text-center">
                    Perderás acceso a las imágenes de recetas y otras funciones premium.
                  </p>
                  {cancelError && (
                    <p className="text-[10px] text-red-700 text-center bg-red-100 p-1 rounded">
                      {cancelError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowCancelConfirm(false);
                        setCancelError(null);
                      }}
                      disabled={isCancelling}
                      className="flex-1 px-2 py-1.5 text-xs text-gray-600 bg-white hover:bg-gray-100 rounded border border-gray-300 transition-colors disabled:opacity-50"
                    >
                      Volver
                    </button>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={isCancelling}
                      className="flex-1 px-2 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Cancelando...
                        </>
                      ) : (
                        'Sí, cancelar'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                setIsOpen(false);
                onShowPremiumModal?.();
              }}
              className="w-full px-4 py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow-md hover:from-orange-600 hover:to-orange-700 hover:scale-[1.02] transition-all duration-300"
            >
              <Crown size={14} />
              <span>Pasarme a Chef Pro</span>
            </button>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-200 my-2" />

          {/* Logout Button */}
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100/50 flex items-center gap-2 transition-colors rounded-lg"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};
