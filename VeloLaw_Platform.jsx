import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://204.168.156.143:3000";

const DEMO_RESULTS = {
  dataset: { cells: 3696, genes: 2000, cellTypes: ["Ductal","EP","Pre-endocrine","Beta","Alpha","Delta"] },
  stages: [
    { id: 0, name: "Early Progenitor", cells: 924, marker: "High Neurog3" },
    { id: 1, name: "Specification",    cells: 924, marker: "Lineage commitment" },
    { id: 2, name: "Differentiation",  cells: 924, marker: "Cell-type markers" },
    { id: 3, name: "Maturation",       cells: 924, marker: "Mature hormones" },
  ],
  regulators: ["Hmgn3","Gnas","Pdx1","Neurog3","Pax6","Nkx6-1","Arx","Pax4","Iapp"],
  equations: [
    { gene:"Ins2", stage:"Specification", r2:0.333, complexity:112, color:"#f59e0b", equation:"v = (0.366 - (Neurog3 + Nkx6-1)...", interpretation:"Early β-cell spec.", regulatorsFound:["Neurog3","Nkx6-1","Hmgn3"] },
    { gene:"Ins2", stage:"Differentiation", r2:0.776, complexity:138, color:"#10b981", equation:"v = 0.00738*(Ins1 + Pdx1)^3...", interpretation:"Coordinated activation.", regulatorsFound:["Ins1","Pdx1","Iapp"] },
    { gene:"Ins2", stage:"Maturation", r2:0.870, complexity:187, color:"#6366f1", equation:"v = Ins2^4 * [...]", interpretation:"Mature β-cell feedback.", regulatorsFound:["Ins2","Gnas"] }
  ],
  perturbations: [
    { target:"Ins2", regulator:"Ins2", overexpression:7.31, knockdown:-0.54 },
    { target:"Ghrl", regulator:"Gnas", overexpression:-28.41, knockdown:7.30 }
  ],
  network: {
    nodes: [{id:"Ins2", type:"target", x:380, y:180}, {id:"Pdx1", type:"regulator", x:260, y:90}, {id:"Neurog3", type:"regulator", x:110, y:200}],
    edges: [{source:"Pdx1", target:"Ins2", type:"activate", stage:"Differentiation"}, {source:"Neurog3", target:"Ins2", type:"repress", stage:"Specification"}]
  },
  stageProgression: { Ins2: [
    { stage:"Early", r2:0.01, complexity:45 }, { stage:"Spec", r2:0.33, complexity:112 }, { stage:"Diff", r2:0.77, complexity:138 }, { stage:"Mature", r2:0.87, complexity:187 }
  ]}
};

const T = { bg:"#07090e", surface:"#0e1117", border:"#1e2636", border2:"#26334a", accent:"#4ade80", accent2:"#38bdf8", accent3:"#a78bfa", danger:"#f87171", warn:"#fbbf24", text:"#f0f2f8", text2:"#8fa3bf", text3:"#4a5e7a" };

const Card = ({children, style={}}) => <div style={{background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, ...style}}>{children}</div>;
const Btn = ({children, onClick, v="primary", disabled}) => (
  <button disabled={disabled} onClick={onClick} style={{padding:"10px 20px", borderRadius:8, fontWeight:600, cursor:"pointer", background:v==="primary"?T.accent:"#26334a", color:v==="primary"?"#000":T.text, border:"none", opacity:disabled?0.5:1}}>{children}</button>
);
const Metric = ({value, label, color}) => (
  <Card style={{padding:18}}><div style={{fontSize:22, fontWeight:700, color:color||T.accent}}>{value}</div><div style={{fontSize:11, color:T.text2, textTransform:"uppercase"}}>{label}</div></Card>
);
const Tag = ({children}) => <span style={{background:"#141820", border:`1px solid ${T.border2}`, padding:"2px 8px", borderRadius:4, fontSize:10, color:T.text2}}>{children}</span>;

const BarChart = ({data}) => (
  <svg width="100%" height="200" viewBox="0 0 400 200">
    {data.labels.map((l, i) => <text key={i} x={i*100 + 50} y="190" fill={T.text3} fontSize="10" textAnchor="middle">{l}</text>)}
    {data.datasets.map((ds, di) => ds.data.map((v, vi) => v && <rect key={`${di}-${vi}`} x={vi*100 + 35 + di*15} y={170 - v*150} width="10" height={v*150} fill={ds.color} rx="2"/>))}
  </svg>
);

