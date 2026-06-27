const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Fallback models in order of preference (all free on Groq)
const FALLBACK_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'mixtral-8x7b-32768'
];

const SYSTEM_PROMPT = `Eres un asistente virtual para agendar citas médicas por WhatsApp. Tu trabajo es ayudar a los pacientes a:
1. Agendar citas médicas
2. Cancelar citas existentes
3. Reprogramar citas
4. Conectarlos con un asesor humano si lo solicitan

REGLAS CRÍTICAS:
1. NUNCA inventes disponibilidad. Di "Voy a verificar el horario" y usa la acción "book_appointment".
2. Pide los datos faltantes (nombre, cédula, fecha, hora) antes de intentar agendar.
3. Horas SIEMPRE en formato 24h (14:00, no 2pm).
4. Fechas SIEMPRE en formato YYYY-MM-DD. Convierte "mañana", "pasado mañana", "11 de marzo" usando la fecha actual en DATOS DEL SISTEMA.
5. Si el usuario da una fecha en texto natural, conviértela tú mismo al formato YYYY-MM-DD.

RESPONDE SIEMPRE EN FORMATO JSON (sin markdown, sin bloques de código):
{
  "message": "Tu respuesta natural al usuario",
  "action": "continue|book_appointment|list_appointments_for_cancellation|list_appointments_for_rescheduling|request_advisor",
  "extracted_data": {
    "specialty_name": "nombre de la especialidad o null",
    "doctor_preference": "nombre del médico o null",
    "date": "YYYY-MM-DD o null",
    "time": "HH:MM o null",
    "patient_name": "nombre completo o null",
    "document_id": "cédula/documento o null"
  },
  "confidence": "high|medium|low"
}

EJEMPLOS:
Usuario: "Hola"
{"message":"¡Hola! Con gusto te ayudo a agendar tu cita médica. ¿Para qué especialidad la necesitas?","action":"continue","extracted_data":{},"confidence":"high"}

Usuario: "Oncología para mañana a las 10am, soy Juan Pérez, cédula 12345"
{"message":"Perfecto Juan. Voy a verificar disponibilidad en Oncología para mañana a las 10:00. Un momento.","action":"book_appointment","extracted_data":{"specialty_name":"oncología","date":"2026-03-10","time":"10:00","patient_name":"Juan Pérez","document_id":"12345"},"confidence":"high"}

Usuario: "Cancelar mi cita"
{"message":"Claro, voy a buscar tus citas activas.","action":"list_appointments_for_cancellation","extracted_data":{},"confidence":"high"}

Usuario: "Necesito hablar con alguien"
{"message":"Entendido, te comunicaré con un asesor humano.","action":"request_advisor","extracted_data":{},"confidence":"high"}`;

class AIService {
    constructor() {
        this.conversationContexts = new Map();
    }

    getContext(phone) {
        if (!this.conversationContexts.has(phone)) {
            this.conversationContexts.set(phone, [
                { role: 'system', content: SYSTEM_PROMPT }
            ]);
        }
        return this.conversationContexts.get(phone);
    }

    addMessage(phone, role, content) {
        const context = this.getContext(phone);
        context.push({ role, content });
        // Keep last 20 messages + system prompt
        if (context.length > 21) {
            context.splice(1, context.length - 21);
        }
    }

    resetContext(phone) {
        this.conversationContexts.delete(phone);
    }

    // Low-level call to Groq with a specific model
    async callGroq(model, messages) {
        const response = await axios.post(
            GROQ_API_URL,
            { model, messages, temperature: 0.4, max_tokens: 600 },
            {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            }
        );
        const choice = response.data?.choices?.[0];
        if (!choice?.message?.content) {
            console.error(`[AI][${model}] Empty response:`, JSON.stringify(response.data));
            throw new Error(`${model} returned empty response`);
        }
        return choice.message.content;
    }

