/**
 * AuditService - Domain Service Layer
 * Abstrae la comunicación de red con el backend de auditoría
 * y provee respuestas de negocio tipificadas.
 */

const AuditService = {
    /**
     * Envía la solicitud para deshacer la última acción registrada (LIFO).
     * @returns {Promise<Object>} El objeto JSON del log de auditoría eliminado.
     * @throws {Error} Con el mensaje de negocio correspondiente en caso de error HTTP o fallo de conexión.
     */
    async undoLastAction() {
        let response;
        try {
            response = await ApiClient.postUndo();
        } catch (error) {
            throw new Error("Error de transmisión: No se pudo conectar con el servicio de auditoría.");
        }

        if (response.status === 404) {
            const emptyError = new Error("No existen más transacciones para deshacer en el historial.");
            emptyError.status = 404;
            throw emptyError;
        }

        if (!response.ok) {
            let serverDetail = "";
            try {
                serverDetail = await response.text();
            } catch (_) {}
            const serverError = new Error(serverDetail || `Fallo crítico en el backend de auditoría (Código HTTP: ${response.status}).`);
            serverError.status = response.status;
            throw serverError;
        }

        try {
            return await response.json();
        } catch (jsonError) {
            throw new Error("Fallo de consistencia: La respuesta del servidor no tiene un formato JSON válido.");
        }
    }
};

if (typeof window !== 'undefined') {
    window.AuditService = AuditService;
}
if (typeof module !== 'undefined') {
    module.exports = AuditService;
}
