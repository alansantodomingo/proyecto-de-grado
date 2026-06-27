import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import axios from 'axios';
import api, { API_URL } from './api';

// Contexts & Hooks
import { useAuth } from './context/AuthContext';
import { useSocket } from './context/SocketContext';
import { useData } from './hooks/useData';

// Components
import Sidebar from './components/layout/Sidebar';
import Login from './components/auth/Login';
import WhatsAppSetup from './components/whatsapp/WhatsAppSetup';
import Dashboard from './components/dashboard/Dashboard';
import AppointmentsManager from './components/appointments/AppointmentsManager';
import DoctorsManager from './components/doctors/DoctorsManager';
import SpecialtiesManager from './components/specialties/SpecialtiesManager';
import ChatManager from './components/chat/ChatManager';

function App() {
    const { token, authLoading } = useAuth();
    const { status } = useSocket();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

    const {
        specialties,
        doctors,
        appointments,
        loading,
        fetchSpecialties,
        fetchDoctors,
        fetchAppointments,
        fetchAllData
    } = useData(token);

    // Chat states (kept here for global sync if needed)
    const [chats, setChats] = useState([]);
    const fetchChats = async () => {
        if (!token) return;
        try {
            const res = await api.get('/api/chats');
            setChats(res.data);
        } catch (err) {
            console.error('Error fetching chats:', err);
        }
    };

    useEffect(() => {
        if (token) fetchChats();
    }, [token]);

    // Booking Modal states (shared between Dashboard and Appointments)
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingData, setBookingData] = useState({
        phone: '', full_name: '', document_id: '', specialty_id: '', doctor_id: '', start_datetime: '', is_new_patient: false
    });

    const handlePatientLookup = async (phone) => {
        if (phone.length < 7) return;
        try {
            const res = await api.get(`/api/patients?search=${phone}`);
            if (res.data.length > 0) {
                const p = res.data.find(pat => pat.phone.includes(phone)) || res.data[0];
                setBookingData(prev => ({ ...prev, full_name: p.full_name, is_new_patient: false, patient_id: p.id }));
            } else {
                setBookingData(prev => ({ ...prev, full_name: '', is_new_patient: true, patient_id: null }));
            }
        } catch (err) {
            console.error('Error lookup patient:', err);
        }
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        try {
            let patientId = bookingData.patient_id;
            if (bookingData.is_new_patient) {
                const pRes = await api.post('/api/patients', {
                    full_name: bookingData.full_name,
                    phone: bookingData.phone,
                    document_id: bookingData.document_id
                });
                patientId = pRes.data.id;
            }
            await api.post('/api/appointments', {
                patient_id: patientId,
                doctor_id: bookingData.doctor_id,
                specialty_id: bookingData.specialty_id,
                start_datetime: bookingData.start_datetime,
                source: 'ADMIN'
            });
            alert('Cita agendada con éxito');
            setShowBookingModal(false);
            setBookingData({ phone: '', full_name: '', document_id: '', specialty_id: '', doctor_id: '', start_datetime: '', is_new_patient: false });
            fetchAppointments();
        } catch (err) {
            alert('Error al agendar: ' + (err.response?.data?.error || err.message));
        }
    };

    // Theme effect
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    // Derived dashboard data
    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments.filter(a => a.start_datetime.startsWith(today));
    const getLast7Days = () => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const shortName = d.toLocaleDateString('es-ES', { weekday: 'short' });
            const count = appointments.filter(a => a.start_datetime.startsWith(dateStr)).length;
            days.push({ day: shortName, count, date: dateStr });
        }
        return days;
    };
    const chartData = getLast7Days();
    const maxChartValue = Math.max(...chartData.map(d => d.count), 5);

    if (authLoading) {
        return (
            <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'} flex items-center justify-center`}>
                <RefreshCw className="animate-spin text-blue-500" size={40} />
            </div>
        );
    }

    if (!token) {
        return <Login theme={theme} toggleTheme={toggleTheme} />;
    }

    if (status !== 'ready') {
        return <WhatsAppSetup />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} toggleTheme={toggleTheme} chats={chats} />

            <main className="flex-1 p-8 overflow-auto">
                {activeTab === 'dashboard' && (
                    <Dashboard
                        appointments={appointments}
                        todaysAppointments={todaysAppointments}
                        doctors={doctors}
                        chats={chats}
                        chartData={chartData}
                        maxChartValue={maxChartValue}
                        setActiveTab={setActiveTab}
                        setShowBookingModal={setShowBookingModal}
                        fetchAppointments={fetchAppointments}
                    />
                )}

                {activeTab === 'appointments' && (
                    <AppointmentsManager
                        appointments={appointments}
                        specialties={specialties}
                        doctors={doctors}
                        fetchAppointments={fetchAppointments}
                        loading={loading}
                        setShowBookingModal={setShowBookingModal}
                        showBookingModal={showBookingModal}
                        bookingData={bookingData}
                        setBookingData={setBookingData}
                        handleBookingSubmit={handleBookingSubmit}
                        handlePatientLookup={handlePatientLookup}
                    />
                )}

                {activeTab === 'doctors' && (
                    <DoctorsManager
                        doctors={doctors}
                        specialties={specialties}
                        fetchDoctors={fetchDoctors}
                        loading={loading}
                    />
                )}

                {activeTab === 'specialties' && (
                    <SpecialtiesManager
                        specialties={specialties}
                        fetchSpecialties={fetchSpecialties}
                        loading={loading}
                    />
                )}

                {activeTab === 'chat' && (
                    <ChatManager
                        chats={chats}
                        fetchChats={fetchChats}
                    />
                )}
            </main>

            {/* Global Booking Modal logic is inside components that need it, 
                but AppointmentsManager handles its own instance for the 'list' view.
                This structure allows keeping App.jsx clean. */}
        </div>
    );
}

export default App;
