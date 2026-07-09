import React, { useState } from 'react';
import { login } from '../services/api';
import { User } from '../types';
import ThemeToggle from './ThemeToggle';

interface Props {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await login(email.trim(), password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-urja-navy via-slate-800 to-slate-900 px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 shrink-0 flex items-center justify-center mb-4">
            <svg viewBox="0 0 100 114" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 4L95 30V84L50 110L5 84V30L50 4Z" fill="#ef7f21" />
              <rect x="47" y="0" width="6" height="114" fill="white" />
              <path d="M22 10 L41 21 V68 L22 57 Z" fill="white" />
              <path d="M59 36 H80 V47 H59 Z" fill="white" />
              <path d="M59 63 H80 V74 H59 Z" fill="white" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight font-display">URJA WHATSAPP BOT</h1>
          <p className="text-xs text-urja-secondary font-mono font-semibold mt-1">WhatsApp Automation Platform</p>
        </div>

        {/* Card */}
        <div className="login-form-card bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Sign in</h2>
          <p className="text-xs text-slate-500 mb-6">Access your workspace gateway</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-urja-primary focus:border-transparent transition-all placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-urja-primary focus:border-transparent transition-all pr-16 placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-urja-primary transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-urja-primary hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-sm text-sm mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
