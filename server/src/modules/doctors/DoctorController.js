const db = require('../../db');

const DoctorController = {
    async getAll(req, res) {
        try {
            const result = await db.query(`
        SELECT d.*, s.name as specialty_name 
        FROM doctors d 
        LEFT JOIN specialties s ON d.specialty_id = s.id 
        ORDER BY d.full_name ASC
      `);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getById(req, res) {
        const { id } = req.params;
        try {
            const result = await db.query(`
        SELECT d.*, s.name as specialty_name 
        FROM doctors d 
        LEFT JOIN specialties s ON d.specialty_id = s.id 
        WHERE d.id = $1
      `, [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { full_name, specialty_id, phone } = req.body;
        try {
            const result = await db.query(
                'INSERT INTO doctors (full_name, specialty_id, phone) VALUES ($1, $2, $3) RETURNING *',
                [full_name, specialty_id, phone]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getBySpecialty(req, res) {
        const { specialtyId } = req.params;
        try {
            const result = await db.query(
                'SELECT * FROM doctors WHERE specialty_id = $1 AND is_active = TRUE ORDER BY full_name ASC',
                [specialtyId]
            );
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async update(req, res) {
        const { id } = req.params;
        const { full_name, specialty_id, phone, is_active } = req.body;
        try {
            const result = await db.query(
                `UPDATE doctors 
                 SET full_name = $1, specialty_id = $2, phone = $3, is_active = $4 
                 WHERE id = $5 RETURNING *`,
                [full_name, specialty_id, phone, is_active !== undefined ? is_active : true, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        const { id } = req.params;
        try {
            const result = await db.query(
                'UPDATE doctors SET is_active = FALSE WHERE id = $1 RETURNING *',
                [id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
            res.json({ message: 'Doctor deactivated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = DoctorController;
