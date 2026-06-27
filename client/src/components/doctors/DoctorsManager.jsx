import { useState } from 'react';
import {
    Plus,
    Edit,
    Calendar,
    Eye,
    Lock,
    Power,
    X,
    Trash2,
    CheckCircle
} from 'lucide-react';
import api from '../../api';

const DoctorsManager = ({ doctors, specialties, fetchDoctors, loading }) => {
    // Modals
    const [showDoctorModal, setShowDoctorModal] = useState(false);
    const [currentDoctor, setCurrentDoctor] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [doctorSchedules, setDoctorSchedules] = useState([]);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [doctorBlocks, setDoctorBlocks] = useState([]);
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [availabilityDate, setAvailabilityDate] = useState(new Date().toISOString().split('T')[0]);
    const [fetchingAvailability, setFetchingAvailability] = useState(false);

    // CRUD Handlers
    const handleSaveDoctor = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            full_name: formData.get('full_name'),
            specialty_id: formData.get('specialty_id'),
            phone: formData.get('phone'),
            is_active: true
        };

        try {
            if (currentDoctor) {
                await api.put(`/api/doctors/${currentDoctor.id}`, data);
            } else {
                await api.post('/api/doctors', data);
            }
            setShowDoctorModal(false);
            fetchDoctors();
        } catch (err) {
            alert('Error al guardar: ' + err.message);
        }
    };

    const handleToggleStatus = async (doctor) => {
        if (!confirm(`¿${doctor.is_active ? 'Desactivar' : 'Activar'} al médico ${doctor.full_name}?`)) return;
        try {
            await api.put(`/api/doctors/${doctor.id}`, { ...doctor, is_active: !doctor.is_active });
            fetchDoctors();
        } catch (err) {
            alert('Error al cambiar estado: ' + err.message);
        }
    };

    // Schedule Handlers
    const fetchDoctorSchedules = async (doctorId) => {
        try {
            const res = await api.get(`/api/doctors/${doctorId}/schedules`);
            setDoctorSchedules(res.data);
        } catch (err) {
            console.error('Error fetching schedules:', err);
        }
    };

    const handleSaveSchedule = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const weekdays = [];
        ['day-0', 'day-1', 'day-2', 'day-3', 'day-4', 'day-5', 'day-6'].forEach((id, index) => {
            if (document.getElementById(id)?.checked) weekdays.push(index);
        });

        if (weekdays.length === 0) {
            alert('Por favor selecciona al menos un día');
            return;
        }

        const data = {
            doctor_id: currentDoctor.id,
            weekdays: weekdays,
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time')
        };

        try {
            await api.post('/api/doctors/schedules', data);
            fetchDoctorSchedules(currentDoctor.id);
            e.target.reset();
            weekdays.forEach(d => {
                const el = document.getElementById(`day-${d}`);
                if (el) el.checked = false;
            });
        } catch (err) {
            alert('Error al guardar horario: ' + err.message);
        }
    };

    const handleDeleteSchedule = async (id) => {
        try {
            await api.delete(`/api/doctors/schedules/${id}`);
            fetchDoctorSchedules(currentDoctor.id);
        } catch (err) {
            alert('Error al eliminar horario: ' + err.message);
        }
    };

    // Block Handlers
    const fetchDoctorBlocks = async (doctorId) => {
        try {
            const res = await api.get(`/api/doctors/${doctorId}/blocks`);
            setDoctorBlocks(res.data);
        } catch (err) {
            console.error('Error fetching blocks:', err);
        }
    };

    const handleSaveBlock = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            doctor_id: currentDoctor.id,
            date: formData.get('date'),
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time'),
            reason: formData.get('reason')
        };

        try {
            await api.post('/api/doctors/blocks', data);
            fetchDoctorBlocks(currentDoctor.id);
            e.target.reset();
        } catch (err) {
            alert('Error al guardar bloqueo: ' + err.message);
        }
    };

    const handleDeleteBlock = async (id) => {
        try {
            await api.delete(`/api/doctors/blocks/${id}`);
            fetchDoctorBlocks(currentDoctor.id);
        } catch (err) {
            alert('Error al eliminar bloqueo: ' + err.message);
        }
    };

    // Availability Handlers
    const fetchAvailability = async (doctorId, date) => {
        try {
            const doctor = doctors.find(d => d.id === doctorId);
            if (!doctor) return;

            setFetchingAvailability(true);
            const res = await api.get('/api/appointments/availability', {
                params: { specialtyId: doctor.specialty_id, date }
            });
            const data = res.data.find(d => d.doctorId === doctorId);
            setAvailableSlots(data ? data.slots : []);
        } catch (err) {
            console.error(err);
            setAvailableSlots([]);
        } finally {
            setFetchingAvailability(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Médicos</h2>
                <button
                    onClick={() => { setCurrentDoctor(null); setShowDoctorModal(true); }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
                >
                    <Plus size={20} /> Nuevo Médico
                </button>
            </header>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                            <th className="px-6 py-4">Nombre</th>
                            <th className="px-6 py-4">Especialidad</th>
                            <th className="px-6 py-4">Teléfono</th>
                            <th className="px-6 py-4">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {doctors.map((d) => (
                            <tr key={d.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${!d.is_active ? 'opacity-50' : ''}`}>
                                <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{d.full_name} {!d.is_active && '(Inactivo)'}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{d.specialty_name}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{d.phone}</td>
                                <td className="px-6 py-4 flex gap-4">
                                    <button onClick={() => { setCurrentDoctor(d); setShowDoctorModal(true); }} className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300" title="Editar Médico"><Edit size={18} /></button>
                                    <button onClick={() => { setCurrentDoctor(d); setShowScheduleModal(true); fetchDoctorSchedules(d.id); }} className="text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300" title="Agenda"><Calendar size={18} /></button>
                                    <button onClick={() => { setCurrentDoctor(d); setAvailabilityDate(new Date().toISOString().split('T')[0]); fetchAvailability(d.id, new Date().toISOString().split('T')[0]); setShowAvailabilityModal(true); }} className="text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300" title="Ver Disponibilidad"><Eye size={18} /></button>
                                    <button onClick={() => { setCurrentDoctor(d); setShowBlockModal(true); fetchDoctorBlocks(d.id); }} className="text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300" title="Bloqueos"><Lock size={18} /></button>
                                    <button onClick={() => handleToggleStatus(d)} className={`${d.is_active ? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300' : 'text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300'}`} title={d.is_active ? "Desactivar" : "Activar"}><Power size={18} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Doctor Modal */}
            {showDoctorModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <form onSubmit={handleSaveDoctor} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{currentDoctor ? 'Editar' : 'Nuevo'} Médico</h3>
                            <button type="button" onClick={() => setShowDoctorModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nombre Completo</label>
                                <input name="full_name" defaultValue={currentDoctor?.full_name} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Especialidad</label>
                                <select name="specialty_id" defaultValue={currentDoctor?.specialty_id} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white">
                                    <option value="">Seleccionar especialidad...</option>
                                    {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Teléfono (WhatsApp)</label>
                                <input name="phone" defaultValue={currentDoctor?.phone} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400" />
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95">Guardar Médico</button>
                    </form>
                </div>
            )}

            {/* Schedule Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-auto">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Horarios de Atención</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Configuración semanal para Dr. {currentDoctor?.full_name}</p>
                            </div>
                            <button type="button" onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* New Schedule Form */}
                            <form onSubmit={handleSaveSchedule} className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                <h4 className="font-bold text-slate-800 dark:text-slate-300">Agregar Bloque de Horario</h4>
                                
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Días</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((day, i) => (
                                            <label key={i} className="flex items-center gap-2 cursor-pointer group">
                                                <input type="checkbox" id={`day-${i}`} className="hidden peer" />
                                                <div className="w-full text-center py-2 rounded-lg border border-slate-200 dark:border-slate-700 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white text-xs font-bold transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                                                    {day}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Hora Inicio</label>
                                        <input type="time" name="start_time" required className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 dark:text-white dark:[color-scheme:dark]" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Hora Fin</label>
                                        <input type="time" name="end_time" required className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 dark:text-white dark:[color-scheme:dark]" />
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-all shadow-md">
                                    Añadir Horario
                                </button>
                            </form>

                            {/* Current Schedules List */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-800 dark:text-slate-300">Horarios Registrados</h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {doctorSchedules.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic">No hay horarios configurados.</p>
                                    ) : (
                                        doctorSchedules.map(s => (
                                            <div key={s.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl group">
                                                <div>
                                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                        {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][s.weekday]}
                                                    </p>
                                                    <p className="text-sm dark:text-white font-mono">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</p>
                                                </div>
                                                <button onClick={() => handleDeleteSchedule(s.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Blocks Modal */}
            {showBlockModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-auto">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Bloqueos de Agenda</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Excepciones y descansos para Dr. {currentDoctor?.full_name}</p>
                            </div>
                            <button type="button" onClick={() => setShowBlockModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <form onSubmit={handleSaveBlock} className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                <h4 className="font-bold text-slate-800 dark:text-slate-300">Registrar Nuevo Bloqueo</h4>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                                    <input type="date" name="date" required className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 dark:text-white dark:[color-scheme:dark]" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Hora Inicio</label>
                                        <input type="time" name="start_time" required className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 dark:text-white dark:[color-scheme:dark]" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Hora Fin</label>
                                        <input type="time" name="end_time" required className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 dark:text-white dark:[color-scheme:dark]" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Razón (Opcional)</label>
                                    <input name="reason" placeholder="Ej: Vacaciones, Congreso..." className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 dark:text-white" />
                                </div>
                                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg transition-all shadow-md">
                                    Bloquear Horario
                                </button>
                            </form>

                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-800 dark:text-slate-300">Bloqueos Activos</h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {doctorBlocks.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic">No hay bloqueos registrados.</p>
                                    ) : (
                                        doctorBlocks.map(b => (
                                            <div key={b.id} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl group">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{new Date(b.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                                                        <p className="text-sm dark:text-white font-mono">{b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}</p>
                                                        {b.reason && <p className="text-[10px] text-slate-500 italic mt-1">"{b.reason}"</p>}
                                                    </div>
                                                    <button onClick={() => handleDeleteBlock(b.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Availability Modal */}
            {showAvailabilityModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-xl shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Disponibilidad</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Dr. {currentDoctor?.full_name}</p>
                            </div>
                            <button type="button" onClick={() => setShowAvailabilityModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Consultar Fecha</label>
                                <input
                                    type="date"
                                    value={availabilityDate}
                                    onChange={(e) => { setAvailabilityDate(e.target.value); fetchAvailability(currentDoctor.id, e.target.value); }}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-white dark:[color-scheme:dark]"
                                />
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-bold text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                    <CheckCircle size={16} className="text-green-500" /> Espacios Disponibles
                                </h4>
                                {fetchingAvailability ? (
                                    <div className="text-center py-8 text-slate-400 animate-pulse">Cargando disponibilidad...</div>
                                ) : availableSlots.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 italic bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                        No hay espacios disponibles para esta fecha.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                        {availableSlots.map((slot, i) => (
                                            <div key={i} className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 py-2 px-1 rounded-lg text-center font-bold text-sm border border-green-200 dark:border-green-500/30">
                                                {slot}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorsManager;
