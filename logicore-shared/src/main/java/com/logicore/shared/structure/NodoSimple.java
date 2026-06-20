package com.logicore.shared.structure;

public class NodoSimple<T> {
    private T dato;
    private NodoSimple<T> siguiente;

    public NodoSimple(T dato) {
        this.dato = dato;
        this.siguiente = null;
    }

    // Incluir getters y setters estándar
    public T getDato() { return dato; }
    public void setDato(T dato) { this.dato = dato; }
    public NodoSimple<T> getSiguiente() { return siguiente; }
    public void setSiguiente(NodoSimple<T> siguiente) { this.siguiente = siguiente; }
}
