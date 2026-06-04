package com.logicore.audit.structure;
public class PilaManual<T> {
    private NodoPila<T> tope;
    private int tamaño;

    public PilaManual() {
        this.tope = null;
        this.tamaño = 0;
    }

    // Operación Insertar (Push) - Coloca el nuevo nodo arriba del tope actual
    public void push(T elemento) {
        NodoPila<T> nuevoNodo = new NodoPila<>(elemento);
        nuevoNodo.setSiguiente(tope);
        tope = nuevoNodo;
        tamaño++;
    }

    // Operación Extraer (Pop) - Retira y devuelve el nodo del tope (LIFO)
    public T pop() {
        if (estaVacia()) {
            return null;
        }
        T dato = tope.getDato();
        tope = tope.getSiguiente();
        tamaño--;
        return dato;
    }

    public NodoPila<T> getTope() {
        return tope;
    }

    public int getTamaño() {
        return tamaño;
    }

    public boolean estaVacia() {
        return tope == null;
    }
}