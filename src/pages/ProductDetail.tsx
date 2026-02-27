import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [product, setProduct] = useState<any>(location.state?.product || null);
  const [loading, setLoading] = useState(!product);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!product) {
      fetch(`/api/products/${id}`)
        .then(r => r.json())
        .then(data => { if (data.success) setProduct(data.product); })
        .finally(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    fetch(`/api/favorites/${user.id}`)
      .then(r => r.json())
      .then(data => setIsFavorite(data.some((p: any) => p.id === product.id)));
  }, [product]);

  const toggleFavorite = async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr || !product) return;
    const user = JSON.parse(userStr);
    if (isFavorite) {
      await fetch(`/api/favorites/${user.id}/${product.id}`, { method: 'DELETE' });
      setIsFavorite(false);
    } else {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, productId: product.id }),
      });
      setIsFavorite(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        Loading...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-stone-400">
        <p>Product not found.</p>
        <button onClick={() => navigate('/')} className="text-stone-900 underline text-sm">Back to Catalog</button>
      </div>
    );
  }

  const dims = [
    product.h && `H: ${product.h}"`,
    product.w && `W: ${product.w}"`,
    product.b && `B: ${product.b}"`,
    product.d && `D: ${product.d}"`,
  ].filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-stone-50/90 backdrop-blur-md border-b border-stone-100">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft size={22} className="text-stone-700" />
        </button>
        <span className="text-xs font-bold tracking-widest uppercase text-stone-500">#{product.unit_number}</span>
        <button
          onClick={toggleFavorite}
          className="p-2 -mr-2 rounded-full hover:bg-stone-100 transition-colors"
        >
          <Heart
            size={22}
            className={isFavorite ? 'fill-red-500 text-red-500' : 'text-stone-400'}
          />
        </button>
      </div>

      {/* Full image — uncropped */}
      <div className="bg-stone-100 flex items-center justify-center">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full object-contain max-h-[70vh]"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Details */}
      <div className="px-5 pt-6 flex flex-col gap-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1">
            {product.vendor} · {product.type?.replace(/_/g, ' ')}
          </div>
          <h1 className="font-serif text-2xl font-medium text-stone-900 leading-snug">{product.name}</h1>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-2xl font-semibold text-stone-900">
            ${(product.price || 0).toFixed(2)}
          </span>
          {product.size && (
            <span className="text-sm text-stone-500">{product.size}</span>
          )}
        </div>

        {dims.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dims.map(d => (
              <span key={d} className="px-3 py-1.5 bg-stone-100 text-stone-700 text-sm rounded-full font-medium">
                {d}
              </span>
            ))}
            {product.base && (
              <span className="px-3 py-1.5 bg-stone-100 text-stone-700 text-sm rounded-full font-medium">
                Base: {product.base}"
              </span>
            )}
          </div>
        )}

        {product.description && (
          <p className="text-stone-600 text-sm leading-relaxed">{product.description}</p>
        )}
      </div>
    </div>
  );
}
