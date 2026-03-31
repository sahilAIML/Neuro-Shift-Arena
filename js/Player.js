import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(scene, camera, uiManager, audioManager, ruleEngine, vfxManager, environment) {
        this.scene = scene;
        this.camera = camera;
        this.ui = uiManager;
        this.audio = audioManager;
        this.ruleEngine = ruleEngine;
        this.vfx = vfxManager;
        this.environment = environment;

        this.controls = new PointerLockControls(camera, document.body);
        this.controls.getObject().position.set(0, 3, 0); // Safely spawn directly on center platform
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        this.hp = 100;
        this.maxHp = 100;
        
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        
        // Proper Platforming State
        this.isGrounded = true;
        this.jumpCount = 0; // Max 2 for double jump!

        this.raycaster = new THREE.Raycaster();
        this.railgunCooldown = 0;
        this.dashCooldown = 0;
        
        this.shakeTime = 0;
        this.shakeMag = 0;
        
        // AAA Polish
        this.headBobTime = 0;
        this.cameraTilt = 0;
        this.footstepTimer = 0;

        // Powerup Stats
        this.speedMultiplier = 1.0;
        this.fireRateMultiplier = 1.0;

        this.ruleEngine.onRuleChange((powerup) => {
            if (powerup.id === 1) { // Health Base
                this.heal(this.maxHp * 0.20);
            } else if (powerup.id === 2) { // Speed Base
                // Cap at 2.5x base speed
                this.speedMultiplier = Math.min(2.5, this.speedMultiplier + 0.15);
            } else if (powerup.id === 3) { // Fire Rate
                // Cap multiplier to 3x fire rate (dividing cooldown down to 33%)
                this.fireRateMultiplier = Math.min(3.0, this.fireRateMultiplier + 0.20);
            }
        });

        this.setupInputs();
    }

    setupInputs() {
        const onKeyDown = (event) => {
            let key = event.code;

            switch (key) {
                case 'ArrowUp': case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft': case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown': case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight': case 'KeyD': this.moveRight = true; break;
                case 'Space':
                    if (this.jumpCount < 2) {
                        const jumpForce = 90; // Standard jump force reinstated
                        this.velocity.y = jumpForce; 
                        this.jumpCount++;
                        this.isGrounded = false;
                        
                        this.audio.playJump();
                        if(this.jumpCount === 2) { // Double jump VFX
                           this.vfx.createExplosion(this.camera.position.clone().sub(new THREE.Vector3(0,2,0)), 0xffffff, 5);
                        }
                    }
                    if (window.enemyAI) window.enemyAI.notifyPlayerAction('jump');
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.dash();
                    break;
            }
        };

        const onKeyUp = (event) => {
            let key = event.code;

            switch (key) {
                case 'ArrowUp': case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft': case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown': case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight': case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        document.addEventListener('mousedown', (event) => {
            if (!this.controls.isLocked) return;
            if (event.button === 0) { 
                this.shootPrimary();
            } else if (event.button === 2) { 
                this.shootRailgun();
            }
            if (window.enemyAI) window.enemyAI.notifyPlayerAction('attack');
        });
        
        document.addEventListener('contextmenu', e => e.preventDefault());
    }
    
    addShake(mag, time) {
        this.shakeMag = mag;
        this.shakeTime = time;
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;
        this.ui.updateHealth(this.hp, this.maxHp);
        this.addShake(0.5, 0.3);
        if (this.ui.showDamageOverlay) this.ui.showDamageOverlay();

        if (this.hp <= 0) {
            this.isDead = true;
            if (window.scoreManager) {
                window.scoreManager.saveTopScore();
                this.ui.updateScoreboard(window.scoreManager.getTopScores());
            }
            this.ui.showGameOver(false);
            this.controls.unlock();
        }
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.ui.updateHealth(this.hp, this.maxHp);
    }

    shootPrimary() {
        if (this.hp <= 0) return;
        this.audio.playShoot();
        this.addShake(0.05, 0.1);
        this.raycastHitLogic(10, 0x00ffff, 0.1); 
    }
    
    shootRailgun() {
        if (this.hp <= 0 || this.railgunCooldown > 0) return;
        this.railgunCooldown = 3.0 / this.fireRateMultiplier; 
        this.audio.playRailgun();
        this.addShake(1.5, 0.5); // massive punch
        this.camera.fov = 95; // instant recoil FOV burst!
        this.camera.updateProjectionMatrix();
        this.raycastHitLogic(50, 0xff00ff, 0.8); 
    }

    raycastHitLogic(damage, colorHex, thickness) {
        this.raycaster.setFromCamera(new THREE.Vector2(0,0), this.camera);
        this.raycaster.params.Points.threshold = 2.0; // Thick hitboxes for sprites
        
        const lineGeo = new THREE.CylinderGeometry(thickness, thickness, 100, 8);
        lineGeo.rotateX(Math.PI / 2);
        lineGeo.translate(0, 0, -50);
        
        const lineMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
        const line = new THREE.Mesh(lineGeo, lineMat);
        
        line.position.copy(this.camera.position);
        line.position.y -= 0.5; 
        line.quaternion.copy(this.camera.quaternion);
        this.scene.add(line);
        
        let op = 0.8;
        const fadeInt = setInterval(() => {
            op -= 0.1;
            lineMat.opacity = op;
            if(op <= 0) {
                this.scene.remove(line);
                lineMat.dispose();
                lineGeo.dispose();
                clearInterval(fadeInt);
            }
        }, 16);

        if (window.enemyAI) {
            const meshes = window.enemyAI.enemies.map(e => e.mesh);
            const intersects = this.raycaster.intersectObjects(meshes, true);
            if (intersects.length > 0) {
                const intersect = intersects[0];
                const rootMesh = intersect.object.parent === this.scene ? intersect.object : intersect.object.parent;
                const idx = window.enemyAI.enemies.findIndex(e => e.mesh === rootMesh);
                if (idx !== -1) {
                    window.enemyAI.damageEnemy(idx, damage, intersect.point);
                }
            }
        }
    }

    dash() {
        if (this.jumpCount >= 2 || this.dashCooldown > 0) return; // Prevent infinite air dashes if not grounded
        this.dashCooldown = 2.0; // 2 seconds down
        this.audio.playDash();

        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();
        
        const speedMultiplier = 1000 * this.speedMultiplier;
        this.velocity.addScaledVector(dir, speedMultiplier);
        this.cameraTilt = (Math.random() > 0.5 ? 1 : -1) * 0.3; // harsh tilt jolt
        this.camera.fov = 85; // Wind rush effect
        this.camera.updateProjectionMatrix();
        
        // Dash Ghosting VFX
        this.vfx.createDashTrail(this.camera.position, this.camera.rotation, 0x00f3ff);
    }

    fallRespawn() {
        this.takeDamage(10); // Reduced penalty
        this.controls.getObject().position.set(0, 5, 0); // Safely drop exactly center
        this.velocity.set(0,0,0);
        this.isGrounded = false;
        this.addShake(1.0, 0.5);
    }

    getFloorHeight(playerX, playerZ, playerY) {
        let maxFloorY = -Infinity;
        // Check all environment colliders to see if we're standing on them
        if (!this.environment || !this.environment.colliders) return maxFloorY;

        for(const col of this.environment.colliders) {
            if (col.type === 'cylinder') {
                const dx = playerX - col.x;
                const dz = playerZ - col.z;
                if ((dx*dx + dz*dz) <= col.radius*col.radius) {
                    // Huge tolerance to prevent any chance of clipping through at fast framerates
                    if (col.y > maxFloorY && col.y <= playerY + 30.0) maxFloorY = col.y;
                }
            } else if (col.type === 'box') {
                if (playerX >= col.minX && playerX <= col.maxX && playerZ >= col.minZ && playerZ <= col.maxZ) {
                    if (col.y > maxFloorY && col.y <= playerY + 30.0) maxFloorY = col.y;
                }
            }
        }

        return maxFloorY;
    }

    update(dt) {
        if (!this.controls.isLocked) return;
        if (this.railgunCooldown > 0) this.railgunCooldown -= dt;
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        
        this.ui.updateAbilities(
            Math.max(0, 1.0 - (this.dashCooldown / 2.0)), 
            Math.max(0, 1.0 - (this.railgunCooldown / 3.0))
        );

        // Shake logic via FOV to avoid positional jitter
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            this.camera.fov += (Math.random() - 0.5) * this.shakeMag * 5;
            this.camera.updateProjectionMatrix();
            this.shakeMag *= 0.85;
        } else if (Math.abs(this.camera.fov - 75) > 0.1) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 75, 0.1);
            this.camera.updateProjectionMatrix();
        }

        const friction = 10.0;
        this.velocity.x -= this.velocity.x * friction * dt;
        this.velocity.z -= this.velocity.z * friction * dt;

        let gravity = -400.0; // Reduced gravity for slow fall

        this.velocity.y += gravity * dt; 

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        let moveSpeed = 200.0 * this.speedMultiplier;

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * moveSpeed * dt;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * moveSpeed * dt;

        // Apply XZ Movement (Strictly XZ plane using world directional vector, immune to Euler gimbal lock)
        const forwardVector = new THREE.Vector3();
        this.camera.getWorldDirection(forwardVector);
        forwardVector.y = 0;
        if (forwardVector.lengthSq() > 0) forwardVector.normalize();
        
        // Right vector is cross product with Y-up
        const rightVector = new THREE.Vector3(forwardVector.z, 0, -forwardVector.x);

        const fwdDist = -this.velocity.z * dt;
        const rightDist = -this.velocity.x * dt;

        const dx = (forwardVector.x * fwdDist) + (rightVector.x * rightDist);
        const dz = (forwardVector.z * fwdDist) + (rightVector.z * rightDist);

        this.controls.getObject().position.x += dx;
        this.controls.getObject().position.z += dz;

        // --- TRUE PHYSICAL COLLISION ---
        const pos = this.controls.getObject().position;
        const currentFloorHeight = this.getFloorHeight(pos.x, pos.z, pos.y);
        
        // Apply Y Movement Last
        pos.y += (this.velocity.y * dt);
        
        let bobbingOffset = 0;

        // --- GAME FEEL: Walk Particles ---
        const flatVel = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
        if (this.isGrounded && flatVel > 10) {
            this.headBobTime += dt * (flatVel * 0.04);
            bobbingOffset = Math.sin(this.headBobTime) * 0.04; // Very subtle grounded step
            
            this.footstepTimer -= dt;
            if (this.footstepTimer <= 0) {
                this.vfx.createFootstep(pos.clone().sub(new THREE.Vector3(0, 2, 0)));
                this.footstepTimer = 0.2; 
            }
        } else {
            this.headBobTime = THREE.MathUtils.lerp(this.headBobTime, 0, 0.1);
            bobbingOffset = Math.sin(this.headBobTime) * 0.04;
        }

        // Removed Strafe Tilt to keep horizon perfectly flat like 'earth'

        // If we fall below the valid floor surface we are directly over
        if (currentFloorHeight !== -Infinity && pos.y <= currentFloorHeight + 2.0) {
            const prevIso = this.isGrounded;
            pos.y = currentFloorHeight + 2.0 + bobbingOffset;
            this.velocity.y = 0;
            
            // Landing impact if we were falling
            if(!prevIso) {
                if(this.jumpCount > 0) this.addShake(1.5, 0.2); 
                this.environment.flashPlatform(pos.x, pos.z); // Env reaction
                this.vfx.createFootstep(pos.clone().sub(new THREE.Vector3(0, 2, 0))); // Dust poof
            }
            
            this.isGrounded = true;
            this.jumpCount = 0; // Reset jumps
        } else {
            this.isGrounded = false;
        }

        // --- DEATH BARRIER ---
        if (pos.y < -30) {
            this.fallRespawn();
        }
    }
}
