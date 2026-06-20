package com.logicore.shared.structure;

public class ColaManual<T> {
    private NodoSimple<T> primero;
    private NodoSimple<T> ultimo;
    private int tamaño;

    public ColaManual() {
        this.primero = null;
        this.ultimo = null;
        this.tamaño = 0;
    }

    public void enqueue(T elemento) {
        NodoSimple<T> nuevo = new NodoSimple<>(elemento);
        if (ultimo != null) {
            ultimo.setSiguiente(nuevo);
        }
        ultimo = nuevo;
        if (primero == null) {
            primero = nuevo;
        }
        tamaño++;
    }

    public T dequeue() {
        if (primero == null) return null;
        T dato = primero.getDato();
        primero = primero.getSiguiente();
        if (primero == null) {
            ultimo = null;
        }
        tamaño--;
        return dato;
    }

    public boolean isEmpty() { return primero == null; }
    public int getTamaño() { return tamaño; }

    // --- Métodos de compatibilidad para evitar breaking changes en los microservicios ---

    public boolean estaVacia() {
        return isEmpty();
    }

    public NodoSimple<T> getFrente() {
        return primero;
    }

    public NodoSimple<T> getFinalCola() {
        return ultimo;
    }

    public boolean removeIf(java.util.function.Predicate<T> filter) {
        if (estaVacia()) return false;
        if (filter.test(primero.getDato())) {
            primero = primero.getSiguiente();
            if (primero == null) {
                ultimo = null;
            }
            tamaño--;
            return true;
        }
        NodoSimple<T> actual = primero;
        while (actual.getSiguiente() != null) {
            if (filter.test(actual.getSiguiente().getDato())) {
                if (actual.getSiguiente() == ultimo) {
                    ultimo = actual;
                }
                actual.setSiguiente(actual.getSiguiente().getSiguiente());
                tamaño--;
                return true;
            }
            actual = actual.getSiguiente();
        }
        return false;
    }
}
