import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const COUNTRIES = JSON.parse(fs.readFileSync("./countries.json", "utf8"));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const W = 1800, H = 1000;
const CENTER = {x: W/2, y: H/2};
const R0 = 430;
const DT = 1/30;

let round = 1;
let running = true;
let winner = null;
let event = "🌍 250 FLAGS — BATTLE ROYALE";
let elapsed = 0;
let nextEvent = 8;
let particles = [];
let gateAngle = -Math.PI / 2;
const GATE_WIDTH = Math.PI / 3.4; // ~53° opening
const GATE_ROTATION_SPEED = 0.42; // fast enough to circulate during a 30s battle

let lastElimination = null;

const colors = [
  "#64d8ff","#ff6b7a","#ffd166","#8be28b","#b98cff","#ff9f43",
  "#4dd0b3","#ff82d0","#b4d455","#6c9cff"
];

function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
let rand = mulberry32(2502026);

function centralSpawn(i, seedOffset=0){
  // Independent starting positions across the interior of the arena.
  // They do NOT spawn as one combined cluster.
  const a=rand()*Math.PI*2;
  const rr=Math.sqrt(rand())*320;
  const speed=190; // Fast, constant movement speed
  const va=rand()*Math.PI*2;
  return {
    x:CENTER.x+Math.cos(a)*rr,
    y:CENTER.y+Math.sin(a)*rr,
    vx:Math.cos(va)*speed,
    vy:Math.sin(va)*speed
  };
}

const teams = COUNTRIES.map((c,i)=>{
  const pos=centralSpawn(i);
  return {
    ...c,
    id:c.code.toLowerCase(),
    x:pos.x,
    y:pos.y,
    vx:pos.vx,
    vy:pos.vy,
    radius:13.5,
    hp:100,
    energy:100,
    votes:0,
    alive:true,
    shield:0,
    boost:0,
    mass:1
  };
});

function reset(){
  round++;
  running=true; winner=null; elapsed=0; nextEvent=8; particles=[]; lastElimination=null;
  gateAngle = -Math.PI / 2;
  event=`🌍 ROUND ${round} — ALL 250 FLAGS ENTER THE ARENA`;
  rand=mulberry32(2502026+round*9973);
  teams.forEach((t,i)=>{
    const pos=centralSpawn(i,round);
    t.x=pos.x;
    t.y=pos.y;
    t.vx=pos.vx;
    t.vy=pos.vy;
    t.hp=100;t.energy=100;t.votes=0;t.alive=true;t.shield=0;t.boost=0;
  });
}

function command(text){
  if(typeof text!=="string")return;
  const q=text.trim().toLowerCase();
  let t=teams.find(x=>q===x.id || q===x.code.toLowerCase() || q===x.name.toLowerCase() || q.includes(x.flag));
  if(!t || !t.alive)return;
  t.votes++;
  t.energy=Math.min(100,t.energy+20);
  t.boost=Math.min(3,t.boost+.9);
  t.shield=Math.min(5,t.shield+2);
  event=`⚡ LIVE SUPPORT → ${t.flag} ${t.name}`;
  for(let i=0;i<12;i++) particles.push({x:t.x,y:t.y,vx:(rand()-.5)*180,vy:(rand()-.5)*180,life:.65,max:.65});
}

function spatialGrid(alive){
  const cell=32, map=new Map();
  for(const t of alive){
    const gx=Math.floor(t.x/cell), gy=Math.floor(t.y/cell);
    for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
      const key=`${gx+ox},${gy+oy}`;
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(t);
    }
  }
  return {map,cell};
}

function addImpact(x,y,strong=false){
  for(let i=0;i<(strong?9:3);i++){
    particles.push({x,y,vx:(rand()-.5)*220,vy:(rand()-.5)*220,life:.35+rand()*.35,max:.7});
  }
}

