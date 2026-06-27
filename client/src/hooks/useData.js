import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export const useData = (token) => {
    const [specialties, setSpecialties] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchSpecialties = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/specialties');
            setSpecialties(res.data);
        } catch (err) {
            console.error('Error fetching specialties:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDoctors = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/doctors');
            setDoctors(res.data);
        } catch (err) {
            console.error('Error fetching doctors:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/appointments');
            setAppointments(res.data);
        } catch (err) {
            console.error('Error fetching appointments:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAllData = useCallback(() => {
        fetchSpecialties();
        fetchDoctors();
        fetchAppointments();
    }, [fetchSpecialties, fetchDoctors, fetchAppointments]);

    useEffect(() => {
        if (token) {
            fetchAllData();
        }
    }, [token, fetchAllData]);

    return {
        specialties,
        doctors,
        appointments,
        loading,
        fetchSpecialties,
        fetchDoctors,
        fetchAppointments,
        fetchAllData
    };
};
