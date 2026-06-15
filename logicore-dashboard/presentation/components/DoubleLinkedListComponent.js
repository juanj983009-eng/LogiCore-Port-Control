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
        
        nodeCountSpan.textContent = `${containers.length} nodos`;
        let html = '';
        
        // HEAD Boundary
        html += `<div class="dll-node-boundary">HEAD<br><span style="font-size:10px;color:#94A3B8;">${this.currentDirection === 'IDA' ? 'NULL &larr;' : '&rarr;'}</span></div>`;
        
        const dataList = this.currentDirection === 'IDA' ? [...containers] : [...containers].reverse();
        
        dataList.forEach((c, index) => {
            // Flecha bidireccional entre nodos
            html += `<div class="dll-arrow">&rarr;<br>&larr;</div>`;
            
            const typeClass = (c.tipoCarga || 'STD').toLowerCase();
            html += `
                <div class="dll-node">
                    <span class="badge-type ${typeClass}">${c.tipoCarga || 'STD'}</span>
                    <div style="font-weight:700; color:#0F172A; font-size:13px; margin-bottom:4px;">${c.codigoId}</div>
                    <div style="color:#475569; font-size:11px;">${c.destino || 'N/A'}</div>
                    <div style="font-weight:700; color:#0891B2; font-size:13px; margin-top:6px;">${c.peso} Tn</div>
                </div>
            `;
        });
        
        // TAIL Boundary
        html += `<div class="dll-arrow">&rarr;<br>&larr;</div>`;
        html += `<div class="dll-node-boundary">TAIL<br><span style="font-size:10px;color:#94A3B8;">${this.currentDirection === 'IDA' ? '&rarr; NULL' : '&larr;'}</span></div>`;
        
        // Nest the actual list container inside to preserve yard-list-ida ID and listeners
        container.innerHTML = `<div id="yard-list-ida" class="virtual-list-wrap virtual-list-wrap--yard" style="display: flex; align-items: center; gap: 8px; width: 100%;">${html}</div>`;
    }
};

if (typeof window !== 'undefined') {
    window.DoubleLinkedListComponent = DoubleLinkedListComponent;
}
if (typeof module !== 'undefined') {
    module.exports = DoubleLinkedListComponent;
}
