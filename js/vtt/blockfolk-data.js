// Blockfolk heroes (blockfolk.html): the choices, and the check every saved or pasted hero code goes through.
export const HUM=['#f1c7a5','#d9a27c','#b97a52','#8a5636','#5c3a24'];
export const RACES={
 Human:{skins:HUM,hair:'short'},
 Elf:{skins:['#f6dcc4','#e8bf9a','#c9a07a','#a7b8c9','#8c6b8f'],h:1.08,w:.88,head:.95,ears:'elf',hair:'long'},
 Dwarf:{skins:['#f0c2a0','#d6a07a','#b07a52','#8a5a3a','#6b4a3a'],h:.7,w:1.22,head:1.05,hair:'short',beard:'long'},
 Halfling:{skins:HUM,h:.6,w:.95,head:1.05,ears:'small',hair:'short'},
 Gnome:{skins:HUM,h:.55,w:.9,head:1.15,ears:'small',nose:1,hair:'mohawk',beard:'short'},
 'Half-Orc':{skins:['#8fae6b','#7a9a5a','#6b8a6b','#9aa07a','#5f7a4f'],h:1.1,w:1.25,tusks:1,hair:'mohawk'},
 Tiefling:{skins:['#c94a4a','#a53a5a','#7a3a8a','#d98a7a','#5a6ab0'],horns:'tief',tail:'tief',glow:1,hair:'long'},
 Dragonborn:{skins:['#b83a2a','#2e7d4f','#2f5fb0','#d9a83a','#c9ced6'],h:1.12,w:1.15,snout:1,horns:'drag',tail:'drag',scales:1,hair:'bald'},
 Tabaxi:{skins:['#d9a05a','#e8d6b8','#6b5a4a','#3a3434','#c97a3a'],h:1.02,w:.9,ears:'cat',tail:'cat',cat:1,hair:'bald'},
 Goliath:{skins:['#a7a8a2','#8f948f','#b6a99a','#7a7f86','#c9c2b6'],h:1.25,w:1.3,head:.95,marks:1,hair:'bald'},
 Aasimar:{skins:['#f6e2cf','#e0bfa0','#c9926a','#9a6a4a','#d9d6e8'],halo:1,glow:1,hair:'long'},
 Goblin:{skins:['#7aa64a','#9ab84a','#c2a04a','#6b8a3a','#a0b07a'],h:.55,w:.9,head:1.2,ears:'goblin',hair:'bald'}
};
export const CLASSES={
 Fighter:{top:'#8a2f2f',bot:'#4a3a2a',trim:'#c4cad3',style:'plate',main:'sword',off:'shield',hat:'none',cape:'cape'},
 Wizard:{top:'#2d4fa1',bot:'#2a2a44',trim:'#e0b84a',style:'robe',main:'staff',off:'book',hat:'wizard',cape:'none'},
 Rogue:{top:'#2b2b33',bot:'#1f1f25',trim:'#7a5230',style:'leather',main:'dagger',off:'dagger',hat:'hood',cape:'none'},
 Ranger:{top:'#3f6b3a',bot:'#5a4630',trim:'#7a5230',style:'leather',main:'none',off:'bow',hat:'hood',cape:'cape'},
 Cleric:{top:'#e9e4d6',bot:'#8f8a7a',trim:'#e0b84a',style:'robe',main:'mace',off:'shield',hat:'none',cape:'none'},
 Paladin:{top:'#3a5aa6',bot:'#5a5a66',trim:'#e0b84a',style:'plate',main:'sword',off:'shield',hat:'helm',cape:'cape'},
 Barbarian:{top:'#7a5a3a',bot:'#6b4a2a',trim:'#a88a5c',style:'bare',main:'axe',off:'none',hat:'none',cape:'none'},
 Bard:{top:'#b23a7a',bot:'#3a2a5a',trim:'#f2c94c',style:'cloth',main:'none',off:'lute',hat:'cap',cape:'none'},
 Druid:{top:'#6b5a3a',bot:'#3f5a34',trim:'#9bc46a',style:'robe',main:'staff',off:'none',hat:'none',cape:'cape'},
 Monk:{top:'#d9822b',bot:'#8a4a1f',trim:'#5a2a12',style:'cloth',main:'none',off:'none',hat:'none',cape:'none'},
 Sorcerer:{top:'#6a2fa1',bot:'#2a1a3a',trim:'#e57ad6',style:'robe',main:'none',off:'orb',hat:'none',cape:'none'},
 Warlock:{top:'#2a1a33',bot:'#1a1020',trim:'#7cf2c0',style:'cloth',main:'rod',off:'book',hat:'hood',cape:'cape'}
};
export const HAIRS=['bald','short','long','mohawk','bun','braids'],BEARDS=['none','stubble','short','long'];
export const HATS=['none','hood','wizard','helm','horned','crown','circlet','cap','feather','tophat','bandana'],STYLES=['cloth','leather','studded','hide','chain','scale','plate','robe','coat','bare'],CAPES=['none','cape','long','quiver','backpack','featherwings','batwings'];
export const ITEMS=['none','sword','greatsword','rapier','dagger','axe','mace','hammer','flail','club','spear','trident','scythe','staff','rod','wand','bow','crossbow','shield','towershield','buckler','book','orb','lute','torch','lantern','potion','tankard','skull','banner'];
// body parts and extras: the first choice is the default ('race' and 'auto' follow the race or outfit)
export const PARTS={head:['normal','round','square','long','skull','beast','bird'],torso:['normal','slim','broad','belly'],arms:['normal','muscular','bone','claws','metal'],legs:['normal','bone','metal','hooves','peg'],
 ears:['race','none','round','elf','goblin','cat'],horns:['race','none','tief','drag','antlers'],tail:['race','none','drag','cat','tief'],face:['none','glasses','eyepatch','mask'],neck:['none','scarf','amulet'],shoulders:['auto','none','pauldrons','spikes','fur']};
