import {MatchSession} from './soccer/match/session.js';
import {BotController} from './soccer/bots/controller.js';
const neutral = {throttle:0,steer:0,pitch:0,yaw:0,roll:0,jump:false,boost:false,handbrake:false};

// Owns the 120 Hz match lifecycle. Rendering and policy latency never advance its clock.
export class MatchDriver {
  constructor(sim,pads,callbacks = {},makeBot = id => new BotController(id)) {
    this.sim=sim; this.pads=pads; this.callbacks=callbacks; this.makeBot=makeBot;
    this.session=new MatchSession(); this.mode='freeplay'; this.bot=null;
    this.paused=false; this.goalTicks=0; this.epoch=0; this.request=0; this.botWait=0; this.elapsed=0;
  }
  async start(mode,id='nexto') {
    if (!['freeplay','offline'].includes(mode) || !['nexto','necto','seer'].includes(id)) throw Error('Unknown game selection');
    let candidate=null;
    if (mode==='offline') {
      candidate=this.makeBot(id);
      try { await candidate.load(); } catch(error) { candidate.dispose(); throw error; }
    }
    this.bot?.dispose(); this.bot=candidate; this.mode=mode; this.paused=false;
    this.sim.configureCars('fennec',false,0);
    if (mode==='offline' && this.sim.addCar(1,'default')!==1) throw Error('Opponent creation failed');
    this.sim.setUnlimitedBoost(mode==='freeplay'); this.sim.setGoalExplosionEnabled(false);
    if (mode==='offline') this.session.start(); else this.session.leave();
    if(candidate) candidate.onError=message => { this.paused=true; this.callbacks.onError?.(message); };
    this.resetKickoff();
  }
  resetKickoff() {
    this.epoch++; this.request=0; this.botWait=0; this.elapsed=0; this.goalTicks=0;
    this.bot?.reset(); this.sim.resetKickoff(4); this.sim.resetView();
    this.sim.setControls(0,neutral); if(this.mode==='offline')this.sim.setControls(1,neutral);
    this.callbacks.onKickoff?.();
  }
  setPaused(value) { this.paused=value; this.session.state.paused=value; }
  leave() { this.epoch++; this.bot?.dispose(); this.bot=null; this.session.leave(); this.paused=true; this.goalTicks=0; }
  botControls() {
    const bot=this.bot;
    if(!bot || this.goalTicks) return neutral;
    const script=bot.getKickoffControls(this.sim.state,this.elapsed);
    if(script) { bot.overrideControls(script); return script; }
    if(!this.request && this.botWait<=0) {
      const epoch=this.epoch; this.request=epoch;
      bot.decide(this.sim.state,this.pads,1,1).then(()=>{
        if(this.epoch===epoch){ this.request=0; this.botWait=bot.option.tickSkip; }
      }).catch(error=>{
        if(this.epoch===epoch){ this.request=0; this.paused=true; this.callbacks.onError?.(error.message); }
      });
    }
    if(this.botWait>0)this.botWait--;
    return bot.controls;
  }
  tick() {
    if(this.paused)return false;
    const s=this.session.state;
    if(this.mode==='offline' && s.phase==='kickoff') { this.session.tick(); return true; }
    if(this.mode==='offline' && s.phase==='ended')return false;
    if(this.mode==='freeplay' && this.goalTicks && --this.goalTicks===0) { this.resetKickoff(); return false; }
    if(this.mode==='offline')this.sim.setControls(1,this.botControls());
    this.sim.step(1); this.elapsed++;
    const goal=this.sim.pollGoal();
    const scored=(goal===1||goal===2)&&!this.goalTicks;
    let event='none';
    if(this.mode==='offline') {
      const ball=this.sim.state;
      // The native contact flag can clear when a resting ball goes to sleep.
      // A stationary ball within the floor contact margin still ends regulation.
      const restingOnFloor=ball[6]>=0 && ball[6]<=(this.sim.ballRadius??91.25)+2 && Math.abs(ball[18])<1;
      event=this.session.tick({goal:scored?goal:0,ballOnGround:this.sim.ballOnGround||restingOnFloor,kickoffTouched:Math.hypot(ball[16],ball[17],ball[18])>1 || Math.hypot(ball[4],ball[5])>10});
    }
    if(scored) {
      this.goalTicks=7*120;
      if(this.mode==='offline')this.session.phaseTicks=this.goalTicks;
      // RocketSim events are 1 (blue scored) and 2 (orange scored), not signed goals.
      this.callbacks.onGoal?.(goal===1?1:-1,goal);
    }
    if(event==='kickoff'){ this.resetKickoff(); return false; }
    if(event==='ended'){ this.setPaused(true); this.callbacks.onEnd?.({...s}); return false; }
    return true;
  }
}
