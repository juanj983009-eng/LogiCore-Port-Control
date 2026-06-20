package com.logicore.audit.infrastructure.rest;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.logicore.audit.domain.entity.AuditLog;
import com.logicore.audit.domain.repository.AuditService;
import com.logicore.audit.infrastructure.rest.dto.AuditLogRequestDTO;
import com.logicore.audit.infrastructure.rest.dto.AuditLogResponseDTO;

@RestController
@RequestMapping("/api/v1/audit/logs")
// 2. IMPORTANTE: Abrimos las compuertas para el entorno de desarrollo local
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @PostMapping
    public ResponseEntity<String> registrarLog(@RequestBody AuditLogRequestDTO dto) {
        AuditLog log = new AuditLog(dto.idLog(), dto.tipoAccion(), dto.microservicio(), dto.payload());
        auditService.registrarAccion(log);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body("Evento " + dto.tipoAccion() + " apilado en el historial de auditoría.");
    }

    @PostMapping("/undo")
    public ResponseEntity<?> deshacerAccion() {
        AuditLog ultimoCambio = auditService.deshacerUltimaAccion();
        if (ultimoCambio == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("No hay acciones en el historial para deshacer.");
        }
        AuditLogResponseDTO response = new AuditLogResponseDTO(
                ultimoCambio.getIdLog(),
                ultimoCambio.getTipoAccion(),
                ultimoCambio.getMicroservicio(),
                ultimoCambio.getPayload()
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<AuditLogResponseDTO>> verHistorial() {
        List<AuditLogResponseDTO> response = auditService.obtenerHistorial().stream()
                .map(log -> new AuditLogResponseDTO(
                        log.getIdLog(),
                        log.getTipoAccion(),
                        log.getMicroservicio(),
                        log.getPayload()
                ))
                .toList();
        return ResponseEntity.ok(response);
    }
}