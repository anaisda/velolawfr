import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://204.168.156.143:3000";

const T = {
  bg:"#08090d", surface:"#0e1117", surface2:"#141820",
  border:"#1a2030", border2:"#212940",
  accent:"#4ade80", accent2:"#22d3ee", accent3:"#a78bfa",
  warn:"#fbbf24", danger:"#f87171",
  text:"#e2e8f0", text2:"#7a8599", text3:"#3a4560",
};

const EVENT_META = {
  login:            { color:"#4ade80", icon:"\u2192", label:"Login"         },
  logout:           { color:"#7a8599", icon:"\u2190", label:"Logout"        },
  register:         { color:"#22d3ee", icon:"+",      label:"Register"      },
  analysis:         { color:"#a78bfa", icon:"\u26af", label:"Analysis"      },
  analysis_done:    { color:"#a78bfa", icon:"\u2713", label:"Done"          },
  failed_login:     { color:"#f87171", icon:"\u2715", label:"Failed login"  },
  suspend:          { color:"#f87171", icon:"\u2298", label:"Suspend"       },
  reactivate:       { color:"#4ade80", icon:"\u21ba", label:"Reactivate"    },
  plan_change:      { color:"#fbbf24", icon:"\u2605", label:"Plan change"   },
  delete:           { color:"#f87171", icon:"\ud83d\uddd1", label:"Delete"  },
  admin_login:      { color:"#fbbf24", icon:"\ud83d\udd11", label:"Admin"   },
  admin_failed:     { color:"#f87171", icon:"\u2715", label:"Admin failed"  },
  session_terminate:{ color:"#fbbf24", icon:"\u2298", label:"Kill session"  },
};

function em(type) { return EVENT_META[type] || { color:"#7a8599", icon:"\u00b7", label:type }; }

function timeAgo(iso) {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60)   return Math.floor(s)+"s ago";
  if (s < 3600) return Math.floor(s/60)+"m ago";
  if (s < 86400)return Math.floor(s/3600)+"h ago";
  return Math.floor(s/86400)+"d ago";
}
function fmtDate(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
}
function fmtTime(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
}

function useApi(adminToken) {
  const h = useCallback(() => ({ "Content-Type":"application/json", "x-admin-token":adminToken||"" }), [adminToken]);
  const get  = useCallback(async p => { const r=await fetch(API_BASE+p,{headers:h()}); if(!r.ok)throw new Error((await r.json()).error||r.statusText); return r.json(); }, [adminToken]);
  const post = useCallback(async (p,b) => { const r=await fetch(API_BASE+p,{method:"POST",headers:h(),body:JSON.stringify(b)}); if(!r.ok)throw new Error((await r.json()).error||r.statusText); return r.json(); }, [adminToken]);
  const patch= useCallback(async (p,b) => { const r=await fetch(API_BASE+p,{method:"PATCH",headers:h(),body:JSON.stringify(b)}); if(!r.ok)throw new Error((await r.json()).error||r.statusText); return r.json(); }, [adminToken]);
  const del  = useCallback(async p => { const r=await fetch(API_BASE+p,{method:"DELETE",headers:h()}); if(!r.ok)throw new Error((await r.json()).error||r.statusText); return r.json(); }, [adminToken]);
  return { get, post, patch, del };
}

const Card = ({children,style={},glow}) => (
  <div style={{background:T.surface,border:`1px solid ${glow?glow+"35":T.border}`,borderRadius:14,boxShadow:glow?`0 0 20px ${glow}10`:"none",...style}}>{children}</div>
);

const Btn = ({children,onClick,v="primary",size="md",disabled,full,style={}}) => {
  const sz={sm:{padding:"5px 13px",fontSize:12},md:{padding:"8px 18px",fontSize:13},lg:{padding:"11px 26px",fontSize:14}};
  const vr={primary:{background:T.accent,color:"#000",border:"none"},danger:{background:"#dc2626",color:"#fff",border:"none"},secondary:{background:"transparent",color:T.text,border:`1px solid ${T.border2}`},ghost:{background:"transparent",color:T.text2,border:"none"},outline:{background:"transparent",color:T.accent,border:`1px solid ${T.accent}55`},warn:{background:"#d97706",color:"#fff",border:"none"}};
  return <button disabled={disabled} onClick={disabled?undefined:onClick} style={{cursor:disabled?"not-allowed":"pointer",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"all .15s",opacity:disabled?.5:1,width:full?"100%":undefined,justifyContent:full?"center":undefined,...sz[size],...vr[v],...style}}>{children}</button>;
};

