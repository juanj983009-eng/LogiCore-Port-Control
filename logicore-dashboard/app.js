// =========================================================================
// LOGICORE - app.js - Senior Lead Developer Edition v2
//     + Mapa de Calor del Patio (Heatmap Grid)
//     + Grafico de Saturacion (Chart.js - Barras horizontales)
//     + Feed de Alertas en Tiempo Real (HAZMAT / P1)
//     Toda la logica de negocio previa se mantiene intacta.
// =========================================================================

window.LOGICORE_CONFIG = { USE_V2_ARCHITECTURE: true, API_BASE_URL: 'http://127.0.0.1:8080' };


/* ── CONFIGURACIÓN DE PAGINACIÓN ── */
const PAGE_SIZE_DISPATCH = 20;
const PAGE_SIZE_AUDIT    = 15;

/* ── CONFIGURACIÓN DEL MAPA DE CALOR ── */
const HEATMAP_TOTAL_SLOTS = 30;   // capacidad visual fija del patio (5×6)

/* ── ESTADO CENTRALIZADO ── */
// El estado se obtiene y maneja centralizadamente a través del Store reactivo.
const state = Store.state;

/* ── INSTANCIA CHART.JS (singleton) ── */
let dispatchChart = null;

/* ── MOCK TIMESTAMP STABILIZERS ── */
function getMockEnqueuedTime(placa) {
    const safePlaca = placa || "";
    let hash = 0;
    for (let i = 0; i < safePlaca.length; i++) {
        hash = safePlaca.charCodeAt(i) + ((hash << 5) - hash);
    }
    const totalMinutes = Math.abs(hash) % 180; // up to 3 hours ago
    const now = new Date();
    const enqueuedDate = new Date(now.getTime() - totalMinutes * 60000);
    return enqueuedDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getMockAuditTime(idLog) {
    const safeIdLog = idLog || "";
    let hash = 0;
    for (let i = 0; i < safeIdLog.length; i++) {
        hash = safeIdLog.charCodeAt(i) + ((hash << 5) - hash);
    }
    const totalMinutes = Math.abs(hash) % 120; // up to 2 hours ago
    const now = new Date();
    const auditDate = new Date(now.getTime() - totalMinutes * 60000);
    return auditDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/* ── KEYBOARD SHORTCUT Ctrl+Z ── */
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (window.LOGICORE_CONFIG.USE_V2_ARCHITECTURE) {
            DashboardController.reloadData();
        } else {
            deshacerUltimaAccion();
        }
    }
});

// =========================================================================
// INICIALIZACION
// =========================================================================
(async () => {

    if (window.LOGICORE_CONFIG.USE_V2_ARCHITECTURE) {
        // 1️⃣  Inicializar Chart.js (singleton, antes de datos)
        inicializarGrafico();
        
        // 2️⃣  Inicializar el nuevo controlador de la arquitectura modular v2
        await DashboardController.init();

        // 3️⃣  Inicializar el fondo 3D pasivo
        if (window.Background3D) {
            window.Background3D.init();
        }
    } else {
        // 1️⃣  Inicializar Chart.js (singleton, antes de datos)
        inicializarGrafico();

        // 2️⃣  Pintar el heatmap con slots vacíos INMEDIATAMENTE
        //     para que el componente nunca aparezca en blanco
        renderizarHeatmap();

        // 3️⃣  Cargas iniciales en paralelo (incluye el Patio)
        try {
            await Promise.allSettled([
                cargarPatioContenedores(),   // carga lista doble + actualiza heatmap
                cargarColaDespacho(),
                cargarHistorialAuditoria()
            ]);
        } catch (error) {
            console.error("Falla parcial al inicializar servicios:", error);
        }

        // ── LISTENERS DE FORMULARIOS Y BOTONES ──

        const formYard = document.getElementById("form-yard");
        if (formYard) {
            formYard.addEventListener("submit", function(e) {
                e.preventDefault();
                ingresarAlPatio(e);
            });
        }

        const formDispatch = document.getElementById("form-dispatch");
        if (formDispatch) {
            formDispatch.addEventListener("submit", function(e) {
                e.preventDefault();
                encolarCamion(e);
            });
        }

        const btnDispatchNext = document.getElementById("btn-dispatch-next");
        if (btnDispatchNext) btnDispatchNext.addEventListener("click", despacharSiguienteCamion);

        const btnAuditUndo = document.getElementById("btn-audit-undo");
        if (btnAuditUndo) btnAuditUndo.addEventListener("click", deshacerUltimaAccion);

        const btnClearAlerts = document.getElementById("btn-clear-alerts");
        if (btnClearAlerts) btnClearAlerts.addEventListener("click", limpiarAlertas);

        // ── PAGINACIÓN — Despacho ──
        document.getElementById("dispatch-prev")?.addEventListener("click", () => {
            if (state.dispatch.page > 0) {
                state.dispatch.page--;
                renderizarColaDespacho();
            }
        });
        document.getElementById("dispatch-next-page")?.addEventListener("click", () => {
            const maxPage = Math.ceil(state.dispatch.data.length / PAGE_SIZE_DISPATCH) - 1;
            if (state.dispatch.page < maxPage) {
                state.dispatch.page++;
                renderizarColaDespacho();
            }
        });

        // ── PAGINACIÓN — Auditoría ──
        document.getElementById("audit-prev")?.addEventListener("click", () => {
            if (state.audit.page > 0) {
                state.audit.page--;
                renderizarAuditoria();
            }
        });
        document.getElementById("audit-next-page")?.addEventListener("click", () => {
            const maxPage = Math.ceil(state.audit.data.length / PAGE_SIZE_AUDIT) - 1;
            if (state.audit.page < maxPage) {
                state.audit.page++;
                renderizarAuditoria();
            }
        });

        // Ripple en todos los botones
        document.querySelectorAll(".lc-btn").forEach(btn => {
            btn.addEventListener("click", createRipple);
        });
    }
})();

