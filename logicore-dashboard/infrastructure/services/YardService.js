/**
 * YardService - Domain Service Layer
 * Gestiona la lógica de negocio y las peticiones al patio de contenedores.
 */
const YardService = {
    /**
     * Registra el ingreso de un contenedor en el patio.
     * @param {Object} contenedorData
     * @returns {Promise<Response>}
     */
    async ingresarAlPatio(contenedorData) {
        let response;
        try {
            response = await ApiClient.postContainer(contenedorData);
        } catch (error) {
            throw new Error(`Error de transmisión: ${error.message}`);
        }

        if (!response.ok) {
            let detail = "";
            try {
                detail = await response.text();
            } catch (_) {}
            throw new Error(detail || `Fallo al ingresar contenedor (Código HTTP: ${response.status}).`);
        }

        return response;
    },

    /**
     * Obtiene el listado actual de contenedores del patio.
     * @returns {Promise<Array>}
     */
    async obtenerEstadoPatio() {
        try {
            return await ApiClient.getYardContainers("view");
        } catch (error) {
            throw new Error(error.message || "Error al obtener el estado del patio.");
        }
    },

    /**
     * Retira un contenedor del patio.
     * @param {string} codigoId
     * @returns {Promise<Response>}
     */
    async retirarContenedor(codigoId) {
        let response;
        try {
            response = await ApiClient.deleteContainer(codigoId);
        } catch (error) {
            throw new Error(`Error de transmisión: ${error.message}`);
        }

        if (!response.ok) {
            let detail = "";
            try {
                detail = await response.text();
            } catch (_) {}
            throw new Error(detail || `Fallo al retirar contenedor (Código HTTP: ${response.status}).`);
        }

        return response;
    }
};

if (typeof window !== 'undefined') {
    window.YardService = YardService;
}
if (typeof module !== 'undefined') {
    module.exports = YardService;
}
