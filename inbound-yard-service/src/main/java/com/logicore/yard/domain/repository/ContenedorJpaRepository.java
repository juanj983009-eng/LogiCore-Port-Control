package com.logicore.yard.domain.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.logicore.yard.domain.entity.Contenedor;

@Repository
public interface ContenedorJpaRepository extends JpaRepository<Contenedor, String> {
    // String representa el tipo de dato de nuestro @Id (codigoID)
}