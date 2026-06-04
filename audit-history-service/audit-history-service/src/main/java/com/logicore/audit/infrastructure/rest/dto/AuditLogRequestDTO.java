package com.logicore.audit.infrastructure.rest.dto;

public record AuditLogRequestDTO(
    String idLog,
    String tipoAccion,
    String microservicio,
    String payload
) {}
