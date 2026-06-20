# LogiCore Port Control - Terminal Operating System (TOS) Enterprise

LogiCore Port Control es una plataforma de software industrial de nivel empresarial diseñada para funcionar como un Terminal Operating System (TOS). Su objetivo principal es coordinar, automatizar y auditar las operaciones de carga, colocación de contenedores y despacho de transporte terrestre en el terminal marítimo del Puerto del Callao.

El sistema se estructura bajo una arquitectura de microservicios robusta y desacoplada, implementando estructuras de datos lineales y genéricas personalizadas de forma manual para evitar la dependencia de librerías estandarizadas de Java. Esto garantiza el control total del consumo de memoria en la capa intermedia en RAM y una persistencia heterogénea sincronizada mediante transacciones atómicas.

---

## 1. Arquitectura de Módulos

El repositorio se organiza como un monorrepositorio multi-módulo administrado de forma unificada por un POM Padre en la raíz. La estructura de las 6 carpetas principales del proyecto es la siguiente:

*   **logicore-shared**: Biblioteca común escrita en Java 21 que centraliza la infraestructura de estructuras de datos lineales genéricas y reutilizables. Al estar parametrizada como `<T>`, carece de dependencias hacia entidades o microservicios específicos. Aloja las clases `NodoSimple<T>`, `PilaManual<T>` y `ColaManual<T>`.
*   **inbound-yard-service**: Microservicio encargado del patio de contenedores. Utiliza la estructura `ListaDobleManual<T>` para representar la asignación física y secuencial de los contenedores en RAM, persistiendo el estado en un esquema relacional de PostgreSQL.
*   **dispatch-queue-service**: Microservicio responsable de la cola de despacho vehicular terrestre. Administra el orden FIFO de camiones mediante la estructura `ColaManual<Camion>`, sincronizando las mutaciones de forma transaccional con una base de datos Microsoft SQL Server.
*   **audit-history-service**: Microservicio de registro histórico e inmutable de auditoría. Permite operaciones de deshacer (UNDO) basadas en una política LIFO implementada a través de `PilaManual<AuditLog>`, persistiendo los registros históricos en PostgreSQL.
*   **logicore-dashboard**: Interfaz gráfica HUD de alto rendimiento construida en HTML5, CSS3 clásico y Javascript vanilla. Utiliza Three.js para la renderización tridimensional interactiva del patio de contenedores y se comunica con los microservicios sin latencias artificiales de carga.
*   **db-init**: Directorio contenedor de los scripts SQL de inicialización automatizada para las bases de datos PostgreSQL y Microsoft SQL Server, asegurando la consistencia inicial del esquema de datos.

### Diagrama del Flujo de Datos del Ecosistema

```
+------------------------------------------------------------+
|                LOGICORE-DASHBOARD (Frontend)               |
|            Interfaz HUD en Tiempo Real (Port 5500)         |
+---------+--------------------+-------------------+---------+
          |                    |                   |
     (API Rest)           (API Rest)          (API Rest)
          |                    |                   |
          v                    v                   v
+-------------------+  +-----------------+  +----------------+
| inbound-yard-     |  | dispatch-queue- |  | audit-history- |
| service (:8081)   |  | service (:8082) |  | service (:8083)|
+---------+---------+  +--------+--------+  +-------+--------+
          |                     |                   |
(ListaDobleManual<T>)     (ColaManual<T>)     (PilaManual<T>)
          |                     |                   |
    (PostgreSQL)          (SQL Server)        (PostgreSQL)
          |                     |                   |
          +----------+----------+                   |
                     |                              |
            (Asynchronous REST)                     |
                     |                              |
                     v                              |
         +------------------------------------------+
         | Registra acciones de auditoría en la     |
         | pila de eventos para soporte LIFO / UNDO |
         +------------------------------------------+
```

### Arquitectura de Capas en el Frontend (logicore-dashboard)

El cliente web implementa principios de Clean Architecture y aislamiento semántico para desacoplar el transporte de red de la presentación visual:

