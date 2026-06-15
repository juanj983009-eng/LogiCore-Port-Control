package com.logicore.audit.infrastructure.persistence;
import java.util.List;

import org.springframework.stereotype.Service;

import com.logicore.audit.domain.entity.AuditLog;
import com.logicore.audit.domain.repository.AuditService;
import com.logicore.audit.structure.PilaManual;

import jakarta.annotation.PostConstruct;

@Service
public class AuditServiceImpl implements AuditService {

    // 1. Persistencia Híbrida: Estructura manual en RAM + Respaldo en Docker
    private final PilaManual<AuditLog> auditStack = new PilaManual<>();
    private final AuditLogJpaRepository auditLogJpaRepository;

    // Inyección por constructor (Garantizando SOLID / Clean Code)
    public AuditServiceImpl(AuditLogJpaRepository auditLogJpaRepository) {
        this.auditLogJpaRepository = auditLogJpaRepository;
    }

    /**
     * [Estrategia de Inicialización]
     * Al levantar el servicio, recupera el histórico de PostgreSQL ordenado cronológicamente,
     * limpia la RAM y reconstruye el Stack de forma asíncrona mediante un hilo virtual.
     */
    @PostConstruct
    public void cargarHistorialDesdeBaseDeDatos() {
        Thread.ofVirtual().start(() -> {
            auditStack.clear();
            List<AuditLog> persistidos = auditLogJpaRepository.findAllByOrderByFechaCreacionAsc();

            for (AuditLog log : persistidos) {
                auditStack.push(log);
            }
            System.out.println(">>> LOGICORE: Pila Manual ($LIFO$) reconstruida asíncronamente en RAM con " 
                    + auditStack.getTamaño() + " eventos desde PostgreSQL.");
        });
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
        if (auditStack.estaVacia()) {
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
        // Utiliza la estructura manual toElementList para volcar los datos de forma segura
        return auditStack.toElementList();
    }
}