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
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Service
public class YardServiceImpl implements YardService {

    private final ListaDobleManual<Contenedor> listaDobleManual = new ListaDobleManual<>();
    private final ContenedorJpaRepository contenedorJpaRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    @Value("${app.services.audit.url}")
    private String urlAuditoria;

    // Inyección por constructor optimizada (SOLID / Clean Code)
    public YardServiceImpl(ContenedorJpaRepository contenedorJpaRepository, RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.contenedorJpaRepository = contenedorJpaRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
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

    private void reportarAuditoria(String accion, Contenedor contenedor) {
        Thread.ofVirtual().start(() -> {
            try {
                ObjectNode payloadNode = objectMapper.createObjectNode();
                payloadNode.put("codigoID", contenedor.getCodigoID());
                payloadNode.put("destino", contenedor.getDestino());

                ObjectNode requestBody = objectMapper.createObjectNode();
                requestBody.put("idLog", "AUD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                requestBody.put("tipoAccion", accion);
                requestBody.put("microservicio", "YARD");
                requestBody.put("payload", objectMapper.writeValueAsString(payloadNode));

                restTemplate.postForEntity(urlAuditoria, requestBody, String.class);
                System.out.println(">>> LOGICORE: Log de patio automatizado enviado con éxito al puerto 8083.");
            } catch (Exception e) {
                System.err.println(">>> LOGICORE [WARN]: No se pudo automatizar log de auditoría del patio. Detalle: "
                        + e.getMessage());
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

        reportarAuditoria("REGISTRO_CONTENEDOR", contenedor);
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
}