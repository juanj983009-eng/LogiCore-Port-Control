// =========================================================================
// 🌐  LOGICORE · app.js  —  Senior Lead Developer Edition v2
//     + Mapa de Calor del Patio (Heatmap Grid)
//     + Gráfico de Saturación (Chart.js — Barras horizontales)
//     + Feed de Alertas en Tiempo Real (HAZMAT / P1)
//     Toda la lógica de negocio previa se mantiene intacta.
// =========================================================================

window.LOGICORE_CONFIG = { USE_V2_ARCHITECTURE: true, API_BASE_URL: 'http://127.0.0.1:8080' };

/* ── ENDPOINTS ── */
const API_DISPATCH = "http://127.0.0.1:8082/api/v1/dispatch/trucks";
const API_AUDIT    = "http://127.0.0.1:8083/api/v1/audit/logs";
const API_YARD     = "http://127.0.0.1:8081/api/v1/yard/containers";


/* ── CONFIGURACIÓN DE PAGINACIÓN ── */
const PAGE_SIZE_DISPATCH = 20;
const PAGE_SIZE_AUDIT    = 15;

/* ── CONFIGURACIÓN DEL MAPA DE CALOR ── */
const HEATMAP_TOTAL_SLOTS = 50;   // capacidad visual fija del patio (5×10)

/* ── ESTADO CENTRALIZADO ── */
const state = {
    dispatch: { data: [], page: 0 },
    audit:    { data: [], page: 0 },
    yard:     { data: [] },
    alerts:   []                    // feed de alertas locales
};

/* ── INSTANCIA CHART.JS (singleton) ── */
let dispatchChart = null;

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
// 🚀  INICIALIZACIÓN
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {

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
        await Promise.all([
            cargarPatioContenedores(),   // carga lista doble + actualiza heatmap
            cargarColaDespacho(),
            cargarHistorialAuditoria()
        ]);

        // Hide loading screen immediately after Promise.all resolves in V1 mode
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('hidden');
            splash.classList.add('splash-hidden');
        }

        // ── LISTENERS DE FORMULARIOS Y BOTONES ──

        const formYard = document.getElementById("form-yard");
        if (formYard) formYard.addEventListener("submit", ingresarAlPatio);

        const formDispatch = document.getElementById("form-dispatch");
        if (formDispatch) formDispatch.addEventListener("submit", encolarCamion);

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
});

// =========================================================================
// 💧  RIPPLE EFFECT
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
// 🔔  SISTEMA DE TOASTS
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
    toast.className = `toast toast--${type}`;
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
// 📊  KPIs — Contadores animados
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
// 🏗️  SECCIÓN 1 — PATIO DE CONTENEDORES (Lista Doble · Puerto 8082)
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
        const respuesta = await ApiClient.postContainer(contenedorDTO);

        if (respuesta.ok) {
            document.getElementById("form-yard").reset();
            await Promise.all([cargarPatioContenedores(), cargarHistorialAuditoria()]);
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

async function cargarPatioContenedores() {
    const contenedorList = document.getElementById("yard-list-ida");
    if (!contenedorList) return;

    try {
        state.yard.data = await ApiClient.getYardContainers("view");
        renderizarPatio();
        renderizarHeatmap();           // 🔥 Actualizar mapa de calor
    } catch (error) {
        console.error("Error GET Yard:", error);
        state.yard.data = [];
        contenedorList.innerHTML = crearEmptyState("fa-warehouse", "Patio listo · Lista Doble en espera");
        renderizarHeatmap();
        actualizarKPIs();
    }
}

function renderizarPatio() {
    const contenedores   = state.yard.data;
    const contenedorList = document.getElementById("yard-list-ida");
    if (!contenedorList) return;

    document.getElementById("yard-count").textContent = contenedores.length;

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
// 🔥  MAPA DE CALOR DEL PATIO (Heatmap)
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

    const contenedores = state.yard.data;          // puede ser [] en carga inicial
    const ocupados     = contenedores.length;

    // La capacidad visual es siempre el máximo entre el fijo y los datos reales
    // Nunca cae por debajo de HEATMAP_TOTAL_SLOTS → el grid nunca queda vacío
    const totalSlots = Math.max(HEATMAP_TOTAL_SLOTS, ocupados);

    // Actualizar estadísticas del panel
    const hmOccupied = document.getElementById("hm-occupied");
    const hmFree     = document.getElementById("hm-free");
    const hmCapacity = document.getElementById("hm-capacity");
    if (hmOccupied) hmOccupied.textContent = ocupados;
    if (hmFree)     hmFree.textContent     = Math.max(0, totalSlots - ocupados);
    if (hmCapacity) hmCapacity.textContent = totalSlots;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < totalSlots; i++) {
        const isOcupad = i < ocupados;
        const c        = contenedores[i];   // undefined cuando slot vacío

        const slot = document.createElement("div");
        slot.className = "hm-slot " + (isOcupad ? "hm-slot--occupied" : "hm-slot--empty");
        slot.setAttribute("role", "gridcell");
        slot.setAttribute("aria-label",
            isOcupad
                ? `Slot ${i + 1}: ${c.codigoId} → ${c.destino}`
                : `Slot ${i + 1}: libre`
        );

        // Tooltip CSS puro — solo slots con contenedor
        // CSS usa white-space:pre, así que \n genera salto de línea real
        if (isOcupad) {
            slot.setAttribute('data-tooltip', `ID: ${c.codigoId}\n📍 Destino: ${c.destino}\n⚖️ Peso: ${(+c.peso).toFixed(1)} Tn\n⚡ Prioridad: ${c.prioridad}`);
            slot.classList.add("has-tooltip");
        }

        // Número de slot (siempre visible, esquina inferior derecha)
        const numEl = document.createElement("span");
        numEl.className   = "hm-slot__num";
        numEl.textContent = i + 1;
        numEl.setAttribute("aria-hidden", "true");
        slot.appendChild(numEl);

        // Ícono de caja solo en slots ocupados
        if (isOcupad) {
            const iconEl = document.createElement("i");
            iconEl.className = "fa-solid fa-box hm-slot__icon";
            iconEl.setAttribute("aria-hidden", "true");
            slot.appendChild(iconEl);
        }

        fragment.appendChild(slot);
    }

    // Reemplazar contenido en un solo batch DOM
    grid.innerHTML = "";
    grid.appendChild(fragment);
}

