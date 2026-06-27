# Documentación Técnica: Sistema de Agendamiento de Citas Hospitalarias (WhatsApp Bot)

## Introducción
El presente documento detalla la arquitectura, el diseño y el flujo operativo del Sistema de Agendamiento de Citas Médicas. Este sistema ha sido diseñado para optimizar la gestión de consultas hospitalarias mediante la automatización de procesos a través de un Bot de WhatsApp y un Panel Administrativo integral.

El objetivo principal es reducir la carga operativa del personal humano y ofrecer a los pacientes un canal de comunicación inmediato, disponible 24/7, eliminando tiempos de espera telefónicos y simplificando el proceso de reserva.

---

## 1. Arquitectura General del Sistema
La arquitectura se basa en un modelo de microservicios ligero, donde el backend actúa como el núcleo orquestador.

```mermaid
graph TD
    A[Paciente - WhatsApp] <-->|Mensajes| B[Módulo WhatsApp - whatsapp-web.js]
    B <--> C[Servidor Backend - Node.js Express]
    D[Panel Administrativo - Vite/React] <-->|REST API / Socket.io| C
    C <--> E[(Base de Datos - PostgreSQL)]
    C --- F[Servicio de Notificaciones / Jobs]
```

### Descripción de Componentes:
*   **Interfaz de Usuario (WhatsApp):** Canal principal de entrada. Se utiliza la librería `whatsapp-web.js` para emular un cliente de WhatsApp Web, permitiendo la interacción sin costos de API oficiales de Meta inicialmente.
*   **Backend (Node.js/Express):** Gestiona la lógica de negocio, autenticación JWT, y el motor de estados de las conversaciones.
*   **Persistencia (PostgreSQL):** Base de datos relacional que garantiza la integridad de la información de citas, doctores y pacientes.
*   **Panel Administrativo:** Una Single Page Application (SPA) que permite a los operadores monitorear chats en tiempo real y gestionar catálogos.

---

## 2. Diagrama de Casos de Uso
El sistema define tres perfiles de usuario claramente diferenciados para garantizar la seguridad y eficiencia.

```mermaid
graph TD
    subgraph Actores
    P[Paciente]
    O[Operador]
    A[Admin]
    end

    subgraph "Sistema de Agendamiento"
    UC1(Consultar Disponibilidad)
    UC2(Agendar Cita)
    UC3(Cancelar Cita)
    UC4(Consultar Mis Citas)
    UC5(Solicitar Asesor Humano)
    UC6(Gestionar Médicos/Especialidades)
    UC7(Configurar Horarios)
    UC8(Atender Chat Manualmente)
    UC9(Reportes de Citas)
    end

    P --> UC1
    P --> UC2
    P --> UC3
    P --> UC4
    P --> UC5

    O --> UC5
    O --> UC8
    O --> UC4

    A --> UC6
    A --> UC7
    A --> UC9
    A --> UC8
```

### Justificación de Roles:
*   **Paciente:** Centrado en el autoservicio. Puede gestionar su ciclo de cita sin intervención humana.
*   **Operador:** Enfocado en la atención al cliente. Interviene cuando el bot no puede resolver una duda o cuando se solicita asistencia humana.
*   **Administrador:** Control total sobre la infraestructura de datos (médicos, especialidades y horarios globales).

---

## 3. Diagrama de Secuencia: Flujo de Agendamiento
Este diagrama ilustra la coreografía de mensajes y la sincronización con el panel administrativo.

```mermaid
sequenceDiagram
    participant P as Paciente (WhatsApp)
    participant B as WhatsApp Bot (Node.js)
    participant DB as PostgreSQL
    participant A as Admin Panel (Socket.io)

    P->>B: Envía "Hola"
    B->>DB: Busca sesión activa (phone)
    DB-->>B: Sesión inicial (IDLE)
    B->>P: Responde: "Bienvenido, elija una especialidad"
    
    P->>B: Selecciona "Odontología"
    B->>DB: Consulta médicos de "Odontología"
    DB-->>B: Lista de Médicos
    B->>P: "Estos son los médicos disponibles..."
    
    P->>B: Selecciona "Dr. Pérez"
    B->>DB: Consulta horarios disponibles
    DB-->>B: Horarios (Slots)
    B->>P: "Elija una fecha y hora..."
    
    P->>B: Selecciona "25/10/2023 10:00 AM"
    B->>DB: Inserta registro en 'appointments'
    DB-->>B: Confirmación (ID Cita)
    B->>P: "Cita agendada con éxito. Su código es: XYZ123"
    B->>A: Emite evento 'new_appointment' via Socket.io
```

