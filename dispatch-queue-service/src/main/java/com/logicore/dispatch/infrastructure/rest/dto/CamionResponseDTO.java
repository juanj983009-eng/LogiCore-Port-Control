package com.logicore.dispatch.infrastructure.rest.dto;

public record CamionResponseDTO(
    String placa,
    String conductor,
    String tipoCarga,
    int ordenPrioridad
) {}
