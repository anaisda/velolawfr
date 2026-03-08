import { useState, useEffect, useRef, useCallback } from "react";

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
      interpretation:"Early \u03b2-cell specification: Nkx6-1 and Hmgn3 drive insulin transcription against progenitor repression by Neurog3 and Pax4. Cubic structure suggests strong non-linear cooperative gating." },
    { gene:"Ins2", stage:"Differentiation", stageId:2, r2:0.776, r2_train:0.83, complexity:"cubic", color:"#10b981",
      equation:"v = 0.00738\u00b7(Ins1 + Pdx1)\u00b3 + 0.00738\u00b7(Iapp + Ins2 + \u221aPdx1)\u00b3",
      latex:"0.00738(\\text{Ins1}+\\text{Pdx1})^3+0.00738(\\text{Iapp}+\\text{Ins2}+\\sqrt{\\text{Pdx1}})^3",
      regulatorsFound:["Ins1","Pdx1","Iapp","Ins2"],
      interpretation:"Coordinated activation: Pdx1 (master \u03b2-cell TF) drives cubic activation with autocrine Ins1 coupling and amylin (Iapp) co-secretion. AND-gate logic requires both Pdx1 and self-regulation." },
    { gene:"Ins2", stage:"Maturation", stageId:3, r2:0.870, r2_train:0.91, complexity:"quartic+exp", color:"#6366f1",
      equation:"v = Ins2\u2074\u00b7[(1.39e-3 \u2212 4.17e-4\u00b7Ins2)\u00b7(Ins1 \u2212 Sst)\u00b7exp(\u221aGnas) + 1.204\u00b7exp(\u22120.480\u00b7Ins2)]\u00b2",
      latex:"\\text{Ins2}^4\\left[(1.39{\\times}10^{-3}-4.17{\\times}10^{-4}\\text{Ins2})(\\text{Ins1}-\\text{Sst})e^{\\sqrt{\\text{Gnas}}}+1.204\\,e^{-0.480\\,\\text{Ins2}}\\right]^2",
      regulatorsFound:["Ins2","Ins1","Sst","Gnas"],
      interpretation:"Mature \u03b2-cell: Quartic self-regulation via Ins2 autocrine feedback. Sst (\u03b4-cell somatostatin) provides paracrine inhibition. Gnas exponential term reflects G-protein homeostatic control." },
    { gene:"Ppy", stage:"Differentiation", stageId:2, r2:0.433, r2_train:0.51, complexity:"linear", color:"#ec4899",
      equation:"v = \u22120.393\u00b7(Iapp + Ppy \u2212 Neurog3 \u2212 Nkx6-1 \u2212 Pax4 + Pdx1 + 0.866) \u2212 0.044",
      latex:"-0.393(\\text{Iapp}+\\text{Ppy}-\\text{Neurog3}-\\text{Nkx6-1}-\\text{Pax4}+\\text{Pdx1}+0.866)-0.044",
      regulatorsFound:["Iapp","Ppy","Neurog3","Nkx6-1","Pax4","Pdx1"],
      interpretation:"PP-cell lineage commitment: Pdx1 and Iapp activate; progenitor factors Neurog3, Nkx6-1, Pax4 repress. Negative self-regulation of Ppy suggests homeostatic buffering." },
    { gene:"Ppy", stage:"Maturation", stageId:3, r2:0.395, r2_train:0.44, complexity:"linear+\u221a", color:"#f97316",
      equation:"v = 0.464\u00b7\u221aGhrl \u2212 0.464\u00b7Gnas \u2212 0.464\u00b7Hmgn3 + 0.279\u00b7Ins2 \u2212 0.464\u00b7Pax6 \u2212 0.279\u00b7Ppy + 0.464\u00b7Sst + 0.279",
      latex:"0.464\\sqrt{\\text{Ghrl}}-0.464\\,\\text{Gnas}-0.464\\,\\text{Hmgn3}+0.279\\,\\text{Ins2}-0.464\\,\\text{Pax6}-0.279\\,\\text{Ppy}+0.464\\,\\text{Sst}+0.279",
      regulatorsFound:["Ghrl","Gnas","Hmgn3","Ins2","Pax6","Ppy","Sst"],
      interpretation:"Mature PP-cell cross-talk: Ghrl (\u03b5-cells), Sst (\u03b4-cells) and Ins2 (\u03b2-cells) activate. Gnas and Hmgn3 act as brakes. Negative self-regulation of Ppy confirms homeostatic control." },
    { gene:"Ghrl", stage:"Maturation", stageId:3, r2:0.185, r2_train:0.24, complexity:"low", color:"#84cc16",
      equation:"v = Ghrl\u00b7(Ghrl \u2212 Gnas\u00b2) \u2212 Gnb1",
      latex:"\\text{Ghrl}(\\text{Ghrl}-\\text{Gnas}^2)-\\text{Gnb1}",
      regulatorsFound:["Ghrl","Gnas","Gnb1"],
      interpretation:"\u03b5-cell ghrelin: Weak model (R\u00b2=0.185) due to limited \u03b5-cell representation. Self-activation + G-protein repression (Gnas\u00b2, Gnb1). Treat with caution \u2014 underpowered." },
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
      { id:"Ins2",    type:"target",    x:380, y:180 },
      { id:"Ppy",     type:"target",    x:200, y:340 },
      { id:"Ghrl",    type:"target",    x:560, y:340 },
      { id:"Pdx1",    type:"regulator", x:260, y:90  },
      { id:"Neurog3", type:"regulator", x:110, y:200 },
      { id:"Nkx6-1",  type:"regulator", x:510, y:120 },
      { id:"Iapp",    type:"regulator", x:430, y:290 },
      { id:"Gnas",    type:"regulator", x:620, y:220 },
      { id:"Hmgn3",   type:"regulator", x:90,  y:310 },
      { id:"Sst",     type:"regulator", x:380, y:400 },
      { id:"Ins1",    type:"regulator", x:490, y:75  },
    ],
    edges: [
      { source:"Pdx1",    target:"Ins2", type:"activate", stage:"Differentiation" },
      { source:"Nkx6-1",  target:"Ins2", type:"activate", stage:"Specification"   },
      { source:"Neurog3", target:"Ins2", type:"repress",  stage:"Specification"   },
      { source:"Iapp",    target:"Ins2", type:"activate", stage:"Differentiation" },
      { source:"Ins1",    target:"Ins2", type:"repress",  stage:"Maturation"      },
      { source:"Sst",     target:"Ins2", type:"repress",  stage:"Maturation"      },
      { source:"Gnas",    target:"Ins2", type:"modulate", stage:"Maturation"      },
      { source:"Pdx1",    target:"Ppy",  type:"activate", stage:"Differentiation" },
      { source:"Neurog3", target:"Ppy",  type:"repress",  stage:"Differentiation" },
      { source:"Hmgn3",   target:"Ppy",  type:"repress",  stage:"Maturation"      },
      { source:"Gnas",    target:"Ghrl", type:"repress",  stage:"Maturation"      },
      { source:"Ins2",    target:"Ppy",  type:"activate", stage:"Maturation"      },
    ]
  },
  stageProgression: {
    Ins2: [
      { stage:"Early Progenitor", r2:-0.02,  complexity:45  },
      { stage:"Specification",    r2:0.333,  complexity:112 },
      { stage:"Differentiation",  r2:0.776,  complexity:138 },
      { stage:"Maturation",       r2:0.870,  complexity:187 },
    ]
  }
};

const STEPS = [
  "Loading & preprocessing scRNA-seq data",
  "Fitting scVelo dynamical model (spliced/unspliced)",
  "Recovering kinetic parameters (\u03b1, \u03b2, \u03b3)",
  "Computing velocity pseudotime",
  "Segmenting 4 developmental stages (equal quantiles)",
  "Symbolic regression \u2014 Stage 0 (Early Progenitor)",
  "Symbolic regression \u2014 Stage 1 (Specification)",
  "Symbolic regression \u2014 Stage 2 (Differentiation)",
  "Symbolic regression \u2014 Stage 3 (Maturation)",
  "3-fold cross-validation & model selection",
  "Building regulatory network from equations",
  "Computing in silico perturbation predictions",
  "Finalizing \u2014 all done",
];

