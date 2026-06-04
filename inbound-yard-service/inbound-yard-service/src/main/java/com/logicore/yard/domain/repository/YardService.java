package com.logicore.yard.domain.repository;
import java.util.List;

import com.logicore.yard.domain.entity.Contenedor;

public interface YardService {
    void registrarContenedor(Contenedor contenedor);

    List<Contenedor> listarContenedoresIda();

    List<Contenedor> listarContenedoresVuelta();
}