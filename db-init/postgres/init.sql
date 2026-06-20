-- =========================================================================
-- 🐘  POSTGRESQL INITIALIZATION SCRIPT  —  LOGICORE
-- =========================================================================

-- The database 'yard_management' is automatically created by the POSTGRES_DB environment variable.
-- We connect to it and create the tables if they do not exist yet.

CREATE TABLE IF NOT EXISTS contenedores (
    codigoID VARCHAR(255) PRIMARY KEY,
    destino VARCHAR(255),
    pesoToneladas DOUBLE PRECISION,
    prioridad INTEGER
);

CREATE TABLE IF NOT EXISTS auditorias (
    id_log VARCHAR(255) PRIMARY KEY,
    microservicio VARCHAR(255),
    payload TEXT,
    tipo_accion VARCHAR(255),
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);

