import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginButton: React.FC = () => {
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
      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <LogIn size={16} />
      {loading ? 'Iniciando...' : 'Iniciar sesión'}
    </button>
  );
};