```
+--------------------------------------------------------+
|                   PRESENTATION LAYER                   |
|  [HUD View / Components] <----> [DashboardController]   |
+---------------------------+----------------------------+
                            | (suscripción / interacción)
                            v
+--------------------------------------------------------+
|                       STORE LAYER                      |
|            [Store.js (Observer / State)]               |
+---------------------------+----------------------------+
                            | (mutación del estado)
                            v
+--------------------------------------------------------+
|                      SERVICE LAYER                     |
|    [YardService]  |  [DispatchService]  |  [AuditService]  |
+---------------------------+----------------------------+
                            | (peticiones REST limpias)
                            v
+--------------------------------------------------------+
|                   INFRASTRUCTURE LAYER                 |
|                      [ApiClient.js]                    |
+---------------------------+----------------------------+
                            | (comunicación HTTP)
                            v
                    [Java Microservices]
```

*   **Presentation Layer**: Componentes web e interactivos del HUD que renderizan la interfaz y reaccionan a los cambios de estado suscritos mediante controladores específicos.
*   **Store (State Management)**: Centraliza el estado privado del HUD. Implementa el patrón Observer para notificar cambios a los componentes interesados y actuar como la Única Fuente de Verdad.
*   **Service Layer**: Clases de negocio abstractas (`YardService`, `DispatchService`, `AuditService`) que encapsulan la validación, lógica de aplicación y mapeo de datos.
*   **Infrastructure Layer (ApiClient)**: Cliente centralizado que unifica la resolución de endpoints de los microservicios, configuraciones de red y control homogéneo de excepciones HTTP.

---

## 2. Decisiones de Ingeniería y Diseño de Software

### Exclusión Mutua para Seguridad de Hilos (Thread-Safety) en RAM
Dado que los microservicios de Spring Boot procesan peticiones concurrentes de múltiples clientes HTTP a través del pool de hilos embebido de Tomcat, la manipulación de las estructuras en memoria RAM (`ColaManual`, `PilaManual`, `ListaDobleManual`) está expuesta a condiciones de carrera (race conditions). 
Para solucionar esto, se implementa un mecanismo de exclusión mutua mediante `ReentrantReadWriteLock` en la capa de servicios. Esto garantiza que:
*   Múltiples operaciones de lectura (`obtenerHistorial`, `obtenerCamionesEnCola`) puedan ocurrir de forma paralela sin bloquear el sistema.
*   Cualquier operación de mutación de datos (escritura como `push`, `enqueue`, `pop`, `dequeue`) adquiera un bloqueo exclusivo de escritura (`lock.writeLock()`), encapsulando tanto la persistencia física en base de datos como la mutación en memoria RAM en un bloque atómico e indivisible.

### Control de Concurrencia Avanzado: Locks en RAM y Transaccionalidad de Base de Datos
Para garantizar la atomicidad total y evitar inconsistencias entre la RAM y las bases de datos relacionales, el sistema coordina de manera estricta los cerrojos de concurrencia de la JVM con el control de transacciones de Spring Data JPA:
*   **Coordinación de Operaciones**: En la reversión (`deshacerUltimaAccion()`), el servicio adquiere primero el `lock.writeLock()`.
*   **Aislamiento Relacional**: Posteriormente, interactúa con la base de datos PostgreSQL utilizando `@Transactional`. Si ocurre cualquier fallo físico o error en la base de datos (e.g. violación de restricciones o excepciones SQL), la transacción relacional se aborta y se realiza un rollback automático.
*   **Sincronización de Estado**: La estructura en RAM (el tope de la pila LIFO) solo se remueve (`auditStack.pop()`) si la persistencia física en la base de datos se confirma exitosamente. Cualquier error aborta tanto el cambio en base de datos como en memoria, liberando el lock en el bloque `finally` para evitar bloqueos mutuos.

