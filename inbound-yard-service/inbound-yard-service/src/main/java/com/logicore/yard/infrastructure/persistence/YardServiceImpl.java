package com.logicore.yard.infrastructure.persistence;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.logicore.yard.domain.entity.Contenedor;
import com.logicore.yard.domain.repository.ContenedorJpaRepository;
import com.logicore.yard.domain.repository.YardService;
import com.logicore.yard.structure.ListaDobleManual;
import com.logicore.yard.structure.NodoDoble;

import jakarta.annotation.PostConstruct;

@Service
public class YardServiceImpl implements YardService {

    private final ListaDobleManual listaDobleManual = new ListaDobleManual();
    private final ContenedorJpaRepository contenedorJpaRepository;
    private final RestTemplate restTemplate;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    @Value("${app.services.audit.url}")
    private String urlAuditoria;

    // Inyección por constructor optimizada (SOLID / Clean Code)
    public YardServiceImpl(ContenedorJpaRepository contenedorJpaRepository, RestTemplate restTemplate) {
        this.contenedorJpaRepository = contenedorJpaRepository;
        this.restTemplate = restTemplate;
    }

    /**
     * [Estrategia de Inicialización]
     * Al encender el microservicio, lee PostgreSQL en Docker y reconstruye
     * tu Lista Doble Manual en la RAM para mantener los punteros vivos.
     */
    @PostConstruct
    public void cargarDatosDesdeBaseDeDatos() {
        lock.writeLock().lock();
        try {
            List<Contenedor> persistidos = contenedorJpaRepository.findAll();
            for (Contenedor c : persistidos) {
                listaDobleManual.insertarAlFinal(c);
            }
            System.out.println(
                    ">>> LOGICORE: Lista Doble Manual reconstruida en RAM con " + persistidos.size() + " contenedores.");
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public void registrarContenedor(Contenedor contenedor) {
        // FLUJO HÍBRIDO EN MEMORIA Y BASE DE DATOS:
        lock.writeLock().lock();
        try {
            listaDobleManual.insertarAlFinal(contenedor);
        } finally {
            lock.writeLock().unlock();
        }
        contenedorJpaRepository.save(contenedor);

        // =========================================================================
        // AUTOMATIZACIÓN 3: Disparar reporte automático a Auditoría (8083) usando Virtual Threads
        // =========================================================================
        Thread.ofVirtual().start(() -> {
            try {
                // Armamos el mapa con la estructura exacta que espera la entidad AuditLog
                Map<String, String> requestBody = new HashMap<>();
                requestBody.put("idLog", "AUD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                requestBody.put("tipoAccion", "REGISTRO_CONTENEDOR");
                requestBody.put("microservicio", "YARD");

                // Usamos getters basados en codigoID y destino
                requestBody.put("payload", "{\"codigoID\":\"" + contenedor.getCodigoID() + "\",\"destino\":\""
                        + contenedor.getDestino() + "\"}");

                // Enviamos el POST directo al microservicio de auditoría
                restTemplate.postForEntity(urlAuditoria, requestBody, String.class);
                System.out.println(">>> LOGICORE: Log de patio automatizado enviado con éxito al puerto 8083.");

            } catch (Exception e) {
                // Tolerancia a fallos: Si auditoría está offline, el flujo logístico del patio
                // no se detiene
                System.err.println(">>> LOGICORE [WARN]: No se pudo automatizar log de auditoría del patio. Detalle: "
                        + e.getMessage());
            }
        });
    }

    @Override
    public List<Contenedor> listarContenedoresIda() {
        lock.readLock().lock();
        try {
            List<Contenedor> lista = new ArrayList<>();
            NodoDoble actual = listaDobleManual.getCabeza();

            while (actual != null) {
                lista.add((Contenedor) actual.getDato());
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
            NodoDoble actual = listaDobleManual.getCola();

            while (actual != null) {
                lista.add((Contenedor) actual.getDato());
                actual = actual.getAnterior();
            }
            return lista;
        } finally {
            lock.readLock().unlock();
        }
    }
}