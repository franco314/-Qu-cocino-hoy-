import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, db, functions } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPremium: boolean;
  isSubscribing: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  startSubscription: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  refreshPremiumStatus: () => Promise<void>;
  // Dev mode toggle (only for testing)
  devTogglePremium: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Listen for auth state changes and premium status
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Listen to user document for real-time premium status updates
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setIsPremium(userData?.isPremium === true);
            console.log('Premium status:', userData?.isPremium ? '✨ Premium' : '🌑 Free');
          } else {
            setIsPremium(false);
          }
          setLoading(false);
        }, (error) => {
          console.error('Error listening to user doc:', error);
          setIsPremium(false);
          setLoading(false);
        });

        return () => unsubscribeUser();
      } else {
        setIsPremium(false);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setIsPremium(false);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  /**
   * Start a subscription flow with Mercado Pago
   */
  const startSubscription = useCallback(async () => {
    console.log('🚀 [startSubscription] Iniciando flujo de suscripción...');

    if (!user) {
      console.error('❌ [startSubscription] Usuario no autenticado');
      throw new Error('Debes iniciar sesión primero');
    }

    console.log('👤 [startSubscription] Usuario:', user.email);
    setIsSubscribing(true);

    try {
      console.log('📡 [startSubscription] Llamando a Cloud Function createSubscription...');
      const createSubscriptionFn = httpsCallable<
        { email: string; frontendUrl: string },
        { success: boolean; initPoint: string; subscriptionId: string }
      >(functions, 'createSubscription');

      const result = await createSubscriptionFn({
        email: user.email || '',
        frontendUrl: window.location.origin,
      });

      console.log('📦 [startSubscription] Respuesta recibida:', result.data);

      if (result.data.success && result.data.initPoint) {
        console.log('✅ [startSubscription] init_point recibido, abriendo checkout de Mercado Pago...');
        console.log('🔗 [startSubscription] URL:', result.data.initPoint);
        // Open Mercado Pago checkout in new tab
        window.open(result.data.initPoint, '_blank');
      } else {
        console.error('❌ [startSubscription] No se recibió init_point válido');
        throw new Error('No se pudo generar el link de pago');
      }
    } catch (error) {
      console.error('💥 [startSubscription] Error:', error);
      throw error;
    } finally {
      setIsSubscribing(false);
      console.log('🏁 [startSubscription] Flujo finalizado');
    }
  }, [user]);

  /**
   * Cancel the current subscription
   */
  const cancelSubscription = useCallback(async () => {
    if (!user) {
      throw new Error('Debes iniciar sesión primero');
    }

    try {
      const cancelSubscriptionFn = httpsCallable<void, { success: boolean }>(
        functions,
        'cancelSubscription'
      );

      await cancelSubscriptionFn();
      setIsPremium(false);
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }, [user]);

  /**
   * Manually refresh premium status from Firestore
   */
  const refreshPremiumStatus = useCallback(async () => {
    if (!user) return;

    try {
      const checkPremiumFn = httpsCallable<void, { isPremium: boolean }>(
        functions,
        'checkPremiumStatus'
      );

      const result = await checkPremiumFn();
      setIsPremium(result.data.isPremium);
    } catch (error) {
      console.error('Error checking premium status:', error);
    }
  }, [user]);

  /**
   * Dev mode toggle for testing (removes need for actual payment)
   */
  const devTogglePremium = useCallback(() => {
    setIsPremium(prev => {
      const newValue = !prev;
      console.log(newValue ? '✨ DEV: Premium activado' : '🌑 DEV: Premium desactivado');
      return newValue;
    });
  }, []);

  const value = {
    user,
    loading,
    isPremium,
    isSubscribing,
    signInWithGoogle,
    signOut,
    startSubscription,
    cancelSubscription,
    refreshPremiumStatus,
    devTogglePremium,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
