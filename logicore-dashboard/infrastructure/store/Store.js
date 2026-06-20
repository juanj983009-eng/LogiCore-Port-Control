/**
 * Store - Centralized Reactive State Management (Observer Pattern)
 * Unifica el estado de LogiCore y provee suscripción reactiva a cambios.
 */
class StoreClass {
    constructor() {
        this.state = {
            dispatch: { data: [], page: 0 },
            audit:    { data: [], page: 0 },
            yard:     { data: [] },
            alerts:   []
        };
        this.listeners = {};
    }

    /**
     * Obtiene el estado actual completo.
     * @returns {Object}
     */
    getState() {
        return this.state;
    }

    /**
     * Registra un callback interesado en cambios de un evento específico.
     * @param {string} event 
     * @param {Function} callback 
     * @returns {Function} Función para desuscribirse
     */
    subscribe(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        
        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        };
    }

    /**
     * Publica/Notifica un cambio a todos los componentes suscritos al evento.
     * @param {string} event 
     * @param {*} data 
     */
    publish(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`[Store] Error al notificar suscriptor del evento "${event}":`, e);
                }
            });
        }
    }

    /**
     * Actualiza la data del patio y notifica el evento 'yard_changed'.
     * @param {Array} newData 
     */
    updateYard(newData) {
        this.state.yard.data = newData;
        this.publish("yard_changed", this.state.yard.data);
    }

    /**
     * Actualiza la data de la cola de despacho y notifica el evento 'dispatch_changed'.
     * @param {Array} newData 
     */
    updateDispatch(newData) {
        this.state.dispatch.data = newData;
        this.publish("dispatch_changed", this.state.dispatch.data);
    }

    /**
     * Actualiza el historial de auditoría y notifica el evento 'audit_changed'.
     * @param {Array} newData 
     */
    updateAudit(newData) {
        this.state.audit.data = newData;
        this.publish("audit_changed", this.state.audit.data);
    }

    /**
     * Actualiza el listado de alertas y notifica el evento 'alerts_changed'.
     * @param {Array} newData 
     */
    updateAlerts(newData) {
        this.state.alerts = newData;
        this.publish("alerts_changed", this.state.alerts);
    }

    /**
     * Cambia la página de la cola de despacho y notifica el cambio.
     * @param {number} page 
     */
    setDispatchPage(page) {
        this.state.dispatch.page = page;
        this.publish("dispatch_page_changed", this.state.dispatch.page);
    }

    /**
     * Cambia la página de la auditoría y notifica el cambio.
     * @param {number} page 
     */
    setAuditPage(page) {
        this.state.audit.page = page;
        this.publish("audit_page_changed", this.state.audit.page);
    }
}

const Store = new StoreClass();

if (typeof window !== 'undefined') {
    window.Store = Store;
    // Alias global para compatibilidad con código existente
    window.state = Store.state;
}
if (typeof module !== 'undefined') {
    module.exports = Store;
}