function physics(){
  if(!running || winner)return;
  elapsed+=DT;
  gateAngle = (gateAngle + GATE_ROTATION_SPEED * DT) % (Math.PI * 2);

  const alive=teams.filter(t=>t.alive);
  const storm=Math.min(1, Math.max(0,(elapsed-12)/95));
  const arena=R0; // Fixed-size arena: never shrinks during the battle.

  // World events.
  if(elapsed>nextEvent){
    nextEvent+=10+rand()*8;
    const choices=[
      "🌪️ WIND SURGE — momentum increased",
      "⚡ ENERGY STORM — arena pressure rising",
      "🌀 CHAOS WAVE — collisions intensified"
    ];
    event=choices[Math.floor(rand()*choices.length)];
  }

  // Integrate movement.
  for(const t of alive){
    const dx=t.x-CENTER.x,dy=t.y-CENTER.y,d=Math.hypot(dx,dy)||1;
    // Each flag is an independent moving object.
    // No central attraction and no orbital/perimeter force.
    const maxSpeed=180+(t.boost>0?40:0);
    const sp=Math.hypot(t.vx,t.vy)||1;
    // Keep every flag at the same movement speed for the whole battle.
    t.vx=t.vx/sp*maxSpeed;
    t.vy=t.vy/sp*maxSpeed;

    t.x+=t.vx*DT;t.y+=t.vy*DT;
    t.energy=Math.max(0,t.energy-DT*(1.2+storm));
    t.boost=Math.max(0,t.boost-DT);
    t.shield=Math.max(0,t.shield-DT);

    // Recalculate after movement so the boundary test uses the actual
    // current position.
    const ndx=t.x-CENTER.x, ndy=t.y-CENTER.y;
    const nd=Math.hypot(ndx,ndy)||1;
    const nx=ndx/nd, ny=ndy/nd;

    // CIRCLE PHYSICS:
    // A flag touching the solid circle wall bounces inward.
    // The rotating gap is the ONLY place where it can leave.
    // We do NOT eliminate flags because of HP or collisions.
    const flagRadius = t.radius;
    const touchRadius = arena - flagRadius;

    if(nd >= touchRadius){
      const angle=Math.atan2(ndy,ndx);
      const delta=Math.atan2(
        Math.sin(angle-gateAngle),
        Math.cos(angle-gateAngle)
      );
      const inGate=Math.abs(delta) < GATE_WIDTH/2;

      if(inGate){
        // The opening is empty: allow the flag to continue outward.
        // It becomes eliminated only once it is visibly outside the circle.
        if(nd > arena + flagRadius*0.55){
          t.alive=false;
          t.hp=0;
          t.x=CENTER.x+nx*(arena+flagRadius+12);
          t.y=CENTER.y+ny*(arena+flagRadius+12);
          t.vx*=0.20;
          t.vy*=0.20;
          lastElimination=t.id;
          event=`💥 OUTSIDE → ${t.flag} ${t.name} ELIMINATED`;
          addImpact(t.x,t.y,true);
        }
      } else {
        // Solid wall: put the flag just inside the circle and reflect
        // the outward component of its velocity.
        t.x=CENTER.x+nx*(arena-flagRadius-0.5);
        t.y=CENTER.y+ny*(arena-flagRadius-0.5);

        const outward=t.vx*nx+t.vy*ny;
        if(outward>0){
          // Strong, ball-like bounce.
          t.vx-=nx*outward*1.90;
          t.vy-=ny*outward*1.90;
        }
      }
    }
  }

  // PHYSICAL FLAG-TO-FLAG COLLISIONS.
  // They bounce apart; touching another flag never eliminates either one.
  for(let i=0;i<alive.length;i++){
    const a=alive[i];
    if(!a.alive) continue;
    for(let j=i+1;j<alive.length;j++){
      const b=alive[j];
      if(!b.alive) continue;

      const dx=b.x-a.x, dy=b.y-a.y;
      const dist=Math.hypot(dx,dy)||0.001;
      const minDist=a.radius+b.radius;

      if(dist<minDist){
        const nx=dx/dist, ny=dy/dist;
        const overlap=minDist-dist;

        // Separate the flags so their images remain distinct.
        a.x-=nx*overlap*0.51;
        a.y-=ny*overlap*0.51;
        b.x+=nx*overlap*0.51;
        b.y+=ny*overlap*0.51;

        // Equal-mass elastic collision along the collision normal.
        const rvx=b.vx-a.vx, rvy=b.vy-a.vy;
        const normalVelocity=rvx*nx+rvy*ny;

        if(normalVelocity<0){
          const impulse=-normalVelocity;
          a.vx-=nx*impulse;
          a.vy-=ny*impulse;
          b.vx+=nx*impulse;
          b.vy+=ny*impulse;
        }
      }
    }
  }
  // LAST FLAG INSIDE THE CIRCLE WINS.
  // There is no HP victory condition: survival inside the arena is the
  // only condition for becoming champion.
  const survivors=teams.filter(t=>t.alive);
  if(survivors.length===1){
    winner=survivors[0].id;
    running=false;
    event=`🏆 30-SECOND WINNER → ${survivors[0].flag} ${survivors[0].name} WINS`;
  }

  particles=particles.filter(p=>(p.life-=DT)>0);
  for(const p of particles){p.x+=p.vx*DT;p.y+=p.vy*DT;p.vx*=.94;p.vy*=.94;}
}

function snapshot(){
  const survivors=teams.filter(t=>t.alive);
  return {
    width:W,height:H,round,running,winner,event,elapsed,
    arenaRadius:R0,
    gateAngle,
    gateWidth:GATE_WIDTH,
    survivors:survivors.length,
    teams:teams.map(t=>({...t})),
    particles
  };
}

setInterval(()=>{physics();io.emit("state",snapshot())},1000/30);

io.on("connection",socket=>{
  socket.emit("state",snapshot());
  socket.on("command",p=>command(p?.text));
  socket.on("admin:reset",reset);
});

app.get("/api/state",(_,res)=>res.json(snapshot()));
app.get("/api/countries",(_,res)=>res.json(COUNTRIES));
server.listen(process.env.PORT||3000,()=>console.log("World Flags Battle: http://localhost:3000"));
