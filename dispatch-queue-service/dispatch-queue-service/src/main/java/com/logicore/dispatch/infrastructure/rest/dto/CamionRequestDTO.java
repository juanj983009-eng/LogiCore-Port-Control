package com.logicore.dispatch.infrastructure.rest.dto;

public record CamionRequestDTO(
    String placa,
    String conductor,
    String tipoCarga,
    int ordenPrioridad
) {}
