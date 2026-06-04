package com.logicore.dispatch.domain.entity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "despachos")
public class Camion {

    @Id
    private String placa; // O tu campo ID correspondiente (PK en SQL Server)

    private String conductor;
    private String tipoCarga;
    private int ordenPrioridad;

    // Constructor vacío obligatorio exigido por JPA/Hibernate
    public Camion() {
    }

    // Tu constructor de negocio original
    public Camion(String placa, String conductor, String tipoCarga, int ordenPrioridad) {
        this.placa = placa;
        this.conductor = conductor;
        this.tipoCarga = tipoCarga;
        this.ordenPrioridad = ordenPrioridad;
    }

    // Getters y Setters limpios...
    public String getPlaca() {
        return placa;
    }

    public void setPlaca(String placa) {
        this.placa = placa;
    }

    public String getConductor() {
        return conductor;
    }

    public void setConductor(String conductor) {
        this.conductor = conductor;
    }

    public String getTipoCarga() {
        return tipoCarga;
    }

    public void setTipoCarga(String tipoCarga) {
        this.tipoCarga = tipoCarga;
    }

    public int getOrdenPrioridad() {
        return ordenPrioridad;
    }

    public void setOrdenPrioridad(int ordenPrioridad) {
        this.ordenPrioridad = ordenPrioridad;
    }
}