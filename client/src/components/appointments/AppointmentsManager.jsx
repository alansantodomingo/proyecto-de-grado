import { useState } from 'react';
import {
    LayoutDashboard,
    Calendar,
    Plus,
    RefreshCw,
    X,
    ArrowLeft
} from 'lucide-react';
import api from '../../api';

const AppointmentsManager = ({
    appointments,
    specialties,
    doctors,
    fetchAppointments,
    loading,
    setShowBookingModal,
    showBookingModal,
    bookingData,
    setBookingData,
    handleBookingSubmit,
    handlePatientLookup
}) => {
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
    const [showAppointmentModal, setShowAppointmentModal] = useState(false);
    const [currentAppointment, setCurrentAppointment] = useState(null);
    const [isRescheduling, setIsRescheduling] = useState(false);

    // Calendar Helpers
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const generateCalendarDays = () => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push({ day: null });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayApts = appointments.filter(a => a.start_datetime.startsWith(dateStr));
            days.push({ day: i, date: dateStr, appointments: dayApts });
        }
        return days;
    };

    const handleMonthChange = (increment) => {
        const newDate = new Date(currentCalendarDate);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentCalendarDate(newDate);
    };

    const handleCancelAppointment = async (id) => {
        if (!confirm('¿Estás seguro de cancelar esta cita?')) return;
        try {
            await api.put(`/api/appointments/${id}/cancel`);
            fetchAppointments();
            setShowAppointmentModal(false);
        } catch (err) {
            alert('Error al cancelar: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleRescheduleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newDatetime = formData.get('new_datetime');
        const newDoctorId = formData.get('new_doctor_id');

        try {
            await api.put(`/api/appointments/${currentAppointment.id}`, {
                start_datetime: newDatetime,
                doctor_id: newDoctorId
            });
            fetchAppointments();
            setIsRescheduling(false);
            setShowAppointmentModal(false);
        } catch (err) {
            alert('Error al reagendar: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Citas Agendadas</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona y visualiza todas las citas médicas.</p>
                </div>
                <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all ${viewMode === 'list'
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        <LayoutDashboard size={18} /> Lista
                    </button>
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all ${viewMode === 'calendar'
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        <Calendar size={18} /> Calendario
                    </button>
                    <button
                        onClick={() => setShowBookingModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg ml-2"
                    >
                        <Plus size={18} /> Nueva Cita
                    </button>
                    <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <button
                        onClick={fetchAppointments}
                        className="px-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                        title="Refrescar"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {viewMode === 'list' ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                <th className="px-6 py-4">Paciente</th>
                                <th className="px-6 py-4">Especialidad</th>
                                <th className="px-6 py-4">Médico</th>
                                <th className="px-6 py-4">Fecha y Hora</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4">Origen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {appointments.map((a) => (
                                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors" onClick={() => { setCurrentAppointment(a); setShowAppointmentModal(true); setIsRescheduling(false); }}>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-900 dark:text-white">{a.patient_name}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{a.patient_phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{a.specialty_name}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{a.doctor_name}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {new Date(a.start_datetime).toLocaleString('es-ES', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${a.status === 'BOOKED' ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' :
                                            a.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400' :
                                                'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                                            }`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{a.source}</td>
                                </tr>
                            ))}
                            {appointments.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-slate-500 italic">No hay citas agendadas aún.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                            {currentCalendarDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"><ArrowLeft size={20} /></button>
                            <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"><ArrowLeft size={20} className="rotate-180" /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-4 mb-2">
                        {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(d => (
                            <div key={d} className="text-center text-xs font-bold text-slate-500 uppercase py-2">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-4">
                        {generateCalendarDays().map((dayObj, i) => (
                            <div
                                key={i}
                                className={`min-h-[100px] border rounded-xl p-2 transition-all relative group
                                    ${!dayObj.day
                                        ? 'bg-transparent border-transparent'
                                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-blue-500/50 hover:bg-slate-100 dark:hover:bg-slate-700/30'}
                                    ${dayObj.date === new Date().toISOString().split('T')[0] ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''}
                                `}
                            >
                                {dayObj.day && (
                                    <>
                                        <span className={`text-sm font-bold ${dayObj.date === new Date().toISOString().split('T')[0] ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>{dayObj.day}</span>
                                        <div className="mt-2 space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                                            {dayObj.appointments.map(apt => (
                                                <div key={apt.id}
                                                    onClick={(e) => { e.stopPropagation(); setCurrentAppointment(apt); setShowAppointmentModal(true); setIsRescheduling(false); }}
                                                    className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300 px-1.5 py-1 rounded truncate border-l-2 border-blue-500 hover:bg-blue-200 dark:hover:bg-blue-600 hover:text-blue-800 dark:hover:text-white cursor-pointer transition-colors" title={`${apt.patient_name} - ${apt.specialty_name}`}>
                                                    {new Date(apt.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {apt.patient_name.split(' ')[0]}...
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Appointment Details/Reschedule Modal */}
            {showAppointmentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Detalles de la Cita</h3>
                            <button type="button" onClick={() => setShowAppointmentModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                        </div>

                        {!isRescheduling ? (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                        <span className="text-slate-500 dark:text-slate-400">Paciente:</span>
                                        <span className="font-bold dark:text-white">{currentAppointment?.patient_name}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                        <span className="text-slate-500 dark:text-slate-400">Especialidad:</span>
                                        <span className="font-bold dark:text-white">{currentAppointment?.specialty_name}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                        <span className="text-slate-500 dark:text-slate-400">Médico:</span>
                                        <span className="font-bold dark:text-white">{currentAppointment?.doctor_name}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                        <span className="text-slate-500 dark:text-slate-400">Fecha/Hora:</span>
                                        <span className="font-bold dark:text-white">
                                            {new Date(currentAppointment?.start_datetime).toLocaleString('es-ES')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsRescheduling(true)}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl transition-all"
                                    >
                                        Reagendar
                                    </button>
                                    <button
                                        onClick={() => handleCancelAppointment(currentAppointment.id)}
                                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl transition-all"
                                    >
                                        Cancelar Cita
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nuevo Médico</label>
                                    <select name="new_doctor_id" defaultValue={currentAppointment.doctor_id} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none text-slate-900 dark:text-white">
                                        {doctors.filter(d => d.specialty_id === currentAppointment.specialty_id).map(d => (
                                            <option key={d.id} value={d.id}>{d.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nueva Fecha y Hora</label>
                                    <input type="datetime-local" name="new_datetime" defaultValue={currentAppointment.start_datetime.slice(0, 16)} required className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl outline-none text-slate-900 dark:text-white dark:[color-scheme:dark]" />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setIsRescheduling(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-xl">Volver</button>
                                    <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-xl shadow-lg">Guardar Cambios</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Booking Modal */}
            {showBookingModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <form onSubmit={handleBookingSubmit} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-2xl w-full max-w-lg shadow-2xl space-y-6 max-h-[90vh] overflow-auto custom-scrollbar">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Nueva Cita</h3>
                            <button type="button" onClick={() => setShowBookingModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X /></button>
                        </div>

                        <div className="space-y-4">
                            {/* Patient Info */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-700/50">
                                <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">Datos del Paciente</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Celular</label>
                                        <input
                                            value={bookingData.phone}
                                            onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })}
                                            onBlur={(e) => handlePatientLookup(e.target.value)}
                                            required
                                            placeholder="57300..."
                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Documento</label>
                                        <input
                                            value={bookingData.document_id}
                                            onChange={(e) => setBookingData({ ...bookingData, document_id: e.target.value })}
                                            placeholder="Opcional"
                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                                        />
                                    </div>
                                    <div className="col-span-2 flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Nombre Completo</label>
                                        <input
                                            value={bookingData.full_name}
                                            onChange={(e) => setBookingData({ ...bookingData, full_name: e.target.value })}
                                            required
                                            readOnly={!bookingData.is_new_patient}
                                            className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 ${!bookingData.is_new_patient ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                                        />
                                        {bookingData.is_new_patient && bookingData.phone.length > 6 && (
                                            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">* Nuevo paciente detectado</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Appointment Info */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-700/50">
                                <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 pb-2">Detalles de la Cita</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Especialidad</label>
                                        <select
                                            value={bookingData.specialty_id}
                                            onChange={(e) => setBookingData({ ...bookingData, specialty_id: e.target.value, doctor_id: '' })}
                                            required
                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Médico</label>
                                        <select
                                            value={bookingData.doctor_id}
                                            onChange={(e) => setBookingData({ ...bookingData, doctor_id: e.target.value })}
                                            required
                                            disabled={!bookingData.specialty_id}
                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 text-slate-900 dark:text-white"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {doctors
                                                .filter(d => !bookingData.specialty_id || d.specialty_id === bookingData.specialty_id)
                                                .map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)
                                            }
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Fecha y Hora</label>
                                        <input
                                            type="datetime-local"
                                            value={bookingData.start_datetime}
                                            onChange={(e) => setBookingData({ ...bookingData, start_datetime: e.target.value })}
                                            required
                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white dark:[color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95">
                            Confirmar Cita
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AppointmentsManager;
