package com.logicore.audit.domain.entity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;

@Entity
@Table(name = "auditorias")
public class AuditLog {

    @Id
    private String idLog; // Será nuestra Clave Primaria (PK) en PostgreSQL

    private String tipoAccion;
    private String microservicio;

    @Column(columnDefinition = "TEXT") // Permite almacenar JSONs o textos muy largos
    private String payload;

    // Constructor vacío OBLIGATORIO para Spring Data JPA / Hibernate
    public AuditLog() {
    }

    // Tu constructor de negocio original (removemos los 'final' de los parámetros)
    public AuditLog(String idLog, String tipoAccion, String microservicio, String payload) {
        if (idLog == null || idLog.trim().isEmpty()) {
            throw new IllegalArgumentException("El ID de log es obligatorio.");
        }
        this.idLog = idLog;
        this.tipoAccion = tipoAccion;
        this.microservicio = microservicio;
        this.payload = payload;
    }

    // Getters limpios
    public String getIdLog() {
        return idLog;
    }

    public String getTipoAccion() {
        return tipoAccion;
    }

    public String getMicroservicio() {
        return microservicio;
    }

    public String getPayload() {
        return payload;
    }

    // Setters (JPA los usa internamente para rellenar los datos desde Docker)
    public void setIdLog(String idLog) {
        this.idLog = idLog;
    }

    public void setTipoAccion(String tipoAccion) {
        this.tipoAccion = tipoAccion;
    }

    public void setMicroservicio(String microservicio) {
        this.microservicio = microservicio;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }
}