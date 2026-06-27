import { useState } from 'react';
import {
    Calendar,
    CheckCircle,
    Plus,
    LayoutDashboard,
    Users,
    MessageSquare,
    AlertCircle,
    X
} from 'lucide-react';
import api from '../../api';

const Dashboard = ({
    appointments,
    todaysAppointments,
    doctors,
    chats,
    chartData,
    maxChartValue,
    setActiveTab,
    setShowBookingModal,
    fetchAppointments
}) => {
    const [codeToValidate, setCodeToValidate] = useState('');
    const [validationResult, setValidationResult] = useState(null);

    const handleValidateCode = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/api/appointments/validate-code', {
                code: codeToValidate
            });
            setValidationResult({ success: true, message: res.data.message, appointment: res.data.appointment });
            setCodeToValidate('');
            fetchAppointments();
        } catch (err) {
            setValidationResult({ success: false, message: err.response?.data?.error || 'Error al validar código' });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Dashboard General</h2>
                <p className="text-slate-500 dark:text-slate-400">Resumen de actividad y métricas clave.</p>
            </header>

            {/* Attendance Verification Widget */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <CheckCircle size={120} />
                </div>
                <div className="relative z-10 max-w-md">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <CheckCircle /> Validar Llegada
                    </h3>
                    <p className="text-blue-100 text-sm mb-4">Ingresa el código de confirmación enviado al WhatsApp del paciente para registrar su llegada.</p>

                    <form onSubmit={handleValidateCode} className="flex gap-2">
                        <input
                            value={codeToValidate}
                            onChange={(e) => setCodeToValidate(e.target.value.toUpperCase())}
                            placeholder="CÓDIGO (ej. X7Y2Z9)"
                            className="flex-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 outline-none placeholder-blue-200 text-white font-mono uppercase focus:bg-white/30 transition-all"
                        />
                        <button type="submit" className="bg-white text-blue-600 font-bold px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
                            Validar
                        </button>
                    </form>

                    {validationResult && (
                        <div className={`mt-4 p-3 rounded-xl border ${validationResult.success ? 'bg-green-500/20 border-green-400/50 text-green-100' : 'bg-red-500/20 border-red-400/50 text-red-100'} flex items-start gap-3 animate-in fade-in slide-in-from-top-2`}>
                            {validationResult.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                            <div className="text-sm">
                                <p className="font-bold">{validationResult.success ? '¡Validación Exitosa!' : 'Error'}</p>
                                <p>{validationResult.message}</p>
                                {validationResult.success && validationResult.appointment && (
                                    <div className="mt-1 text-xs opacity-90">
                                        Paciente: {validationResult.appointment.patient_name} <br />
                                        Dr: {validationResult.appointment.doctor_name}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setValidationResult(null)} className="ml-auto hover:text-white"><X size={16} /></button>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-blue-900/10 transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-blue-600/20 p-3 rounded-xl text-blue-500">
                            <Calendar size={24} />
                        </div>
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">Hoy</span>
                    </div>
                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{todaysAppointments.length}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Citas Programadas</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-purple-900/10 transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-purple-600/20 p-3 rounded-xl text-purple-500">
                            <Users size={24} />
                        </div>
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">Total</span>
                    </div>
                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{doctors.length}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Médicos Activos</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-green-900/10 transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-green-600/20 p-3 rounded-xl text-green-500">
                            <CheckCircle size={24} />
                        </div>
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">Total</span>
                    </div>
                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{appointments.length}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Citas Históricas</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-amber-900/10 transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-amber-600/20 p-3 rounded-xl text-amber-500">
                            <MessageSquare size={24} />
                        </div>
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">Activos</span>
                    </div>
                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{chats.length}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Conversaciones</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Today's Appointments List */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl flex flex-col">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Calendar className="text-blue-500" size={20} />
                            Agenda de Hoy
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => setShowBookingModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                                <Plus size={14} /> Nueva
                            </button>
                            <button onClick={() => setActiveTab('appointments')} className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-bold uppercase tracking-wider">Ver Todo</button>
                        </div>
                    </div>
                    <div className="p-4 flex-1 overflow-auto max-h-[400px] space-y-3">
                        {todaysAppointments.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">
                                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No hay citas para hoy</p>
                            </div>
                        ) : (
                            todaysAppointments.map(apt => (
                                <div key={apt.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all">
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg text-center min-w-[60px] shadow-sm">
                                        <span className="block text-xl font-bold text-slate-700 dark:text-white">{new Date(apt.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{apt.patient_name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{apt.specialty_name} • Dr. {apt.doctor_name}</p>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${apt.status === 'CONFIRMED' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Activity Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <LayoutDashboard className="text-purple-500" size={20} />
                        Actividad Semanal
                    </h3>
                    <div className="flex-1 flex items-end justify-between gap-2 h-[300px] pb-6 px-4">
                        {chartData.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                <div className="relative w-full bg-slate-100 dark:bg-slate-700/30 rounded-t-xl overflow-hidden flex items-end justify-center hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors h-full">
                                    {/* Bar */}
                                    <div
                                        className="w-full mx-2 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t-lg transition-all duration-1000 ease-out group-hover:from-blue-500 group-hover:to-cyan-300 relative"
                                        style={{ height: `${(d.count / maxChartValue) * 100}%` }}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-10">
                                            {d.count} Citas
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-slate-500 uppercase">{d.day}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
