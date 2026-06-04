package com.logicore.dispatch.domain.repository;
import java.util.List;

import com.logicore.dispatch.domain.entity.Camion;

public interface DispatchService {
    // Operaciones de la Cola FIFO (Camiones)
    void encolarCamion(Camion camion);

    Camion atenderSiguiente();

    List<Camion> listarCola();
}