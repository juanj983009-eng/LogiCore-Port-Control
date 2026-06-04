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