// =========================================================================
// RIPPLE EFFECT
// =========================================================================
function createRipple(e) {
    const btn      = e.currentTarget;
    const circle   = document.createElement("span");
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius   = diameter / 2;
    const rect     = btn.getBoundingClientRect();

    circle.classList.add("ripple");
    circle.style.width  = circle.style.height = `${diameter}px`;
    circle.style.left   = `${e.clientX - rect.left - radius}px`;
    circle.style.top    = `${e.clientY - rect.top  - radius}px`;

    btn.querySelector(".ripple")?.remove();
    btn.appendChild(circle);
}

// =========================================================================
// SISTEMA DE TOASTS
// =========================================================================
function showToast(type = "info", title = "", message = "", duration = 4000) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const icons = {
        success: "fa-circle-check",
        error:   "fa-circle-xmark",
        info:    "fa-circle-info",
        warning: "fa-triangle-exclamation"
    };

    const toast = document.createElement("div");
    const shakeClass = (type === "error" || type === "warning") ? " animate__animated animate__shakeX" : "";
    toast.className = `toast toast--${type}${shakeClass}`;
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
        <div class="toast__icon"><i class="fa-solid ${icons[type]}"></i></div>
        <div class="toast__content">
            <div class="toast__title">${escHtml(title)}</div>
            ${message ? `<div class="toast__msg">${escHtml(message)}</div>` : ""}
        </div>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toast-out");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
    }, duration);
}

/** Sanitización XSS simple */
function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// =========================================================================
// KPIs - Contadores animados
// =========================================================================
function actualizarKPIs() {
    const yardCount     = state.yard.data.length;
    const dispatchCount = state.dispatch.data.length;
    const auditCount    = state.audit.data.length;
    const hazmatCount   = state.dispatch.data.filter(c =>
        (c.tipoCarga || "").toUpperCase() === "HAZMAT"
    ).length;

    animateCounter("kpi-yard",     yardCount);
    animateCounter("kpi-dispatch", dispatchCount);
    animateCounter("kpi-audit",    auditCount);
    animateCounter("kpi-hazmat",   hazmatCount);
}

