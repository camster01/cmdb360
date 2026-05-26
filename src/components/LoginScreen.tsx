import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function LoginScreen() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const ok = await login(username, password);
      if (!ok) {
        setError('Invalid username or password.');
      }
    } catch {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-900 px-8 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-white text-2xl font-bold tracking-wide">CMDB</span>
            <span className="text-blue-300 text-2xl font-bold">360</span>
            <sup className="text-blue-300 text-sm">°</sup>
          </div>
          <p className="text-blue-300 text-sm mt-1">Configuration Management Database</p>
        </div>

        {/* Form */}
        <div className="px-8 py-8">
          <h2 className="text-gray-700 text-lg font-semibold mb-6 text-center">Sign In</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter username"
                autoFocus
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter password"
                disabled={submitting}
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div className="mt-6 text-xs text-gray-400 text-center">
            <p>Demo credentials:</p>
            <p>admin / admin123 &nbsp;|&nbsp; contributor / edit123 &nbsp;|&nbsp; viewer / view123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
