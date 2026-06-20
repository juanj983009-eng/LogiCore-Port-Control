package com.logicore.shared.structure;

import java.util.ArrayList;
import java.util.List;

public class PilaManual<T> {
    private NodoSimple<T> tope;
    private int tamaño;

    public PilaManual() {
        this.tope = null;
        this.tamaño = 0;
    }

    public void push(T elemento) {
        NodoSimple<T> nuevo = new NodoSimple<>(elemento);
        nuevo.setSiguiente(tope);
        tope = nuevo;
        tamaño++;
    }

    public T pop() {
        if (isEmpty()) return null;
        T dato = tope.getDato();
        tope = tope.getSiguiente();
        tamaño--;
        return dato;
    }

    public boolean isEmpty() { return tope == null; }
    public int getTamaño() { return tamaño; }

    // --- Métodos de compatibilidad para evitar breaking changes en los microservicios ---

    public boolean estaVacia() {
        return isEmpty();
    }

    public NodoSimple<T> getTope() {
        return tope;
    }

    public List<T> toElementList() {
        List<T> lista = new ArrayList<>();
        NodoSimple<T> actual = tope;
        while (actual != null) {
            lista.add(actual.getDato());
            actual = actual.getSiguiente();
        }
        return lista;
    }

    public void clear() {
        this.tope = null;
        this.tamaño = 0;
    }
}
