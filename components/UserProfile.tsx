import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, Crown, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const UserProfile: React.FC = () => {
  const { user, signOut, isPremium, isSubscribing, startSubscription } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-8 h-8 rounded-full border-2 border-gray-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <UserIcon size={16} className="text-gray-600" />
          </div>
        )}
        <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-[120px] truncate">
          {user.displayName?.split(' ')[0] || 'Usuario'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-fade-in">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <UserIcon size={20} className="text-gray-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user.displayName || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Premium Status Badge */}
          {isPremium ? (
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                <Crown size={14} className="text-orange-500 fill-orange-200" />
                <span className="text-xs font-semibold text-orange-700">Plan Chef Activo</span>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 border-b border-gray-100">
              <button
                onClick={async () => {
                  try {
                    await startSubscription();
                    setIsOpen(false);
                  } catch (error) {
                    console.error('Error starting subscription:', error);
                  }
                }}
                disabled={isSubscribing}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow-md hover:from-orange-600 hover:to-orange-700 transition-all duration-300 disabled:opacity-70 disabled:cursor-wait"
              >
                {isSubscribing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Crown size={14} />
                    <span>Pasarme a Premium</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