// =========================================================================
// 🚚  SECCIÓN 2 — COLA DE DESPACHO (FIFO · Puerto 8082)
// =========================================================================

async function encolarCamion(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-enqueue");
    setLoadingState(btn, true);

    const camionDTO = {
        placa:          document.getElementById("dispatch-placa").value.trim().toUpperCase(),
        conductor:      document.getElementById("dispatch-conductor").value.trim(),
        tipoCarga:      document.getElementById("dispatch-carga").value.trim().toUpperCase(),
        ordenPrioridad: parseInt(document.getElementById("dispatch-prioridad").value) || 1
    };

    try {
        const respuesta = await ApiClient.registrarCamionEnCola(camionDTO);

        if (respuesta.ok) {
            document.getElementById("form-dispatch").reset();
            state.dispatch.page = 0;
            await Promise.all([cargarColaDespacho(), cargarHistorialAuditoria()]);

            // 🚨 Registrar alerta si es HAZMAT o P1
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
        const respuesta = await ApiClient.deleteNextTruck();

        if (respuesta.status === 404) {
            showToast("warning", "Cola Vacía", "No existen camiones en la cola de espera.");
            return;
        }
        if (respuesta.ok) {
            const camionAtendido = await respuesta.json();

            // 🚨 Alerta si el camión despachado era HAZMAT o P1
            if ((camionAtendido.tipoCarga || "").toUpperCase() === "HAZMAT" ||
                camionAtendido.ordenPrioridad === 1) {
                registrarAlerta("DESPACHADO", camionAtendido);
            }

            await Promise.all([cargarColaDespacho(), cargarHistorialAuditoria()]);
            showToast("info", "Camión Despachado",
                `Placa: ${camionAtendido.placa} · Conductor: ${camionAtendido.conductor}`);
        }
    } catch (error) {
        console.error(error);
        showToast("error", "Sin Conexión", "Error al intentar despachar el siguiente camión.");
    } finally {
        setLoadingState(btn, false);
    }
}

async function cargarColaDespacho() {
    try {
        state.dispatch.data = await ApiClient.getDispatchTrucks();
        renderizarColaDespacho();
        actualizarGrafico();          // 📊 Refrescar el gráfico
    } catch (error) {
        console.error(error);
        state.dispatch.data = [];
        renderizarColaDespacho();
        actualizarGrafico();
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

    document.getElementById("dispatch-count").textContent = data.length;

    if (data.length === 0) {
        contenedorCola.innerHTML = crearEmptyState("fa-truck-ramp-box", "No hay camiones en la cola de despacho.");
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

            const div = document.createElement("div");
            div.className = "item-card item-card--dispatch" +
                (idx === 0 && safePage === 0 ? " is-new" : "");
            div.setAttribute("role", "listitem");
            div.innerHTML = `
                <div class="item-card__left">
                    <span class="item-card__id">
                        <i class="fa-solid fa-truck amber" aria-hidden="true"></i>
                        <span style="color:var(--text-muted);font-size:0.60rem;margin-right:2px">#${globalIdx}</span>
                        ${escHtml(c.placa)}
                    </span>
                    <span class="item-card__sub">Cond: ${escHtml(c.conductor)}</span>
                </div>
                <div class="item-card__right">
                    <span class="badge-cargo ${cargoClass}">
                        ${getCargoIcon(c.tipoCarga)} ${escHtml(c.tipoCarga)}
                    </span>
                    <span class="badge-priority ${prioClass}">${getPriorityLabel(c.ordenPrioridad)}</span>
                </div>`;
            fragment.appendChild(div);
        });

        contenedorCola.innerHTML = "";
        contenedorCola.appendChild(fragment);
        actualizarPaginacion("dispatch", safePage, totalPages, start + 1, end);
        actualizarKPIs();
    });
}

