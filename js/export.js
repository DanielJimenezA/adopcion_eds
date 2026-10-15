
'use strict';
(function(){
const $=id=>document.getElementById(id);
const asPng=id=>{const chart=echarts.getInstanceByDom($(id));return chart?.getDataURL({type:'png',pixelRatio:2,backgroundColor:'#fff'})||null;};
const load=async path=>{const r=await fetch(path);if(!r.ok)throw Error('No se encuentra '+path);const b=await r.blob();return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;f.readAsDataURL(b);});};
const context=()=>{const s=window.dashboardState();return {s,area:$('area').value,group:$('group').selectedOptions[0].text,entity:$('entity').selectedOptions[0].text,clues:$('clues').selectedOptions[0].text,week:s.cut,reading:$('executiveReading').textContent};};
async function ppt(){if(!window.PptxGenJS)throw Error('PptxGenJS no disponible');const c=context(),p=new PptxGenJS();p.layout='LAYOUT_WIDE';p.author='IMSS-BIENESTAR';const [bg1,bg2]=await Promise.all([load('assets/plantilla_1.jpg'),load('assets/plantilla_2.jpg')]);
const background=(sl,img)=>sl.addImage({data:img,x:0,y:0,w:13.333,h:7.5});
const txt=(sl,t,x,y,w,h,sz=14)=>sl.addText(t,{x,y,w,h,fontFace:'Aptos',fontSize:sz,color:'235B4E',margin:0,breakLine:false});
let sl=p.addSlide();background(sl,bg1);txt(sl,'Tablero de Adopción de EDS',3.5,3.7,8.7,.65,26);txt(sl,`${c.area} · Semana ISO ${c.week} de 2026`,3.5,4.5,8.7,.4,16);txt(sl,`${c.group} · ${c.entity}`,3.5,5.1,8.7,.35,12);
const page=(title,img)=>{sl=p.addSlide();background(sl,bg2);sl.addShape(p.ShapeType.rect,{x:.55,y:1.25,w:12.2,h:5.4,fill:{color:'FFFFFF'},line:{color:'FFFFFF'}});txt(sl,title,.75,.48,11.9,.48,21);if(img)sl.addImage({data:img,x:.85,y:1.48,w:11.6,h:4.9});txt(sl,`Grupo: ${c.group} · ${c.entity} · Semana ${c.week}`,1,6.65,11.2,.28,10);};
page(`${c.area} · Evolución comparativa`,asPng('chart'));sl=p.addSlide();background(sl,bg2);txt(sl,'Comparación territorial · mapa y volúmenes',.75,.48,11.9,.48,21);sl.addShape(p.ShapeType.rect,{x:.55,y:1.25,w:12.2,h:5.4,fill:{color:'FFFFFF'},line:{color:'FFFFFF'}});const mp=asPng('mexicoMap'),bp=asPng('entityBars');if(mp)sl.addImage({data:mp,x:.75,y:1.65,w:4.7,h:4.45});if(bp)sl.addImage({data:bp,x:5.55,y:1.65,w:6.85,h:4.45});txt(sl,`Grupo: ${c.group} · ${c.entity} · Semana ${c.week}`,1,6.65,11.2,.28,10);
sl=p.addSlide();background(sl,bg2);sl.addShape(p.ShapeType.rect,{x:.65,y:1.45,w:12,h:4.8,fill:{color:'FFFFFF'},line:{color:'FFFFFF'}});txt(sl,'Lectura ejecutiva',.8,.5,11,.5,22);txt(sl,c.reading,.95,1.85,11.2,3.5,16);
await p.writeFile({fileName:`Adopcion_EDS_v4_1_S${c.week}.pptx`});}
async function pdf(){if(!window.jspdf?.jsPDF)throw Error('jsPDF no disponible');const c=context(),d=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),[bg1,bg2]=await Promise.all([load('assets/plantilla_1.jpg'),load('assets/plantilla_2.jpg')]);
d.addImage(bg1,'JPEG',0,0,297,210);d.setTextColor(35,91,78);d.setFontSize(24);d.text('Tablero de Adopción de EDS',76,113);d.setFontSize(14);d.text(`${c.area} - Semana ISO ${c.week}`,76,127);
for(const [title,id] of [['Evolución comparativa','chart'],['Mapa territorial','mexicoMap'],['Volúmenes comparativos','entityBars']]){d.addPage();d.addImage(bg2,'JPEG',0,0,297,210);d.setFillColor(255,255,255);d.rect(12,35,273,150,'F');d.setTextColor(35,91,78);d.setFontSize(18);d.text(title,18,20);const png=asPng(id);if(png)d.addImage(png,'PNG',20,40,255,132);d.setFontSize(9);d.text(`${c.group} | ${c.entity} | Semana ${c.week}`,20,192);}
d.addPage();d.addImage(bg2,'JPEG',0,0,297,210);d.setFillColor(255,255,255);d.rect(12,35,273,150,'F');d.setTextColor(35,91,78);d.setFontSize(18);d.text('Lectura ejecutiva',18,20);d.setFontSize(12);d.text(d.splitTextToSize(c.reading,252),20,52);d.save(`Adopcion_EDS_v4_1_S${c.week}.pdf`);}
window.setupReports=()=>{for(const [id,fn] of [['pptx',ppt],['pdf',pdf]])$(id).addEventListener('click',async()=>{const b=$(id);b.disabled=true;try{await fn();}catch(e){console.error(e);alert('No se pudo exportar: '+e.message);}finally{b.disabled=false;}});};
})();
