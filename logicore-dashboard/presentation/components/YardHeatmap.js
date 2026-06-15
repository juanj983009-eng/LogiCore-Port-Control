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
    render(gridElement, contenedores, totalSlotsCapacity = 50) {
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

        // Perform minimum reconciliation per slot
        for (let i = 0; i < totalSlots; i++) {
            const isOcupad = i < ocupados;
            const c = contenedores[i]; // Undefined if slot is empty
            const slotId = `yard-slot-${i}`;
            let slot = document.getElementById(slotId);

            // 1. If slot does not exist, create it and append to grid
            if (!slot) {
                slot = document.createElement("div");
                slot.id = slotId;
                slot.setAttribute("role", "gridcell");
                
                // Number label
                const numEl = document.createElement("span");
                numEl.className = "hm-slot__num";
                numEl.textContent = i + 1;
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

            // 2. Reconcile states & classes \u2014 weight-proportional intensity on occupied slots
            const expectedClass = "hm-slot " + (isOcupad ? "hm-slot--occupied" : "hm-slot--empty");
            if (slot.className !== expectedClass) {
                slot.className = expectedClass;
            }

            // Drive visual intensity from container weight (ContenedorResponseDTO.peso).
            // Clamp: 0 Tn \u2192 0.18 base opacity, 50+ Tn \u2192 1.0 full saturation.
            if (isOcupad) {
                const pesoVal  = Math.max(0, parseFloat(c.peso) || 0);
                const pesoMax  = 50; // operational ceiling in metric tons
                const ratio    = Math.min(pesoVal / pesoMax, 1.0);
                const alphaFill   = (0.14 + ratio * 0.42).toFixed(3);   // 0.14 – 0.56
                const alphaBorder = (0.28 + ratio * 0.48).toFixed(3);   // 0.28 – 0.76
                slot.style.setProperty("--hm-fill-alpha",   alphaFill);
                slot.style.setProperty("--hm-border-alpha", alphaBorder);
                slot.style.setProperty("background", `rgba(8, 145, 178, ${alphaFill})`, "important");
                slot.style.setProperty("border-color", `rgba(8, 145, 178, ${alphaBorder})`, "important");
            } else {
                // Clear weight-driven inline styles on empty slots
                slot.style.removeProperty("--hm-fill-alpha");
                slot.style.removeProperty("--hm-border-alpha");
                slot.style.setProperty("background", "#F1F5F9", "important");
                slot.style.setProperty("border-color", "#94A3B8", "important");
            }

            // 3. Reconcile tooltips and box icon
            if (isOcupad) {
                const tooltipText = `ID: ${c.codigoId}\n📍 Destino: ${c.destino}\n⚖️ Peso: ${(+c.peso).toFixed(1)} Tn\n⚡ Prioridad: ${c.prioridad}`;
                if (slot.getAttribute("data-tooltip") !== tooltipText) {
                    slot.setAttribute("data-tooltip", tooltipText);
                    slot.classList.add("has-tooltip");
                }
                
                // Ensure box icon exists
                if (!slot.querySelector(".hm-slot__icon")) {
                    const iconEl = document.createElement("i");
                    iconEl.className = "fa-solid fa-box hm-slot__icon";
                    iconEl.setAttribute("aria-hidden", "true");
                    slot.appendChild(iconEl);
                }
            } else {
                if (slot.hasAttribute("data-tooltip")) {
                    slot.removeAttribute("data-tooltip");
                    slot.classList.remove("has-tooltip");
                }
                // Remove box icon if it exists
                const icon = slot.querySelector(".hm-slot__icon");
                if (icon) {
                    icon.remove();
                }
            }

            // Accessibility label reconciliation
            const expectedAria = isOcupad ? `Slot ${i + 1}: ${c.codigoId} → ${c.destino}` : `Slot ${i + 1}: libre`;
            if (slot.getAttribute("aria-label") !== expectedAria) {
                slot.setAttribute("aria-label", expectedAria);
            }
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
