package com.logicore.yard.infrastructure.rest.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ContenedorRequestDTO(
    @JsonProperty("codigoId") String codigoID,
    String destino,
    @JsonProperty("peso") double pesoToneladas,
    int prioridad
) {}
