const db = require('../../db');

const ChatController = (client) => ({
    // List all active conversations with the latest message
    getChats: async (req, res) => {
        try {
            const query = `
                SELECT 
                    s.phone, 
                    s.is_bot_active,
                    s.state,
                    s.advisor_requested,
                    p.full_name as patient_name,
                    p.document_id as patient_document,
                    m.body as last_message,
                    m.timestamp as last_message_time,
                    m.from_me
                FROM conversation_sessions s
                LEFT JOIN patients p ON s.phone = p.phone
                LEFT JOIN (
                    SELECT DISTINCT ON (phone) phone, body, timestamp, from_me
                    FROM messages
                    ORDER BY phone, timestamp DESC
                ) m ON s.phone = m.phone
                ORDER BY s.advisor_requested DESC, m.timestamp DESC NULLS LAST
            `;
            const result = await db.query(query);
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching chats:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get message history for a specific phone
    getMessages: async (req, res) => {
        const { phone } = req.params;
        try {
            const result = await db.query(
                'SELECT * FROM messages WHERE phone = $1 ORDER BY timestamp ASC',
                [phone]
            );
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching messages:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Send a manual message
    sendMessage: async (req, res) => {
        const { phone } = req.params;
        const { body } = req.body;

        if (!body) return res.status(400).json({ error: 'Message body is required' });

        try {
            await client.sendMessage(phone, body);

            // Log outgoing message
            await db.query(
                'INSERT INTO messages (phone, body, from_me) VALUES ($1, $2, $3)',
                [phone, body, true]
            );

            // If an advisor was requested, mark it as handled since we are replying manually
            await db.query(
                'UPDATE conversation_sessions SET advisor_requested = FALSE WHERE phone = $1',
                [phone]
            );

            res.json({ success: true });
        } catch (err) {
            console.error('Error sending message:', err);
            res.status(500).json({ error: 'Failed to send message via WhatsApp' });
        }
    },

    // Toggle bot status
    toggleBot: async (req, res) => {
        const { phone } = req.params;
        const { active } = req.body;

        try {
            await db.query(
                'UPDATE conversation_sessions SET is_bot_active = $1 WHERE phone = $2',
                [active, phone]
            );
            res.json({ success: true, is_bot_active: active });
        } catch (err) {
            console.error('Error toggling bot:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

module.exports = ChatController;
