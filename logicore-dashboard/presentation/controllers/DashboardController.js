/**
 * DashboardController - Presentation Layer
 * Coordinates UI events, implements event debouncing to protect memory structures,
 * and delegates data operations to ApiClient via lazy resolution.
 *
 * Resolution strategy: dependencies are resolved at first-use (not script-load)
 * to avoid undefined references caused by parallel script evaluation order.
 */

const DashboardController = {
    // Debounce state — protects backend memory structures from burst events
    actionLock: false,
    lockTimeout: null,

    /**
     * Lazy resolver for ApiClient.
     * Falls back through require → window.ApiClient → inline stub.
     * @returns {object} ApiClient singleton
     */
    getClient() {
        if (typeof require !== 'undefined') {
            return require('../../infrastructure/api/ApiClient.js');
        }
        const client = (typeof window !== 'undefined') && window.ApiClient;
        if (!client) {
            throw new Error('[DashboardController] ApiClient is not registered on window. Ensure infrastructure/api/ApiClient.js loads before this script.');
        }
        return client;
    },

    /**
     * Lazy resolver for YardHeatmap.
     * @returns {object} YardHeatmap module
     */
    getHeatmap() {
        if (typeof require !== 'undefined') {
            return require('../components/YardHeatmap.js');
        }
        const heatmap = (typeof window !== 'undefined') && window.YardHeatmap;
        if (!heatmap) {
            throw new Error('[DashboardController] YardHeatmap is not registered on window. Ensure presentation/components/YardHeatmap.js loads before this script.');
        }
        return heatmap;
    },

    /**
     * Fade-in animation for dynamically rendered list containers.
     * Delegates to Anime.js if available; degrades gracefully otherwise.
     * @param {string} selector - CSS selector of the target element.
     */
    _animeList(selector) {
        if (typeof window === 'undefined' || typeof window.anime !== 'function') return;
        const el = document.querySelector(selector);
        if (!el) return;
        window.anime({
            targets:  el,
            opacity:  [0, 1],
            duration: 380,
            easing:   'easeOutQuad'
        });
    },

    /**
     */
    acquireLock() {
        if (this.actionLock) {
            console.warn("[DashboardController] Event locked to prevent duplicate transit to Spring Boot memory structures.");
            return false;
        }
        this.actionLock = true;
        this.lockTimeout = setTimeout(() => {
            this.actionLock = false;
        }, 400); // 400ms debounce window
        return true;
    },

    /**
     * Initialize the controller and bind events.
     */
    async init() {
        console.log("[DashboardController] Initializing Presentation Layer v2...");
        
        // 1. Initial parallel fetch
        await this.reloadData();

        // 2. Bind Event Listeners with safety harness
        this.bindEvents();

        // 3. Hide loading screen immediately after Promise.all resolves
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('hidden');
            splash.classList.add('splash-hidden');
        }
    },

    async reloadData() {
        // Run in parallel
        await Promise.all([
            this.loadYard(),
            this.loadDispatch(),
            this.loadAudit()
        ]);
    },

    async loadYard() {
        const grid = document.getElementById("yard-heatmap");
        const list = document.getElementById("yard-list-ida");
        try {
            const containers = await this.getClient().getYardContainers("view");
            state.yard.data = containers;

            this.renderYardList(containers, list);
            this.getHeatmap().render(grid, containers);
            if (typeof window !== 'undefined' && window.DoubleLinkedListComponent) {
                window.DoubleLinkedListComponent.render(containers);
            }
        } catch (error) {
            console.error("[DashboardController] Error loading Yard:", error);
            state.yard.data = [];
            this.getHeatmap().render(grid, []);
            if (typeof window !== 'undefined' && window.DoubleLinkedListComponent) {
                window.DoubleLinkedListComponent.render([]);
            }
            if (list) list.innerHTML = crearEmptyState("fa-warehouse", "Patio listo · Lista Doble en espera");
            actualizarKPIs();
        }
    },

    renderYardList(containers, listElement) {
        if (!listElement) return;
        document.getElementById("yard-count").textContent = containers.length;

        if (containers.length === 0) {
            listElement.innerHTML = crearEmptyState("fa-boxes-stacked", "Patio vacío. Sin contenedores asignados.");
            actualizarKPIs();
            return;
        }

        const fragment = document.createDocumentFragment();
        containers.forEach((c, idx) => {
            const prioClass = getPriorityClass(c.prioridad || 0);
            const div = document.createElement("div");
            div.className = "item-card" + (idx === 0 ? " is-new" : "");
            div.setAttribute("role", "listitem");
            div.innerHTML = `
                <div class="item-card__left">
                    <span class="item-card__id">
                        <i class="fa-solid fa-box cyan" aria-hidden="true"></i>
                        ${escHtml(c.codigoId)}
                    </span>
                    <span class="item-card__sub">Dest: ${escHtml(c.destino)}</span>
                </div>
                <div class="item-card__right">
                    <span class="badge-weight">${(+c.peso).toFixed(1)} Tn</span>
                    <span class="badge-priority ${prioClass}">${getPriorityLabel(c.prioridad)}</span>
                </div>`;
            fragment.appendChild(div);
        });

        listElement.innerHTML = "";
        listElement.appendChild(fragment);
        actualizarKPIs();
    },

    async loadDispatch() {
        try {
            const trucks = await this.getClient().getDispatchTrucks();
            state.dispatch.data = trucks;
            renderizarColaDespacho();
            this._animeList('#dispatch-list');
            actualizarGrafico();
        } catch (error) {
            console.error("[DashboardController] Error loading Dispatch:", error);
            state.dispatch.data = [];
            renderizarColaDespacho();
            actualizarGrafico();
        }
    },

    async loadAudit() {
        try {
            const logs = await this.getClient().getAuditLogs();
            state.audit.data = logs;
            renderizarAuditoria();
            this._animeList('#audit-list');
        } catch (error) {
            console.error("[DashboardController] Error loading Audit:", error);
            state.audit.data = [];
            renderizarAuditoria();
        }
    },

    bindEvents() {
        // C. Double Linked List Navigation Toggle
        const btnListIda = document.getElementById("btn-list-ida");
        const btnListVuelta = document.getElementById("btn-list-vuelta");
        
        if (btnListIda && btnListVuelta) {
            btnListIda.addEventListener("click", () => {
                if (typeof window !== 'undefined' && window.DoubleLinkedListComponent) {
                    window.DoubleLinkedListComponent.currentDirection = 'IDA';
                    
                    // Style toggle
                    btnListIda.classList.add("active");
                    btnListIda.style.backgroundColor = "#0F172A";
                    btnListIda.style.color = "#FFFFFF";
                    btnListIda.style.borderColor = "#0F172A";
                    
                    btnListVuelta.classList.remove("active");
                    btnListVuelta.style.backgroundColor = "#FFFFFF";
                    btnListVuelta.style.color = "#475569";
                    btnListVuelta.style.borderColor = "#E2E8F0";
                    
                    // Metadata updates
                    const viewTitle = document.getElementById("list-view-title");
                    if (viewTitle) viewTitle.innerHTML = "VISTA IDA (CABEZA &rarr; COLA)";
                    
                    const routeType = document.getElementById("route-type");
                    if (routeType) routeType.innerHTML = "CABEZA &rarr; COLA";
                    
                    // Refresh data display
                    window.DoubleLinkedListComponent.render(state.yard.data || []);
                }
            });
            
            btnListVuelta.addEventListener("click", () => {
                if (typeof window !== 'undefined' && window.DoubleLinkedListComponent) {
                    window.DoubleLinkedListComponent.currentDirection = 'VUELTA';
                    
                    // Style toggle
                    btnListVuelta.classList.add("active");
                    btnListVuelta.style.backgroundColor = "#0F172A";
                    btnListVuelta.style.color = "#FFFFFF";
                    btnListVuelta.style.borderColor = "#0F172A";
                    
                    btnListIda.classList.remove("active");
                    btnListIda.style.backgroundColor = "#FFFFFF";
                    btnListIda.style.color = "#475569";
                    btnListIda.style.borderColor = "#E2E8F0";
                    
                    // Metadata updates
                    const viewTitle = document.getElementById("list-view-title");
                    if (viewTitle) viewTitle.innerHTML = "VISTA VUELTA (COLA &rarr; CABEZA)";
                    
                    const routeType = document.getElementById("route-type");
                    if (routeType) routeType.innerHTML = "COLA &rarr; CABEZA";
                    
                    // Refresh data display
                    window.DoubleLinkedListComponent.render(state.yard.data || []);
                }
            });
        }

        // A. Form Yard Submission
        const formYard = document.getElementById("form-yard");
        if (formYard) {
            // Remove old listener by cloning or we can just replace it
            const newForm = formYard.cloneNode(true);
            formYard.parentNode.replaceChild(newForm, formYard);

            newForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                if (!this.acquireLock()) return;

                const btn = document.getElementById("btn-yard-submit");
                setLoadingState(btn, true);

                const containerData = {
                    codigoId:  document.getElementById("yard-id").value.trim().toUpperCase(),
                    destino:   document.getElementById("yard-destino").value.trim().toUpperCase(),
                    peso:      parseFloat(document.getElementById("yard-peso").value)    || 0.0,
                    prioridad: parseInt(document.getElementById("yard-prioridad").value) || 1
                };

                try {
                    const res = await this.getClient().postContainer(containerData);
                    if (res.ok) {
                        newForm.reset();
                        await this.reloadData();
                        showToast("success", "Contenedor Ingresado", `${containerData.codigoId} → ${containerData.destino}`);
                    } else {
                        const msg = await res.text();
                        showToast("warning", "Aviso del Patio", msg);
                    }
                } catch (error) {
                    console.error("[DashboardController] Error POST Yard:", error);
                    showToast("error", error.message.includes("[Compilation Block Alert]") ? "Error de Validación" : "Sin Conexión", error.message);
                } finally {
                    setLoadingState(btn, false);
                }
            });
        }

        // B. Form Dispatch Submission
        const repository = this.getClient();
        const formDispatch = document.getElementById("form-dispatch");
        if (formDispatch) {
            const newForm = formDispatch.cloneNode(true);
            formDispatch.parentNode.replaceChild(newForm, formDispatch);

            newForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                if (!this.acquireLock()) return;

                const btn = document.getElementById("btn-enqueue");
                setLoadingState(btn, true);

                const truckData = {
                    placa:          document.getElementById("dispatch-placa").value.trim().toUpperCase(),
                    conductor:      document.getElementById("dispatch-conductor").value.trim(),
                    tipoCarga:      document.getElementById("dispatch-carga").value.trim().toUpperCase(),
                    ordenPrioridad: parseInt(document.getElementById("dispatch-prioridad").value) || 1
                };

                try {
                    const res = await repository.registrarCamionEnCola(truckData);
                    if (res.ok) {
                        newForm.reset();
                        state.dispatch.page = 0;
                        await this.reloadData();

                        if (truckData.tipoCarga === "HAZMAT" || truckData.ordenPrioridad === 1) {
                            registrarAlerta("ENCOLADO", truckData);
                        }
                        showToast("success", "Camión Encolado", `${truckData.placa} · P${truckData.ordenPrioridad}`);
                    } else {
                        const msg = await res.text();
                        showToast("error", "Error Operativo", msg);
                    }
                } catch (error) {
                    console.error("[DashboardController] Error POST Dispatch:", error);
                    showToast("error", error.message.includes("[Compilation Block Alert]") ? "Error de Validación" : "Sin Conexión", error.message);
                } finally {
                    setLoadingState(btn, false);
                }
            });
        }

        // C. Dispatch Next Button
        const btnDispatchNext = document.getElementById("btn-dispatch-next");
        if (btnDispatchNext) {
            const newBtn = btnDispatchNext.cloneNode(true);
            btnDispatchNext.parentNode.replaceChild(newBtn, btnDispatchNext);

            newBtn.addEventListener("click", async () => {
                if (!this.acquireLock()) return;
                setLoadingState(newBtn, true);

                try {
                    const res = await this.getClient().deleteNextTruck();
                    if (res.status === 404) {
                        showToast("warning", "Cola Vacía", "No existen camiones en la cola de espera.");
                        return;
                    }
                    if (res.ok) {
                        const atendido = await res.json();
                        if ((atendido.tipoCarga || "").toUpperCase() === "HAZMAT" || atendido.ordenPrioridad === 1) {
                            registrarAlerta("DESPACHADO", atendido);
                        }
                        await this.reloadData();
                        showToast("info", "Camión Despachado", `Placa: ${atendido.placa} · Conductor: ${atendido.conductor}`);
                    }
                } catch (error) {
                    console.error("[DashboardController] Error Dispatch Next:", error);
                    showToast("error", "Sin Conexión", "Error al despachar el camión.");
                } finally {
                    setLoadingState(newBtn, false);
                }
            });
        }

        // D. Undo Button
        const btnAuditUndo = document.getElementById("btn-audit-undo");
        if (btnAuditUndo) {
            const newBtn = btnAuditUndo.cloneNode(true);
            btnAuditUndo.parentNode.replaceChild(newBtn, btnAuditUndo);

            newBtn.addEventListener("click", async () => {
                if (!this.acquireLock()) return;
                setLoadingState(newBtn, true);

                try {
                    const res = await this.getClient().postUndo();
                    if (res.status === 404) {
                        showToast("warning", "Pila Vacía", "No quedan acciones por revertir en la Pila LIFO.");
                        return;
                    }
                    if (res.ok) {
                        const log = await res.json();
                        await this.reloadData();
                        showToast("success", "Acción Revertida", `Tipo: ${log.tipoAccion}`);
                    }
                } catch (error) {
                    console.error("[DashboardController] Error Undo:", error);
                    showToast("error", "Sin Conexión", "Error al revertir la acción.");
                } finally {
                    setLoadingState(newBtn, false);
                }
            });
        }
    }
};

if (typeof window !== 'undefined') {
    window.DashboardController = DashboardController;
}
if (typeof module !== 'undefined') {
    module.exports = DashboardController;
}
