import * as THREE from 'three';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // For player jumping/falling
        this.runes = [];
        this.debris = [];
        
        this.generateSkyArena();
        this.createFloatingDebris();
        this.createSeaOfClouds();
    }

    createPlatform(cx, cy, cz, radius, height, colorHex=0x00ffff) {
        // Main Stone Base
        const geo = new THREE.CylinderGeometry(radius, radius * 0.8, height, 32);
        const mat = new THREE.MeshStandardMaterial({ color: 0xdddddf, roughness: 0.8, flatShading: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, cy, cz);
        this.scene.add(mesh);

        // Glowing Rune Ring
        const ringGeo = new THREE.RingGeometry(radius * 0.7, radius * 0.85, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(cx, cy + height/2 + 0.05, cz);
        this.scene.add(ring);

        this.runes.push({
            mesh: ring,
            mat: ringMat,
            x: cx, z: cz, r: radius,
            pulseTime: Math.random() * 10,
            flashTime: 0
        });

        // Collider mapping for Player.js
        this.colliders.push({
            type: 'cylinder',
            x: cx, z: cz, y: cy + height/2,
            radius: radius
        });
    }

    createAxisBridge(cx, cy, cz, width, length, isZAxis) {
        // width represents thickness, length represents spread
        // isZAxis means the bridge runs ALONG the Z axis (so it's long in Z, thick in X)
        const dimX = isZAxis ? width : length;
        const dimZ = isZAxis ? length : width;
        
        const geo = new THREE.BoxGeometry(dimX, 1.5, dimZ);
        const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx, cy, cz);
        this.scene.add(mesh);

        const halfX = dimX / 2;
        const halfZ = dimZ / 2;
        
        this.colliders.push({
            type: 'box',
            minX: cx - halfX, maxX: cx + halfX,
            minZ: cz - halfZ, maxZ: cz + halfZ,
            y: cy + 0.75
        });
    }

    generateSkyArena() {
        // Central Arena — large stone disk
        this.createPlatform(0, -2, 0, 40, 5, 0x00ffff);

        // Satellite Islands — bigger and pushed further out
        this.createPlatform(0,  -2, -80, 25, 4, 0xff00ff); // North
        this.createPlatform(0,  -2,  80, 25, 4, 0xffaa00); // South
        this.createPlatform(80, -2,   0, 25, 4, 0x00ff88); // East
        this.createPlatform(-80,-2,   0, 25, 4, 0xff3300); // West

        // Bridges connecting center to satellites (wider so they're walkable)
        this.createAxisBridge(0,   -1, -47.5, 12, 20, true);  // Center -> North
        this.createAxisBridge(0,   -1,  47.5, 12, 20, true);  // Center -> South
        this.createAxisBridge(47.5,  -1,   0, 12, 20, false); // Center -> East
        this.createAxisBridge(-47.5, -1,   0, 12, 20, false); // Center -> West
    }

    createFloatingDebris() {
        // Procedurally generate broken stone rocks orbiting the arena
        const geo = new THREE.DodecahedronGeometry(2);
        const mat = new THREE.MeshStandardMaterial({ color: 0xdddddf, roughness: 0.9, flatShading: true });
        
        for (let i = 0; i < 40; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            const radius = 60 + Math.random() * 50;
            const angle = Math.random() * Math.PI * 2;
            const y = -15 + Math.random() * 20;
            
            mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
            const scale = 0.5 + Math.random() * 2.5;
            mesh.scale.set(scale, scale, scale);
            
            this.scene.add(mesh);
            this.debris.push({
                mesh: mesh,
                angle: angle,
                radius: radius,
                speed: 0.1 + Math.random() * 0.2,
                rotSpeedX: (Math.random() - 0.5) * 2,
                rotSpeedY: (Math.random() - 0.5) * 2,
                yOffset: y,
                bobFreq: 0.5 + Math.random() * 2,
                bobTime: Math.random() * 10
            });
        }
    }

    createSeaOfClouds() {
        const starGeo = new THREE.BufferGeometry();
        const starCount = 3000;
        const positions = new Float32Array(starCount * 3);
        
        for(let i=0; i<starCount*3; i+=3) {
            positions[i] = (Math.random() - 0.5) * 600; 
            positions[i+1] = -40 + (Math.random() - 0.5) * 10; // Cloud layer height
            positions[i+2] = (Math.random() - 0.5) * 600; 
        }
        
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starMat = new THREE.PointsMaterial({ color: 0x8888aa, size: 2.0, transparent: true, opacity: 0.5, fog: true });
        
        this.stars = new THREE.Points(starGeo, starMat);
        this.scene.add(this.stars);
    }

    flashPlatform(x, z) {
        // Find the platform we landed on
        for(let r of this.runes) {
            const dx = x - r.x;
            const dz = z - r.z;
            if (dx*dx + dz*dz <= r.r*r.r) {
                r.flashTime = 1.0; // Trigger flash
                break;
            }
        }
    }

    update(dt) {
        if(this.stars) {
            this.stars.rotation.y += dt * 0.05; // Cinematic cloud rotation
        }

        // Animate Runes (pulse + flash)
        for(let r of this.runes) {
            r.pulseTime += dt * 2.0;
            const baseOpacity = 0.4 + Math.sin(r.pulseTime) * 0.2;
            
            if (r.flashTime > 0) {
                r.flashTime -= dt * 3.0; // Decay flash
                const flashOp = Math.max(0, r.flashTime);
                r.mat.opacity = baseOpacity + flashOp;
                r.mat.color.setHSL(r.mat.color.getHSL({}).h, 1.0, 0.5 + flashOp*0.5); // Brighten
            } else {
                r.mat.opacity = baseOpacity;
            }
        }

        // Animate Debris
        for(let d of this.debris) {
            d.angle += d.speed * dt;
            d.bobTime += d.bobFreq * dt;
            
            d.mesh.position.x = Math.cos(d.angle) * d.radius;
            d.mesh.position.z = Math.sin(d.angle) * d.radius;
            d.mesh.position.y = d.yOffset + Math.sin(d.bobTime) * 2.0; // Bobbing
            
            d.mesh.rotation.x += d.rotSpeedX * dt;
            d.mesh.rotation.y += d.rotSpeedY * dt;
        }
    }
}
