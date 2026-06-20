package com.logicore.audit.infrastructure.persistence;
import java.util.List;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import org.springframework.stereotype.Service;

import com.logicore.audit.domain.entity.AuditLog;
import com.logicore.audit.domain.repository.AuditService;
import com.logicore.shared.structure.PilaManual;

import jakarta.annotation.PostConstruct;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditServiceImpl implements AuditService {

    // 1. Persistencia Híbrida: Estructura manual en RAM + Respaldo en Docker
    private final PilaManual<AuditLog> auditStack = new PilaManual<>();
    private final AuditLogJpaRepository auditLogJpaRepository;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    // Inyección por constructor (Garantizando SOLID / Clean Code)
    public AuditServiceImpl(AuditLogJpaRepository auditLogJpaRepository) {
        this.auditLogJpaRepository = auditLogJpaRepository;
    }

    /**
     * [Estrategia de Inicialización]
     * Al levantar el servicio, recupera los últimos 100 logs de auditoría ordenados por fecha de creación desc,
     * limpia la RAM y reconstruye el Stack de forma asíncrona mediante un hilo virtual en orden cronológico inverso.
     */
    @PostConstruct
    public void cargarHistorialDesdeBaseDeDatos() {
        Thread.ofVirtual().start(() -> {
            lock.writeLock().lock();
            try {
                auditStack.clear();
                List<AuditLog> persistidos = auditLogJpaRepository.findTop100ByOrderByFechaCreacionDesc();

                // Para conservar el orden LIFO (último en entrar, primero en salir),
                // recorremos la lista desc en orden inverso (de los más antiguos a los más recientes) para ingresarlos a la pila
                for (int i = persistidos.size() - 1; i >= 0; i--) {
                    auditStack.push(persistidos.get(i));
                }
                System.out.println(">>> LOGICORE: Pila Manual ($LIFO$) reconstruida asíncronamente en RAM con los últimos " 
                        + auditStack.getTamaño() + " eventos desde PostgreSQL.");
            } finally {
                lock.writeLock().unlock();
            }
        });
    }

    @Override
    public void registrarAccion(AuditLog log) {
        // A. Operación en RAM protegida contra escritura concurrente
        lock.writeLock().lock();
        try {
            auditStack.push(log);
        } finally {
            lock.writeLock().unlock();
        }

        // B. Operación en Docker (Respaldo permanente contra apagones)
        auditLogJpaRepository.save(log);
    }

    @Transactional
    @Override
    public AuditLog deshacerUltimaAccion() {
        lock.writeLock().lock();
        try {
            // Control de Pila Vacía
            if (auditStack.isEmpty()) {
                return null;
            }

            AuditLog aEliminar = auditStack.getTope().getDato();
            if (aEliminar == null || aEliminar.getIdLog() == null) {
                auditStack.pop();
                return null;
            }

            // A. Borramos físicamente de PostgreSQL en Docker usando su PK (idLog) antes de mutar la RAM
            if (auditLogJpaRepository.existsById(aEliminar.getIdLog())) {
                auditLogJpaRepository.deleteById(aEliminar.getIdLog());
            }

            // B. Si la base de datos se actualizó correctamente, procedemos a remover del tope de la Pila en RAM (LIFO)
            AuditLog eliminado = auditStack.pop();
            System.out.println(
                    ">>> LOGICORE: Última acción [" + eliminado.getIdLog() + "] deshecha y eliminada de PostgreSQL.");
            return eliminado;
        } catch (Exception e) {
            System.err.println(">>> LOGICORE ERROR: Falló la persistencia al deshacer la acción. La Pila en RAM permanece intacta.");
            throw e;
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public List<AuditLog> obtenerHistorial() {
        // Operación de lectura protegida contra modificaciones concurrentes
        lock.readLock().lock();
        try {
            return auditStack.toElementList();
        } finally {
            lock.readLock().unlock();
        }
    }
}