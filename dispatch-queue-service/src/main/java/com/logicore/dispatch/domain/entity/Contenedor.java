package com.logicore.dispatch.domain.entity;
public class Contenedor {
    private String codigoId;
    private String destino;
    private double peso;
    private int prioridad;

    // Constructores
    public Contenedor() {
    }

    public Contenedor(String codigoId, String destino, double peso, int prioridad) {
        this.codigoId = codigoId;
        this.destino = destino;
        this.peso = peso;
        this.prioridad = prioridad;
    }

    // Getters y Setters
    public String getCodigoId() {
        return codigoId;
    }

    public void setCodigoId(String codigoId) {
        this.codigoId = codigoId;
    }

    public String getDestino() {
        return destino;
    }

    public void setDestino(String destino) {
        this.destino = destino;
    }

    public double getPeso() {
        return peso;
    }

    public void setPeso(double peso) {
        this.peso = peso;
    }

    public int getPrioridad() {
        return prioridad;
    }

    public void setPrioridad(int prioridad) {
        this.prioridad = prioridad;
    }
}
