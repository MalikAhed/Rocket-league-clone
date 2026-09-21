import { sampleReplay } from "./goal-replay.js";

// Replay is presentation-only; celebration motion is delegated to live physics.
export class GoalPresentation {
  constructor({ world, camera, buffer, effects, root, playerIndex = 0,
    carStride = 51, carOffset = 22, boostOffset = 18,
    neutralControls = {}, celebration = null, onReplay = () => {}, onStart = () => {}, onFinish = () => {}, onBoost = () => {} }) {
    Object.assign(this, { world, camera, buffer, effects, root, playerIndex,
      carStride, carOffset, boostOffset, neutralControls, celebration, onReplay, onStart, onFinish, onBoost });
    this._active = false;
    this.document = root.ownerDocument;
    this.window = this.document.defaultView;
    this.element = this.document.createElement("section");
    this.element.className = "goal-presentation";
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Goal celebration and replay");
    this.element.innerHTML = `
      <div class="goal-presentation__announcement" role="status" aria-live="polite">
        <span class="goal-presentation__eyebrow">GOAL</span>
        <strong class="goal-presentation__scorer"></strong>
        <span class="goal-presentation__subtitle">WHAT A SHOT!</span>
      </div>
      <div class="goal-presentation__replay" hidden>
        <div class="goal-presentation__replay-top"><strong>REPLAY</strong><span class="goal-presentation__view"></span></div>
        <div class="goal-presentation__replay-bottom"><div><small>GOAL SCORED BY</small><strong class="goal-presentation__replay-scorer"></strong></div><span class="goal-presentation__countdown"></span></div>
        <div class="goal-presentation__timeline"><div class="goal-presentation__progress"></div></div>
      </div>
      <button type="button" class="goal-presentation__skip">SKIP <span>SPACE / ESC</span></button>`;
    this.root.appendChild(this.element);
    this.announcement = this.element.querySelector(".goal-presentation__announcement");
    this.scorer = this.element.querySelector(".goal-presentation__scorer");
    this.replayScorer = this.element.querySelector(".goal-presentation__replay-scorer");
    this.replayUI = this.element.querySelector(".goal-presentation__replay");
    this.viewLabel = this.element.querySelector(".goal-presentation__view");
    this.countdown = this.element.querySelector(".goal-presentation__countdown");
    this.progress = this.element.querySelector(".goal-presentation__progress");
    this.skipButton = this.element.querySelector(".goal-presentation__skip");
    this.skip = () => this.finish();
    this.keydown = (event) => {
      if (event.code === "Space" && !this.replaying) return;
      if (!this.active || event.repeat || !["Escape", "Space"].includes(event.code)) return;
      if (event.target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.finish();
    };
    this.skipButton.addEventListener("click", this.skip);
  }

  get active() { return this._active; }

  begin({ time, state, scorerIndex = this.playerIndex, team = 0, scorerName = "PLAYER", mode }) {
    if (this.active) return false;
    this.clip = this.buffer.clip(time, scorerIndex);
    this.state = Float64Array.from(state);
    this.scorerIndex = scorerIndex;
    this.mode = mode;
    this.elapsed = 0;
    this.replaying = false;
    this.lastCountdown = "";
    this.origin = this.world.ball.position.clone();
    this.savedCamera = {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      fov: this.camera.fov,
    };
    this.savedCars = this.world.cars.map(car => ({
      position:car.position.clone(),quaternion:car.quaternion.clone(),visible:car.visible,
    }));
    this.hiddenObjects = [this.world.indicatorRing, this.world.indicatorHeightRing,
      this.world.ballLocatorArrow?.object, this.world.ballSpeedTrail?.object]
      .filter(Boolean).map((object) => ({ object, visible: object.visible }));
    this.ballVisible = this.world.ball.visible;
    this._active = true;
    this.element.hidden = false;
    this.element.style.setProperty("--goal-team", team === 0 ? "#55baff" : "#ffab47");
    this.announcement.hidden = false;
    this.replayUI.hidden = true;
    this.skipButton.querySelector("span").textContent = "ESC";
    this.scorer.textContent = `${scorerName} SCORED!`;
    this.replayScorer.textContent = scorerName;
    this.viewLabel.textContent = scorerIndex === this.playerIndex ? "RECORDED PLAYER VIEW" : "BOT CHASE VIEW";
    this.root.classList.add("goal-presentation-active");
    this.window.addEventListener("keydown", this.keydown, true);
    this.onStart();
    this.celebration?.begin();
    this.effects?.goal(this.origin, team === 0 ? 0x55baff : 0xffab47);
    this.update(0);
    return true;
  }

  update(delta) {
    if (!this.active) return false;
    if (Number.isFinite(delta) && delta > 0) this.elapsed += delta;
    const world = this.world;
    if (this.elapsed < 2) {
      this.celebration?.update(Number.isFinite(delta) ? Math.max(0,delta) : 0);
      world.ball.visible = false;
      for (const { object } of this.hiddenObjects) object.visible = false;
      return true;
    }
    if (!this.clip || this.clip.duration <= 0 || this.elapsed - 2 >= this.clip.duration) {
      this.finish();
      return false;
    }
    const replayTime = this.elapsed - 2;
    const sample = sampleReplay(this.clip, replayTime);
    if (!sample?.camera) { this.finish(); return false; }
    if (!this.replaying) {
      this.replaying = true;
      this.onReplay();
      this.skipButton.querySelector("span").textContent = "SPACE / ESC";
      this.effects?.clear();
      this.announcement.hidden = true;
      this.replayUI.hidden = false;
      this.root.classList.add("goal-presentation-replaying");
      for (const { object, visible } of this.hiddenObjects) object.visible = visible;
    }
    world.update(sample.previous.state, sample.next.state, sample.alpha, 0, 0,
      this.neutralControls, this.neutralControls, false);
    world.ball.visible = true;
    this.camera.position.fromArray(sample.camera.position);
    this.camera.quaternion.fromArray(sample.camera.quaternion);
    if (this.camera.fov !== sample.camera.fov) {
      this.camera.fov = sample.camera.fov;
      this.camera.updateProjectionMatrix();
    }
    const boost = sample.previous.state[this.carOffset + this.scorerIndex * this.carStride + this.boostOffset];
    this.onBoost(boost);
    this.progress.style.transform = `scaleX(${replayTime / this.clip.duration})`;
    const countdown = `${(this.clip.duration - replayTime).toFixed(1)}s`;
    if (countdown !== this.lastCountdown) {
      this.countdown.textContent = countdown;
      this.lastCountdown = countdown;
    }
    return true;
  }

  finish({ cancel = false } = {}) {
    if (!this.active) return;
    this._active = false;
    this.window.removeEventListener("keydown", this.keydown, true);
    this.effects?.clear();
    this.world.ball.visible = this.ballVisible;
    for (const { object, visible } of this.hiddenObjects) object.visible = visible;
    for (let i = 0; i < this.savedCars.length; i++) {
      const saved = this.savedCars[i], car = this.world.cars[i];
      car.position.copy(saved.position);
      car.quaternion.copy(saved.quaternion);
      car.visible = saved.visible;
    }
    this.camera.position.copy(this.savedCamera.position);
    this.camera.quaternion.copy(this.savedCamera.quaternion);
    this.camera.fov = this.savedCamera.fov;
    this.camera.updateProjectionMatrix();
    this.element.hidden = true;
    this.root.classList.remove("goal-presentation-active", "goal-presentation-replaying");
    this.clip = null;
    this.state = null;
    this.onFinish({ cancel, scorerIndex: this.scorerIndex });
  }

  dispose() {
    this.finish({ cancel: true });
    this.skipButton.removeEventListener("click", this.skip);
    this.element.remove();
  }
}

