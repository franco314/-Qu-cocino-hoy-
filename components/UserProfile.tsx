import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileProps {
  onShowPremiumModal?: () => void;
  isHeroMode?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onShowPremiumModal, isHeroMode = false }) => {
  const { user, signOut, isPremium } = useAuth();
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
            <div className="w-full">
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 rounded-lg border border-orange-500/30">
                <Crown size={13} className="text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">Plan Chef Pro Activo</span>
              </div>
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
