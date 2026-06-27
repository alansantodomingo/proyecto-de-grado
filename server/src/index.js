require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const db = require('./db/schema');
const seedAdminUser = require('./db/seed');

// Initialize Database
db().then(() => seedAdminUser()).catch(err => console.error('Database initialization error:', err));
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;

// Clear WhatsApp locks recursively if any
const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || './.wwebjs_auth';
const clearLocks = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      clearLocks(fullPath);
    } else if (file === 'SingletonLock') {
      try {
        fs.unlinkSync(fullPath);
        console.log(`Stale Chromium lock removed at: ${fullPath}`);
      } catch (e) {
        console.error(`Error removing lock at ${fullPath}:`, e);
      }
    }
  }
};
clearLocks(SESSION_PATH);

// WhatsApp Client Setup
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "session", // Explicitly name the session
    dataPath: SESSION_PATH
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
    executablePath: process.env.CHROME_PATH || undefined
  }
});

let whatsappStatus = 'disconnected'; // disconnected, qr, ready, error

client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
  whatsappStatus = 'qr';
  io.emit('qr', qr);
});

client.on('ready', () => {
  console.log('WhatsApp Client is ready!');
  whatsappStatus = 'ready';
  io.emit('ready');
});

client.on('authenticated', () => {
  console.log('WhatsApp Client authenticated');
  whatsappStatus = 'ready';
});

client.on('auth_failure', msg => {
  console.error('AUTHENTICATION FAILURE', msg);
  whatsappStatus = 'disconnected';
});

const WhatsAppController = require('./modules/whatsapp/WhatsAppController');

client.on('message', async msg => {
  console.log(`[BOT-DEBUG] Mensaje recibido: "${msg.body}" de ${msg.from}`);
  if (msg.body === '!ping') {
    msg.reply('pong');
    return;
  }

  await WhatsAppController.handleMessage(client, msg);
});

const initializeClient = async (isRetry = false) => {
  try {
    whatsappStatus = 'connecting';
    io.emit('status_sync', { status: 'connecting' });
    await client.initialize();
  } catch (err) {
    console.error('Initialization error:', err);

    // If init fails, we should try to close the browser before wiping files
    try {
      await client.destroy();
    } catch (destroyErr) {
      console.error('Error destroying client after init failure:', destroyErr);
    }

    if (!isRetry) {
      console.log('Attempting to recover by clearing session...');
      clearLocks(SESSION_PATH);

      // Add a small delay for OS to release file handles
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        if (fs.existsSync(SESSION_PATH)) {
          fs.rmSync(SESSION_PATH, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
          console.log('Session folder wiped for recovery');
        }
      } catch (e) {
        console.error('Failed to wipe session folder (might be busy):', e.message);
      }

      // Wait a bit and retry
      setTimeout(() => initializeClient(true), 2000);
    } else {
      whatsappStatus = 'error';
      io.emit('status_sync', { status: 'error', message: err.message });
    }
  }
};

initializeClient();

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Admin panel connected');

  // Send current status to the new connection
  socket.emit('status_sync', {
    status: whatsappStatus,
  });

  // Allow manual reset from UI
  socket.on('reset_session', async () => {
    console.log('Manual session reset requested');
    try {
      whatsappStatus = 'disconnected';
      io.emit('status_sync', { status: 'disconnected' });

      try {
        await client.destroy();
      } catch (e) {
        console.error('Error destroying client during manual reset:', e);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (fs.existsSync(SESSION_PATH)) {
        fs.rmSync(SESSION_PATH, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
      }

      console.log('Manual reset complete, exiting for restart...');
      // Restart process (Nodemon or Docker restart policy will handle it)
      process.exit(0);
    } catch (e) {
      console.error('Error during manual reset:', e);
    }
  });
});

app.get('/status', (req, res) => {
  res.json({ status: 'running' });
});

// Auth Routes
const { verifyToken } = require('./middlewares/authMiddleware');
app.use('/api/auth', require('./modules/auth/authRoutes'));

// Protected Resource Routes
app.use('/api/specialties', verifyToken, require('./modules/specialties/specialtyRoutes'));
app.use('/api/doctors', verifyToken, require('./modules/doctors/doctorRoutes'));

// Inject client into appointment routes and protect it
app.use('/api/appointments', require('./modules/appointments/appointmentRoutes')(client));

app.use('/api/chats', verifyToken, require('./modules/chat/chatRoutes')(client));
app.use('/api/patients', verifyToken, require('./modules/patients/patientRoutes'));

// Background Jobs
const AppointmentControllerFactory = require('./modules/appointments/AppointmentController');
const appointmentController = AppointmentControllerFactory(client);

// Check for no-shows every 5 minutes
setInterval(() => {
  appointmentController.updateNoShows();
}, 5 * 60 * 1000);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
