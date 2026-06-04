package com.logicore.dispatch.infrastructure.rest;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.logicore.dispatch.domain.entity.Camion;
import com.logicore.dispatch.domain.repository.DispatchService;
import com.logicore.dispatch.infrastructure.rest.dto.CamionRequestDTO;
import com.logicore.dispatch.infrastructure.rest.dto.CamionResponseDTO;

@CrossOrigin("*") // Habilitar intercambio de recursos global para el Front-End (Live Server)
@RestController
@RequestMapping("/api/v1/dispatch")
public class DispatchController {

    private final DispatchService dispatchService;

    // Inyección por constructor (Clean Code)
    public DispatchController(DispatchService dispatchService) {
        this.dispatchService = dispatchService;
    }

    // =========================================================================
    // ENDPOINTS: COLA DE DESPACHO (CAMIONES)
    // =========================================================================

    @PostMapping("/trucks")
    public ResponseEntity<String> registrarCamion(@RequestBody CamionRequestDTO dto) {
        try {
            Camion camion = new Camion(dto.placa(), dto.conductor(), dto.tipoCarga(), dto.ordenPrioridad());
            dispatchService.encolarCamion(camion);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body("Camión con placa " + dto.placa() + " asignado a la cola de espera.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @DeleteMapping("/trucks/next")
    public ResponseEntity<?> despacharCamion() {
        Camion atendido = dispatchService.atenderSiguiente();
        if (atendido == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("No hay camiones en la cola de despacho.");
        }
        CamionResponseDTO response = new CamionResponseDTO(
                atendido.getPlaca(),
                atendido.getConductor(),
                atendido.getTipoCarga(),
                atendido.getOrdenPrioridad()
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/trucks/view")
    public ResponseEntity<List<CamionResponseDTO>> verCola() {
        List<CamionResponseDTO> responseList = dispatchService.listarCola().stream()
                .map(c -> new CamionResponseDTO(
                        c.getPlaca(),
                        c.getConductor(),
                        c.getTipoCarga(),
                        c.getOrdenPrioridad()
                ))
                .toList();
        return ResponseEntity.ok(responseList);
    }
}