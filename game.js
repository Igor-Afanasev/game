'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const overlay=document.querySelector('#overlay'),title=document.querySelector('#title'),message=document.querySelector('#message');
const W=960,H=540,keys={left:false,right:false,up:false,down:false};
const npcs=[{name:'Игорь · специалист ОИ',x:245,y:230,color:'#e9a365'},{name:'Иван · специалист ОИ',x:720,y:355,color:'#8eafe5'},{name:'Николай · специалист',x:500,y:130,color:'#d993b8'}];
const initialItems=[{kind:'burger',x:100,y:330},{kind:'burger',x:160,y:440},{kind:'burger',x:360,y:400},{kind:'pie',x:790,y:110},{kind:'pie',x:870,y:195},{kind:'pie',x:700,y:170}];
const exit={x:890,y:460};
let guard,attackCooldown=0,attackFlash=0,invincible=0,escaped=false;
const obstacles=[{x:175,y:140,w:120,h:65},{x:660,y:255,w:120,h:65},{x:390,y:145,w:110,h:60}];
let player,items,phase,state='intro',last=0,time=0,notice='',noticeTime=0;
const tasks=['Доберитесь до покрышки внизу справа, собрав как можно больше еды','Доберитесь до покрышки внизу справа, собрав как можно больше еды'];
function reset(){player={x:320,y:280,w:22,h:24,burger:0,pie:0,hp:5};items=initialItems.map(i=>({...i,taken:false}));guard={x:820,y:390,hp:4,alert:false,seen:false,path:[],repath:0,patrol:0};attackCooldown=0;attackFlash=0;invincible=0;escaped=false;phase=1;time=0;notice='';Object.keys(keys).forEach(k=>keys[k]=false);hud();}
function hud(){const food=player.burger+player.pie;document.querySelector('#coins').textContent=`Бургеры ${player.burger}/3 · Пирожки ${player.pie}/3`;document.querySelector('#lives').textContent=`♥ ${player.hp}/5 · Еда ${food}/6`;document.querySelector('#quest').textContent=state==='won'?`Финиш! Собрано еды: ${food}/6`:food===6?'Вся еда собрана! Доберитесь до автомобильной покрышки.':tasks[1];}
function panel(heading,body,button){title.textContent=heading;message.textContent=body;document.querySelector('#play').textContent=button;overlay.hidden=false;}
function start(){reset();state='playing';overlay.hidden=true;hud();}
function tell(heading,body){state='dialog';Object.keys(keys).forEach(k=>keys[k]=false);panel(heading,body,'Продолжить →');}
function toast(text){notice=text;noticeTime=3;}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function nearby(){return npcs.filter(o=>distance(player,o)<66).sort((a,b)=>distance(player,a)-distance(player,b))[0];}
function interact(){if(state!=='playing')return;const o=nearby();if(!o){toast('Финиш — автомобильная покрышка внизу справа');return;}
 if(o===npcs[0])tell(o.name,'Цель — добраться до автомобильной покрышки внизу справа с максимальным количеством еды. На карте три бургера и три пирожка. Можно финишировать с любым запасом, но лучший результат — 6 из 6!');
 else if(o===npcs[1])tell(o.name,'Мост открыт с самого начала. Бургеры лежат слева от реки, пирожки — справа. Еда восстанавливает здоровье и учитывается в результате, даже если ты получил урон.');
 else tell(o.name,'Тезка охраняет путь к покрышке. F — удар, или просто убегай: ты быстрее него. Все шесть порций еды дадут максимальный результат. Разговоры необязательны — можешь сразу идти к финишу.');}
function attack(){if(state!=='playing'||attackCooldown>0)return;attackCooldown=.45;attackFlash=.16;
 if(guard.hp>0&&distance(player,guard)<65){guard.hp--;guard.alert=true;guard.seen=true;const dx=guard.x-player.x,dy=guard.y-player.y,len=Math.hypot(dx,dy)||1;const x=guard.x+dx/len*25,y=guard.y+dy/len*25;if(!blocked(x,y)){guard.x=x;guard.y=y;}toast(guard.hp>0?'Попадание! Тезка: '+guard.hp+'/4':'Тезка побеждён!');}}
