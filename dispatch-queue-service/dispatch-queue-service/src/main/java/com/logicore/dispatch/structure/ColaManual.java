package com.logicore.dispatch.structure;
public class ColaManual<T> {
    private NodoSimple<T> frente;
    private NodoSimple<T> finalCola;
    private int tamaño;

    public ColaManual() {
        this.frente = null;
        this.finalCola = null;
        this.tamaño = 0;
    }

    // Operación de inserción al final (Encolar)
    public void enqueue(T elemento) {
        NodoSimple<T> nuevoNodo = new NodoSimple<>(elemento);
        if (estaVacia()) {
            frente = nuevoNodo;
            finalCola = nuevoNodo;
        } else {
            finalCola.setSiguiente(nuevoNodo);
            finalCola = nuevoNodo;
        }
        tamaño++;
    }

    // Operación de extracción del frente (Desencolar - Primero en llegar, Primero
    // en salir)
    public T dequeue() {
        if (estaVacia()) {
            return null;
        }
        T dato = frente.getDato();
        frente = frente.getSiguiente();

        if (frente == null) {
            finalCola = null; // Si la cola se quedó vacía
        }
        tamaño--;
        return dato;
    }

    public NodoSimple<T> getFrente() {
        return frente;
    }

    public int getTamaño() {
        return tamaño;
    }

    public boolean estaVacia() {
        return frente == null;
    }
}