function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration  = 500;
    const startTime = performance.now();
    const diff      = target - current;

    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(current + diff * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// =========================================================================
// SECCION 1 - PATIO DE CONTENEDORES (Lista Doble - Puerto 8082)
// =========================================================================

async function ingresarAlPatio(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-yard-submit");
    setLoadingState(btn, true);

    const contenedorDTO = {
        codigoId:  document.getElementById("yard-id").value.trim().toUpperCase(),
        destino:   document.getElementById("yard-destino").value.trim().toUpperCase(),
        peso:      parseFloat(document.getElementById("yard-peso").value)    || 0.0,
        prioridad: parseInt(document.getElementById("yard-prioridad").value) || 1
    };

    try {
        const respuesta = await YardService.ingresarAlPatio(contenedorDTO);

        if (respuesta.ok) {
            document.getElementById("form-yard").reset();
            
            // 1. Inyección reactiva inmediata en el DOM (local)
            state.yard.data.push(contenedorDTO);
            
            const idx = state.yard.data.length - 1;
            const rowChar = ["A", "B", "C", "D", "E"][Math.floor(idx / 6)] || "A";
            const colNum = (idx % 6) + 1;
            const bayCode = rowChar + colNum;
            const detalleText = `Bahía ${bayCode} — ${contenedorDTO.destino || 'APM Terminals'}`;
            
            const enrichedLog = {
                accion: "INGRESO",
                lote: contenedorDTO.codigoId,
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
                payload: JSON.stringify(contenedorDTO),
                fechaRegistro: new Date().toISOString()
            };
            state.audit.data.unshift(mockLog);

            renderizarPatio();
            renderizarHeatmap();
            if (window.DoubleLinkedListComponent) {
                window.DoubleLinkedListComponent.render(state.yard.data);
            }
            if (window.inyectarFilaAuditoriaInmediata) {
                window.inyectarFilaAuditoriaInmediata(mockLog);
            }
            actualizarKPIs();

            // 2. Sincronización silenciosa de fondo
            cargarPatioContenedores(true);
            cargarHistorialAuditoria(true);

            showToast("success", "Contenedor Ingresado",
                `${contenedorDTO.codigoId} → ${contenedorDTO.destino}`);
        } else {
            const msg = await respuesta.text();
            showToast("warning", "Aviso del Patio", msg);
        }
    } catch (error) {
        console.error("Error POST Yard:", error);
        if (error.message.includes("[Compilation Block Alert]")) {
            showToast("error", "Error de Validación", error.message);
        } else {
            showToast("error", "Sin Conexión", "No se pudo contactar al servicio de Patio.");
        }
    } finally {
        setLoadingState(btn, false);
    }
}

async function cargarPatioContenedores(silent = false) {
    const contenedorList = document.getElementById("yard-list-ida");
    if (!contenedorList) return;

    try {
        const containers = await YardService.obtenerEstadoPatio();
        Store.updateYard(containers);
    } catch (error) {
        console.error("Error GET Yard:", error);
        Store.updateYard([]);
        contenedorList.innerHTML = crearEmptyState("fa-warehouse", "Patio listo · Lista Doble en espera");
        renderizarHeatmap();
        actualizarKPIs();
    }
}

function renderizarPatio() {
    const contenedores   = state.yard.data;
    const contenedorList = document.getElementById("yard-list-ida");
    if (!contenedorList) return;

    const yardCountEl = document.getElementById("yard-count");
    if (yardCountEl) yardCountEl.textContent = contenedores.length;

    if (contenedores.length === 0) {
        contenedorList.innerHTML = crearEmptyState("fa-boxes-stacked", "Patio vacío. Sin contenedores asignados.");
        actualizarKPIs();
        return;
    }

    const fragment = document.createDocumentFragment();
    contenedores.forEach((c, idx) => {
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

    contenedorList.innerHTML = "";
    contenedorList.appendChild(fragment);
    actualizarKPIs();
}

// =========================================================================
// MAPA DE CALOR DEL PATIO (Heatmap)
// =========================================================================

/**
 * Renderiza la matriz bidimensional del patio.
 * Los primeros N slots (según data.length) aparecen ocupados.
 * Cada slot ocupado recibe un tooltip CSS con ID y Destino.
 */
/**
 * Renderiza la matriz 5×10 del patio.
 * Siempre genera exactamente HEATMAP_TOTAL_SLOTS slots.
 * Los primeros N (= contenedores.length) aparecen ocupados;
 * el resto se muestra como slate oscuro vacío.
 * Si hay más contenedores que slots, se expanden filas extra
 * pero la capacidad mínima siempre es HEATMAP_TOTAL_SLOTS.
 */
function renderizarHeatmap() {
    const grid = document.getElementById("yard-heatmap");
    if (!grid) return;
    if (window.YardHeatmap) {
        window.YardHeatmap.render(grid, state.yard.data);
    }
}

// =========================================================================
// SECCION 2 - COLA DE DESPACHO (FIFO - Puerto 8082)
// =========================================================================

async function encolarCamion(e) {
    e.preventDefault();

    const placaVal = document.getElementById("dispatch-placa").value.trim();
    const conductorVal = document.getElementById("dispatch-conductor").value.trim();
    const tipoCargaVal = document.getElementById("dispatch-carga").value;
    const prioridadVal = document.getElementById("dispatch-prioridad").value;

    if (!placaVal || !conductorVal || tipoCargaVal === "" || prioridadVal === "") {
        showToast("error", "Campos Incompletos", "Error: Todos los campos del camión son obligatorios.");
        return;
    }

    // RegEx para placa peruana: 3 alfanuméricos, guion opcional, 3 números (ej: ABC-123 o A1F-942)
    const regexPlaca = /^[A-Z0-9]{3}-?\d{3}$/i;
    if (!regexPlaca.test(placaVal)) {
        showToast("error", "Formato de Placa Inválido", "La placa debe tener 3 caracteres alfanuméricos, un guion opcional y 3 números (ej: ABC-123 o A1F-942).");
        return;
    }

    const btn = document.getElementById("btn-enqueue");
    setLoadingState(btn, true);

    const camionDTO = {
        placa:          placaVal.toUpperCase(),
        conductor:      conductorVal,
        tipoCarga:      tipoCargaVal.toUpperCase(),
        ordenPrioridad: parseInt(prioridadVal) || 1
    };

    try {
        const respuesta = await DispatchService.encolarCamion(camionDTO);

        if (respuesta.ok) {
            document.getElementById("form-dispatch").reset();
            state.dispatch.page = 0;

            // 1. Inyección reactiva inmediata en el DOM (local)
            state.dispatch.data.push(camionDTO);
            
            const enrichedLog = {
                accion: "ENCOLADO",
                lote: camionDTO.placa,
                detalle: `Conductor: ${camionDTO.conductor}`,
                hora: obtenerHoraPeruana()
            };
            if (window.pilaAuditoria && window.pilaAuditoria.push) {
                window.pilaAuditoria.push(enrichedLog);
            }

            const mockLog = {
                idLog: "mock-" + Date.now(),
                tipoAccion: "ENCOLAR CAMION",
                microservicio: "dispatch-queue-service",
                payload: JSON.stringify(camionDTO),
                fechaRegistro: new Date().toISOString()
            };
            state.audit.data.unshift(mockLog);

            renderizarColaDespacho();
            if (window.inyectarFilaAuditoriaInmediata) {
                window.inyectarFilaAuditoriaInmediata(mockLog);
            }
            actualizarKPIs();

            // 2. Sincronización silenciosa de fondo
            cargarColaDespacho(true);
            cargarHistorialAuditoria(true);

            // Registrar alerta si es HAZMAT o P1
            if (camionDTO.tipoCarga === "HAZMAT" || camionDTO.ordenPrioridad === 1) {
                registrarAlerta("ENCOLADO", camionDTO);
            }

            showToast("success", "Camión Encolado",
                `${camionDTO.placa} · ${camionDTO.tipoCarga} · P${camionDTO.ordenPrioridad}`);
        } else {
            const msgError = await respuesta.text();
            showToast("error", "Error Operativo", msgError);
        }
    } catch (error) {
        console.error(error);
        if (error.message.includes("[Compilation Block Alert]")) {
            showToast("error", "Error de Validación", error.message);
        } else {
            showToast("error", "Sin Conexión", "No se pudo contactar al servicio de Despacho.");
        }
    } finally {
        setLoadingState(btn, false);
    }
}

async function despacharSiguienteCamion() {
    const btn = document.getElementById("btn-dispatch-next");
    setLoadingState(btn, true);

    try {
        const respuesta = await DispatchService.despacharSiguiente();
        const camionAtendido = await respuesta.json();

        // 1. Inyección reactiva inmediata en el DOM (local)
        state.dispatch.data.shift(); // Remove first truck
        
        const enrichedLog = {
            accion: "DESPACHO",
            lote: camionAtendido.placa,
            detalle: `Conductor: ${camionAtendido.conductor}`,
            hora: obtenerHoraPeruana()
        };
        if (window.pilaAuditoria && window.pilaAuditoria.push) {
            window.pilaAuditoria.push(enrichedLog);
        }

        const mockLog = {
            idLog: "mock-" + Date.now(),
            tipoAccion: "DESPACHAR CAMION",
            microservicio: "dispatch-queue-service",
            payload: JSON.stringify(camionAtendido),
            fechaRegistro: new Date().toISOString()
        };
        state.audit.data.unshift(mockLog);

        renderizarColaDespacho();
        if (window.inyectarFilaAuditoriaInmediata) {
            window.inyectarFilaAuditoriaInmediata(mockLog);
        }
        actualizarKPIs();

        // 2. Sincronización silenciosa de fondo
        cargarColaDespacho(true);
        cargarHistorialAuditoria(true);

        // Alerta si el camion despachado era HAZMAT o P1
        if ((camionAtendido.tipoCarga || "").toUpperCase() === "HAZMAT" ||
            camionAtendido.ordenPrioridad === 1) {
            registrarAlerta("DESPACHADO", camionAtendido);
        }

        showToast("info", "Camión Despachado",
            `Placa: ${camionAtendido.placa} · Conductor: ${camionAtendido.conductor}`);
    } catch (error) {
        if (error.status === 404) {
            showToast("warning", "Cola Vacía", error.message);
        } else {
            console.error(error);
            showToast("error", "Sin Conexión", error.message || "Error al intentar despachar el siguiente camión.");
        }
    } finally {
        setLoadingState(btn, false);
    }
}

async function cargarColaDespacho(silent = false) {
    try {
        const trucks = await DispatchService.obtenerCola();
        Store.updateDispatch(trucks);
    } catch (error) {
        console.error(error);
        Store.updateDispatch([]);
    }
}

function renderizarColaDespacho() {
    const contenedorCola = document.getElementById("dispatch-list");
    if (!contenedorCola) return;

    const { data, page } = state.dispatch;
    const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE_DISPATCH));
    const safePage   = Math.min(page, totalPages - 1);
    state.dispatch.page = safePage;

    const start = safePage * PAGE_SIZE_DISPATCH;
    const end   = Math.min(start + PAGE_SIZE_DISPATCH, data.length);
    const slice = data.slice(start, end);

    const dispatchCountEl = document.getElementById("dispatch-count");
    if (dispatchCountEl) dispatchCountEl.textContent = data.length + " en cola";

    if (data.length === 0) {
        contenedorCola.innerHTML = `<tr><td colspan="6" class="empty-table-cell" style="text-align: center; padding: 24px; color: #94a3b8;"><i class="fa-solid fa-truck-ramp-box" style="margin-right: 8px;"></i>No hay camiones en la cola de despacho.</td></tr>`;
        actualizarPaginacion("dispatch", 0, 1, 0, 0);
        actualizarKPIs();
        return;
    }

    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();

        slice.forEach((c, idx) => {
            const cargoClass = getCargoClass(c.tipoCarga);
            const prioClass  = getPriorityClass(c.ordenPrioridad);
            const globalIdx  = start + idx + 1;
            const mockTime   = getMockEnqueuedTime(c.placa);

            const tr = document.createElement("tr");
            if (idx === 0 && safePage === 0) {
                tr.className = "is-new";
            }
            
            // Cargo icons & labels
            let cargoBadge = "";
            const cargoUpper = (c.tipoCarga || "").toUpperCase();
            if (cargoUpper === "HAZMAT") {
                cargoBadge = `<span class="badge-cargo badge-cargo--hazmat"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 4px;"></i>HAZMAT</span>`;
            } else if (cargoUpper === "REEFER") {
                cargoBadge = `<span class="badge-cargo badge-cargo--reefer"><i class="fa-solid fa-snowflake" style="margin-right: 4px;"></i>REEFER</span>`;
            } else {
                cargoBadge = `<span class="badge-cargo badge-cargo--dry"><i class="fa-solid fa-box" style="margin-right: 4px;"></i>DRY</span>`;
            }

            // Priority label & badge
            let prioBadge = "";
            if (c.ordenPrioridad === 1) {
                prioBadge = `<span class="badge-priority badge-priority--critical">Crítico</span>`;
            } else if (c.ordenPrioridad === 2) {
                prioBadge = `<span class="badge-priority badge-priority--normal">Normal</span>`;
            } else {
                prioBadge = `<span class="badge-priority badge-priority--low">Bajo</span>`;
            }

            tr.innerHTML = `
                <td style="text-align: center; font-weight: 700; color: #94a3b8;">${globalIdx}</td>
                <td style="font-weight: 700; color: #00555a;">${escHtml(c.placa)}</td>
                <td style="font-weight: 600; color: #0f2527;">${escHtml(c.conductor)}</td>
                <td>${cargoBadge}</td>
                <td>${prioBadge}</td>
                <td style="text-align: right; padding-right: 16px; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #475569; font-weight: 500;">${mockTime}</td>
            `;
            fragment.appendChild(tr);
        });

        contenedorCola.innerHTML = "";
        contenedorCola.appendChild(fragment);
        actualizarPaginacion("dispatch", safePage, totalPages, start + 1, end);
        actualizarKPIs();
    });
}