// Breadth-first navigation keeps the guard on walkable ground, including the bridge.
function route(target){const cell=20,cols=48,rows=27;const start=[Math.round(guard.x/cell),Math.round(guard.y/cell)],goal=[Math.round(target.x/cell),Math.round(target.y/cell)];const id=(x,y)=>y*cols+x;const queue=[start],parents=new Map([[id(...start),null]]);let found=null;
 for(let n=0;n<queue.length;n++){const [x,y]=queue[n];if(Math.abs(x-goal[0])+Math.abs(y-goal[1])<=1){found=id(x,y);break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,key=id(nx,ny);if(nx<0||nx>=cols||ny<0||ny>=rows||parents.has(key)||blocked(nx*cell,ny*cell))continue;parents.set(key,id(x,y));queue.push([nx,ny]);}}
 const path=[];while(found!==null&&parents.get(found)!==null){path.unshift({x:(found%cols)*cell,y:Math.floor(found/cols)*cell});found=parents.get(found);}return path;
}
function updateGuard(dt){if(guard.hp<=0||phase===0)return;const d=distance(player,guard);if(d<165){guard.alert=true;guard.seen=true;}if(guard.alert&&d>250){guard.alert=false;if(guard.seen){escaped=true;toast('Вы оторвались от Тезки!');}}
 const patrol=[{x:820,y:400},{x:820,y:100},{x:680,y:170},{x:700,y:420}];let target=guard.alert?player:patrol[guard.patrol];if(!guard.alert&&distance(guard,target)<28){guard.patrol=(guard.patrol+1)%patrol.length;target=patrol[guard.patrol];}
 guard.repath-=dt;if(guard.repath<=0){guard.path=route(target);guard.repath=.35;}
 const next=guard.path[0];if(next){const dx=next.x-guard.x,dy=next.y-guard.y,len=Math.hypot(dx,dy),step=(guard.alert?145:85)*dt;if(len<=step){guard.x=next.x;guard.y=next.y;guard.path.shift();}else{const x=guard.x+dx/len*step,y=guard.y+dy/len*step;if(!blocked(x,y)){guard.x=x;guard.y=y;}else guard.repath=0;}}
 if(distance(player,guard)<27&&invincible<=0){player.hp--;invincible=1.2;hud();toast('Тезка настиг вас! Бегите или нажмите F.');if(player.hp<=0){state='lost';panel('Тезка вас поймал','Попробуйте снова: собирайте еду для лечения, держите дистанцию или атакуйте первым.','Попробовать снова →');}}
}
function blocked(x,y){if(x<25||x>935||y<55||y>515)return true;if(x>578&&x<633&&!(phase>=1&&y>355&&y<415))return true;return obstacles.some(o=>x+11>o.x&&x-11<o.x+o.w&&y+10>o.y&&y-15<o.y+o.h);}
function update(dt){time+=dt;noticeTime=Math.max(0,noticeTime-dt);attackCooldown=Math.max(0,attackCooldown-dt);attackFlash=Math.max(0,attackFlash-dt);invincible=Math.max(0,invincible-dt);let dx=Number(keys.right)-Number(keys.left),dy=Number(keys.down)-Number(keys.up);const len=Math.hypot(dx,dy)||1;dx=dx/len*195*dt;dy=dy/len*195*dt;if(!blocked(player.x+dx,player.y))player.x+=dx;if(!blocked(player.x,player.y+dy))player.y+=dy;
 for(const i of items)if(!i.taken&&distance(player,i)<26&&phase>=1){i.taken=true;player[i.kind]++;player.hp=Math.min(5,player.hp+1);toast(i.kind==='burger'?'Бургер найден! +1 здоровье':'Пирожок найден! +1 здоровье');hud();}
 updateGuard(dt);if(state==='playing'&&distance(player,exit)<35){state='won';const food=player.burger+player.pie;hud();panel(food===6?'Идеальный финиш! 🏆':'Вы добрались до покрышки!',`Еда: ${food}/6 — бургеры ${player.burger}/3, пирожки ${player.pie}/3. ${food===6?'Максимальный результат!':`До максимума не хватает ${6-food}. Попробуете собрать всё?`}`,'Пройти ещё раз →');}}

