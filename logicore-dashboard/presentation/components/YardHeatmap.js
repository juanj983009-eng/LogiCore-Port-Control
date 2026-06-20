let tooltipElement = null;

function getOrCreateTooltip() {
    if (typeof document === 'undefined') return null;
    if (!tooltipElement) {
        tooltipElement = document.getElementById("heatmap-tooltip");
        if (!tooltipElement) {
            tooltipElement = document.createElement("div");
            tooltipElement.id = "heatmap-tooltip";
            tooltipElement.className = "heatmap-tooltip";
            tooltipElement.style.position = "absolute";
            tooltipElement.style.display = "none";
            document.body.appendChild(tooltipElement);
        }
    }
    return tooltipElement;
}

const YardHeatmap = {
    /**
     * Render or update the heatmap grid.
     * Performs O(1) selector lookup per slot instead of wiping innerHTML.
     */
    render(gridElement, contenedores, totalSlotsCapacity = 30) {
        if (!gridElement) return;

        const ocupados = contenedores.length;
        const totalSlots = Math.max(totalSlotsCapacity, ocupados);

        // Update stats counters if they exist in the DOM
        const hmOccupied = document.getElementById("hm-occupied");
        const hmFree     = document.getElementById("hm-free");
        const hmCapacity = document.getElementById("hm-capacity");
        if (hmOccupied) hmOccupied.textContent = ocupados;
        if (hmFree)     hmFree.textContent     = Math.max(0, totalSlots - ocupados);
        if (hmCapacity) hmCapacity.textContent = totalSlots;

        const filas = ['A', 'B', 'C', 'D', 'E'];
        const columnas = [1, 2, 3, 4, 5, 6];
        const overflowRows = ['F', 'G', 'H', 'I', 'J'];

        const renderSlot = (idx, rowChar, colNum) => {
            const isOcupad = idx < ocupados;
            const c = contenedores[idx]; // Undefined if slot is empty
            const slotId = `yard-slot-${idx}`;
            const bayCode = rowChar + colNum;
            let slot = document.getElementById(slotId);

            // 1. If slot does not exist, create it and append to grid
            if (!slot) {
                slot = document.createElement("div");
                slot.id = slotId;
                slot.setAttribute("role", "gridcell");
                
                // Centered bay code label
                const numEl = document.createElement("span");
                numEl.className = "hm-slot__num";
                numEl.textContent = bayCode;
                numEl.setAttribute("aria-hidden", "true");
                slot.appendChild(numEl);

                // Add mouse event listeners for dynamic body-appended tooltip
                slot.addEventListener("mouseenter", (event) => {
                    if (!slot.classList.contains("hm-slot--occupied")) return;
                    const text = slot.getAttribute("data-tooltip");
                    if (text) {
                        const tooltip = getOrCreateTooltip();
                        if (tooltip) {
                            tooltip.textContent = text;
                            tooltip.style.display = "block";
                        }
                    }
                });

                slot.addEventListener("mousemove", (event) => {
                    if (!slot.classList.contains("hm-slot--occupied")) return;
                    const text = slot.getAttribute("data-tooltip");
                    if (text) {
                        const tooltip = getOrCreateTooltip();
                        if (tooltip) {
                            tooltip.textContent = text;
                            tooltip.style.display = "block";
                            tooltip.style.top = (event.pageY - tooltip.offsetHeight - 15) + "px";
                            tooltip.style.left = (event.pageX - (tooltip.offsetWidth / 2)) + "px";
                        }
                    }
                });

                slot.addEventListener("mouseleave", () => {
                    const tooltip = getOrCreateTooltip();
                    if (tooltip) {
                        tooltip.style.display = "none";
                    }
                });

                gridElement.appendChild(slot);
            }

            // 2. Reconcile states & classes
            const isFull = isOcupad && (idx >= 4);
            const expectedClass = "hm-slot " + 
                                  (isOcupad ? "hm-slot--occupied" : "hm-slot--empty yard-cell-empty") +
                                  (isFull ? " hm-slot--full" : "");
            if (slot.className !== expectedClass) {
                slot.className = expectedClass;
            }

            // Ensure slot text content is correct
            const numEl = slot.querySelector(".hm-slot__num");
            if (numEl && numEl.textContent !== bayCode) {
                numEl.textContent = bayCode;
            }

            // Drive visual intensity from occupancy
            if (isOcupad) {
                const levels = {
                    1: { bg: "#d4e8eb", color: "#004d51", border: "#a6d3d9" },
                    2: { bg: "#7bb4bc", color: "#ffffff", border: "#62a0a9" },
                    3: { bg: "#5ca2ac", color: "#ffffff", border: "#468e99" },
                    4: { bg: "#39818a", color: "#ffffff", border: "#2d6f77" },
                    5: { bg: "#00555a", color: "#ffffff", border: "#004044" }
                };
                const level = Math.min(idx + 1, 5);
                const config = levels[level];
                slot.style.setProperty("background",   config.bg,     "important");
                slot.style.setProperty("border-color", config.border, "important");
                slot.style.setProperty("color",        config.color,  "important");
            } else {
                slot.style.setProperty("background",   "#ffffff",                  "important");
                slot.style.setProperty("border-color", "#e3dfd8",                  "important");
                slot.style.setProperty("color",        "#94a3b8",                  "important");
            }

            // 3. Reconcile tooltips
            if (isOcupad) {
                const tooltipText = `ID: ${c.codigoId}\nDestino: ${c.destino}\nPeso: ${(+c.peso).toFixed(1)} Tn\nPrioridad: ${c.prioridad}`;
                if (slot.getAttribute("data-tooltip") !== tooltipText) {
                    slot.setAttribute("data-tooltip", tooltipText);
                    slot.classList.add("has-tooltip");
                }
            } else {
                if (slot.hasAttribute("data-tooltip")) {
                    slot.removeAttribute("data-tooltip");
                    slot.classList.remove("has-tooltip");
                }
            }

            // Accessibility label reconciliation
            const expectedAria = isOcupad ? `Slot ${bayCode}: ${c.codigoId} → ${c.destino}` : `Slot ${bayCode}: libre`;
            if (slot.getAttribute("aria-label") !== expectedAria) {
                slot.setAttribute("aria-label", expectedAria);
            }
        };

        // Render standard 5x6 grid (30 slots) unconditionally
        let i = 0;
        for (const rowChar of filas) {
            for (const colNum of columnas) {
                renderSlot(i, rowChar, colNum);
                i++;
            }
        }

        // Render overflow slots if occupied containers exceeds 30
        for (; i < totalSlots; i++) {
            const rowIndex = Math.floor(i / 6);
            const colIndex = (i % 6) + 1;
            const rowChar = (rowIndex < 5) ? filas[rowIndex] : (overflowRows[rowIndex - 5] || "Z");
            renderSlot(i, rowChar, colIndex);
        }

        // 4. Prune extra slots if totalSlots capacity decreased
        while (gridElement.children.length > totalSlots) {
            gridElement.lastChild.remove();
        }
    }
};

if (typeof window !== 'undefined') {
    window.YardHeatmap = YardHeatmap;
}
if (typeof module !== 'undefined') {
    module.exports = YardHeatmap;
}