// =========================================================================
// GRAFICO DE SATURACION - Chart.js
// =========================================================================

/**
 * Crea la instancia de Chart.js con Dark Theme corporativo.
 * Se llama UNA SOLA VEZ en DOMContentLoaded.
 */
function inicializarGrafico() {
    const canvas = document.getElementById("dispatch-chart");
    if (!canvas || typeof Chart === "undefined") return;

    const ctx = canvas.getContext("2d");

    // Gradientes para cada barra
    const gradReefer = ctx.createLinearGradient(0, 0, 400, 0);
    gradReefer.addColorStop(0, "rgba(34,211,238,0.80)");
    gradReefer.addColorStop(1, "rgba(6,182,212,0.30)");

    const gradDry = ctx.createLinearGradient(0, 0, 400, 0);
    gradDry.addColorStop(0, "rgba(251,191,36,0.80)");
    gradDry.addColorStop(1, "rgba(245,158,11,0.28)");

    const gradHazmat = ctx.createLinearGradient(0, 0, 400, 0);
    gradHazmat.addColorStop(0, "rgba(239,68,68,0.85)");
    gradHazmat.addColorStop(1, "rgba(220,38,38,0.28)");

    dispatchChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["REEFER", "DRY", "HAZMAT"],
            datasets: [{
                label: "Camiones en Cola",
                data:  [0, 0, 0],
                backgroundColor: [gradReefer, gradDry, gradHazmat],
                borderColor: [
                    "rgba(34,211,238,0.80)",
                    "rgba(251,191,36,0.80)",
                    "rgba(239,68,68,0.80)"
                ],
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                barThickness: 36
            }]
        },
        options: {
            indexAxis: "y",          // Barras horizontales
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500,
                easing:   "easeOutQuart"
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#FFFFFF',
                    titleColor: '#0F172A',
                    bodyColor: '#475569',
                    borderColor: '#475569',
                    borderWidth: 1,
                    padding:         10,
                    cornerRadius:    8,
                    callbacks: {
                        label: ctx => ` ${ctx.raw} camión${ctx.raw !== 1 ? "es" : ""} en cola`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color:       "#475569",
                        font:        { family: "'JetBrains Mono', monospace", size: 10 },
                        stepSize:    1,
                        precision:   0
                    },
                    grid: {
                        color:       "rgba(255,255,255,0.05)",
                        drawTicks:   false
                    },
                    border: { color: "rgba(255,255,255,0.06)" }
                },
                y: {
                    ticks: {
                        color:       "#94a3b8",
                        font:        { family: "'Inter', sans-serif", size: 11, weight: "600" }
                    },
                    grid: { display: false },
                    border: { color: "rgba(255,255,255,0.06)" }
                }
            }
        }
    });
}

