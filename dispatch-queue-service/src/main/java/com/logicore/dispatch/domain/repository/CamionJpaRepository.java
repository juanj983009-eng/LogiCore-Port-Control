package com.logicore.dispatch.domain.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.logicore.dispatch.domain.entity.Camion;

@Repository
public interface CamionJpaRepository extends JpaRepository<Camion, String> {
}