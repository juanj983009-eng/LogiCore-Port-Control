/**
 * DoubleLinkedListComponent - Presentation Layer
 * Component responsible for rendering doubly linked list visual nodes.
 */

const DoubleLinkedListComponent = {
    currentDirection: 'IDA',
    render(containers) {
        const container = document.getElementById('linked-list-nodes-container');
        const nodeCountSpan = document.getElementById('node-count');
        if (!container) return;
        
        if (nodeCountSpan) {
            nodeCountSpan.textContent = `${containers.length} nodos`;
        }
        let html = '';
        
        // HEAD Boundary
        html += `<div class="dll-node-boundary">CABEZA<br><span style="font-size:10px;color:#94A3B8;">${this.currentDirection === 'IDA' ? 'NULL &larr;' : '&rarr;'}</span></div>`;
        
        const dataList = this.currentDirection === 'IDA' ? [...containers] : [...containers].reverse();
        
        dataList.forEach((c, index) => {
            // Flecha bidireccional entre nodos
            html += `<div class="dll-arrow">&rarr;<br>&larr;</div>`;
            
            const typeClass = (c.tipoCarga || 'STD').toLowerCase();
            const isAlert = (c.prioridad === 1 || String(c.prioridad) === '1' || (c.tipoCarga || '').toUpperCase() === 'HAZMAT');
            const nodeClass = isAlert ? 'dll-node nodo-alerta' : 'dll-node';
            
            html += `
                <div class="${nodeClass}" style="flex-shrink: 0; min-width: 240px;">
                    <span class="badge-type ${typeClass}">${c.tipoCarga || 'STD'}</span>
                    <div style="font-weight:800; color:#00555a; font-size:14px; margin-bottom:4px;">${c.codigoId}</div>
                    <div style="color:#00555a; opacity: 0.85; font-size:12px; font-weight:600; margin-bottom:2px;">${c.destino || 'N/A'}</div>
                    <div class="text-tonelaje" style="font-weight:800; font-size:14px; margin-top:6px;">${c.peso} Tn</div>
                </div>
            `;
        });
        
        // TAIL Boundary
        html += `<div class="dll-arrow" style="flex-shrink: 0;">&rarr;<br>&larr;</div>`;
        html += `<div class="dll-node-boundary" style="flex-shrink: 0;">COLA<br><span style="font-size:10px;color:#94A3B8;">${this.currentDirection === 'IDA' ? '&rarr; NULL' : '&larr;'}</span></div>`;
        
        // Nest the actual list container inside to preserve yard-list-ida ID and listeners
        container.innerHTML = `<div id="yard-list-ida" class="virtual-list-wrap virtual-list-wrap--yard" style="display: flex; flex-direction: row; flex-wrap: nowrap; width: 100%;">${html}</div>`;

        // Animación elástica y escalonada (staggered) de entrada de nodos con GSAP
        if (typeof gsap !== 'undefined') {
            const nodes = container.querySelectorAll('.dll-node');
            if (nodes.length > 0) {
                gsap.fromTo(nodes, 
                    { opacity: 0, x: -30, scale: 0.95 }, 
                    { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)", stagger: 0.05 }
                );
            }
        }
    }
};

if (typeof window !== 'undefined') {
    window.DoubleLinkedListComponent = DoubleLinkedListComponent;
}
if (typeof module !== 'undefined') {
    module.exports = DoubleLinkedListComponent;
}