/**
 * Actualiza los datos del gráfico y los totales debajo de él.
 * Se invoca cada vez que la cola cambia.
 */
function actualizarGrafico() {
    if (!dispatchChart) return;

    const data    = state.dispatch.data;
    const reefer  = data.filter(c => (c.tipoCarga || "").toUpperCase() === "REEFER").length;
    const dry     = data.filter(c => (c.tipoCarga || "").toUpperCase() === "DRY").length;
    const hazmat  = data.filter(c => (c.tipoCarga || "").toUpperCase() === "HAZMAT").length;

    // Actualizar Chart.js
    dispatchChart.data.datasets[0].data = [reefer, dry, hazmat];
    dispatchChart.update("active");

    // Actualizar totales numéricos bajo el gráfico
    const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
    };
    setVal("chart-total-reefer", reefer);
    setVal("chart-total-dry",    dry);
    setVal("chart-total-hazmat", hazmat);
    setVal("chart-total-all",    data.length);
}

// =========================================================================
// FEED DE ALERTAS EN TIEMPO REAL (HAZMAT / P1)
// =========================================================================

/**
 * Registra una nueva alerta en el feed y la añade al DOM.
 * @param {'ENCOLADO'|'DESPACHADO'} evento
 * @param {object} camion  — { placa, conductor, tipoCarga, ordenPrioridad }
 */
function registrarAlerta(evento, camion) {
    const ts    = new Date();
    const hora  = ts.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const tipo  = (camion.tipoCarga || "").toUpperCase();
    const prio  = camion.ordenPrioridad;

    // Clasificar razón de la alerta
    const razones = [];
    if (tipo === "HAZMAT")   razones.push("HAZMAT");
    if (prio === 1)          razones.push("Prioridad P1");

    if (razones.length === 0) return;  // No es crítico

    const alerta = {
        id:      Date.now(),
        evento,
        placa:   camion.placa,
        conductor: camion.conductor || "—",
        tipo,
        prio,
        razones: razones.join(" · "),
        hora
    };

    const updatedAlerts = [alerta, ...Store.getState().alerts];
    Store.updateAlerts(updatedAlerts);
    renderizarAlertaEntrada(alerta, true);   // Insertar al tope del feed
    actualizarContadorAlertas();
}

/**
 * Inserta un elemento de alerta en el DOM (al principio del feed).
 */
