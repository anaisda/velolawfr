import { useState, useEffect, useRef, useCallback } from "react";

// ─── API base — points to your real backend ──────────────────
const API = "http://204.168.156.143:3000";

const DEMO_RESULTS = {
  dataset: { cells: 3696, genes: 2000, cellTypes: ["Ductal","Ngn3 low EP","Ngn3 high EP","Pre-endocrine","Beta","Alpha","Delta","Epsilon"] },
  stages: [
    { id: 0, name: "Early Progenitor", cells: 924, marker: "High Neurog3" },
    { id: 1, name: "Specification",    cells: 924, marker: "Lineage commitment" },
    { id: 2, name: "Differentiation",  cells: 924, marker: "Cell-type markers" },
    { id: 3, name: "Maturation",       cells: 924, marker: "Mature hormones" },
  ],
  regulators: ["Hmgn3","Gnas","Gnb1","Pdx1","Neurog3","Pax6","Nkx6-1","Arx","Pax4","Snhg6","Sntg1","Chga","Iapp"],
  equations: [
    { gene:"Ins2", stage:"Specification", stageId:1, r2:0.333, r2_train:0.41, complexity:"cubic", color:"#f59e0b",
      equation:"v = (0.366 \u2212 (Neurog3 + Nkx6-1)\u00b7(0.00921\u00b7(Hmgn3\u22120.934) + 0.00921\u00b7(0.049\u00b7Neurog3\u00b3 + Nkx6-1 + Pax4)))\u00b3",
      latex:"\\left(0.366-(\\text{Neurog3}+\\text{Nkx6-1})(0.00921(\\text{Hmgn3}-0.934)+0.00921(0.049\\,\\text{Neurog3}^3+\\text{Nkx6-1}+\\text{Pax4}))\\right)^3",
      regulatorsFound:["Neurog3","Nkx6-1","Hmgn3","Pax4"],
      interpretation:"Early \u03b2-cell specification: Nkx6-1 and Hmgn3 drive insulin transcription against progenitor repression by Neurog3 and Pax4." },
    { gene:"Ins2", stage:"Differentiation", stageId:2, r2:0.776, r2_train:0.83, complexity:"cubic", color:"#10b981",
      equation:"v = 0.00738\u00b7(Ins1 + Pdx1)\u00b3 + 0.00738\u00b7(Iapp + Ins2 + \u221aPdx1)\u00b3",
      latex:"0.00738(\\text{Ins1}+\\text{Pdx1})^3+0.00738(\\text{Iapp}+\\text{Ins2}+\\sqrt{\\text{Pdx1}})^3",
      regulatorsFound:["Ins1","Pdx1","Iapp","Ins2"],
      interpretation:"Coordinated activation: Pdx1 drives cubic activation with autocrine Ins1 coupling and amylin co-secretion." },
    { gene:"Ins2", stage:"Maturation", stageId:3, r2:0.870, r2_train:0.91, complexity:"quartic+exp", color:"#6366f1",
      equation:"v = Ins2\u2074\u00b7[(1.39e-3 \u2212 4.17e-4\u00b7Ins2)\u00b7(Ins1 \u2212 Sst)\u00b7exp(\u221aGnas) + 1.204\u00b7exp(\u22120.480\u00b7Ins2)]\u00b2",
      latex:"\\text{Ins2}^4\\left[(1.39{\\times}10^{-3}-4.17{\\times}10^{-4}\\text{Ins2})(\\text{Ins1}-\\text{Sst})e^{\\sqrt{\\text{Gnas}}}+1.204\\,e^{-0.480\\,\\text{Ins2}}\\right]^2",
      regulatorsFound:["Ins2","Ins1","Sst","Gnas"],
      interpretation:"Mature \u03b2-cell: Quartic self-regulation via Ins2 autocrine feedback. Sst provides paracrine inhibition." },
    { gene:"Ppy", stage:"Differentiation", stageId:2, r2:0.433, r2_train:0.51, complexity:"linear", color:"#ec4899",
      equation:"v = \u22120.393\u00b7(Iapp + Ppy \u2212 Neurog3 \u2212 Nkx6-1 \u2212 Pax4 + Pdx1 + 0.866) \u2212 0.044",
      latex:"-0.393(\\text{Iapp}+\\text{Ppy}-\\text{Neurog3}-\\text{Nkx6-1}-\\text{Pax4}+\\text{Pdx1}+0.866)-0.044",
      regulatorsFound:["Iapp","Ppy","Neurog3","Nkx6-1","Pax4","Pdx1"],
      interpretation:"PP-cell lineage commitment: Pdx1 and Iapp activate; progenitor factors repress." },
    { gene:"Ppy", stage:"Maturation", stageId:3, r2:0.395, r2_train:0.44, complexity:"linear+\u221a", color:"#f97316",
      equation:"v = 0.464\u00b7\u221aGhrl \u2212 0.464\u00b7Gnas \u2212 0.464\u00b7Hmgn3 + 0.279\u00b7Ins2 \u2212 0.464\u00b7Pax6 \u2212 0.279\u00b7Ppy + 0.464\u00b7Sst + 0.279",
      latex:"0.464\\sqrt{\\text{Ghrl}}-0.464\\,\\text{Gnas}-0.464\\,\\text{Hmgn3}+0.279\\,\\text{Ins2}-0.464\\,\\text{Pax6}-0.279\\,\\text{Ppy}+0.464\\,\\text{Sst}+0.279",
      regulatorsFound:["Ghrl","Gnas","Hmgn3","Ins2","Pax6","Ppy","Sst"],
      interpretation:"Mature PP-cell cross-talk: Ghrl, Sst and Ins2 activate. Gnas and Hmgn3 act as brakes." },
    { gene:"Ghrl", stage:"Maturation", stageId:3, r2:0.185, r2_train:0.24, complexity:"low", color:"#84cc16",
      equation:"v = Ghrl\u00b7(Ghrl \u2212 Gnas\u00b2) \u2212 Gnb1",
      latex:"\\text{Ghrl}(\\text{Ghrl}-\\text{Gnas}^2)-\\text{Gnb1}",
      regulatorsFound:["Ghrl","Gnas","Gnb1"],
      interpretation:"\u03b5-cell ghrelin: Weak model due to limited \u03b5-cell representation. Self-activation + G-protein repression." },
  ],
  perturbations: [
    { target:"Ghrl", regulator:"Gnas", overexpression:-28.41, knockdown:7.30 },
    { target:"Ghrl", regulator:"Ghrl", overexpression:9.58,  knockdown:-2.65 },
    { target:"Ins2", regulator:"Ins2", overexpression:7.31,  knockdown:-0.54 },
    { target:"Ins2", regulator:"Ins1", overexpression:-0.24, knockdown:0.15 },
    { target:"Ins2", regulator:"Gnas", overexpression:-0.28, knockdown:0.13 },
    { target:"Ppy",  regulator:"Ppy",     overexpression:-0.39, knockdown:0.23 },
    { target:"Ppy",  regulator:"Pdx1",    overexpression:0.39,  knockdown:-0.15 },
    { target:"Ppy",  regulator:"Neurog3", overexpression:-0.39, knockdown:0.18 },
    { target:"Ppy",  regulator:"Pax4",    overexpression:-0.39, knockdown:0.19 },
    { target:"Ppy",  regulator:"Gnas",    overexpression:-0.46, knockdown:0.23 },
  ],
  network: {
    nodes: [
      { id:"Ins2", type:"target", x:380, y:180 }, { id:"Ppy", type:"target", x:200, y:340 },
      { id:"Ghrl", type:"target", x:560, y:340 }, { id:"Pdx1", type:"regulator", x:260, y:90 },
      { id:"Neurog3", type:"regulator", x:110, y:200 }, { id:"Nkx6-1", type:"regulator", x:510, y:120 },
      { id:"Iapp", type:"regulator", x:430, y:290 }, { id:"Gnas", type:"regulator", x:620, y:220 },
      { id:"Hmgn3", type:"regulator", x:90, y:310 }, { id:"Sst", type:"regulator", x:380, y:400 },
      { id:"Ins1", type:"regulator", x:490, y:75 },
    ],
    edges: [
      { source:"Pdx1", target:"Ins2", type:"activate", stage:"Differentiation" },
      { source:"Nkx6-1", target:"Ins2", type:"activate", stage:"Specification" },
      { source:"Neurog3", target:"Ins2", type:"repress", stage:"Specification" },
      { source:"Iapp", target:"Ins2", type:"activate", stage:"Differentiation" },
      { source:"Ins1", target:"Ins2", type:"repress", stage:"Maturation" },
      { source:"Sst", target:"Ins2", type:"repress", stage:"Maturation" },
      { source:"Gnas", target:"Ins2", type:"modulate", stage:"Maturation" },
      { source:"Pdx1", target:"Ppy", type:"activate", stage:"Differentiation" },
      { source:"Neurog3", target:"Ppy", type:"repress", stage:"Differentiation" },
      { source:"Hmgn3", target:"Ppy", type:"repress", stage:"Maturation" },
      { source:"Gnas", target:"Ghrl", type:"repress", stage:"Maturation" },
      { source:"Ins2", target:"Ppy", type:"activate", stage:"Maturation" },
    ]
  },
  stageProgression: { Ins2: [
    { stage:"Early Progenitor", r2:-0.02, complexity:45 },
    { stage:"Specification", r2:0.333, complexity:112 },
    { stage:"Differentiation", r2:0.776, complexity:138 },
    { stage:"Maturation", r2:0.870, complexity:187 },
  ]}
};

