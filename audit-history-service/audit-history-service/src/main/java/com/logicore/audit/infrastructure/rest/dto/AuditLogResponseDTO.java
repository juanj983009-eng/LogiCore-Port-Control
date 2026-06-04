package com.logicore.audit.infrastructure.rest.dto;

public record AuditLogResponseDTO(
    String idLog,
    String tipoAccion,
    String microservicio,
    String payload
) {}
