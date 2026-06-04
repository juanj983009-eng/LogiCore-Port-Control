package com.logicore.audit.infrastructure.persistence;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Stack;

import org.springframework.stereotype.Service;

import com.logicore.audit.domain.entity.AuditLog;
import com.logicore.audit.domain.repository.AuditService;

import jakarta.annotation.PostConstruct;

@Service
public class AuditServiceImpl implements AuditService {

    // 1. Persistencia Híbrida: Estructura nativa en RAM + Respaldo en Docker
    private final Stack<AuditLog> auditStack = new Stack<>();
    private final AuditLogJpaRepository auditLogJpaRepository;

    // Inyección por constructor (Garantizando SOLID / Clean Code)
    public AuditServiceImpl(AuditLogJpaRepository auditLogJpaRepository) {
        this.auditLogJpaRepository = auditLogJpaRepository;
    }

    /**
     * [Estrategia de Inicialización]
     * Al levantar el servicio, recupera el histórico de PostgreSQL,
     * limpia la RAM y reconstruye el Stack cronológicamente para mantener el orden
     * LIFO.
     */
    @PostConstruct
    public void cargarHistorialDesdeBaseDeDatos() {
        auditStack.clear();
        List<AuditLog> persistidos = auditLogJpaRepository.findAll();

        for (AuditLog log : persistidos) {
            auditStack.push(log);
        }
        System.out.println(">>> LOGICORE: Pila Manual ($LIFO$) reconstruida en RAM con " + auditStack.size()
                + " eventos desde PostgreSQL.");
    }

    @Override
    public void registrarAccion(AuditLog log) {
        // A. Operación en RAM (Velocidad de respuesta)
        auditStack.push(log);

        // B. Operación en Docker (Respaldo permanente contra apagones)
        auditLogJpaRepository.save(log);
    }

    @Override
    public AuditLog deshacerUltimaAccion() {
        if (auditStack.isEmpty()) {
            return null;
        }
        // A. Removemos del tope de la Pila en memoria RAM (Lógica LIFO pura)
        AuditLog eliminado = auditStack.pop();

        // B. Lo borramos físicamente de PostgreSQL en Docker usando su PK (idLog)
        auditLogJpaRepository.deleteById(eliminado.getIdLog());
        System.out.println(
                ">>> LOGICORE: Última acción [" + eliminado.getIdLog() + "] deshecha y eliminada de PostgreSQL.");

        return eliminado;
    }

    @Override
    public List<AuditLog> obtenerHistorial() {
        // Clonamos el Stack a una lista y la invertimos para que el tope (lo más
        // reciente)
        // se muestre primero en la respuesta del API REST
        List<AuditLog> listaInvertida = new ArrayList<>(auditStack);
        Collections.reverse(listaInvertida);
        return listaInvertida;
    }
}