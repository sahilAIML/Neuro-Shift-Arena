import * as THREE from 'three';

/**
 * Procedural Explosion Particles and Floating Text
 */
export class VFXManager {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.texts = [];

        // Simple cube geometry for all particles to keep draw calls low
        this.particleGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    }

    createDashTrail(position, rotation, color) {
        const mat = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
        const geo = new THREE.BoxGeometry(2, 4, 2);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        mesh.rotation.copy(rotation);
        this.scene.add(mesh);
        
        this.particles.push({
            mesh: mesh, mat: mat, velocity: new THREE.Vector3(),
            life: 0.3, maxLife: 0.3, scale: 1.0, isTrail: true
        });
    }

    createExplosion(position, color, count = 20) {
        // Additive core flash
        const coreMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending });
        const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), coreMat);
        coreMesh.position.copy(position);
        this.scene.add(coreMesh);
        this.particles.push({
            mesh: coreMesh, mat: coreMat, velocity: new THREE.Vector3(),
            life: 0.2, maxLife: 0.2, scale: 1.0, isFlash: true
        });

        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending });
        
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.particleGeo, mat);
            mesh.position.copy(position);
            
            const v = new THREE.Vector3(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40
            );
            
            this.scene.add(mesh);
            this.particles.push({
                mesh: mesh,
                mat: mat,
                velocity: v,
                life: 0.6,
                maxLife: 0.6,
                scale: Math.random() * 0.5 + 0.5,
                rotSpeedX: (Math.random() - 0.5) * 20,
                rotSpeedY: (Math.random() - 0.5) * 20
            });
        }
    }

    createFootstep(position) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.6 });
        
        for (let i = 0; i < 3; i++) {
            const mesh = new THREE.Mesh(this.particleGeo, mat);
            // Random jitter around feet
            mesh.position.copy(position);
            mesh.position.x += (Math.random() - 0.5) * 1.5;
            mesh.position.z += (Math.random() - 0.5) * 1.5;
            
            // Float up and out slightly
            const v = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                Math.random() * 5 + 2,
                (Math.random() - 0.5) * 3
            );
            
            this.scene.add(mesh);
            this.particles.push({
                mesh: mesh, mat: mat, velocity: v,
                life: 0.4, maxLife: 0.4, scale: Math.random() * 0.4 + 0.2
            });
        }
    }

    // Since bringing in a heavy Font geometry library defeats the "lightweight" goal,
    // we use a DOM-based overlay for floating text mapped to 3D coords.
    spawnFloatingText(text, worldPos, color = '#ffffff') {
        const div = document.createElement('div');
        div.className = 'floating-damage';
        div.innerText = text;
        div.style.color = color;
        div.style.textShadow = `0 0 5px ${color}`;
        document.getElementById('ui-layer').appendChild(div);

        const jitterPos = worldPos.clone();
        jitterPos.x += (Math.random() - 0.5) * 2;
        jitterPos.y += (Math.random() - 0.5) * 2;

        this.texts.push({
            element: div,
            worldPos: jitterPos,
            life: 1.0,
            yOffset: 0
        });
    }

    update(dt, camera) {
        // Update 3D Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            if (!p.isFlash && !p.isTrail) {
                p.velocity.y -= 30 * dt;
                p.velocity.multiplyScalar(0.95); 
                p.mesh.position.addScaledVector(p.velocity, dt);
                if(p.rotSpeedX) p.mesh.rotation.x += p.rotSpeedX * dt;
                if(p.rotSpeedY) p.mesh.rotation.y += p.rotSpeedY * dt;
            }

            p.life -= dt;
            p.mat.opacity = p.life / p.maxLife;
            
            if (p.isFlash || p.isTrail) {
                const s = 1.0 + (1.0 - (p.life / p.maxLife)) * 1.5;
                p.mesh.scale.set(s,s,s);
            } else {
                const s = p.scale * (p.life / p.maxLife);
                p.mesh.scale.set(s, s, s);
            }

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mat.dispose();
                this.particles.splice(i, 1);
            }
        }

        // Update DOM Floating Text
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= dt;
            t.yOffset += 2 * dt; // Float up slightly in world space
            
            const tempPos = t.worldPos.clone();
            tempPos.y += t.yOffset;

            // Project to 2D Screen Space
            const projected = tempPos.project(camera);
            
            // Check if behind camera
            if (projected.z > 1) {
                t.element.style.display = 'none';
            } else {
                t.element.style.display = 'block';
                const x = (projected.x * .5 + .5) * window.innerWidth;
                const y = (projected.y * -.5 + .5) * window.innerHeight;
                
                t.element.style.left = `${x}px`;
                t.element.style.top = `${y}px`;
                t.element.style.opacity = Math.max(0, t.life);
                t.element.style.transform = `scale(${0.5 + t.life * 0.5})`;
            }

            if (t.life <= 0) {
                t.element.remove();
                this.texts.splice(i, 1);
            }
        }
    }
}
