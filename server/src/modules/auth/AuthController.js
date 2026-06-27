const db = require('../../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email y contraseña son requeridos' });
            }

            const result = await db.query(
                'SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const user = result.rows[0];

            if (!user.is_active) {
                return res.status(403).json({ error: 'Usuario inactivo' });
            }

            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            // Generate token
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                message: 'Login exitoso',
                token,
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (err) {
            console.error('Error in login:', err);
            res.status(500).json({ error: 'Error del servidor al iniciar sesión' });
        }
    }

    async getMe(req, res) {
        try {
            // req.user comes from authMiddleware
            const userId = req.user.id;
            const result = await db.query(
                'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            res.json(result.rows[0]);
        } catch (err) {
            console.error('Error in getMe:', err);
            res.status(500).json({ error: 'Error al obtener datos del usuario' });
        }
    }
}

module.exports = new AuthController();
