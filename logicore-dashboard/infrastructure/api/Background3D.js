const Background3D = {
    init() {
        const canvas = document.getElementById('bg-3d-canvas');
        if (!canvas) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#F8FAFC'); // Fondo claro empresarial

        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            1,
            1000
        );
        camera.position.z = 400;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // ── Configuración de la Red de Partículas ──────────────────────────
        const particleCount = 80; // Densidad controlada para alto rendimiento
        const maxDistance   = 90; // Distancia máxima de enlace entre nodos

        const geometry          = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particlesData     = [];

        // Inicializar posiciones aleatorias en un cubo virtual de datos
        for (let i = 0; i < particleCount; i++) {
            const x = Math.random() * 600 - 300;
            const y = Math.random() * 600 - 300;
            const z = Math.random() * 600 - 300;

            particlePositions[i * 3]     = x;
            particlePositions[i * 3 + 1] = y;
            particlePositions[i * 3 + 2] = z;

            particlesData.push({
                velocity: new THREE.Vector3(
                    -1 + Math.random() * 2,
                    -1 + Math.random() * 2,
                    -1 + Math.random() * 2
                ).multiplyScalar(0.3),
                numConnections: 0
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

        // Material de los Nodos — puntos cian operativos de alta intensidad
        const pMaterial = new THREE.PointsMaterial({
            color:       0x0891B2, // Azul cian operativo saturado
            size:        4,
            blending:    THREE.NormalBlending,
            transparent: true,
            opacity:     0.6
        });

        const pointCloud = new THREE.Points(geometry, pMaterial);
        scene.add(pointCloud);

        // ── Estructura dinámica para las líneas de interconexión ───────────
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({
            color:       0x94A3B8, // Gris pizarra industrial
            transparent: true,
            opacity:     0.15      // Opacidad milimétrica para no estorbar la lectura
        });

        const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
        scene.add(lineMesh);

        // ── Interactividad sutil con el cursor del mouse ───────────────────
        // mousemove sobre window — el canvas tiene pointer-events: none
        // por lo que los formularios y controles nunca son interceptados
        let mouseX = 0, mouseY = 0;
        window.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - window.innerWidth  / 2) * 0.08;
            mouseY = (event.clientY - window.innerHeight / 2) * 0.08;
        });

        // ── Bucle de animación ─────────────────────────────────────────────
        // Actualización de posiciones + cálculo de distancias O(N²) controlado
        function animate() {
            requestAnimationFrame(animate);

            const positions     = pointCloud.geometry.attributes.position.array;
            const linePositions = [];

            for (let i = 0; i < particleCount; i++) {
                // Mover nodos basados en su velocidad interna
                positions[i * 3]     += particlesData[i].velocity.x;
                positions[i * 3 + 1] += particlesData[i].velocity.y;
                positions[i * 3 + 2] += particlesData[i].velocity.z;

                // Rebote en los límites del cubo virtual
                if (positions[i * 3]     < -300 || positions[i * 3]     > 300) particlesData[i].velocity.x *= -1;
                if (positions[i * 3 + 1] < -300 || positions[i * 3 + 1] > 300) particlesData[i].velocity.y *= -1;
                if (positions[i * 3 + 2] < -300 || positions[i * 3 + 2] > 300) particlesData[i].velocity.z *= -1;

                // Calcular cercanía con otros nodos para trazar los enlaces
                for (let j = i + 1; j < particleCount; j++) {
                    const dx   = positions[i * 3]     - positions[j * 3];
                    const dy   = positions[i * 3 + 1] - positions[j * 3 + 1];
                    const dz   = positions[i * 3 + 2] - positions[j * 3 + 2];
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (dist < maxDistance) {
                        // Segmento de línea: inicio → fin
                        linePositions.push(
                            positions[i * 3],     positions[i * 3 + 1],     positions[i * 3 + 2],
                            positions[j * 3],     positions[j * 3 + 1],     positions[j * 3 + 2]
                        );
                    }
                }
            }

            pointCloud.geometry.attributes.position.needsUpdate = true;

            // Actualizar dinámicamente la malla de líneas conectadas
            lineMesh.geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(linePositions, 3)
            );

            // Efecto sutil de paralaje basado en el cursor
            camera.position.x += (mouseX  - camera.position.x) * 0.05;
            camera.position.y += (-mouseY - camera.position.y) * 0.05;
            camera.lookAt(scene.position);

            renderer.render(scene, camera);
        }
        animate();

        // ── Control de redimensionamiento de ventana ───────────────────────
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
};

if (typeof window !== 'undefined') window.Background3D = Background3D;
