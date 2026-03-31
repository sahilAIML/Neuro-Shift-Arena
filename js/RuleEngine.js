/**
 * Dynamic Powerup Engine
 * Randomly grants beneficial powerups to the player every 20-30 seconds.
 */

export const POWERUPS = {
    HEALTH_BOOST: { id: 1, name: "Health Boost", desc: "Armor Repaired +20%" },
    SPEED_BOOST: { id: 2, name: "Speed Boost", desc: "Mobility Core Overclocked +15%" },
    FIRE_RATE: { id: 3, name: "Fire Rate Boost", desc: "Weapon Cooldown Reduced" }
};

export class RuleEngine {
    constructor(uiManager, audioManager) {
        this.ui = uiManager;
        this.audio = audioManager;
        
        // No powerup at start
        this.currentRule = null;
        
        this.minTime = 20000; // 20s
        this.maxTime = 30000; // 30s
        
        this.timer = 0;
        this.targetTime = this.getRandomTime();
        
        this.onRuleChangeCallbacks = [];
    }
    
    getRandomTime() {
        return Math.random() * (this.maxTime - this.minTime) + this.minTime;
    }

    onRuleChange(cb) {
        this.onRuleChangeCallbacks.push(cb);
    }

    update(dt) {
        this.timer += dt * 1000; // dt is in seconds, timer in ms
        
        if (this.timer >= this.targetTime) {
            this.timer = 0;
            this.targetTime = this.getRandomTime();
            this.shiftRule();
        }
    }

    shiftRule() {
        const keys = Object.keys(POWERUPS);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        this.currentRule = POWERUPS[randomKey];

        // Notify UI and Audio
        this.ui.showRuleShift("POWERUP ACQUIRED", this.currentRule.desc);
        this.audio.playRuleShift();

        // Notify systems (Player)
        this.onRuleChangeCallbacks.forEach(cb => cb(this.currentRule));
    }
}
