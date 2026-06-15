/**
 * Frontend validation schemas matching backend DTO definitions exactly.
 * Used to prevent data type or property name mismatches before compilation/execution.
 */

const Schemas = {
    ContenedorRequestDTO: {
        codigoId: "string",      // Mapeado desde el campo java 'codigoID'
        destino: "string",
        peso: "number",          // Mapeado desde el campo java 'pesoToneladas'
        prioridad: "number"
    },
    ContenedorResponseDTO: {
        codigoId: "string",
        destino: "string",
        peso: "number",
        prioridad: "number"
    },
    CamionRequestDTO: {
        placa: "string",
        conductor: "string",
        tipoCarga: "string",
        ordenPrioridad: "number"
    },
    CamionResponseDTO: {
        placa: "string",
        conductor: "string",
        tipoCarga: "string",
        ordenPrioridad: "number"
    },
    AuditLogRequestDTO: {
        idLog: "string",
        tipoAccion: "string",
        microservicio: "string",
        payload: "string"
    },
    AuditLogResponseDTO: {
        idLog: "string",
        tipoAccion: "string",
        microservicio: "string",
        payload: "string"
    }
};

/**
 * Valida que los objetos del frontend coincidan exactamente con la firma de datos del backend.
 * Lanza una 'Compilation Block Alert' si detecta tipos o nombres incorrectos.
 */
function validateDTO(schemaKey, data) {
    const schema = Schemas[schemaKey];
    if (!schema) {
        throw new Error(`[Compilation Block Alert] El esquema de validación ${schemaKey} no existe.`);
    }
    
    // Validar presencia y correspondencia de tipo de dato
    for (const [key, expectedType] of Object.entries(schema)) {
        if (!(key in data)) {
            throw new Error(`[Compilation Block Alert] Mismatch detectado en DTO ${schemaKey}: Falta el campo obligatorio '${key}'.`);
        }
        const actualType = typeof data[key];
        if (actualType !== expectedType) {
            throw new Error(`[Compilation Block Alert] Mismatch de tipo en DTO ${schemaKey}: El campo '${key}' debe ser de tipo '${expectedType}', pero se recibió '${actualType}'.`);
        }
    }
    
    // Validar que no se envíen campos no soportados por el DTO del backend
    for (const key of Object.keys(data)) {
        if (!(key in schema)) {
            throw new Error(`[Compilation Block Alert] Exceso de propiedades en DTO ${schemaKey}: El campo '${key}' no existe en la firma del backend.`);
        }
    }
    
    return true;
}

if (typeof module !== 'undefined') {
    module.exports = { Schemas, validateDTO };
}