### Separación de Responsabilidades (SRP) y Auditoría Asíncrona
El microservicio de auditoría registra las acciones críticas ocurridas en los patios y colas de despacho. Si las llamadas a la API de auditoría se realizaran en el mismo hilo de ejecución de la transacción comercial de despacho o ingreso de contenedor, cualquier lentitud de la red o falla en el servicio de auditoría bloquearía el flujo de negocio principal.
Para cumplir de forma estricta con el Principio de Responsabilidad Única (SRP) y aislar el dominio de negocio de las actividades de red, la mensajería hacia el servicio de auditoría se delega a clientes de infraestructura dedicados (`AuditClient`). Estos envían la solicitud de auditoría de manera totalmente asíncrona a través de hilos virtuales (`Thread.ofVirtual().start()`), asegurando que las operaciones principales respondan en milisegundos sin verse afectadas por el estado del bus de auditoría.

### Hidratación Asíncrona y Prevención de Fugas de Memoria (OOM)
Para evitar la degradación de la memoria RAM a lo largo del tiempo operativa del puerto y reducir el tiempo de arranque del backend, se diseñó una estrategia de hidratación asíncrona controlada utilizando la anotación `@PostConstruct`.
*   **Ventana Deslizante de Carga**: Al levantar el servicio de auditoría, en lugar de cargar los miles de logs históricos de la base de datos (lo que saturaría la memoria heap de la JVM y generaría una falla Out-Of-Memory), el sistema realiza una consulta selectiva limitada a los últimos 100 eventos (`findTop100ByOrderByFechaCreacionDesc()`).
*   **Reconstrucción LIFO Correcta**: Dado que la base de datos devuelve los registros ordenados descendentemente (del más reciente al más antiguo) y la estructura de datos es una Pila LIFO, la inserción directa invertiría el orden de precedencia cronológica. Por lo tanto, el sistema recorre la lista en orden inverso (de la posición 99 a la 0) para insertarlos secuencialmente, asegurando que el último evento ocurrido quede en el tope de la pila en memoria RAM.
*   **Hilos Virtuales y Bloqueos de Escritura**: Este proceso de hidratación inicial se ejecuta dentro de un hilo virtual de inicio rápido para no bloquear el arranque de la aplicación de Spring Boot, protegiendo la inserción masiva en la pila mediante el bloqueo de escritura.

---

## 3. Guía de Despliegue con Docker Compose

El sistema se orquesta por completo mediante Docker Compose, empaquetando cada base de datos y microservicio en contenedores independientes y comunicados sobre una red privada virtual (`logicore-net`).

### Prerrequisitos
*   Docker Desktop y Docker Compose instalados y configurados.
*   Puertos libres en el host: `8081` (Yard), `8082` (Dispatch), `8083` (Audit), `5432` (PostgreSQL), `1433` (SQL Server) y `5500` (Dashboard).

### Paso 1: Compilación Limpia y Construcción de Contenedores
Para compilar y construir todas las imágenes de Docker desde el código fuente aplanado, ejecuta el siguiente comando en el directorio raíz del proyecto:

```bash
docker compose build --no-cache
```

Este comando transferirá el contexto del proyecto a cada contenedor de compilación de Maven y generará los ejecutables optimizados de Spring Boot listos para producción.

### Paso 2: Levantar el Ecosistema
Levanta los servicios en segundo plano:

```bash
docker compose up -d
```

### Paso 3: Verificación de Estado y Healthchecks
Docker Compose iniciará las bases de datos primero, ejecutará los scripts de inicialización de esquemas (`db-init`), y luego levantará los microservicios una vez que las bases de datos pasen exitosamente sus pruebas de estado (healthchecks).

Para verificar el estado de los contenedores en ejecución:

```bash
docker compose ps
```

### Paso 4: Acceso al Dashboard Operativo
Una vez que todos los contenedores reporten un estado saludable (healthy), abre el navegador web y accede a la interfaz del operador en el puerto local asignado al servidor HTTP estático (por defecto, puerto `5500` o abre directamente el archivo HTML):

```
http://127.0.0.1:5500/logicore-dashboard/index.html
```
