package com.logicore.dispatch.infrastructure.persistence;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.logicore.dispatch.domain.entity.Camion;
import com.logicore.dispatch.domain.repository.CamionJpaRepository;
import com.logicore.dispatch.domain.repository.DispatchService;
import com.logicore.dispatch.structure.ColaManual;
import com.logicore.dispatch.structure.NodoSimple;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import jakarta.annotation.PostConstruct;

@Service
public class DispatchServiceImpl implements DispatchService {

    //  Atributos e Inyecciones de la Cola (FIFO)
    private final ColaManual<Camion> colaManual = new ColaManual<>();
    private final CamionJpaRepository camionJpaRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    @Value("${app.services.audit.url}")
    private String urlAuditoria;

    // Constructor único para inyección de dependencias (Clean Code / SOLID)
    public DispatchServiceImpl(CamionJpaRepository camionJpaRepository, RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.camionJpaRepository = camionJpaRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * [Estrategia de Inicialización]
     * Al levantar el microservicio, reconstruye la Cola FIFO en RAM desde SQL Server.
     */
    @PostConstruct
    public void cargarDatosDesdeBaseDeDatos() {
        lock.writeLock().lock();
        try {
            List<Camion> persistidos = camionJpaRepository.findAll();
            for (Camion c : persistidos) {
                colaManual.enqueue(c);
            }
            System.out.println(">>> LOGICORE: Cola Manual ($FIFO$) reconstruida en RAM con " + persistidos.size()
                    + " camiones desde SQL Server.");
        } finally {
            lock.writeLock().unlock();
        }
    }

    // =========================================================================
    //  IMPLEMENTACIÓN: MÉTODOS DE LA COLA DE CAMIONES
    // =========================================================================

    private void reportarAuditoria(String accion, Camion camion) {
        Thread.ofVirtual().start(() -> {
            try {
                ObjectNode payloadNode = objectMapper.createObjectNode();
                payloadNode.put("placa", camion.getPlaca());
                payloadNode.put("conductor", camion.getConductor());

                ObjectNode requestBody = objectMapper.createObjectNode();
                requestBody.put("idLog", "AUD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                requestBody.put("tipoAccion", accion);
                requestBody.put("microservicio", "DISPATCH");
                requestBody.put("payload", objectMapper.writeValueAsString(payloadNode));

                restTemplate.postForEntity(urlAuditoria, requestBody, String.class);
                System.out.println(">>> LOGICORE: Log de despacho automatizado enviado al puerto 8083.");
            } catch (Exception e) {
                System.err.println(">>> LOGICORE [WARN]: Fallo de reporte en despacho: " + e.getMessage());
            }
        });
    }

    @Override
    public void encolarCamion(Camion camion) {
        lock.writeLock().lock();
        try {
            colaManual.enqueue(camion);
        } finally {
            lock.writeLock().unlock();
        }
        camionJpaRepository.save(camion);

        reportarAuditoria("ENCOLAR_CAMION", camion);
    }

    @Override
    public Camion atenderSiguiente() {
        Camion atendido;
        lock.writeLock().lock();
        try {
            atendido = colaManual.dequeue();
        } finally {
            lock.writeLock().unlock();
        }

        if (atendido != null) {
            camionJpaRepository.deleteById(atendido.getPlaca());
            System.out.println(">>> LOGICORE: Camión " + atendido.getPlaca() + " removido de SQL Server.");

            reportarAuditoria("ATENDER_CAMION", atendido);
        }
        return atendido;
    }

    @Override
    public List<Camion> listarCola() {
        lock.readLock().lock();
        try {
            List<Camion> lista = new ArrayList<>();
            NodoSimple<Camion> actual = colaManual.getFrente();

            while (actual != null) {
                lista.add(actual.getDato());
                actual = actual.getSiguiente();
            }
            return lista;
        } finally {
            lock.readLock().unlock();
        }
    }
}