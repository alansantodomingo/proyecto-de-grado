import {
    LayoutDashboard,
    Calendar,
    Stethoscope,
    Users,
    MessageSquare,
    LogOut,
    Sun,
    Moon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab, theme, toggleTheme, chats = [] }) => {
    const { logout, user } = useAuth();

    const menuItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'appointments', icon: Calendar, label: 'Citas' },
        { id: 'doctors', icon: Stethoscope, label: 'Médicos' },
        { id: 'specialties', icon: Users, label: 'Especialidades' },
        { id: 'chat', icon: MessageSquare, label: 'Mensajes' },
    ];

    const hasAdvisorRequest = chats.some(c => c.advisor_requested);

    return (
        <aside className={`w-72 flex-shrink-0 flex flex-col border-r transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="p-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
                        <Calendar className="text-white" size={24} />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight dark:text-white">Hospital Admin</h1>
                </div>

                <nav className="space-y-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.label}</span>
                            {item.id === 'chat' && hasAdvisorRequest && (
                                <span className="absolute top-3 right-4 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></span>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="mt-auto p-6 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-4 mb-6 px-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                        {user?.full_name?.charAt(0) || 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate dark:text-white">{user?.full_name || 'Admin'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Administrador</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        <span className="text-xs font-medium">{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                    </button>
                    <button
                        onClick={logout}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
