package com.logicore.yard.infrastructure.rest.client;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Component
public class AuditClient {
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String auditUrl = "http://audit-service:8083/api/v1/audit/logs";

    public void enviarLogAsync(String accion, String destino, String codigoID) {
        Thread.ofVirtual().start(() -> {
            try {
                // 1. Construir el payload JSON interno con la estructura requerida por el frontend
                ObjectNode payloadNode = objectMapper.createObjectNode();
                payloadNode.put("codigoID", codigoID);
                payloadNode.put("destino", destino);
                String payloadStr = objectMapper.writeValueAsString(payloadNode);

                // 2. Construir el cuerpo de la petición para el microservicio de auditoría
                ObjectNode requestBody = objectMapper.createObjectNode();
                requestBody.put("idLog", "AUD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                requestBody.put("tipoAccion", accion);
                requestBody.put("microservicio", "YARD");
                requestBody.put("payload", payloadStr);

                // 3. Ejecutar llamada POST HTTP asíncrona hacia el servicio de auditoría
                restTemplate.postForEntity(auditUrl, requestBody, String.class);
                System.out.println(">>> LOGICORE LOG INYECTADO ASÍNCRONAMENTE EN YARD: " + accion);
            } catch (Exception e) {
                System.err.println(">>> LOGICORE [WARN] Falla al reportar auditoría desde Yard: " + e.getMessage());
            }
        });
    }
}
