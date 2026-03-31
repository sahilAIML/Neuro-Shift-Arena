export class UIManager {
    constructor() {
        this.healthFill = document.getElementById('health-fill');
        this.bossHealthContainer = document.getElementById('boss-health-container');
        this.bossHealthFill = document.getElementById('boss-health-fill');
        
        this.aiModeText = document.getElementById('ai-mode');
        this.aiMeterFill = document.getElementById('ai-meter-fill');
        
        this.currentRuleText = document.getElementById('current-rule');
        this.rulePopup = document.getElementById('rule-popup');
        this.ruleDesc = document.getElementById('rule-desc');
        
        this.scoreVal = document.getElementById('score-val');
        this.comboTracker = document.getElementById('combo-tracker');
        this.comboVal = document.getElementById('combo-val');
        this.multiplierVal = document.getElementById('multiplier-val');
        
        this.dashFill = document.getElementById('ui-dash-fill');
        this.railFill = document.getElementById('ui-rail-fill');
        this.dashWasReady = true;
        this.railWasReady = true;
        
        this.hitmarker = document.getElementById('hitmarker');
        this.hud = document.getElementById('hud');
        
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over');
        this.endTitle = document.getElementById('end-title');
        this.endSubtitle = document.getElementById('end-subtitle');
        this.startBtn = document.getElementById('start-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.uiLayer = document.getElementById('ui-layer');
        this.damageOverlay = document.getElementById('damage-overlay');
        this.finalScoreDisplay = document.getElementById('final-score-display');

        this.onStartClicks = [];
        this.startBtn.addEventListener('click', () => {
            this.hideStartScreen();
            this.onStartClicks.forEach(cb => cb());
        });
        this.restartBtn.addEventListener('click', () => {
            location.reload(); 
        });
    }

    onStart(callback) { this.onStartClicks.push(callback); }
    hideStartScreen() { this.startScreen.classList.add('hidden'); }

    showGameOver(won = false) {
        this.gameOverScreen.classList.remove('hidden');
        document.exitPointerLock();
        
        if (window.scoreManager) {
            this.finalScoreDisplay.innerText = `FINAL SCORE: ${window.scoreManager.score.toString().padStart(6, '0')}`;
        }
        
        if (won) {
            this.endTitle.innerText = "SYSTEM PURGED";
            this.endTitle.style.color = "var(--neon-cyan)";
            this.endSubtitle.innerText = "THREAT NEUTRALIZED";
        } else {
            this.endTitle.innerText = "FATAL ERROR";
            this.endTitle.style.color = "var(--neon-red)";
            this.endSubtitle.innerText = "USER TERMINATED";
        }
    }

    showDamageOverlay() {
        if (!this.damageOverlay) return;
        this.damageOverlay.classList.remove('hidden');
        this.damageOverlay.classList.remove('active');
        void this.damageOverlay.offsetWidth; // Reflow
        this.damageOverlay.classList.add('active');
        setTimeout(() => this.damageOverlay.classList.remove('active'), 200);
    }

    updateHealth(current, max) {
        const percent = Math.max(0, (current / max) * 100);
        this.healthFill.style.width = percent + '%';
        this.hud.classList.remove('hud-shake');
        void this.hud.offsetWidth; // trigger reflow
        this.hud.classList.add('hud-shake');
    }

    updateBossHealth(current, max) {
        if (this.bossHealthContainer.classList.contains('hidden')) {
            this.bossHealthContainer.classList.remove('hidden');
        }
        const percent = Math.max(0, (current / max) * 100);
        this.bossHealthFill.style.width = percent + '%';
        if (current <= 0) this.bossHealthContainer.classList.add('hidden');
    }

    updateAIMode(modeConfig, learningPercent) {
        this.aiModeText.innerText = modeConfig.name;
        this.aiModeText.className = modeConfig.uiClass;
        this.aiMeterFill.style.width = Math.min(100, learningPercent) + '%';
    }

    showRuleShift(ruleName, ruleDescText) {
        this.currentRuleText.innerText = ruleName;
        this.ruleDesc.innerText = ruleDescText;
        
        const newPopup = this.rulePopup.cloneNode(true);
        newPopup.classList.remove('hidden');
        this.rulePopup.parentNode.replaceChild(newPopup, this.rulePopup);
        this.rulePopup = newPopup;
        
        this.uiLayer.classList.remove('glitch-active');
        void this.uiLayer.offsetWidth; 
        this.uiLayer.classList.add('glitch-active');

        setTimeout(() => { this.rulePopup.classList.add('hidden'); }, 2500);
    }
    
    updateAbilities(dashReadyPct, railReadyPct) {
        this.dashFill.style.width = (dashReadyPct * 100) + '%';
        this.railFill.style.width = (railReadyPct * 100) + '%';

        // Flash pulse when hitting exactly 1.0
        if (dashReadyPct >= 1.0 && !this.dashWasReady) {
            this.dashFill.parentNode.classList.remove('flash-ready');
            void this.dashFill.parentNode.offsetWidth;
            this.dashFill.parentNode.classList.add('flash-ready');
            this.dashWasReady = true;
        } else if (dashReadyPct < 1.0) {
            this.dashWasReady = false;
        }

        if (railReadyPct >= 1.0 && !this.railWasReady) {
            this.railFill.parentNode.classList.remove('flash-ready');
            void this.railFill.parentNode.offsetWidth;
            this.railFill.parentNode.classList.add('flash-ready');
            this.railWasReady = true;
        } else if (railReadyPct < 1.0) {
            this.railWasReady = false;
        }
    }

    updateScore(val) {
        this.scoreVal.innerText = val.toString().padStart(6, '0');
    }
    
    updateCombo(combo, mult) {
        if (combo > 1) {
            this.comboTracker.classList.remove('hidden');
            this.comboVal.innerText = combo;
            this.multiplierVal.innerText = `[${mult.toFixed(1)}x]`;
        } else {
            this.comboTracker.classList.add('hidden');
        }
    }
    
    showHitmarker() {
        this.hitmarker.classList.remove('hidden', 'active');
        void this.hitmarker.offsetWidth; // trigger reflow
        this.hitmarker.classList.remove('hidden');
        this.hitmarker.classList.add('active');
    }

    updateScoreboard(scores) {
        const startList = document.getElementById('score-list-start');
        const endList = document.getElementById('score-list-end');
        const startContainer = document.getElementById('scoreboard-start');
        const endContainer = document.getElementById('scoreboard-end');
        
        if (scores && scores.length > 0) {
            startContainer.classList.remove('hidden');
            endContainer.classList.remove('hidden');
            let html = scores.map((s, i) => `<li><span class="rank">#${i + 1}</span> <span class="score">${s}</span></li>`).join('');
            startList.innerHTML = html;
            endList.innerHTML = html;
        } else {
            startContainer.classList.add('hidden');
            endContainer.classList.add('hidden');
        }
    }
}
