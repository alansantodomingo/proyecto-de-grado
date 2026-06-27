# Sistema de Agendamiento de Citas Médicas vía WhatsApp

Sistema web para la gestión de citas médicas que integra un chatbot conversacional en WhatsApp impulsado por inteligencia artificial. Permite a los pacientes agendar, consultar y cancelar citas a través de mensajes de texto, mientras que el personal administrativo gestiona médicos, especialidades y disponibilidad desde un panel web.

---

## Tabla de Contenidos

- [Arquitectura general](#arquitectura-general)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Flujo del chatbot](#flujo-del-chatbot)
- [API REST](#api-rest)
- [Requisitos previos](#requisitos-previos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue en producción](#despliegue-en-producción)

---

## Arquitectura general

El sistema se compone de tres capas contenidas en Docker:

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Compose                       │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │   Frontend   │   │   Backend    │   │  PostgreSQL │ │
│  │  React/Vite  │──▶│  Node/Express│──▶│    15       │ │
│  │  :5173       │   │  :3001       │   │   :5432     │ │
│  └──────────────┘   └──────┬───────┘   └─────────────┘ │
│                             │                            │
└─────────────────────────────┼────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         WhatsApp API      Groq API      Socket.IO
       (whatsapp-web.js)  (LLM/NLP)   (tiempo real)
```

El backend actúa como nodo central: expone la API REST al panel de administración, mantiene la conexión con WhatsApp mediante Puppeteer, y llama a la API de Groq para procesar el lenguaje natural de los pacientes. La comunicación en tiempo real entre el backend y el frontend (estado del bot, código QR) se gestiona a través de Socket.IO.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React | 18 |
| Frontend | Vite | 5 |
| Frontend | TailwindCSS | 3.3 |
| Frontend | Socket.IO Client | 4.7 |
| Backend | Node.js | 18+ |
| Backend | Express | 4 |
| Backend | Socket.IO | 4.7 |
| Backend | whatsapp-web.js | latest |
| Backend | Puppeteer (Chromium) | via whatsapp-web.js |
| IA | Groq API (Llama 3.3-70b) | - |
| Base de datos | PostgreSQL | 15 |
| Autenticación | JSON Web Tokens (JWT) | - |
| Contenedores | Docker + Docker Compose | - |

---

## Estructura del proyecto

```
agendamiento-de-citas/
├── docker-compose.yml          # Orquestación de los tres servicios
├── .env                        # Variables de entorno (no versionado)
│
├── client/                     # Aplicación frontend (React + Vite)
│   ├── Dockerfile
│   ├── vite.config.js
│   └── src/
│       └── index.css           # Estilos globales con Tailwind
│
└── server/                     # Aplicación backend (Node.js)
    ├── Dockerfile
    └── src/
        ├── index.js            # Punto de entrada: Express, Socket.IO, cliente WhatsApp
        │
        ├── db/
        │   ├── index.js        # Pool de conexiones pg
        │   ├── schema.js       # DDL: creación de tablas e índices
        │   └── seed.js         # Usuario administrador inicial
        │
        ├── middlewares/
        │   └── authMiddleware.js   # Verificación de JWT en rutas protegidas
        │
        ├── services/
        │   ├── AIService.js        # Integración con Groq, gestión de contexto, fallback de modelos
        │   └── AvailabilityService.js  # Cálculo de slots disponibles por médico y fecha
        │
        └── modules/
            ├── auth/               # Login, emisión y verificación de tokens
            ├── appointments/       # CRUD de citas, confirmaciones, lógica de no-show
            ├── chat/               # Acceso al historial de mensajes WhatsApp desde el panel
            ├── doctors/            # Gestión de médicos, horarios y bloqueos de agenda
            ├── patients/           # Gestión de pacientes registrados
            ├── specialties/        # Gestión de especialidades médicas
            └── whatsapp/           # Controlador del bot: manejo de mensajes y acciones de la IA
```

---

## Modelo de datos

El esquema se auto-crea al iniciar el backend. Las tablas principales son:

```
users               → Cuentas de administrador/operador (autenticación JWT)
specialties         → Especialidades médicas activas
doctors             → Médicos con su especialidad asociada
doctor_schedules    → Horarios semanales por médico (lunes=1 a domingo=0)
doctor_blocks       → Bloqueos de agenda puntuales (vacaciones, ausencias)
patients            → Pacientes registrados (identificados por número WhatsApp)
appointments        → Citas con estado: BOOKED | CONFIRMED | CANCELLED | NO_SHOW
conversation_sessions → Estado de la conversación del bot por número de teléfono
messages            → Historial de mensajes WhatsApp (entrantes y salientes)
```

Todos los IDs primarios son `UUID v4` generados por PostgreSQL.

---

## Flujo del chatbot

El bot implementa una máquina de estados finita (FSM) almacenada en `conversation_sessions`:

```
         Mensaje entrante
               │
               ▼
      ┌─────────────────┐
      │  ¿Bot activo?   │──No──▶ Ignora mensaje
      └────────┬────────┘
               │ Sí
               ▼
      ┌─────────────────────────┐
      │  ¿Estado especial?      │
      │  CONFIRMING_CANCELLATION│──▶ Manejo sin IA (SI/NO)
      │  SELECTING_APPOINTMENT  │──▶ Manejo sin IA (número)
      └────────┬────────────────┘
               │ Estado ACTIVE
               ▼
      ┌─────────────────────────┐
      │  Groq LLM (Llama 3.3)   │
      │  + contexto del sistema  │
      │  (especialidades, médicos│
      │   bloques, fecha actual) │
      └────────┬────────────────┘
               │
        acción extraída
               │
    ┌──────────┼──────────┬───────────────┐
    ▼          ▼          ▼               ▼
continue  book_appt  list_cancels   request_advisor
(responde) (verifica  (muestra citas  (desactiva bot,
            slots y    activas del    notifica a asesor)
            confirma)  paciente)
```

El `AIService` mantiene una ventana de conversación de hasta 20 mensajes por número telefónico y aplica fallback automático entre modelos de Groq (`llama-3.3-70b-versatile` → `llama-3.1-8b-instant` → `gemma2-9b-it` → `mixtral-8x7b-32768`) ante errores de disponibilidad.

---

## API REST

Todas las rutas protegidas requieren el header `Authorization: Bearer <token>`.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Obtener JWT |
| GET | `/api/auth/me` | Sí | Datos del usuario autenticado |
| GET/POST | `/api/specialties` | Sí | Listar / crear especialidades |
| GET/POST | `/api/doctors` | Sí | Listar / crear médicos |
| GET/POST/PUT | `/api/appointments` | Mixto | Gestión de citas |
| GET | `/api/patients` | Sí | Listar pacientes |
| GET | `/api/chats` | Sí | Historial de mensajes WhatsApp |
| GET | `/status` | No | Health check del servidor |

---

## Requisitos previos

- Docker Engine 24+
- Docker Compose v2+
- Cuenta en [Groq](https://console.groq.com) con API Key activa
- Número de WhatsApp disponible para vincular al bot

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd agendamiento-de-citas
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con los valores correspondientes
```

### 3. Levantar los servicios

```bash
docker compose up --build
```

El primer arranque tarda algunos minutos mientras Puppeteer descarga Chromium dentro del contenedor.

### 4. Vincular WhatsApp

Una vez que el backend esté en ejecución, acceder al panel en `http://localhost:5173` y escanear el código QR con la app de WhatsApp (`Dispositivos vinculados → Vincular dispositivo`).

### 5. Acceso al panel de administración

Las credenciales del administrador inicial se generan automáticamente desde `server/src/db/seed.js`. Revisar ese archivo para obtener el email y contraseña por defecto.

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor backend | `3001` |
| `DB_USER` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | `postgres` |
| `DB_NAME` | Nombre de la base de datos | `scheduling_db` |
| `DB_URL` | Cadena de conexión completa | `postgresql://postgres:postgres@db:5432/scheduling_db` |
| `GROQ_API_KEY` | API Key de Groq Cloud | `gsk_...` |
| `GROQ_MODEL` | Modelo LLM principal | `llama-3.3-70b-versatile` |
| `WHATSAPP_SESSION_PATH` | Ruta de persistencia de sesión | `./.wwebjs_auth` |
| `CHROME_PATH` | Ruta a Chromium (opcional) | `/usr/bin/chromium` |

> En producción, nunca incluir el archivo `.env` en el repositorio. Usar variables de entorno del sistema o un gestor de secretos.

---

## Despliegue en producción

### Recomendaciones para AWS Lightsail

1. Crear una instancia Ubuntu 22.04 LTS con mínimo **4 GB de RAM** (Puppeteer/Chromium requiere recursos adicionales).
2. Instalar Docker y Docker Compose en la instancia.
3. Subir el proyecto (sin `node_modules`, sin `.wwebjs_auth`, sin `.env`).
4. Crear el archivo `.env` directamente en el servidor con credenciales de producción.
5. Configurar un reverse proxy (Nginx) para exponer el backend en el puerto 443 con certificado SSL.
6. Abrir los puertos 80 y 443 en el firewall de Lightsail.
7. Ejecutar `docker compose up -d --build` para iniciar en segundo plano.

### Consideraciones adicionales

- La sesión de WhatsApp se persiste en un volumen Docker (`whatsapp_session`). Al destruir y recrear los contenedores, la sesión se mantiene siempre que el volumen no sea eliminado.
- El job de no-shows se ejecuta cada 5 minutos mediante `setInterval` dentro del proceso principal. En un entorno de alta disponibilidad, considerar migrar esta lógica a un job externo (cron, BullMQ) para evitar duplicación en escenarios multi-instancia.
- La clave `GROQ_API_KEY` expuesta en el repositorio en el `.env` de ejemplo debe rotarse inmediatamente antes de hacer el repositorio público.
