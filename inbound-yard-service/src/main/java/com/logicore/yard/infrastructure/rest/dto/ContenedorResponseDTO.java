package com.logicore.yard.infrastructure.rest.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ContenedorResponseDTO(
    @JsonProperty("codigoId") String codigoId,
    String destino,
    @JsonProperty("peso") double peso,
    int prioridad
) {}
