const db = require('../../db');

const SpecialtyController = {
    async getAll(req, res) {
        try {
            const result = await db.query('SELECT * FROM specialties ORDER BY name ASC');
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { name, description, duration_minutes } = req.body;
        try {
            const result = await db.query(
                'INSERT INTO specialties (name, description, duration_minutes) VALUES ($1, $2, $3) RETURNING *',
                [name, description, duration_minutes]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async update(req, res) {
        const { id } = req.params;
        const { name, description, duration_minutes, is_active } = req.body;
        try {
            const result = await db.query(
                'UPDATE specialties SET name = $1, description = $2, duration_minutes = $3, is_active = $4 WHERE id = $5 RETURNING *',
                [name, description, duration_minutes, is_active !== undefined ? is_active : true, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Specialty not found' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        const { id } = req.params;
        try {
            // Soft delete
            const result = await db.query(
                'UPDATE specialties SET is_active = FALSE WHERE id = $1 RETURNING *',
                [id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Specialty not found' });
            res.json({ message: 'Specialty deactivated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = SpecialtyController;
