/**
 * TypeScript Definitions for LogiCore Port Control
 * Generated automatically to align with Java backend DTOs.
 */

/**
 * Representación exacta de ContenedorRequestDTO
 * del servicio inbound-yard-service.
 */
export interface ContenedorRequestDTO {
    /**
     * Identificación única del contenedor.
     * Mapeado desde el campo java `codigoID` mediante @JsonProperty("codigoId").
     */
    codigoId: string;
    
    /**
     * Destino del contenedor.
     */
    destino: string;
    
    /**
     * Peso del contenedor en toneladas.
     * Mapeado desde el campo java `pesoToneladas` mediante @JsonProperty("peso").
     */
    peso: number;
    
    /**
     * Nivel de prioridad asignado (1-3).
     */
    prioridad: number;
}

/**
 * Representación exacta de ContenedorResponseDTO
 * del servicio inbound-yard-service.
 */
export interface ContenedorResponseDTO {
    /**
     * Identificación única del contenedor.
     * Mapeado desde el campo java `codigoId` mediante @JsonProperty("codigoId").
     */
    codigoId: string;
    
    /**
     * Destino del contenedor.
     */
    destino: string;
    
    /**
     * Peso del contenedor en toneladas.
     * Mapeado desde el campo java `peso` mediante @JsonProperty("peso").
     */
    peso: number;
    
    /**
     * Nivel de prioridad asignado (1-3).
     */
    prioridad: number;
}

/**
 * Representación exacta de CamionRequestDTO
 * del servicio dispatch-queue-service.
 */
export interface CamionRequestDTO {
    placa: string;
    conductor: string;
    tipoCarga: string;
    ordenPrioridad: number;
}

/**
 * Representación exacta de CamionResponseDTO
 * del servicio dispatch-queue-service.
 */
export interface CamionResponseDTO {
    placa: string;
    conductor: string;
    tipoCarga: string;
    ordenPrioridad: number;
}

/**
 * Representación exacta de AuditLogRequestDTO
 * del servicio audit-history-service.
 */
export interface AuditLogRequestDTO {
    idLog: string;
    tipoAccion: string;
    microservicio: string;
    payload: string;
}

/**
 * Representación exacta de AuditLogResponseDTO
 * del servicio audit-history-service.
 */
export interface AuditLogResponseDTO {
    idLog: string;
    tipoAccion: string;
    microservicio: string;
    payload: string;
}
