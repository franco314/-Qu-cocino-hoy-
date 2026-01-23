import React, { useState, useEffect } from 'react';
import { Download, X, ChefHat, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

/**
 * PWA Install Prompt Component
 * 
 * Simplified flow:
 * - Android/Chrome: Only show button if beforeinstallprompt fired. No fallback instructions.
 * - iOS/Safari: Always show instructions (no native prompt available)
 * - Desktop: Button in header (PWAInstallButton component)
 */
export const PWAInstallPrompt: React.FC = () => {
  const { canInstall, isInstalled, installApp, dismissPrompt, isPrompting, isDismissed } = usePWAInstall();
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Detect mobile vs desktop and iOS
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
      // Detect iOS (iPhone, iPad, iPod)
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
      setIsIOS(iOS);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Don't render if already installed, user dismissed, or desktop
  if (isInstalled || isDismissed || !isMobile) {
    return null;
  }

  // ==========================================
  // iOS: Subtle instruction banner
  // ==========================================
  if (isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-gray-900/95 backdrop-blur-md border-t border-white/10 px-4 py-3 safe-area-pb">
          <div className="flex items-center justify-between gap-3">
            {/* Instruction text with iOS share icon */}
            <div className="flex items-center gap-2 text-white text-sm">
              <ChefHat size={18} className="text-orange-400 flex-shrink-0" />
              <span className="text-white/80">
                Para instalar: tocá
              </span>
              <Share size={16} className="text-orange-400" />
              <span className="text-white/80">
                y luego <strong className="text-white">"Agregar a inicio"</strong>
              </span>
            </div>
            
            {/* Dismiss button */}
            <button
              onClick={dismissPrompt}
              className="p-1.5 text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Android/Chrome: Only show if canInstall is true
  // If prompt not available, don't show anything
  // ==========================================
  if (!canInstall) {
    return null;
  }
  
  // Direct install handler
  const handleInstall = async () => {
    await installApp();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="bg-gradient-to-t from-gray-900 via-gray-900/95 to-gray-900/90 backdrop-blur-md border-t border-white/10 px-4 py-4 safe-area-pb">
        <div className="flex items-center gap-4">
          {/* App Icon - Chef Hat */}
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
            <ChefHat size={24} className="text-white" strokeWidth={1.5} />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">
              Instalar App
            </h3>
            <p className="text-white/70 text-xs">
              Acceso directo desde tu pantalla
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Dismiss Button */}
            <button
              onClick={dismissPrompt}
              className="p-2 text-white/50 hover:text-white/80 transition-colors"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            {/* Install Button - Direct native prompt */}
            <button
              onClick={handleInstall}
              disabled={isPrompting}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm rounded-full shadow-lg hover:from-orange-600 hover:to-orange-700 active:scale-95 transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
            >
              {isPrompting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download size={16} />
              )}
              <span>Instalar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PWA Install Button for Header (Desktop)
 * 
 * Only renders if beforeinstallprompt event was captured.
 */
interface PWAInstallButtonProps {
  isHeroMode?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ isHeroMode = false }) => {
  const { canInstall, isInstalled, installApp, isPrompting, isDismissed } = usePWAInstall();
  const [isMobile, setIsMobile] = useState(true);

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Don't render if: already installed, user dismissed, on mobile, or no prompt available
  if (isInstalled || isDismissed || isMobile || !canInstall) {
    return null;
  }

  // Direct install - fire native prompt immediately
  const handleInstall = async () => {
    await installApp();
  };

  return (
    <button
      onClick={handleInstall}
      disabled={isPrompting}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-300 ${
        isHeroMode
          ? 'bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20'
          : 'bg-gray-100/80 hover:bg-gray-200/80 text-gray-700'
      }`}
      title="Instalar aplicación"
    >
      <Download
        size={16}
        className={`${
          isHeroMode
            ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
            : 'text-gray-600'
        }`}
      />
      <span className={`text-xs font-medium hidden sm:inline ${
        isHeroMode
          ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
          : 'text-gray-700'
      }`}>
        Instalar app
      </span>
    </button>
  );
};
