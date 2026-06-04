package com.logicore.audit.domain.repository;
import java.util.List;

import com.logicore.audit.domain.entity.AuditLog;

public interface AuditService {
    void registrarAccion(AuditLog log);

    AuditLog deshacerUltimaAccion();

    List<AuditLog> obtenerHistorial();
}