export default function VeloLaw() {
  const [page, setPage] = useState("landing");
  const [tab, setTab] = useState("upload");
  const [results, setResults] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const runDemo = () => {
    setAnalyzing(true);
    setTimeout(() => { setResults(DEMO_RESULTS); setAnalyzing(false); setTab("results"); }, 1000);
  };

  const ResultsView = () => {
    if (!results) return <div style={{padding:40, textAlign:"center", color:T.text3}}>No results. Run analysis first.</div>;
    
    const r2data = {
      labels: ["Early", "Spec", "Diff", "Mature"],
      datasets: results.equations.reduce((acc, eq) => {
        const si = ["Early Progenitor", "Specification", "Differentiation", "Maturation"].indexOf(eq.stage);
        const ex = acc.find(d => d.label === eq.gene);
        if (ex) { if (si >= 0) ex.data[si] = eq.r2; }
        else { const d = Array(4).fill(null); if (si >= 0) d[si] = eq.r2; acc.push({ label: eq.gene, data: d, color: eq.color }); }
        return acc;
      }, [])
    };

    return (
      <div style={{padding:24}}>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20}}>
          <Metric value={results.dataset.cells} label="Cells"/>
          <Metric value={results.equations.length} label="Equations" color={T.accent2}/>
          <Metric value={results.regulators.length} label="Regulators" color={T.accent3}/>
          <Metric value="87%" label="Best Fit" color={T.warn}/>
        </div>
        <Card style={{padding:20}}><div style={{marginBottom:10, fontWeight:600}}>Model Fit per Stage</div><BarChart data={r2data}/></Card>
        <div style={{marginTop:20, display:"flex", flexDirection:"column", gap:10}}>
          {results.equations.map((eq, i) => (
            <Card key={i} style={{padding:15}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
                <span style={{fontWeight:700}}>{eq.gene} <Tag>{eq.stage}</Tag></span>
                <span style={{color:T.accent}}>R²: {eq.r2}</span>
              </div>
              <code style={{display:"block", background:"#000", padding:10, borderRadius:6, color:T.accent2, fontSize:12}}>{eq.equation}</code>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{background:T.bg, color:T.text, minHeight:"100vh", fontFamily:"sans-serif"}}>
      {page === "landing" ? (
        <div style={{textAlign:"center", padding:"100px 20px"}}>
          <h1 style={{fontSize:48}}>VeloLaw Platform</h1>
          <p style={{color:T.text2, marginBottom:30}}>Hierarchical Symbolic Regression for RNA Velocity</p>
          <Btn onClick={() => setPage("dashboard")}>Launch App</Btn>
        </div>
      ) : (
        <div style={{display:"grid", gridTemplateColumns:"220px 1fr", minHeight:"100vh"}}>
          <div style={{background:T.surface, borderRight:`1px solid ${T.border}`, padding:20, display:"flex", flexDirection:"column", gap:10}}>
            <div style={{fontWeight:800, color:T.accent, marginBottom:20}}>⬡ VeloLaw</div>
            <button onClick={() => setTab("upload")} style={{textAlign:"left", background:"none", border:"none", color:tab==="upload"?T.accent:T.text, cursor:"pointer"}}>New Analysis</button>
            <button onClick={() => setTab("results")} style={{textAlign:"left", background:"none", border:"none", color:tab==="results"?T.accent:T.text, cursor:"pointer"}}>Results</button>
          </div>
          <div>
            {tab === "upload" && (
              <div style={{padding:40, maxWidth:600}}>
                <h2>Upload Data</h2>
                <Card style={{padding:30, textAlign:"center", borderStyle:"dashed", marginBottom:20}}>
                  <p>Select .h5ad or .loom file</p>
                  <Btn v="secondary" onClick={runDemo} disabled={analyzing}>{analyzing ? "Processing..." : "Run Demo (Pancreas)"}</Btn>
                </Card>
              </div>
            )}
            {tab === "results" && <ResultsView/>}
          </div>
        </div>
      )}
    </div>
  );
}
