package com.logicore.yard.domain.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "contenedores")
public class Contenedor {

    @Id
    private String codigoID; // Actuará como Primary Key (PK) en Postgres

    private String destino;
    private double pesoToneladas;
    private int prioridad;

    // Constructor vacío obligatorio exigido por JPA/Hibernate
    public Contenedor() {
    }

    // Tu constructor de negocio original que protege la lógica de datos
    public Contenedor(String codigoID, String destino, double pesoToneladas, int prioridad) {
        if (codigoID == null || codigoID.trim().isEmpty()) {
            throw new IllegalArgumentException("El código de identificación del contenedor es obligatorio.");
        }
        this.codigoID = codigoID;
        this.destino = destino;
        this.pesoToneladas = pesoToneladas;
        this.prioridad = prioridad;
    }

    // Getters y Setters limpios
    public String getCodigoID() {
        return codigoID;
    }

    public void setCodigoID(String codigoID) {
        this.codigoID = codigoID;
    }

    public String getDestino() {
        return destino;
    }

    public void setDestino(String destino) {
        this.destino = destino;
    }

    public double getPesoToneladas() {
        return pesoToneladas;
    }

    public void setPesoToneladas(double pesoToneladas) {
        this.pesoToneladas = pesoToneladas;
    }

    public int getPrioridad() {
        return prioridad;
    }

    public void setPrioridad(int prioridad) {
        this.prioridad = prioridad;
    }
}