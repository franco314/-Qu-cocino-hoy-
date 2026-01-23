import { useState, useEffect, useCallback } from 'react';

// Type declaration for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Extend Window interface to include the deferredPrompt
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface UsePWAInstallResult {
  /** Whether the app can be installed (prompt available and not already installed) */
  canInstall: boolean;
  /** Whether the app is already installed (running in standalone mode) */
  isInstalled: boolean;
  /** Whether the install prompt is currently being shown */
  isPrompting: boolean;
  /** Trigger the native install prompt */
  installApp: () => Promise<boolean>;
  /** Dismiss the install prompt UI without installing */
  dismissPrompt: () => void;
  /** Whether the user has dismissed the prompt in this session */
  isDismissed: boolean;
}

/**
 * Custom hook for managing PWA installation experience.
 * 
 * Listens for the `beforeinstallprompt` event and provides a clean API
 * to check installation status and trigger the native install dialog.
 * 
 * @example
 * const { canInstall, isInstalled, installApp } = usePWAInstall();
 * 
 * if (canInstall) {
 *   return <button onClick={installApp}>Instalar App</button>;
 * }
 */
export const usePWAInstall = (): UsePWAInstallResult => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if already installed (standalone mode)
  useEffect(() => {
    // Check display-mode media query
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Also check iOS Safari's navigator.standalone
    const isIOSStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
    
    setIsInstalled(isStandalone || isIOSStandalone);

    // Listen for display-mode changes (user might install while page is open)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Capture the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent Chrome's default mini-infobar
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger the install prompt
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.warn('[usePWAInstall] No install prompt available');
      return false;
    }

    setIsPrompting(true);

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for user's choice
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[usePWAInstall] Error showing install prompt:', error);
      return false;
    } finally {
      setIsPrompting(false);
    }
  }, [deferredPrompt]);

  // Dismiss the prompt UI
  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    // Optionally persist dismissal in sessionStorage
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  }, []);

  // Check if user previously dismissed in this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('pwa_install_dismissed') === 'true';
    setIsDismissed(wasDismissed);
  }, []);

  return {
    canInstall: !!deferredPrompt && !isInstalled && !isDismissed,
    isInstalled,
    isPrompting,
    installApp,
    dismissPrompt,
    isDismissed,
  };
};
