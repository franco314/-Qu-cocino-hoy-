import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginButtonProps {
  isHeroMode?: boolean;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ isHeroMode = false }) => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
      alert('Error al iniciar sesión. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed ${
        isHeroMode
          ? 'bg-white/10 border border-white/20 text-stone-50 hover:bg-white/20 drop-shadow-sm'
          : 'bg-white/70 border border-gray-200 text-gray-700 hover:bg-white/80 shadow-sm'
      }`}
    >
      <LogIn size={16} />
      {loading ? 'Iniciando...' : 'Ingresar'}
    </button>
  );
};
