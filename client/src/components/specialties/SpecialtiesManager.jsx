import { useState } from 'react';
import { Users, Plus, Edit, Trash2, X } from 'lucide-react';
import api from '../../api';

const SpecialtiesManager = ({ specialties, fetchSpecialties, loading }) => {
    const [showModal, setShowModal] = useState(false);
    const [currentSpecialty, setCurrentSpecialty] = useState(null);

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            description: formData.get('description'),
            duration_minutes: parseInt(formData.get('duration_minutes')) || 30,
            is_active: true
        };

        try {
            if (currentSpecialty) {
                await api.put(`/api/specialties/${currentSpecialty.id}`, data);
            } else {
                await api.post('/api/specialties', data);
            }
            setShowModal(false);
            fetchSpecialties();
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        }
    };

    const toggleStatus = async (specialty) => {
        if (!confirm(`¿${specialty.is_active ? 'Desactivar' : 'Activar'} la especialidad ${specialty.name}?`)) return;
        try {
            await api.put(`/api/specialties/${specialty.id}`, { ...specialty, is_active: !specialty.is_active });
            fetchSpecialties();
        } catch (err) {
            alert('Error al cambiar estado: ' + err.message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Especialidades</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona las áreas médicas disponibles.</p>
                </div>
                <button
                    onClick={() => { setCurrentSpecialty(null); setShowModal(true); }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg"
                >
                    <Plus size={18} /> Nueva Especialidad
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {specialties.map((s) => (
                    <div key={s.id} className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border ${s.is_active ? 'border-slate-200 dark:border-slate-700' : 'border-red-200 dark:border-red-900/30 opacity-75'} shadow-xl transition-all hover:scale-[1.02]`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${s.is_active ? 'bg-blue-600/10 text-blue-500' : 'bg-red-600/10 text-red-500'}`}>
                                <Users size={24} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setCurrentSpecialty(s); setShowModal(true); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"><Edit size={16} /></button>
                                <button onClick={() => toggleStatus(s)} className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors ${s.is_active ? 'text-red-500' : 'text-green-500'}`}><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{s.name}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 line-clamp-2">{s.description || 'Sin descripción'}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-400">Duración: {s.duration_minutes} min</span>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {s.is_active ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold dark:text-white">{currentSpecialty ? 'Editar' : 'Nueva'} Especialidad</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-slate-300">Nombre</label>
                                <input name="name" defaultValue={currentSpecialty?.name} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-slate-300">Descripción</label>
                                <textarea name="description" defaultValue={currentSpecialty?.description} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white h-24" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-slate-300">Duración (minutos)</label>
                                <input type="number" name="duration_minutes" defaultValue={currentSpecialty?.duration_minutes || 30} required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 transition-all">
                                Guardar Especialidad
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpecialtiesManager;
