import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { UIManager } from './UI.js';
import { AudioManager } from './Audio.js';
import { RuleEngine } from './RuleEngine.js';
import { Environment } from './Environment.js';
import { Player } from './Player.js';
import { EnemyAI } from './EnemyAI.js';
import { ScoreManager } from './ScoreManager.js';
import { VFXManager } from './VFX.js';

let camera, scene, renderer, composer, glitchPass;
let uiManager, audioManager, ruleEngine, environment, player, enemyAI, scoreManager, vfxManager;
let prevTime = performance.now();
let gameRunning = false;

init();

function init() {
    uiManager = new UIManager();
    audioManager = new AudioManager();
    scoreManager = new ScoreManager(uiManager);
    window.scoreManager = scoreManager;

    uiManager.updateScoreboard(scoreManager.getTopScores());

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddf); // Light theme sky
    scene.fog = new THREE.FogExp2(0xdddddf, 0.005); // Lighter fog

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // AAA Tone Mapping to prevent blown-out whites!
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // Strictly capped to 1.0 to prevent blowout
    document.body.appendChild(renderer.domElement);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xddddf0, 0.7); // Bright ambient fill
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2); // Bright sun overhead
    dirLight.position.set(50, 100, -50);
    scene.add(dirLight);

    // Post Processing Core
    composer = new EffectComposer(renderer);
    
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom correctly clamped to only very bright/emissive objects
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.5, 0.85);
    bloomPass.threshold = 1.0; // Only bloom items with color values > 1.0 (emissives)
    bloomPass.strength = 1.5;
    bloomPass.radius = 0.5;
    composer.addPass(bloomPass);

    glitchPass = new GlitchPass();
    glitchPass.enabled = false;
    composer.addPass(glitchPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Systems init
    vfxManager = new VFXManager(scene);
    ruleEngine = new RuleEngine(uiManager, audioManager);
    
    ruleEngine.onRuleChange((rule) => {
        // UI logic and sound handles the notification, no glitch screen needed anymore!
        player.addShake(0.8, 0.3); // huge shake when powerup is acquired
    });

    environment = new Environment(scene);
    
    player = new Player(scene, camera, uiManager, audioManager, ruleEngine, vfxManager, environment);
    
    enemyAI = new EnemyAI(scene, uiManager, audioManager, player, ruleEngine, vfxManager, scoreManager);
    window.enemyAI = enemyAI; 

    // UI Hooks
    uiManager.onStart(() => {
        audioManager.resume();
        player.controls.lock();
        gameRunning = true;
        loop();
    });

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function loop() {
    requestAnimationFrame(loop);

    const time = performance.now();
    const dt = Math.min((time - prevTime) / 1000, 0.1); // clamp delta
    prevTime = time;

    if (gameRunning) {
        ruleEngine.update(dt);
        environment.update(dt);
        player.update(dt);
        enemyAI.update(dt);
        vfxManager.update(dt, camera);
        scoreManager.update(dt);
    }

    composer.render();
}
