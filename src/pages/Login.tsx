import React, { useState } from 'react';
import { Leaf } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = isSignUp ? '/api/signup' : '/api/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(`Failed to ${isSignUp ? 'sign up' : 'login'}. Please try again.`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-100 p-6 font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center mb-6">
          <Leaf className="text-white" size={32} />
        </div>
        <h1 className="text-2xl font-serif font-medium text-stone-900 mb-2">Pottery Planet</h1>
        <p className="text-stone-500 text-sm mb-8 text-center">
          {isSignUp ? 'Create an account to access the product catalog.' : 'Sign in to access the product catalog and manage inventory.'}
        </p>
        
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {error && <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</div>}
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
              placeholder={isSignUp ? "Choose a username" : "admin"}
              required
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-stone-900 text-white font-medium py-3.5 rounded-xl hover:bg-stone-800 transition-colors mt-4"
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-sm text-stone-500">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }} 
            className="text-stone-900 font-medium hover:underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
