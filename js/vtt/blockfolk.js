// Blockfolk's faceted low-poly heroes, built in code. blockfolk.html poses them; the table uses them as token minis.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RACES, SCALE, UPI, PARTS, SLIDERS } from "./blockfolk-data.js";
import { buildCreature, moveCreature } from "./blockcreature.js";
import { RACE_PARTS, RACE_FACE } from "./raceparts-data.js";

const BONE='#e8dfc8',FUR='#8a6a4a';
const METAL='#c4cad3',WOOD='#7a5230',GOLD='#e0b84a',LEATHER='#6b4a2e';
let S={},refs={};
const shade=(hex,a)=>{a=Math.max(-.95,Math.min(.95,a));const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const t=a<0?0:255,p=Math.abs(a);r=Math.round(r+(t-r)*p);g=Math.round(g+(t-g)*p);b=Math.round(b+(t-b)*p);return'#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)};
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
const rng=seed=>()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
export function tex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;t.colorSpace=THREE.SRGBColorSpace;return t}
const LC={},lin=hex=>LC[hex]||(LC[hex]=new THREE.Color(hex));
const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
let jr=rng(7);
const MK=(o)=>new THREE.MeshStandardMaterial(Object.assign({vertexColors:true,flatShading:true,roughness:.82,metalness:0},o));
const BASE=MK({}),DBL=MK({side:THREE.DoubleSide}),METALM=MK({roughness:.3,metalness:.7}),METALD=MK({roughness:.3,metalness:.7,side:THREE.DoubleSide});
const cache={};
const glow=hex=>cache['g'+hex]||(cache['g'+hex]=new THREE.MeshBasicMaterial({color:hex}));
const MM=hex=>({metal:hex});
const haloT=tex(64,64,x=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)});
haloT.magFilter=haloT.minFilter=THREE.LinearFilter;
const haloM=hex=>cache['h'+hex]||(cache['h'+hex]=new THREE.SpriteMaterial({map:haloT,color:hex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
function addGlow(mesh,hex,size){const sp=new THREE.Sprite(haloM(hex));sp.scale.set(size,size,1);mesh.add(sp);return mesh}
function faceColors(g,colOf){const p=g.attributes.position,c=new Float32Array(p.count*3);
 for(let t=0;t<p.count/3;t++){const k=lin(colOf(t)),j=1+(jr()-.5)*.1;for(let v=0;v<3;v++){const i=(t*3+v)*3;c[i]=k.r*j;c[i+1]=k.g*j;c[i+2]=k.b*j}}
 g.setAttribute('color',new THREE.BufferAttribute(c,3));return g}
function solid(geo,hex){const g=geo.index?geo.toNonIndexed():geo;g.computeVertexNormals();return faceColors(g,()=>hex)}
function add(p,geo,m,x=0,y=0,z=0){let mt=m;
 if(typeof m==='string'){geo=solid(geo,m);mt=BASE}else if(m&&m.metal){geo=solid(geo,m.metal);mt=m.dbl?METALD:METALM}
 const me=new THREE.Mesh(geo,mt);me.position.set(x,y,z);p.add(me);return me}
const sph=(p,r,m,x=0,y=0,z=0,sx=1,sy=1,sz=1,seg=0)=>{const me=add(p,new THREE.IcosahedronGeometry(r,seg>=8?1:0),m,x,y,z);me.scale.set(sx,sy,sz);return me};
const cyl=(p,rt,rb,h,m,x=0,y=0,z=0,seg=6)=>add(p,new THREE.CylinderGeometry(rt,rb,h,Math.min(seg,8)),m,x,y,z);
const cone=(p,r,h,m,x=0,y=0,z=0,seg=5)=>add(p,new THREE.ConeGeometry(r,h,Math.min(seg,6)),m,x,y,z);
const box=(p,w,h,d,m,x=0,y=0,z=0)=>add(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
function grp(p,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g}
const ctr=a=>a.reduce((s,v)=>s.add(v),new THREE.Vector3()).divideScalar(a.length);
// sculpted tube: rings of [pos, rx, rz(or ry), offX, offZ(or offY)] along y or z
function tube(rings,o){const n=o.n||7,ax=o.axis||'y',cols=o.cols||['#888'],tri=[],tc=[];
 const Rg=rings.map(r=>{const a=[];for(let k=0;k<n;k++){const t=k/n*Math.PI*2,u=Math.sin(t)*r[1]+(r[3]||0),w=Math.cos(t)*r[2]+(r[4]||0);a.push(ax==='y'?new THREE.Vector3(u,r[0],w):new THREE.Vector3(u,w,r[0]))}return a});
 const push=(a,b,c,ref,hex)=>{const nr=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)),ce=a.clone().add(b).add(c).divideScalar(3).sub(ref);if(nr.dot(ce)<0){const q=b;b=c;c=q}tri.push(a,b,c);tc.push(hex)};
 for(let i=0;i<Rg.length-1;i++){const hex=cols[Math.min(i,cols.length-1)],mid=ctr(Rg[i]).add(ctr(Rg[i+1])).multiplyScalar(.5);
  for(let k=0;k<n;k++){const a=Rg[i][k],b=Rg[i][(k+1)%n],c=Rg[i+1][(k+1)%n],d=Rg[i+1][k];push(a,b,c,mid,hex);push(a,c,d,mid,hex)}}
 const L=Rg.length-1;
 if(o.cap0!==false){const c0=ctr(Rg[0]),ref=ctr(Rg[1]);for(let k=0;k<n;k++)push(c0,Rg[0][k],Rg[0][(k+1)%n],ref,cols[0])}
 if(o.cap1!==false){const c1=ctr(Rg[L]),ref=ctr(Rg[L-1]);for(let k=0;k<n;k++)push(c1,Rg[L][k],Rg[L][(k+1)%n],ref,cols[Math.min(L-1,cols.length-1)])}
 const pos=new Float32Array(tri.length*3);tri.forEach((v,i)=>{pos[i*3]=v.x;pos[i*3+1]=v.y;pos[i*3+2]=v.z});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.computeVertexNormals();return faceColors(g,t=>tc[t])}
function T(p,rings,o={},x=0,y=0,z=0){const me=new THREE.Mesh(tube(rings,o),o.metal?(o.dbl?METALD:METALM):o.dbl?DBL:BASE);me.position.set(x,y,z);p.add(me);return me}

// a Blockbench part from raceparts-data.js: its right half, mirrored for the left. fit moves each point (smaller ears, tusks).
function racePart(p,name,colors,fit=v=>v){const {v,f}=RACE_PARTS[name];
 for(const s of [1,-1])for(const [slot,ids] of Object.entries(f)){const pos=[];
  for(let i=0;i<ids.length;i+=3){const t=ids.slice(i,i+3);if(s<0)t.reverse();for(const k of t){const [x,y,z]=fit([v[k*3]/100,v[k*3+1]/100,v[k*3+2]/100]);pos.push(s*x,y,z)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));add(p,g,colors[slot])}}

function item(name){const g=new THREE.Group(),B='#e8edf3';
 const diamond=(w,y,c)=>{const d=box(g,w,w,.6,MM(c),0,y);d.rotation.z=Math.PI/4;return d};
 switch(name){
 case'sword':sph(g,.95,MM(GOLD),0,-2.1,0,1,1,1,4);cyl(g,.65,.65,3,LEATHER,0,0,0,6);box(g,5,1.1,1.6,MM(GOLD),0,2);box(g,1.9,8.5,.6,MM(B),0,7);diamond(1.34,11.2,B);break;
 case'axe':{cyl(g,.6,.6,14,WOOD,0,4.5,0,6);const b=box(g,4.2,4.2,.9,MM(METAL),2.3,10);b.rotation.z=Math.PI/4;b.scale.set(1,.75,1);const sp=cone(g,.7,2,MM(METAL),-1.4,10,0,4);sp.rotation.z=Math.PI/2;break}
 case'mace':cyl(g,.6,.6,9,WOOD,0,2.5,0,6);add(g,new THREE.DodecahedronGeometry(2.3),MM(METAL),0,8.6);[[1,0,0],[-1,0,0],[0,1,0],[0,0,1],[0,0,-1]].forEach(([a,b,c])=>{const s=cone(g,.6,1.6,MM(METAL),a*2.4,8.6+b*2.4,c*2.4,4);s.lookAt(a*9,8.6+b*9,c*9);s.rotateX(Math.PI/2)});break;
 case'dagger':cyl(g,.5,.5,2.4,LEATHER,0,0,0,6);box(g,3,.9,1.2,MM(GOLD),0,1.5);box(g,1.3,4,.45,MM(B),0,3.9);diamond(.92,5.9,B);break;
 case'staff':cyl(g,.7,.8,24,WOOD,0,3,0,6);[0,1,2].forEach(i=>{const a=i/3*Math.PI*2,c=cone(g,.45,2.6,shade(WOOD,-.25),Math.cos(a)*1.4,16.4,Math.sin(a)*1.4,4);c.rotation.set(Math.sin(a)*.4,0,-Math.cos(a)*.4)});addGlow(add(g,new THREE.IcosahedronGeometry(1.6),glow(S.trim),0,16.8),S.trim,7);break;
 case'rod':cyl(g,.6,.6,11,'#2a2030',0,2.5,0,6);cyl(g,1.5,1,1,MM(GOLD),0,8,0,6);addGlow(add(g,new THREE.OctahedronGeometry(1.6),glow(S.trim),0,9.8),S.trim,7);break;
 case'bow':{const b=grp(g,0,0,-5.6);b.rotation.y=-Math.PI/2;const a=add(b,new THREE.TorusGeometry(7,.55,4,10,Math.PI*.9),WOOD);a.rotation.z=-Math.PI*.45;cyl(g,.12,.12,13.8,'#efe6d0',0,0,-4.5,4);cyl(g,.8,.8,2.6,LEATHER,0,0,1.4,6);break}
 case'shield':{const s=cyl(g,4.8,4.8,1.1,S.style==='plate'?S.top:S.trim,0,0,0,10);s.rotation.z=Math.PI/2;cyl(g,5.2,5.2,.8,MM(METAL),-.25,0,0,10).rotation.z=Math.PI/2;sph(g,1.5,MM(GOLD),.6,0,0,.6,1,1,6);break}
 case'book':box(g,2,4.6,3.6,'#5a2238');box(g,2.1,1.2,1.2,MM(GOLD));box(g,1.6,4.2,3.7,'#efe6d0',-.3);break;
 case'orb':refs.orbs.push(addGlow(add(g,new THREE.IcosahedronGeometry(1.8),glow(S.trim)),S.trim,9));break;
 case'greatsword':sph(g,1,MM(GOLD),0,-3.3,0,1,1,1,4);cyl(g,.65,.65,5,LEATHER,0,-.5,0,6);box(g,7,1.2,1.7,MM(GOLD),0,2.4);box(g,2.5,13,.65,MM(B),0,9.5);diamond(1.76,16,B);break;
 case'rapier':sph(g,.7,MM(GOLD),0,-1.8,0,1,1,1,4);cyl(g,.45,.45,2.8,LEATHER,0,0,0,6);add(g,new THREE.TorusGeometry(1.5,.28,4,10),MM(GOLD),0,1.5).rotation.x=Math.PI/2;box(g,.55,11,.35,MM(B),0,7);diamond(.4,12.5,B);break;
 case'hammer':cyl(g,.6,.65,15,WOOD,0,4.5,0,6);box(g,6.5,3.6,3.6,MM(METAL),0,11.5);box(g,1,4,4,MM(GOLD),0,11.5);break;
 case'flail':{cyl(g,.6,.6,7,WOOD,0,1.5,0,6);[0,1,2].forEach(i=>sph(g,.42,MM(METAL),i*.75,5.6+i*1.1,0));add(g,new THREE.IcosahedronGeometry(1.7),MM(shade(METAL,-.2)),3,9.4);[[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>cone(g,.45,1.2,MM(METAL),3+a*1.9,9.4+b*1.9,0,4).rotation.z=Math.atan2(-a,b));break}
 case'club':cyl(g,1.7,.55,12,shade(WOOD,-.1),0,4.5,0,6);[[1.4,8,0],[-1.2,9,.6],[0,7,-1.4]].forEach(([x,y,z])=>sph(g,.6,shade(WOOD,-.3),x,y,z));break;
 case'spear':case'trident':{cyl(g,.45,.5,25,WOOD,0,3,0,6);if(name==='spear'){cyl(g,.75,.75,.8,MM(GOLD),0,15.5,0,6);cone(g,1.2,5,MM(B),0,18.4,0,4)}else{box(g,5,.8,.8,MM(GOLD),0,15.6);[-2.2,0,2.2].forEach(x=>cone(g,.6,x?4:5.2,MM(B),x,x?17.8:18.6,0,4))}break}
 case'scythe':{cyl(g,.5,.55,24,'#3a2a20',0,3,0,6);const bl=add(g,new THREE.TorusGeometry(6,.5,3,10,Math.PI*.55),MM(B),-5.4,10.2);bl.rotation.z=.35;bl.scale.set(1,1,.5);cyl(g,.8,.8,1.2,MM(METAL),0,15,0,6);break}
 case'wand':cyl(g,.22,.38,6.5,'#3a2430',0,2,0,5);addGlow(add(g,new THREE.OctahedronGeometry(.7),glow(S.trim),0,5.8),S.trim,4);break;
 case'crossbow':{box(g,1.3,9,1.3,WOOD,0,2.5);const b=add(g,new THREE.TorusGeometry(4.2,.45,4,10,Math.PI*.7),MM(METAL),0,2.6);b.rotation.z=Math.PI*.15;cyl(g,.12,.12,7,'#efe6d0',0,5.2,0,4).rotation.z=Math.PI/2;break}
 case'towershield':box(g,1,12,7,S.top);box(g,.8,12.8,.7,MM(METAL),.3,0,3.5);box(g,.8,12.8,.7,MM(METAL),.3,0,-3.5);box(g,.8,.7,7.4,MM(METAL),.3,6.2);box(g,.8,.7,7.4,MM(METAL),.3,-6.2);sph(g,1.4,MM(GOLD),.8,0,0,.6,1,1,6);break;
 case'buckler':cyl(g,3,3,.9,MM(METAL),0,0,0,8).rotation.z=Math.PI/2;sph(g,1.2,MM(GOLD),.7,0,0,.7,1,1,6);break;
 case'torch':cyl(g,.45,.55,8,WOOD,0,2,0,6);cyl(g,.9,.7,1.2,'#2a2020',0,6.4,0,6);add(g,new THREE.ConeGeometry(1.1,3.4,5),glow('#ff8a1e'),0,8.6);addGlow(add(g,new THREE.ConeGeometry(.6,2.2,4),glow('#ffd95a'),0,8.3,.4),'#ff9a30',8);break;
 case'lantern':add(g,new THREE.TorusGeometry(1,.2,4,8),MM(METAL),0,.2);box(g,3,.6,3,MM(METAL),0,-1);box(g,3,.6,3,MM(METAL),0,-5);[[-1.3,-1.3],[1.3,-1.3],[-1.3,1.3],[1.3,1.3]].forEach(([x,z])=>box(g,.35,3.6,.35,MM(METAL),x,-3,z));addGlow(box(g,2,3.2,2,glow('#ffd36a'),0,-3),'#ffb347',8);break;
 case'potion':sph(g,1.5,glow(S.trim),0,.4,0,1,1,1,8);cyl(g,.55,.55,1.4,'#cfe8f0',0,2.2,0,6);cyl(g,.65,.65,.7,WOOD,0,3.2,0,6);break;
 case'tankard':cyl(g,1.5,1.3,3.6,WOOD,0,1,0,8);cyl(g,1.65,1.65,.45,MM(METAL),0,.2,0,8);cyl(g,1.65,1.65,.45,MM(METAL),0,2.2,0,8);sph(g,1.4,'#f4ecd8',0,2.9,0,1,.5,1);add(g,new THREE.TorusGeometry(1,.3,4,8),MM(METAL),1.7,1.2);break;
 case'skull':sph(g,1.7,'#e8dfc8',0,1.4,0,1,.95,1,8);box(g,1.8,1,1.6,'#d8cfb6',0,.1,.4);[-.6,.6].forEach(x=>sph(g,.45,glow(S.trim),x,1.5,1.45));break;
 case'banner':cyl(g,.4,.45,27,WOOD,0,4,0,6);cone(g,.7,1.8,MM(GOLD),0,18.3,0,4);box(g,7.4,.5,.5,MM(GOLD),3.4,16.8);box(g,6.4,8,.3,S.top,3.5,12.4);box(g,6.4,1,.34,S.trim,3.5,9);add(g,new THREE.OctahedronGeometry(1.5),S.trim,3.5,13.4).scale.z=.3;break;
 case'lute':sph(g,3,'#b07a3a',0,0,0,.95,1.1,.45,8);cyl(g,.8,.8,.3,'#2a1a10',0,.6,1.25,8).rotation.x=Math.PI/2;box(g,1.1,8,.8,WOOD,0,7);box(g,2,2.4,1,shade(WOOD,-.2),0,12);break;
 }return g}


export function buildHero(hero){
 S={...Object.fromEntries([...Object.entries(PARTS).map(([k,v])=>[k,v[0]]),...Object.keys(SLIDERS).map(k=>[k,1])]),...hero};const model=new THREE.Group();refs={orbs:[],fwd:[false,false],capeSegs:[]};jr=rng(hash(S.race+S.cls+S.skin+S.top));
 const R=RACES[S.race],[rsc,rlk]=SCALE[S.race],sc=rsc*S.height,lk=rlk*S.legLen,st=S.style,sk=S.head==='skull'?BONE:S.skin,w=(R.w||1)*S.build,dw=.5+.5*w,hk=(R.head||1)*(rsc<.8?1.12:1)*S.headSize,hc=S.hairC,top=S.top,bot=S.bot,trim=S.trim,al=S.armLen,flesh=S.skin;
 const pick=(chosen,own)=>chosen==='race'?own:chosen,ears=pick(S.ears,R.ears),has=v=>v==='none'?undefined:v,horns=has(pick(S.horns,R.horns)),tail=has(pick(S.tail,R.tail)),shoulders=S.shoulders==='auto'?{plate:'plate',leather:'pad',studded:'pad',hide:'fur',scale:'pad',bare:'tuft'}[st]||'none':S.shoulders;
 const metal=st==='plate',bare=st==='bare',chain=st==='chain',hide=st==='hide',leathery=st==='leather'||st==='studded',covered=['hood','helm','horned','bandana'].includes(S.hat),gold=trim===METAL?GOLD:trim;
 const shirt=bare?flesh:metal?METAL:chain?shade(METAL,-.28):hide?FUR:top,bootC=metal?shade(METAL,-.3):'#3a2a20',beltC=st==='robe'?trim:'#3a2618';
 const fem=S.sex==='female',thighL=4.4*lk,shinL=4.65*lk,hipY=thighL+shinL+.55,shY=hipY+4.6,shX=1.86*w*({broad:1.16,slim:.9}[S.torso]||1)*(fem?.9:1),wa=w*1.24*S.thick*({muscular:1.35,bone:.6}[S.arms]||1)*(fem?.86:1),wl=w*1.16*S.thick*(S.legs==='bone'?.55:1)*(fem?.94:1);
 // torso shapes widen or narrow the rings by height
 const shaped=rings=>rings.map(([y,rx,rz,ox=0,oz=0])=>{const [a,b]=y>5?[1,1]:S.torso==='slim'?[.84,.86]:S.torso==='broad'&&y>=2.4?[1.22,1.08]:S.torso==='belly'&&y>=0&&y<3?[1.15,1.5]:[1,1];const [c,d]=!fem||y>5?[1,1]:y<1?[1.06,1.02]:y<3?[.84,.9]:[.92,1.06];return[y,rx*a*c,rz*b*d,ox,oz+(b>1.4?.2:0)]});
 const deep={belly:1.45,broad:1.1,slim:.88}[S.torso]||1; // how far the front sticks out, for things pinned to it
 const legC=S.legs==='bone'?BONE:S.legs==='metal'?METAL:bot;
 // torso, coloured in bands: pants / belt / shirt / collar  (slim, reference proportions)
 T(model,shaped([[-.45,.86*w,.68*dw],[.3,1.42*w,.84*dw,0,-.05],[1.0,1.3*w,.8*dw],[1.4,1.24*w,.78*dw],[2.6,1.44*w,.88*dw,0,.08],[3.8,1.7*w,.96*dw,0,.12],[4.6,1.78*w,.88*dw,0,.04],[5.25,.46,.44]]),
  {n:7,cols:[bot,bot,beltC,shirt,shirt,shirt,bare?flesh:metal?METAL:trim]},0,hipY,0);
 box(model,.4,.36,.1,MM(GOLD),0,hipY+1.2,.84*dw*deep);
 refs.legs=[-1,1].map(s=>{const hip=grp(model,s*.76*w,hipY,0);
  const ld=dw*S.thick*(S.legs==='bone'?.55:1),peg=S.legs==='peg'&&s>0,plain=S.legs==='normal'||S.legs==='peg',lm=S.legs==='metal'?1:0;
  T(hip,[[.3,.68*wl,.7*ld],[0,.74*wl,.74*ld],[-1.5*lk,.66*wl,.68*ld,0,.04],[-3.6*lk,.45*wl,.48*ld],[-thighL,.42*wl,.44*ld]],{n:6,metal:lm,cols:[legC]});
  const knee=grp(hip,0,-thighL,0);
  if(!plain&&S.legs!=='hooves')sph(knee,.5*wl+.12,lm?MM(GOLD):BONE);
  if(peg){cyl(knee,.5*wl,.55*wl,.7,LEATHER,0,-.2,0,7);cyl(knee,.34,.18,shinL+.1,WOOD,0,-shinL/2-.45,0,6);return{hip,knee,s}}
  T(knee,[[.12,.42*wl,.44*ld],[-1.0*lk,.47*wl,.52*ld,0,-.08],[-2.9*lk,.33*wl,.35*ld],[-3.05*lk,.37*wl,.39*ld],[-shinL,.28*wl,.3*ld]],{n:6,metal:lm,cols:plain?[bot,bot,bootC,bootC]:[legC]});
  if(metal&&plain)T(knee,[[.25,.5*wl,.56*dw,0,.03],[-1.0*lk,.54*wl,.6*dw,0,-.05],[-2.8*lk,.4*wl,.44*dw]],{n:6,metal:1,cols:[METAL]});
  const ank=grp(knee,0,-shinL,0);
  if(S.legs==='hooves')cyl(ank,.34*wl,.55*wl,.8,'#2a1e18',0,-.15,.1,6);
  else T(ank,[[-.35,.28*wl,.24,0,-.2],[.25,.32*wl,.27,0,-.24],[1.0,.3*wl,.18,0,-.33],[1.4,.2*wl,.11,0,-.38]],{n:6,axis:'z',metal:lm,cols:[plain?bootC:legC]});
  return{hip,knee,s}});
 if(st==='cloth'||leathery||bare||hide||chain||st==='scale'){const L=bare?-1.1:st==='cloth'?-1.9:hide?-1.6:chain?-1.5:-1.0;T(model,shaped([[1.4,1.28*w,.82*dw],[.4,1.5*w,.95*dw],[L,1.66*w,1.04*dw]]),{n:7,dbl:1,cols:[bare?'#8a6a4a':hide?FUR:chain?shade(METAL,-.28):top],cap0:false,cap1:false},0,hipY,0)}
 if(st==='coat'){T(model,shaped([[4.7,1.84*w,.98*dw],[3.8,1.8*w,1.04*dw,0,.1],[1.4,1.36*w,.88*dw],[0,1.6*w,1.0*dw],[-thighL+.3,1.95*w,1.18*dw]]),{n:9,dbl:1,cols:[top],cap0:false,cap1:false},0,hipY,0);
  [-1,1].forEach(s=>{box(model,.34,3.6,.16,trim,s*.5,hipY+3.1,1.12*dw*deep).rotation.z=-s*.2;for(let k=0;k<3;k++)sph(model,.15,MM(GOLD),s*.28,hipY+1.9+k*.55,1.07*dw*deep)})}
 if(st==='studded')for(let row=0;row<4;row++)for(let k=-2;k<=2;k++)sph(model,.14,MM(METAL),k*.52*w+(row%2)*.2,hipY+1.9+row*.65,(1.07-Math.abs(k)*.11)*dw*deep);
 if(st==='scale')for(let row=0;row<5;row++)for(let k=-2;k<=2;k++){const sf=cone(model,.36*w,.75,MM(row%2?trim:shade(trim,-.25)),(k+(row%2?.25:-.25))*.55*w,hipY+1.7+row*.6,(1.05-Math.abs(k)*.12)*dw*deep,4);sf.rotation.x=Math.PI;sf.scale.z=.3}
 if(chain){for(let k=0;k<9;k++){const y=1.6+k*.38,r=y<2.6?1.36:y<3.8?1.64:1.8;T(model,shaped([[y,r*w*1.03,.96*dw,0,.07],[y+.13,r*w*1.03,.96*dw,0,.07]]),{n:7,metal:1,cols:[METAL],cap0:false,cap1:false},0,hipY,0)}box(model,1.9*w,.5,.14,top,0,hipY+1.3,1.02*dw*deep)}
 if(hide)for(let k=0;k<14;k++){const a=k/14*Math.PI*2;cone(model,.34,1,k%2?FUR:shade(FUR,-.2),Math.sin(a)*1.55*w,hipY-1.5,Math.cos(a)*1.0*dw*deep,3).rotation.x=Math.PI}
 if(st==='robe')T(model,[[1.4,1.28*w,.82*dw],[0,1.55*w,.98*dw],[-hipY*.5,1.7*w,1.08*dw],[-hipY+.9,1.95*w,1.22*dw],[-hipY+.35,2.0*w,1.26*dw]],{n:8,dbl:1,cols:[top,top,top,trim],cap0:false,cap1:false},0,hipY,0);
 if(metal){T(model,shaped([[1.25,1.32*w,.84*dw],[2.6,1.5*w,.96*dw,0,.08],[3.8,1.78*w,1.05*dw,0,.12],[4.6,1.86*w,.96*dw,0,.04],[5.2,.66,.56]]),{n:7,metal:1,cols:[METAL]},0,hipY,0);
  box(model,1.36*w,3.2,.1,top,0,hipY-.3,.95*dw*deep);box(model,.3,3.2,.12,gold,0,hipY-.3,.96*dw*deep)}
 if(leathery||bare){const sp=box(model,.32,4.9,.1,bare?top:trim,0,hipY+3.0,1.1*dw*deep);sp.rotation.z=.66}
 if(st==='cloth'||leathery)box(model,.55,.65,.35,LEATHER,.95*w,hipY+1.0,.72*dw*deep).rotation.y=-.4;
 // bone and metal arms replace sleeves, armour and hands; bare skin shows on muscular and clawed arms
 const own={bone:BONE,metal:METAL}[S.arms],skinArm=bare||hide||S.arms==='muscular'||S.arms==='claws',am=S.arms==='metal'?1:0;
 const sleeve=own||(skinArm?flesh:metal?METAL:chain?shade(METAL,-.28):top),fore=own||(skinArm?flesh:sleeve),cuffC=own||(metal?METAL:skinArm?LEATHER:trim),handC=own||(metal?shade(METAL,-.1):flesh),armour=metal&&!own,ad=dw*S.thick*({muscular:1.35,bone:.6}[S.arms]||1);
 refs.arms=[-1,1].map(s=>{const sh=grp(model,s*shX,shY,0);
  T(sh,[[.22,.4*wa,.42*ad],[0,.44*wa,.44*ad],[-.5*al,.42*wa,.42*ad],[-1.8*al,.34*wa,.35*ad],[-2.9*al,.29*wa,.3*ad]],{n:6,metal:am,cols:[sleeve]});
  const el=grp(sh,0,-2.9*al,0);
  if(own)sph(el,.3*wa+.14,am?MM(GOLD):BONE);
  T(el,[[.08,.29*wa,.31*ad],[-.6*al,.33*wa,.32*ad],[-2.0*al,.24*wa,.26*ad],[-2.05*al,.27*wa,.29*ad],[-2.5*al,.22*wa,.24*ad]],{n:6,metal:am,cols:[fore,fore,cuffC,cuffC]});
  if(armour)T(el,[[-.3*al,.37*wa,.38*ad],[-2.3*al,.29*wa,.31*ad]],{n:6,metal:1,cols:[METAL]});
  const wr=grp(el,0,-2.5*al,0),hw=Math.max(wa,.9);
  T(wr,[[.03,.2,.13],[-.35,.26*hw,.14],[-.8,.23*hw,.12],[-1.15,.12,.08]],{n:6,metal:armour||am?1:0,cols:[handC]});
  if(S.arms==='claws')[-.22,0,.22].forEach(x=>cone(wr,.09,.8,'#f1e8d4',x,-1.4,.08,3).rotation.x=Math.PI);
  const sw=Math.max(wa,.85);
  if(['plate','pauldrons','spikes'].includes(shoulders)){sph(sh,.62*sw,MM(METAL),s*.1,.18,0,1.15,.8,1.1);sph(sh,.48*sw,MM(shade(METAL,.1)),s*.18,.5,0,1.1,.7,1.05);cyl(sh,.7*sw,.73*sw,.16,MM(gold),s*.1,-.1,0,7);
   if(shoulders==='spikes')[[.1,1.4,0],[.65,1.05,.35],[.65,1.05,-.35]].forEach(([x,y,z])=>cone(sh,.2,.9,MM(METAL),s*x,y,z,4).rotation.z=-s*x*.8)}
  else if(shoulders==='pad')sph(sh,.55*sw,trim,s*.1,.14,0,1.1,.6,1.05);
  else if(shoulders==='fur'){sph(sh,.75*sw,FUR,s*.05,.2,0,1.25,.8,1.3);for(let k=0;k<5;k++)sph(sh,.34*sw,shade(FUR,k%2?.2:-.15),s*(.2+Math.cos(k*1.3)*.5),.45+Math.sin(k*2)*.15,Math.sin(k*1.3)*.7)}
  else if(shoulders==='tuft'&&s<0)sph(sh,.65*sw,'#e2d7c6',s*.06,.18,0,1.2,.8,1.2);
  return{sh,el,wr,hand:grp(wr,0,-.55,0),s}});
 // faceless faceted head (narrow egg, reference proportions)
 const neck=refs.neck=grp(model,0,hipY+5.15,0);
 T(neck,[[-.25,.44,.42],[.7,.37,.38,0,.04]],{n:6,cols:[sk]});
 const shape=S.head,heroic=shape==='heroic',beast=shape==='beast'||(R.snout&&shape!=='skull'&&shape!=='bird'&&!heroic),noFace=shape==='skull'||shape==='bird';
 const head=refs.head=grp(neck,0,.62,0);head.scale.set(.82*hk,1.04*hk,.9*hk);
 const jaw=S.beard==='stubble'?mix(sk,hc,.35):sk;
 const heroC=heroic&&{skin:sk,shade:shade(sk,-.12),dark:shade(sk,-.62),lip:mix(sk,'#8a3a3a',fem?.55:.35),bone:'#efe2c4',horn:S.race==='Tiefling'?'#4a3238':'#d8c8a8',hair:S.hair==='bald'||covered?shade(sk,-.4):hc,inner:mix(sk,'#6a2a2a',.28),white:'#f4f0e8'};
 if(heroic)racePart(head,'head.'+S.race+(fem?'.f':''),heroC);
 else if(shape==='square')box(head,1.9,2.25,1.8,sk,0,1.15);
 else if(shape==='round')T(head,[[0,.6,.6,0,.2],[.35,1.0,.98,0,.05],[.85,1.15,1.08],[1.35,1.16,1.08],[1.85,1.0,.97],[2.3,.55,.55]],{n:8,cols:[jaw,jaw,sk]});
 else if(shape==='long')T(head,[[-.55,.34,.4,0,.42],[.1,.66,.74,0,.24],[.75,.86,.98,0,.08],[1.15,.92,1.04,0,.04],[1.8,.92,1.04],[2.4,.78,.9,0,-.05],[2.85,.36,.46,0,-.08]],{n:8,cols:[jaw,jaw,sk]});
 else if(shape==='skull'){T(head,[[.1,.4,.4,0,.45],[.5,.55,.6,0,.35],[.75,.9,.98,0,.08],[1.15,.98,1.05,0,.04],[1.6,1.0,1.06],[2.05,.84,.92,0,-.05],[2.35,.42,.5,0,-.08]],{n:8,cols:[sk]});for(let k=-2;k<=2;k++)box(head,.12,.24,.1,'#f6f0e0',k*.17,.42,.92);cone(head,.13,.28,'#2a2020',0,.76,1.02,3)}
 else T(head,[[0,.42,.45,0,.42],[.35,.78,.8,0,.2],[.75,.92,1.0,0,.08],[1.15,.98,1.05,0,.04],[1.6,.98,1.05],[2.05,.84,.92,0,-.05],[2.35,.42,.5,0,-.08]],{n:8,cols:[jaw,jaw,sk]});
 // just eyes: small faceted ovals set into the face planes
 // cosy village-style face: solid dark eyes with sparkle, little brows, blush, tiny smile
 const disc=(p,r,c,x,y,z,sx,sy,seg=8,th=Math.PI*2,ts=0)=>{const d=add(p,new THREE.CylinderGeometry(r,r,.012,seg,1,false,ts,th),c,x,y,z);d.rotation.x=Math.PI/2;d.scale.set(sx,1,sy);return d};
 const bearded=S.beard==='short'||S.beard==='long';
 // heroic heads are sculpted, so the same face sits wherever that head's surface is
 const F=heroic&&RACE_FACE[S.race+(fem?'.f':'')],eyeY=F?1.1:1.0,dragon=heroic&&S.race==='Dragonborn';
 refs.eyes=[-1,1].map(s=>{const g=grp(head,s*.38,eyeY,F?F[0]+.035:.915);g.rotation.y=s*(F?.3:.42);
  if(fem&&heroic)box(g,.13,.032,.02,'#140d10',s*.15,.15,.03).rotation.z=s*.6; // lashes
  if(shape==='skull')disc(g,.27,'#140d10',0,0,.004,1,1);
  disc(g,shape==='skull'?.1:.17,R.glow||shape==='skull'?glow(shade(S.eye,.15)):shade(S.eye,-.78),0,0,.016,.82,1.08);   // solid dark oval eye
  if(shape!=='skull'){disc(g,.055,glow('#ffffff'),s*.035,.075,.026,1,1,6);                              // big sparkle
  disc(g,.025,glow('#ffffff'),s*-.04,-.06,.026,1,1,6);                             // small sparkle
  if(S.hat!=='helm'&&S.hat!=='horned')box(g,.2,.045,.02,S.hair==='bald'||covered?shade(S.skin,-.4):S.hairC,s*.02,.32,F?F[3]-F[0]+.015:.02).rotation.z=s*.18} // short soft brow
  return g});
 if(!bearded&&!noFace&&!dragon)[-1,1].forEach(s=>{const c=grp(head,s*.52,.72,F?F[1]+.025:.83);c.rotation.y=s*.55;disc(c,.13,mix(S.skin,'#ff7f86',.42),0,0,.01,1.25,.62)}); // blush
 if(!bearded&&!beast&&!noFace&&!dragon){const m=grp(head,0,.56,F?F[2]+.03:1.035);disc(m,.08,'#5a2a2e',0,0,.012,1.3,1,8,Math.PI,-Math.PI/2)} // tiny smile
 if(beast){T(head,[[.3,.62,.42,0,.62],[.9,.56,.4,0,.6],[1.5,.4,.3,0,.58],[1.85,.22,.18,0,.58]],{n:6,axis:'z',cols:[sk]});if(shape==='beast')sph(head,.17,'#2a1a1a',0,.7,1.86)}
 else if(shape==='bird'){cone(head,.45,1.35,'#e8a83a',0,.72,1.5,4).rotation.x=Math.PI/2+.18;cone(head,.28,.7,'#c8842a',0,.45,1.25,3).rotation.x=Math.PI/2-.15}
 else if(shape==='skull'||heroic){}
 else if(R.cat)cone(head,.12,.2,'#d98a9a',0,.92,1.08,3).rotation.x=Math.PI/2;
 else cone(head,R.nose?.3:.17,R.nose?.62:.42,R.nose?shade(sk,.04):sk,0,.95,R.nose?1.25:1.12,3).rotation.x=Math.PI/2;
 if(heroic){ // modelled ears, horns and tusks; the Ears and Horns choices still apply
  const own={Human:['round'],Elf:['long'],Dwarf:['round'],Halfling:['small'],Gnome:['small'],'Half-Orc':['long',.62],Tiefling:['long',.55],Tabaxi:['cat'],Goliath:['round'],Aasimar:['round'],Goblin:['goblin']}[S.race];
  const [ear,size=1]=S.ears==='race'?own||[]:[{elf:'long'}[S.ears]||S.ears];
  if(ear&&ear!=='none'&&!(ear==='cat'&&covered))racePart(head,'ear.'+ear,heroC,v=>v.map((c,i)=>[.95,1.18,-.08][i]+(c-[.95,1.18,-.08][i])*size));
  if(horns==='tief'||horns==='drag')racePart(head,'horn.'+horns,{...heroC,horn:horns==='tief'?'#4a3238':heroC.horn});
  if(R.tusks)racePart(head,'tusk',heroC,fem?v=>v.map((c,i)=>[.33,.42,1.04][i]+(c-[.38,.42,1.08][i])*.65):undefined);
 }
 [-1,1].forEach(s=>{
  const plainEars=S.ears!=='race'||(!beast&&!noFace);
  if(heroic){}
  else if(ears==='elf')cone(head,.2,1.1,sk,s*1.3,1.3,-.05,3).rotation.z=-s*(Math.PI/2-.5);
  else if(ears==='goblin')cone(head,.36,1.8,sk,s*1.78,1.2,0,3).rotation.z=-s*(Math.PI/2-.15);
  else if(ears==='cat'){if(!covered)cone(head,.4,.8,sk,s*.6,2.3,0,3).rotation.z=-s*.35}
  else if(ears!=='none'&&plainEars)sph(head,ears==='small'?.17:.22,sk,s*(shape==='round'?1.15:.98),1.05,-.05,.45,1,.75);
  if(horns==='antlers'){const g=grp(head,s*.5,2.1,-.1);g.rotation.z=-s*.5;cyl(g,.09,.14,1.7,'#c9ad82',0,.8,0,5);[[.7,.9,.7],[1.3,-.75,.6],[1.6,.5,.5]].forEach(([y,a,l])=>{const t=grp(g,0,y,0);t.rotation.z=a*s;cone(t,.08,l*1.5,'#d8c096',0,l*.7,0,4)})}
  if(horns==='tief'&&!heroic){const g=grp(head,s*.5,2.1,.2);g.rotation.z=-s*.45;cone(g,.2,.8,'#3a2a2e',0,.4,0,5);const g2=grp(g,0,.72,0);g2.rotation.x=-1;cone(g2,.13,.6,'#4a3840',0,.28,0,5)}
  if(horns==='drag'&&!heroic){const g=grp(head,s*.45,1.8,-.7);g.rotation.set(-1.3,0,-s*.25);cone(g,.2,1.3,'#efe2c4',0,.65,0,5)}
  if(R.tusks&&!heroic)cone(head,.08,.32,'#f4ecd8',s*.3,.45,.98,3);
 });
 if(R.halo){const hl=refs.halo=add(head,new THREE.TorusGeometry(.8,.06,4,14),glow(GOLD),0,3.0,0);hl.rotation.x=Math.PI/2;addGlow(hl,GOLD,2.6)}
 if(!covered&&S.hair!=='bald'){
  if(['short','long','bun','braids'].includes(S.hair)){const hg=grp(head,0,1.25,0);hg.rotation.x=-.3;T(hg,[[0,1.04,1.1,0,-.05],[.45,1.05,1.12,0,-.02],[.9,.9,.99,0,-.07],[1.22,.45,.56,0,-.1]],{n:8,dbl:1,cols:[hc],cap0:false})}
  if(S.hair==='long')T(head,[[1.7,.98,.42,0,-.66],[.4,1.0,.42,0,-.78],[-.9,.92,.32,0,-.72]],{n:6,dbl:1,cols:[hc]});
  if(S.hair==='bun')sph(head,.48,hc,0,2.15,-.82);
  if(S.hair==='braids')[-1,1].forEach(s=>{T(head,[[1.0,.2,.2],[-.9,.13,.13]],{n:5,cols:[hc]},s*.98,0,.15);sph(head,.16,trim,s*.98,-.95,.15)});
  if(S.hair==='mohawk')for(let k=0;k<5;k++){const a=-.4+k*.4;cone(head,.2,.75,hc,0,1.2+1.15*Math.cos(a),-1.12*Math.sin(a),3).rotation.x=-a}
 }
 if(S.beard==='short'||S.beard==='long'){const r=[[1.0,.97,.45,0,.68],[.6,.9,.5,0,.62],[.2,.64,.45,0,.58],[-.15,.3,.3,0,.55]];if(S.beard==='long')r.splice(3,1,[-.4,.5,.4,0,.56],[-1.1,.3,.25,0,.5],[-1.6,.06,.06,0,.45]);if(heroic){ // start under the nose, follow how far this chin sticks out, and add a moustache
  const {v}=RACE_PARTS['head.'+S.race+(fem?'.f':'')];let front=0;for(let i=0;i<v.length;i+=3)if(v[i+1]<65&&Math.abs(v[i])<10)front=Math.max(front,v[i+2]/100);
  r[0]=[.58,.9,.4,0,.6];r[1]=[.4,.86,.46,0,.62];r.forEach(q=>q[4]+=Math.max(0,front-.96));
  [-1,1].forEach(s=>cone(head,.1,.55,hc,s*.25,.66,front+.04,4).rotation.z=s*1.9)}
 T(head,r,{n:8,cols:[hc]})}
 if(S.face==='glasses'){[-1,1].forEach(s=>{const g=grp(head,s*.42,eyeY,1.07);g.rotation.y=s*.4;add(g,new THREE.TorusGeometry(.27,.045,4,10),MM(GOLD))});box(head,.3,.06,.05,MM(GOLD),0,eyeY+.06,1.17)}
 if(S.face==='eyepatch'){const g=grp(head,.4,eyeY,1.0);g.rotation.y=.42;disc(g,.28,'#17110f',0,0,.05,1,1);box(head,2.0,.1,.06,'#17110f',0,eyeY+.32,heroic?1.08:1.02).rotation.z=-.28}
 if(S.face==='mask')T(head,[[.05,.55,.55,0,.44],[.4,.86,.88,0,.24],[.82,1.0,1.09,0,.1]],{n:8,dbl:1,cols:[shade(top,-.35)],cap0:false,cap1:false});
 if(S.neck==='scarf'){add(model,new THREE.TorusGeometry(.62,.28,5,9),trim,0,hipY+5.2,.05).rotation.x=Math.PI/2;box(model,.5,2,.16,trim,.5,hipY+4.2,1.12*dw*deep).rotation.z=.18}
 if(S.neck==='amulet'){add(model,new THREE.TorusGeometry(.8,.06,4,12),MM(GOLD),0,hipY+4.75,.35*dw).rotation.x=Math.PI/2-.75;addGlow(add(model,new THREE.OctahedronGeometry(.3),glow(S.eye),0,hipY+3.9,1.18*dw*deep),S.eye,1.6)}
 switch(S.hat){
  case'horned':{const hg=grp(head,0,1.2,0);hg.rotation.x=-.5;T(hg,[[-.1,1.1,1.16,0,-.04],[.5,1.12,1.18],[1.0,.94,1.02,0,-.06],[1.35,.4,.48,0,-.08]],{n:8,metal:1,dbl:1,cols:[METAL],cap0:false});
   [-1,1].forEach(s=>{const g=grp(head,s*1.0,1.85,-.1);g.rotation.z=-s*1.1;cone(g,.3,1.1,'#efe2c4',0,.5,0,5);const g2=grp(g,0,.95,0);g2.rotation.z=s*.9;cone(g2,.17,.8,'#e2d0aa',0,.35,0,5)});break}
  case'circlet':add(head,new THREE.TorusGeometry(1.04,.08,4,14),MM(GOLD),0,1.75).rotation.x=Math.PI/2;addGlow(sph(head,.15,glow(S.eye),0,1.75,1.1),S.eye,.7);break;
  case'feather':{const k=sph(head,1.1,top,0,2.1,-.1,1.15,.38,1.15,8);k.rotation.z=-.18;const f=cone(head,.32,2.6,trim,-.95,2.9,-.4,4);f.rotation.set(-.6,0,.65);f.scale.z=.25;break}
  case'tophat':cyl(head,1.5,1.5,.14,'#1d161c',0,2.15,0,8);cyl(head,.88,.82,1.7,'#241b22',0,3.0,0,8);cyl(head,.87,.86,.3,trim,0,2.4,0,8);break;
  case'bandana':{const hg=grp(head,0,1.25,0);hg.rotation.x=-.35;T(hg,[[.28,1.07,1.13,0,-.05],[.7,1.0,1.07,0,-.04],[1.2,.5,.6,0,-.1]],{n:8,dbl:1,cols:[top],cap0:false});[-.25,.25].forEach(x=>cone(head,.18,.9,top,x,1.35,-1.35,3).rotation.set(-2.3,0,x));break}
  case'hood':{const hg=grp(head,0,1.2,0);hg.rotation.x=-.45;T(hg,[[0,1.12,1.18,0,-.1],[.5,1.14,1.2,0,-.03],[1.0,.95,1.05,0,-.1],[1.35,.3,.4,0,-.4]],{n:8,dbl:1,cols:[top],cap0:false});
   T(model,[[5.35,.6,.6],[4.85,1.85*w,1.06*dw],[4.1,1.98*w,1.1*dw]],{n:7,dbl:1,cols:[top],cap0:false,cap1:false},0,hipY,0);break}
  case'wizard':cyl(head,2.1,2.1,.12,top,0,2.2,0,8);cyl(head,.95,1.0,.3,trim,0,2.35,0,8);cone(head,1.0,3.2,top,0,3.9,-.25,6).rotation.x=-.25;break;
  case'helm':{const hg=grp(head,0,1.2,0);hg.rotation.x=-.55;T(hg,[[-.3,1.08,1.14,0,-.04],[.4,1.1,1.16],[.9,.94,1.02,0,-.06],[1.28,.4,.48,0,-.08]],{n:8,metal:1,dbl:1,cols:[METAL],cap0:false});
   box(head,.16,.75,.14,MM(METAL),0,1.15,1.16);for(let k=0;k<3;k++)cone(head,.2,.6,trim,0,2.5-k*.15,-.2-k*.4,3).rotation.x=-.6-k*.3;break}
  case'crown':add(head,new THREE.CylinderGeometry(.82,.86,.38,7,1,true),{metal:GOLD,dbl:1},0,2.25,0);for(let i=0;i<5;i++){const a=i/5*Math.PI*2+Math.PI/2;cone(head,.12,.35,MM(GOLD),Math.cos(a)*.82,2.6,Math.sin(a)*.82,3)}addGlow(sph(head,.12,glow('#e5484d'),0,2.25,.88),'#e5484d',.8);break;
  case'cap':{const k=sph(head,1.05,top,0,2.15,-.05,1.1,.42,1.1,8);k.rotation.z=.2;cone(head,.1,1.6,trim,.8,2.7,-.3,3).rotation.z=-.6;break}
 }
 const back=-1.04*dw*(S.torso==='broad'?1.08:1);
 if(S.cape==='cape'||S.cape==='long'){const cc=metal?top:shade(top,-.18),long=S.cape==='long',len=long?hipY+4:tail?4:hipY+2.4,n=2,sh=len/n,cw=(long?4.2:3.5)*w;let p=refs.cape=grp(model,0,shY+.2,back);
  for(let i=0;i<n;i++){box(p,cw,sh,.1,cc,0,-sh/2);p=grp(p,0,-sh,0);refs.capeSegs.push(p)}box(refs.cape,cw+.05,.22,.12,trim,0,.11)}
 if(S.cape==='quiver'){const q=grp(model,.5*w,hipY+3,back-.55);q.rotation.z=-.5;cyl(q,.7,.55,4,LEATHER,0,0,0,7);cyl(q,.75,.75,.35,trim,0,1.9,0,7);[[-.3,0],[.25,.2],[0,-.3],[.35,-.2]].forEach(([x,z])=>{cyl(q,.08,.08,1.6,WOOD,x,2.6,z,4);cone(q,.24,.7,trim,x,3.5,z,3)})}
 if(S.cape==='backpack'){box(model,2.5*w,3,1.5,LEATHER,0,hipY+2.7,back-.65);box(model,2.6*w,.9,1.6,shade(LEATHER,-.2),0,hipY+4,back-.65);cyl(model,.65,.65,3*w,trim,0,hipY+4.9,back-.6,8).rotation.z=Math.PI/2;box(model,.5,.6,.2,MM(GOLD),0,hipY+3.4,back-1.45)}
 if(S.cape==='featherwings'||S.cape==='batwings')[-1,1].forEach(s=>{const wing=grp(model,s*.7*w,hipY+3.8,back-.2);wing.rotation.y=s*.45;
  if(S.cape==='featherwings'){[1,.9,.76,.6,.44].forEach((l,k)=>{const h=6.5*l,a=.3+.09*k,f=cone(wing,.75,h,k%2?'#e4e2ea':'#fbfaff',s*(1+k*.95+Math.sin(a)*h/2),2.3+k*.45-Math.cos(a)*h/2,-k*.08,4);f.rotation.z=Math.PI+s*a;f.scale.z=.16});cyl(wing,.2,.32,5.4,'#d9d4e0',s*2.4,2.9,0,5).rotation.z=-s*1.15}
  else{const skin=shade(horns?flesh:'#5a2a44',-.35);cyl(wing,.14,.28,5.8,shade(skin,-.3),s*2.5,2.3,0,5).rotation.z=-s*1.1;[[1.5,4.2],[3.1,4.6],[4.7,3.6]].forEach(([x,l],k)=>{const m=cone(wing,1.35,l,skin,s*x,1.8+k*.65-l/2,-.05,3);m.rotation.z=Math.PI+s*.12*k;m.scale.z=.1});cone(wing,.2,1,'#e8dcc4',s*5.2,4,0,4).rotation.z=-s*.5}});
 if(tail){const cf={drag:[5,.42,1.0,-.7,.22,.8],cat:[6,.16,.75,-.9,.38,.92],tief:[6,.09,.8,-1,.28,.95]}[tail],tc=tail==='tief'?shade(sk,-.1):sk;
  const tg=refs.tail=grp(model,0,hipY+.2,-.75*dw);tg.rotation.x=cf[3];let p=tg,r=cf[1];
  for(let i=0;i<cf[0];i++){T(p,[[0,r,r],[-cf[2]-.05,r*cf[5],r*cf[5]]],{n:5,axis:'z',cols:[tc]});p=grp(p,0,0,-cf[2]);p.rotation.x=cf[4];r*=cf[5]}
  if(tail==='tief')cone(p,.35,.6,shade(sk,-.3),0,0,-.25,3).rotation.x=-Math.PI/2}
 [[S.main,0],[S.off,1]].forEach(([it,i])=>{if(it==='none')return;const A=refs.arms[i],s=A.s;
  if(it==='lute'){const l=item('lute');l.scale.setScalar(.38);l.position.set(0,hipY+2.4,1.05*dw);l.rotation.z=.95;model.add(l);return}
  if(['shield','towershield','buckler'].includes(it)){const sh=item(it);sh.scale.setScalar(.42);sh.position.set(s*(.42*Math.max(wa/1.24,.8)+.25),-1.25*al,0);if(s<0)sh.rotation.y=Math.PI;A.el.add(sh);return}
  const g=item(it);g.scale.setScalar(['sword','greatsword','rapier','axe','mace','hammer','flail','club','staff','spear','trident','scythe','banner'].includes(it)?.45:.38);A.hand.add(g);
  if(['sword','greatsword','rapier','axe','mace','hammer','flail','club','dagger','rod','wand','crossbow'].includes(it)){g.rotation.x=Math.PI/2;refs.fwd[i]=true}
  else if(it==='orb')g.position.set(0,-.8,.9);else if(it==='book'){g.position.z=.55;g.rotation.x=.3}else g.position.z=.3});
 model.traverse(o=>{if(o.isMesh)o.castShadow=true});
 model.scale.setScalar(sc);refs.sc=sc;refs.blob=w*sc;
 refs.body=(hipY+5.8+2.45*hk)*sc;refs.H=(hipY+5.8+2.45*hk+(S.hat==='wizard'?3.4*hk:S.hat==='tophat'?1.6*hk:horns==='antlers'?1.5*hk:R.halo||S.hat==='feather'||S.hat==='horned'?.9:S.hat==='helm'?.4:0))*sc;
 return{model,refs}
}

// Poses a hero's limbs and neck t seconds into idle or an animation. Returns how high the body hops (y), how far a cape lifts (cw)
// slides forward (z), leans (tilt), sways and turns (spin).
export function applyPose(r,pose,t){const [A,B]=r.arms,[L0,L1]=r.legs;
 r.arms.forEach((a,i)=>{const f=r.fwd[i];a.sh.rotation.set(f?-.25:0,0,a.s*.1);a.el.rotation.set(f?-.7:-.12,0,0)});
 r.legs.forEach(l=>{l.hip.rotation.set(0,0,0);l.knee.rotation.x=0});r.neck.rotation.set(0,0,0);
 let y=0,z=0,cw=0,tilt=0,sway=0,spin=0;
 const once=d=>(t%d)/d,ease=d=>Math.min(1,once(d)*5,(1-once(d))*5),hipY=L0.hip.position.y; // ease: into a held pose and out again
 const free=r.fwd[0]&&!r.fwd[1]?B:A,toFace=a=>{if(r.fwd[r.arms.indexOf(a)])return;a.sh.rotation.set(-1.15,0,-a.s*.12);a.el.rotation.set(-1.75,0,0)}; // a hand holding a blade stays down
 if(pose==='walk'){const w=Math.sin(t*5);L0.hip.rotation.x=w*.5;L1.hip.rotation.x=-w*.5;L0.knee.rotation.x=Math.max(0,w)*.9;L1.knee.rotation.x=Math.max(0,-w)*.9;
  A.sh.rotation.x+=-w*.4;B.sh.rotation.x+=w*.4;A.el.rotation.x-=.2;B.el.rotation.x-=.2;y=Math.abs(Math.cos(t*5))*.18;cw=.35}
 else if(pose==='attack'){const p=(t*1.3)%1,a=p<.6?-2.4*Math.sin(p/.6*Math.PI/2):-2.4+2.9*Math.min(1,(p-.6)/.25);A.sh.rotation.x=-.25+a;A.el.rotation.x=-.5;L0.hip.rotation.x=.25;L1.hip.rotation.x=-.3;L0.knee.rotation.x=.3;cw=.1}
 else if(pose==='wave'){A.sh.rotation.set(0,0,-2.55);A.el.rotation.set(0,0,-.5+Math.sin(t*7)*.4)}
 else if(pose==='cheer'){const w=Math.sin(t*5);[A,B].forEach(a=>{a.sh.rotation.set(-2.9,0,a.s*.25);a.el.rotation.set(-.2,0,0)});y=Math.max(0,w)*.6;cw=.15}
 else if(pose==='dance'){const w=Math.sin(t*8);r.arms.forEach((a,i)=>{a.sh.rotation.set(0,0,a.s*(1.5+(i?-w:w)*.8));a.el.rotation.set(-.5,0,0)});
  r.legs.forEach((l,i)=>{const k=Math.max(0,i?-w:w);l.hip.rotation.x=-k*.45;l.knee.rotation.x=k*.9});r.neck.rotation.z=w*.15;y=Math.abs(w)*.35;sway=Math.sin(t*4)*.14;spin=Math.sin(t*2)*.6;cw=.2}
 else if(pose==='hurt'){const k=Math.sin(Math.PI*(t%.5)/.5);r.arms.forEach(a=>{a.sh.rotation.x-=.5*k;a.sh.rotation.z+=a.s*.6*k});r.legs.forEach(l=>{l.hip.rotation.x=-.2*k;l.knee.rotation.x=.4*k});r.neck.rotation.x=-.35*k;tilt=-.3*k;y=-.15*k}
 else if(pose==='bow'){const k=ease(1.6);tilt=.55*k;r.neck.rotation.x=.25*k;free.sh.rotation.set(-.7*k,0,-free.s*.45*k);free.el.rotation.x=-1.3*k}
 else if(pose==='point'){const k=ease(1.8);free.sh.rotation.set(-1.55*k,0,0);free.el.rotation.set(0,0,0);tilt=.08*k}
 else if(pose==='yes'){r.neck.rotation.x=Math.sin(t*13)*.35}
 else if(pose==='no'){r.neck.rotation.y=Math.sin(t*13)*.6}
 else if(pose==='laugh'){const w=Math.abs(Math.sin(t*14));r.arms.forEach(a=>{a.sh.rotation.z+=a.s*.25;a.el.rotation.x=-1});r.neck.rotation.x=-.4+w*.1;tilt=-.14;y=w*.18}
 else if(pose==='shrug'){const k=ease(1.6);r.arms.forEach(a=>{a.sh.rotation.set(-.2*k,0,a.s*(.1+.8*k));a.el.rotation.set(-1.2*k,0,a.s*.5*k)});r.neck.rotation.z=.25*k;y=.15*k}
 else if(pose==='facepalm'){toFace(free);r.neck.rotation.x=.35;tilt=.06}
 else if(pose==='jump'){const h=Math.sin(Math.PI*once(.9));r.arms.forEach(a=>a.sh.rotation.set(0,0,a.s*(.1+2.4*h)));r.legs.forEach(l=>{l.hip.rotation.x=-.4*h;l.knee.rotation.x=.8*h});y=h*3.5;cw=.3*h}
 else if(pose==='flex'){const k=ease(2.2),p=Math.sin(t*9)*.12;r.arms.forEach(a=>{a.sh.rotation.set(0,0,a.s*(.1+1.45*k));a.el.rotation.set(0,0,a.s*(1.6+p)*k)});r.neck.rotation.x=-.15*k;tilt=-.1*k}
 else if(pose==='sit'){r.legs.forEach(l=>{l.hip.rotation.set(-1.5,0,l.s*.18);l.knee.rotation.x=.1});y=.9-hipY;z=-hipY*.35}
 else if(pose==='sleep'){tilt=-Math.PI/2;y=1.1;z=hipY*.9;r.arms.forEach(a=>a.sh.rotation.set(0,0,a.s*.25));r.neck.rotation.z=.3}
 else if(pose==='cry'){r.arms.forEach(toFace);r.neck.rotation.x=.4+Math.sin(t*14)*.04;tilt=.08;sway=Math.sin(t*14)*.025}
 else if(pose==='fart'){const k=Math.sin(Math.PI*Math.min(1,(t%1.4)/1.1));r.arms.forEach(a=>{a.sh.rotation.z+=a.s*.45*k});r.legs.forEach(l=>{l.hip.rotation.x=-.55*k;l.knee.rotation.x=1*k});r.neck.rotation.x=-.2*k;tilt=.25*k;y=-1*k}
 else{const w=Math.sin(t*1.6);A.sh.rotation.z+=-w*.02;B.sh.rotation.z+=w*.02}
 return{y,z,cw,tilt,sway,spin}}

// ---- minis for the table: a human about 1.15 squares tall ----
const SIZE = 1.15 / (68 * UPI), heroes = new Map();
// One geometry for lit faces and one for glowing ones; `at` places each mesh.
function bake(meshes, at) {
  const lit = [], glowing = [];
  for (const o of meshes) {
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(), glows = o.material.isMeshBasicMaterial;
    g.deleteAttribute("uv");
    if (glows) { const c = o.material.color; g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3)); }
    (glows ? glowing : lit).push(g.applyMatrix4(at(o)));
  }
  return [lit, glowing].map((list) => { if (!list.length) return null; const g = mergeGeometries(list); list.forEach((x) => x.dispose()); g.userData.shared = true; return g; });
}
// what a monster is built from
const kit = () => { jr = rng(11); return { grp, sph, cyl, cone, box, add, T, glow, shade, random: rng, MM, GOLD }; };
// A figure built once: merged whole for standing still, and merged per joint for moving.
function template(hero) {
  const key = JSON.stringify(hero);
  if (heroes.has(key)) return heroes.get(key);
  const beast = hero.creature ? buildCreature(hero, kit()) : null, { model, refs: r } = beast ? { model: beast.model, refs: {} } : buildHero(hero);
  if (beast) model.scale.setScalar(beast.sc); else applyPose(r, "idle", 0);
  model.updateMatrixWorld(true);
  const joints = beast ? [model, ...beast.limbs.map((l) => l.node)] : [model, ...r.legs.flatMap((l) => [l.hip, l.knee]), ...r.arms.flatMap((a) => [a.sh, a.el]), r.neck], owned = joints.map(() => []), all = [];
  model.traverse((o) => { if (!o.isMesh) return; let p = o; while (!joints.includes(p)) p = p.parent; owned[joints.indexOf(p)].push(o); all.push(o); });
  const fit = new THREE.Matrix4().makeScale(SIZE, SIZE, SIZE);
  const out = {
    creature: beast && { limbs: beast.limbs.map(({ kind, side, phase, node }) => ({ kind, side, phase, rest: node.rotation.clone() })), floating: beast.floating, aura: beast.aura },
    height: (beast ? beast.height : r.H) * SIZE, sc: beast ? beast.sc : r.sc, fwd: r.fwd, sides: beast ? [] : r.arms.map((a) => a.s),
    still: bake(all, (o) => fit.clone().multiply(o.matrixWorld)),
    nodes: joints.map((j, i) => { const back = j.matrixWorld.clone().invert(); return { parent: joints.indexOf(j.parent), position: j.position.clone(), rotation: j.rotation.clone(), parts: bake(owned[i], (o) => back.clone().multiply(o.matrixWorld)) }; }),
  };
  all.forEach((o) => o.geometry.dispose());
  heroes.set(key, out);
  return out;
}
// looks: the [lit, glowing] materials. pose(null) shows the cheap still figure; pose(name, seconds) the jointed one.
export function makeMini(hero, looks) {
  const m = template(hero), group = new THREE.Group();
  const dress = (into, parts) => { parts.forEach((g, k) => { if (g) into.add(new THREE.Mesh(g, looks[k])); }); return into; };
  const still = dress(new THREE.Group(), m.still), nodes = m.nodes.map((n) => dress(new THREE.Group(), n.parts)), rig = nodes[0];
  m.nodes.forEach((n, i) => { if (!i) return; nodes[i].position.copy(n.position); nodes[i].rotation.copy(n.rotation); nodes[n.parent].add(nodes[i]); });
  const bob = new THREE.Group();   // what floats
  rig.scale.setScalar(m.sc * SIZE); rig.visible = false; bob.add(still, rig); group.add(bob);
  const [, h0, k0, h1, k1, s0, e0, s1, e1, neck] = nodes, limbs = { neck, fwd: m.fwd, legs: [{ hip: h0, knee: k0, s: -1 }, { hip: h1, knee: k1, s: 1 }], arms: [{ sh: s0, el: e0, s: m.sides[0] }, { sh: s1, el: e1, s: m.sides[1] }] };
  const pose = (name, t) => {
    still.visible = !name; rig.visible = !!name; if (!name) return;
    const body = m.creature ? moveCreature(m.creature.limbs.map((l, i) => ({ ...l, node: nodes[i + 1] })), name, t) : applyPose(limbs, name, t); rig.position.set(0, body.y * m.sc * SIZE, body.z * m.sc * SIZE); rig.rotation.set(body.tilt, body.spin, body.sway);
  };
  if (m.creature?.aura) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloT, color: m.creature.aura, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.4 * (looks[0].opacity ?? 1), depthWrite: false }));
    halo.position.y = m.height * 0.55; halo.scale.setScalar(m.height * 1.7); halo.raycast = () => {}; bob.add(halo);
  }
  return { group, height: m.height, pose, hover: m.creature?.floating ? (t) => { bob.position.y = Math.sin(t * 2.2) * 0.05; } : null };
}