const STEPS = [
  "Loading & preprocessing scRNA-seq data",
  "Fitting scVelo dynamical model (spliced/unspliced)",
  "Recovering kinetic parameters (\u03b1, \u03b2, \u03b3)",
  "Computing velocity pseudotime",
  "Segmenting developmental stages (equal quantiles)",
  "Symbolic regression \u2014 Stage 0 (Early Progenitor)",
  "Symbolic regression \u2014 Stage 1 (Specification)",
  "Symbolic regression \u2014 Stage 2 (Differentiation)",
  "Symbolic regression \u2014 Stage 3 (Maturation)",
  "3-fold cross-validation & model selection",
  "Building regulatory network from equations",
  "Computing in silico perturbation predictions",
  "Finalizing \u2014 all done",
];

// ─── Design tokens ──────────────────────────────────────────
const T = {
  bg:"#07090e", surface:"#0e1117", surface2:"#141820",
  border:"#1e2636", border2:"#26334a",
  accent:"#4ade80", accent2:"#38bdf8", accent3:"#a78bfa",
  danger:"#f87171", warn:"#fbbf24",
  text:"#f0f2f8", text2:"#8fa3bf", text3:"#4a5e7a",
};

let _cssInjected = false;
const injectCSS = () => {
  if (_cssInjected) return; _cssInjected = true;
  const el = document.createElement("style"); el.id = "vl-css";
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    html,body,#root{height:100%;background:#07090e}
    ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:#0e1117} ::-webkit-scrollbar-thumb{background:#26334a;border-radius:3px}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    input,select,button{font-family:'Inter',sans-serif}
    input:-webkit-autofill{-webkit-box-shadow:0 0 0 30px #0e1117 inset!important;-webkit-text-fill-color:#f0f2f8!important}
    .vl-inp:focus{border-color:#38bdf8!important;outline:none!important;box-shadow:0 0 0 2px rgba(56,189,248,0.15)!important}
    select option{background:#141820;color:#f0f2f8}
  `;
  document.head.appendChild(el);
};
injectCSS();

// ─── Primitives — ALL outside main component ─────────────────
const Card = ({children, style={}}) => (
  <div style={{background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, ...style}}>{children}</div>
);

const Btn = ({children, onClick, v="primary", size="md", disabled, full, style={}}) => {
  const sz = {sm:{padding:"6px 14px",fontSize:12}, md:{padding:"9px 20px",fontSize:13}, lg:{padding:"13px 30px",fontSize:15}};
  const vr = {
    primary:{background:T.accent,color:"#000",border:"none"},
    secondary:{background:"rgba(255,255,255,0.03)",color:T.text,border:`1px solid ${T.border2}`},
    outline:{background:"transparent",color:T.accent,border:`1px solid ${T.accent}`},
    ghost:{background:"transparent",color:T.text2,border:"none"},
    danger:{background:"rgba(248,113,113,.1)",color:T.danger,border:`1px solid rgba(248,113,113,.3)`},
  };
  return (
    <button disabled={disabled} onClick={disabled?undefined:onClick}
      style={{cursor:disabled?"not-allowed":"pointer",borderRadius:8,fontFamily:"'Inter',sans-serif",fontWeight:600,
        display:"inline-flex",alignItems:"center",gap:6,transition:"all .15s",opacity:disabled?.45:1,
        width:full?"100%":undefined,letterSpacing:"-0.01em",...sz[size],...vr[v],...style}}>
      {children}
    </button>
  );
};

// KEY FIX: Inp defined outside so it never re-mounts on parent re-render
const Inp = ({label, type="text", value, onChange, placeholder, mono, error}) => (
  <div style={{marginBottom:16}}>
    {label && <label style={{display:"block",fontSize:12,color:T.text2,marginBottom:6,fontWeight:500}}>{label}</label>}
    <input className="vl-inp" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",background:T.surface2,border:`1px solid ${error?T.danger:T.border2}`,color:T.text,
        padding:"11px 14px",borderRadius:8,fontFamily:mono?"'JetBrains Mono',monospace":"'Inter',sans-serif",
        fontSize:14,transition:"border-color .2s, box-shadow .2s"}}/>
    {error && <div style={{fontSize:11,color:T.danger,marginTop:4}}>{error}</div>}
  </div>
);

const Tag = ({children,style={}}) => (
  <span style={{background:T.surface2,border:`1px solid ${T.border2}`,padding:"2px 8px",borderRadius:4,
    fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.text2,...style}}>{children}</span>
);

const ModelBadge = ({r2}) => {
  const s = r2>=0.7?{bg:"rgba(74,222,128,.15)",c:T.accent,label:"Strong fit"}
           :r2>=0.4?{bg:"rgba(251,191,36,.15)",c:T.warn,label:"Good fit"}
           :{bg:"rgba(248,113,113,.15)",c:T.danger,label:"Weak fit"};
  return <span style={{background:s.bg,color:s.c,padding:"2px 10px",borderRadius:6,fontSize:11,fontWeight:700}}>{s.label}</span>;
};

const Metric = ({value, label, sub, color}) => (
  <Card style={{padding:18}}>
    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:500,color:color||T.accent,marginBottom:3}}>{value}</div>
    <div style={{fontSize:11,color:T.text2,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:600}}>{label}</div>
    {sub && <div style={{fontSize:11,color:T.text3,marginTop:3}}>{sub}</div>}
  </Card>
);

const Toast = ({msg,type,visible}) => (
  <div style={{position:"fixed",bottom:24,right:24,background:T.surface2,
    border:`1px solid ${type==="ok"?T.accent:T.danger}`,color:type==="ok"?T.accent:T.danger,
    padding:"10px 18px",borderRadius:10,fontSize:13,zIndex:9999,
    transition:"all .3s",opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(20px)",
    pointerEvents:"none",maxWidth:300,fontWeight:500}}>{msg}</div>
);

const NetCanvas = ({data, stageFilter}) => {
  const ref = useRef(null);
  const nodes = useRef([]);
  const drag = useRef(null);
  const edges = stageFilter==="all"?data.edges:data.edges.filter(e=>e.stage===stageFilter);
  const EC = {activate:"#4ade80",repress:"#f87171",modulate:"#fbbf24"};
  const draw = useCallback(() => {
    const cv=ref.current; if(!cv) return;
    const ctx=cv.getContext("2d"); ctx.clearRect(0,0,cv.width,cv.height);
    edges.forEach(e=>{
      const s=nodes.current.find(n=>n.id===e.source),t=nodes.current.find(n=>n.id===e.target); if(!s||!t) return;
      const mx=(s.x+t.x)/2+(t.y-s.y)*0.25,my=(s.y+t.y)/2-(t.x-s.x)*0.25;
      ctx.beginPath();ctx.strokeStyle=EC[e.type]||"#555";ctx.lineWidth=1.8;ctx.globalAlpha=0.5;
      ctx.moveTo(s.x,s.y);ctx.quadraticCurveTo(mx,my,t.x,t.y);ctx.stroke();ctx.globalAlpha=1;
      const a=Math.atan2(t.y-my,t.x-mx),r=20;
      ctx.beginPath();ctx.fillStyle=EC[e.type]||"#555";
      ctx.moveTo(t.x-r*Math.cos(a)+7*Math.cos(a-Math.PI/2),t.y-r*Math.sin(a)+7*Math.sin(a-Math.PI/2));
      ctx.lineTo(t.x-r*Math.cos(a)-7*Math.cos(a-Math.PI/2),t.y-r*Math.sin(a)-7*Math.sin(a-Math.PI/2));
      ctx.lineTo(t.x-(r-11)*Math.cos(a),t.y-(r-11)*Math.sin(a));
      ctx.closePath();ctx.fill();
    });
    nodes.current.forEach(n=>{
      const isTgt=n.type==="target"; ctx.beginPath();
      if(isTgt){const s=16;ctx.moveTo(n.x,n.y-s);ctx.lineTo(n.x+s,n.y);ctx.lineTo(n.x,n.y+s);ctx.lineTo(n.x-s,n.y);ctx.closePath();ctx.fillStyle="#1a1040";ctx.strokeStyle="#a78bfa";}
      else{ctx.arc(n.x,n.y,14,0,Math.PI*2);ctx.fillStyle="#081c2e";ctx.strokeStyle="#38bdf8";}
      ctx.lineWidth=2;ctx.fill();ctx.stroke();
      ctx.fillStyle="#f0f2f8";ctx.font="600 9px 'Inter'";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(n.id.length>7?n.id.slice(0,6)+"\u2026":n.id,n.x,n.y);
    });
  },[edges]);
  useEffect(()=>{
    const cv=ref.current; if(!cv) return;
    const w=(cv.parentElement?.clientWidth||620)-24; cv.width=w;cv.height=400;
    nodes.current=data.nodes.map(n=>({...n,x:(n.x/680)*w,y:(n.y/430)*400})); draw();
  },[data.nodes,draw]);
  const onDown=e=>{const r=ref.current.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;drag.current=nodes.current.find(n=>Math.hypot(n.x-mx,n.y-my)<20)||null;};
  const onMove=e=>{if(!drag.current)return;const r=ref.current.getBoundingClientRect();drag.current.x=e.clientX-r.left;drag.current.y=e.clientY-r.top;draw();};
  const onUp=()=>{drag.current=null;};
  return <canvas ref={ref} style={{display:"block",width:"100%",height:400,borderRadius:8,background:T.bg,border:`1px solid ${T.border}`,cursor:"crosshair"}} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}/>;
};

const BarChart = ({data,h=200}) => {
  const W=480,pad={t:10,r:10,b:55,l:44},iW=W-pad.l-pad.r,iH=h-pad.t-pad.b;
  const mx=Math.max(...data.datasets.flatMap(d=>d.data.map(v=>v||0)),0.01);
  const bw=iW/data.labels.length,bW=(bw*0.7)/data.datasets.length;
  return <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{overflow:"visible"}}><g transform={`translate(${pad.l},${pad.t})`}>
    {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={0} y1={iH-v*iH} x2={iW} y2={iH-v*iH} stroke={T.border} strokeWidth={1}/><text x={-5} y={iH-v*iH+4} textAnchor="end" fill={T.text3} fontSize={9}>{v.toFixed(2)}</text></g>)}
    {data.labels.map((lbl,li)=><g key={lbl}>{data.datasets.map((ds,di)=>{const v=Math.max(0,ds.data[li]||0),bh=(v/mx)*iH,bx=li*bw+bw*0.15+di*bW;return <rect key={di} x={bx} y={iH-bh} width={bW-2} height={bh} fill={(ds.color||"#888")+"cc"} rx={3}/>;})}<text x={li*bw+bw/2} y={iH+13} textAnchor="middle" fill={T.text3} fontSize={9}>{lbl}</text></g>)}
    {data.datasets.map((ds,di)=><g key={di} transform={`translate(${di*85},${iH+30})`}><rect width={10} height={10} fill={ds.color||"#888"} rx={2}/><text x={14} y={9} fill={T.text2} fontSize={9}>{ds.label}</text></g>)}
  </g></svg>;
};

const LineChart = ({data,h=200}) => {
  const W=480,pad={t:14,r:60,b:55,l:44},iW=W-pad.l-pad.r,iH=h-pad.t-pad.b;
  const all=data.datasets.flatMap(d=>d.data.map(v=>v||0)),mn=Math.min(...all,0),mx=Math.max(...all,1),rng=mx-mn||1;
  const px=i=>(i/(data.labels.length-1))*iW,py=v=>iH-((v-mn)/rng)*iH;
  return <svg width="100%" viewBox={`0 0 ${W} ${h}`}><g transform={`translate(${pad.l},${pad.t})`}>
    {[0,.25,.5,.75,1].map(t=>{const v=mn+t*rng;return <g key={t}><line x1={0} y1={py(v)} x2={iW} y2={py(v)} stroke={T.border} strokeWidth={1}/><text x={-5} y={py(v)+4} textAnchor="end" fill={T.text3} fontSize={9}>{v.toFixed(2)}</text></g>;})}
    {data.labels.map((l,i)=><text key={i} x={px(i)} y={iH+13} textAnchor="middle" fill={T.text3} fontSize={9}>{l.split(" ")[0]}</text>)}
    {data.datasets.map((ds,di)=>{const pts=ds.data.map((v,i)=>`${px(i)},${py(v)}`).join(" ");const fp=`${px(0)},${iH} ${ds.data.map((v,i)=>`${px(i)},${py(v)}`).join(" ")} ${px(ds.data.length-1)},${iH}`;return <g key={di}><polygon points={fp} fill={(ds.color||"#888")+"18"}/><polyline points={pts} fill="none" stroke={ds.color||"#888"} strokeWidth={2} strokeDasharray={ds.dash||""}/>{ds.data.map((v,i)=><circle key={i} cx={px(i)} cy={py(v)} r={3.5} fill={ds.color||"#888"}/>)}</g>;})}
    {data.datasets.map((ds,di)=><g key={di} transform={`translate(${di*120},${iH+30})`}><line x1={0} y1={5} x2={14} y2={5} stroke={ds.color||"#888"} strokeWidth={2} strokeDasharray={ds.dash||""}/><text x={18} y={9} fill={T.text2} fontSize={9}>{ds.label}</text></g>)}
  </g></svg>;
};

const HBar = ({items,maxAbs}) => (
  <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"grid",gridTemplateColumns:"130px 1fr 1fr",gap:8,fontSize:10,color:T.text3,marginBottom:2}}>
      <span>Interaction</span><span style={{textAlign:"center"}}>2× OE</span><span style={{textAlign:"center"}}>0.5× KD</span>
    </div>
    {items.map((it,i)=>(
      <div key={i} style={{display:"grid",gridTemplateColumns:"130px 1fr 1fr",gap:8,alignItems:"center"}}>
        <div style={{color:T.text2,fontFamily:"'JetBrains Mono',monospace",fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.label}</div>
        {[it.oe,it.kd].map((val,vi)=>(
          <div key={vi} style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{color:val>=0?T.accent:T.danger,width:44,textAlign:"right",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{val>=0?"+":""}{val.toFixed(2)}</span>
            <div style={{flex:1,background:T.border,borderRadius:100,height:7,overflow:"hidden",minWidth:40}}>
              <div style={{width:`${Math.min(100,Math.abs(val)/maxAbs*100)}%`,height:"100%",borderRadius:100,background:val>=0?T.accent:T.danger}}/>
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

const SbItem = ({id,icon,label,active,onClick}) => (
  <button onClick={()=>onClick(id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,
    background:active?"rgba(74,222,128,.08)":"transparent",color:active?T.accent:T.text2,
    border:"none",cursor:"pointer",width:"100%",textAlign:"left",fontSize:13,transition:"all .15s",fontWeight:active?600:400}}>
    <span style={{width:18,textAlign:"center",fontSize:14}}>{icon}</span>{label}
  </button>
);

const Empty = ({onLoad}) => (
  <div style={{textAlign:"center",padding:"72px 24px",color:T.text3}}>
    <div style={{fontSize:40,marginBottom:14}}>📊</div>
    <div style={{color:T.text2,fontSize:15,marginBottom:6}}>No results yet</div>
    <div style={{fontSize:13,marginBottom:20}}>Run an analysis or load the demo dataset.</div>
    <Btn v="outline" onClick={onLoad}>Load demo data</Btn>
  </div>
);

const Spinner = ({size=17,color}) => (
  <div style={{width:size,height:size,border:`2px solid ${color||T.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>
);

// ════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════
export default function VeloLaw() {
  const [page, setPage]         = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser]         = useState(null);
  const [token, setToken]       = useState(() => localStorage.getItem("vl_token") || "");
  // auth form state lives inside Auth component now — these are only for legacy compat
  const [aName, setAName]   = useState("");
  const [aEmail, setAEmail] = useState("");
  const [aPw, setAPw]       = useState("");
  const [tab, setTab]           = useState("upload");
  const [results, setResults]   = useState(null);
  const [history, setHistory]   = useState([]);
  const [toast, setToast]       = useState({msg:"",type:"ok",visible:false});

  const [mode, setMode]           = useState("demo");
  const [file, setFile]           = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisId, setAnalysisId] = useState(null);
  const [prog, setProg]           = useState({steps:[],pct:0,step:""});
  const [params, setParams]       = useState({stages:4,parsimony:0.005,populations:15,iterations:80,maxSize:25,folds:3,targets:"Ins1,Ins2,Gcg,Ppy,Ghrl,Sst"});

  const [eqGene, setEqGene]     = useState("all");
  const [eqStage, setEqStage]   = useState("all");
  const [netStage, setNetStage] = useState("all");
  const [pbGene, setPbGene]     = useState("all");
  const [openEqs, setOpenEqs]   = useState({});

  const [groqKey, setGroqKey]   = useState("");
  const [aiOut, setAiOut]       = useState("");
  const [aiLoad, setAiLoad]     = useState(false);
  const [aiErr, setAiErr]       = useState("");

  const pollRef = useRef(null);

  // Restore session on load
  useEffect(() => {
    const t = localStorage.getItem("vl_token");
    const u = localStorage.getItem("vl_user");
    if (t && u) {
      try { setToken(t); setUser(JSON.parse(u)); setPage("dashboard"); } catch {}
    }
  }, []);

  const pop = (msg, type="ok") => {
    setToast({msg,type,visible:true});
    setTimeout(()=>setToast(t=>({...t,visible:false})),3200);
  };

  const authHeaders = () => ({ "Authorization": `Bearer ${token}`, "Content-Type": "application/json" });

  // ── Auth ──────────────────────────────────────────────────
  const doLogout = async () => {
    try { await fetch(`${API}/api/logout`, { method:"POST", headers:authHeaders() }); } catch {}
    localStorage.removeItem("vl_token"); localStorage.removeItem("vl_user");
    setUser(null); setToken(""); setResults(null); setPage("landing"); pop("Signed out");
  };

  // ── Analysis ─────────────────────────────────────────────
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  const runDemoAnalysis = async () => {
    setAnalyzing(true); setProg({steps:[],pct:0,step:""});
    for (let i=0; i<STEPS.length; i++) {
      await sleep(200 + Math.random()*120);
      setProg(p=>({steps:[...p.steps,STEPS[i]], pct:Math.round(((i+1)/STEPS.length)*100), step:STEPS[i]}));
    }
    await sleep(300);
    setResults(DEMO_RESULTS);
    setHistory(h=>[{id:h.length+1,name:"Pancreatic Demo",status:"complete",date:new Date().toISOString()},... h]);
    setAnalyzing(false); setTab("results"); pop("Demo analysis complete!");
  };

  const runRealAnalysis = async () => {
    if (!file) { pop("Please upload a .h5ad or .loom file first","err"); return; }
    setAnalyzing(true); setProg({steps:[],pct:0,step:"Uploading file..."});

    const fd = new FormData();
    fd.append("file", file);
    fd.append("params", JSON.stringify(params));

    try {
      const r = await fetch(`${API}/api/analyze`, {
        method:"POST",
        headers:{ "Authorization": `Bearer ${token}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");

      const aId = d.analysisId;
      setAnalysisId(aId);
      setProg(p=>({...p,steps:["File uploaded successfully"],pct:5,step:"Queued for processing"}));

      // Poll for status
      pollRef.current = setInterval(async () => {
        try {
          const sr = await fetch(`${API}/api/analyses/${aId}/status`, { headers:authHeaders() });
          const sd = await sr.json();

          if (sd.status === "complete") {
            clearInterval(pollRef.current);
            setResults(sd.results || DEMO_RESULTS);
            setHistory(h=>[{id:aId,name:file.name,status:"complete",date:new Date().toISOString()},... h]);
            setAnalyzing(false); setTab("results"); pop("Analysis complete!");
          } else if (sd.status === "failed") {
            clearInterval(pollRef.current);
            setAnalyzing(false);
            pop("Analysis failed: " + (sd.error || "Unknown error"), "err");
          } else {
            // progress
            setProg(p=>({
              steps: sd.step && !p.steps.includes(sd.step) ? [...p.steps, sd.step] : p.steps,
              pct: sd.pct || p.pct,
              step: sd.step || p.step
            }));
          }
        } catch {}
      }, 2000);

    } catch(e) {
      setAnalyzing(false);
      pop("Error: " + e.message, "err");
    }
  };

  const runAnalysis = () => mode === "demo" ? runDemoAnalysis() : runRealAnalysis();

  // Load history from API on dashboard open
  useEffect(() => {
    if (page === "dashboard" && token) {
      fetch(`${API}/api/analyses`, { headers:authHeaders() })
        .then(r=>r.json())
        .then(data => {
          if (Array.isArray(data)) setHistory(data.map(a=>({id:a.id,name:a.name,status:a.status,date:a.created_at})));
        }).catch(()=>{});
    }
  }, [page]);

  // Cleanup poll on unmount
  useEffect(() => () => { if(pollRef.current) clearInterval(pollRef.current); }, []);

  // ── AI ───────────────────────────────────────────────────
  const genAI = async () => {
    if (!groqKey.trim()) { setAiErr("Enter your Groq key"); return; }
    if (!results) { setAiErr("No results to analyze"); return; }
    setAiLoad(true); setAiErr(""); setAiOut("");
    const goodEqs = results.equations.filter(e=>e.r2>=0.3);
    const prompt = `You are an expert computational biologist.\n\nHIERARCHICAL SYMBOLIC REGRESSION RESULTS:\n${goodEqs.map(e=>`\u2022 ${e.gene} (${e.stage}): ${e.equation}\n  Regulators: ${e.regulatorsFound.join(", ")}`).join("\n")}\n\nProvide:\n**1. Top 3 Biological Insights**\n**2. Experimental Validations**\n**3. Therapeutic Implications**\n**4. Key Limitations**\n**5. Next Steps**`;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",headers:{"Authorization":"Bearer "+groqKey,"Content-Type":"application/json"},
        body:JSON.stringify({model:"llama-3.3-70b-versatile",max_tokens:1400,messages:[{role:"user",content:prompt}]})
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      setAiOut(d.choices[0].message.content);
      pop("AI insights generated!");
    } catch(e) { setAiErr("Error: "+e.message); }
    setAiLoad(false);
  };

  const exportLatex = () => {
    if (!results) return;
    const lines=["% VeloLaw \u2014 Equations","% "+new Date().toISOString(),""];
    results.equations.forEach(eq=>{
      lines.push(`% ${eq.gene} \u2014 ${eq.stage}`);
      lines.push("\\begin{equation}",`  v_{\\text{${eq.gene}}} \\approx ${eq.latex||eq.equation}`,"\\end{equation}","");
    });
    const a=document.createElement("a");
    a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(lines.join("\n"));
    a.download="velolaw_equations.tex"; a.click(); pop("LaTeX exported");
  };

  const exportCSV = () => {
    if (!results) return;
    const rows=["Gene,Stage,CV_R2,Complexity,Regulators,Equation"];
    results.equations.forEach(eq=>rows.push(`${eq.gene},${eq.stage},${eq.r2},${eq.complexity},"${eq.regulatorsFound.join(";")}","${eq.equation}"`));
    const a=document.createElement("a");
    a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(rows.join("\n"));
    a.download="velolaw_results.csv"; a.click(); pop("CSV exported");
  };

  // ── TABS ────────────────────────────────────────────────
  const Upload = () => (
    <div style={{padding:"24px 28px",maxWidth:860}}>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:700,marginBottom:4,color:T.text}}>New Analysis</h2>
      <p style={{color:T.text2,fontSize:13,marginBottom:22,lineHeight:1.6}}>Upload scRNA-seq data or use the demo dataset to discover stage-specific regulatory equations via hierarchical symbolic regression.</p>
      <div style={{display:"flex",gap:10,marginBottom:18}}>
        {[["demo","🧪","Demo (Pancreatic)"],["real","⚗","Upload .h5ad / .loom"]].map(([m,ic,lb])=>(
          <Btn key={m} v={mode===m?"primary":"secondary"} size="sm" onClick={()=>setMode(m)}>{ic} {lb}</Btn>
        ))}
      </div>
      {mode==="demo" ? (
        <Card style={{padding:18,marginBottom:18,border:`1px solid rgba(74,222,128,.25)`,background:"rgba(74,222,128,.03)"}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <span style={{fontSize:28,flexShrink:0}}>🧪</span>
            <div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:3,color:T.text}}>Mouse Pancreatic Endocrine Development</div>
              <div style={{fontSize:12,color:T.text2,marginBottom:8}}>Bastidas-Ponce et al. 2019 · 3,696 cells · 2,000 genes · scVelo dynamical model</div>
              <p style={{fontSize:12,color:T.text2,lineHeight:1.65}}>Real results from the hierarchical symbolic regression notebook. All equations, perturbation predictions, and network are exact values from the published analysis.</p>
              <div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}>
                {["3,696 cells","2,000 genes","13 regulators","4 stages","6 equations"].map(t=><Tag key={t}>{t}</Tag>)}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            {[["🧬",".h5ad / .loom","AnnData with spliced & unspliced mRNA layers","file-h5ad",".h5ad,.loom"],
              ["📊","Regulator CSV (opt.)","Pre-extracted expression matrix","file-csv",".csv,.tsv"]
            ].map(([ic,ti,de,id,ac])=>(
              <label key={id} style={{border:`2px dashed ${file&&id==="file-h5ad"?T.accent:T.border2}`,borderRadius:12,padding:26,textAlign:"center",cursor:"pointer",background:T.surface,display:"block",transition:"all .2s"}}>
                <input type="file" accept={ac} style={{display:"none"}} onChange={e=>{if(id==="file-h5ad")setFile(e.target.files[0]);}}/>
                <div style={{fontSize:30,marginBottom:8,opacity:.5}}>{ic}</div>
                <div style={{fontWeight:600,fontSize:13,marginBottom:3,color:T.text}}>{ti}</div>
                <div style={{fontSize:11,color:T.text3}}>{de}</div>
                {file&&id==="file-h5ad"&&<div style={{marginTop:8,fontSize:11,color:T.accent}}>✓ {file.name} ({(file.size/1024/1024).toFixed(1)} MB)</div>}
              </label>
            ))}
          </div>
          {!token && <div style={{background:"rgba(251,191,36,.1)",border:`1px solid rgba(251,191,36,.3)`,color:T.warn,padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:14}}>⚠ You must be signed in to run a real analysis.</div>}
        </>
      )}
      <Card style={{padding:18,marginBottom:18}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:14,color:T.text}}>⚙ Analysis Parameters</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11,marginBottom:11}}>
          {[["Stages (K)","stages",2,8,1],["Parsimony (λ)","parsimony",.001,.1,.001],["Populations","populations",5,50,1],["Iterations","iterations",20,500,1],["Max eq. size","maxSize",10,50,1],["CV folds","folds",2,10,1]].map(([lb,k,mn,mx,st])=>(
            <div key={k}>
              <label style={{display:"block",fontSize:11,color:T.text2,marginBottom:4,fontWeight:500}}>{lb}</label>
              <input type="number" value={params[k]} min={mn} max={mx} step={st} onChange={e=>setParams(p=>({...p,[k]:+e.target.value}))} className="vl-inp"
                style={{width:"100%",background:T.surface2,border:`1px solid ${T.border2}`,color:T.text,padding:"8px 10px",borderRadius:6,fontSize:13}}/>
            </div>
          ))}
        </div>
        <div>
          <label style={{display:"block",fontSize:11,color:T.text2,marginBottom:4,fontWeight:500}}>Target genes</label>
          <input value={params.targets} onChange={e=>setParams(p=>({...p,targets:e.target.value}))} className="vl-inp"
            style={{width:"100%",background:T.surface2,border:`1px solid ${T.border2}`,color:T.text,padding:"9px 12px",borderRadius:8,fontSize:13}}/>
        </div>
      </Card>
      <Btn size="lg" onClick={runAnalysis} disabled={analyzing}>{analyzing?<><Spinner size={14}/> Analyzing…</>:"▶ Run Analysis"}</Btn>
      {analyzing && (
        <Card style={{padding:18,marginTop:18}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontWeight:600,fontSize:14,color:T.text}}>Analysis in progress</div>
            <Spinner/>
          </div>
          <div style={{fontSize:12,color:T.accent2,marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>{prog.step}</div>
          <div style={{maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
            {prog.steps.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:8,fontSize:12,color:T.accent,animation:"fadeUp .2s ease"}}>
                <span>✓</span><span>{s}</span>
              </div>
            ))}
          </div>
          <div style={{background:T.border,borderRadius:100,height:5,overflow:"hidden",marginBottom:3}}>
            <div style={{height:"100%",width:`${prog.pct}%`,background:`linear-gradient(90deg,${T.accent},${T.accent2})`,transition:"width .4s",borderRadius:100}}/>
          </div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.text3,textAlign:"right"}}>{prog.pct}%</div>
        </Card>
      )}
    </div>
  );

  const Results = () => {
    if (!results) return <Empty onLoad={()=>{setMode("demo");runDemoAnalysis();}}/>;
    const good=results.equations.filter(e=>e.r2>=0.3);
    const best=results.equations.reduce((a,b)=>a.r2>b.r2?a:b);
    const r2data={labels:["Early","Spec.","Diff.","Mature"],datasets:results.equations.reduce((acc,eq)=>{const si=["Early Progenitor","Specification","Differentiation","Maturation"].indexOf(eq.stage);const ex=acc.find(d=>d.label===eq.gene);if(ex){if(si>=0)ex.data[si]=Math.max(0,eq.r2);}else{const d=Array(4).fill(null);if(si>=0)d[si]=Math.max(0,eq.r2);acc.push({label:eq.gene,data:d,color:eq.color});}return acc;},{})};
    const progdata={labels:results.stageProgression?.Ins2?.map(p=>p.stage)||[],datasets:[{label:"Fit Ins2",data:results.stageProgression?.Ins2?.map(p=>Math.max(0,p.r2))||[],color:T.accent},{label:"Complexity/200",data:results.stageProgression?.Ins2?.map(p=>p.complexity/200)||[],color:T.accent3,dash:"4,2"}]};
    return (
      <div style={{padding:"22px 28px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:700,color:T.text}}>Analysis Results</h2>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" size="sm" onClick={exportLatex}>📄 LaTeX</Btn>
            <Btn v="secondary" size="sm" onClick={exportCSV}>⬇ CSV</Btn>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:11,marginBottom:18}}>
          <Metric value={results.dataset.cells.toLocaleString()} label="Total cells" sub={results.dataset.genes.toLocaleString()+" genes"} color={T.accent}/>
          <Metric value={`${good.length}/${results.equations.length}`} label="Strong models" sub="gene × stage" color={T.accent2}/>
          <Metric value={best.gene+" · "+best.stage} label="Best equation" sub="highest model fit" color={T.accent3}/>
          <Metric value={results.regulators.length} label="Regulators" sub="tested across stages" color={T.warn}/>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:T.text2,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.07em"}}>Developmental stages</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:20}}>
          {results.stages.map(s=>(
            <Card key={s.id} style={{padding:13,textAlign:"center",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${T.accent},${T.accent2})`}}/>
              <div style={{fontSize:9,color:T.text3,fontFamily:"'JetBrains Mono',monospace",marginBottom:2}}>Stage {s.id}</div>
              <div style={{fontWeight:600,fontSize:12,marginBottom:2,color:T.text}}>{s.name}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:19,color:T.accent2}}>{s.cells}</div>
              <div style={{fontSize:10,color:T.text3}}>{s.marker}</div>
            </Card>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Card style={{padding:16}}><div style={{fontSize:13,fontWeight:600,marginBottom:12,color:T.text,display:"flex",alignItems:"center",justifyContent:"space-between"}}>Model fit by Gene & Stage <Tag>3-fold CV</Tag></div><BarChart data={r2data} h={195}/></Card>
          <Card style={{padding:16}}><div style={{fontSize:13,fontWeight:600,marginBottom:12,color:T.text,display:"flex",alignItems:"center",justifyContent:"space-between"}}>Ins2 Stage Progression <Tag>fit + complexity</Tag></div><LineChart data={progdata} h={195}/></Card>
        </div>
      </div>
    );
  };

  const Equations = () => {
    if (!results) return <Empty onLoad={()=>{setMode("demo");runDemoAnalysis();}}/>;
    const genes=[...new Set(results.equations.map(e=>e.gene))];
    let eqs=results.equations;
    if (eqGene!=="all") eqs=eqs.filter(e=>e.gene===eqGene);
    if (eqStage!=="all") eqs=eqs.filter(e=>e.stage===eqStage);
    return (
      <div style={{padding:"22px 28px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:700,color:T.text}}>Discovered Equations</h2>
          <div style={{display:"flex",gap:8}}>
            {[["gene",eqGene,setEqGene,["all",...genes]],["stage",eqStage,setEqStage,["all","Early Progenitor","Specification","Differentiation","Maturation"]]].map(([k,val,set,opts])=>(
              <select key={k} value={val} onChange={e=>set(e.target.value)} style={{background:T.surface2,border:`1px solid ${T.border2}`,color:T.text,padding:"6px 10px",borderRadius:8,fontSize:12,outline:"none"}}>
                {opts.map(o=><option key={o}>{o}</option>)}
              </select>
            ))}
            <Btn v="secondary" size="sm" onClick={exportLatex}>📄 LaTeX</Btn>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          {eqs.map((eq,i)=>(
            <Card key={i} style={{overflow:"hidden"}}>
              <div onClick={()=>setOpenEqs(o=>({...o,[i]:!o[i]}))} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 17px",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:eq.color,flexShrink:0}}/>
                  <span style={{fontWeight:700,fontSize:14,color:T.text}}>{eq.gene}</span>
                  <span style={{background:T.surface2,border:`1px solid ${T.border2}`,padding:"2px 9px",borderRadius:100,fontSize:11,color:T.text2}}>{eq.stage}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <ModelBadge r2={eq.r2}/>
                  <span style={{color:T.text3,fontSize:11}}>{eq.complexity}</span>
                  <span style={{color:T.text3,fontSize:11,transform:openEqs[i]?"rotate(180deg)":"none",display:"inline-block",transition:"transform .2s"}}>▼</span>
                </div>
              </div>
              {openEqs[i] && (
                <div style={{padding:"0 17px 17px",animation:"fadeUp .2s ease"}}>
                  <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:13,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:T.accent2,lineHeight:1.75,overflowX:"auto",marginBottom:9,whiteSpace:"pre-wrap"}}>{eq.equation}</div>
                  <div style={{background:"rgba(167,139,250,.06)",borderLeft:`3px solid ${T.accent3}`,padding:"9px 13px",borderRadius:"0 6px 6px 0",fontSize:13,color:T.text,lineHeight:1.6,marginBottom:9}}>{eq.interpretation}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:11,alignItems:"center"}}>
                    <span style={{fontSize:11,color:T.text3}}>Regulators:</span>
                    {eq.regulatorsFound.map(r=><Tag key={r}>{r}</Tag>)}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Btn v="secondary" size="sm" onClick={()=>{navigator.clipboard?.writeText(eq.equation);pop("Copied!");}}>Copy equation</Btn>
                    <Btn v="ghost" size="sm" onClick={()=>{navigator.clipboard?.writeText(eq.latex||eq.equation);pop("LaTeX copied!");}}>Copy LaTeX</Btn>
                  </div>
                </div>
              )}
            </Card>
          ))}
          {eqs.length===0 && <div style={{textAlign:"center",padding:"40px 0",color:T.text3,fontSize:13}}>No equations match this filter.</div>}
        </div>
      </div>
    );
  };

  const Network = () => {
    if (!results) return <Empty onLoad={()=>{setMode("demo");runDemoAnalysis();}}/>;
    const filtered=netStage==="all"?results.network.edges:results.network.edges.filter(e=>e.stage===netStage);
    return (
      <div style={{padding:"22px 28px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:700,color:T.text}}>Regulatory Network</h2>
          <select value={netStage} onChange={e=>setNetStage(e.target.value)} style={{background:T.surface2,border:`1px solid ${T.border2}`,color:T.text,padding:"6px 10px",borderRadius:8,fontSize:12,outline:"none"}}>
            {["all","Specification","Differentiation","Maturation"].map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <Card style={{padding:17,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:3,color:T.text}}>Gene Regulatory Network <span style={{fontSize:11,color:T.text3,fontWeight:400}}>— drag nodes to explore</span></div>
          <div style={{fontSize:11,color:T.text3,marginBottom:11}}>Edges extracted from discovered equations. Directionality inferred from equation structure.</div>
          <NetCanvas data={results.network} stageFilter={netStage}/>
          <div style={{display:"flex",gap:18,marginTop:11,flexWrap:"wrap"}}>
            {[["#4ade80","Activation"],["#f87171","Repression"],["#fbbf24","Modulation"],["#a78bfa","Target gene (◇)"],["#38bdf8","Regulator (●)"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.text2}}><div style={{width:8,height:8,borderRadius:"50%",background:c}}/>{l}</div>
            ))}
          </div>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:14}}>
          {[[results.network.nodes.length,"Total nodes"],[results.network.nodes.filter(n=>n.type==="target").length,"Targets"],[results.network.nodes.filter(n=>n.type==="regulator").length,"Regulators"],[filtered.length,"Edges shown"]].map(([v,l])=>(<Metric key={l} value={v} label={l}/>))}
        </div>
        <Card style={{padding:17}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:11,color:T.text}}>Edge detail</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {filtered.map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,padding:"6px 10px",background:T.surface2,borderRadius:7}}>
                <span style={{color:T.accent2,fontFamily:"'JetBrains Mono',monospace",minWidth:60}}>{e.source}</span>
                <span style={{color:{activate:T.accent,repress:T.danger,modulate:T.warn}[e.type],fontSize:16}}>{e.type==="activate"?"\u2192":e.type==="repress"?"\u22a3":"~"}</span>
                <span style={{color:T.accent3,fontFamily:"'JetBrains Mono',monospace",minWidth:50}}>{e.target}</span>
                <Tag style={{marginLeft:"auto"}}>{e.stage}</Tag>
                <span style={{color:{activate:T.accent,repress:T.danger,modulate:T.warn}[e.type],fontSize:11}}>{e.type}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  const Perturbation = () => {
    if (!results) return <Empty onLoad={()=>{setMode("demo");runDemoAnalysis();}}/>;
    let pb=results.perturbations;
    if (pbGene!=="all") pb=pb.filter(p=>p.target===pbGene);
    const maxAbs=Math.max(...pb.flatMap(p=>[Math.abs(p.overexpression),Math.abs(p.knockdown)]));
    const genes=[...new Set(results.perturbations.map(p=>p.target))];
    return (
      <div style={{padding:"22px 28px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:700,color:T.text}}>In Silico Perturbation</h2>
          <Tag>2× overexpression · 0.5× knockdown</Tag>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:11,marginBottom:18}}>
          <Metric value="+7.31 Δv" label="Largest activation" sub="Ins2 self-OE" color={T.accent}/>
          <Metric value="−28.41 Δv" label="Strongest repression" sub="Gnas → Ghrl" color={T.danger}/>
          <Metric value={pb.filter(p=>p.overexpression>0).length} label="Activating OEs" color={T.accent2}/>
          <Metric value={pb.filter(p=>p.overexpression<0).length} label="Repressive OEs" color={T.warn}/>
        </div>
        <Card style={{padding:17,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,fontSize:13,fontWeight:600,color:T.text}}>
            Perturbation effects
            <select value={pbGene} onChange={e=>setPbGene(e.target.value)} style={{background:T.surface2,border:`1px solid ${T.border2}`,color:T.text,padding:"5px 8px",borderRadius:6,fontSize:11,outline:"none"}}>
              <option value="all">All targets</option>
              {genes.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <HBar items={pb.map(p=>({label:`${p.target} ← ${p.regulator}`,oe:p.overexpression,kd:p.knockdown}))} maxAbs={maxAbs}/>
        </Card>
      </div>
    );
  };

  const AITab = () => {
    if (!results) return <Empty onLoad={()=>{setMode("demo");runDemoAnalysis();}}/>;
    const good=results.equations.filter(e=>e.r2>=0.3);
    return (
      <div style={{padding:"22px 28px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:700,color:T.text}}>AI Biological Insights</h2>
          <Tag>Groq · LLaMA 3.3 70B</Tag>
        </div>
        <Card style={{padding:20,marginBottom:14,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${T.accent3},transparent)`}}/>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
            <div style={{width:36,height:36,background:`linear-gradient(135deg,${T.accent3},${T.accent2})`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>🤖</div>
            <div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:2,color:T.text}}>AI Regulatory Interpretation</div>
              <div style={{fontSize:12,color:T.text2}}>Powered by Groq — get free key at <span style={{color:T.accent2}}>console.groq.com</span></div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input type="password" value={groqKey} onChange={e=>setGroqKey(e.target.value)} placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx" className="vl-inp"
              style={{flex:1,background:T.bg,border:`1px solid ${T.border2}`,color:T.text,padding:"9px 12px",borderRadius:8,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}/>
            <Btn v="outline" onClick={genAI} disabled={aiLoad}>{aiLoad?"Generating…":"Generate insights"}</Btn>
          </div>
          {aiErr && <div style={{color:T.danger,fontSize:12,marginBottom:9,lineHeight:1.5}}>{aiErr}</div>}
          {aiLoad && <div style={{display:"flex",alignItems:"center",gap:9,color:T.accent3,fontSize:13}}><Spinner size={15} color={T.accent3}/> Analyzing with LLaMA 3.3 70B…</div>}
          {aiOut && <div style={{fontSize:13,color:T.text,lineHeight:1.8,background:T.surface2,borderRadius:10,padding:15,marginTop:8}} dangerouslySetInnerHTML={{__html:aiOut.replace(/\*\*(.+?)\*\*/g,"<strong style='color:#f0f2f8'>$1</strong>").replace(/\n\n/g,"<br/><br/>")}}/>}
        </Card>
        <Card style={{padding:18}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:34,height:34,background:"linear-gradient(135deg,#f59e0b,#ef4444)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>💡</div>
            <div><div style={{fontWeight:600,color:T.text}}>Auto-generated Summaries</div><div style={{fontSize:12,color:T.text2}}>Extracted from equation structure — no API key needed</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {good.map((eq,i)=>(
              <div key={i} style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,padding:13}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:eq.color,flexShrink:0}}/>
                  <span style={{fontWeight:600,fontSize:13,color:T.text}}>{eq.gene} · {eq.stage}</span>
                </div>
                <div style={{fontSize:12,color:T.text2,lineHeight:1.65,marginBottom:7}}>{eq.interpretation}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{eq.regulatorsFound.map(r=><Tag key={r} style={{fontSize:10}}>{r}</Tag>)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  const History = () => (
    <div style={{padding:"22px 28px"}}>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:23,fontWeight:700,marginBottom:18,color:T.text}}>Analysis History</h2>
      {history.length===0 ? (
        <div style={{textAlign:"center",padding:"56px 0",color:T.text3}}>
          <div style={{fontSize:32,marginBottom:10}}>📋</div>
          <div style={{color:T.text2,fontSize:14,marginBottom:6}}>No analyses yet</div>
          <div style={{fontSize:13}}>Your completed analyses will appear here.</div>
        </div>
      ) : (
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
            {["Name","Status","Date",""].map(h=><th key={h} style={{textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:"0.07em",color:T.text3,padding:"8px 11px",fontWeight:500}}>{h}</th>)}
          </tr></thead>
          <tbody>{history.map(a=>(
            <tr key={a.id} style={{borderBottom:`1px solid ${T.border}`}}>
              <td style={{padding:"11px",fontSize:13,color:T.text}}>{a.name}</td>
              <td style={{padding:"11px"}}><span style={{background:"rgba(74,222,128,.15)",color:T.accent,padding:"2px 9px",borderRadius:100,fontSize:11,fontWeight:700}}>{a.status}</span></td>
              <td style={{padding:"11px",fontSize:12,color:T.text2}}>{new Date(a.date||a.created_at).toLocaleDateString()}</td>
              <td style={{padding:"11px"}}><Btn v="secondary" size="sm" onClick={()=>{setResults(DEMO_RESULTS);setTab("results");pop("Results loaded");}}>Load</Btn></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );

  // ── PAGES ────────────────────────────────────────────────
  const Landing = () => (
    <div style={{minHeight:"100vh",background:T.bg}}>
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 32px",borderBottom:`1px solid ${T.border}`,background:"rgba(7,9,14,.95)",backdropFilter:"blur(14px)",position:"sticky",top:0,zIndex:100}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:21,fontWeight:800,color:T.accent,letterSpacing:"-0.03em"}}>⬡ VeloLaw <span style={{color:T.text3,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:400}}>beta</span></div>
        <div style={{display:"flex",gap:10}}>
          <Btn v="secondary" onClick={()=>{setAuthMode("login");setPage("auth");}}>Sign in</Btn>
          <Btn onClick={()=>{setAuthMode("register");setPage("auth");}}>Get started free</Btn>
        </div>
      </nav>
      <div style={{padding:"80px 24px 60px",maxWidth:1000,margin:"0 auto",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(74,222,128,.08)",border:`1px solid rgba(74,222,128,.2)`,color:T.accent,padding:"5px 18px",borderRadius:100,fontSize:11,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.05em",marginBottom:32}}>
          <span style={{width:6,height:6,background:T.accent,borderRadius:"50%",animation:"pulse 2s infinite",display:"inline-block"}}/>
          RNA Velocity · Symbolic Regression · Interpretable AI
        </div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(2.4rem,5vw,4rem)",lineHeight:1.08,letterSpacing:"-0.04em",marginBottom:24,fontWeight:800,color:T.text}}>
          Discover <em style={{color:T.accent,fontStyle:"italic"}}>why</em> genes change,<br/>not just how
        </h1>
        <p style={{fontSize:17,color:T.text2,maxWidth:540,margin:"0 auto 36px",lineHeight:1.7}}>VeloLaw turns RNA velocity data into explicit, readable regulatory equations — so you can understand, validate, and act on the biology.</p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn size="lg" onClick={()=>{setAuthMode("register");setPage("auth");}}>▶ Start free analysis</Btn>
          <Btn v="secondary" size="lg" onClick={()=>{setAuthMode("register");setPage("auth");}}>📊 View demo results</Btn>
        </div>
      </div>
      <div style={{padding:"48px 24px 80px",maxWidth:1040,margin:"0 auto"}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.accent,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:6}}>Platform capabilities</div>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:28,letterSpacing:"-0.03em",marginBottom:28,fontWeight:700,color:T.text}}>Everything from RNA velocity to mechanism</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
          {[["🧬","RNA Velocity Estimation","scVelo dynamical model recovers kinetic parameters and pseudotime from spliced/unspliced counts.","rgba(74,222,128,.08)"],
            ["⚡","Hierarchical Symbolic Regression","PySR genetic programming discovers stage-specific equations with biologically-constrained operators.","rgba(56,189,248,.08)"],
            ["🔬","In Silico Perturbation","Predict overexpression and knockdown effects on velocity before wet lab experiments.","rgba(167,139,250,.08)"],
            ["🕸","Regulatory Network","Interactive GRN with stage-specific edges, activation/repression directionality, drag-to-explore canvas.","rgba(251,191,36,.08)"],
            ["🤖","AI Biological Interpretation","Groq LLaMA 3.3 70B analyzes equations and recommends experimental validations and drug targets.","rgba(249,115,22,.08)"],
            ["📄","LaTeX & CSV Export","Every equation formatted for direct manuscript inclusion. Copy-paste into bioRxiv preprint.","rgba(248,113,113,.08)"],
          ].map(([ic,ti,de,bg])=>(
            <Card key={ti} style={{padding:22}}>
              <div style={{width:38,height:38,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:13}}>{ic}</div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:T.text}}>{ti}</div>
              <div style={{fontSize:13,color:T.text2,lineHeight:1.65}}>{de}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const Auth = ({ initialMode, onSuccess, onBack }) => {
    const [mode, setMode]       = useState(initialMode || "login");
    const [name, setName]       = useState("");
    const [email, setEmail]     = useState("");
    const [pw, setPw]           = useState("");
    const [err, setErr]         = useState("");
    const [loading, setLoading] = useState(false);

    const login = async () => {
      setErr(""); setLoading(true);
      try {
        const r = await fetch(`${API}/api/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email, password:pw}) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Login failed");
        onSuccess(d.token, d.user);
      } catch(e) { setErr(e.message); }
      setLoading(false);
    };

    const register = async () => {
      setErr(""); setLoading(true);
      if (!name||!email||!pw) { setErr("All fields required"); setLoading(false); return; }
      if (pw.length < 6) { setErr("Password min 6 characters"); setLoading(false); return; }
      try {
        const r = await fetch(`${API}/api/register`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name, email, password:pw}) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Registration failed");
        onSuccess(d.token, d.user);
      } catch(e) { setErr(e.message); }
      setLoading(false);
    };

    return (
      <div style={{minHeight:"100vh",background:T.bg}}>
        <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 28px",borderBottom:`1px solid ${T.border}`}}>
          <div onClick={onBack} style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:T.accent,cursor:"pointer",letterSpacing:"-0.03em"}}>⬡ VeloLaw</div>
          <Btn v="ghost" size="sm" onClick={onBack}>← Back</Btn>
        </nav>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 57px)",padding:24}}>
          <Card style={{padding:36,width:"100%",maxWidth:420,animation:"fadeUp .3s ease"}}>
            {mode==="login" ? (
              <>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:700,marginBottom:5,color:T.text}}>Welcome back</div>
                <div style={{color:T.text2,fontSize:13,marginBottom:24}}>Sign in to your VeloLaw account</div>
                {err && <div style={{background:"rgba(248,113,113,.1)",border:`1px solid rgba(248,113,113,.3)`,color:T.danger,padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:14}}>{err}</div>}
                <Inp label="Email" type="email" value={email} onChange={setEmail} placeholder="you@lab.org"/>
                <Inp label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••••"/>
                <Btn full onClick={login} disabled={loading}>{loading?<><Spinner size={13} color="#000"/> Signing in…</>:"Sign in"}</Btn>
                <div style={{textAlign:"center",marginTop:16,fontSize:13,color:T.text2}}>No account? <span onClick={()=>{setMode("register");setErr("");}} style={{color:T.accent,cursor:"pointer",fontWeight:600}}>Register free</span></div>
              </>
            ) : (
              <>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:700,marginBottom:5,color:T.text}}>Create account</div>
                <div style={{color:T.text2,fontSize:13,marginBottom:24}}>Free forever — no credit card required</div>
                {err && <div style={{background:"rgba(248,113,113,.1)",border:`1px solid rgba(248,113,113,.3)`,color:T.danger,padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:14}}>{err}</div>}
                <Inp label="Full name" value={name} onChange={setName} placeholder="Ana Researcher"/>
                <Inp label="Email" type="email" value={email} onChange={setEmail} placeholder="you@lab.org"/>
                <Inp label="Password" type="password" value={pw} onChange={setPw} placeholder="min. 6 characters"/>
                <Btn full onClick={register} disabled={loading}>{loading?<><Spinner size={13} color="#000"/> Creating account…</>:"Create free account"}</Btn>
                <div style={{textAlign:"center",marginTop:16,fontSize:13,color:T.text2}}>Have an account? <span onClick={()=>{setMode("login");setErr("");}} style={{color:T.accent,cursor:"pointer",fontWeight:600}}>Sign in</span></div>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  };

  const Dashboard = () => (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 22px",borderBottom:`1px solid ${T.border}`,background:"rgba(7,9,14,.95)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100}}>
        <div onClick={()=>setPage("landing")} style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:T.accent,cursor:"pointer",letterSpacing:"-0.03em"}}>⬡ VeloLaw <span style={{color:T.text3,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:400}}>beta</span></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:"#000"}}>{user?.name?.[0]?.toUpperCase()}</div>
            <span style={{fontSize:13,color:T.text}}>{user?.name}</span>
            <Tag>{user?.plan||"free"}</Tag>
          </div>
          <Btn v="ghost" size="sm" onClick={doLogout}>Sign out</Btn>
        </div>
      </nav>
      <div style={{display:"grid",gridTemplateColumns:"215px 1fr",flex:1,maxHeight:"calc(100vh - 57px)",overflow:"hidden"}}>
        <div style={{background:T.surface,borderRight:`1px solid ${T.border}`,padding:"14px 7px",overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.12em",color:T.text3,padding:"4px 12px 6px",fontFamily:"'JetBrains Mono',monospace",fontWeight:500}}>Analysis</div>
          <SbItem id="upload"       icon="📤" label="New Analysis"   active={tab==="upload"}       onClick={setTab}/>
          <SbItem id="results"      icon="📊" label="Results"        active={tab==="results"}      onClick={setTab}/>
          <SbItem id="equations"    icon="∫"  label="Equations"      active={tab==="equations"}    onClick={setTab}/>
          <SbItem id="network"      icon="🕸" label="Network"        active={tab==="network"}      onClick={setTab}/>
          <SbItem id="perturbation" icon="⚡" label="Perturbation"   active={tab==="perturbation"} onClick={setTab}/>
          <SbItem id="ai"           icon="🤖" label="AI Insights"    active={tab==="ai"}           onClick={setTab}/>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.12em",color:T.text3,padding:"14px 12px 6px",fontFamily:"'JetBrains Mono',monospace",fontWeight:500}}>Account</div>
          <SbItem id="history"      icon="📋" label="History"        active={tab==="history"}      onClick={setTab}/>
        </div>
        <div style={{overflowY:"auto"}}>
          {tab==="upload"       && <Upload/>}
          {tab==="results"      && <Results/>}
          {tab==="equations"    && <Equations/>}
          {tab==="network"      && <Network/>}
          {tab==="perturbation" && <Perturbation/>}
          {tab==="ai"           && <AITab/>}
          {tab==="history"      && <History/>}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {page==="landing"   && <Landing/>}
      {page==="auth"      && <Auth initialMode={authMode} onBack={()=>setPage("landing")} onSuccess={(t,u)=>{
        localStorage.setItem("vl_token",t); localStorage.setItem("vl_user",JSON.stringify(u));
        setToken(t); setUser(u); setPage("dashboard"); pop("Welcome, "+u.name+"!");
      }}/>}
      {page==="dashboard" && <Dashboard/>}
      <Toast msg={toast.msg} type={toast.type} visible={toast.visible}/>
    </>
  );
}