function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function circle(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function label(text,x,y,color='#fff8dd'){ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#193d35d9';const w=ctx.measureText(text).width+18;ctx.fillRect(x-w/2,y-16,w,23);ctx.fillStyle=color;ctx.fillText(text,x,y);}
function person(x,y,color,hero=false){ctx.fillStyle='#18392a35';ctx.beginPath();ctx.ellipse(x,y+14,15,6,0,0,Math.PI*2);ctx.fill();rect(x-9,y-4,18,19,color);rect(x-8,y-18,16,16,'#f6c597');rect(x-10,y-21,20,7,hero?'#e97856':'#614b55');rect(x+3,y-13,3,3,'#273b43');rect(x-9,y+13,7,6,'#304753');rect(x+3,y+13,7,6,'#304753');}
function draw(){rect(0,0,W,H,'#88b77b');for(let i=0;i<95;i++){const x=(i*137)%950,y=(i*83)%530;rect(x,y,3,6,'#709f68');}rect(220,215,50,285,'#d7c397');rect(240,350,500,65,'#d7c397');rect(475,100,35,275,'#d7c397');
 rect(580,0,52,H,'#68b9c5');for(let y=10;y<H;y+=35)rect(594+Math.sin(time+y)*4,y,22,3,'#a3d9db');
 if(phase>=1){rect(569,359,75,54,'#825b44');for(let y=362;y<410;y+=10)rect(567,y,79,7,'#c79c64');}else{rect(564,358,18,54,'#825b44');rect(630,358,18,54,'#825b44');}
 for(const [i,o] of obstacles.entries()){rect(o.x+4,o.y+6,o.w,o.h,'#493f3e30');rect(o.x,o.y,o.w,o.h,'#f1d5a0');ctx.fillStyle=['#b96855','#597e9c','#98789c'][i];ctx.beginPath();ctx.moveTo(o.x-12,o.y);ctx.lineTo(o.x+o.w/2,o.y-46);ctx.lineTo(o.x+o.w+12,o.y);ctx.fill();rect(o.x+45,o.y+26,25,o.h-26,'#755744');rect(o.x+12,o.y+15,21,20,'#80b6bf');}
 for(let i=0;i<13;i++){const x=i<7?45+i*77:70+(i-7)*145,y=i<7?78:485;rect(x-4,y,8,25,'#786044');circle(x,y-10,24,'#447b59');circle(x-10,y-3,17,'#4f8b5c');}
 circle(exit.x,exit.y+3,33,'#24313b');circle(exit.x,exit.y+3,19,'#88b77b');ctx.strokeStyle='#53616a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(exit.x,exit.y+3,26,0,Math.PI*2);ctx.stroke();for(let k=0;k<12;k++){const angle=k*Math.PI/6;ctx.save();ctx.translate(exit.x,exit.y+3);ctx.rotate(angle);rect(24,-3,8,4,'#15232c');ctx.restore();}label('ФИНИШ · ПОКРЫШКА',exit.x-14,exit.y-42);
 for(const i of items)if(!i.taken){const y=i.y+Math.sin(time*3+i.x)*2;if(i.kind==='burger'){circle(i.x,y-3,11,'#efbd6c');rect(i.x-12,y,24,4,'#5e9a46');rect(i.x-11,y+4,22,5,'#714536');rect(i.x-11,y+9,22,5,'#eebc69');rect(i.x-5,y-8,3,2,'#fff1bd');rect(i.x+4,y-6,3,2,'#fff1bd');}else{ctx.fillStyle='#e3a957';ctx.beginPath();ctx.ellipse(i.x,y,15,9,-.3,0,Math.PI*2);ctx.fill();for(let k=-6;k<=6;k+=6)rect(i.x+k,y-5,2,7,'#bd7c39');}}
 if(guard.hp>0){if(guard.alert){ctx.strokeStyle='#e9685860';ctx.lineWidth=2;ctx.beginPath();ctx.arc(guard.x,guard.y,30,0,Math.PI*2);ctx.stroke();}person(guard.x,guard.y,'#77485c');label(`Тезка · ${guard.hp}/4${guard.alert?' · ПОГОНЯ!':''}`,guard.x,guard.y-35,'#ffb4a2');}
 if(attackFlash>0){ctx.strokeStyle='#ffe39b';ctx.lineWidth=5;ctx.beginPath();ctx.arc(player.x,player.y,55,0,Math.PI*2);ctx.stroke();}
 npcs.forEach(n=>{person(n.x,n.y,n.color);label(n.name,n.x,n.y-33);});if(invincible<=0||Math.floor(invincible*12)%2===0)person(player.x,player.y,'#437e9e',true);
 const near=nearby();if(near&&state==='playing')label('E · Поговорить',player.x,player.y+44,'#ffe09a');
 if(noticeTime>0)label(notice,W/2,490);label(phase>=1?'Мост открыт':'Мост закрыт',607,445);
}
function frame(now){const dt=Math.min((now-last)/1000,.04);last=now;if(state==='playing')update(dt);draw();requestAnimationFrame(frame);}
function pause(){if(state==='playing'){state='paused';Object.keys(keys).forEach(k=>keys[k]=false);panel('Привал','Долина подождёт вашего возвращения.','Продолжить →');}else if(state==='paused'){state='playing';overlay.hidden=true;}}
const map={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};
window.addEventListener('keydown',e=>{if(map[e.code]){e.preventDefault();keys[map[e.code]]=true;}if(e.code==='KeyE'||e.code==='Space'){e.preventDefault();if(!e.repeat){if(state==='dialog'){state='playing';overlay.hidden=true;}else interact();}}if(e.code==='KeyF'&&!e.repeat){e.preventDefault();attack();}if(e.code==='KeyP'&&!e.repeat)pause();});
window.addEventListener('keyup',e=>{if(map[e.code]){e.preventDefault();keys[map[e.code]]=false;}});window.addEventListener('blur',()=>{if(state==='playing')pause();});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys[b.dataset.key]=false);});
document.querySelector('#attack').onclick=attack;document.querySelector('#interact').onclick=interact;document.querySelector('#restart').onclick=start;document.querySelector('#play').onclick=()=>{if(state==='dialog'||state==='paused'){state='playing';overlay.hidden=true;}else start();};reset();requestAnimationFrame(frame);
