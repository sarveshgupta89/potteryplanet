import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Loader2, X, Search as SearchIcon } from 'lucide-react';

export default function Search() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Compress image before setting
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension 800px
          const MAX_DIM = 800;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              setImage(compressedFile);
              setPreview(URL.createObjectURL(compressedFile));
            }
          }, 'image/jpeg', 0.7); // 70% quality
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      
      setResults([]);
      setKeywords([]);
      setError(null);
    }
  };

  const handleSearch = async () => {
    if (!image) return;
    
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('image', image);

    try {
      const res = await fetch('/api/search-by-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        let errorMsg = 'Search failed';
        try {
          const errData = await res.json();
          errorMsg = errData.message || errorMsg;
        } catch (e) {
          errorMsg = `Server error: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.success) {
        setKeywords(data.keywords);
        setResults(data.results);
      } else {
        setError(data.message || 'Search failed');
      }
    } catch (err: any) {
      console.error('Search failed', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const clearImage = () => {
    setImage(null);
    setPreview(null);
    setResults([]);
    setKeywords([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 pb-24 max-w-5xl mx-auto font-sans">
      <header className="mb-6 py-4">
        <h1 className="text-3xl font-serif font-medium text-stone-900 mb-2">Visual Search</h1>
        <p className="text-stone-500 text-sm">Upload a photo to find similar products in our catalog.</p>
      </header>

      {!preview ? (
        <div 
          className="border-2 border-dashed border-stone-300 rounded-3xl p-12 flex flex-col items-center justify-center bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer min-h-[300px]"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
            <Camera className="text-stone-400" size={28} />
          </div>
          <p className="text-stone-900 font-medium mb-1">Tap to capture or upload</p>
          <p className="text-stone-400 text-sm text-center max-w-[200px]">Take a photo of a fountain, planter, or ornament</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="relative rounded-3xl overflow-hidden shadow-sm border border-stone-200 bg-stone-100 aspect-square max-w-md mx-auto w-full">
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <button 
              onClick={clearImage}
              className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full max-w-md mx-auto bg-stone-900 text-white font-medium py-4 rounded-2xl hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Analyzing Image...</span>
              </>
            ) : (
              <>
                <SearchIcon size={20} />
                <span>Search Catalog</span>
              </>
            )}
          </button>
          
          {error && (
            <div className="w-full max-w-md mx-auto p-4 bg-red-50 text-red-600 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleImageChange}
        className="hidden"
      />

      {keywords.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Detected Features</h3>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw, i) => (
              <span key={i} className="px-3 py-1.5 bg-stone-200 text-stone-700 text-sm rounded-full font-medium">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-serif font-medium text-stone-900 mb-4">Exact Match</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[results[0]].map((product) => (
              <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border-2 border-stone-900 flex flex-col md:flex-row">
                <div className="relative aspect-square md:w-1/2 bg-stone-100">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[10px] font-bold tracking-wider uppercase text-stone-900 shadow-sm">
                    #{product.unit_number}
                  </div>
                </div>
                <div className="p-4 md:p-6 flex flex-col flex-1 justify-center">
                  <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">{product.type}</div>
                  <h3 className="font-serif font-medium text-stone-900 text-xl leading-tight mb-2">{product.name}</h3>
                  <p className="text-stone-600 text-sm mb-4 line-clamp-3">{product.description}</p>
                  <div className="flex items-end justify-between mt-auto">
                    <div className="text-xs text-stone-500 uppercase tracking-wider">{product.vendor}</div>
                    <div className="font-mono font-medium text-stone-900 text-lg">${(product.price || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {results.length > 1 && (
            <>
              <h3 className="text-xl font-serif font-medium text-stone-900 mb-4">Similar Products</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {results.slice(1).map((product) => (
                  <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 flex flex-col">
                    <div className="relative aspect-square bg-stone-100">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[10px] font-bold tracking-wider uppercase text-stone-900 shadow-sm">
                        #{product.unit_number}
                      </div>
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-serif font-medium text-stone-900 text-sm leading-tight mb-1 line-clamp-2">{product.name}</h3>
                      <div className="flex items-end justify-between mt-auto">
                        <div className="text-[10px] text-stone-500 uppercase tracking-wider">{product.vendor}</div>
                        <div className="font-mono font-medium text-stone-900 text-sm">${(product.price || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      
      {keywords.length > 0 && results.length === 0 && (
        <div className="mt-8 text-center py-12 bg-stone-100 rounded-3xl border border-stone-200 border-dashed">
          <p className="text-stone-500">No exact matches found for these features.</p>
        </div>
      )}
    </div>
  );
}
