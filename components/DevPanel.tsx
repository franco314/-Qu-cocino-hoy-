import React, { useState } from 'react';
import { Settings, X, Crown, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * DevPanel - Developer Dashboard for testing Premium/Free states
 * Only renders when running on localhost
 */
const DevPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isPremium, devSetPremium, user } = useAuth();

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
                  <span className="text-orange-400 font-semibold">Premium</span>
                </>
              ) : (
                <>
                  <User size={16} className="text-gray-400" />
                  <span className="text-gray-300 font-semibold">Free</span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={() => devSetPremium(false)}
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
              onClick={() => devSetPremium(true)}
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