### Análisis del Proceso:
El sistema utiliza una **Máquina de Estados Finita (FSM)**. Cada mensaje del usuario transiciona la sesión a un nuevo estado (ej: `AWAITING_SPECIALTY` -> `AWAITING_DOCTOR`), asegurando que el flujo sea lógico y que los datos se capturen de forma estructurada.

---

## 4. Diagrama de Clases (Modelo de Datos)
La estructura de datos está optimizada para consultas rápidas de disponibilidad.

```mermaid
classDiagram
    class User {
        +UUID id
        +String full_name
        +String email
        +String role
    }
    class Patient {
        +UUID id
        +String full_name
        +String phone
    }
    class Specialty {
        +UUID id
        +String name
        +Integer duration_minutes
    }
    class Doctor {
        +UUID id
        +String full_name
        +UUID specialty_id
    }
    class Appointment {
        +UUID id
        +UUID patient_id
        +UUID doctor_id
        +DateTime start_datetime
        +String status
    }
    class DoctorSchedule {
        +UUID id
        +Integer weekday
        +Time start_time
        +Time end_time
    }

    Patient "1" -- "*" Appointment
    Doctor "1" -- "*" Appointment
    Specialty "1" -- "*" Doctor
    Doctor "1" -- "*" DoctorSchedule
    User "1" -- "*" Appointment : "Managed by"
```

### Características del Modelo:
*   **Normalización:** Los datos están altamente normalizados para evitar redundancias.
*   **Relaciones Clave:** La vinculación entre `DoctorSchedule` y `Appointment` permite calcular espacios disponibles en tiempo real restando las citas existentes de los bloques de horario del médico.

---

## 5. Diagrama de Despliegue
Implementación basada en contenedores para facilitar la portabilidad y escalabilidad.

```mermaid
graph TB
    subgraph "Servidor Cloud (Docker Engine)"
        subgraph "Contenedor Backend"
            B[Express API + WhatsApp Client]
        end
        subgraph "Contenedor Frontend"
            F[React App + Nginx]
        end
        subgraph "Contenedor Database"
            DB[(PostgreSQL)]
        end
    end
    
    subgraph "Externo"
        C[Navegador del Admin]
        W[WhatsApp Cloud/Mobile]
    end

    C -- HTTPS --> F
    F -- REST/WS --> B
    B -- TCP/5432 --> DB
    B -- WSS --> W
```

### Ventajas del Despliegue:
*   **Aislamiento:** Cada componente corre en su propio entorno seguro.
*   **Recuperación:** Mediante políticas de Docker, el servidor se reinicia automáticamente en caso de fallo crítico en el cliente de WhatsApp.

---

## 6. Diagrama de Flujo de Datos (DFD)
Muestra la transformación de un mensaje de texto plano en una transacción de base de datos.

```mermaid
flowchart LR
    In([Mensaje WhatsApp]) --> P1[Identificar Remitente]
    P1 --> D1[(Sesiones)]
    P1 --> P2{¿Bot Activo?}
    P2 -- No --> P3[Notificar Operador]
    P2 -- Si --> P4[Procesar Lógica de Menús]
    P4 --> P5[Consultar Catálogos]
    P5 <--> D2[(Especialidades/Médicos)]
    P4 --> P6[Registrar Cita]
    P6 --> D3[(Appointments)]
    Out([Confirmación])
    P6 --> Out
```

---

## Seguridad y Escalabilidad
*   **Seguridad:** Las rutas administrativas están protegidas mediante `JWT` (JSON Web Tokens). Toda la comunicación entre el frontend y backend se realiza sobre protocolos encriptados.
*   **Escalabilidad:** El backend está preparado para integrarse con la API oficial de WhatsApp Business (Cloud API) en el futuro, permitiendo manejar miles de conversaciones simultáneas sin degradación de rendimiento.

---
**Elaborado por:** Departamento de Desarrollo - Ideon Company
**Fecha:** Abril 2026