    // Main chat method with automatic fallback across models
    async chat(phone, userMessage, availableData = {}) {
        this.addMessage(phone, 'user', userMessage);

        const context = this.getContext(phone);
        let enrichedContext = [...context];
        if (Object.keys(availableData).length > 0) {
            enrichedContext.push({
                role: 'system',
                content: `DATOS DEL SISTEMA (fecha actual: ${availableData.current_date}):\n${JSON.stringify(availableData, null, 2)}`
            });
        }

        // Build deduplicated model list
        const modelsToTry = [MODEL, ...FALLBACK_MODELS].filter((m, i, arr) => arr.indexOf(m) === i);

        for (const model of modelsToTry) {
            try {
                console.log(`[AI] Trying model: ${model}`);
                const rawContent = await this.callGroq(model, enrichedContext);

                // Strip any markdown code fences
                const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

                let parsed;
                try {
                    // First, try parsing the whole thing
                    parsed = JSON.parse(cleaned);
                } catch {
                    // If that fails, try to extract the JSON object from within the text
                    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            parsed = JSON.parse(jsonMatch[0]);
                        } catch {
                            // Give up, use raw content as plain message
                            parsed = { message: rawContent, action: 'continue', extracted_data: {}, confidence: 'low' };
                        }
                    } else {
                        parsed = { message: rawContent, action: 'continue', extracted_data: {}, confidence: 'low' };
                    }
                }

                this.addMessage(phone, 'assistant', parsed.message || rawContent);
                console.log(`[AI] Success with: ${model}, action: ${parsed.action}`);
                return parsed;

            } catch (err) {
                const reason = err.response?.data?.error?.message || err.message;
                console.error(`[AI][${model}] Failed: ${reason}`);
                await new Promise(r => setTimeout(r, 300));
            }
        }

        console.error('[AI] All Groq models exhausted.');
        return {
            message: 'Lo siento, el servicio de IA no está disponible en este momento. Por favor intenta en unos minutos o escribe *ASESOR* para hablar con una persona.',
            action: 'continue',
            extracted_data: {},
            confidence: 'low',
            error: true
        };
    }

    // Validate and normalize data extracted by the AI
    validateExtractedData(extractedData, specialties = [], doctors = []) {
        const validated = { ...extractedData };
        const issues = [];

        // Validate specialty
        if (validated.specialty_name) {
            const match = specialties.find(s =>
                s.name.toLowerCase().includes(validated.specialty_name.toLowerCase()) ||
                validated.specialty_name.toLowerCase().includes(s.name.toLowerCase())
            );
            if (match) {
                validated.specialty_id = match.id;
                validated.specialty_name = match.name;
            } else {
                issues.push(`No encontré la especialidad "${validated.specialty_name}"`);
            }
        }

        // Validate doctor
        if (validated.doctor_preference) {
            const match = doctors.find(d =>
                d.full_name.toLowerCase().includes(validated.doctor_preference.toLowerCase()) ||
                validated.doctor_preference.toLowerCase().includes(d.full_name.toLowerCase())
            );
            if (match) {
                validated.doctor_id = match.id;
                validated.doctor_name = match.full_name;
            }
            // Not an error if doctor isn't found — we'll auto-assign
        }

        // Normalize and validate date
        if (validated.date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const lower = validated.date.toLowerCase().trim();

            if (lower.includes('mañana') || lower.includes('manana')) {
                const d = new Date(today); d.setDate(d.getDate() + 1);
                validated.date = d.toISOString().split('T')[0];
            } else if (lower.includes('pasado')) {
                const d = new Date(today); d.setDate(d.getDate() + 2);
                validated.date = d.toISOString().split('T')[0];
            } else {
                // Extract YYYY-MM-DD from any string
                const m = validated.date.match(/(\d{4}-\d{2}-\d{2})/);
                if (m) validated.date = m[1];
            }

            const parsed = new Date(validated.date);
            if (isNaN(parsed.getTime()) || parsed < today) {
                issues.push('La fecha debe ser futura y válida');
                validated.date = null;
            }
        }

        // Normalize time: accept H:MM or HH:MM, convert to HH:MM
        if (validated.time) {
            const m = validated.time.match(/^(\d{1,2}):(\d{2})$/);
            if (m) {
                validated.time = `${String(m[1]).padStart(2, '0')}:${m[2]}`;
            } else {
                issues.push('Formato de hora inválido (se esperaba HH:MM en 24h)');
                validated.time = null;
            }
        }

        return { validated, issues };
    }
}

module.exports = new AIService();
