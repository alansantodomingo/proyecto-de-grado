import { useState } from 'react';
import { Calendar, AlertCircle, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const Login = ({ theme, toggleTheme }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/api/auth/login', { email, password });
            login(res.data.token, res.data.user);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} flex items-center justify-center p-4 transition-colors duration-300`}>
            <div className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-8 rounded-2xl shadow-2xl border max-w-md w-full`}>
                <div className="flex justify-center mb-6">
                    <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-600/30">
                        <Calendar className="text-white" size={48} />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-2">Hospital App</h1>
                <p className="text-center text-slate-500 dark:text-slate-400 mb-8">Ingresa tus credenciales para administrar el sistema</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Correo Electrónico</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'} outline-none transition-colors`}
                            placeholder="admin@admin.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'} outline-none transition-colors`}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3 rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98]"
                    >
                        {loading ? 'Cargando...' : 'Ingresar al Sistema'}
                    </button>
                </form>
                <div className="mt-6 flex justify-center">
                    <button onClick={toggleTheme} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
