import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SharedRecipePage } from './pages/SharedRecipePage';
import { SubscriptionSuccessPage } from './pages/SubscriptionSuccessPage';

export default function App() {
  return (
    <div className="min-h-screen bg-[url('/images/hero-bg.jpg')] bg-cover bg-center bg-fixed bg-no-repeat">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/recipe/:recipeId" element={<SharedRecipePage />} />
          <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
