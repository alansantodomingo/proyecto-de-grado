const db = require('./index');
const bcrypt = require('bcrypt');

const seedAdminUser = async () => {
    try {
        const adminEmail = 'admin@admin.com';
        const checkUser = await db.query('SELECT * FROM users WHERE email = $1', [adminEmail]);

        if (checkUser.rows.length === 0) {
            console.log('Admin user not found, creating...');
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash('admin123', salt);

            await db.query(
                'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                ['Administrador Sistema', adminEmail, passwordHash, 'ADMIN']
            );
            console.log('Admin user created successfully.');
        } else {
            console.log('Admin user already exists.');
        }
    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
};

module.exports = seedAdminUser;