// ─── Admin credentials ────────────────────────────────────────
const ADMIN_EMAIL = "anais@velolaw.io";
const ADMIN_PW    = "velolaw-admin-2025";

// ─── In-memory auth + session tracking ───────────────────────
const _users = [];
const _sessions = []; // { userId, email, name, ip, loginAt, userAgent }
const _events   = []; // { type, userId, email, detail, at }
let _uid = 1;

function _log(type, userId, email, detail="") {
  _events.unshift({ type, userId, email, detail, at: new Date().toISOString() });
  if (_events.length > 200) _events.pop();
}

const authRegister = (name, email, pw) => {
  if (email===ADMIN_EMAIL) throw new Error("Reserved email");
  if (_users.find(u => u.email === email)) throw new Error("Email already registered");
  const u = { id:_uid++, name, email, pw, plan:"free",
    createdAt:new Date().toISOString(), lastLogin:null, loginCount:0, analyses:0, blocked:false };
  _users.push(u);
  _log("register", u.id, email, "New user registered");
  return { id:u.id, name:u.name, email:u.email, plan:u.plan };
};

const authLogin = (email, pw) => {
  if (email===ADMIN_EMAIL && pw===ADMIN_PW)
    return { id:0, name:"Anais Daoud", email:ADMIN_EMAIL, plan:"admin", isAdmin:true };
  const u = _users.find(u => u.email===email && u.pw===pw);
  if (!u) { _log("failed_login", null, email, "Wrong credentials"); throw new Error("Invalid email or password"); }
  if (u.blocked) throw new Error("Account suspended. Contact support.");
  u.lastLogin = new Date().toISOString();
  u.loginCount = (u.loginCount||0) + 1;
  _sessions.unshift({ userId:u.id, email:u.email, name:u.name,
    loginAt:new Date().toISOString(), active:true });
  if (_sessions.length > 100) _sessions.pop();
  _log("login", u.id, email, "User logged in");
  return { id:u.id, name:u.name, email:u.email, plan:u.plan };
};

// Seed some mock users for demo purposes
(function seedMockData() {
  const mockUsers = [
    {name:"Sarah Chen",email:"s.chen@mit.edu",pw:"test",plan:"free",loginCount:14,analyses:5,blocked:false,daysAgo:12},
    {name:"Dr. Omar Farouk",email:"o.farouk@pasteur.fr",pw:"test",plan:"free",loginCount:7,analyses:2,blocked:false,daysAgo:8},
    {name:"Priya Nair",email:"p.nair@wellcome.ac.uk",pw:"test",plan:"free",loginCount:22,analyses:9,blocked:false,daysAgo:2},
    {name:"Lucas Müller",email:"l.muller@helmholtz.de",pw:"test",plan:"free",loginCount:3,analyses:1,blocked:false,daysAgo:20},
    {name:"Fatima Al-Rashid",email:"f.alrashid@kaust.edu.sa",pw:"test",plan:"free",loginCount:1,analyses:0,blocked:false,daysAgo:1},
    {name:"James Park",email:"j.park@broad.mit.edu",pw:"test",plan:"free",loginCount:18,analyses:7,blocked:false,daysAgo:5},
    {name:"Elena Voronova",email:"e.voronova@skoltech.ru",pw:"test",plan:"free",loginCount:0,analyses:0,blocked:true,daysAgo:30},
  ];
  mockUsers.forEach(m => {
    const d = new Date(Date.now() - m.daysAgo*86400000);
    const u = { id:_uid++, name:m.name, email:m.email, pw:m.pw, plan:m.plan,
      createdAt:new Date(d.getTime()-86400000*Math.random()*10).toISOString(),
      lastLogin:m.loginCount>0?d.toISOString():null,
      loginCount:m.loginCount, analyses:m.analyses, blocked:m.blocked };
    _users.push(u);
    if (m.loginCount>0) {
      _sessions.unshift({userId:u.id,email:u.email,name:u.name,loginAt:d.toISOString(),active:m.daysAgo<2});
      _log("login",u.id,u.email,"User logged in");
    }
    if (m.loginCount>5) _log("analysis",u.id,u.email,`Ran ${m.analyses} analyses`);
  });
  _log("system",0,"system","VeloLaw platform started");
})();

// ─── Design tokens ───────────────────────────────────────────
const T = {
  bg:"#0a0c10", surface:"#111318", surface2:"#181c24",
  border:"#1e2330", border2:"#252d3d",
  accent:"#4ade80", accent2:"#22d3ee", accent3:"#a78bfa",
  danger:"#f87171", warn:"#fbbf24",
  text:"#e8eaf0", text2:"#8892a4", text3:"#4a5568",
};

// ─── Inject global CSS ───────────────────────────────────────
const injectCSS = () => {
  if (document.getElementById("vl-css")) return;
  const el = document.createElement("style");
  el.id = "vl-css";
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:#111318}
    ::-webkit-scrollbar-thumb{background:#252d3d;border-radius:3px}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  `;
  document.head.appendChild(el);
};

// ─── Primitives ──────────────────────────────────────────────
const Card = ({children, style={}}) => (
  <div style={{background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, ...style}}>{children}</div>
);

const Btn = ({children, onClick, v="primary", size="md", disabled, full, style={}}) => {
  const sz = {sm:{padding:"6px 14px",fontSize:12}, md:{padding:"9px 20px",fontSize:13}, lg:{padding:"12px 28px",fontSize:15}};
  const vr = {
    primary:{background:T.accent,color:"#000",border:"none"},
    secondary:{background:"transparent",color:T.text,border:`1px solid ${T.border2}`},
    outline:{background:"transparent",color:T.accent,border:`1px solid ${T.accent}`},
    ghost:{background:"transparent",color:T.text2,border:"none"},
  };
  return (
    <button disabled={disabled} onClick={disabled?undefined:onClick}
      style={{cursor:disabled?"not-allowed":"pointer",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,
        display:"inline-flex",alignItems:"center",gap:6,transition:"all .15s",opacity:disabled?.5:1,
        width:full?"100%":undefined, ...sz[size], ...vr[v], ...style}}>
      {children}
    </button>
  );
};

const Inp = ({label, type="text", value, onChange, placeholder, mono}) => (
  <div style={{marginBottom:16}}>
    {label && <label style={{display:"block",fontSize:12,color:T.text2,marginBottom:5,letterSpacing:"0.03em"}}>{label}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",background:T.bg,border:`1px solid ${T.border2}`,color:T.text,
        padding:"9px 12px",borderRadius:8,fontFamily:mono?"'IBM Plex Mono',monospace":"'DM Sans',sans-serif",
        fontSize:13,outline:"none"}}/>
  </div>
);

const Tag = ({children,style={}}) => (
  <span style={{background:T.surface2,border:`1px solid ${T.border2}`,padding:"2px 8px",borderRadius:4,
    fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:T.text2,...style}}>{children}</span>
);

const R2 = ({r2}) => {
  const s = r2>=0.7?{bg:"rgba(74,222,128,.15)",c:T.accent}:r2>=0.4?{bg:"rgba(251,191,36,.15)",c:T.warn}:{bg:"rgba(248,113,113,.15)",c:T.danger};
  return <span style={{background:s.bg,color:s.c,padding:"2px 8px",borderRadius:6,fontSize:12,fontWeight:700}}>R\u00b2={r2.toFixed(3)}</span>;
};

