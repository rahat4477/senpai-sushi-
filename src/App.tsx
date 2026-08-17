import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CustomerMenu from './pages/CustomerMenu';
import KitchenDashboard from './pages/KitchenDashboard';
import { Toaster } from './components/ui/Toaster';

import { LanguageProvider } from './context/LanguageContext';

export default function App() {
  return (
    <Router>
      <LanguageProvider>
        <Toaster>
          <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Routes>
              <Route path="/menu" element={<CustomerMenu />} />
              <Route path="/kitchen" element={<KitchenDashboard />} />
              <Route path="/" element={<Navigate to="/menu?table=1" replace />} />
            </Routes>
          </div>
        </Toaster>
      </LanguageProvider>
    </Router>
  );
}
