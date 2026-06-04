package com.logicore.yard.infrastructure.rest;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.logicore.yard.domain.entity.Contenedor;
import com.logicore.yard.domain.repository.YardService;
import com.logicore.yard.infrastructure.rest.dto.ContenedorRequestDTO;
import com.logicore.yard.infrastructure.rest.dto.ContenedorResponseDTO;

@CrossOrigin("*") // Micro-paso 3.1: Habilitar el intercambio de recursos para el Front-End
@RestController
@RequestMapping("/api/v1/yard/containers")
public class YardController {

    private final YardService yardService;

    // Inyección de dependencias por constructor (Buena práctica SOLID)
    public YardController(YardService yardService) {
        this.yardService = yardService;
    }

    @PostMapping
    public ResponseEntity<String> registrarContenedor(@RequestBody ContenedorRequestDTO dto) {
        try {
            Contenedor contenedor = new Contenedor(
                    dto.codigoID(),
                    dto.destino(),
                    dto.pesoToneladas(),
                    dto.prioridad()
            );
            yardService.registrarContenedor(contenedor);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body("Contenedor " + dto.codigoID() + " registrado exitosamente en la bahía.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @GetMapping(value = {"", "/view"})
    public ResponseEntity<List<ContenedorResponseDTO>> listarIda() {
        List<ContenedorResponseDTO> response = yardService.listarContenedoresIda().stream()
                .map(c -> new ContenedorResponseDTO(
                        c.getCodigoID(),
                        c.getDestino(),
                        c.getPesoToneladas(),
                        c.getPrioridad()
                ))
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/reverse")
    public ResponseEntity<List<ContenedorResponseDTO>> listarVuelta() {
        List<ContenedorResponseDTO> response = yardService.listarContenedoresVuelta().stream()
                .map(c -> new ContenedorResponseDTO(
                        c.getCodigoID(),
                        c.getDestino(),
                        c.getPesoToneladas(),
                        c.getPrioridad()
                ))
                .toList();
        return ResponseEntity.ok(response);
    }
}