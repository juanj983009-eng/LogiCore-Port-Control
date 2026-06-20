package com.logicore.audit.infrastructure.persistence;

import com.logicore.audit.domain.entity.AuditLog; // CORREGIDO: Apunta a tu paquete real
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogJpaRepository extends JpaRepository<AuditLog, String> {
    java.util.List<AuditLog> findAllByOrderByFechaCreacionAsc();
    java.util.List<AuditLog> findTop100ByOrderByFechaCreacionDesc();
}