const db = require('../src/db');

async function migrate() {
    try {
        console.log('Adding advisor_requested column to conversation_sessions...');
        await db.query(`
            ALTER TABLE conversation_sessions 
            ADD COLUMN IF NOT EXISTS advisor_requested BOOLEAN DEFAULT FALSE;
        `);
        console.log('Migration successful: advisor_requested column added.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