export const SLIDERS={height:[.7,1.4],build:[.75,1.4],headSize:[.7,1.45],armLen:[.75,1.35],legLen:[.7,1.35],thick:[.6,1.6]}; // all 1 to start
export const HAIRC=['#2a1d14','#5a3a22','#8a5a2a','#c98a3a','#e8d08a','#c94a2a','#e8e6e0','#4a5aa6','#7a3a8a','#1c1c1c'];
export const EYES=['#3a6ab0','#4a8a3a','#6b4a2a','#c9a03a','#d94a4a','#a64ac9','#e8e8e8','#1c1c1c'];
export const SY1=['Bal','Thor','Ely','Mor','Kae','Vex','Lun','Dra','Bri','Gim','Zan','Ori','Fen','Syl','Ruk','Ash','Tam','Quill'];
export const SY2=['dric','wyn','ra','gar','iel','ix','ora','ek','mir','ana','os','ith','bek','elle'];
export const SCALE={Human:[1,1],Elf:[.95,1.06],Dwarf:[.85,.78],Halfling:[.545,.9],Gnome:[.61,.85],'Half-Orc':[1.06,1],Tiefling:[1,1],Dragonborn:[1.1,1],Tabaxi:[1.05,1.04],Goliath:[1.3,1],Aasimar:[1.02,1],Goblin:[.63,.85]};
export const UPI=17.85/68; // model units per inch (base human = 5'8")

const HEX=/^#[0-9a-f]{6}$/i;
// A hero code with every value checked; anything missing or unknown takes the class or race default. Throws without a race and class.
export function cleanHero(c){
 if(c&&c.creature==='octopus')return{creature:'octopus',name:'Glowing octopus'};
 if(!c||!Object.hasOwn(RACES,c.race)||!Object.hasOwn(CLASSES,c.cls))throw new Error('That code is missing a valid race or class.');
 const R=RACES[c.race],K=CLASSES[c.cls],n={race:c.race,cls:c.cls,name:String(c.name||'').slice(0,40)};
 for(const [k,list,d] of [['hair',HAIRS,R.hair],['beard',BEARDS,R.beard||'none'],['hat',HATS,K.hat],['main',ITEMS,K.main],['off',ITEMS,K.off],['style',STYLES,K.style],['cape',CAPES,K.cape]])n[k]=list.includes(c[k])?c[k]:d;
 for(const [k,d] of [['skin',R.skins[0]],['hairC',HAIRC[0]],['eye',EYES[0]],['top',K.top],['bot',K.bot],['trim',K.trim]])n[k]=HEX.test(c[k])?c[k]:d;
 for(const [k,list] of Object.entries(PARTS))n[k]=list.includes(c[k])?c[k]:list[0];
 for(const [k,[lo,hi]] of Object.entries(SLIDERS)){const v=Number(c[k]??1);n[k]=Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):1}
 return n}