function renderizarAlertaEntrada(alerta, isNew = false) {
    const feed = document.getElementById("alerts-feed");
    if (!feed) return;

    // Si era estado vacío, limpiar
    if (feed.querySelector(".empty-state")) {
        feed.innerHTML = "";
    }

    const div = document.createElement("div");
    div.className = "alert-entry";
    div.dataset.alertId = alerta.id;
    div.innerHTML = `
        <div class="alert-indicator" aria-hidden="true"></div>
        <div class="alert-entry__body">
            <div class="alert-entry__type">
                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                ${escHtml(alerta.evento)} · ${escHtml(alerta.razones)}
            </div>
            <div class="alert-entry__detail">
                ${escHtml(alerta.placa)} · ${escHtml(alerta.conductor)}
            </div>
        </div>
        <div class="alert-entry__time">${escHtml(alerta.hora)}</div>`;

    // Insertar al principio del feed
    feed.insertBefore(div, feed.firstChild);

    // Animación de entrada elástica con GSAP
    if (typeof gsap !== "undefined") {
        gsap.fromTo(div, 
            { opacity: 0, x: -30, scale: 0.95 }, 
            { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
        );
    }
}

function actualizarContadorAlertas() {
    const el = document.getElementById("alerts-count");
    if (el) el.textContent = state.alerts.length;
}

function limpiarAlertas() {
    Store.updateAlerts([]);
    const feed = document.getElementById("alerts-feed");
    if (feed) {
        feed.innerHTML = crearEmptyState(
            "fa-shield-halved",
            "Sin alertas activas. Sistema operando con normalidad."
        );
    }
    actualizarContadorAlertas();
    showToast("info", "Alertas Limpiadas", "El feed de alertas fue reiniciado.");
}

// =========================================================================
// ⏱️  SECCIÓN 3 — HISTORIAL DE AUDITORÍA (Pila LIFO · Puerto 8083)
// =========================================================================

function obtenerHoraPeruana() {
    return new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function mapSingleBackendLogToEnriched(log) {
    let accion = "INGRESO";
    const tipo = (log.tipoAccion || "").toUpperCase();
    if (tipo.includes("DESPACHAR")) {
        accion = "DESPACHO";
    } else if (tipo.includes("ENCOLAR")) {
        accion = "ENCOLADO";
    } else if (tipo.includes("INGRESAR") || tipo.includes("YARD") || tipo.includes("REGISTRO")) {
        accion = "INGRESO";
    } else if (tipo.includes("UNDO") || tipo.includes("DESHACER")) {
        accion = "DESHACER";
    }

    let lote = "";
    let detalle = "";
    try {
        const payloadObj = JSON.parse(log.payload);
        if (payloadObj.placa) {
            lote = payloadObj.placa;
            detalle = `Conductor: ${payloadObj.conductor || "Desconocido"}`;
        } else if (payloadObj.codigoId || payloadObj.codigoID) {
            lote = payloadObj.codigoId || payloadObj.codigoID;
            let bayCode = "A1";
            if (state && state.yard && state.yard.data) {
                const idx = state.yard.data.findIndex(c => c.codigoId === lote || c.codigoID === lote);
                if (idx !== -1) {
                    const rowChar = ["A", "B", "C", "D", "E"][Math.floor(idx / 6)] || "A";
                    const colNum = (idx % 6) + 1;
                    bayCode = rowChar + colNum;
                } else {
                    const rowChar = ["A", "B", "C", "D", "E"][Math.floor(Math.random() * 5)];
                    const colNum = Math.floor(Math.random() * 6) + 1;
                    bayCode = rowChar + colNum;
                }
            }
            detalle = `Bahía ${bayCode} — ${payloadObj.destino || "APM Terminals"}`;
        } else {
            lote = payloadObj.id || Object.values(payloadObj)[0] || "";
            detalle = log.tipoAccion;
        }
    } catch {
        lote = log.payload || "";
        detalle = log.tipoAccion;
    }

    const hora = log.idLog && String(log.idLog).startsWith("mock") ? obtenerHoraPeruana() : getMockAuditTime(log.idLog);

    return {
        accion,
        lote,
        detalle,
        hora
    };
}

function rebuildPilaAuditoria(logs) {
    if (!window.pilaAuditoria) {
        const pila = [];
        pila.push = function(item) { Array.prototype.unshift.call(this, item); };
        pila.pop = function() { return Array.prototype.shift.call(this); };
        window.pilaAuditoria = pila;
    }
    window.pilaAuditoria.length = 0;
    logs.forEach(log => {
        Array.prototype.push.call(window.pilaAuditoria, mapSingleBackendLogToEnriched(log));
    });
}

window.obtenerHoraPeruana = obtenerHoraPeruana;
window.mapSingleBackendLogToEnriched = mapSingleBackendLogToEnriched;
window.rebuildPilaAuditoria = rebuildPilaAuditoria;

// Inicialización de la pilaAuditoria
const initialPila = [];
initialPila.push = function(item) { Array.prototype.unshift.call(this, item); };
initialPila.pop = function() { return Array.prototype.shift.call(this); };
window.pilaAuditoria = initialPila;

async function cargarHistorialAuditoria(silent = false) {
    try {
        const logs = await ApiClient.getAuditLogs();
        Store.updateAudit(logs);
    } catch (error) {
        console.error(error);
        Store.updateAudit([]);
    }
}

function renderizarAuditoria() {
    const contenedorList = document.getElementById("audit-list");
    if (!contenedorList) return;

    if (!window.pilaAuditoria) {
        window.pilaAuditoria = [];
    }
    const data = window.pilaAuditoria;
    const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE_AUDIT));
    const safePage   = Math.min(state.audit.page, totalPages - 1);
    state.audit.page = safePage;

    const start = safePage * PAGE_SIZE_AUDIT;
    const end   = Math.min(start + PAGE_SIZE_AUDIT, data.length);
    const slice = data.slice(start, end);

    const auditCountEl = document.getElementById("audit-count");
    if (auditCountEl) auditCountEl.textContent = data.length;

    const btnUndo = document.getElementById("btn-audit-undo");
    if (btnUndo) {
        btnUndo.disabled = (data.length === 0);
    }

    if (data.length === 0) {
        contenedorList.innerHTML = crearEmptyState("fa-inbox", "No hay transacciones en el historial.");
        actualizarPaginacion("audit", 0, 1, 0, 0);
        actualizarKPIs();
        return;
    }

    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();

        slice.forEach((log) => {
            let statusClass = "status-info";
            if (log.accion === "INGRESO") statusClass = "status-ingreso";
            else if (log.accion === "ENCOLADO") statusClass = "status-encolado";
            else if (log.accion === "DESPACHO") statusClass = "status-despacho";
            else if (log.accion === "DESHACER") statusClass = "status-deshacer";
            
            const div = document.createElement("div");
            div.className = "audit-log-row";
            div.setAttribute("role", "listitem");
            div.innerHTML = `
                <div class="audit-log-row__left" style="display: flex; align-items: center; gap: 12px;">
                    <span class="audit-badge ${log.accion.toLowerCase()}">${escHtml(log.accion)}</span>
                    <span class="audit-log-row__detail" style="font-weight: 600; color: #0f2527; font-size: 0.85rem;">${escHtml(log.lote)} — ${escHtml(log.detalle)}</span>
                </div>
                <div class="audit-log-row__time" style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #94a3b8; font-weight: 500;">${escHtml(log.hora)}</div>
            `;
            fragment.appendChild(div);
        });

        contenedorList.innerHTML = "";
        contenedorList.appendChild(fragment);
        actualizarPaginacion("audit", safePage, totalPages, start + 1, end);
        actualizarKPIs();
    });
}