// =========================================================================
// 📊  GRÁFICO DE SATURACIÓN — Chart.js
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
            labels: ["REEFER ❄️", "DRY 📦", "HAZMAT ☢️"],
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
                borderRadius: 6,
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
// 🚨  FEED DE ALERTAS EN TIEMPO REAL (HAZMAT / P1)
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
    if (tipo === "HAZMAT")   razones.push("☢️ HAZMAT");
    if (prio === 1)          razones.push("🔴 Prioridad P1");

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

    state.alerts.unshift(alerta);            // LIFO visual (más reciente arriba)
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
}

function actualizarContadorAlertas() {
    const el = document.getElementById("alerts-count");
    if (el) el.textContent = state.alerts.length;
}

function limpiarAlertas() {
    state.alerts = [];
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

async function cargarHistorialAuditoria() {
    try {
        state.audit.data = await ApiClient.getAuditLogs();
        renderizarAuditoria();
    } catch (error) {
        console.error(error);
        state.audit.data = [];
        renderizarAuditoria();
    }
}

function renderizarAuditoria() {
    const contenedorList = document.getElementById("audit-list");
    if (!contenedorList) return;

    const { data, page } = state.audit;
    const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE_AUDIT));
    const safePage   = Math.min(page, totalPages - 1);
    state.audit.page = safePage;

    const start = safePage * PAGE_SIZE_AUDIT;
    const end   = Math.min(start + PAGE_SIZE_AUDIT, data.length);
    const slice = data.slice(start, end);

    document.getElementById("audit-count").textContent = data.length;

    if (data.length === 0) {
        contenedorList.innerHTML = crearEmptyState("fa-inbox", "No hay transacciones en el historial.");
        actualizarPaginacion("audit", 0, 1, 0, 0);
        actualizarKPIs();
        return;
    }

    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();

        slice.forEach((log) => {
            let metadata = "";
            try {
                const d = JSON.parse(log.payload);
                metadata = Object.entries(d).map(([k, v]) =>
                    `${escHtml(k)}: ${escHtml(String(v))}`
                ).join(" &bull; ");
            } catch {
                metadata = escHtml(log.payload || "—");
            }

            const tipo        = (log.tipoAccion || "").toUpperCase();
            const actionClass = getAuditActionClass(tipo);
            const entryClass  = getAuditEntryClass(tipo);

            const div = document.createElement("div");
            div.className = `audit-entry ${entryClass}`;
            div.setAttribute("role", "listitem");
            div.innerHTML = `
                <div class="audit-entry__header">
                    <span class="audit-entry__id">LOG_ID: ${escHtml(String(log.idLog))}</span>
                    <span class="audit-entry__action ${actionClass}">${escHtml(tipo)}</span>
                </div>
                <p class="audit-entry__origin">
                    Origen: <span>${escHtml(log.microservicio || "—")}</span>
                </p>
                <div class="audit-entry__payload">${metadata}</div>`;
            fragment.appendChild(div);
        });

        contenedorList.innerHTML = "";
        contenedorList.appendChild(fragment);
        actualizarPaginacion("audit", safePage, totalPages, start + 1, end);
        actualizarKPIs();
    });
}

async function deshacerUltimaAccion() {
    const btn = document.getElementById("btn-audit-undo");
    setLoadingState(btn, true);

    try {
        const respuesta = await ApiClient.postUndo();

        if (respuesta.status === 404) {
            showToast("warning", "Pila Vacía", "No quedan más acciones por revertir en la Pila LIFO.");
            return;
        }
        if (respuesta.ok) {
            const logEliminado = await respuesta.json();
            await Promise.all([cargarHistorialAuditoria(), cargarColaDespacho()]);
            showToast("success", "Acción Revertida", `Tipo: ${logEliminado.tipoAccion}`);
        }
    } catch (error) {
        console.error(error);
        showToast("error", "Sin Conexión", "Error al intentar revertir la acción en el servicio de auditoría.");
    } finally {
        setLoadingState(btn, false);
    }
}

// =========================================================================
// 🔢  PAGINACIÓN REACTIVA
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
// 🎨  HELPERS DE BADGES Y CLASES
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
        case "REEFER": return "❄️";
        case "HAZMAT": return "☢️";
        case "DRY":
        default:       return "📦";
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
// ⚙️  UTILIDADES DE UI
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