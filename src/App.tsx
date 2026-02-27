import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, Camera, Heart, Settings, LogIn } from 'lucide-react';
import Catalog from './pages/Catalog';
import Search from './pages/Search';
import Wishlist from './pages/Wishlist';
import Admin from './pages/Admin';
import Login from './pages/Login';
import ProductDetail from './pages/ProductDetail';
import BottomNav from './components/BottomNav';

export default function App() {
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <div className="flex flex-col h-screen bg-stone-50 text-stone-900 font-sans">
        <main className="flex-1 overflow-y-auto pb-16">
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/wishlist" element={<Wishlist user={user} />} />
            <Route path="/admin" element={<Admin user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </Router>
  );
}
