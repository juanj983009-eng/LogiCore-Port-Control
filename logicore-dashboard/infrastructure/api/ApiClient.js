/**
 * LogiCore API Client - Infrastructure Layer
 * Centralizes HTTP requests to the backend services.
 * Integrates client-side validation using validateDTO to prevent malformed payloads.
 */

// Handle import dynamic for Node environments vs browser environments
let _validateDTO;
if (typeof require !== 'undefined') {
    const validation = require('../../validation.js');
    _validateDTO = validation.validateDTO;
} else if (typeof window !== 'undefined' && window.validateDTO) {
    _validateDTO = window.validateDTO;
} else {
    // Fallback if not globally loaded yet
    _validateDTO = (schemaKey, data) => {
        if (typeof validateDTO !== 'undefined') {
            return validateDTO(schemaKey, data);
        }
        console.warn("[ApiClient] validateDTO is not loaded. Skipping safety check.");
        return true;
    };
}

const ApiClient = {
    // Configurable base URLs for the microservices
    config: {
        yardBaseUrl: "http://127.0.0.1:8081/api/v1/yard/containers",
        dispatchBaseUrl: "http://127.0.0.1:8082/api/v1/dispatch/trucks",
        auditBaseUrl: "http://127.0.0.1:8083/api/v1/audit/logs"
    },

    /**
     * Send a POST request to Yard Service after validating the payload.
     */
    async postContainer(containerData) {
        // Intercept and validate the payload against ContenedorRequestDTO
        _validateDTO("ContenedorRequestDTO", containerData);

        const response = await fetch(this.config.yardBaseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(containerData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        return response;
    },

    /**
     * Send a POST request to Dispatch Service after validating the payload.
     */
    async registrarCamionEnCola(truckData) {
        // Intercept and validate the payload against CamionRequestDTO
        _validateDTO("CamionRequestDTO", truckData);

        const response = await fetch(this.config.dispatchBaseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(truckData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        return response;
    },

    /**
     * Send a POST request to Audit Service after validating the payload.
     */
    async postAudit(auditData) {
        // Intercept and validate the payload against AuditLogRequestDTO
        _validateDTO("AuditLogRequestDTO", auditData);

        const response = await fetch(this.config.auditBaseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(auditData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        return response;
    },

    /**
     * Send an undo request to the Audit Service.
     */
    async postUndo() {
        const response = await fetch(`${this.config.auditBaseUrl}/undo`, {
            method: "POST"
        });
        return response;
    },

    /**
     * Get containers from Yard Service.
     */
    async getYardContainers(view = "view") {
        const response = await fetch(`${this.config.yardBaseUrl}/${view}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    },

    /**
     * Get trucks from Dispatch Service.
     */
    async getDispatchTrucks() {
        const response = await fetch(`${this.config.dispatchBaseUrl}/view`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    },

    /**
     * Get audit logs from Audit Service.
     */
    async getAuditLogs() {
        const response = await fetch(this.config.auditBaseUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    },

    /**
     * Dispatch the next truck from the queue.
     */
    async deleteNextTruck() {
        const response = await fetch(`${this.config.dispatchBaseUrl}/next`, {
            method: "DELETE"
        });
        return response;
    }
};

if (typeof window !== 'undefined') {
    window.ApiClient = ApiClient;
}
if (typeof module !== 'undefined') {
    module.exports = ApiClient;
}
