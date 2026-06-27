const db = require('../../db');

const BlockController = {
    async getByDoctor(req, res) {
        const { doctorId } = req.params;
        try {
            const result = await db.query(
                'SELECT * FROM doctor_blocks WHERE doctor_id = $1 ORDER BY date ASC, start_time ASC',
                [doctorId]
            );
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { doctor_id, date, start_time, end_time, reason } = req.body;
        try {
            const result = await db.query(
                'INSERT INTO doctor_blocks (doctor_id, date, start_time, end_time, reason) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [doctor_id, date, start_time, end_time, reason]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        const { id } = req.params;
        try {
            const result = await db.query('DELETE FROM doctor_blocks WHERE id = $1 RETURNING *', [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Block not found' });
            res.json({ message: 'Block removed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = BlockController;
