const db = require('../../db');
const AvailabilityService = require('../../services/AvailabilityService');
const WhatsAppController = require('../whatsapp/WhatsAppController');

module.exports = (client) => {
    return {
        async getAvailability(req, res) {
            const { specialtyId, date } = req.query;
            if (!specialtyId || !date) {
                return res.status(400).json({ error: 'specialtyId and date are required' });
            }

            try {
                // 1. Get specialty duration (validating it exists)
                const specialtyRes = await db.query('SELECT duration_minutes FROM specialties WHERE id = $1', [specialtyId]);
                if (specialtyRes.rows.length === 0) return res.status(404).json({ error: 'Specialty not found' });

                // 2. Find doctors for this specialty
                const doctorsRes = await db.query('SELECT id, full_name FROM doctors WHERE specialty_id = $1 AND is_active = TRUE', [specialtyId]);
                const doctors = doctorsRes.rows;

                const availableSlots = [];

                for (const doctor of doctors) {
                    // Use shared service logic
                    const slots = await AvailabilityService.getAvailableSlots(doctor.id, date);

                    if (slots.length > 0) {
                        availableSlots.push({
                            doctorId: doctor.id,
                            doctorName: doctor.full_name,
                            slots: slots
                        });
                    }
                }

                res.json(availableSlots);
            } catch (err) {
                console.error('Error getting availability:', err);
                res.status(500).json({ error: err.message });
            }
        },

        async create(req, res) {
            const { patient_id, doctor_id, specialty_id, start_datetime, source, patient_phone, patient_name } = req.body;
            // patient_phone/name might be needed if patient_id is not passed or for notifications

            try {
                // Get duration from specialty
                const specRes = await db.query('SELECT name, duration_minutes FROM specialties WHERE id = $1', [specialty_id]);
                if (specRes.rows.length === 0) return res.status(404).json({ error: 'Specialty not found' });

                const { duration_minutes, name: specialtyName } = specRes.rows[0];

                const end_datetime = new Date(new Date(start_datetime).getTime() + duration_minutes * 60000);
                const confCode = Math.random().toString(36).substring(2, 8).toUpperCase();

                // Insert appointment
                const createdBy = req.user ? req.user.id : null;
                const finalSource = req.user ? 'ADMIN' : (source || 'WHATSAPP');

                const result = await db.query(
                    `INSERT INTO appointments 
             (patient_id, doctor_id, specialty_id, start_datetime, end_datetime, duration_minutes, source, confirmation_code, status, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BOOKED', $9) 
             RETURNING *`,
                    [patient_id, doctor_id, specialty_id, start_datetime, end_datetime, duration_minutes, finalSource, confCode, createdBy]
                );

                const appointment = result.rows[0];

                // Send WhatsApp Notification (if client is available and we have phone number)
                if (client) {
                    // Fetch patient phone if not in body
                    let phone = patient_phone;
                    let pName = patient_name;

                    if (!phone || !pName) {
                        const patRes = await db.query('SELECT phone, full_name FROM patients WHERE id = $1', [patient_id]);
                        if (patRes.rows.length > 0) {
                            phone = patRes.rows[0].phone;
                            pName = patRes.rows[0].full_name;
                        }
                    }

                    if (phone) {
                        const docRes = await db.query('SELECT full_name FROM doctors WHERE id = $1', [doctor_id]);
                        const doctorName = docRes.rows[0]?.full_name;

                        // Use WhatsAppController helper
                        WhatsAppController.sendBookingConfirmation(
                            client,
                            phone,
                            appointment,
                            specialtyName,
                            doctorName,
                            pName
                        ).catch(err => console.error('Failed to send confirmation:', err));
                    }
                }

                res.status(201).json(appointment);
            } catch (err) {
                console.error('Error creating appointment:', err);
                res.status(500).json({ error: err.message });
            }
        },

        async validateCode(req, res) {
            const { code } = req.body;
            if (!code) return res.status(400).json({ error: 'Code is required' });

            try {
                // Find appointment with this code
                // Only validate active appointments (BOOKED or CONFIRMED)
                const result = await db.query(
                    `SELECT a.*, p.full_name as patient_name, d.full_name as doctor_name 
                     FROM appointments a
                     JOIN patients p ON a.patient_id = p.id
                     JOIN doctors d ON a.doctor_id = d.id
                     WHERE a.confirmation_code = $1 AND a.status IN ('BOOKED', 'CONFIRMED')`,
                    [code.toUpperCase()]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Código inválido o cita ya atendida/cancelada.' });
                }

                const appointment = result.rows[0];

                // Update status to COMPLETED
                await db.query('UPDATE appointments SET status = \'COMPLETED\' WHERE id = $1', [appointment.id]);

                res.json({
                    success: true,
                    message: 'Cita validada y completada exitosamente.',
                    appointment: appointment
                });

            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        },

        async getAll(req, res) {
            try {
                const result = await db.query(`
                    SELECT 
                        a.*, 
                        p.full_name as patient_name, 
                        p.phone as patient_phone,
                        d.full_name as doctor_name, 
                        s.name as specialty_name
                    FROM appointments a
                    LEFT JOIN patients p ON a.patient_id = p.id
                    LEFT JOIN doctors d ON a.doctor_id = d.id
                    LEFT JOIN specialties s ON a.specialty_id = s.id
                    ORDER BY a.start_datetime DESC
                `);
                res.json(result.rows);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        },

        async update(req, res) {
            const { id } = req.params;
            const { start_datetime, doctor_id } = req.body;

            try {
                if (start_datetime && doctor_id) {
                    const date = start_datetime.split('T')[0];
                    const time = start_datetime.split('T')[1].substring(0, 5); // HH:MM

                    const blockRes = await db.query(
                        'SELECT * FROM doctor_blocks WHERE doctor_id = $1 AND date = $2 AND start_time <= $3 AND end_time > $3',
                        [doctor_id, date, time]
                    );

                    if (blockRes.rows.length > 0) {
                        return res.status(400).json({ error: 'El médico no está disponible en este horario (Bloqueado/Vacaciones).' });
                    }
                }

                const updatedBy = req.user ? req.user.id : null;
                const result = await db.query(
                    'UPDATE appointments SET start_datetime = COALESCE($1, start_datetime), doctor_id = COALESCE($2, doctor_id), updated_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
                    [start_datetime, doctor_id, updatedBy, id]
                );

                if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
                res.json(result.rows[0]);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        },

        async cancel(req, res) {
            const { id } = req.params;
            const updatedBy = req.user ? req.user.id : null;
            try {
                const result = await db.query(
                    "UPDATE appointments SET status = 'CANCELLED', updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
                    [id, updatedBy]
                );
                if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
                res.json(result.rows[0]);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        },

        async updateNoShows() {
            try {
                const result = await db.query(
                    "UPDATE appointments SET status = 'NO_SHOW' WHERE status = 'BOOKED' AND end_datetime < NOW() RETURNING *"
                );
                if (result.rows.length > 0) {
                    console.log(`[Auto-Job] Marked ${result.rows.length} appointments as NO_SHOW.`);
                }
            } catch (err) {
                console.error('[Auto-Job Error] Failed to update no-shows:', err);
            }
        }
    };
};
