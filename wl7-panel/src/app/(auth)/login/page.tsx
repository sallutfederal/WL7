'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) { router.push('/'); router.refresh(); }
    else { setError('Credenciais invalidas'); setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-full max-w-md bg-[#14141a] border border-[#2a2a35] rounded-2xl p-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">&#128058;</div>
          <h1 className="text-2xl font-bold text-[#d4af37] tracking-wider">WL7 STORE</h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Painel de Controle</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Usuario</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[#d4af37]" placeholder="WL7 STORE" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#1e1e26] border border-[#2a2a35] text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[#d4af37]" placeholder="********" />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-semibold text-black bg-gradient-to-r from-[#b8941f] to-[#ffd700] hover:brightness-110 transition-all disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
