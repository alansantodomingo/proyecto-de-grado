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
- [Instalación y ejecución local](#instalación-y-ejecución-local)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue en producción (AWS Lightsail)](#despliegue-en-producción-aws-lightsail)
  - [Especificaciones de la instancia](#especificaciones-de-la-instancia)
  - [Preparación del servidor](#preparación-del-servidor)
  - [Configuración del repositorio privado](#configuración-del-repositorio-privado)
  - [Configuración del archivo .env en producción](#configuración-del-archivo-env-en-producción)
  - [Primer arranque](#primer-arranque)
  - [Apertura de puertos en el firewall](#apertura-de-puertos-en-el-firewall)
  - [Vinculación de WhatsApp](#vinculación-de-whatsapp)
- [Integración Continua y Despliegue Continuo (CI/CD)](#integración-continua-y-despliegue-continuo-cicd)
  - [Flujo del pipeline](#flujo-del-pipeline)
  - [Configuración de la llave SSH](#configuración-de-la-llave-ssh)
  - [GitHub Secrets requeridos](#github-secrets-requeridos)
  - [Workflow de GitHub Actions](#workflow-de-github-actions)
  - [Cómo realizar un despliegue](#cómo-realizar-un-despliegue)
- [Consideraciones de producción](#consideraciones-de-producción)

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
| CI/CD | GitHub Actions | - |
| Infraestructura | AWS Lightsail | Ubuntu 22.04 LTS |

---

## Estructura del proyecto

```
agendamiento-de-citas/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Pipeline CI/CD — despliega automáticamente en cada push a master
├── docker-compose.yml          # Orquestación de los tres servicios
├── .env                        # Variables de entorno (no versionado)
├── .env.example                # Plantilla de variables de entorno
│
├── client/                     # Aplicación frontend (React + Vite)
│   ├── Dockerfile
│   ├── vite.config.js
│   └── src/
│       ├── api/index.js        # Cliente Axios — URL dinámica según hostname
│       ├── context/
│       │   ├── AuthContext.jsx     # Gestión de sesión JWT
│       │   └── SocketContext.jsx   # Conexión Socket.IO global
│       └── components/
│           ├── whatsapp/           # Pantalla de vinculación QR
│           ├── appointments/       # Gestión de citas
│           ├── doctors/            # Gestión de médicos
│           ├── specialties/        # Gestión de especialidades
│           └── chat/               # Historial de mensajes WhatsApp
│
└── server/                     # Aplicación backend (Node.js)
    ├── Dockerfile
    └── src/
        ├── index.js            # Punto de entrada: Express, Socket.IO, cliente WhatsApp
        ├── db/
        │   ├── index.js        # Pool de conexiones pg
        │   ├── schema.js       # DDL: creación de tablas e índices
        │   └── seed.js         # Usuario administrador inicial
        ├── middlewares/
        │   └── authMiddleware.js   # Verificación de JWT en rutas protegidas
        ├── services/
        │   ├── AIService.js        # Integración con Groq, gestión de contexto, fallback de modelos
        │   └── AvailabilityService.js  # Cálculo de slots disponibles por médico y fecha
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

## Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/alansantodomingo/proyecto-de-grado.git
cd proyecto-de-grado
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con los valores correspondientes
```

### 3. Levantar los servicios

```bash
docker-compose up --build
```

El primer arranque tarda algunos minutos mientras Puppeteer descarga Chromium dentro del contenedor.

### 4. Vincular WhatsApp

Acceder al panel en `http://localhost:5173`, iniciar sesión y escanear el código QR con la app de WhatsApp en `Dispositivos vinculados → Vincular dispositivo`.

### 5. Credenciales por defecto del administrador

```
Email:      admin@admin.com
Contraseña: admin123
```

> Cambiar estas credenciales inmediatamente después del primer acceso en producción.

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
| `VITE_API_URL` | URL del backend para el frontend | `http://<IP>:3001` |
| `CHROME_PATH` | Ruta a Chromium (opcional) | `/usr/bin/chromium` |

> El archivo `.env` nunca debe versionarse. Está incluido en `.gitignore`.

---

## Despliegue en producción (AWS Lightsail)

### Especificaciones de la instancia

| Parámetro | Valor |
|-----------|-------|
| Proveedor | AWS Lightsail |
| Nombre | PG-II |
| Sistema operativo | Ubuntu 22.04 LTS |
| Plan | 4 GB RAM / 2 vCPU / 80 GB SSD |
| IP pública | 54.172.179.80 |
| Región | us-east-1 (Virginia) |

Se requieren mínimo 4 GB de RAM porque Puppeteer/Chromium (usado por whatsapp-web.js) consume entre 500 MB y 1.5 GB por sí solo, sumado a Node.js y PostgreSQL corriendo en paralelo.

---

### Preparación del servidor

Conectarse a la instancia vía SSH o desde el terminal web de Lightsail y ejecutar:

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar Docker
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
newgrp docker

# Instalar Docker Compose standalone
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

---

### Configuración del repositorio privado

El repositorio es privado, por lo que el clone requiere autenticación mediante un Personal Access Token (classic) de GitHub con scope `repo`:

```bash
git clone https://<usuario>:<TOKEN>@github.com/alansantodomingo/proyecto-de-grado.git
cd proyecto-de-grado

# Guardar las credenciales en la URL del remote para los git pull del CI/CD
git remote set-url origin https://<usuario>:<TOKEN>@github.com/alansantodomingo/proyecto-de-grado.git
```

---

### Configuración del archivo .env en producción

Crear el archivo `.env` directamente en el servidor (nunca subir este archivo al repositorio):

```bash
cat > .env << 'EOF'
PORT=3001
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=scheduling_db
DB_URL=postgresql://postgres:postgres@db:5432/scheduling_db
WHATSAPP_SESSION_PATH=./.wwebjs_auth
GROQ_API_KEY=<tu_api_key_de_groq>
GROQ_MODEL=llama-3.3-70b-versatile
VITE_API_URL=http://54.172.179.80:3001
EOF
```

La variable `VITE_API_URL` es crítica en producción: le indica al frontend la dirección pública del backend. Sin ella, el navegador del cliente intentaría conectarse a `localhost:3001` en su propia máquina en lugar del servidor.

---

### Primer arranque

```bash
cd ~/proyecto-de-grado
docker-compose up --build -d
```

El proceso tarda entre 5 y 10 minutos la primera vez. Los contenedores que deben quedar en estado `Healthy` o `Started` son:

```
✔ scheduling-db        Healthy
✔ scheduling-backend   Healthy
✔ scheduling-frontend  Started
```

---

### Apertura de puertos en el firewall

En la consola de Lightsail: `Instancia PG-II → Redes → Firewall → Agregar regla`.

| Puerto | Protocolo | Propósito |
|--------|-----------|-----------|
| 5173 | TCP | Frontend (React/Vite) |
| 3001 | TCP | Backend API y Socket.IO |

---

### Vinculación de WhatsApp

1. Acceder a `http://54.172.179.80:5173`
2. Iniciar sesión con las credenciales del administrador
3. Esperar a que Puppeteer inicialice Chromium y genere el código QR (puede tomar 1-2 minutos)
4. Escanear el QR desde WhatsApp en `Dispositivos vinculados → Vincular dispositivo`
5. Una vez autenticado, el panel principal queda disponible

La sesión de WhatsApp se persiste en el volumen Docker `whatsapp_session`, por lo que sobrevive reinicios de contenedores.

---

## Integración Continua y Despliegue Continuo (CI/CD)

El proyecto usa **GitHub Actions** para automatizar el despliegue cada vez que se hace push a la rama `master`. El pipeline se conecta al servidor vía SSH y ejecuta `git pull` + `docker-compose up --build -d` de forma automática.

### Flujo del pipeline

```
Push a master
      │
      ▼
GitHub Actions Runner (ubuntu-latest)
      │
      ├── 1. Setup SSH key (decodifica la llave desde base64)
      │
      └── 2. Deploy via SSH
               │
               ▼
         Servidor Lightsail
               │
               ├── git pull origin master
               ├── docker-compose down
               ├── docker-compose up --build -d
               └── docker system prune -f
```

---

### Configuración de la llave SSH

Para que GitHub Actions pueda autenticarse en el servidor sin contraseña, se genera un par de llaves ED25519 dedicado:

```bash
# En el servidor Lightsail
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# Autorizar la llave pública en el servidor
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Obtener la llave privada en base64 (formato requerido por el secret de GitHub)
cat ~/.ssh/github_actions | base64 -w 0
```

El output del último comando (una línea en base64) es el valor que se almacena en el secret `LIGHTSAIL_SSH_KEY`.

> Se usa base64 porque GitHub Secrets a veces elimina los saltos de línea al almacenar claves PEM, lo que corrompe el formato. El workflow decodifica la llave antes de usarla.

---

### GitHub Secrets requeridos

Los secrets se configuran en: `Repositorio → Settings → Secrets and variables → Actions → New repository secret`

| Secret | Valor | Descripción |
|--------|-------|-------------|
| `LIGHTSAIL_HOST` | `54.172.179.80` | IP pública de la instancia |
| `LIGHTSAIL_USER` | `ubuntu` | Usuario SSH de la instancia |
| `LIGHTSAIL_SSH_KEY` | `LS0tLS1CRUdJT...` | Llave privada ED25519 en base64 |

> El token de GitHub usado para el push del workflow requiere los scopes `repo` y `workflow`.

---

### Workflow de GitHub Actions

Archivo: `.github/workflows/deploy.yml`

```yaml
name: Deploy to AWS Lightsail

on:
  push:
    branches: [master]

jobs:
  deploy:
    name: SSH & Docker Compose Up
    runs-on: ubuntu-latest

    steps:
      - name: Setup SSH key
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.LIGHTSAIL_SSH_KEY }}" | base64 -d > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H ${{ secrets.LIGHTSAIL_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy
        run: |
          ssh ${{ secrets.LIGHTSAIL_USER }}@${{ secrets.LIGHTSAIL_HOST }} '
            cd ~/proyecto-de-grado &&
            git pull origin master &&
            docker-compose down &&
            docker-compose up --build -d &&
            docker system prune -f --volumes=false &&
            echo "Deploy completado: $(date)"
          '
```

**Por qué SSH nativo y no `appleboy/ssh-action`:** la acción de appleboy corre en su propio contenedor Docker dentro del runner, lo que crea un entorno de archivos aislado que no tiene acceso al archivo de llave creado en pasos anteriores. El SSH nativo del runner sí tiene acceso directo al sistema de archivos.

---

### Cómo realizar un despliegue

Cualquier push a la rama `master` dispara el pipeline automáticamente:

```bash
git add .
git commit -m "descripción del cambio"
git push origin master
```

El estado del despliegue se puede monitorear en:
`github.com/alansantodomingo/proyecto-de-grado → Actions`

Un despliegue típico tarda entre 2 y 5 minutos dependiendo de si hay cambios que requieran reconstruir las imágenes Docker.

---

## Consideraciones de producción

- **Sesión de WhatsApp:** se persiste en el volumen Docker `whatsapp_session`. Nunca eliminar este volumen a menos que se quiera desvincular el número. Al hacer `docker-compose down` sin `-v` la sesión se conserva.
- **No-shows:** el job de detección de no-shows se ejecuta cada 5 minutos mediante `setInterval` dentro del proceso principal. En un entorno multi-instancia, esto causaría ejecuciones duplicadas — migrar a un job externo si se escala horizontalmente.
- **SSL:** actualmente el sistema corre sobre HTTP. Para producción real se recomienda configurar Nginx como reverse proxy con certificado SSL de Let's Encrypt, apuntando los puertos 80/443 a los servicios internos.
- **Credenciales por defecto:** cambiar el usuario `admin@admin.com` / `admin123` inmediatamente tras el primer despliegue.
- **Groq API Key:** rotar la key si el repositorio se hace público en algún momento.
