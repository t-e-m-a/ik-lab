import { calculate, gradientStep } from './core.mjs';

const $ = (id) => document.getElementById(id);
const initialAngles = [0.4, -0.7, 0.9, -0.5];
const colors = ['#60bdf5', '#51d4ad', '#efb364', '#c59df3', '#f9d76e', '#ff90b5', '#a0ee80', '#75a0f7'];
const cfg = {
  angles: [...initialAngles], target: { x: 2.4, y: 1.3 },
  learningRate: 0.01, iterationsPerFrame: 5,
  running: true, iterations: 0, history: [], randomSeed: 12345,
  dragging: false, lastReason: 'ready',
};
const arm = $('armCanvas');
const graph = $('graphCanvas');
const armCtx = arm.getContext('2d');
const graphCtx = graph.getContext('2d');
let sizeArm = { w: 900, h: 600 };
let sizeGraph = { w: 900, h: 160 };
let jointRowElements = [];
let lastTick = 0;

function createJointRows() {
  $('jointRows').replaceChildren(); jointRowElements = [];
  for (let i = 0; i < cfg.angles.length; i++) {
    const row = document.createElement('div'); row.className = 'joint-row';
    const id = document.createElement('span'); id.className = 'joint-id';
    const dot = document.createElement('i'); dot.style.background = colors[i % colors.length];
    const idLabel = document.createElement('span'); idLabel.textContent = `J${String(i + 1).padStart(2, '0')}`;
    id.append(dot, idLabel);
    const angle = document.createElement('span');
    const grad = document.createElement('span');
    row.append(id, angle, grad); $('jointRows').appendChild(row);
    jointRowElements.push({ angle, grad });
  }
}
function logValueToAlpha(v) {
  // Slider 0..1000 maps to 0.000001..0.5 logarithmically.
  return Math.pow(10, -6 + (Math.log10(0.5) + 6) * Number(v) / 1000);
}
function alphaToLogValue(alpha) {
  return (Math.log10(alpha) + 6) / (Math.log10(0.5) + 6) * 1000;
}
function resetHistory() {
  cfg.iterations = 0;
  cfg.history = [{ iteration: 0, error: calculate(cfg.angles, cfg.target).error }];
}
function resetPose(randomize = false) {
  if (randomize) {
    // Deterministic pseudorandom sequence for repeatable experiments.
    cfg.angles = cfg.angles.map(() => {
      cfg.randomSeed = (Math.imul(cfg.randomSeed, 1664525) + 1013904223) >>> 0;
      return -1.5 + 3 * cfg.randomSeed / 0x100000000;
    });
  } else {
    cfg.angles = cfg.angles.map((_, i) => initialAngles[i % initialAngles.length]);
  }
  resetHistory();
  render();
}
function setCount(n) {
  if (n === cfg.angles.length) return;
  cfg.angles = Array.from({ length: n }, (_, i) => initialAngles[i % initialAngles.length]);
  createJointRows(); resetHistory(); render();
}
function stepOnce() {
  const step = gradientStep(cfg.angles, cfg.target, cfg.learningRate);
  cfg.lastReason = step.reason;
  if (!step.updated) return;
  cfg.angles = step.angles;
  cfg.iterations++;
  cfg.history.push({ iteration: cfg.iterations, error: step.after.error });
  if (cfg.history.length > 10000) cfg.history.shift();
}
function playPause() { cfg.running = !cfg.running; updateRunStatus(); }
function updateRunStatus() {
  $('playLabel').textContent = cfg.running ? '일시정지' : '재생';
  $('playSymbol').textContent = cfg.running ? 'Ⅱ' : '▶';
  $('topStatus').textContent = cfg.running ? '시뮬레이션 실행 중' : '시뮬레이션 일시정지';
  document.querySelector('.status-dot').classList.toggle('stopped', !cfg.running);
}
function drawText(ctx, text, x, y, color = '#9ab0ca', font = '12px system-ui') {
  ctx.font = document.documentElement.classList.contains('font-ready') ? font.replaceAll('system-ui', 'TemaRound') : font; ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function resizeCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return { w: 0, h: 0 };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pxW = Math.round(rect.width * dpr);
  const pxH = Math.round(rect.height * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW; canvas.height = pxH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: rect.width, h: rect.height };
}
function worldTransform() {
  const { w, h } = sizeArm;
  const s = Math.min((w - 65) / (2 * cfg.angles.length + 1), (h - 65) / (2 * cfg.angles.length + 1));
  const origin = { x: w / 2, y: h / 2 };
  return { s, origin,
    toScreen(p) { return { x: origin.x + p.x * s, y: origin.y - p.y * s }; },
    toWorld(p) { return { x: (p.x - origin.x) / s, y: (origin.y - p.y) / s }; }
  };
}
function drawArm(state) {
  const ctx = armCtx; const { w, h } = sizeArm; if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);
  const tr = worldTransform(), { s, origin } = tr;
  // Light dotted grid; each grid step corresponds to 1 unit.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(126,161,199,.10)';
  ctx.beginPath();
  for (let i = -Math.ceil(w / (2 * s)); i <= Math.ceil(w / (2 * s)); i++) {
    const x = origin.x + i * s; ctx.moveTo(x, 0); ctx.lineTo(x, h);
  }
  for (let i = -Math.ceil(h / (2 * s)); i <= Math.ceil(h / (2 * s)); i++) {
    const y = origin.y + i * s; ctx.moveTo(0, y); ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(141,176,206,.25)'; ctx.beginPath();
  ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, h);
  ctx.moveTo(0, origin.y); ctx.lineTo(w, origin.y); ctx.stroke();
  ctx.save(); ctx.setLineDash([4, 8]); ctx.lineWidth = 1.1;
  ctx.strokeStyle = 'rgba(100,200,199,.12)'; ctx.beginPath();
  ctx.arc(origin.x, origin.y, s * cfg.angles.length, 0, Math.PI * 2); ctx.stroke();ctx.restore();
  drawText(ctx, '0', origin.x + 7, origin.y + 15, '#708ba6', '11px system-ui');
  drawText(ctx, 'X', w - 18, origin.y - 7, '#7b94ae', '11px system-ui');
  drawText(ctx, 'Y', origin.x + 9, 20, '#7b94ae', '11px system-ui');

  const endpoint = tr.toScreen(state.points[state.points.length - 1]);
  const target = tr.toScreen(cfg.target);
  ctx.save(); ctx.setLineDash([5, 5]);ctx.lineWidth = 1.6;ctx.strokeStyle='rgba(255,118,137,.73)';ctx.beginPath();ctx.moveTo(endpoint.x,endpoint.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.restore();
  state.points.slice(1).forEach((p, i) => {
    const a = tr.toScreen(state.points[i]), b = tr.toScreen(p);
    ctx.strokeStyle = '#071322'; ctx.lineWidth = Math.max(10, Math.min(17, s * .26)); ctx.lineCap = 'round';
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = Math.max(5, Math.min(9, s * .14));
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.fillStyle = '#102032';ctx.strokeStyle='#e2effe';ctx.lineWidth=2;ctx.beginPath();ctx.arc(a.x,a.y,5.8,0,Math.PI*2);ctx.fill();ctx.stroke();
  });
  ctx.fillStyle='#f6fbff';ctx.beginPath();ctx.arc(endpoint.x,endpoint.y,6.5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#f4c46f';ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(endpoint.x,endpoint.y,11.5,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#fb7d91';ctx.lineWidth=2;ctx.beginPath();ctx.arc(target.x,target.y,12,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(target.x-18,target.y);ctx.lineTo(target.x+18,target.y);ctx.moveTo(target.x,target.y-18);ctx.lineTo(target.x,target.y+18);ctx.stroke();
  const labelX = target.x > w - 155 ? target.x - 135 : target.x + 17;
  const labelY = target.y < 31 ? target.y + 31 : target.y - 18;
  drawText(ctx, `(${cfg.target.x.toFixed(2)}, ${cfg.target.y.toFixed(2)})`, labelX, labelY, '#ff9dac', '600 12px system-ui');
  const reach = Math.hypot(cfg.target.x,cfg.target.y) > cfg.angles.length + 1e-6;
  if (reach) drawText(ctx,'목표가 최대 도달 범위 밖에 있습니다.', 20, 24, '#f3b37b', '12px system-ui');
}
function drawGraph() {
  const ctx = graphCtx; const { w, h } = sizeGraph; if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);
  const plot={x:54, y:10, w:w-69, h:h-31};
  if (plot.w < 10 || plot.h < 10) return;
  const points=cfg.history.slice(-250);
  const values=points.map(p=>Math.log10(Math.max(p.error,1e-12)));
  let lo=Math.min(...values,0),hi=Math.max(...values,0);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {lo=-1;hi=1;}
  if (hi-lo < 0.5) {const mid=(lo+hi)/2;lo=mid-.25;hi=mid+.25;}
  const minI=points.length ? points[0].iteration : 0;
  const maxI=points.length ? points.at(-1).iteration : 1;
  const spanI=Math.max(1,maxI-minI);
  const atX=p=>plot.x+(p.iteration-minI)/spanI*plot.w;
  const atY=y=>plot.y+(hi-y)/(hi-lo)*plot.h;
  ctx.strokeStyle='#283b52';ctx.lineWidth=1;ctx.fillStyle='#728fa8';ctx.font='10px system-ui';
  for(let i=0;i<=4;i++){
    const v=lo+(hi-lo)*i/4, y=atY(v);
    ctx.beginPath();ctx.moveTo(plot.x,y);ctx.lineTo(plot.x+plot.w,y);ctx.stroke();
    ctx.textAlign='right';ctx.fillText(v.toFixed(1),plot.x-9,y+3);
  }
  ctx.textAlign='left';
  if(points.length < 2)return;
  ctx.beginPath();points.forEach((p,i)=>{const x=atX(p),y=atY(values[i]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
  ctx.lineWidth=2;ctx.strokeStyle='#51d5cd';ctx.stroke();
  const lastX=atX(points.at(-1)),lastY=atY(values.at(-1));
  ctx.fillStyle='#67eae0';ctx.beginPath();ctx.arc(lastX,lastY,3.7,0,Math.PI*2);ctx.fill();
}
function render() {
  const state=calculate(cfg.angles,cfg.target);
  $('distanceValue').textContent = state.distance.toFixed(6);
  $('errorValue').textContent = state.error.toFixed(6);
  $('iterationValue').textContent = cfg.iterations.toLocaleString('ko-KR');
  $('targetCoords').textContent = `TARGET X ${cfg.target.x.toFixed(2)} · Y ${cfg.target.y.toFixed(2)}`;
  $('canvasJointCount').textContent=String(cfg.angles.length).padStart(2,'0');
  state.gradients.forEach((g,i)=>{
    jointRowElements[i].angle.textContent = (cfg.angles[i]*180/Math.PI).toFixed(1)+'°';
    jointRowElements[i].grad.textContent = g.toFixed(4);
  });
  $('jointCountValue').textContent=cfg.angles.length;
  $('learningValue').textContent=cfg.learningRate.toFixed(6);
  $('speedValue').textContent=cfg.iterationsPerFrame;
  let msg='미분값에 따라 모든 관절을 동시에 갱신합니다.';
  if(state.error<1e-10)msg='목표점에 도달했습니다 (허용 오차 기준).';
  else if(state.gradients.reduce((s,g)=>s+g*g,0)<1e-16)msg='미분값이 0에 가까워 현재 자세에서 정지했습니다.';
  else if(cfg.history.length>1&&cfg.history.at(-1).error>cfg.history.at(-2).error)msg='학습률이 커서 이번 단계에서는 오차가 증가했습니다.';
  $('runNote').textContent=msg;
  drawArm(state);drawGraph();
}
function renderFrame(now) {
  // Limit to ~60 redraws per second even on high refresh monitors.
  if(now-lastTick >= 16) {
    lastTick=now;
    if(cfg.running) for(let i=0;i<cfg.iterationsPerFrame;i++)stepOnce();
    render();
  }
  requestAnimationFrame(renderFrame);
}
function pointerToWorld(e) {
  const rect=arm.getBoundingClientRect();
  const p={x:e.clientX-rect.left,y:e.clientY-rect.top};
  return worldTransform().toWorld(p);
}
function setTarget(e) {
  const next=pointerToWorld(e);
  // The C++ application restarts an experiment when the target is dragged.
  if (Math.hypot(next.x-cfg.target.x,next.y-cfg.target.y)<1e-6) return;
  cfg.target=next;resetHistory();render();
}
arm.addEventListener('pointerdown',e=>{
  if(e.button!==0 && e.pointerType==='mouse')return;
  cfg.dragging=true;arm.setPointerCapture(e.pointerId);setTarget(e);
});
arm.addEventListener('pointermove',e=>{if(cfg.dragging)setTarget(e)});
arm.addEventListener('pointerup',()=>cfg.dragging=false);
arm.addEventListener('pointercancel',()=>cfg.dragging=false);
$('playBtn').addEventListener('click',playPause);
$('stepBtn').addEventListener('click',()=>{cfg.running=false;updateRunStatus();stepOnce();render();});
$('resetBtn').addEventListener('click',()=>resetPose(false));
$('randomBtn').addEventListener('click',()=>resetPose(true));
$('jointCount').addEventListener('input',e=>setCount(Number(e.target.value)));
$('learningSlider').addEventListener('input',e=>{cfg.learningRate=logValueToAlpha(e.target.value);render();});
$('speedSlider').addEventListener('input',e=>{cfg.iterationsPerFrame=Number(e.target.value);render();});
$('clearGraphBtn').addEventListener('click',()=>{cfg.history=[{iteration:cfg.iterations,error:calculate(cfg.angles,cfg.target).error}];render();});
$('exportBtn').addEventListener('click',()=>{
  const rows=['iteration,squared_error,distance'];
  for(const row of cfg.history)rows.push(`${row.iteration},${row.error},${Math.sqrt(row.error)}`);
  const blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download='tema-ik-error-history.csv';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  let handled=true;
  switch(e.code){
    case 'Space':playPause();break;
    case 'KeyS':cfg.running=false;updateRunStatus();stepOnce();break;
    case 'KeyR':resetPose();break;
    case 'KeyN':resetPose(true);break;
    case 'KeyC':cfg.history=[{iteration:cfg.iterations,error:calculate(cfg.angles,cfg.target).error}];break;
    case 'BracketRight':setCount(Math.min(12,cfg.angles.length+1));$('jointCount').value=cfg.angles.length;break;
    case 'BracketLeft':setCount(Math.max(2,cfg.angles.length-1));$('jointCount').value=cfg.angles.length;break;
    case 'Equal':case 'NumpadAdd':cfg.learningRate=Math.min(cfg.learningRate*1.25,0.5);$('learningSlider').value=alphaToLogValue(cfg.learningRate);break;
    case 'Minus':case 'NumpadSubtract':cfg.learningRate=Math.max(cfg.learningRate/1.25,0.000001);$('learningSlider').value=alphaToLogValue(cfg.learningRate);break;
    case 'ArrowUp':cfg.iterationsPerFrame=Math.min(cfg.iterationsPerFrame+1,50);$('speedSlider').value=cfg.iterationsPerFrame;break;
    case 'ArrowDown':cfg.iterationsPerFrame=Math.max(cfg.iterationsPerFrame-1,1);$('speedSlider').value=cfg.iterationsPerFrame;break;
    default:handled=false;
  }
  if(handled){e.preventDefault();render()}
});
async function loadLocalFontIfPresent(){
  const url='./resources/CRoundBold_tema_Num.ttf';
  try {
    const res=await fetch(url,{method:'HEAD'});
    if(!res.ok)return;
    const face=new FontFace('TemaRound',`url("${url}")`,{weight:'400'});
    await face.load();document.fonts.add(face);document.documentElement.classList.add('font-ready');
  }catch(_){/* Optional user-owned local font; never required for the site to work. */}
}
function resize(){sizeArm=resizeCanvas(arm,armCtx);sizeGraph=resizeCanvas(graph,graphCtx);render();}
window.addEventListener('resize',resize);
if(window.ResizeObserver){new ResizeObserver(resize).observe($('canvasWrap'));new ResizeObserver(resize).observe(graph.parentElement);}
$('learningSlider').value=alphaToLogValue(cfg.learningRate);
createJointRows();resetHistory();updateRunStatus();resize();loadLocalFontIfPresent();requestAnimationFrame(renderFrame);
