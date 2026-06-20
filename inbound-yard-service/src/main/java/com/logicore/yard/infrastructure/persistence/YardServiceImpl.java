package com.logicore.yard.infrastructure.persistence;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import org.springframework.stereotype.Service;

import com.logicore.yard.domain.entity.Contenedor;
import com.logicore.yard.domain.repository.ContenedorJpaRepository;
import com.logicore.yard.domain.repository.YardService;
import com.logicore.yard.infrastructure.rest.client.AuditClient;
import com.logicore.yard.structure.ListaDobleManual;
import com.logicore.yard.structure.NodoDoble;

import jakarta.annotation.PostConstruct;
import org.springframework.transaction.annotation.Transactional;

@Service
public class YardServiceImpl implements YardService {

    private final ListaDobleManual<Contenedor> listaDobleManual = new ListaDobleManual<>();
    private final ContenedorJpaRepository contenedorJpaRepository;
    private final AuditClient auditClient;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    // Inyección por constructor optimizada (SOLID / Clean Code / SRP)
    public YardServiceImpl(ContenedorJpaRepository contenedorJpaRepository, AuditClient auditClient) {
        this.contenedorJpaRepository = contenedorJpaRepository;
        this.auditClient = auditClient;
    }

    /**
     * [Estrategia de Inicialización]
     * Al encender el microservicio, lee PostgreSQL en Docker y reconstruye
     * tu Lista Doble Manual en la RAM para mantener los punteros vivos.
     */
    @PostConstruct
    public void cargarDatosDesdeBaseDeDatos() {
        Thread.ofVirtual().start(() -> {
            lock.writeLock().lock();
            try {
                contenedorJpaRepository.findAll().forEach(listaDobleManual::insertarAlFinal);
                System.out.println(">>> LOGICORE: Lista Doble Manual reconstruida asíncronamente en RAM.");
            } finally {
                lock.writeLock().unlock();
            }
        });
    }

    @Override
    @Transactional
    public void registrarContenedor(Contenedor contenedor) {
        // FLUJO HÍBRIDO EN MEMORIA Y BASE DE DATOS:
        lock.writeLock().lock();
        try {
            contenedorJpaRepository.save(contenedor);
            listaDobleManual.insertarAlFinal(contenedor);
        } finally {
            lock.writeLock().unlock();
        }

        // Obtener la coordenada calculando la posición física en el patio
        String coordenada = "";
        lock.readLock().lock();
        try {
            int size = listaDobleManual.getTamaño();
            int idx = size > 0 ? size - 1 : 0;
            char row = (char) ('A' + (idx / 6));
            int col = (idx % 6) + 1;
            coordenada = "" + row + col;
        } finally {
            lock.readLock().unlock();
        }

        // Delegación de la mensajería asíncrona hacia el componente de infraestructura dedicado (SRP)
        auditClient.enviarLogAsync("REGISTRO_CONTENEDOR", "Bahía " + coordenada, contenedor.getCodigoID());
    }

    @Override
    public List<Contenedor> listarContenedoresIda() {
        lock.readLock().lock();
        try {
            List<Contenedor> lista = new ArrayList<>();
            NodoDoble<Contenedor> actual = listaDobleManual.getCabeza();

            while (actual != null) {
                lista.add(actual.getDato());
                actual = actual.getSiguiente();
            }
            return lista;
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public List<Contenedor> listarContenedoresVuelta() {
        lock.readLock().lock();
        try {
            List<Contenedor> lista = new ArrayList<>();
            NodoDoble<Contenedor> actual = listaDobleManual.getCola();

            while (actual != null) {
                lista.add(actual.getDato());
                actual = actual.getAnterior();
            }
            return lista;
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    @Transactional
    public void eliminarContenedor(String codigoId) {
        lock.writeLock().lock();
        try {
            NodoDoble<Contenedor> actual = listaDobleManual.getCabeza();
            while (actual != null) {
                if (actual.getDato().getCodigoID().equals(codigoId)) {
                    listaDobleManual.eliminarNodo(actual);
                    System.out.println(">>> LOGICORE: Contenedor [" + codigoId + "] removido de ListaDobleManual en RAM.");
                    break;
                }
                actual = actual.getSiguiente();
            }
        } finally {
            lock.writeLock().unlock();
        }
        contenedorJpaRepository.deleteById(codigoId);
        System.out.println(">>> LOGICORE: Contenedor [" + codigoId + "] eliminado físicamente de PostgreSQL.");
    }
}