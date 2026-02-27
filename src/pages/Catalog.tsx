import { useState, useEffect } from 'react';
import { Search, Filter, Heart } from 'lucide-react';

export default function Catalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [vendor, setVendor] = useState('');
  const [type, setType] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [priceRange, setPriceRange] = useState('');
  const [heightRange, setHeightRange] = useState('');
  const [widthRange, setWidthRange] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchFavorites();
  }, [search, vendor, type, priceRange, heightRange, widthRange]);

  const fetchProducts = async () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (vendor) params.append('vendor', vendor);
    if (type) params.append('type', type);
    if (priceRange === 'lt200') params.append('maxPrice', '200');
    else if (priceRange === 'lt500') params.append('maxPrice', '500');
    else if (priceRange === 'lt1000') params.append('maxPrice', '1000');
    else if (priceRange === 'gt1000') params.append('minPrice', '1000');
    if (heightRange === 'lt24') params.append('maxH', '24');
    else if (heightRange === '24to48') { params.append('minH', '24'); params.append('maxH', '48'); }
    else if (heightRange === 'gt48') params.append('minH', '48');
    if (widthRange === 'lt24') params.append('maxW', '24');
    else if (widthRange === '24to48') { params.append('minW', '24'); params.append('maxW', '48'); }
    else if (widthRange === 'gt48') params.append('minW', '48');
    
    const res = await fetch(`/api/products?${params.toString()}`);
    const data = await res.json();
    setProducts(data);
  };

  const fetchFavorites = async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    const res = await fetch(`/api/favorites/${user.id}`);
    const data = await res.json();
    setFavorites(data.map((p: any) => p.id));
  };

  const toggleFavorite = async (productId: number) => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    
    if (favorites.includes(productId)) {
      await fetch(`/api/favorites/${user.id}/${productId}`, { method: 'DELETE' });
      setFavorites(favorites.filter(id => id !== productId));
    } else {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, productId }),
      });
      setFavorites([...favorites, productId]);
    }
  };

  return (
    <div className="p-4 pb-24 max-w-5xl mx-auto font-sans">
      <header className="mb-6 sticky top-0 bg-stone-50/90 backdrop-blur-md z-10 py-4">
        <h1 className="text-3xl font-serif font-medium text-stone-900 mb-4">Catalog</h1>
        
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or unit number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent shadow-sm transition-all"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-sm appearance-none pr-8 shrink-0"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Vendors</option>
              <option value="Giannini">Giannini</option>
              <option value="Campia">Campia</option>
              <option value="Herit">Herit</option>
            </select>

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-sm appearance-none pr-8 shrink-0"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Types</option>
              <option value="Planters_and_Urns">Planters &amp; Urns</option>
              <option value="Fountains">Fountains</option>
              <option value="Benches_and_Tables">Benches &amp; Tables</option>
              <option value="Fire_Pits_and_Tables">Fire Pits &amp; Tables</option>
              <option value="Ponds_and_Coping">Ponds &amp; Coping</option>
              <option value="Italian_Ceramics">Italian Ceramics</option>
              <option value="Italian_Furniture">Italian Furniture</option>
              <option value="Home_Installations">Home Installations</option>
              <option value="Pizza_Ovens">Pizza Ovens</option>
              <option value="NEW_for_2025">New for 2025</option>
            </select>

            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-sm appearance-none pr-8 shrink-0"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Prices</option>
              <option value="lt200">Under $200</option>
              <option value="lt500">Under $500</option>
              <option value="lt1000">Under $1,000</option>
              <option value="gt1000">$1,000+</option>
            </select>

            <select
              value={heightRange}
              onChange={(e) => setHeightRange(e.target.value)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-sm appearance-none pr-8 shrink-0"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Heights</option>
              <option value="lt24">Under 24"</option>
              <option value="24to48">24" – 48"</option>
              <option value="gt48">Over 48"</option>
            </select>

            <select
              value={widthRange}
              onChange={(e) => setWidthRange(e.target.value)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900 shadow-sm appearance-none pr-8 shrink-0"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Widths</option>
              <option value="lt24">Under 24"</option>
              <option value="24to48">24" – 48"</option>
              <option value="gt48">Over 48"</option>
            </select>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
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
                onClick={() => toggleFavorite(product.id)}
                className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
              >
                <Heart
                  size={18}
                  className={favorites.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-stone-400'}
                />
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
      
      {products.length === 0 && (
        <div className="text-center py-20 text-stone-400">
          <p>No products found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
