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
        
        // Subscribe observers to the Store for reactive UI rendering
        Store.subscribe("yard_changed", (containers) => {
            const grid = document.getElementById("yard-heatmap");
            const list = document.getElementById("yard-list-ida");
            this.renderYardList(containers, list);
            this.getHeatmap().render(grid, containers);
            if (typeof window !== 'undefined' && window.DoubleLinkedListComponent) {
                window.DoubleLinkedListComponent.render(containers);
            }
            actualizarKPIs();
        });

        Store.subscribe("dispatch_changed", () => {
            renderizarColaDespacho();
            actualizarGrafico();
            actualizarKPIs();
        });

        Store.subscribe("audit_changed", (logs) => {
            if (window.rebuildPilaAuditoria) {
                window.rebuildPilaAuditoria(logs);
            }
            renderizarAuditoria();
            actualizarKPIs();
        });

        // Render empty heatmap immediately to avoid blank space on startup
        const grid = document.getElementById("yard-heatmap");
        if (grid) {
            this.getHeatmap().render(grid, []);
        }

        // 1. Initial parallel fetch
        await this.reloadData();

        // 2. Bind Event Listeners with safety harness
        this.bindEvents();
    },

    async reloadData(silent = false) {
        // Run in parallel
        await Promise.all([
            this.loadYard(silent),
            this.loadDispatch(silent),
            this.loadAudit(silent)
        ]);
    },

    async loadYard(silent = false) {
        try {
            const containers = await YardService.obtenerEstadoPatio();
            Store.updateYard(containers);
        } catch (error) {
            console.error("[DashboardController] Error loading Yard:", error);
            Store.updateYard([]);
            const list = document.getElementById("yard-list-ida");
            if (list) list.innerHTML = crearEmptyState("fa-warehouse", "Patio listo · Lista Doble en espera");
        }
    },

    renderYardList(containers, listElement) {
        if (!listElement) return;
        const yardCountEl = document.getElementById("yard-count");
        if (yardCountEl) yardCountEl.textContent = containers.length;

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

    async loadDispatch(silent = false) {
        try {
            const trucks = await DispatchService.obtenerCola();
            Store.updateDispatch(trucks);
        } catch (error) {
            console.error("[DashboardController] Error loading Dispatch:", error);
            Store.updateDispatch([]);
        }
    },

    async loadAudit(silent = false) {
        try {
            const logs = await ApiClient.getAuditLogs();
            Store.updateAudit(logs);
        } catch (error) {
            console.error("[DashboardController] Error loading Audit:", error);
            Store.updateAudit([]);
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
                    btnListIda.style.backgroundColor = "#0f2527";
                    btnListIda.style.color = "#ffffff";
                    btnListIda.style.borderColor = "#0f2527";
                    
                    btnListVuelta.classList.remove("active");
                    btnListVuelta.style.backgroundColor = "transparent";
                    btnListVuelta.style.color = "#0f2527";
                    btnListVuelta.style.borderColor = "rgba(15,37,39,0.3)";
                    
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
                    btnListVuelta.style.backgroundColor = "#0f2527";
                    btnListVuelta.style.color = "#ffffff";
                    btnListVuelta.style.borderColor = "#0f2527";
                    
                    btnListIda.classList.remove("active");
                    btnListIda.style.backgroundColor = "transparent";
                    btnListIda.style.color = "#0f2527";
                    btnListIda.style.borderColor = "rgba(15,37,39,0.3)";
                    
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
                    const res = await YardService.ingresarAlPatio(containerData);
                    if (res.ok) {
                        newForm.reset();
                        
                        // 1. Inyección reactiva a través del Store
                        const updatedYard = [...Store.getState().yard.data, containerData];
                        Store.updateYard(updatedYard);
                        
                        const idx = updatedYard.length - 1;
                        const rowChar = ["A", "B", "C", "D", "E"][Math.floor(idx / 6)] || "A";
                        const colNum = (idx % 6) + 1;
                        const bayCode = rowChar + colNum;
                        const detalleText = `Bahía ${bayCode} — ${containerData.destino || 'APM Terminals'}`;
                        
                        const enrichedLog = {
                            accion: "INGRESO",
                            lote: containerData.codigoId,
                            detalle: detalleText,
                            hora: obtenerHoraPeruana()
                        };
                        if (window.pilaAuditoria && window.pilaAuditoria.push) {
                            window.pilaAuditoria.push(enrichedLog);
                        }

                        const mockLog = {
                            idLog: "mock-" + Date.now(),
                            tipoAccion: "INGRESAR CONTENEDOR",
                            microservicio: "inbound-yard-service",
                            payload: JSON.stringify(containerData),
                            fechaRegistro: new Date().toISOString()
                        };
                        
                        const updatedAudit = [mockLog, ...Store.getState().audit.data];
                        Store.updateAudit(updatedAudit);

                        if (window.inyectarFilaAuditoriaInmediata) {
                            window.inyectarFilaAuditoriaInmediata(mockLog);
                        }

                        // 2. Recargar de fondo para asegurar sincronización
                        await this.loadAudit();
                        this.reloadData(true);
                        
                        showToast("success", "Contenedor Ingresado", `${containerData.codigoId} → ${containerData.destino}`);
                    } else {
                        const msg = await res.text();
                        showToast("warning", "Aviso del Patio", msg);
                        shakeForm(newForm);
                    }
                } catch (error) {
                    console.error("[DashboardController] Error POST Yard:", error);
                    showToast("error", error.message.includes("[Compilation Block Alert]") ? "Error de Validación" : "Sin Conexión", error.message);
                    shakeForm(newForm);
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

                const placaVal = document.getElementById("dispatch-placa").value.trim();
                const conductorVal = document.getElementById("dispatch-conductor").value.trim();
                const tipoCargaVal = document.getElementById("dispatch-carga").value;
                const prioridadVal = document.getElementById("dispatch-prioridad").value;

                if (!placaVal || !conductorVal || tipoCargaVal === "" || prioridadVal === "") {
                    showToast("error", "Campos Incompletos", "Error: Todos los campos del camión son obligatorios.");
                    shakeForm(newForm);
                    return;
                }

                // RegEx para placa peruana: 3 alfanuméricos, guion opcional, 3 números (ej: ABC-123 o A1F-942)
                const regexPlaca = /^[A-Z0-9]{3}-?\d{3}$/i;
                if (!regexPlaca.test(placaVal)) {
                    showToast("error", "Formato de Placa Inválido", "La placa debe tener 3 caracteres alfanuméricos, un guion opcional y 3 números (ej: ABC-123 o A1F-942).");
                    shakeForm(newForm);
                    return;
                }

                if (!this.acquireLock()) return;

                const btn = document.getElementById("btn-enqueue");
                setLoadingState(btn, true);

                const truckData = {
                    placa:          placaVal.toUpperCase(),
                    conductor:      conductorVal,
                    tipoCarga:      tipoCargaVal.toUpperCase(),
                    ordenPrioridad: parseInt(prioridadVal) || 1
                };

                try {
                    const res = await DispatchService.encolarCamion(truckData);
                    if (res.ok) {
                        newForm.reset();
                        Store.setDispatchPage(0);
                        
                        // 1. Inyección reactiva a través del Store
                        const updatedDispatch = [...Store.getState().dispatch.data, truckData];
                        Store.updateDispatch(updatedDispatch);
                        
                        const enrichedLog = {
                            accion: "ENCOLADO",
                            lote: truckData.placa,
                            detalle: `Conductor: ${truckData.conductor}`,
                            hora: obtenerHoraPeruana()
                        };
                        if (window.pilaAuditoria && window.pilaAuditoria.push) {
                            window.pilaAuditoria.push(enrichedLog);
                        }

                        const mockLog = {
                            idLog: "mock-" + Date.now(),
                            tipoAccion: "ENCOLAR CAMION",
                            microservicio: "dispatch-queue-service",
                            payload: JSON.stringify(truckData),
                            fechaRegistro: new Date().toISOString()
                        };
                        
                        const updatedAudit = [mockLog, ...Store.getState().audit.data];
                        Store.updateAudit(updatedAudit);

                        if (window.inyectarFilaAuditoriaInmediata) {
                            window.inyectarFilaAuditoriaInmediata(mockLog);
                        }

                        // 2. Recargar de fondo
                        await this.loadAudit();
                        this.reloadData(true);

                        if (truckData.tipoCarga === "HAZMAT" || truckData.ordenPrioridad === 1) {
                            registrarAlerta("ENCOLADO", truckData);
                        }
                        showToast("success", "Camión Encolado", `${truckData.placa} · P${truckData.ordenPrioridad}`);
                    } else {
                        const msg = await res.text();
                        showToast("error", "Error Operativo", msg);
                        shakeForm(newForm);
                    }
                } catch (error) {
                    console.error("[DashboardController] Error POST Dispatch:", error);
                    showToast("error", error.message.includes("[Compilation Block Alert]") ? "Error de Validación" : "Sin Conexión", error.message);
                    shakeForm(newForm);
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
                    const res = await DispatchService.despacharSiguiente();
                    const atendido = await res.json();
                    
                    // 1. Inyección reactiva a través del Store
                    const updatedDispatch = [...Store.getState().dispatch.data];
                    updatedDispatch.shift();
                    Store.updateDispatch(updatedDispatch);
                    
                    const enrichedLog = {
                        accion: "DESPACHO",
                        lote: atendido.placa,
                        detalle: `Conductor: ${atendido.conductor}`,
                        hora: obtenerHoraPeruana()
                    };
                    if (window.pilaAuditoria && window.pilaAuditoria.push) {
                        window.pilaAuditoria.push(enrichedLog);
                    }

                    const mockLog = {
                        idLog: "mock-" + Date.now(),
                        tipoAccion: "DESPACHAR CAMION",
                        microservicio: "dispatch-queue-service",
                        payload: JSON.stringify(atendido),
                        fechaRegistro: new Date().toISOString()
                    };
                    
                    const updatedAudit = [mockLog, ...Store.getState().audit.data];
                    Store.updateAudit(updatedAudit);

                    if (window.inyectarFilaAuditoriaInmediata) {
                        window.inyectarFilaAuditoriaInmediata(mockLog);
                    }

                    // 2. Recargar de fondo
                    await this.loadAudit();
                    this.reloadData(true);

                    if ((atendido.tipoCarga || "").toUpperCase() === "HAZMAT" || atendido.ordenPrioridad === 1) {
                        registrarAlerta("DESPACHADO", atendido);
                    }
                    showToast("info", "Camión Despachado", `Placa: ${atendido.placa} · Conductor: ${atendido.conductor}`);
                } catch (error) {
                    if (error.status === 404) {
                        showToast("warning", "Cola Vacía", error.message);
                    } else {
                        console.error("[DashboardController] Error Dispatch Next:", error);
                        showToast("error", "Sin Conexión", error.message || "Error al despachar el camión.");
                    }
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
                if (window.isAuditLogLocked) {
                    console.warn("[DashboardController] Operación de Undo bloqueada por exclusión mutua.");
                    return;
                }

                if (!newBtn || newBtn.disabled) return;

                if (state.audit.data.length === 0) {
                    newBtn.disabled = true;
                    showToast("warning", "Pila Vacía", "No quedan acciones por revertir en la Pila LIFO.");
                    return;
                }

                window.isAuditLogLocked = true;
                setLoadingState(newBtn, true);

                try {
                    const log = await AuditService.undoLastAction();
                    
                    // Revertir a nivel de negocio
                    const tipo = (log.tipoAccion || "").toUpperCase();
                    let revertExito = false;
                    let revertDetalle = "";

                    try {
                        const payloadObj = JSON.parse(log.payload);
                        if (tipo.includes("ENCOLAR")) {
                            if (payloadObj.placa) {
                                const resDel = await DispatchService.eliminarCamion(payloadObj.placa);
                                revertExito = resDel.ok;
                                revertDetalle = `Camión ${payloadObj.placa} eliminado de la cola.`;
                                
                                // Pop local from FIFO Queue
                                const updatedDispatch = Store.getState().dispatch.data.filter(t => t.placa !== payloadObj.placa);
                                Store.updateDispatch(updatedDispatch);
                            }
                        } else if (tipo.includes("INGRESAR") || tipo.includes("YARD")) {
                            const containerId = payloadObj.codigoId || payloadObj.codigoID;
                            if (containerId) {
                                const resDel = await YardService.retirarContenedor(containerId);
                                revertExito = resDel.ok;
                                revertDetalle = `Contenedor ${containerId} retirado del patio.`;
                                
                                // Pop local from Yard Double LinkedList
                                const updatedYard = Store.getState().yard.data.filter(c => (c.codigoId !== containerId && c.codigoID !== containerId));
                                Store.updateYard(updatedYard);
                            }
                        } else {
                            revertExito = true;
                        }
                    } catch (e) {
                        console.error("Fallo al revertir a nivel de negocio V2:", e);
                    }

                    // Pop local from audit data (latest is removed)
                    const updatedAudit = [...Store.getState().audit.data];
                    updatedAudit.shift();
                    Store.updateAudit(updatedAudit);

                    if (window.pilaAuditoria && window.pilaAuditoria.pop) {
                        window.pilaAuditoria.pop();
                    }

                    // Sync in background
                    await this.loadAudit();
                    this.reloadData(true);

                    if (revertExito) {
                        showToast("success", "Acción Revertida", "La transacción ha sido desapilada y consolidada con éxito.");
                    } else {
                        showToast("error", "Reversión Incompleta", "El log de auditoría fue removido, pero falló la actualización en el servicio secundario (cola/patio).");
                    }
                } catch (error) {
                    if (error.status === 404) {
                        showToast("warning", "Pila Vacía", error.message);
                        await this.reloadData(true);
                    } else {
                        console.error("[DashboardController] Error Undo:", error);
                        showToast("error", "Fallo de Reversión", error.message || "Error al revertir la acción.");
                    }
                } finally {
                    window.isAuditLogLocked = false;
                    setLoadingState(newBtn, false);
                }
            });
        }
    }
};

function shakeForm(formEl) {
    if (!formEl) return;
    formEl.classList.add("animate__animated", "animate__shakeX");
    formEl.addEventListener("animationend", () => {
        formEl.classList.remove("animate__animated", "animate__shakeX");
    }, { once: true });
}

if (typeof window !== 'undefined') {
    window.DashboardController = DashboardController;
}
if (typeof module !== 'undefined') {
    module.exports = DashboardController;
}
