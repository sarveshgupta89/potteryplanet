import { useState, useEffect } from 'react';
import { Heart, Trash2 } from 'lucide-react';

export default function Wishlist({ user }: { user: any }) {
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    const res = await fetch(`/api/favorites/${user.id}`);
    const data = await res.json();
    setFavorites(data);
  };

  const removeFavorite = async (productId: number) => {
    await fetch(`/api/favorites/${user.id}/${productId}`, { method: 'DELETE' });
    setFavorites(favorites.filter(f => f.id !== productId));
  };

  return (
    <div className="p-4 pb-24 max-w-5xl mx-auto font-sans">
      <header className="mb-6 py-4">
        <h1 className="text-3xl font-serif font-medium text-stone-900 mb-2">My Wishlist</h1>
        <p className="text-stone-500 text-sm">Saved products for future reference.</p>
      </header>

      {favorites.length === 0 ? (
        <div className="border-2 border-dashed border-stone-300 rounded-3xl p-12 flex flex-col items-center justify-center bg-stone-50 min-h-[300px]">
          <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
            <Heart className="text-stone-300" size={28} />
          </div>
          <p className="text-stone-900 font-medium mb-1">Your wishlist is empty</p>
          <p className="text-stone-400 text-sm text-center max-w-[200px]">Tap the heart icon on any product to save it here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {favorites.map((product) => (
            <div key={product.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 flex flex-col transition-transform hover:scale-[1.02]">
              <div className="relative aspect-square bg-stone-100">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <button
                  onClick={() => removeFavorite(product.id)}
                  className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
                >
                  <Trash2 size={18} className="text-stone-400 hover:text-red-500" />
                </button>
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[10px] font-bold tracking-wider uppercase text-stone-900 shadow-sm">
                  #{product.unit_number}
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="text-[10px] font-semibold tracking-wider uppercase text-stone-400 mb-1">{product.vendor} • {product.type}</div>
                <h3 className="font-serif font-medium text-stone-900 text-sm leading-tight mb-2 line-clamp-2 flex-1">{product.name}</h3>
                <div className="flex items-end justify-between mt-auto">
                  <div className="text-xs text-stone-500 truncate max-w-[60%]">{product.size}</div>
                  <div className="font-mono font-medium text-stone-900">$\{(product.price || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