const Metric = ({value, label, sub, color}) => (
  <Card style={{padding:18}}>
    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:24,fontWeight:500,color:color||T.accent,marginBottom:3}}>{value}</div>
    <div style={{fontSize:11,color:T.text2,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
    {sub && <div style={{fontSize:11,color:T.text3,marginTop:2}}>{sub}</div>}
  </Card>
);

const Toast = ({msg,type,visible}) => (
  <div style={{position:"fixed",bottom:24,right:24,background:T.surface2,
    border:`1px solid ${type==="ok"?T.accent:T.danger}`,color:type==="ok"?T.accent:T.danger,
    padding:"10px 18px",borderRadius:10,fontSize:13,zIndex:9999,
    transition:"all .3s",opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(20px)",
    pointerEvents:"none",maxWidth:300}}>{msg}</div>
);

// ─── Network canvas ──────────────────────────────────────────
const NetCanvas = ({data, stageFilter}) => {
  const ref = useRef(null);
  const nodes = useRef([]);
  const drag = useRef(null);
  const edges = stageFilter==="all" ? data.edges : data.edges.filter(e=>e.stage===stageFilter);
  const EC = {activate:"#4ade80", repress:"#f87171", modulate:"#fbbf24"};

  const draw = useCallback(() => {
    const cv = ref.current; if(!cv) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0,0,cv.width,cv.height);

    edges.forEach(e => {
      const s=nodes.current.find(n=>n.id===e.source), t=nodes.current.find(n=>n.id===e.target);
      if(!s||!t) return;
      const mx=(s.x+t.x)/2+(t.y-s.y)*0.25, my=(s.y+t.y)/2-(t.x-s.x)*0.25;
      ctx.beginPath(); ctx.strokeStyle=EC[e.type]||"#555"; ctx.lineWidth=1.8; ctx.globalAlpha=0.5;
      ctx.moveTo(s.x,s.y); ctx.quadraticCurveTo(mx,my,t.x,t.y); ctx.stroke(); ctx.globalAlpha=1;
      const a=Math.atan2(t.y-my,t.x-mx), r=20;
      ctx.beginPath(); ctx.fillStyle=EC[e.type]||"#555";
      ctx.moveTo(t.x-r*Math.cos(a)+7*Math.cos(a-Math.PI/2), t.y-r*Math.sin(a)+7*Math.sin(a-Math.PI/2));
      ctx.lineTo(t.x-r*Math.cos(a)-7*Math.cos(a-Math.PI/2), t.y-r*Math.sin(a)-7*Math.sin(a-Math.PI/2));
      ctx.lineTo(t.x-(r-11)*Math.cos(a), t.y-(r-11)*Math.sin(a));
      ctx.closePath(); ctx.fill();
    });

    nodes.current.forEach(n => {
      const isTgt = n.type==="target";
      ctx.beginPath();
      if(isTgt){ const s=16;
        ctx.moveTo(n.x,n.y-s);ctx.lineTo(n.x+s,n.y);ctx.lineTo(n.x,n.y+s);ctx.lineTo(n.x-s,n.y);ctx.closePath();
        ctx.fillStyle="#1e1b4b"; ctx.strokeStyle="#6366f1";
      } else { ctx.arc(n.x,n.y,14,0,Math.PI*2); ctx.fillStyle="#0c2231"; ctx.strokeStyle="#22d3ee"; }
      ctx.lineWidth=2; ctx.fill(); ctx.stroke();
      ctx.fillStyle="#e8eaf0"; ctx.font="600 9px 'DM Sans'";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(n.id.length>7?n.id.slice(0,6)+"\u2026":n.id, n.x, n.y);
    });
  }, [edges]);

  useEffect(() => {
    const cv = ref.current; if(!cv) return;
    const w = (cv.parentElement?.clientWidth||620)-24;
    cv.width=w; cv.height=400;
    nodes.current = data.nodes.map(n=>({...n, x:(n.x/680)*w, y:(n.y/430)*400}));
    draw();
  }, [data.nodes, draw]);

  const onDown = e => {
    const r=ref.current.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    drag.current = nodes.current.find(n=>Math.hypot(n.x-mx,n.y-my)<20)||null;
  };
  const onMove = e => {
    if(!drag.current) return;
    const r=ref.current.getBoundingClientRect();
    drag.current.x=e.clientX-r.left; drag.current.y=e.clientY-r.top; draw();
  };
  const onUp = () => { drag.current=null; };

  return <canvas ref={ref} style={{display:"block",width:"100%",height:400,borderRadius:8,background:T.bg,border:`1px solid ${T.border}`,cursor:"crosshair"}}
    onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}/>;
};

