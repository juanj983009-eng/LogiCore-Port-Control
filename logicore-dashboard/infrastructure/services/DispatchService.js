/**
 * DispatchService - Domain Service Layer
 * Gestiona la lógica de negocio y las peticiones a la cola de despacho de camiones.
 */
const DispatchService = {
    /**
     * Encola un nuevo camión en la cola FIFO de espera.
     * @param {Object} camionData
     * @returns {Promise<Response>}
     */
    async encolarCamion(camionData) {
        let response;
        try {
            response = await ApiClient.registrarCamionEnCola(camionData);
        } catch (error) {
            throw new Error(`Error de transmisión: ${error.message}`);
        }

        if (!response.ok) {
            let detail = "";
            try {
                detail = await response.text();
            } catch (_) {}
            throw new Error(detail || `Fallo al encolar camión (Código HTTP: ${response.status}).`);
        }

        return response;
    },

    /**
     * Obtiene el listado de camiones en cola de despacho.
     * @returns {Promise<Array>}
     */
    async obtenerCola() {
        try {
            return await ApiClient.getDispatchTrucks();
        } catch (error) {
            throw new Error(error.message || "Error al obtener la cola de despacho.");
        }
    },

    /**
     * Despacha el siguiente camión en la cola.
     * @returns {Promise<Response>}
     */
    async despacharSiguiente() {
        let response;
        try {
            response = await ApiClient.deleteNextTruck();
        } catch (error) {
            throw new Error(`Error de transmisión: ${error.message}`);
        }

        if (response.status === 404) {
            const emptyError = new Error("No existen camiones en la cola de espera.");
            emptyError.status = 404;
            throw emptyError;
        }

        if (!response.ok) {
            let detail = "";
            try {
                detail = await response.text();
            } catch (_) {}
            throw new Error(detail || `Fallo al despachar camión (Código HTTP: ${response.status}).`);
        }

        return response;
    },

    /**
     * Elimina/reviene un camión de la cola mediante su placa.
     * @param {string} placa
     * @returns {Promise<Response>}
     */
    async eliminarCamion(placa) {
        let response;
        try {
            response = await ApiClient.deleteTruck(placa);
        } catch (error) {
            throw new Error(`Error de transmisión: ${error.message}`);
        }

        if (!response.ok) {
            let detail = "";
            try {
                detail = await response.text();
            } catch (_) {}
            throw new Error(detail || `Fallo al eliminar camión de la cola (Código HTTP: ${response.status}).`);
        }

        return response;
    }
};

if (typeof window !== 'undefined') {
    window.DispatchService = DispatchService;
}
if (typeof module !== 'undefined') {
    module.exports = DispatchService;
}
