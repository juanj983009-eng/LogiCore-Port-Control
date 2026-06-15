# LogiCore Port Control

[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.x-6DB33F?style=flat-square&logo=spring&logoColor=white)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQL Server](https://img.shields.io/badge/SQL_Server-2022-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/en-us/sql-server)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-475569?style=flat-square)](LICENSE)

---

## Executive Summary

LogiCore Port Control is a distributed port logistics management platform built as a microservices ecosystem. The system manages the full operational lifecycle of maritime freight: container ingress and yard placement, truck dispatch queuing, and immutable audit trail generation across all write operations.

The architecture is designed around three core academic constraints applied in a production-grade context:

1. **Manual data structure implementations** — no `java.util` collection classes are used as primary in-memory stores. Each service owns a handcrafted linked structure (`ListaDobleManual`, `ColaManual`, `PilaManual`) that is synchronized against a relational database through a `ReentrantReadWriteLock` bridge layer.
2. **Heterogeneous persistence** — the yard and audit services use PostgreSQL 16; the dispatch service uses Microsoft SQL Server 2022. Both engines run as Docker-managed containers on an isolated bridge network (`logicore-net`).
3. **Asynchronous audit propagation** — every write operation in the yard and dispatch services fires a non-blocking HTTP call to the audit service using Java 21 Virtual Threads, ensuring the audit trail is never on the critical path of the user-facing request.

The frontend is a vanilla-JS Single Page Application (SPA) served from a Live Server instance, consuming the three REST APIs directly from the browser.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BROWSER — SPA (Port 5501)                        │
│  logicore-dashboard/index.html                                      │
│  Three.js Particle Nexus · Dot Matrix CSS · Vanilla JS Controllers  │
└──────────┬──────────────────────┬──────────────────────────────────┘
           │ HTTP/REST            │ HTTP/REST
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────┐
│  Inbound Yard    │   │  Dispatch Queue      │
│  Service         │   │  Service             │
│  :8081           │   │  :8082               │
│                  │   │                      │
│  ListaDoble      │   │  ColaManual          │
│  Manual<Cont.>   │   │  <Camion>            │
│  + RWLock        │   │  + RWLock            │
│                  │   │                      │
│  PostgreSQL      │   │  SQL Server 2022     │
│  yard-db :5432   │   │  dispatch-db :1433   │
└────────┬─────────┘   └──────────┬───────────┘
         │ Virtual Thread (async) │ Virtual Thread (async)
         │ POST /api/v1/audit/logs│ POST /api/v1/audit/logs
         └────────────┬───────────┘
                      ▼
         ┌─────────────────────────┐
         │  Audit History Service  │
         │  :8083                  │
         │                         │
         │  PilaManual<AuditLog>   │
         │  LIFO · UNDO support    │
         │                         │
         │  PostgreSQL             │
         │  yard-db :5432          │
         │  (shared schema)        │
         └─────────────────────────┘

Network: logicore-net (Docker bridge, isolated)
Volumes: yard_postgres_data · dispatch_sqlserver_data
```

### Service Port Reference

| Service | Container Name | Host Port | Internal Port | Database |
|---|---|---|---|---|
| `inbound-yard-service` | `inbound-yard-service` | `8081` | `8081` | PostgreSQL `yard-db:5432` |
| `dispatch-queue-service` | `dispatch-queue-service` | `8082` | `8082` | SQL Server `dispatch-db:1433` |
| `audit-history-service` | `audit-history-service` | `8083` | `8083` | PostgreSQL `yard-db:5432` |
| `yard-db` | `yard-postgres-db` | `5432` | `5432` | PostgreSQL 16-alpine |
| `dispatch-db` | `dispatch-sqlserver-db` | `1433` | `1433` | SQL Server 2022 Developer |

---

## Manual Data Structures

All three manual structures are implemented from scratch without delegating to `java.util` collection classes. Each is typed with Java generics, operates on private pointer-linked nodes, and is guarded in production by a `ReentrantReadWriteLock` in its corresponding service implementation.

### 1. `ListaDobleManual<T>` — Bidirectional Doubly Linked List

**Package:** `com.logicore.yard.structure`
**Entity bound:** `Contenedor`
**Operational policy:** Append-to-tail only (insertion at `cola`); full bidirectional traversal.

```
Structure layout:
  cabeza ──► [prev|dato|next] ◄──► [prev|dato|next] ◄──► [prev|dato|next] ◄── cola
              NodoDoble<T>            NodoDoble<T>            NodoDoble<T>

Internal state: cabeza (head pointer), cola (tail pointer), tamaño (count)
```

| Operation | Method | Complexity |
|---|---|---|
| Insert at tail | `insertarAlFinal(T)` | O(1) |
| Traverse forward (IDA) | `getCabeza()` + pointer walk | O(n) |
| Traverse reverse (VUELTA) | `getCola()` + `.getAnterior()` walk | O(n) |
| Empty check | `estaVacia()` | O(1) |

**Concurrency:** The `YardServiceImpl` wraps all writes in `lock.writeLock().lock()` and all reads in `lock.readLock().lock()`. The JPA `save()` call is executed inside the write lock block, ensuring the database and in-memory list are mutated atomically within the same critical section. Initial load from PostgreSQL uses a Java 21 Virtual Thread to avoid blocking the application startup thread.

---

### 2. `ColaManual<T>` — Singly Linked FIFO Queue

**Package:** `com.logicore.dispatch.structure`
**Entity bound:** `Camion`
**Operational policy:** Enqueue at `finalCola`; dequeue from `frente`. Strict FIFO ordering.

```
Structure layout:
  frente ──► [dato|next] ──► [dato|next] ──► [dato|next] ──► null
              NodoSimple<T>   NodoSimple<T>   NodoSimple<T>
                                                   ▲
                                               finalCola

Internal state: frente (head pointer), finalCola (tail pointer), tamaño (count)
```

| Operation | Method | Complexity |
|---|---|---|
| Enqueue (insert) | `enqueue(T)` | O(1) |
| Dequeue (remove front) | `dequeue()` | O(1) |
| Peek front | `getFrente()` | O(1) |
| Empty check | `estaVacia()` | O(1) |

**Concurrency:** The `DispatchServiceImpl` applies the same `ReentrantReadWriteLock` pattern. The dequeue operation (`atenderCamion`) removes from both the SQL Server database and the in-memory queue inside the write lock, preventing phantom reads under concurrent dispatch requests.

---

### 3. `PilaManual<T>` — Singly Linked LIFO Stack

**Package:** `com.logicore.audit.structure`
**Entity bound:** `AuditLog`
**Operational policy:** Push to `tope`; pop from `tope`. LIFO ordering enables natural UNDO semantics (most recent operation is always accessible in O(1)).

```
Structure layout:
  tope ──► [dato|next] ──► [dato|next] ──► [dato|next] ──► null
            NodoPila<T>     NodoPila<T>     NodoPila<T>
            (most recent)                   (oldest)

Internal state: tope (top pointer), tamaño (count)
```

| Operation | Method | Complexity |
|---|---|---|
| Push (record event) | `push(T)` | O(1) |
| Pop (undo last event) | `pop()` | O(1) |
| Safe read-all | `toElementList()` | O(n) |
| Full reset | `clear()` | O(1) |

**Concurrency:** Initial hydration from PostgreSQL (ordered by `fechaCreacion ASC`) runs inside a Java 21 Virtual Thread. The `toElementList()` method produces a detached `ArrayList` snapshot, allowing the REST layer to serialize the response without holding the read lock across network I/O.

---

## Enterprise Optimizations Applied

### Transactional Integrity — DB and RAM Consistency

**Problem:** The original implementation called `contenedorJpaRepository.save()` after releasing the write lock, creating a window where the in-memory list reflected a record that had not yet been committed to the database. A crash or rollback would leave the structures in an inconsistent state.

**Resolution:** The JPA `save()` call was moved inside the `writeLock().lock()` block and the method was annotated with `@Transactional`. If the database operation throws, the Spring transaction is rolled back and the manual structure is never mutated.

```java
@Transactional
public ContenedorResponseDTO registrarContenedor(ContenedorRequestDTO dto) {
    lock.writeLock().lock();
    try {
        Contenedor contenedor = mapper.toEntity(dto);
        contenedorJpaRepository.save(contenedor);   // DB write inside lock
        listaDobleManual.insertarAlFinal(contenedor); // RAM write inside lock
        reportarAuditoria("INGRESO", contenedor);
        return mapper.toDTO(contenedor);
    } finally {
        lock.writeLock().unlock();
    }
}
```

---

### Secure JSON Serialization — Jackson `ObjectNode`

**Problem:** Audit payloads were constructed via string concatenation (`"\"key\":\"" + value + "\""`) which fails silently when field values contain quotation marks, backslashes, or Unicode escape sequences, producing malformed JSON that the audit service rejects.

**Resolution:** All audit payload construction in `YardServiceImpl` and `DispatchServiceImpl` was migrated to Jackson's `ObjectMapper` / `ObjectNode` API, which handles all escaping internally.

```java
private final ObjectMapper objectMapper;

private void reportarAuditoria(String accion, Contenedor contenedor) {
    Thread.ofVirtual().start(() -> {
        try {
            ObjectNode payloadNode = objectMapper.createObjectNode();
            payloadNode.put("codigoId", contenedor.getCodigoID());
            payloadNode.put("destino", contenedor.getDestino());

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.put("tipoAccion", accion);
            requestBody.put("microservicio", "INBOUND-YARD-SERVICE");
            requestBody.put("payload", objectMapper.writeValueAsString(payloadNode));

            restTemplate.postForEntity(auditServiceUrl, requestBody, String.class);
        } catch (Exception ignored) {}
    });
}
```

---

### Non-Blocking Asynchronism — Java 21 Virtual Threads

All cross-service audit calls and initial data hydration tasks run on Java 21 Virtual Threads (`Thread.ofVirtual().start()`). Virtual Threads are cheap to create (no OS thread pool overhead), do not block the carrier thread during I/O, and require no `ExecutorService` configuration.

```java
// Audit notification — fire-and-forget, never on the request critical path
Thread.ofVirtual().start(() -> reportarAuditoria(accion, entidad));

// Initial RAM hydration from DB — non-blocking at startup
Thread.ofVirtual().start(() -> {
    lock.writeLock().lock();
    try {
        repository.findAll().forEach(structure::insertarAlFinal);
    } finally {
        lock.writeLock().unlock();
    }
});
```

---

### Frontend — Industrial Aesthetic Layer

The SPA frontend (`logicore-dashboard/`) implements a layered visual system on top of vanilla HTML/CSS/JS:

- **Dot Matrix background:** `radial-gradient(#94A3B8 1px, transparent 1px)` at `24px 24px` creates a high-density industrial grid pattern without any image assets.
- **Three.js Particle Nexus Network:** `Background3D.js` renders 80 nodes drifting in a virtual `600³` cube with bounce physics. An O(N²) proximity pass draws connecting edges between nodes closer than 90 units. Camera position reacts to `mousemove` with a `0.05` damping factor for smooth parallax.
- **Compound shadow system:** All primary cards use a two-layer box-shadow to simulate physical depth: `0 1px 3px rgba(0,0,0,0.03), 0 4px 12px -2px rgba(0,0,0,0.05)`.
- **Frosted-glass tooltips:** Heatmap slot tooltips and Chart.js tooltips use `backdrop-filter: blur(8px)` with `rgba(255,255,255,0.9)` backgrounds.

---

## Deployment Guide

### Prerequisites

- Docker Desktop 24+ with Compose V2
- Maven 3.9+ (for manual builds) or Docker BuildKit (automatic via Compose)
- A `.env` file at the project root (see `.env` template below)

### Environment Configuration

```dotenv
# .env — required at project root
DB_POSTGRES_USER=logicore_admin
DB_POSTGRES_PASSWORD=<your_secure_password>
DB_POSTGRES_DB=logicore_yard_db
DB_SQLSERVER_SA_PASSWORD=<your_sa_password_min_8_chars_with_uppercase_and_symbol>
DB_SQLSERVER_DB=logicore_dispatch_db
```

### Automated One-Click Deployment (Windows)

```bat
arrancar-sistema.bat
```

This script executes `docker compose up -d --build`, waits 45 seconds for the database health checks to pass, then opens the dashboard at `http://127.0.0.1:5501/logicore-dashboard/index.html`.

### Manual Docker Compose Deployment

```bash
# Step 1 — Build all service images and start the stack in detached mode
docker compose up -d --build

# Step 2 — Monitor startup health (wait for all containers to reach 'healthy')
docker compose ps

# Step 3 — Tail aggregate logs across all services
docker compose logs -f --tail=50

# Step 4 — Open the frontend (requires Live Server or equivalent on port 5501)
# In VS Code: right-click logicore-dashboard/index.html → Open with Live Server
```

### Startup Dependency Order

```
yard-db (healthy)
    ├── audit-service  (depends_on yard-db healthy)
    └── yard-service   (depends_on yard-db healthy)

dispatch-db (healthy)
    └── sqlserver-init (depends_on dispatch-db healthy)
            └── dispatch-service (depends_on sqlserver-init completed)
```

### Teardown

```bash
# Stop containers and remove volumes (full reset)
docker compose down -v

# Stop containers only (preserve data volumes)
docker compose down
```

---

## REST Endpoint Matrix

All endpoints return `application/json`. No authentication layer is implemented in the current version.

### Inbound Yard Service — `http://localhost:8081`

| Method | Path | Description | Request Body |
|---|---|---|---|
| `POST` | `/api/v1/yard/containers` | Register a container and insert into yard | `ContenedorRequestDTO` |
| `GET` | `/api/v1/yard/containers` | Traverse list IDA (head → tail) | — |
| `GET` | `/api/v1/yard/containers/view` | Traverse list IDA (alias) | — |
| `GET` | `/api/v1/yard/containers/reverse` | Traverse list VUELTA (tail → head) | — |

**Sample `ContenedorRequestDTO`:**
```json
{
  "codigoID": "CONT-042",
  "destino": "PUERTO_CALLAO",
  "peso": 28.5,
  "prioridad": 1,
  "tipoCarga": "DRY"
}
```

---

### Dispatch Queue Service — `http://localhost:8082`

| Method | Path | Description | Request Body |
|---|---|---|---|
| `POST` | `/api/v1/dispatch/trucks` | Enqueue a truck into the FIFO dispatch queue | `CamionRequestDTO` |
| `DELETE` | `/api/v1/dispatch/trucks/next` | Dequeue the front truck (FIFO pop + DB delete) | — |
| `GET` | `/api/v1/dispatch/trucks/view` | View full queue state (front → tail) | — |

**Sample `CamionRequestDTO`:**
```json
{
  "placa": "A1F-942",
  "conductor": "Roberto Gomez",
  "empresa": "TransPort SAC",
  "contenedorAsignado": "CONT-042"
}
```

---

### Audit History Service — `http://localhost:8083`

| Method | Path | Description | Request Body |
|---|---|---|---|
| `POST` | `/api/v1/audit/logs` | Push a new audit event onto the stack | `AuditLogRequestDTO` |
| `POST` | `/api/v1/audit/logs/undo` | Pop and reverse the last audit event (LIFO undo) | — |
| `GET` | `/api/v1/audit/logs` | Read full audit stack as ordered list | — |

**Sample `AuditLogRequestDTO`** (generated internally by yard and dispatch services):
```json
{
  "tipoAccion": "INGRESO",
  "microservicio": "INBOUND-YARD-SERVICE",
  "payload": "{\"codigoId\":\"CONT-042\",\"destino\":\"PUERTO_CALLAO\"}"
}
```

---

## Project Structure

```
LogiCore Port Control/
├── .env                              # Environment secrets (not committed)
├── docker-compose.yml                # Full stack orchestration
├── arrancar-sistema.bat              # One-click Windows deployment script
├── db-init/
│   └── postgres/init.sql             # PostgreSQL schema initialization
│
├── inbound-yard-service/
│   └── inbound-yard-service/
│       └── src/main/java/com/logicore/yard/
│           ├── domain/               # Contenedor entity + DTOs + interfaces
│           ├── infrastructure/
│           │   ├── persistence/      # YardServiceImpl (RWLock + JPA bridge)
│           │   └── rest/             # YardController
│           └── structure/
│               ├── ListaDobleManual.java
│               └── NodoDoble.java
│
├── dispatch-queue-service/
│   └── dispatch-queue-service/
│       └── src/main/java/com/logicore/dispatch/
│           ├── domain/               # Camion entity + DTOs + interfaces
│           ├── infrastructure/
│           │   ├── persistence/      # DispatchServiceImpl (RWLock + JPA bridge)
│           │   └── rest/             # DispatchController
│           └── structure/
│               ├── ColaManual.java
│               └── NodoSimple.java
│
├── audit-history-service/
│   └── audit-history-service/
│       └── src/main/java/com/logicore/audit/
│           ├── domain/               # AuditLog entity + DTOs + interfaces
│           ├── infrastructure/
│           │   ├── persistence/      # AuditServiceImpl (PilaManual + JPA)
│           │   └── rest/             # AuditController
│           └── structure/
│               ├── PilaManual.java
│               └── NodoPila.java
│
└── logicore-dashboard/
    ├── index.html                    # SPA entry point
    ├── styles.css                    # Full design system (2100+ lines)
    ├── app.js                        # Bootstrap and controller orchestration
    └── infrastructure/api/
        ├── YardController.js         # Yard API adapter
        ├── DispatchController.js     # Dispatch API adapter
        ├── AuditController.js        # Audit API adapter
        └── Background3D.js           # Three.js Particle Nexus engine
```

---

## Resource Limits

Defined in `docker-compose.yml` under `deploy.resources.limits`:

| Container | Memory Limit |
|---|---|
| `yard-postgres-db` | 256 MB |
| `dispatch-sqlserver-db` | 1536 MB |
| `inbound-yard-service` | 256 MB |
| `dispatch-queue-service` | 256 MB |
| `audit-history-service` | 256 MB |

SQL Server 2022 Developer Edition requires a minimum of 1 GB to initialize; the 1536 MB limit accommodates the engine overhead while keeping the total stack footprint under 2.5 GB.

---

## Academic Context

This system was developed as a capstone project for the **Algorithms and Data Structures** course (Cycle 6) at Universidad Tecnológica del Perú (UTP). The primary evaluation criteria are:

- Correct implementation and integration of three distinct manual data structures (no delegation to `java.util`)
- Multithreaded safety without deadlock using `ReentrantReadWriteLock`
- Clean Architecture layering (domain / infrastructure / structure separation)
- Full-stack integration with a functional operational dashboard

---

*LogiCore Port Control — Built for academic evaluation and portfolio demonstration.*