const Badge = ({children,color}) => (
  <span style={{background:color+"18",color,padding:"2px 9px",borderRadius:100,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
);

const Dot = ({active}) => (
  <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:active?T.accent:T.text3,boxShadow:active?`0 0 6px ${T.accent}`:undefined}}/>
);

const Spin = () => (
  <div style={{width:17,height:17,border:`2px solid ${T.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
);

const Empty = ({icon,title,sub}) => (
  <div style={{textAlign:"center",padding:"56px 20px",color:T.text3}}>
    <div style={{fontSize:38,marginBottom:10}}>{icon}</div>
    <div style={{color:T.text2,fontSize:15,fontWeight:600,marginBottom:4}}>{title}</div>
    {sub&&<div style={{fontSize:13}}>{sub}</div>}
  </div>
);

const MiniBar = ({data=[],color,h=52,w=260}) => {
  const mx=Math.max(...data,1), bw=w/Math.max(data.length,1);
  return (
    <svg width={w} height={h} style={{display:"block"}}>
      {data.map((v,i)=>{const bh=Math.max(2,(v/mx)*(h-4));return <rect key={i} x={i*bw+1} y={h-bh} width={bw-2} height={bh} fill={color+"99"} rx={2}/>;})  }
    </svg>
  );
};

const Confirm = ({msg,onOk,onCancel}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
    <Card style={{padding:28,maxWidth:340,width:"100%",textAlign:"center",animation:"fadeUp .2s ease"}}>
      <div style={{fontSize:28,marginBottom:11}}>\u26a0\ufe0f</div>
      <div style={{fontWeight:600,fontSize:16,marginBottom:8}}>{msg}</div>
      <div style={{fontSize:13,color:T.text2,marginBottom:20}}>This cannot be undone.</div>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}>
        <Btn v="secondary" onClick={onCancel}>Cancel</Btn>
        <Btn v="danger" onClick={onOk}>Confirm</Btn>
      </div>
    </Card>
  </div>
);

const UserModal = ({userId,api,onClose,onRefresh}) => {
  const [data,setData]=useState(null), [load,setLoad]=useState(true), [err,setErr]=useState(""), [confirm,setConfirm]=useState(null), [msg,setMsg]=useState("");
  const pop=m=>{setMsg(m);setTimeout(()=>setMsg(""),2500);};
  const fetch_=useCallback(async()=>{setLoad(true);setErr("");try{setData(await api.get(`/api/admin/users/${userId}`));}catch(e){setErr(e.message);}setLoad(false);},[userId]);
  useEffect(()=>{fetch_();},[fetch_]);

  const setStatus=async s=>{try{await api.patch(`/api/admin/users/${data.id}/status`,{status:s});pop(s==="suspended"?"User suspended":"Reactivated");await fetch_();onRefresh();}catch(e){pop("Error: "+e.message);}setConfirm(null);};
  const setPlan=async p=>{try{await api.patch(`/api/admin/users/${data.id}/plan`,{plan:p});pop("Plan changed to "+p);await fetch_();onRefresh();}catch(e){pop("Error: "+e.message);}};
  const doDelete=async()=>{try{await api.del(`/api/admin/users/${data.id}`);onRefresh();onClose();}catch(e){pop("Error: "+e.message);}setConfirm(null);};
  const killSess=async id=>{try{await api.del(`/api/admin/sessions/${id}`);pop("Session terminated");await fetch_();}catch(e){pop("Error: "+e.message);}};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:640,background:T.surface,border:`1px solid ${T.border2}`,borderRadius:18,maxHeight:"90vh",overflowY:"auto",animation:"fadeUp .2s ease"}}>
        {load?<div style={{padding:60,display:"flex",justifyContent:"center"}}><Spin/></div>
        :err?<div style={{padding:40,textAlign:"center",color:T.danger}}>{err}<br/><br/><Btn v="secondary" onClick={onClose}>Close</Btn></div>
        :<>
          <div style={{padding:"20px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:42,height:42,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:17,color:"#000",flexShrink:0}}>{data.name[0]}</div>
              <div><div style={{fontWeight:600,fontSize:15}}>{data.name}</div><div style={{fontSize:12,color:T.text2,fontFamily:"'IBM Plex Mono',monospace"}}>{data.email}</div></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Badge color={data.status==="active"?T.accent:T.danger}>{data.status}</Badge>
              <Badge color={data.plan==="pro"?T.accent3:"#f97316" }>{data.plan}</Badge>
              <button onClick={onClose} style={{background:"transparent",border:"none",color:T.text2,cursor:"pointer",fontSize:22,lineHeight:1}}>x</button>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)"}}>
            {[["Logins",data.loginCount,T.accent],["Analyses",data.analysisCount,T.accent2],["Active sessions",data.sessions?.filter(s=>s.active).length||0,T.accent3],["Joined",fmtDate(data.createdAt),T.text2]].map(([l,v,c],i)=>(
              <div key={l} style={{padding:"13px 16px",borderRight:i<3?`1px solid ${T.border}`:"none",borderBottom:`1px solid ${T.border}`}}>
                <div style={{fontSize:10,color:T.text3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3,fontFamily:"'IBM Plex Mono',monospace"}}>{l}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:18,color:c}}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{padding:"13px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:T.text2,marginRight:6}}>Plan:</span>
            {["free","pro","enterprise"].map(p=><Btn key={p} size="sm" v={data.plan===p?"primary":"secondary"} onClick={()=>setPlan(p)}>{p}</Btn>)}
            <span style={{marginLeft:"auto",fontSize:11,color:T.text3,fontFamily:"'IBM Plex Mono',monospace"}}>Last IP: {data.lastIp||"\u2014"}</span>
          </div>

          <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontSize:11,color:T.text2,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9,fontFamily:"'IBM Plex Mono',monospace"}}>Sessions</div>
            {!data.sessions?.length?<div style={{fontSize:13,color:T.text3}}>No sessions.</div>:data.sessions.map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:9,fontSize:12,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                <Dot active={s.active}/><span style={{flex:1}}>{s.userAgent}</span>
                <span style={{color:T.text3,fontFamily:"'IBM Plex Mono',monospace",fontSize:11}}>{s.ip}</span>
                <span style={{color:T.text2}}>{timeAgo(s.loginAt)}</span>
                {s.active&&<><Badge color={T.accent}>live</Badge><Btn v="danger" size="sm" onClick={()=>killSess(s.id)}>Kill</Btn></>}
              </div>
            ))}
          </div>

          <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontSize:11,color:T.text2,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9,fontFamily:"'IBM Plex Mono',monospace"}}>Recent Activity</div>
            {!data.events?.length?<div style={{fontSize:13,color:T.text3}}>No activity yet.</div>:data.events.slice(0,8).map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:9,fontSize:12,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                <span style={{width:21,height:21,borderRadius:"50%",background:em(e.type).color+"20",color:em(e.type).color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0,fontWeight:700}}>{em(e.type).icon}</span>
                <span style={{flex:1,color:T.text}}>{e.detail}</span>
                <span style={{color:T.text3,whiteSpace:"nowrap"}}>{timeAgo(e.at)}</span>
              </div>
            ))}
          </div>

          {data.analyses?.length>0&&(
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
              <div style={{fontSize:11,color:T.text2,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9,fontFamily:"'IBM Plex Mono',monospace"}}>Analyses ({data.analyses.length})</div>
              {data.analyses.map(a=>(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:9,fontSize:12,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                  <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
                  <Badge color={a.status==="complete"?T.accent:T.warn}>{a.status}</Badge>
                  <span style={{color:T.text3,whiteSpace:"nowrap"}}>{timeAgo(a.createdAt)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{padding:"14px 20px",display:"flex",gap:9}}>
            <Btn v={data.status==="suspended"?"outline":"secondary"} size="sm" onClick={()=>setConfirm({msg:`${data.status==="suspended"?"Reactivate":"Suspend"} ${data.name}?`,action:()=>setStatus(data.status==="suspended"?"active":"suspended")})}>
              {data.status==="suspended"?"Reactivate":"Suspend"}
            </Btn>
            <Btn v="danger" size="sm" onClick={()=>setConfirm({msg:`Delete ${data.name}?`,action:doDelete})}>Delete user</Btn>
          </div>
        </>}
        {msg&&<div style={{position:"sticky",bottom:10,textAlign:"center"}}><span style={{background:T.surface2,border:`1px solid ${T.border2}`,color:T.text,padding:"8px 16px",borderRadius:8,fontSize:13}}>{msg}</span></div>}
      </div>
      {confirm&&<Confirm msg={confirm.msg} onOk={confirm.action} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
};

export default function AdminPanel() {
  const [token,setToken]    = useState(()=>sessionStorage.getItem("vl_adm")||"");
  const [email,setEmail]    = useState(""), [pw,setPw]=useState(""), [loginErr,setLoginErr]=useState(""), [loginLoad,setLoginLoad]=useState(false);
  const [tab,setTab]        = useState("overview");
  const [toast,setToast]    = useState({msg:"",type:"ok",v:false});
  const [confirm,setConfirm]= useState(null);
  const [modalId,setModalId]= useState(null);

  const [stats,setStats]       = useState(null);
  const [users,setUsers]       = useState([]);
  const [sessions,setSessions] = useState([]);
  const [events,setEvents]     = useState([]);
  const [loading,setLoading]   = useState({stats:false,users:false,sessions:false,events:false});
  const [errs,setErrs]         = useState({});
  const [search,setSearch]     = useState("");
  const [tick,setTick]         = useState(0);

  const api = useApi(token);

  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=`
      @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#08090d;color:#e2e8f0;font-family:'DM Sans',sans-serif}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:#0e1117}
      ::-webkit-scrollbar-thumb{background:#212940;border-radius:4px}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      tr:hover td{background:#ffffff05!important}
    `;
    document.head.appendChild(el);
    return()=>document.head.removeChild(el);
  },[]);

  useEffect(()=>{ if(token)sessionStorage.setItem("vl_adm",token); else sessionStorage.removeItem("vl_adm"); },[token]);
  useEffect(()=>{ if(!token)return; const t=setInterval(()=>setTick(n=>n+1),30000); return()=>clearInterval(t); },[token]);
  useEffect(()=>{ if(!token)return; loadAll(); },[token,tick]);

  const pop=(msg,type="ok")=>{ setToast({msg,type,v:true}); setTimeout(()=>setToast(t=>({...t,v:false})),3000); };

  const loadStats=async()=>{ setLoading(l=>({...l,stats:true})); try{setStats(await api.get("/api/admin/stats")); setErrs(e=>({...e,stats:null}));}catch(e){setErrs(er=>({...er,stats:e.message}));} setLoading(l=>({...l,stats:false})); };
  const loadUsers=async()=>{ setLoading(l=>({...l,users:true})); try{setUsers(await api.get("/api/admin/users")); setErrs(e=>({...e,users:null}));}catch(e){setErrs(er=>({...er,users:e.message}));} setLoading(l=>({...l,users:false})); };
  const loadSessions=async()=>{ setLoading(l=>({...l,sessions:true})); try{setSessions(await api.get("/api/admin/sessions")); setErrs(e=>({...e,sessions:null}));}catch(e){setErrs(er=>({...er,sessions:e.message}));} setLoading(l=>({...l,sessions:false})); };
  const loadEvents=async()=>{ setLoading(l=>({...l,events:true})); try{setEvents(await api.get("/api/admin/events?limit=150")); setErrs(e=>({...e,events:null}));}catch(e){setErrs(er=>({...er,events:e.message}));} setLoading(l=>({...l,events:false})); };
  const loadAll=()=>{ loadStats(); loadUsers(); loadSessions(); loadEvents(); };
  const refresh=()=>{ loadAll(); pop("Refreshed"); };

  const doLogin=async()=>{ setLoginErr(""); setLoginLoad(true); try{ const r=await fetch(API_BASE+"/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})}); const j=await r.json(); if(!r.ok)throw new Error(j.error||"Login failed"); setToken(j.token); }catch(e){ setLoginErr(e.message); } setLoginLoad(false); };

  const setUserStatus=async(id,status)=>{ try{ await api.patch(`/api/admin/users/${id}/status`,{status}); pop(status==="suspended"?"User suspended":"Reactivated"); loadAll(); }catch(e){pop("Error: "+e.message,"err");} setConfirm(null); };
  const killSession=async id=>{ try{ await api.del(`/api/admin/sessions/${id}`); pop("Session terminated"); loadSessions(); }catch(e){pop("Error: "+e.message,"err");} };

  const filtered=users.filter(u=>u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase()));

  // LOGIN
  if (!token) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:380,animation:"fadeUp .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:34}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:30,color:T.accent,marginBottom:4}}>\u2B21 VeloLaw</div>
          <div style={{fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:T.text3,letterSpacing:"0.15em",textTransform:"uppercase"}}>Admin Console</div>
        </div>
        <Card style={{padding:30}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:3}}>Sign in to admin</div>
          <div style={{fontSize:13,color:T.text2,marginBottom:20}}>Restricted to platform administrators</div>
          {loginErr&&<div style={{background:"rgba(248,113,113,.1)",border:`1px solid rgba(248,113,113,.25)`,color:T.danger,padding:"9px 12px",borderRadius:8,fontSize:13,marginBottom:13}}>{loginErr}</div>}
          {[["Email","email",email,setEmail,"anais@velolaw.io"],["Password","password",pw,setPw,"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"]].map(([lbl,type,val,set,ph])=>(
            <div key={lbl} style={{marginBottom:13}}>
              <label style={{display:"block",fontSize:11,color:T.text2,marginBottom:5,letterSpacing:"0.04em",textTransform:"uppercase"}}>{lbl}</label>
              <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                onKeyDown={e=>e.key==="Enter"&&doLogin()}
                style={{width:"100%",background:T.bg,border:`1px solid ${T.border2}`,color:T.text,padding:"9px 12px",borderRadius:8,fontSize:13,outline:"none",fontFamily:"'DM Sans',sans-serif"}}/>
            </div>
          ))}
          <Btn full onClick={doLogin} disabled={loginLoad} style={{marginTop:4}}>{loginLoad?<><Spin/>Signing in\u2026</>:"Enter Admin Console \u2192"}</Btn>
          <div style={{marginTop:14,padding:"10px 12px",background:T.surface2,borderRadius:8,fontSize:11,color:T.text3,fontFamily:"'IBM Plex Mono',monospace",lineHeight:1.8}}>
            Credentials set in server.js env vars:<br/>ADMIN_EMAIL / ADMIN_PASSWORD
          </div>
        </Card>
      </div>
    </div>
  );

  const onlineCount = sessions.filter(s=>s.active).length;

  // TABS
  const Overview = () => (
    <div style={{padding:"22px 26px",animation:"fadeUp .3s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:T.accent,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>Real-time</div>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:26,letterSpacing:"-0.02em"}}>Platform Overview</h2>
        </div>
        <Btn v="secondary" size="sm" onClick={refresh}>\u27f3 Refresh</Btn>
      </div>

      {errs.stats&&<div style={{background:"rgba(248,113,113,.1)",color:T.danger,padding:"12px 16px",borderRadius:10,marginBottom:16,fontSize:13,lineHeight:1.6}}>
        Cannot reach backend at <strong>{API_BASE}</strong><br/>
        Make sure your server is running: <code style={{fontFamily:"'IBM Plex Mono',monospace"}}>node server.js</code>
      </div>}

      {!stats&&loading.stats?<div style={{display:"flex",justifyContent:"center",padding:60}}><Spin/></div>:stats&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
            {[
              {l:"Total Users",    v:stats.totalUsers,     sub:`+${stats.newToday} today`, c:T.accent,  d:stats.dailySignups},
              {l:"Active Sessions",v:stats.activeSessions, sub:"online now",                c:T.accent2, d:null},
              {l:"Analyses Run",   v:stats.totalAnalyses,  sub:"all time",                  c:T.accent3, d:stats.dailyAnalyses},
            ].map(x=>(
              <Card key={x.l} style={{padding:20}} glow={x.c}>
                <div style={{fontSize:10,color:T.text3,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5,fontFamily:"'IBM Plex Mono',monospace"}}>{x.l}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:34,fontWeight:500,color:x.c,lineHeight:1,marginBottom:4}}>{x.v}</div>
                <div style={{fontSize:11,color:T.text2,marginBottom:x.d?12:0}}>{x.sub}</div>
                {x.d&&<MiniBar data={x.d} color={x.c} h={40} w={220}/>}
              </Card>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18}}>
            {[[stats.totalLogins,"Total Logins",T.warn],[stats.activeUsers,"Active Users",T.accent],[stats.suspendedUsers,"Suspended",T.danger]].map(([v,l,c])=>(
              <Card key={l} style={{padding:16}}>
                <div style={{fontSize:10,color:T.text3,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4,fontFamily:"'IBM Plex Mono',monospace"}}>{l}</div>
                <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:26,color:c}}>{v}</div>
              </Card>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18}}>
            {[["Daily Logins",stats.dailyLogins,T.accent2],["New Signups",stats.dailySignups,T.accent]].map(([l,d,c])=>(
              <Card key={l} style={{padding:18}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:3}}>{l} \u2014 last 14 days</div>
                <div style={{fontSize:11,color:T.text3,marginBottom:12}}>Total: {d?.reduce((a,b)=>a+b,0)||0}</div>
                <MiniBar data={d||[]} color={c} h={52} w={280}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.text3,marginTop:5,fontFamily:"'IBM Plex Mono',monospace"}}><span>14d ago</span><span>today</span></div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Card style={{padding:20,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600}}>Active Sessions</div>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:T.accent}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:T.accent,display:"inline-block"}}/>
            {onlineCount} online
          </div>
        </div>
        {sessions.filter(s=>s.active).length===0?(
          <Empty icon="\ud83d\udca4" title="No active sessions" sub="Nobody is currently online"/>
        ):sessions.filter(s=>s.active).map(s=>(
          <div key={s.id} style={{display:"flex",alignItems:"center",gap:11,padding:"9px 12px",background:T.surface2,borderRadius:9,marginBottom:6}}>
            <Dot active/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{s.name}</div><div style={{fontSize:11,color:T.text2}}>{s.email}</div></div>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:T.text3}}>{s.ip}</div><div style={{fontSize:11,color:T.text2}}>{s.userAgent}</div></div>
            <div style={{fontSize:11,color:T.text2,whiteSpace:"nowrap"}}>{timeAgo(s.loginAt)}</div>
            <Btn v="danger" size="sm" onClick={()=>setConfirm({msg:`Kill ${s.name}'s session?`,action:()=>killSession(s.id)})}>Kill</Btn>
          </div>
        ))}
      </Card>

      <Card style={{padding:20}}>
        <div style={{fontSize:13,fontWeight:600,marginBottom:14,display:"flex",alignItems:"center",gap:10}}>Live Activity {loading.events&&<Spin/>}</div>
        {events.length===0?(
          <Empty icon="\ud83d\udccb" title="No events yet" sub="Activity will appear as users interact with the platform"/>
        ):events.slice(0,12).map((e,i)=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:11,padding:"8px 0",borderBottom:i<11?`1px solid ${T.border}`:"none"}}>
            <span style={{width:26,height:26,borderRadius:"50%",background:em(e.type).color+"20",color:em(e.type).color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0,fontWeight:700}}>{em(e.type).icon}</span>
            <div style={{flex:1,minWidth:0}}><span style={{fontSize:13,fontWeight:500}}>{e.email}</span><span style={{fontSize:12,color:T.text2,marginLeft:8}}>{e.detail}</span></div>
            <Badge color={em(e.type).color}>{em(e.type).label}</Badge>
            <span style={{fontSize:11,color:T.text3,whiteSpace:"nowrap",minWidth:56,textAlign:"right"}}>{timeAgo(e.at)}</span>
          </div>
        ))}
      </Card>
    </div>
  );

  const Users_ = () => (
    <div style={{padding:"22px 26px",animation:"fadeUp .3s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:T.accent,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>User Management</div>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:26,letterSpacing:"-0.02em"}}>All Users</h2>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email\u2026"
            style={{background:T.surface2,border:`1px solid ${T.border2}`,color:T.text,padding:"8px 13px",borderRadius:9,fontSize:13,outline:"none",width:240,fontFamily:"'DM Sans',sans-serif"}}/>
          <span style={{fontSize:12,color:T.text2}}>{filtered.length}/{users.length}</span>
          {loading.users&&<Spin/>}
        </div>
      </div>
      {errs.users&&<div style={{background:"rgba(248,113,113,.1)",color:T.danger,padding:"12px 16px",borderRadius:10,marginBottom:16,fontSize:13}}>Error: {errs.users}</div>}
      <Card>
        {filtered.length===0&&!loading.users?(
          <Empty icon="\ud83d\udc65" title={users.length===0?"No users yet":"No results"} sub={users.length===0?"Users appear here after they register":"Try a different search term"}/>
        ):(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
              {["User","Plan","Status","Logins","Analyses","Last login","IP","Actions"].map(h=>(
                <th key={h} style={{textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.text3,padding:"11px 14px",fontWeight:500,fontFamily:"'IBM Plex Mono',monospace"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(u=>(
                <tr key={u.id} style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}} onClick={()=>setModalId(u.id)}>
                  <td style={{padding:"11px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent}44,${T.accent2}44)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:T.text,flexShrink:0}}>{u.name[0]}</div>
                      <div><div style={{fontSize:13,fontWeight:500}}>{u.name}</div><div style={{fontSize:11,color:T.text2}}>{u.email}</div></div>
                    </div>
                  </td>
                  <td style={{padding:"11px 14px"}}><Badge color={u.plan==="pro"?T.accent3:"#f97316"}>{u.plan}</Badge></td>
                  <td style={{padding:"11px 14px"}}><Badge color={u.status==="active"?T.accent:T.danger}>{u.status}</Badge></td>
                  <td style={{padding:"11px 14px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>{u.loginCount}</td>
                  <td style={{padding:"11px 14px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>{u.analysisCount}</td>
                  <td style={{padding:"11px 14px",fontSize:12,color:T.text2,whiteSpace:"nowrap"}}>{u.lastLogin?timeAgo(u.lastLogin):"never"}</td>
                  <td style={{padding:"11px 14px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:T.text3}}>{u.lastIp||"\u2014"}</td>
                  <td style={{padding:"11px 14px"}} onClick={e=>e.stopPropagation()}>
                    <div style={{display:"flex",gap:5}}>
                      <Btn v="ghost" size="sm" onClick={()=>setModalId(u.id)}>View</Btn>
                      <Btn v={u.status==="suspended"?"outline":"secondary"} size="sm"
                        onClick={()=>setConfirm({msg:`${u.status==="suspended"?"Reactivate":"Suspend"} ${u.name}?`,action:()=>setUserStatus(u.id,u.status==="suspended"?"active":"suspended")})}>
                        {u.status==="suspended"?"Activate":"Suspend"}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );

  const Sessions_ = () => (
    <div style={{padding:"22px 26px",animation:"fadeUp .3s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:T.accent,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>Sessions</div>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:26,letterSpacing:"-0.02em"}}>Login Sessions</h2>
        </div>
        {loading.sessions&&<Spin/>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        {[[sessions.filter(s=>s.active).length,"Active now",T.accent],[sessions.filter(s=>!s.active).length,"Ended",T.text2],[sessions.length,"Total",T.accent2]].map(([v,l,c])=>(
          <Card key={l} style={{padding:16}}>
            <div style={{fontSize:10,color:T.text3,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4,fontFamily:"'IBM Plex Mono',monospace"}}>{l}</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:26,color:c}}>{v}</div>
          </Card>
        ))}
      </div>
      <Card>
        {sessions.length===0?<Empty icon="\ud83d\udd10" title="No sessions yet" sub="Sessions appear when users log in"/>:(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
              {["Status","User","IP","Browser","Time",""].map(h=>(
                <th key={h} style={{textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:"0.07em",color:T.text3,padding:"11px 14px",fontWeight:500,fontFamily:"'IBM Plex Mono',monospace"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sessions.map(s=>(
                <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`}}>
                  <td style={{padding:"11px 14px"}}><div style={{display:"flex",alignItems:"center",gap:7}}><Dot active={s.active}/><span style={{fontSize:11,color:s.active?T.accent:T.text3}}>{s.active?"online":"offline"}</span></div></td>
                  <td style={{padding:"11px 14px"}}><div style={{fontSize:13,fontWeight:500}}>{s.name}</div><div style={{fontSize:11,color:T.text2}}>{s.email}</div></td>
                  <td style={{padding:"11px 14px",fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:T.text2}}>{s.ip}</td>
                  <td style={{padding:"11px 14px",fontSize:12,color:T.text2}}>{s.userAgent}</td>
                  <td style={{padding:"11px 14px",fontSize:12,color:T.text2,whiteSpace:"nowrap"}}>{fmtTime(s.loginAt)}</td>
                  <td style={{padding:"11px 14px"}}>{s.active&&<Btn v="danger" size="sm" onClick={()=>setConfirm({msg:`Terminate ${s.name}'s session?`,action:()=>killSession(s.id)})}>Kill</Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );

  const Activity_ = () => (
    <div style={{padding:"22px 26px",animation:"fadeUp .3s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:T.accent,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>Audit Log</div>
          <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:26,letterSpacing:"-0.02em"}}>Activity Feed</h2>
        </div>
        {loading.events&&<Spin/>}
      </div>
      <div style={{display:"flex",gap:9,marginBottom:16,flexWrap:"wrap"}}>
        {Object.entries(EVENT_META).map(([type,meta])=>{
          const count=events.filter(e=>e.type===type).length;
          if(!count)return null;
          return <div key={type} style={{background:T.surface,border:`1px solid ${meta.color}33`,borderRadius:9,padding:"7px 12px",display:"flex",alignItems:"center",gap:7}}>
            <span style={{width:20,height:20,borderRadius:"50%",background:meta.color+"20",color:meta.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{meta.icon}</span>
            <span style={{fontSize:12,fontWeight:600,color:meta.color}}>{count}</span>
            <span style={{fontSize:11,color:T.text2}}>{meta.label}</span>
          </div>;
        })}
      </div>
      <Card>
        {events.length===0?<Empty icon="\ud83d\udccb" title="No events yet" sub="Events appear as users interact with the platform"/>:(
          <>
            <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.border}`,fontSize:12,color:T.text2}}>{events.length} events recorded</div>
            {events.map((e,i)=>(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",borderBottom:i<events.length-1?`1px solid ${T.border}`:"none"}}>
                <span style={{width:28,height:28,borderRadius:"50%",background:em(e.type).color+"20",color:em(e.type).color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,fontWeight:700}}>{em(e.type).icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <span style={{fontSize:12,fontFamily:"'IBM Plex Mono',monospace",color:T.text2}}>{e.email}</span>
                  <span style={{fontSize:13,color:T.text,marginLeft:8}}>{e.detail}</span>
                  {e.ip&&e.ip!=="unknown"&&<div style={{fontSize:11,color:T.text3,marginTop:2,fontFamily:"'IBM Plex Mono',monospace"}}>IP: {e.ip}</div>}
                </div>
                <div style={{flexShrink:0,textAlign:"right"}}>
                  <Badge color={em(e.type).color}>{em(e.type).label}</Badge>
                  <div style={{fontSize:11,color:T.text3,marginTop:4}}>{timeAgo(e.at)}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );

  const NAV=[{id:"overview",icon:"\u25c8",label:"Overview",badge:onlineCount>0?onlineCount:null},{id:"users",icon:"\u25c9",label:"Users",badge:stats?.newToday>0?"+"+stats.newToday:null},{id:"sessions",icon:"\u25ce",label:"Sessions",badge:onlineCount||null},{id:"activity",icon:"\u25cc",label:"Activity",badge:null}];

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 22px",borderBottom:`1px solid ${T.border}`,background:T.surface,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:13}}>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:T.accent}}>\u2B21 VeloLaw</div>
          <div style={{width:1,height:15,background:T.border}}/>
          <div style={{fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:T.text3,letterSpacing:"0.12em",textTransform:"uppercase"}}>Admin</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:13}}>
          <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:T.accent}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:T.accent,display:"inline-block"}}/>
            {onlineCount} online
          </div>
          <span style={{fontSize:12,color:T.text2}}>{users.length} users \u00b7 {stats?.totalAnalyses||0} analyses</span>
          <Btn v="ghost" size="sm" onClick={()=>setToken("")}>Sign out</Btn>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"200px 1fr",flex:1,maxHeight:"calc(100vh - 56px)",overflow:"hidden"}}>
        <div style={{background:T.surface,borderRight:`1px solid ${T.border}`,padding:"15px 7px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
          <div style={{fontSize:9,color:T.text3,textTransform:"uppercase",letterSpacing:"0.12em",padding:"4px 12px 7px",fontFamily:"'IBM Plex Mono',monospace"}}>Navigation</div>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,background:tab===n.id?"rgba(74,222,128,.1)":"transparent",color:tab===n.id?T.accent:T.text2,border:"none",cursor:"pointer",width:"100%",textAlign:"left",fontSize:13,fontFamily:"'DM Sans',sans-serif",transition:"all .15s"}}>
              <span style={{fontSize:13,width:18,textAlign:"center"}}>{n.icon}</span>
              {n.label}
              {n.badge&&<span style={{marginLeft:"auto",background:T.accent,color:"#000",borderRadius:100,padding:"1px 7px",fontSize:10,fontWeight:700}}>{n.badge}</span>}
            </button>
          ))}
          <div style={{marginTop:"auto",padding:"12px 0 0"}}>
            <div style={{fontSize:9,color:T.text3,textTransform:"uppercase",letterSpacing:"0.12em",padding:"0 12px 7px",fontFamily:"'IBM Plex Mono',monospace"}}>Live</div>
            {[[users.length,"Users",T.accent],[onlineCount,"Online",T.accent2],[stats?.totalAnalyses||0,"Analyses",T.accent3]].map(([v,l,c])=>(
              <div key={l} style={{padding:"7px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:12,color:T.text2}}>{l}</span>
                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,color:c,fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{overflowY:"auto"}}>
          {tab==="overview"&&<Overview/>}
          {tab==="users"   &&<Users_/>}
          {tab==="sessions"&&<Sessions_/>}
          {tab==="activity"&&<Activity_/>}
        </div>
      </div>

      {modalId&&<UserModal userId={modalId} api={api} onClose={()=>setModalId(null)} onRefresh={loadAll}/>}
      {confirm&&<Confirm msg={confirm.msg} onOk={confirm.action} onCancel={()=>setConfirm(null)}/>}
      <div style={{position:"fixed",bottom:24,right:24,background:T.surface2,border:`1px solid ${toast.type==="ok"?T.accent:T.danger}55`,color:toast.type==="ok"?T.accent:T.danger,padding:"10px 18px",borderRadius:10,fontSize:13,zIndex:9999,transition:"all .3s",opacity:toast.v?1:0,transform:toast.v?"translateY(0)":"translateY(20px)",pointerEvents:"none"}}>{toast.msg}</div>
    </div>
  );
}
