const db = require('../../db');

const PatientController = {
    async getAll(req, res) {
        const { search } = req.query;
        try {
            let query = 'SELECT * FROM patients';
            let params = [];

            if (search) {
                query += ' WHERE full_name ILIKE $1 OR phone ILIKE $1 OR document_id ILIKE $1';
                params.push(`%${search}%`);
            }

            query += ' ORDER BY created_at DESC LIMIT 50';

            const result = await db.query(query, params);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { full_name, phone, document_id } = req.body;
        if (!full_name || !phone) {
            return res.status(400).json({ error: 'Name and Phone are required' });
        }

        try {
            const result = await db.query(
                'INSERT INTO patients (full_name, phone, document_id) VALUES ($1, $2, $3) RETURNING *',
                [full_name, phone, document_id]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            if (err.code === '23505') { // Unique violation
                return res.status(409).json({ error: 'Patient with this phone already exists' });
            }
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = PatientController;
