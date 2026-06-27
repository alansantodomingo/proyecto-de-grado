const db = require('../../db');
const AIService = require('../../services/AIService');
const AvailabilityService = require('../../services/AvailabilityService');

const WhatsAppController = {

    // ── Helpers ────────────────────────────────────────────────────────────────

    async logMessage(phone, body, from_me) {
        try {
            await db.query('INSERT INTO messages (phone, body, from_me) VALUES ($1, $2, $3)', [phone, body, from_me]);
        } catch (err) { console.error('Error logging message:', err); }
    },

    async reply(msg, text) {
        await msg.reply(text);
        await this.logMessage(msg.from, text, true);
    },

    async sendMessage(client, phone, text) {
        try {
            // Try original phone ID first (handles @lid multi-device accounts)
            let chatId = phone.includes('@') ? phone : `${phone}@c.us`;
            try {
                await client.sendMessage(chatId, text);
            } catch (firstErr) {
                // If @lid format fails, try with @c.us
                if (phone.includes('@lid') || (firstErr.message && firstErr.message.includes('LID'))) {
                    const rawNumber = phone.split('@')[0];
                    chatId = `${rawNumber}@c.us`;
                    await client.sendMessage(chatId, text);
                } else {
                    throw firstErr;
                }
            }
            await this.logMessage(phone, text, true);
        } catch (error) {
            console.error('Error sending message:', error.message || error);
        }
    },

    async sendBookingConfirmation(client, phone, appointment, specialtyName, doctorName, patientName) {
        const dateStr = new Date(appointment.start_datetime).toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota'
        });
        const timeStr = new Date(appointment.start_datetime).toLocaleTimeString('es-ES', {
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota'
        });
        const message = `✅ *¡Cita Confirmada!*\n\n📅 ${dateStr}\n⏰ ${timeStr}\n🏥 ${specialtyName || ''}\n👨‍⚕️ Dr. ${doctorName || ''}\n👤 ${patientName}\n🔑 Código: *${appointment.confirmation_code}*\n\nPor favor llega 10 minutos antes.`;
        await this.sendMessage(client, phone, message);
    },

    async getOrCreateSession(phone) {
        let res = await db.query('SELECT * FROM conversation_sessions WHERE phone = $1', [phone]);
        if (res.rows.length === 0) {
            await db.query('INSERT INTO conversation_sessions (phone, state, is_bot_active) VALUES ($1, $2, $3)', [phone, 'ACTIVE', true]);
            res = await db.query('SELECT * FROM conversation_sessions WHERE phone = $1', [phone]);
        }
        return res.rows[0];
    },

    async setBotStatus(phone, active) {
        await db.query('UPDATE conversation_sessions SET is_bot_active = $1 WHERE phone = $2', [active, phone]);
    },

    async resetConversation(phone) {
        AIService.resetContext(phone);
        await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['ACTIVE', {}, phone]);
    },

    // ── Main handler ───────────────────────────────────────────────────────────

    async handleMessage(client, msg) {
        const phone = msg.from;
        const text = msg.body.trim();
        console.log(`[AI-BOT] Received from ${phone}: "${text}"`);

        // Ignore broadcasts/groups
        if (phone === 'status@broadcast' || phone.includes('@g.us')) return;

        await this.logMessage(phone, text, false);

        try {
            let session = await this.getOrCreateSession(phone);

            // Global commands
            if (text.toLowerCase() === 'activar bot') {
                await this.setBotStatus(phone, true);
                await this.resetConversation(phone);
                await this.reply(msg, '✅ Bot reactivado. ¿En qué puedo ayudarte hoy?');
                return;
            }
            if (text.toLowerCase() === 'reiniciar' || text.toLowerCase() === 'empezar de nuevo') {
                await this.resetConversation(phone);
                await this.reply(msg, '🔄 Conversación reiniciada. ¿Cómo puedo ayudarte?');
                return;
            }
            if (!session.is_bot_active) {
                console.log(`[AI-BOT] Bot inactive for ${phone}. Skipping.`);
                return;
            }

            // Special states (no AI needed)
            if (session.state === 'CONFIRMING_CANCELLATION') {
                await this.handleCancellationConfirmation(client, msg, phone, session, text);
                return;
            }
            if (session.state === 'SELECTING_APPOINTMENT_TO_CANCEL') {
                await this.handleAppointmentSelection(client, msg, phone, session, text);
                return;
            }

            // Fetch system context for AI
            const specialties = await db.query('SELECT id, name FROM specialties WHERE is_active = TRUE');
            const doctors = await db.query('SELECT id, full_name, specialty_id FROM doctors WHERE is_active = TRUE');
            const blocks = await db.query('SELECT doctor_id, date, start_time, end_time, reason FROM doctor_blocks WHERE date >= CURRENT_DATE');

            const availableData = {
                specialties: specialties.rows.map(s => s.name),
                doctors: doctors.rows.map(d => ({ name: d.full_name, specialty_id: d.specialty_id })),
                current_date: new Date().toISOString().split('T')[0],
                doctor_blocks: blocks.rows.map(b => ({
                    doctor_id: b.doctor_id,
                    date: new Date(b.date).toISOString().split('T')[0],
                    reason: b.reason
                }))
            };

            // Call Groq AI
            const aiResponse = await AIService.chat(phone, text, availableData);

            if (!aiResponse || (!aiResponse.message && !aiResponse.action)) {
                await this.reply(msg, 'Lo siento, no pude procesar tu mensaje. ¿Podrías intentarlo de nuevo?');
                return;
            }

            // Handle AI actions
            switch (aiResponse.action) {
                case 'request_advisor':
                    await this.setBotStatus(phone, false);
                    await db.query('UPDATE conversation_sessions SET advisor_requested = TRUE WHERE phone = $1', [phone]);
                    await this.reply(msg, aiResponse.message || '👨‍💼 Un asesor humano te atenderá pronto.');
                    break;

                case 'list_appointments_for_cancellation':
                    await this.handleCancellationRequest(client, msg, phone, aiResponse);
                    break;

                case 'list_appointments_for_rescheduling':
                    await this.reply(msg, 'La reprogramación estará disponible pronto. Por ahora puedes cancelar y crear una nueva cita, o escribir *ASESOR*.');
                    break;

                case 'book_appointment':
                    await this.handleBookingAttempt(client, msg, phone, aiResponse, specialties.rows, doctors.rows);
                    break;

                default:
                    if (aiResponse.message) await this.reply(msg, aiResponse.message);
            }

        } catch (err) {
            console.error('[BOT] Error:', err);
            await this.reply(msg, 'Lo siento, hubo un error técnico. Por favor intenta más tarde o escribe *REINICIAR*.');
        }
    },

    // ── Booking ────────────────────────────────────────────────────────────────

    async handleBookingAttempt(client, msg, phone, aiResponse, specialties, doctors) {
        const { validated, issues } = AIService.validateExtractedData(aiResponse.extracted_data, specialties, doctors);

        const required = ['specialty_id', 'date', 'time', 'patient_name', 'document_id'];
        const missing = required.filter(f => !validated[f]);

        if (missing.length > 0 || issues.length > 0) {
            let response = aiResponse.message || 'Necesito más información para continuar.';
            if (issues.length > 0) response += `\n\n⚠️ ${issues.join(', ')}`;
            await this.reply(msg, response);
            return;
        }

        const doctorId = validated.doctor_id || await AvailabilityService.findDoctorForSpecialty(validated.specialty_id);
        if (!doctorId) {
            await this.reply(msg, 'No hay médicos disponibles para esta especialidad ahora mismo.');
            return;
        }

        const slots = await AvailabilityService.getAvailableSlots(doctorId, validated.date);
        if (slots.length === 0) {
            await this.reply(msg, `No hay horarios disponibles para el *${validated.date}*. ¿Quieres probar otra fecha?`);
            return;
        }

        const requestedTime = validated.time ? validated.time.substring(0, 5) : null;
        const requestedSlot = requestedTime ? slots.find(s => s === requestedTime) : null;

        if (!requestedSlot) {
            let slotsMsg = `La hora ${validated.time || 'solicitada'} no está disponible. Horarios disponibles:\n\n`;
            slots.forEach((s, i) => { slotsMsg += `*${i + 1}.* ${s}\n`; });
            slotsMsg += '\n¿Cuál prefieres? (Escribe la hora o el número)';
            await this.reply(msg, slotsMsg);
            return;
        }

        const appointment = await this.bookAppointment(phone, validated, doctorId);
        const specName = specialties.find(s => s.id === validated.specialty_id)?.name;
        const docName = doctors.find(d => d.id === doctorId)?.full_name;
        await this.sendBookingConfirmation(client, phone, appointment, specName, docName, validated.patient_name);
        await this.resetConversation(phone);
    },

    async bookAppointment(phone, data, doctorId) {
        let patient = await db.query('SELECT id FROM patients WHERE phone = $1', [phone]);
        let patientId;
        if (patient.rows.length === 0) {
            const newPat = await db.query(
                'INSERT INTO patients (phone, full_name, document_id) VALUES ($1, $2, $3) RETURNING id',
                [phone, data.patient_name, data.document_id]
            );
            patientId = newPat.rows[0].id;
        } else {
            patientId = patient.rows[0].id;
            await db.query('UPDATE patients SET full_name = $1, document_id = $2 WHERE id = $3',
                [data.patient_name, data.document_id, patientId]);
        }

        const startStr = `${data.date}T${data.time}:00-05:00`;
        const endDatetime = new Date(new Date(startStr).getTime() + 30 * 60000).toISOString();
        const confCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await db.query(`
            INSERT INTO appointments
            (patient_id, doctor_id, specialty_id, start_datetime, end_datetime, duration_minutes, status, source, confirmation_code)
            VALUES ($1, $2, $3, $4, $5, $6, 'BOOKED', 'WHATSAPP', $7)
            RETURNING *
        `, [patientId, doctorId, data.specialty_id, startStr, endDatetime, 30, confCode]);

        return result.rows[0];
    },

    // ── Cancellation ───────────────────────────────────────────────────────────

    async handleCancellationRequest(client, msg, phone, aiResponse) {
        const res = await db.query(`
            SELECT a.id, a.start_datetime, s.name as spec_name, d.full_name as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN specialties s ON a.specialty_id = s.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE p.phone = $1 AND a.status = 'BOOKED' AND a.start_datetime > CURRENT_TIMESTAMP
            ORDER BY a.start_datetime ASC
        `, [phone]);

        if (res.rows.length === 0) {
            await this.reply(msg, 'No encontré citas activas agendadas para este número.');
            return;
        }

        if (res.rows.length === 1) {
            const apt = res.rows[0];
            const dateStr = new Date(apt.start_datetime).toLocaleString('es-ES', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota'
            });
            await db.query('UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
                [JSON.stringify({ pending_cancellation_id: apt.id }), 'CONFIRMING_CANCELLATION', phone]);
            await this.reply(msg, `Tienes 1 cita activa:\n\n📅 ${dateStr}\n🏥 ${apt.spec_name}\n👨‍⚕️ Dr. ${apt.doctor_name}\n\n¿Deseas cancelarla? Responde *SI* o *NO*.`);
        } else {
            let listMsg = `Tienes ${res.rows.length} citas activas:\n\n`;
            res.rows.forEach((apt, i) => {
                const dateStr = new Date(apt.start_datetime).toLocaleString('es-ES', {
                    weekday: 'short', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota'
                });
                listMsg += `*${i + 1}.* ${dateStr} - ${apt.spec_name} (Dr. ${apt.doctor_name})\n`;
            });
            listMsg += `\n¿Cuál deseas cancelar? Responde con el número o escribe *NINGUNA*.`;
            await db.query('UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
                [JSON.stringify({ appointments_list: res.rows }), 'SELECTING_APPOINTMENT_TO_CANCEL', phone]);
            await this.reply(msg, listMsg);
        }
    },

    async handleCancellationConfirmation(client, msg, phone, session, text) {
        const response = text.toLowerCase();
        const payload = typeof session.payload_json === 'string'
            ? JSON.parse(session.payload_json) : session.payload_json;

        if (response === 'si' || response === 'sí') {
            await db.query("UPDATE appointments SET status = 'CANCELLED' WHERE id = $1", [payload.pending_cancellation_id]);
            await this.reply(msg, '✅ Tu cita ha sido cancelada exitosamente. ¿Deseas agendar una nueva cita?');
            await this.resetConversation(phone);
        } else if (response === 'no') {
            await this.reply(msg, 'Entendido, tu cita se mantiene. ¿En qué más puedo ayudarte?');
            await this.resetConversation(phone);
        } else {
            await this.reply(msg, 'Por favor responde *SI* para confirmar la cancelación o *NO* para mantener la cita.');
        }
    },

    async handleAppointmentSelection(client, msg, phone, session, text) {
        if (text.toLowerCase() === 'ninguna') {
            await this.reply(msg, 'Entendido. ¿En qué más puedo ayudarte?');
            await this.resetConversation(phone);
            return;
        }
        const payload = typeof session.payload_json === 'string'
            ? JSON.parse(session.payload_json) : session.payload_json;
        const appointments = payload.appointments_list;
        const selection = parseInt(text);

        if (isNaN(selection) || selection < 1 || selection > appointments.length) {
            await this.reply(msg, `Por favor responde con un número del 1 al ${appointments.length} o escribe *NINGUNA*.`);
            return;
        }

        const apt = appointments[selection - 1];
        const dateStr = new Date(apt.start_datetime).toLocaleString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota'
        });
        await db.query('UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
            [JSON.stringify({ pending_cancellation_id: apt.id }), 'CONFIRMING_CANCELLATION', phone]);
        await this.reply(msg, `Has seleccionado:\n\n📅 ${dateStr}\n🏥 ${apt.spec_name}\n👨‍⚕️ Dr. ${apt.doctor_name}\n\n¿Confirmas que deseas cancelarla? *SI* o *NO*.`);
    }
};

module.exports = WhatsAppController;