function inyectarFilaAuditoriaInmediata(log) {
    const contenedorList = document.getElementById("audit-list");
    if (!contenedorList) return;

    const emptyState = contenedorList.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    let enrichedLog = log;
    if (log.tipoAccion) {
        enrichedLog = mapSingleBackendLogToEnriched(log);
    }

    if (!window.pilaAuditoria) {
        const pila = [];
        pila.push = function(item) { Array.prototype.unshift.call(this, item); };
        pila.pop = function() { return Array.prototype.shift.call(this); };
        window.pilaAuditoria = pila;
    }
    
    const alreadyExists = window.pilaAuditoria.some(item => item.lote === enrichedLog.lote && item.accion === enrichedLog.accion && item.hora === enrichedLog.hora);
    if (!alreadyExists) {
        window.pilaAuditoria.push(enrichedLog);
    }

    let statusClass = "status-info";
    if (enrichedLog.accion === "INGRESO") statusClass = "status-ingreso";
    else if (enrichedLog.accion === "ENCOLADO") statusClass = "status-encolado";
    else if (enrichedLog.accion === "DESPACHO") statusClass = "status-despacho";
    else if (enrichedLog.accion === "DESHACER") statusClass = "status-deshacer";

    const div = document.createElement("div");
    div.className = "audit-log-row";
    div.setAttribute("role", "listitem");
    div.innerHTML = `
        <div class="audit-log-row__left" style="display: flex; align-items: center; gap: 12px;">
            <span class="audit-badge ${enrichedLog.accion.toLowerCase()}">${escHtml(enrichedLog.accion)}</span>
            <span class="audit-log-row__detail" style="font-weight: 600; color: #0f2527; font-size: 0.85rem;">${escHtml(enrichedLog.lote)} — ${escHtml(enrichedLog.detalle)}</span>
        </div>
        <div class="audit-log-row__time" style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #94a3b8; font-weight: 500;">${escHtml(enrichedLog.hora)}</div>
    `;

    contenedorList.prepend(div);

    if (typeof gsap !== 'undefined') {
        gsap.fromTo(div, 
            { opacity: 0, x: -30, scale: 0.95 }, 
            { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
        );
    }

    const auditCountEl = document.getElementById("audit-count");
    if (auditCountEl) {
        auditCountEl.textContent = window.pilaAuditoria.length;
    }

    const btnUndo = document.getElementById("btn-audit-undo");
    if (btnUndo) {
        btnUndo.disabled = false;
    }
}
window.inyectarFilaAuditoriaInmediata = inyectarFilaAuditoriaInmediata;

window.isAuditLogLocked = false;

async function deshacerUltimaAccion() {
    if (window.isAuditLogLocked) {
        console.warn("[deshacerUltimaAccion] Operación de Undo bloqueada por exclusión mutua.");
        return;
    }

    const btn = document.getElementById("btn-audit-undo");
    if (!btn || btn.disabled) return;

    if (state.audit.data.length === 0) {
        btn.disabled = true;
        showToast("warning", "Pila Vacía", "No quedan más acciones por revertir en la Pila LIFO.");
        return;
    }

    window.isAuditLogLocked = true;
    setLoadingState(btn, true);

    try {
        const logEliminado = await AuditService.undoLastAction();
        
        // Revertir a nivel de negocio según el tipo de acción
        const tipo = (logEliminado.tipoAccion || "").toUpperCase();
        let revertExito = false;
        let revertDetalle = "";

        try {
            const payloadObj = JSON.parse(logEliminado.payload);
            if (tipo.includes("ENCOLAR")) {
                if (payloadObj.placa) {
                    const resDel = await DispatchService.eliminarCamion(payloadObj.placa);
                    revertExito = resDel.ok;
                    revertDetalle = `Camión ${payloadObj.placa} eliminado de la cola.`;
                    
                    // Pop local from FIFO Queue
                    state.dispatch.data = state.dispatch.data.filter(t => t.placa !== payloadObj.placa);
                }
            } else if (tipo.includes("INGRESAR") || tipo.includes("YARD")) {
                const containerId = payloadObj.codigoId || payloadObj.codigoID;
                if (containerId) {
                    const resDel = await YardService.retirarContenedor(containerId);
                    revertExito = resDel.ok;
                    revertDetalle = `Contenedor ${containerId} retirado del patio.`;
                    
                    // Pop local from Yard Double LinkedList
                    state.yard.data = state.yard.data.filter(c => (c.codigoId !== containerId && c.codigoID !== containerId));
                }
            } else {
                revertExito = true;
            }
        } catch (e) {
            console.error("Fallo al revertir a nivel de negocio:", e);
        }

        // Pop local from audit data (latest is removed)
        state.audit.data.shift();
        if (window.pilaAuditoria && window.pilaAuditoria.pop) {
            window.pilaAuditoria.pop();
        }

        // Render immediately local (no F5)
        renderizarPatio();
        renderizarHeatmap();
        if (window.DoubleLinkedListComponent) {
            window.DoubleLinkedListComponent.render(state.yard.data);
        }
        renderizarColaDespacho();
        renderizarAuditoria();
        actualizarKPIs();

        // Background silent sync
        cargarHistorialAuditoria(true);
        cargarColaDespacho(true);
        cargarPatioContenedores(true);

        if (revertExito) {
            showToast("success", "Acción Revertida", "La transacción ha sido desapilada y consolidada con éxito.");
        } else {
            showToast("error", "Reversión Incompleta", "El log de auditoría fue removido, pero falló la actualización en el servicio secundario (cola/patio).");
        }
    } catch (error) {
        if (error.status === 404) {
            showToast("warning", "Pila Vacía", error.message);
            await Promise.all([cargarHistorialAuditoria(true), cargarColaDespacho(true), cargarPatioContenedores(true)]);
        } else {
            console.error("[deshacerUltimaAccion] Error:", error);
            showToast("error", "Fallo de Reversión", error.message || "Error al intentar revertir la acción.");
        }
    } finally {
        window.isAuditLogLocked = false;
        setLoadingState(btn, false);
    }
}

// =========================================================================
// PAGINACION REACTIVA
// =========================================================================
function actualizarPaginacion(section, currentPage, totalPages, from, to) {
    const prefix = section === "dispatch" ? "dispatch" : "audit";

    const infoEl  = document.getElementById(`${prefix}-page-info`);
    const prevBtn = document.getElementById(`${prefix}-prev`);
    const nextBtn = document.getElementById(`${prefix}-next-page`);
    const numsEl  = document.getElementById(`${prefix}-page-nums`);

    const total = section === "dispatch" ? state.dispatch.data.length : state.audit.data.length;

    if (infoEl) {
        infoEl.textContent = total === 0
            ? "Sin registros"
            : `Mostrando ${from}–${to} de ${total}`;
    }
    if (prevBtn) prevBtn.disabled = currentPage <= 0;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;

    if (!numsEl) return;
    numsEl.innerHTML = "";
    if (totalPages <= 1) return;

    const windowSize = 5;
    let startPage = Math.max(0, currentPage - Math.floor(windowSize / 2));
    let endPage   = Math.min(totalPages - 1, startPage + windowSize - 1);
    if (endPage - startPage < windowSize - 1) {
        startPage = Math.max(0, endPage - windowSize + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement("button");
        btn.className    = "page-btn" + (p === currentPage ? " active" : "");
        btn.textContent  = p + 1;
        btn.setAttribute("aria-label", `Página ${p + 1}`);
        btn.setAttribute("aria-current", p === currentPage ? "page" : "false");
        const pageIndex  = p;
        btn.addEventListener("click", () => {
            if (section === "dispatch") {
                state.dispatch.page = pageIndex;
                renderizarColaDespacho();
            } else {
                state.audit.page = pageIndex;
                renderizarAuditoria();
            }
        });
        numsEl.appendChild(btn);
    }
}

// =========================================================================
// HELPERS DE BADGES Y CLASES
// =========================================================================
function getCargoClass(tipoCarga = "") {
    switch (tipoCarga.toUpperCase()) {
        case "REEFER": return "badge-cargo--reefer";
        case "HAZMAT": return "badge-cargo--hazmat";
        case "DRY":
        default:       return "badge-cargo--dry";
    }
}

function getCargoIcon(tipoCarga = "") {
    switch (tipoCarga.toUpperCase()) {
        case "REEFER": return "REF";
        case "HAZMAT": return "HZ";
        case "DRY":
        default:       return "STD";
    }
}

function getPriorityClass(prioridad) {
    switch (parseInt(prioridad)) {
        case 1:  return "badge-priority--p1";
        case 2:  return "badge-priority--p2";
        case 3:
        default: return "badge-priority--p3";
    }
}

function getPriorityLabel(prioridad) {
    switch (parseInt(prioridad)) {
        case 1:  return "P1";
        case 2:  return "P2";
        case 3:
        default: return "P3";
    }
}

function getAuditActionClass(tipoAccion = "") {
    const ua = tipoAccion.toUpperCase();
    if (ua.includes("ENCOLAR") || ua.includes("REGISTR") || ua.includes("CREAT") || ua.includes("ADD") || ua.includes("INSERT"))
        return "audit-entry__action--create";
    if (ua.includes("DESPACHAR") || ua.includes("DELETE") || ua.includes("REMOVE") || ua.includes("UNDO"))
        return "audit-entry__action--delete";
    return "audit-entry__action--update";
}

function getAuditEntryClass(tipoAccion = "") {
    const ua = tipoAccion.toUpperCase();
    if (ua.includes("ENCOLAR") || ua.includes("REGISTR") || ua.includes("CREAT") || ua.includes("ADD") || ua.includes("INSERT"))
        return "audit-entry--create";
    if (ua.includes("DESPACHAR") || ua.includes("DELETE") || ua.includes("REMOVE") || ua.includes("UNDO"))
        return "audit-entry--delete";
    return "audit-entry--update";
}

// =========================================================================
// UTILIDADES DE UI
// =========================================================================
function setLoadingState(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn.classList.add("is-loading");
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch" aria-hidden="true"></i> Procesando…`;
    } else {
        btn.classList.remove("is-loading");
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
    }
}

function crearEmptyState(icon, text) {
    return `
        <div class="empty-state">
            <i class="fa-solid ${icon}" aria-hidden="true"></i>
            <p>${escHtml(text)}</p>
        </div>`;
}