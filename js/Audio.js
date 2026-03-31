/**
 * Procedural Cyberpunk Synthesizer and Audio Engine
 */
export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);
        
        // Music Sequencer State
        this.isPlayingMusic = false;
        this.tempo = 120; // BPM
        this.schedulerTimer = null;
        this.nextNoteTime = 0.0;
        this.currentStep = 0;
        
        // Minimalist sequencer pattern (16 steps)
        // 1: Kick, 2: Snare, 3: Hat, 4: Bass note
        this.pattern = [
            { kick: 1, bass: 40 }, { hat: 1, bass: 0 }, { bass: 40 }, { hat: 1, bass: 0 },
            { snare: 1, bass: 43 }, { hat: 1, bass: 0 }, { kick: 1, bass: 40 }, { hat: 1, bass: 43 },
            { kick: 1, bass: 38 }, { hat: 1, bass: 0 }, { bass: 38 }, { hat: 1, bass: 0 },
            { snare: 1, bass: 43 }, { hat: 1, bass: 0 }, { bass: 40 }, { hat: 1, bass: 36 }
        ];
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.startMusic();
    }

    // --- SEQUENCER ---
    
    setTempoModifier(mult) {
        this.tempo = 120 * mult;
    }

    startMusic() {
        if(this.isPlayingMusic) return;
        this.isPlayingMusic = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.scheduleNotes();
    }

    scheduleNotes() {
        const secondsPerBeat = 60.0 / this.tempo;
        const stepDuration = secondsPerBeat * 0.25; // 16th notes
        
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playStep(this.currentStep, this.nextNoteTime);
            this.nextNoteTime += stepDuration;
            this.currentStep = (this.currentStep + 1) % 16;
        }
        
        this.schedulerTimer = setTimeout(() => this.scheduleNotes(), 25);
    }

    playStep(step, time) {
        const note = this.pattern[step];
        const gain = 0.3; // Music volume
        
        if (note.kick) this.synthKick(time, gain);
        if (note.snare) this.synthSnare(time, gain * 0.8);
        if (note.hat) this.synthHat(time, gain * 0.5);
        if (note.bass > 0) this.synthBass(note.bass, time, gain * 0.9);
    }

    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    synthKick(time, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        
        // Pitch drop
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        // Amp decay
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.5);
    }

    synthSnare(time, vol) {
        // Noise burst
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(time);
    }

    synthHat(time, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.05);
    }

    synthBass(midi, time, vol) {
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        osc2.type = 'square';
        
        const freq = this.midiToFreq(midi);
        osc.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(freq / 2, time); // Sub octave
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 4, time);
        filter.frequency.exponentialRampToValueAtTime(freq, time + 0.2);
        
        gain.gain.setValueAtTime(vol, time);
        gain.gain.setTargetAtTime(0.01, time + 0.1, 0.1);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time); osc2.start(time);
        osc.stop(time + 0.3); osc2.stop(time + 0.3);
    }

    // --- SFX ---

    playShoot() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.15);
    }
    
    playRailgun() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.8);
    }

    playJump() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(400, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.2);
    }

    playDash() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.3);
    }

    playHit(isPlayer = false) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isPlayer ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(isPlayer ? 100 : 800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(isPlayer ? 50 : 200, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.2);
    }

    playRuleShift() {
        const osc1 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(55, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);

        osc1.connect(gain);
        gain.connect(this.masterGain);
        osc1.start(); osc1.stop(this.ctx.currentTime + 1.0);
    }
}
