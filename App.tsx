import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SharedRecipePage } from './pages/SharedRecipePage';
import { SubscriptionSuccessPage } from './pages/SubscriptionSuccessPage';
import DevPanel from './components/DevPanel';

export default function App() {
  // Detectar si es mobile (< 1024px) para background responsivo
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : true
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Inline styles para máxima especificidad - Tailwind no puede sobreescribir esto
  const backgroundStyle: React.CSSProperties = {
    minHeight: '100dvh',
    backgroundImage: isMobile
      ? "url('/images/hero-mobile.png')"
      : "url('/images/hero-bg.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center top',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: isMobile ? 'scroll' : 'fixed',
  };

  return (
    <div style={backgroundStyle}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipe/:recipeId" element={<SharedRecipePage />} />
          <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
        </Routes>
      </BrowserRouter>
      {/* Dev Panel - only visible on localhost */}
      <DevPanel />
    </div>
  );
}
