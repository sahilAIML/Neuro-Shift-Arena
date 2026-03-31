export class ScoreManager {
    constructor(uiManager) {
        this.ui = uiManager;

        this.score = 0;
        this.combo = 0;
        this.multiplier = 1.0;

        this.comboTimer = 0;
        this.comboMaxTime = 4.0; // 4 seconds to keep combo alive
    }

    addHit() {
        this.combo++;
        this.comboTimer = this.comboMaxTime;

        // Multiplier caps at 5x
        this.multiplier = Math.min(5.0, 1.0 + (this.combo * 0.1));

        this.addScore(10);
        this.ui.updateCombo(this.combo, this.multiplier);
        this.ui.showHitmarker();
    }

    addKill() {
        this.addScore(100);
    }

    addScore(basePoints) {
        const points = Math.floor(basePoints * this.multiplier);
        this.score += points;
        this.ui.updateScore(this.score);
    }

    saveTopScore() {
        let topScores = this.getTopScores();
        topScores.push(this.score);
        topScores = [...new Set(topScores)]; // Rank wise unique scores
        topScores.sort((a, b) => b - a);
        topScores = topScores.slice(0, 10);
        localStorage.setItem('neuroshift_top_scores', JSON.stringify(topScores));
    }

    getTopScores() {
        return JSON.parse(localStorage.getItem('neuroshift_top_scores') || '[]');
    }

    update(dt) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                // Combo broken
                this.combo = 0;
                this.multiplier = 1.0;
                this.ui.updateCombo(this.combo, this.multiplier);
            }
        }
    }
}
