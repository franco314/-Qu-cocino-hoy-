import React, { useState, useEffect } from 'react';
import { Settings, X, Crown, User, Image } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';

// Image limits by plan type (must match backend)
const IMAGE_LIMITS = {
  monthly: 4,
  yearly: 7,
};

// Get today's date key (must match backend format)
const getTodayDateKey = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
};

interface ImageUsageData {
  date: string;
  count: number;
}

interface SubscriptionData {
  planType?: 'monthly' | 'yearly';
}

/**
 * DevPanel - Developer Dashboard for testing Premium/Free states
 * Only renders when running on localhost
 */
const DevPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isPremium, devSetPremium, user } = useAuth();
  const [imageUsage, setImageUsage] = useState<ImageUsageData | null>(null);
  const [planType, setPlanType] = useState<'monthly' | 'yearly'>('monthly');

  // Listen to image usage and subscription data
  useEffect(() => {
    if (!user) {
      setImageUsage(null);
      setPlanType('monthly');
      return;
    }

    // Listen to user document for image usage
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setImageUsage(data?.dailyImageUsage || null);
      }
    });

    // Listen to subscription for plan type
    const subDocRef = doc(db, 'subscriptions', user.uid);
    const unsubSub = onSnapshot(subDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SubscriptionData;
        setPlanType(data?.planType || 'monthly');
      }
    });

    return () => {
      unsubUser();
      unsubSub();
    };
  }, [user]);

  // Handle setting premium status with Firestore write
  const handleSetPremium = async () => {
    if (!user) return;

    try {
      // Write to users collection
      await setDoc(doc(db, 'users', user.uid), {
        isPremium: true,
        premiumSince: new Date().toISOString(),
        devMode: true,
      }, { merge: true });

      // Write to subscriptions collection with default monthly plan
      await setDoc(doc(db, 'subscriptions', user.uid), {
        planType: 'monthly',
        status: 'authorized',
        devMode: true,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      devSetPremium(true);
      console.log('✅ DEV: Premium activado con datos en Firestore');
    } catch (error) {
      console.error('Error setting premium:', error);
    }
  };

  // Handle setting free status with Firestore write
  const handleSetFree = async () => {
    if (!user) return;

    try {
      await setDoc(doc(db, 'users', user.uid), {
        isPremium: false,
        devMode: true,
      }, { merge: true });

      devSetPremium(false);
      console.log('🌑 DEV: Free activado');
    } catch (error) {
      console.error('Error setting free:', error);
    }
  };

  // Handle changing plan type
  const handleSetPlan = async (newPlanType: 'monthly' | 'yearly') => {
    if (!user) return;

    try {
      await setDoc(doc(db, 'subscriptions', user.uid), {
        planType: newPlanType,
      }, { merge: true });

      setPlanType(newPlanType);
      console.log(`📋 DEV: Plan cambiado a ${newPlanType}`);
    } catch (error) {
      console.error('Error setting plan type:', error);
    }
  };

  // Only show on localhost
  if (typeof window === 'undefined' || window.location.hostname !== 'localhost') {
    return null;
  }

  return (
    <>
      {/* Floating gear button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-[9999] p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
        title="Dev Panel"
      >
        <Settings size={20} className={isOpen ? 'animate-spin' : ''} />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-16 left-4 z-[9999] bg-gray-900 text-white rounded-lg shadow-2xl p-4 min-w-[240px] border border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
            <span className="text-sm font-bold text-orange-400">Dev Panel</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* User info */}
          <div className="mb-3 text-xs text-gray-400">
            {user ? (
              <span>Usuario: {user.email}</span>
            ) : (
              <span className="text-yellow-500">No hay usuario logueado</span>
            )}
          </div>

          {/* Current status */}
          <div className="mb-3 p-2 rounded bg-gray-800">
            <span className="text-xs text-gray-400">Estado actual:</span>
            <div className="flex items-center gap-2 mt-1">
              {isPremium ? (
                <>
                  <Crown size={16} className="text-orange-400" />
                  <span className="text-orange-400 font-semibold">Premium ({planType})</span>
                </>
              ) : (
                <>
                  <User size={16} className="text-gray-400" />
                  <span className="text-gray-300 font-semibold">Free</span>
                </>
              )}
            </div>
          </div>

          {/* Image quota counter */}
          {isPremium && (
            <div className="mb-3 p-2 rounded bg-gray-800 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Image size={14} className="text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">Cuota de imágenes</span>
              </div>
              <div className="text-sm">
                <span className="text-white font-bold">
                  {imageUsage?.date === getTodayDateKey() ? imageUsage.count : 0}
                </span>
                <span className="text-gray-400"> / {IMAGE_LIMITS[planType]} hoy</span>
              </div>
              {imageUsage?.date && imageUsage.date === getTodayDateKey() && (
                <div className="text-[10px] text-gray-500 mt-1">
                  Fecha: {imageUsage.date}
                </div>
              )}
            </div>
          )}

          {/* Plan type selector (only when premium) */}
          {isPremium && (
            <div className="mb-3">
              <span className="text-xs text-gray-400">Plan para pruebas:</span>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => handleSetPlan('monthly')}
                  className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
                    planType === 'monthly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Mensual (4/día)
                </button>
                <button
                  onClick={() => handleSetPlan('yearly')}
                  className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
                    planType === 'yearly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Anual (7/día)
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={handleSetFree}
              disabled={!isPremium}
              className={`w-full py-2 px-3 rounded text-sm font-medium transition-colors ${
                !isPremium
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
            >
              Set Free
            </button>
            <button
              onClick={handleSetPremium}
              disabled={isPremium}
              className={`w-full py-2 px-3 rounded text-sm font-medium transition-colors ${
                isPremium
                  ? 'bg-orange-800 text-orange-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
            >
              Set Premium
            </button>
          </div>

          {/* Footer note */}
          <div className="mt-3 pt-2 border-t border-gray-700">
            <p className="text-[10px] text-gray-500 text-center">
              Solo visible en localhost
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default DevPanel;
