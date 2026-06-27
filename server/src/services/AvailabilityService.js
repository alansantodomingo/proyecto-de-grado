const db = require('../db');

const AvailabilityService = {
    // Find a doctor for a specialty
    async findDoctorForSpecialty(specialtyId) {
        const res = await db.query(
            'SELECT id FROM doctors WHERE specialty_id = $1 AND is_active = TRUE LIMIT 1',
            [specialtyId]
        );
        return res.rows[0]?.id || null;
    },

    // Get available time slots
    async getAvailableSlots(doctorId, date) {
        // Get doctor's schedule for this day
        // Note: date input is expected to be YYYY-MM-DD string
        const dayOfWeek = new Date(date).getDay();

        // Fix for Sunday=0, Monday=1, etc. ensuring it matches DB if needed. 
        // JS getDay(): 0 (Sun) - 6 (Sat).
        // Presuming DB uses same standard.

        const schedules = await db.query(
            'SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = $1 AND weekday = $2 AND is_active = TRUE',
            [doctorId, dayOfWeek]
        );

        if (schedules.rows.length === 0) return [];

        // Get blocks for this doctor and date
        const blocks = await db.query(
            'SELECT start_time, end_time FROM doctor_blocks WHERE doctor_id = $1 AND date = $2',
            [doctorId, date]
        );

        // Get booked appointments for this date
        const booked = await db.query(`
            SELECT start_datetime FROM appointments
            WHERE doctor_id = $1 
            AND DATE(start_datetime AT TIME ZONE 'America/Bogota') = $2
            AND status != 'CANCELLED'
        `, [doctorId, date]);

        const bookedTimes = booked.rows.map(row => {
            const dt = new Date(row.start_datetime);
            return dt.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'America/Bogota'
            }); // returns HH:MM
        });

        const blockedRanges = blocks.rows.map(b => ({
            start: b.start_time.substring(0, 5),
            end: b.end_time.substring(0, 5)
        }));

        // Generate slots
        const slots = [];
        for (const schedule of schedules.rows) {
            const [startHour, startMin] = schedule.start_time.split(':').map(Number);
            const [endHour, endMin] = schedule.end_time.split(':').map(Number);

            let current = startHour * 60 + startMin;
            const end = endHour * 60 + endMin;

            while (current < end) {
                const h = Math.floor(current / 60).toString().padStart(2, '0');
                const m = (current % 60).toString().padStart(2, '0');
                const timeSlot = `${h}:${m}`;

                // Check if booked
                // We check if the exact start time is in the booked list.
                // Note: detailed collision detection (overlap) might be needed if slots aren't fixed 30m.
                // For now, assuming fixed 30m slots aligned with start times.
                const isBooked = bookedTimes.includes(timeSlot);

                // Check if blocked
                const isBlocked = blockedRanges.some(range => {
                    const [blockStartH, blockStartM] = range.start.split(':').map(Number);
                    const [blockEndH, blockEndM] = range.end.split(':').map(Number);
                    const blockStart = blockStartH * 60 + blockStartM;
                    const blockEnd = blockEndH * 60 + blockEndM;
                    // Block encompasses slot start
                    return current >= blockStart && current < blockEnd;
                });

                if (!isBooked && !isBlocked) {
                    slots.push(timeSlot);
                }

                current += 30; // 30-minute slots
            }
        }

        return slots;
    }
};

module.exports = AvailabilityService;
