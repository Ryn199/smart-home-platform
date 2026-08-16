import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-container-low p-4">
      <div className="bg-surface border border-outline-variant rounded-2xl p-lg sm:p-xl max-w-md w-full shadow-lg shadow-black/5 space-y-lg">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex p-3 bg-secondary-container/10 rounded-2xl mb-2">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: '40px', fontVariationSettings: "'FILL' 1" }}
            >
              smart_toy
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Smart Home Admin
          </h1>
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Sign in to access Web Admin Dashboard
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-error-container/40 border border-error/20 rounded-xl text-error text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-md">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl bg-surface text-on-surface focus:outline-none focus:border-primary text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl bg-surface text-on-surface focus:outline-none focus:border-primary text-sm transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-sm cursor-pointer active:scale-98 disabled:opacity-50 mt-2"
          >
            {isLoading ? 'Signing In...' : 'Sign In to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};
