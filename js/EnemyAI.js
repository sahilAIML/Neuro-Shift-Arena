import * as THREE from 'three';

const AI_MODES = {
    AGGRESSIVE: { id: 0, name: 'AGGRESSIVE', uiClass: 'ai-mode-aggressive', color: 0xff3333 },
    DEFENSIVE: { id: 1, name: 'DEFENSIVE', uiClass: 'ai-mode-defensive', color: 0x3388ff },
    PREDICTIVE: { id: 2, name: 'PREDICTIVE', uiClass: 'ai-mode-predictive', color: 0xff00ff }
};

export class EnemyAI {
    constructor(scene, ui, audio, targetPlayer, ruleEngine, vfxManager, scoreManager) {
        this.scene = scene;
        this.ui = ui;
        this.audio = audio;
        this.player = targetPlayer;
        this.ruleEngine = ruleEngine;
        this.vfx = vfxManager;
        this.scoreManager = scoreManager;

        this.enemies = [];
        this.boss = null;

        // Load generated AI images
        const texLoader = new THREE.TextureLoader();
        this.droneTex = texLoader.load('./assets/drone.png');
        this.bossTex = texLoader.load('./assets/boss.png');

        // Custom shader material to discard black backgrounds natively without translucent Additive blending!
        const makeMaterial = (tex) => {
            const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, blending: THREE.NormalBlending, transparent: true, depthWrite: false });
            mat.onBeforeCompile = (shader) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <map_fragment>',
                    `
                    #include <map_fragment>
                    // Discard dark/black pixels to act as an alpha mask for the boss and drones
                    float luminance = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
                    if (luminance < 0.1) discard;
                    diffuseColor.rgb *= 1.5; // Slight brightness boost to be visible
                    `
                );
            };
            return mat;
        };

        this.materials = {
            [AI_MODES.AGGRESSIVE.id]: makeMaterial(this.droneTex),
            [AI_MODES.DEFENSIVE.id]: makeMaterial(this.droneTex),
            [AI_MODES.PREDICTIVE.id]: makeMaterial(this.droneTex),
        };

        this.bossMaterials = {
            [AI_MODES.AGGRESSIVE.id]: makeMaterial(this.bossTex),
            [AI_MODES.DEFENSIVE.id]: makeMaterial(this.bossTex),
            [AI_MODES.PREDICTIVE.id]: makeMaterial(this.bossTex),
        };

        this.learningProgress = 0;
        this.playerHitCount = 0;
        this.playerJumpCount = 0;

        this.projectiles = [];

        this.projectiles = [];

        this.waveNumber = 1;
        this.spawnWave(this.waveNumber);
    }

    spawnWave(waveNum) {
        let currentLevel = Math.floor((waveNum - 1) / 4) + 1;
        let waveInLevel = ((waveNum - 1) % 4) + 1;

        if (waveInLevel === 4) {
            this.spawnBoss(currentLevel);
            // Spawn some support grunts based on level
            for (let i = 0; i < currentLevel; i++) this.spawnGrunt(currentLevel);
            this.ui.showRuleShift(`LEVEL ${currentLevel} BOSS`, "Class V Threat Detected!");
        } else {
            // Normal waves
            let gruntCount = (currentLevel * 2) + waveInLevel + 1;
            for (let i = 0; i < gruntCount; i++) this.spawnGrunt(currentLevel);
            this.ui.showRuleShift(`LEVEL ${currentLevel}`, `WAVE ${waveInLevel} Engaged`);
        }
    }

    createEnemySprite(size, isBoss) {
        const mat = isBoss ? this.bossMaterials[AI_MODES.AGGRESSIVE.id] : this.materials[AI_MODES.AGGRESSIVE.id];
        const sprite = new THREE.Sprite(mat.clone()); // Clone so we can change opacity individually
        sprite.scale.set(size, size, 1);
        return sprite;
    }

    spawnGrunt(level = 1) {
        const sprite = this.createEnemySprite(4, false); // size 4 fits
        sprite.position.set(Math.random() * 40 - 20, 2, Math.random() * 40 - 20);
        this.scene.add(sprite);

        this.enemies.push({
            mesh: sprite, // named mesh for compatibility with raycaster
            hp: 30 + (level * 20), maxHp: 30 + (level * 20),
            mode: AI_MODES.AGGRESSIVE,
            velocity: new THREE.Vector3(),
            attackTimer: 0,
            isBoss: false
        });
    }

    spawnBoss(level = 1) {
        // Boss is massive
        const sprite = this.createEnemySprite(12, true);
        sprite.position.set(0, 5, -30);
        this.scene.add(sprite);

        this.boss = {
            mesh: sprite,
            hp: 200 + (level * 200), maxHp: 200 + (level * 200),
            mode: AI_MODES.AGGRESSIVE,
            velocity: new THREE.Vector3(),
            attackTimer: 0,
            isBoss: true, phase: 1
        };
        this.enemies.push(this.boss);
        this.ui.updateBossHealth(this.boss.hp, this.boss.maxHp);
    }

    notifyPlayerAction(actionType) {
        if (actionType === 'attack') this.playerHitCount++;
        if (actionType === 'jump') this.playerJumpCount++;

        this.learningProgress += 2;
        if (this.learningProgress > 100) {
            this.learningProgress = 0;
            this.adaptAllEnemies();
        }
        this.ui.updateAIMode(this.enemies[0]?.mode || AI_MODES.AGGRESSIVE, this.learningProgress);
    }

    adaptAllEnemies() {
        let newMode = AI_MODES.AGGRESSIVE;
        if (this.playerHitCount > 10) newMode = AI_MODES.DEFENSIVE;
        else if (this.playerJumpCount > 5) newMode = AI_MODES.PREDICTIVE;

        this.playerHitCount = 0;
        this.playerJumpCount = 0;

        this.enemies.forEach(en => {
            en.mode = newMode;
        });
        this.ui.updateAIMode(newMode, this.learningProgress);

        if (this.boss) {
            if (this.boss.hp < this.boss.maxHp * 0.5 && this.boss.phase === 1) {
                this.boss.phase = 2;
                this.boss.mode = AI_MODES.PREDICTIVE;
                this.ui.showRuleShift("BOSS OVERRIDE", "Prediction Matrix Online");
            }
        }
    }

    shootAtPlayer(enemy) {
        if (enemy.isBoss && enemy.phase === 2) {
            const baseDir = new THREE.Vector3().subVectors(this.player.camera.position, enemy.mesh.position).normalize();
            const offsets = [-0.15, 0, 0.15];
            for (let offset of offsets) {
                const dir = baseDir.clone();
                dir.x += offset;
                dir.normalize();
                this.createBullet(enemy, dir);
            }
        } else {
            const dir = new THREE.Vector3();
            if (enemy.mode.id === AI_MODES.PREDICTIVE.id) {
                const travelTime = enemy.mesh.position.distanceTo(this.player.camera.position) / 30;
                const predictedPos = this.player.camera.position.clone().add(this.player.velocity.clone().multiplyScalar(travelTime));
                dir.subVectors(predictedPos, enemy.mesh.position).normalize();
            } else {
                dir.subVectors(this.player.camera.position, enemy.mesh.position).normalize();
            }

            if (!enemy.isBoss) {
                dir.x += (Math.random() - 0.5) * 0.1;
                dir.y += (Math.random() - 0.5) * 0.1;
            }
            this.createBullet(enemy, dir);
        }
        this.audio.playShoot();
    }

    createBullet(enemy, dir) {
        const bulletGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        bulletGeo.rotateX(Math.PI / 2);
        const bulletMat = new THREE.MeshBasicMaterial({ color: enemy.mode.color, transparent: true, opacity: 0.8 });
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.copy(enemy.mesh.position);
        bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

        this.scene.add(bullet);
        this.projectiles.push({
            mesh: bullet, dir: dir,
            speed: 10, // Standard bullet speed
            life: 2.0,
            heals: false
        });
    }

    update(dt) {
        this.enemies.forEach(en => {
            // Make them colourful with a shifting rainbow effect (hue based on time and their id)
            const hue = (performance.now() * 0.001 + (en.mesh.id * 0.1)) % 1.0;
            en.mesh.material.color.setHSL(hue, 1.0, 0.6);

            // Billboards (Sprites) auto-face camera, so no rotation math needed!

            en.mesh.material.opacity = 1.0;

            // Flap slightly up and down to look alive
            en.mesh.position.y += Math.sin(performance.now() * 0.005 + en.mesh.id) * 0.02;

            const toPlayer = new THREE.Vector3().subVectors(this.player.camera.position, en.mesh.position);
            const dist = toPlayer.length();
            toPlayer.normalize();

            let speed = en.isBoss ? 4 : 7;

            if (en.mode.id === AI_MODES.AGGRESSIVE.id) {
                if (dist > 5) en.mesh.position.addScaledVector(toPlayer, speed * dt);
            } else if (en.mode.id === AI_MODES.DEFENSIVE.id) {
                if (dist < 15) en.mesh.position.addScaledVector(toPlayer, -speed * dt);
            } else if (en.mode.id === AI_MODES.PREDICTIVE.id) {
                if (dist > 20) en.mesh.position.addScaledVector(toPlayer, speed * dt);
                else {
                    const strafe = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
                    en.mesh.position.addScaledVector(strafe, speed * dt);
                }
            }

            en.attackTimer += dt;
            const threshold = en.isBoss ? 0.8 : (en.mode.id === AI_MODES.AGGRESSIVE.id ? 1.5 : 2.5);
            if (en.attackTimer > threshold) {
                en.attackTimer = 0;
                this.shootAtPlayer(en);
            }
        });

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.mesh.position.addScaledVector(p.dir, p.speed * dt);
            p.life -= dt;

            // Simple sphere collision for player (radius 2)
            if (p.mesh.position.distanceTo(this.player.camera.position) < 2.0) {
                if (p.heals) this.player.heal(10);
                else this.player.takeDamage(10);

                this.vfx.createExplosion(p.mesh.position, p.heals ? 0x00ffcc : 0xff3333, 5);
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
                continue;
            }

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }
    }

    damageEnemy(enemyIndex, amount, hitPoint) {
        if (enemyIndex < 0 || enemyIndex >= this.enemies.length) return;

        let dmg = amount;
        const en = this.enemies[enemyIndex];

        if (en.mode.id === AI_MODES.DEFENSIVE.id && dmg > 0) dmg *= 0.2;

        en.hp -= dmg;
        if (en.hp > en.maxHp) en.hp = en.maxHp;

        // Feedback
        this.scoreManager.addHit();
        
        // Engaging score popups
        const pts = Math.floor(10 * this.scoreManager.multiplier);
        const floatPosHits = hitPoint ? hitPoint.clone() : en.mesh.position.clone();
        floatPosHits.y += 1.5;
        this.vfx.spawnFloatingText(`+${pts}`, floatPosHits, '#aaff00');
        
        this.vfx.spawnFloatingText(dmg > 0 ? `-${dmg}` : `+${-dmg}`, hitPoint || en.mesh.position, dmg > 0 ? '#ff00ff' : '#00ffcc');
        this.vfx.createExplosion(hitPoint || en.mesh.position, en.mesh.material.color.getHex(), 5); // mini splash

        if (en.isBoss) {
            this.ui.updateBossHealth(en.hp, en.maxHp);
        }

        this.notifyPlayerAction('attack');

        if (en.hp <= 0) {
            this.vfx.createExplosion(en.mesh.position, en.mesh.material.color.getHex(), 40);
            this.scoreManager.addKill();
            
            const killPts = Math.floor(100 * this.scoreManager.multiplier);
            const floatPosKill = en.mesh.position.clone();
            floatPosKill.y += 2.5; // High above the enemy
            this.vfx.spawnFloatingText(`+${killPts} KILL`, floatPosKill, '#ffcc00');

            this.scene.remove(en.mesh);
            this.enemies.splice(enemyIndex, 1);
            this.audio.playHit(false);

            if (en.isBoss) {
                this.boss = null;
                // Game does not end, allow continued progression!
                if (this.ui.bossHealthContainer) this.ui.bossHealthContainer.classList.add('hidden');
            }

            if (this.enemies.length === 0 && !this.boss) {
                this.waveNumber++;
                setTimeout(() => this.spawnWave(this.waveNumber), 2000);
            }
        }
    }
}