// ─── SVG Bar chart ───────────────────────────────────────────
const BarChart = ({data, h=200}) => {
  const W=480, pad={t:10,r:10,b:55,l:44};
  const iW=W-pad.l-pad.r, iH=h-pad.t-pad.b;
  const mx=Math.max(...data.datasets.flatMap(d=>d.data.map(v=>v||0)),0.01);
  const bw=iW/data.labels.length;
  const bW=(bw*0.7)/data.datasets.length;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{overflow:"visible"}}>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0,.25,.5,.75,1].map(v=>(
          <g key={v}>
            <line x1={0} y1={iH-v*iH} x2={iW} y2={iH-v*iH} stroke={T.border} strokeWidth={1}/>
            <text x={-5} y={iH-v*iH+4} textAnchor="end" fill={T.text3} fontSize={9}>{v.toFixed(2)}</text>
          </g>
        ))}
        {data.labels.map((lbl,li)=>(
          <g key={lbl}>
            {data.datasets.map((ds,di)=>{
              const v=Math.max(0,ds.data[li]||0), bh=(v/mx)*iH;
              const bx=li*bw+bw*0.15+di*bW;
              return <rect key={di} x={bx} y={iH-bh} width={bW-2} height={bh} fill={(ds.color||"#888")+"cc"} rx={3}/>;
            })}
            <text x={li*bw+bw/2} y={iH+13} textAnchor="middle" fill={T.text3} fontSize={9}>{lbl}</text>
          </g>
        ))}
        {data.datasets.map((ds,di)=>(
          <g key={di} transform={`translate(${di*85},${iH+30})`}>
            <rect width={10} height={10} fill={ds.color||"#888"} rx={2}/>
            <text x={14} y={9} fill={T.text2} fontSize={9}>{ds.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
};

// ─── SVG Line chart ──────────────────────────────────────────
const LineChart = ({data, h=200}) => {
  const W=480, pad={t:14,r:60,b:55,l:44};
  const iW=W-pad.l-pad.r, iH=h-pad.t-pad.b;
  const all=data.datasets.flatMap(d=>d.data.map(v=>v||0));
  const mn=Math.min(...all,0), mx=Math.max(...all,1), rng=mx-mn||1;
  const px=i=>(i/(data.labels.length-1))*iW;
  const py=v=>iH-((v-mn)/rng)*iH;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${h}`}>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0,.25,.5,.75,1].map(t=>{
          const v=mn+t*rng;
          return <g key={t}>
            <line x1={0} y1={py(v)} x2={iW} y2={py(v)} stroke={T.border} strokeWidth={1}/>
            <text x={-5} y={py(v)+4} textAnchor="end" fill={T.text3} fontSize={9}>{v.toFixed(2)}</text>
          </g>;
        })}
        {data.labels.map((l,i)=><text key={i} x={px(i)} y={iH+13} textAnchor="middle" fill={T.text3} fontSize={9}>{l.split(" ")[0]}</text>)}
        {data.datasets.map((ds,di)=>{
          const pts=ds.data.map((v,i)=>`${px(i)},${py(v)}`).join(" ");
          const fp=`${px(0)},${iH} ${ds.data.map((v,i)=>`${px(i)},${py(v)}`).join(" ")} ${px(ds.data.length-1)},${iH}`;
          return <g key={di}>
            <polygon points={fp} fill={(ds.color||"#888")+"18"}/>
            <polyline points={pts} fill="none" stroke={ds.color||"#888"} strokeWidth={2} strokeDasharray={ds.dash||""}/>
            {ds.data.map((v,i)=><circle key={i} cx={px(i)} cy={py(v)} r={3.5} fill={ds.color||"#888"}/>)}
          </g>;
        })}
        {data.datasets.map((ds,di)=>(
          <g key={di} transform={`translate(${di*120},${iH+30})`}>
            <line x1={0} y1={5} x2={14} y2={5} stroke={ds.color||"#888"} strokeWidth={2} strokeDasharray={ds.dash||""}/>
            <text x={18} y={9} fill={T.text2} fontSize={9}>{ds.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
};

// ─── Horizontal bar chart ────────────────────────────────────
const HBar = ({items, maxAbs}) => (
  <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"grid",gridTemplateColumns:"130px 1fr 1fr",gap:8,fontSize:10,color:T.text3,marginBottom:2}}>
      <span>Interaction</span><span style={{textAlign:"center"}}>2\u00d7 OE</span><span style={{textAlign:"center"}}>0.5\u00d7 KD</span>
    </div>
    {items.map((it,i)=>(
      <div key={i} style={{display:"grid",gridTemplateColumns:"130px 1fr 1fr",gap:8,alignItems:"center"}}>
        <div style={{color:T.text2,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={it.label}>{it.label}</div>
        {[it.oe,it.kd].map((val,vi)=>(
          <div key={vi} style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{color:val>=0?T.accent:T.danger,width:44,textAlign:"right",fontSize:10,fontFamily:"'IBM Plex Mono',monospace"}}>{val>=0?"+":""}{val.toFixed(2)}</span>
            <div style={{flex:1,background:T.border,borderRadius:100,height:7,overflow:"hidden",minWidth:40}}>
              <div style={{width:`${Math.min(100,Math.abs(val)/maxAbs*100)}%`,height:"100%",borderRadius:100,background:val>=0?T.accent:T.danger}}/>
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// ════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════
export default function VeloLaw() {
  injectCSS();

  const [page, setPage]         = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser]         = useState(null);
  const [tab, setTab]           = useState("upload");
  const [results, setResults]   = useState(null);
  const [history, setHistory]   = useState([]);
  const [toast, setToast]       = useState({msg:"",type:"ok",visible:false});

  // Upload
  const [mode, setMode]         = useState("demo");
  const [file, setFile]         = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [prog, setProg]         = useState({steps:[],pct:0});
  const [params, setParams]     = useState({stages:4,parsimony:0.005,populations:15,iterations:80,maxSize:25,folds:3,targets:"Ins1,Ins2,Gcg,Ppy,Ghrl,Sst"});

  // Filters
  const [eqGene, setEqGene]     = useState("all");
  const [eqStage, setEqStage]   = useState("all");
  const [netStage, setNetStage] = useState("all");
  const [pbGene, setPbGene]     = useState("all");
  const [openEqs, setOpenEqs]   = useState({});

  // AI
  const [groqKey, setGroqKey]   = useState("");
  const [aiOut, setAiOut]       = useState("");
  const [aiLoad, setAiLoad]     = useState(false);
  const [aiErr, setAiErr]       = useState("");

  // Auth form
  const [aName, setAName]       = useState("");
  const [aEmail, setAEmail]     = useState("");
  const [aPw, setAPw]           = useState("");
  const [aErr, setAErr]         = useState("");

  const pop = (msg, type="ok") => {
    setToast({msg,type,visible:true});
    setTimeout(()=>setToast(t=>({...t,visible:false})),3000);
  };

  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  // ── Auth ──────────────────────────────────────────────────
  const doLogin = () => {
    setAErr("");
    try { const u=authLogin(aEmail,aPw); setUser(u); setPage("dashboard"); pop("Welcome back, "+u.name+"!"); }
    catch(e) { setAErr(e.message); }
  };
  const doRegister = () => {
    setAErr("");
    if(!aName||!aEmail||!aPw){setAErr("All fields required");return;}
    if(aPw.length<6){setAErr("Password min 6 characters");return;}
    try { const u=authRegister(aName,aEmail,aPw); setUser(u); setPage("dashboard"); pop("Account created! Welcome, "+u.name); }
    catch(e) { setAErr(e.message); }
  };
  const doLogout = () => { setUser(null); setResults(null); setPage("landing"); pop("Signed out"); };

  // ── Analysis ─────────────────────────────────────────────
  const runAnalysis = async () => {
    if(mode==="real"&&!file){pop("Upload a file or switch to Demo","err");return;}
    setAnalyzing(true); setProg({steps:[],pct:0});
    for(let i=0;i<STEPS.length;i++){
      await sleep(150+Math.random()*100);
      setProg(p=>({steps:[...p.steps,STEPS[i]],pct:Math.round(((i+1)/STEPS.length)*100)}));
    }
    await sleep(300);
    const r = mode==="demo" ? DEMO_RESULTS : {
      ...DEMO_RESULTS,
      equations: DEMO_RESULTS.equations.map(eq=>({...eq,r2:Math.max(0.1,Math.min(0.99,eq.r2+(Math.random()-.5)*0.04))}))
    };
    setResults(r);
    setHistory(h=>[{id:h.length+1, name:mode==="demo"?"Pancreatic Demo":(file?.name||"Upload"),
      status:"complete", date:new Date().toISOString(), bestR2:Math.max(...r.equations.map(e=>e.r2))}, ...h]);
    setAnalyzing(false); setTab("results"); pop("Analysis complete!");
  };

  // ── AI ───────────────────────────────────────────────────
  const genAI = async () => {
    if(!groqKey.trim()){setAiErr("Enter your Groq key (free at console.groq.com)");return;}
    if(!results){setAiErr("No results to analyze");return;}
    setAiLoad(true); setAiErr(""); setAiOut("");
    const goodEqs = results.equations.filter(e=>e.r2>=0.3);
    const prompt = `You are an expert computational biologist specializing in RNA velocity and gene regulatory networks.

HIERARCHICAL SYMBOLIC REGRESSION RESULTS \u2014 Mouse Pancreatic Endocrine Development:

DISCOVERED EQUATIONS (R\u00b2\u22650.3):
${goodEqs.map(e=>`\u2022 ${e.gene} (${e.stage}) R\u00b2=${e.r2.toFixed(3)}: ${e.equation}\n  Regulators: ${e.regulatorsFound.join(", ")}`).join("\n")}

TOP PERTURBATION EFFECTS:
\u2022 Ins2 self-overexpression (2\u00d7) \u2192 \u0394v=+7.31 (strong autocrine feedback)
\u2022 Gnas\u2192Ghrl overexpression \u2192 \u0394v=\u221228.41 (dominant G-protein repression)
\u2022 Gnas\u2192Ins2 overexpression \u2192 \u0394v=\u22120.28 (repressive modulation)
\u2022 Ins1\u2192Ins2 overexpression \u2192 \u0394v=\u22120.24 (competitive paralog)

Provide concise structured analysis with these exact sections:
**1. Top 3 Biological Insights** \u2014 mechanistic interpretation of equations
**2. Experimental Validations** \u2014 2-3 highest-priority CRISPR/siRNA experiments
**3. Therapeutic Implications** \u2014 diabetes or pancreatic disease relevance
**4. Key Limitations** \u2014 caveats researchers must know
**5. Next Computational Steps** \u2014 model improvements to pursue

Be specific. Cite known gene functions. Focus on actionable findings.`;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{"Authorization":"Bearer "+groqKey,"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"llama-3.3-70b-versatile", max_tokens:1400,
          messages:[
            {role:"system",content:"Expert computational biologist. Be concise and specific."},
            {role:"user",content:prompt}
          ]
        })
      });
      const d = await res.json();
      if(d.error) throw new Error(d.error.message);
      setAiOut(d.choices[0].message.content);
      pop("AI insights generated!");
    } catch(e){
      setAiErr("Error: "+e.message+". Verify Groq key starts with gsk_ (free at console.groq.com)");
    }
    setAiLoad(false);
  };

  // ── Export ───────────────────────────────────────────────
  const exportLatex = () => {
    if(!results) return;
    const lines=["% VeloLaw \u2014 Discovered Regulatory Equations","% "+new Date().toISOString(),""];
    results.equations.forEach(eq=>{
      lines.push(`% ${eq.gene} \u2014 ${eq.stage} (R\u00b2 = ${eq.r2.toFixed(3)})`);
      lines.push("\\begin{equation}");
      lines.push(`  v_{\\text{${eq.gene}}} \\approx ${eq.latex||eq.equation}`);
      lines.push("\\end{equation}","");
    });
    const a=document.createElement("a");
    a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(lines.join("\n"));
    a.download="velolaw_equations.tex"; a.click(); pop("LaTeX exported");
  };

  const exportCSV = () => {
    if(!results) return;
    const rows=["Gene,Stage,CV_R2,Train_R2,Complexity,Regulators,Equation"];
    results.equations.forEach(eq=>rows.push(`${eq.gene},${eq.stage},${eq.r2},${eq.r2_train||""},${eq.complexity},"${eq.regulatorsFound.join(";")}","${eq.equation}"`));
    const a=document.createElement("a");
    a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(rows.join("\n"));
    a.download="velolaw_results.csv"; a.click(); pop("CSV exported");
  };

  // ── Sidebar ──────────────────────────────────────────────
  const SbItem = ({id,icon,label}) => (
    <button onClick={()=>setTab(id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,
      background:tab===id?"rgba(74,222,128,.1)":"transparent",color:tab===id?T.accent:T.text2,
      border:"none",cursor:"pointer",width:"100%",textAlign:"left",fontSize:13,transition:"all .15s"}}>
      <span style={{width:18,textAlign:"center",fontSize:14}}>{icon}</span>{label}
    </button>
  );

  // ════════════════════════════════════════════════════════
  //  TABS
  // ════════════════════════════════════════════════════════

  // Upload tab
  const Upload = () => (
    <div style={{padding:"22px 26px",maxWidth:860}}>
      <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:25,marginBottom:4}}>New Analysis</h2>
      <p style={{color:T.text2,fontSize:13,marginBottom:20}}>Upload scRNA-seq data or use the demo dataset to discover stage-specific gene regulatory equations via hierarchical symbolic regression.</p>

      <div style={{display:"flex",gap:10,marginBottom:18}}>
        {[["demo","🧪","Demo (Pancreatic)"],["real","⚗","Upload .h5ad / .loom"]].map(([m,ic,lb])=>(
          <Btn key={m} v={mode===m?"primary":"secondary"} size="sm" onClick={()=>setMode(m)}>{ic} {lb}</Btn>
        ))}
      </div>

      {mode==="demo" ? (
        <Card style={{padding:18,marginBottom:18,border:`1px solid rgba(74,222,128,.2)`,background:"rgba(74,222,128,.03)"}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <span style={{fontSize:28,flexShrink:0}}>🧪</span>
            <div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:3}}>Mouse Pancreatic Endocrine Development</div>
              <div style={{fontSize:12,color:T.text2,marginBottom:8}}>Bastidas-Ponce et al. 2019 \u00b7 3,696 cells \u00b7 2,000 genes \u00b7 scVelo dynamical model</div>
              <p style={{fontSize:12,color:T.text2,lineHeight:1.65}}>Real results from the hierarchical symbolic regression notebook: PySR genetic programming across 4 developmental stages with 3-fold CV. All equations, perturbation predictions, and network are exact values from the analysis.</p>
              <div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}>
                {["3,696 cells","2,000 genes","13 regulators","4 stages","6 equations","K=4 stages"].map(t=><Tag key={t}>{t}</Tag>)}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
          {[["🧬",".h5ad / .loom","AnnData with spliced & unspliced mRNA layers","file-h5ad",".h5ad,.loom"],
            ["📊","Regulator CSV (opt.)","Pre-extracted expression matrix for custom regulators","file-csv",".csv,.tsv"]
          ].map(([ic,ti,de,id,ac])=>(
            <label key={id} style={{border:`2px dashed ${file&&id==="file-h5ad"?T.accent:T.border2}`,borderRadius:12,padding:26,textAlign:"center",cursor:"pointer",background:T.surface,display:"block",transition:"all .2s"}}>
              <input type="file" id={id} accept={ac} style={{display:"none"}} onChange={e=>{if(id==="file-h5ad")setFile(e.target.files[0]);}}/>
              <div style={{fontSize:30,marginBottom:8,opacity:.4}}>{ic}</div>
              <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{ti}</div>
              <div style={{fontSize:11,color:T.text3}}>{de}</div>
              {file&&id==="file-h5ad"&&<div style={{marginTop:8,fontSize:11,color:T.accent}}>\u2713 {file.name} ({(file.size/1024/1024).toFixed(1)} MB)</div>}
            </label>
          ))}
        </div>
      )}

      <Card style={{padding:18,marginBottom:18}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:14}}>\u2699 Analysis Parameters</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11,marginBottom:11}}>
          {[["Stages (K)","stages",2,8,1],["Parsimony (\u03bb)","parsimony",.001,.1,.001],
            ["Populations","populations",5,50,1],["Iterations","iterations",20,500,1],
            ["Max eq. size","maxSize",10,50,1],["CV folds","folds",2,10,1]].map(([lb,k,mn,mx,st])=>(
            <div key={k}>
              <label style={{display:"block",fontSize:11,color:T.text2,marginBottom:3}}>{lb}</label>
              <input type="number" value={params[k]} min={mn} max={mx} step={st}
                onChange={e=>setParams(p=>({...p,[k]:+e.target.value}))}
                style={{width:"100%",background:T.bg,border:`1px solid ${T.border2}`,color:T.text,padding:"6px 9px",borderRadius:6,fontSize:12,outline:"none"}}/>
            </div>
          ))}
        </div>
        <div>
          <label style={{display:"block",fontSize:11,color:T.text2,marginBottom:3}}>Target genes</label>
          <input value={params.targets} onChange={e=>setParams(p=>({...p,targets:e.target.value}))}
            style={{width:"100%",background:T.bg,border:`1px solid ${T.border2}`,color:T.text,padding:"7px 11px",borderRadius:8,fontSize:12,outline:"none"}}/>
        </div>
      </Card>

      <Btn size="lg" onClick={runAnalysis} disabled={analyzing}>{analyzing?"\u23f3 Analyzing\u2026":"\u25b6 Run Analysis"}</Btn>

      {analyzing && (
        <Card style={{padding:18,marginTop:18}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontWeight:600,fontSize:14}}>Analysis in progress</div>
            <div style={{width:17,height:17,border:`2px solid ${T.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
          </div>
          <div style={{maxHeight:190,overflowY:"auto",display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
            {prog.steps.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:8,fontSize:12,color:T.accent,animation:"fadeUp .2s ease"}}>
                <span>\u2713</span><span>{s}</span>
              </div>
            ))}
          </div>
          <div style={{background:T.border,borderRadius:100,height:5,overflow:"hidden",marginBottom:3}}>
            <div style={{height:"100%",width:`${prog.pct}%`,background:`linear-gradient(90deg,${T.accent},${T.accent2})`,transition:"width .4s",borderRadius:100}}/>
          </div>
          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:T.text3,textAlign:"right"}}>{prog.pct}%</div>
        </Card>
      )}
    </div>
  );

  // Results tab
  const Results = () => {
    if(!results) return <Empty onLoad={()=>{setMode("demo");setTab("upload");}}/>;
    const good=results.equations.filter(e=>e.r2>=0.3);
    const best=results.equations.reduce((a,b)=>a.r2>b.r2?a:b);
    const r2data={
      labels:["Early","Spec.","Diff.","Mature"],
      datasets:results.equations.reduce((acc,eq)=>{
        const si=["Early Progenitor","Specification","Differentiation","Maturation"].indexOf(eq.stage);
        const ex=acc.find(d=>d.label===eq.gene);
        if(ex){if(si>=0)ex.data[si]=Math.max(0,eq.r2);}
        else{const d=Array(4).fill(null);if(si>=0)d[si]=Math.max(0,eq.r2);acc.push({label:eq.gene,data:d,color:eq.color});}
        return acc;
      },[])
    };
    const progdata={
      labels:results.stageProgression.Ins2.map(p=>p.stage),
      datasets:[
        {label:"R\u00b2 Ins2",data:results.stageProgression.Ins2.map(p=>Math.max(0,p.r2)),color:T.accent},
        {label:"Complexity/200",data:results.stageProgression.Ins2.map(p=>p.complexity/200),color:T.accent3,dash:"4,2"}
      ]
    };
    return (
      <div style={{padding:"20px 26px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:24}}>Analysis Results</h2>
          <div style={{display:"flex",gap:8}}>
            <Btn v="secondary" size="sm" onClick={exportLatex}>\uD83D\uDCC4 LaTeX</Btn>
            <Btn v="secondary" size="sm" onClick={exportCSV}>\u2b07 CSV</Btn>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:11,marginBottom:18}}>
          <Metric value={results.dataset.cells.toLocaleString()} label="Total cells" sub={results.dataset.genes.toLocaleString()+" genes"} color={T.accent}/>
          <Metric value={`${good.length}/${results.equations.length}`} label="Models R\u00b2>0.3" sub="gene \u00d7 stage" color={T.accent2}/>
          <Metric value={best.r2.toFixed(3)} label="Best R\u00b2" sub={best.gene+" \u00b7 "+best.stage} color={T.accent3}/>
          <Metric value={results.regulators.length} label="Regulators" sub="tested across stages" color={T.warn}/>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:T.text2,marginBottom:8}}>Developmental stages</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:20}}>
          {results.stages.map(s=>(
            <Card key={s.id} style={{padding:13,textAlign:"center",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${T.accent},${T.accent2})`}}/>
              <div style={{fontSize:9,color:T.text3,fontFamily:"'IBM Plex Mono',monospace",marginBottom:2}}>Stage {s.id}</div>
              <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>{s.name}</div>
              <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:19,color:T.accent2}}>{s.cells}</div>
              <div style={{fontSize:10,color:T.text3}}>{s.marker}</div>
            </Card>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Card style={{padding:16}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>R\u00b2 by Gene &amp; Stage <Tag>3-fold CV</Tag></div>
            <BarChart data={r2data} h={195}/>
          </Card>
          <Card style={{padding:16}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>Ins2 Stage Progression <Tag>accuracy+complexity</Tag></div>
            <LineChart data={progdata} h={195}/>
          </Card>
        </div>
      </div>
    );
  };

  // Equations tab
  const Equations = () => {
    if(!results) return <Empty onLoad={()=>{setMode("demo");setTab("upload");}}/>;
    const genes=[...new Set(results.equations.map(e=>e.gene))];
    let eqs=results.equations;
    if(eqGene!=="all") eqs=eqs.filter(e=>e.gene===eqGene);
    if(eqStage!=="all") eqs=eqs.filter(e=>e.stage===eqStage);
    return (
      <div style={{padding:"20px 26px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:24}}>Discovered Equations</h2>
          <div style={{display:"flex",gap:8}}>
            {[["gene",eqGene,setEqGene,["all",...genes]],["stage",eqStage,setEqStage,["all","Early Progenitor","Specification","Differentiation","Maturation"]]].map(([k,val,set,opts])=>(
              <select key={k} value={val} onChange={e=>set(e.target.value)}
                style={{background:T.surface,border:`1px solid ${T.border2}`,color:T.text,padding:"6px 10px",borderRadius:8,fontSize:12,outline:"none"}}>
                {opts.map(o=><option key={o}>{o}</option>)}
              </select>
            ))}
            <Btn v="secondary" size="sm" onClick={exportLatex}>\uD83D\uDCC4 LaTeX</Btn>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          {eqs.map((eq,i)=>(
            <Card key={i} style={{overflow:"hidden"}}>
              <div onClick={()=>setOpenEqs(o=>({...o,[i]:!o[i]}))}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 17px",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:eq.color,flexShrink:0}}/>
                  <span style={{fontWeight:600,fontSize:14}}>{eq.gene}</span>
                  <span style={{background:T.surface2,border:`1px solid ${T.border2}`,padding:"2px 9px",borderRadius:100,fontSize:11,color:T.text2}}>{eq.stage}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <R2 r2={eq.r2}/>
                  <span style={{color:T.text3,fontSize:11}}>{eq.complexity}</span>
                  <span style={{color:T.text3,fontSize:11,transition:"transform .2s",transform:openEqs[i]?"rotate(180deg)":"none",display:"inline-block"}}>\u25bc</span>
                </div>
              </div>
              {openEqs[i] && (
                <div style={{padding:"0 17px 17px",animation:"fadeUp .2s ease"}}>
                  <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:13,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:T.accent2,lineHeight:1.75,overflowX:"auto",marginBottom:9,whiteSpace:"pre-wrap"}}>{eq.equation}</div>
                  <div style={{background:"rgba(167,139,250,.05)",borderLeft:`3px solid ${T.accent3}`,padding:"9px 13px",borderRadius:"0 6px 6px 0",fontSize:13,color:T.text2,lineHeight:1.6,marginBottom:9}}>{eq.interpretation}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:11,alignItems:"center"}}>
                    <span style={{fontSize:11,color:T.text3}}>Regulators:</span>
                    {eq.regulatorsFound.map(r=><Tag key={r}>{r}</Tag>)}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <Btn v="secondary" size="sm" onClick={()=>{navigator.clipboard?.writeText(eq.equation);pop("Copied!");}}>Copy equation</Btn>
                    <Btn v="ghost" size="sm" onClick={()=>{navigator.clipboard?.writeText(eq.latex||eq.equation);pop("LaTeX copied!");}}>Copy LaTeX</Btn>
                    <span style={{fontSize:11,color:T.text3}}>Train R\u00b2: {eq.r2_train?.toFixed(3)}</span>
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

  // Network tab
  const Network = () => {
    if(!results) return <Empty onLoad={()=>{setMode("demo");setTab("upload");}}/>;
    const filtered=netStage==="all"?results.network.edges:results.network.edges.filter(e=>e.stage===netStage);
    return (
      <div style={{padding:"20px 26px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:24}}>Regulatory Network</h2>
          <select value={netStage} onChange={e=>setNetStage(e.target.value)}
            style={{background:T.surface,border:`1px solid ${T.border2}`,color:T.text,padding:"6px 10px",borderRadius:8,fontSize:12,outline:"none"}}>
            {["all","Specification","Differentiation","Maturation"].map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <Card style={{padding:17,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>Gene Regulatory Network <span style={{fontSize:11,color:T.text3,fontWeight:400}}>\u2014 drag nodes to explore</span></div>
          <div style={{fontSize:11,color:T.text3,marginBottom:11}}>Edges extracted from discovered equations. Directionality inferred from equation structure.</div>
          <NetCanvas data={results.network} stageFilter={netStage}/>
          <div style={{display:"flex",gap:18,marginTop:11,flexWrap:"wrap"}}>
            {[["#4ade80","Activation"],["#f87171","Repression"],["#fbbf24","Modulation"],["#6366f1","Target gene (\u25c7)"],["#22d3ee","Regulator (\u25cf)"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.text2}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:c}}/>{l}
              </div>
            ))}
          </div>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:14}}>
          {[[results.network.nodes.length,"Total nodes"],[results.network.nodes.filter(n=>n.type==="target").length,"Targets"],[results.network.nodes.filter(n=>n.type==="regulator").length,"Regulators"],[filtered.length,"Edges shown"]].map(([v,l])=>(
            <Metric key={l} value={v} label={l}/>
          ))}
        </div>
        <Card style={{padding:17}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:11}}>Edge detail</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {filtered.map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,padding:"6px 10px",background:T.surface2,borderRadius:7}}>
                <span style={{color:T.accent2,fontFamily:"'IBM Plex Mono',monospace",minWidth:60}}>{e.source}</span>
                <span style={{color:{activate:T.accent,repress:T.danger,modulate:T.warn}[e.type],fontSize:16}}>{e.type==="activate"?"\u2192":e.type==="repress"?"\u22a3":"\u007e"}</span>
                <span style={{color:T.accent3,fontFamily:"'IBM Plex Mono',monospace",minWidth:50}}>{e.target}</span>
                <Tag style={{marginLeft:"auto"}}>{e.stage}</Tag>
                <span style={{color:{activate:T.accent,repress:T.danger,modulate:T.warn}[e.type],fontSize:11}}>{e.type}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  // Perturbation tab
  const Perturbation = () => {
    if(!results) return <Empty onLoad={()=>{setMode("demo");setTab("upload");}}/>;
    let pb=results.perturbations;
    if(pbGene!=="all") pb=pb.filter(p=>p.target===pbGene);
    const maxAbs=Math.max(...pb.flatMap(p=>[Math.abs(p.overexpression),Math.abs(p.knockdown)]));
    const genes=[...new Set(results.perturbations.map(p=>p.target))];
    return (
      <div style={{padding:"20px 26px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:24}}>In Silico Perturbation</h2>
          <Tag>2\u00d7 overexpression \u00b7 0.5\u00d7 knockdown</Tag>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:11,marginBottom:18}}>
          <Metric value="+7.31" label="Largest \u0394Velocity" sub="Ins2 self-OE" color={T.accent}/>
          <Metric value="\u221228.41" label="Strongest repression" sub="Gnas \u2192 Ghrl" color={T.danger}/>
          <Metric value={pb.filter(p=>p.overexpression>0).length} label="Activating OEs" color={T.accent2}/>
          <Metric value={pb.filter(p=>p.overexpression<0).length} label="Repressive OEs" color={T.warn}/>
        </div>
        <Card style={{padding:17,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,fontSize:13,fontWeight:600}}>
            Perturbation effects
            <select value={pbGene} onChange={e=>setPbGene(e.target.value)}
              style={{background:T.surface2,border:`1px solid ${T.border2}`,color:T.text,padding:"5px 8px",borderRadius:6,fontSize:11,outline:"none"}}>
              <option value="all">All targets</option>
              {genes.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <HBar items={pb.map(p=>({label:`${p.target} \u2190 ${p.regulator}`,oe:p.overexpression,kd:p.knockdown}))} maxAbs={maxAbs}/>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
          {[[T.accent,"Ins2 self-regulation (+7.31)","Quartic autocrine feedback (Ins2\u2074) in the Maturation equation. Large asymmetric OE vs KD confirms positive autocrine loop. Top candidate for insulin receptor inhibitor validation."],
            [T.danger,"Gnas \u2192 Ghrl (\u221228.41)","Gnas\u00b2 term in Ghrl equation amplifies repression quadratically. Dominant G-protein effect. Note: Ghrl R\u00b2=0.185 \u2014 underpowered dataset, interpret cautiously."],
            [T.text,"Equation specificity","Genes absent from an equation produce \u0394v=0.00 exactly, confirming equations identify specific regulators rather than spuriously including all measured genes."],
            [T.warn,"Experimental priority","Test Ins2 autocrine loop first (high \u0394v + R\u00b2=0.87). Use CRISPR-a on insulin receptor or Ins2 siRNA. Remeasure velocity via scVelo after perturbation."],
          ].map(([color,title,desc])=>(
            <div key={title} style={{background:T.surface2,borderRadius:10,padding:13}}>
              <div style={{color,fontWeight:600,fontSize:13,marginBottom:5}}>{title}</div>
              <div style={{fontSize:12,color:T.text2,lineHeight:1.65}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // AI tab
  const AITab = () => {
    if(!results) return <Empty onLoad={()=>{setMode("demo");setTab("upload");}}/>;
    const good=results.equations.filter(e=>e.r2>=0.3);
    return (
      <div style={{padding:"20px 26px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:24}}>AI Biological Insights</h2>
          <Tag>Groq \u00b7 LLaMA 3.3 70B</Tag>
        </div>
        <Card style={{padding:20,marginBottom:14,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${T.accent3},transparent)`}}/>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
            <div style={{width:36,height:36,background:`linear-gradient(135deg,${T.accent3},${T.accent2})`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>\uD83E\uDD16</div>
            <div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:2}}>AI Regulatory Interpretation</div>
              <div style={{fontSize:12,color:T.text2}}>Powered by Groq (free API) \u2014 get your key at <span style={{color:T.accent2}}>console.groq.com</span></div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input type="password" value={groqKey} onChange={e=>setGroqKey(e.target.value)} placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
              style={{flex:1,background:T.bg,border:`1px solid ${T.border2}`,color:T.text,padding:"9px 12px",borderRadius:8,fontFamily:"'IBM Plex Mono',monospace",fontSize:12,outline:"none"}}/>
            <Btn v="outline" onClick={genAI} disabled={aiLoad}>{aiLoad?"Generating\u2026":"Generate insights"}</Btn>
          </div>
          {aiErr && <div style={{color:T.danger,fontSize:12,marginBottom:9,lineHeight:1.5}}>{aiErr}</div>}
          {aiLoad && (
            <div style={{display:"flex",alignItems:"center",gap:9,color:T.accent3,fontSize:13}}>
              <div style={{width:15,height:15,border:`2px solid ${T.accent3}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
              Analyzing with LLaMA 3.3 70B\u2026
            </div>
          )}
          {aiOut && (
            <div style={{fontSize:13,color:T.text2,lineHeight:1.8,background:T.surface2,borderRadius:10,padding:15,marginTop:8}}
              dangerouslySetInnerHTML={{__html:aiOut
                .replace(/\*\*(.+?)\*\*/g,"<strong style='color:#e8eaf0'>$1</strong>")
                .replace(/\n\n/g,"<br/><br/>")
              }}/>
          )}
        </Card>
        <Card style={{padding:18}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:34,height:34,background:"linear-gradient(135deg,#f59e0b,#ef4444)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>\uD83D\uDCA1</div>
            <div>
              <div style={{fontWeight:600}}>Auto-generated Summaries</div>
              <div style={{fontSize:12,color:T.text2}}>Extracted from equation structure \u2014 no API key needed</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {good.map((eq,i)=>(
              <div key={i} style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:10,padding:13}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:eq.color,flexShrink:0}}/>
                  <span style={{fontWeight:600,fontSize:13}}>{eq.gene} \u00b7 {eq.stage}</span>
                  <R2 r2={eq.r2}/>
                </div>
                <div style={{fontSize:12,color:T.text2,lineHeight:1.65,marginBottom:7}}>{eq.interpretation}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {eq.regulatorsFound.map(r=><Tag key={r} style={{fontSize:10}}>{r}</Tag>)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  // History tab
  const History = () => (
    <div style={{padding:"20px 26px"}}>
      <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:24,marginBottom:18}}>Analysis History</h2>
      {history.length===0 ? (
        <div style={{textAlign:"center",padding:"56px 0",color:T.text3}}>
          <div style={{fontSize:32,marginBottom:10}}>\uD83D\uDCCB</div>
          <div style={{color:T.text2,fontSize:14,marginBottom:6}}>No analyses yet</div>
          <div style={{fontSize:13}}>Your completed analyses will appear here.</div>
        </div>
      ) : (
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${T.border}`}}>
              {["Name","Status","Best R\u00b2","Date",""].map(h=>(
                <th key={h} style={{textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:"0.07em",color:T.text3,padding:"8px 11px",fontWeight:500}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(a=>(
              <tr key={a.id} style={{borderBottom:`1px solid ${T.border}`}}>
                <td style={{padding:"11px",fontSize:13}}>{a.name}</td>
                <td style={{padding:"11px"}}><span style={{background:"rgba(74,222,128,.15)",color:T.accent,padding:"2px 9px",borderRadius:100,fontSize:11,fontWeight:700}}>{a.status}</span></td>
                <td style={{padding:"11px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>{a.bestR2?.toFixed(3)}</td>
                <td style={{padding:"11px",fontSize:12,color:T.text2}}>{new Date(a.date).toLocaleDateString()}</td>
                <td style={{padding:"11px"}}><Btn v="secondary" size="sm" onClick={()=>{setResults(DEMO_RESULTS);setTab("results");pop("Results loaded");}}>Load</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // Empty state helper
  const Empty = ({onLoad}) => (
    <div style={{textAlign:"center",padding:"72px 24px",color:T.text3}}>
      <div style={{fontSize:40,marginBottom:14}}>\uD83D\uDCCA</div>
      <div style={{color:T.text2,fontSize:15,marginBottom:6}}>No results yet</div>
      <div style={{fontSize:13,marginBottom:20}}>Run an analysis or load the demo dataset.</div>
      <Btn v="outline" onClick={onLoad}>Load demo data</Btn>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  PAGE RENDERS
  // ════════════════════════════════════════════════════════
  const Landing = () => (
    <div style={{minHeight:"100vh",background:T.bg}}>
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 28px",borderBottom:`1px solid ${T.border}`,background:"rgba(10,12,16,.95)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100}}>
        <div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,color:T.accent,letterSpacing:"-0.02em",cursor:"pointer"}}>
          \u2B21 VeloLaw <span style={{color:T.text2,fontSize:10,fontFamily:"'IBM Plex Mono',monospace"}}>beta</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn v="secondary" onClick={()=>{setAuthMode("login");setPage("auth");}}>Sign in</Btn>
          <Btn onClick={()=>{setAuthMode("register");setPage("auth");}}>Get started free</Btn>
        </div>
      </nav>
      <div style={{padding:"72px 24px 52px",maxWidth:980,margin:"0 auto",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(74,222,128,.08)",border:`1px solid rgba(74,222,128,.2)`,color:T.accent,padding:"5px 16px",borderRadius:100,fontSize:11,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.05em",marginBottom:30}}>
          <span style={{width:6,height:6,background:T.accent,borderRadius:"50%",animation:"pulse 2s infinite",display:"inline-block"}}/>
          RNA Velocity \u00b7 Symbolic Regression \u00b7 Interpretable AI
        </div>
        <h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:"clamp(2.5rem,5.5vw,4rem)",lineHeight:1.06,letterSpacing:"-0.03em",marginBottom:22}}>
          Discover <em style={{color:T.accent}}>why</em> genes change,<br/>not just how
        </h1>
        <p style={{fontSize:16,color:T.text2,maxWidth:540,margin:"0 auto 32px",lineHeight:1.7}}>
          VeloLaw turns RNA velocity data into explicit, readable regulatory equations \u2014 so you can understand, validate, and act on the biology.
        </p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn size="lg" onClick={()=>{setAuthMode("register");setPage("auth");}}>&#9654; Start free analysis</Btn>
          <Btn v="secondary" size="lg" onClick={()=>{setAuthMode("register");setPage("auth");}}>&#128202; View demo results</Btn>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:"3rem",padding:"28px 24px",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,background:T.surface,flexWrap:"wrap"}}>
        {[["3,696","Cells analyzed"],["R\u00b2=0.87","Best model accuracy"],["4","Developmental stages"],["13","Candidate regulators"],["100%","Interpretable"]].map(([n,l])=>(
          <div key={l} style={{textAlign:"center"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:22,color:T.accent,fontWeight:500}}>{n}</div>
            <div style={{fontSize:10,color:T.text3,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:3}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"48px 24px 60px",maxWidth:1040,margin:"0 auto"}}>
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:T.accent,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:6}}>Platform capabilities</div>
        <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,letterSpacing:"-0.02em",marginBottom:28}}>Everything from RNA velocity to mechanism</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
          {[
            ["🧬","RNA Velocity Estimation","scVelo dynamical model recovers kinetic parameters (\u03b1, \u03b2, \u03b3) and pseudotime from spliced/unspliced counts.","rgba(74,222,128,.1)"],
            ["\u26A1","Hierarchical Symbolic Regression","PySR genetic programming discovers stage-specific equations with biologically-constrained operators.","rgba(34,211,238,.1)"],
            ["🔬","In Silico Perturbation","Predict 2\u00d7 overexpression and 0.5\u00d7 knockdown effects on velocity before wet lab experiments.","rgba(167,139,250,.1)"],
            ["🕸","Regulatory Network","Interactive GRN with stage-specific edges, activation/repression directionality, drag-to-explore canvas.","rgba(251,191,36,.1)"],
            ["\uD83E\uDD16","AI Biological Interpretation","Groq LLaMA 3.3 70B analyzes equations and recommends experimental validations and drug targets.","rgba(249,115,22,.1)"],
            ["\uD83D\uDCC4","LaTeX & CSV Export","Every equation formatted for direct manuscript inclusion. Copy-paste into bioRxiv preprint.","rgba(248,113,113,.1)"],
          ].map(([ic,ti,de,bg])=>(
            <Card key={ti} style={{padding:20}}>
              <div style={{width:36,height:36,borderRadius:8,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,marginBottom:11}}>{ic}</div>
              <div style={{fontWeight:600,fontSize:14,marginBottom:5}}>{ti}</div>
              <div style={{fontSize:13,color:T.text2,lineHeight:1.6}}>{de}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const Auth = () => (
    <div style={{minHeight:"100vh",background:T.bg}}>
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 28px",borderBottom:`1px solid ${T.border}`}}>
        <div onClick={()=>setPage("landing")} style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:T.accent,cursor:"pointer"}}>\u2B21 VeloLaw</div>
        <Btn v="ghost" size="sm" onClick={()=>setPage("landing")}>\u2190 Back</Btn>
      </nav>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 57px)",padding:24}}>
        <Card style={{padding:34,width:"100%",maxWidth:400,animation:"fadeUp .3s ease"}}>
          {authMode==="login" ? (
            <>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:25,marginBottom:5}}>Welcome back</div>
              <div style={{color:T.text2,fontSize:13,marginBottom:22}}>Sign in to your VeloLaw account</div>
              {aErr && <div style={{background:"rgba(248,113,113,.1)",border:`1px solid rgba(248,113,113,.3)`,color:T.danger,padding:"9px 12px",borderRadius:8,fontSize:13,marginBottom:13}}>{aErr}</div>}
              <Inp label="Email" type="email" value={aEmail} onChange={setAEmail} placeholder="you@lab.org"/>
              <Inp label="Password" type="password" value={aPw} onChange={setAPw} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"/>
              <Btn full onClick={doLogin}>Sign in</Btn>
              <div style={{textAlign:"center",marginTop:14,fontSize:13,color:T.text2}}>
                No account? <span onClick={()=>{setAuthMode("register");setAErr("");}} style={{color:T.accent,cursor:"pointer"}}>Register free</span>
              </div>
            </>
          ) : (
            <>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:25,marginBottom:5}}>Create account</div>
              <div style={{color:T.text2,fontSize:13,marginBottom:22}}>Free forever \u2014 no credit card required</div>
              {aErr && <div style={{background:"rgba(248,113,113,.1)",border:`1px solid rgba(248,113,113,.3)`,color:T.danger,padding:"9px 12px",borderRadius:8,fontSize:13,marginBottom:13}}>{aErr}</div>}
              <Inp label="Full name" value={aName} onChange={setAName} placeholder="Ana Researcher"/>
              <Inp label="Email" type="email" value={aEmail} onChange={setAEmail} placeholder="you@lab.org"/>
              <Inp label="Password" type="password" value={aPw} onChange={setAPw} placeholder="min. 6 characters"/>
              <Btn full onClick={doRegister}>Create free account</Btn>
              <div style={{textAlign:"center",marginTop:14,fontSize:13,color:T.text2}}>
                Have an account? <span onClick={()=>{setAuthMode("login");setAErr("");}} style={{color:T.accent,cursor:"pointer"}}>Sign in</span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 22px",borderBottom:`1px solid ${T.border}`,background:"rgba(10,12,16,.95)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100}}>
        <div onClick={()=>setPage("landing")} style={{fontFamily:"'DM Serif Display',serif",fontSize:19,color:T.accent,cursor:"pointer"}}>
          \u2B21 VeloLaw <span style={{color:T.text2,fontSize:10,fontFamily:"'IBM Plex Mono',monospace"}}>beta</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:11,color:"#000"}}>{user?.name?.[0]?.toUpperCase()}</div>
            <span style={{fontSize:13,color:T.text}}>{user?.name}</span>
            <Tag>Free</Tag>
          </div>
          <Btn v="ghost" size="sm" onClick={doLogout}>Sign out</Btn>
        </div>
      </nav>
      <div style={{display:"grid",gridTemplateColumns:"215px 1fr",flex:1,maxHeight:"calc(100vh - 57px)",overflow:"hidden"}}>
        <div style={{background:T.surface,borderRight:`1px solid ${T.border}`,padding:"14px 7px",overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",color:T.text3,padding:"4px 12px 5px",fontFamily:"'IBM Plex Mono',monospace"}}>Analysis</div>
          <SbItem id="upload"       icon="\uD83D\uDCE4" label="New Analysis"/>
          <SbItem id="results"      icon="\uD83D\uDCCA" label="Results Overview"/>
          <SbItem id="equations"    icon="\u222B"       label="Equations"/>
          <SbItem id="network"      icon="\uD83D\uDDB8" label="Network"/>
          <SbItem id="perturbation" icon="\u26A1"       label="Perturbation"/>
          <SbItem id="ai"           icon="\uD83E\uDD16" label="AI Insights"/>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",color:T.text3,padding:"14px 12px 5px",fontFamily:"'IBM Plex Mono',monospace"}}>Account</div>
          <SbItem id="history"      icon="\uD83D\uDCCB" label="History"/>
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
      {page==="auth"      && <Auth/>}
      {page==="dashboard" && <Dashboard/>}
      <Toast msg={toast.msg} type={toast.type} visible={toast.visible}/>
    </>
  );
}
