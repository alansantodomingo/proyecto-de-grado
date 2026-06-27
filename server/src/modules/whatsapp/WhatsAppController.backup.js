const db = require('../../db');

const WhatsAppController = {
    async handleMessage(client, msg) {
        const phone = msg.from;
        const text = msg.body.trim();
        console.log(`[BOT] Recibido mensaje de ${phone}: "${text}"`);

        // 1. Log incoming message
        await this.logMessage(phone, text, false);

        try {
            let session = await this.getOrCreateSession(phone);

            // 2. Check for keywords even if bot is inactive
            if (text.toLowerCase().includes('asesor')) {
                await this.setBotStatus(phone, false);
                await this.reply(msg, 'Entendido. He desactivado mi respuesta automática. Un asesor humano te atenderá pronto. 👋');
                await this.logMessage(phone, 'Handoff to human advisor', true);
                return;
            }

            if (text.toLowerCase() === 'activar bot') {
                await this.setBotStatus(phone, true);
                await this.reply(msg, '✅ Robot reactivado. ¿En qué puedo ayudarte?');
                await this.logMessage(phone, 'Bot reactivated', true);
                return;
            }

            if (text.toLowerCase() === 'cancelar') {
                await this.handleCancellation(client, msg, session);
                return;
            }

            // 3. Skip automated logic if bot is inactive
            if (!session.is_bot_active) {
                console.log(`[BOT] Bot is inactive for ${phone}. Skipping logic.`);
                return;
            }

            console.log(`[BOT] Estado actual para ${phone}: ${session.state}`);

            // Allow resetting session
            if (text.toLowerCase() === 'reiniciar' || (text.toLowerCase() === 'hola' && session.state === 'READY')) {
                session = await this.resetSession(phone);
            }

            switch (session.state) {
                case 'START':
                    await this.handleStart(client, msg, session);
                    break;
                case 'SELECTING_SPECIALTY':
                    await this.handleSpecialtySelection(client, msg, session);
                    break;
                case 'SELECTING_DOCTOR':
                    await this.handleDoctorSelection(client, msg, session);
                    break;
                case 'SELECTING_DATE':
                    await this.handleDateSelection(client, msg, session);
                    break;
                case 'SELECTING_TIME':
                    await this.handleTimeSelection(client, msg, session);
                    break;
                case 'ASKING_NAME':
                    await this.handleNameInput(client, msg, session);
                    break;
                case 'ASKING_DOCUMENT':
                    await this.handleDocumentInput(client, msg, session);
                    break;
                case 'RETURNING_PATIENT':
                    await this.handleReturningPatient(client, msg, session);
                    break;
                case 'CONFIRMING':
                    await this.handleConfirmation(client, msg, session);
                    break;
                default:
                    // If in unknown state or READY, send welcome
                    await this.sendWelcome(client, msg);
                    break;
            }
        } catch (err) {
            console.error('Bot Error:', err);
            const errorMsg = 'Lo siento, hubo un error técnico. Por favor intenta más tarde o escribe *REINICIAR*.';
            await client.sendMessage(phone, errorMsg);
            await this.logMessage(phone, errorMsg, true);
        }
    },

    async getOrCreateSession(phone) {
        const res = await db.query('SELECT * FROM conversation_sessions WHERE phone = $1', [phone]);
        if (res.rows.length > 0) return res.rows[0];

        const newSession = await db.query(
            'INSERT INTO conversation_sessions (phone, state) VALUES ($1, $2) RETURNING *',
            [phone, 'START']
        );
        return newSession.rows[0];
    },

    async updateSession(phone, state, payload = {}) {
        await db.query(
            'UPDATE conversation_sessions SET state = $1, payload_json = $2, updated_at = CURRENT_TIMESTAMP WHERE phone = $3',
            [state, JSON.stringify(payload), phone]
        );
    },

    async resetSession(phone) {
        const res = await db.query(
            'UPDATE conversation_sessions SET state = $1, payload_json = $2, updated_at = CURRENT_TIMESTAMP WHERE phone = $3 RETURNING *',
            ['START', {}, phone]
        );
        return res.rows[0];
    },

    async sendWelcome(client, msg) {
        const specialties = await db.query('SELECT name FROM specialties WHERE is_active = TRUE ORDER BY name');
        let response = '¡Hola! Bienvenido al sistema de agendamiento. 👋\n\n¿Para qué especialidad deseas agendar?\n';
        specialties.rows.forEach((s, i) => {
            response += `${i + 1}. *${s.name}*\n`;
        });
        response += '\nPor favor escribe el *número* o el *nombre* de la especialidad.';
        await msg.reply(response);
    },

    async handleStart(client, msg, session) {
        const specialties = await db.query('SELECT id, name FROM specialties WHERE is_active = TRUE ORDER BY name');
        const text = msg.body.trim().toLowerCase();

        let selected = specialties.rows.find((s, i) => (i + 1).toString() === text || s.name.toLowerCase() === text);

        if (selected) {
            const doctors = await db.query('SELECT id, full_name FROM doctors WHERE specialty_id = $1 AND is_active = TRUE', [selected.id]);
            if (doctors.rows.length === 0) {
                return this.reply(msg, 'Lo sentimos, no hay médicos disponibles para esta especialidad en este momento.');
            }

            let response = `Has seleccionado *${selected.name}*.\n\n¿Con qué médico te gustaría agendar?\n`;
            doctors.rows.forEach((d, i) => {
                response += `${i + 1}. ${d.full_name}\n`;
            });

            await this.updateSession(session.phone, 'SELECTING_DOCTOR', { specialty_id: selected.id, specialty_name: selected.name });
            await this.reply(msg, response);
        } else {
            await this.sendWelcome(client, msg);
        }
    },

    async handleDoctorSelection(client, msg, session) {
        const { specialty_id } = session.payload_json;
        const doctors = await db.query('SELECT id, full_name FROM doctors WHERE specialty_id = $1 AND is_active = TRUE', [specialty_id]);
        const text = msg.body.trim().toLowerCase();

        let selected = doctors.rows.find((d, i) => (i + 1).toString() === text || d.full_name.toLowerCase().includes(text));

        if (selected) {
            // Get available dates (next 7 days for now)
            let response = `Has seleccionado al Dr/a. *${selected.full_name}*.\n\n¿Para qué día deseas tu cita? (Responde con el número)\n`;
            const dates = [];
            for (let i = 1; i <= 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dateStr = date.toISOString().split('T')[0];
                const label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                dates.push({ date: dateStr, label: label });
                response += `${i}. ${label}\n`;
            }

            await this.updateSession(session.phone, 'SELECTING_DATE', {
                ...session.payload_json,
                doctor_id: selected.id,
                doctor_name: selected.full_name,
                available_dates: dates
            });
            await this.reply(msg, response);
        } else {
            await this.reply(msg, 'Por favor selecciona un médico válido de la lista.');
        }
    },

    async handleDateSelection(client, msg, session) {
        const { available_dates, doctor_id, specialty_id } = session.payload_json;
        const text = msg.body.trim();
        const index = parseInt(text) - 1;

        if (available_dates[index]) {
            const selectedDate = available_dates[index].date;

            // CALCULAR SLOTS (Esta es la parte difícil, haré una versión inicial)
            const slots = await this.generateSlots(doctor_id, specialty_id, selectedDate);

            if (slots.length === 0) {
                return msg.reply('No hay horarios disponibles para este día. Por favor selecciona otro.');
            }

            let response = `Horarios disponibles para el *${available_dates[index].label}*:\n\n`;
            slots.forEach((s, i) => {
                response += `${i + 1}. ${s}\n`;
            });
            response += '\nEscribe el número del horario que prefieras.';

            await this.updateSession(session.phone, 'SELECTING_TIME', {
                ...session.payload_json,
                date: selectedDate,
                date_label: available_dates[index].label,
                available_slots: slots
            });
            await this.reply(msg, response);
        } else {
            await this.reply(msg, 'Por favor selecciona un número válido del 1 al 7.');
        }
    },

    async handleTimeSelection(client, msg, session) {
        const { available_slots } = session.payload_json;
        const index = parseInt(msg.body.trim()) - 1;

        if (available_slots[index]) {
            const time = available_slots[index];

            // Check if patient exists
            const patientRes = await db.query('SELECT full_name, document_id FROM patients WHERE phone = $1', [session.phone]);

            if (patientRes.rows.length > 0) {
                const patient = patientRes.rows[0];
                await this.updateSession(session.phone, 'RETURNING_PATIENT', {
                    ...session.payload_json,
                    time,
                    patient_name: patient.full_name,
                    patient_document: patient.document_id
                });
                await this.reply(msg, `He detectado que ya has agendado antes como *${patient.full_name}*.\n\n¿Deseas usar estos mismos datos para tu cita?\n\nResponde *SI* para confirmar o *NO* para ingresar nuevos datos.`);
            } else {
                await this.updateSession(session.phone, 'ASKING_NAME', {
                    ...session.payload_json,
                    time
                });
                await this.reply(msg, 'Perfecto. Por favor escribe tu *Nombre Completo*.');
            }
        } else {
            await this.reply(msg, 'Selección inválida. Escribe el número del horario.');
        }
    },

    async handleNameInput(client, msg, session) {
        const name = msg.body.trim();
        if (name.length < 3) return this.reply(msg, 'Por favor escribe un nombre válido.');

        await this.updateSession(session.phone, 'ASKING_NAME', {
            ...session.payload_json,
            patient_name: name
        });
        await this.reply(msg, `Gracias, *${name}*. Ahora escribe tu número de *Cédula o Documento*.`);
    },

    async handleDocumentInput(client, msg, session) {
        const doc = msg.body.trim();
        if (doc.length < 5) return msg.reply('Por favor escribe un documento válido.');

        const { specialty_name, doctor_name, date_label, time, patient_name } = session.payload_json;

        let summary = `*RESUMEN DE TU CITA:*\n\n`;
        summary += `🏥 *Especialidad:* ${specialty_name}\n`;
        summary += `👨‍⚕️ *Médico:* ${doctor_name}\n`;
        summary += `📅 *Fecha:* ${date_label}\n`;
        summary += `⏰ *Hora:* ${time}\n`;
        summary += `👤 *Paciente:* ${patient_name}\n`;
        summary += `🆔 *Documento:* ${doc}\n\n`;
        summary += `¿Los datos son correctos? Responde *SI* para confirmar o *NO* para empezar de nuevo.`;

        await this.updateSession(session.phone, 'CONFIRMING', {
            ...session.payload_json,
            patient_document: doc
        });
        await this.reply(msg, summary);
    },

    async handleReturningPatient(client, msg, session) {
        const text = msg.body.trim().toLowerCase();

        if (text === 'si' || text === 'sí') {
            const { specialty_name, doctor_name, date_label, time, patient_name, patient_document } = session.payload_json;

            let summary = `*RESUMEN DE TU CITA:*\n\n`;
            summary += `🏥 *Especialidad:* ${specialty_name}\n`;
            summary += `👨‍⚕️ *Médico:* ${doctor_name}\n`;
            summary += `📅 *Fecha:* ${date_label}\n`;
            summary += `⏰ *Hora:* ${time}\n`;
            summary += `👤 *Paciente:* ${patient_name}\n`;
            summary += `🆔 *Documento:* ${patient_document}\n\n`;
            summary += `¿Los datos son correctos? Responde *SI* para confirmar o *NO* para empezar de nuevo.`;

            await this.updateSession(session.phone, 'CONFIRMING', { ...session.payload_json });
            await this.reply(msg, summary);
        } else if (text === 'no') {
            await this.updateSession(session.phone, 'ASKING_NAME', { ...session.payload_json });
            await this.reply(msg, 'Entendido. Por favor escribe tu *Nombre Completo*.');
        } else {
            await this.reply(msg, 'Por favor responde *SI* o *NO*.');
        }
    },

    async handleConfirmation(client, msg, session) {
        const text = msg.body.trim().toLowerCase();

        if (text === 'si' || text === 'sí') {
            const { specialty_id, doctor_id, date, time, patient_name, patient_document } = session.payload_json;

            // 1. Get or create patient
            let patient = await db.query('SELECT id FROM patients WHERE phone = $1', [session.phone]);
            let patientId;
            if (patient.rows.length === 0) {
                const newP = await db.query(
                    'INSERT INTO patients (full_name, document_id, phone) VALUES ($1, $2, $3) RETURNING id',
                    [patient_name, patient_document, session.phone]
                );
                patientId = newP.rows[0].id;
            } else {
                patientId = patient.rows[0].id;
            }

            // 2. Create appointment
            // Force Colombia offset (-05:00) so it's stored correctly as TIMESTAMPTZ
            const startStr = `${date}T${time}:00-05:00`;
            const specRes = await db.query('SELECT duration_minutes FROM specialties WHERE id = $1', [specialty_id]);
            const duration = specRes.rows[0].duration_minutes;
            const startDatetime = new Date(startStr);
            const endDatetime = new Date(startDatetime.getTime() + duration * 60000);
            const confCode = Math.random().toString(36).substring(7).toUpperCase();

            await db.query(`
                INSERT INTO appointments 
                (patient_id, doctor_id, specialty_id, start_datetime, end_datetime, duration_minutes, status, source, confirmation_code)
                VALUES ($1, $2, $3, $4, $5, $6, 'BOOKED', 'WHATSAPP', $7)
            `, [patientId, doctor_id, specialty_id, startStr, endDatetime, duration, confCode]);

            await this.reply(msg, `✅ *¡Cita Confirmada!*\n\nTu código de confirmación es: *${confCode}*.\n\nTe esperamos.`);
            await this.updateSession(session.phone, 'READY', {});
        } else if (text === 'no') {
            await this.resetSession(session.phone);
            await this.sendWelcome(client, msg);
        } else {
            await this.reply(msg, 'Por favor responde *SI* o *NO*.');
        }
    },

    async generateSlots(doctorId, specialtyId, date) {
        const weekday = new Date(date).getUTCDay();

        // 1. Get duration
        const specRes = await db.query('SELECT duration_minutes FROM specialties WHERE id = $1', [specialtyId]);
        const duration = specRes.rows[0].duration_minutes;

        // 2. Get schedules
        const schedRes = await db.query(
            'SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = $1 AND weekday = $2 AND is_active = TRUE',
            [doctorId, weekday]
        );

        // 3. Get existing appointments
        const appRes = await db.query(
            "SELECT start_datetime FROM appointments WHERE doctor_id = $1 AND start_datetime::date = $2 AND status != 'CANCELLED'",
            [doctorId, date]
        );
        const bookedSlots = appRes.rows.map(r => {
            const d = new Date(r.start_datetime);
            // Use Intl.DateTimeFormat to get HH:mm in Colombia time
            const bogotaTime = new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Bogota',
                hour12: false
            }).format(d);
            return bogotaTime;
        });

        const allSlots = [];

        for (const schedule of schedRes.rows) {
            // Force -05:00 for slot generation baseline
            let current = new Date(`${date}T${schedule.start_time}-05:00`);
            const end = new Date(`${date}T${schedule.end_time}-05:00`);

            while (current < end) {
                const timeStr = current.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Bogota',
                    hour12: false
                });

                if (!bookedSlots.includes(timeStr)) {
                    allSlots.push(timeStr);
                }
                current = new Date(current.getTime() + duration * 60000);
            }
        }

        return allSlots;
    },

    async logMessage(phone, body, fromMe) {
        try {
            await db.query(
                'INSERT INTO messages (phone, body, from_me) VALUES ($1, $2, $3)',
                [phone, body, fromMe]
            );
        } catch (err) {
            console.error('Error logging message:', err);
        }
    },

    async setBotStatus(phone, active) {
        await db.query(
            'UPDATE conversation_sessions SET is_bot_active = $1 WHERE phone = $2',
            [active, phone]
        );
    },

    async reply(msg, text) {
        await msg.reply(text);
        await this.logMessage(msg.from, text, true);
    },

    async handleCancellation(client, msg, session) {
        const phone = session.phone;
        // Find next booked appointment
        const res = await db.query(`
            SELECT a.id, a.start_datetime, s.name as spec_name 
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN specialties s ON a.specialty_id = s.id
            WHERE p.phone = $1 AND a.status = 'BOOKED' AND a.start_datetime > CURRENT_TIMESTAMP
            ORDER BY a.start_datetime ASC
            LIMIT 1
        `, [phone]);

        if (res.rows.length === 0) {
            return this.reply(msg, 'No encontré ninguna cita activa agendada para este número.');
        }

        const appt = res.rows[0];
        const dateStr = new Date(appt.start_datetime).toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
        });

        await db.query("UPDATE appointments SET status = 'CANCELLED' WHERE id = $1", [appt.id]);
        await this.reply(msg, `✅ Tu cita de *${appt.spec_name}* para el *${dateStr}* ha sido cancelada exitosamente.`);
        await this.resetSession(phone);
    }
};

module.exports = WhatsAppController;
