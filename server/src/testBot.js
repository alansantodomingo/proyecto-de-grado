const WhatsAppController = require('./modules/whatsapp/WhatsAppController');
const db = require('./db');

async function test() {
    const mockClient = {
        sendMessage: async (to, text) => {
            console.log(`MOCK SEND to ${to}: ${text}`);
            return true;
        }
    };

    const mockMsg = {
        from: '573001234567@c.us',
        body: 'hola',
        reply: (text) => console.log(`MOCK REPLY: ${text}`)
    };

    console.log('Testing WhatsAppController.handleMessage...');
    try {
        await WhatsAppController.handleMessage(mockClient, mockMsg);
        console.log('Test completed successfully');
    } catch (err) {
        console.error('Test FAILED:', err);
    }
    process.exit(0);
}

test();
