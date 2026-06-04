package com.logicore.yard.structure;
public class ListaDobleManual<T> {
    private NodoDoble<T> cabeza;
    private NodoDoble<T> cola;
    private int tamaño;

    public ListaDobleManual() {
        this.cabeza = null;
        this.cola = null;
        this.tamaño = 0;
    }

    public void insertarAlFinal(T elemento) {
        NodoDoble<T> nuevoNodo = new NodoDoble<>(elemento);
        if (cabeza == null) {
            cabeza = nuevoNodo;
            cola = nuevoNodo;
        } else {
            cola.setSiguiente(nuevoNodo);
            nuevoNodo.setAnterior(cola);
            cola = nuevoNodo;
        }
        tamaño++;
    }

    public NodoDoble<T> getCabeza() {
        return cabeza;
    }

    public NodoDoble<T> getCola() {
        return cola;
    }

    public int getTamaño() {
        return tamaño;
    }

    public boolean estaVacia() {
        return cabeza == null;
    }
}