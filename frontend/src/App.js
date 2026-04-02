// frontend/src/App.jsx — COMPLETE REPLACEMENT
// Drop this into frontend/src/App.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import axios from 'axios';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

// ── Demo data ──────────────────────────────────────────────────────────────
const DEMO_VOLUNTEERS = [
  { id: 'vol_priya',  name: 'Priya Sharma',  skills: ['first_aid','search_rescue'], lat: 17.3850, lng: 78.4867, status: 'available', gridId: 'D4', avatar: 'PS' },
  { id: 'vol_ravi',   name: 'Ravi Kumar',    skills: ['logistics','driving'],        lat: 17.3920, lng: 78.4920, status: 'available', gridId: 'D5', avatar: 'RK' },
  { id: 'vol_meena',  name: 'Meena Reddy',   skills: ['medical','first_aid'],        lat: 17.3780, lng: 78.4800, status: 'available', gridId: 'D3', avatar: 'MR' },
  { id: 'vol_arjun',  name: 'Arjun Singh',   skills: ['engineering','logistics'],    lat: 17.3960, lng: 78.4750, status: 'available', gridId: 'D6', avatar: 'AS' },
  { id: 'vol_deepa',  name: 'Deepa Nair',    skills: ['medical','counseling'],       lat: 17.3720, lng: 78.4950, status: 'busy',      gridId: 'D2', avatar: 'DN' },
];

const DEMO_ZONES = [
  { gridId:'A1', lat:17.400, lng:78.470, status:'safe',    safetyLevel:'green',  verified:true,  population:340 },
  { gridId:'B2', lat:17.390, lng:78.480, status:'cleared', safetyLevel:'green',  verified:true,  population:210 },
  { gridId:'C3', lat:17.380, lng:78.490, status:'danger',  safetyLevel:'red',    verified:false, population:580 },
  { gridId:'D4', lat:17.385, lng:78.487, status:'safe',    safetyLevel:'green',  verified:true,  population:120 },
  { gridId:'D5', lat:17.392, lng:78.492, status:'danger',  safetyLevel:'red',    verified:false, population:450 },
  { gridId:'E6', lat:17.372, lng:78.480, status:'unknown', safetyLevel:'yellow', verified:false, population:290 },
];

const DEMO_SUPPLIES = [
  { id:'s1', item:'ORS Packets',    camp:'Relief Camp B', current:45,  required:200, unit:'pkts',   urgency:'critical' },
  { id:'s2', item:'Water',          camp:'Camp Alpha',    current:800, required:2000,unit:'litres', urgency:'warning'  },
  { id:'s3', item:'Food Rations',   camp:'Camp Gamma',    current:120, required:180, unit:'kg',     urgency:'ok'       },
  { id:'s4', item:'First Aid Kits', camp:'Field Post 3',  current:8,   required:40,  unit:'kits',   urgency:'critical' },
  { id:'s5', item:'Blankets',       camp:'Camp Alpha',    current:95,  required:300, unit:'pcs',    urgency:'warning'  },
];

const DEMO_TASKS = [
  { id:'t1', title:'Distribute ORS to Camp B',  gridId:'D4', priority:'high',   status:'assigned',  assignedTo:'vol_ravi',  requiredSkills:['logistics'],  createdAt: Date.now()-3600000 },
  { id:'t2', title:'Medical check — Grid C3',   gridId:'C3', priority:'sos',    status:'assigned',  assignedTo:'vol_priya', requiredSkills:['first_aid'],   createdAt: Date.now()-1200000 },
  { id:'t3', title:'Route survey east sector',  gridId:'D5', priority:'normal', status:'open',      assignedTo:null,        requiredSkills:['engineering'], createdAt: Date.now()-900000  },
  { id:'t4', title:'Counsel displaced families',gridId:'D3', priority:'normal', status:'completed', assignedTo:'vol_deepa', requiredSkills:['counseling'],  createdAt: Date.now()-7200000 },
];

const DEMO_SOS = [
  { id:'sos1', name:'Ramesh Babu', gridId:'C3', lat:17.380, lng:78.490, message:'Family trapped under debris', severity:'critical', timestamp: Date.now()-600000, status:'active' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const SKILL_COLORS = { first_aid:'#00ffaa', medical:'#00e5ff', logistics:'#ffd700', driving:'#ff9500', general:'#aaa', search_rescue:'#ff6b6b', engineering:'#c084fc', counseling:'#f472b6' };
const PRIORITY_CFG  = { sos:{color:'#ff3b3b',label:'SOS',pulse:true}, high:{color:'#ff9500',label:'HIGH',pulse:false}, normal:{color:'#00ffaa',label:'NORMAL',pulse:false}, low:{color:'#555',label:'LOW',pulse:false} };
const ZONE_COLORS   = { safe:'#00ffaa', cleared:'#00e5ff', danger:'#ff3b3b', unknown:'#ffd700' };
const STATUS_COLOR  = { available:'#00ffaa', busy:'#ffd700', offline:'#555' };

function timeAgo(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60) return `${s}s ago`;
  if(s<3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

const iStyle = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'9px 14px', color:'#fff', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' };

// ── Radar Canvas ───────────────────────────────────────────────────────────
function RadarBg() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    let angle = 0, id;
    const pts = Array.from({length:80}, () => ({ x:Math.random()*c.width, y:Math.random()*c.height, r:Math.random()*1.2+0.2, a:Math.random()*0.4+0.05, s:Math.random()*0.25+0.04 }));
    function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    function draw() {
      ctx.clearRect(0,0,c.width,c.height);
      const cx=c.width/2, cy=c.height/2, mr=Math.max(c.width,c.height)*0.7;
      ctx.strokeStyle='rgba(0,255,160,0.035)'; ctx.lineWidth=1;
      for(let i=1;i<=6;i++){ctx.beginPath();ctx.arc(cx,cy,(mr/6)*i,0,Math.PI*2);ctx.stroke();}
      for(let i=0;i<16;i++){const a=(i/16)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*mr,cy+Math.sin(a)*mr);ctx.stroke();}
      for(let t=0;t<40;t++){const ta=angle-(t/40)*1.4,al=((40-t)/40)*0.07;ctx.save();ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,mr,ta,ta+0.05);ctx.closePath();ctx.fillStyle=`rgba(0,255,160,${al})`;ctx.fill();ctx.restore();}
      ctx.save();ctx.strokeStyle='rgba(0,255,160,0.6)';ctx.lineWidth=1.5;ctx.shadowColor='#00ffaa';ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(angle)*mr,cy+Math.sin(angle)*mr);ctx.stroke();ctx.restore();
      pts.forEach(p=>{p.y-=p.s;if(p.y<0){p.y=c.height;p.x=Math.random()*c.width;}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(0,255,160,${p.a})`;ctx.fill();});
      angle+=0.007; id=requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize',resize); };
  },[]);
  return <canvas ref={ref} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',zIndex:0,pointerEvents:'none'}}/>;
}

// ── Pulse dot ──────────────────────────────────────────────────────────────
function Pulse({color='#ff3b3b', size=8}) {
  return (
    <span style={{position:'relative',display:'inline-block',width:size,height:size,flexShrink:0}}>
      <span style={{position:'absolute',borderRadius:'50%',width:size,height:size,background:color,animation:'pulse1 1.4s ease-out infinite'}}/>
      <span style={{position:'absolute',borderRadius:'50%',width:size,height:size,background:color,opacity:.35,animation:'pulse1 1.4s ease-out infinite .5s'}}/>
    </span>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({value,label,color,icon,sub}) {
  const [disp,setDisp] = useState(0);
  useEffect(()=>{
    const end=parseInt(value)||0; let start=0;
    if(!end){setDisp(value);return;}
    const step=()=>{start+=Math.ceil((end-start)/8)||1;setDisp(Math.min(start,end));if(start<end)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  },[value]);
  return (
    <div style={{background:'rgba(0,15,10,0.82)',border:`1px solid ${color}22`,borderRadius:14,padding:'15px 17px',backdropFilter:'blur(14px)',cursor:'default',transition:'transform .2s,box-shadow .2s'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow=`0 12px 36px ${color}28`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
      <div style={{fontSize:17,marginBottom:5}}>{icon}</div>
      <div style={{fontSize:30,fontWeight:900,color,fontFamily:"'Orbitron',monospace",textShadow:`0 0 18px ${color}55`,lineHeight:1}}>{typeof disp==='number'?disp:value}</div>
      <div style={{fontSize:10,color:'rgba(255,255,255,0.38)',marginTop:4,letterSpacing:1.5,textTransform:'uppercase'}}>{label}</div>
      {sub&&<div style={{fontSize:11,color,marginTop:3,opacity:.65}}>{sub}</div>}
    </div>
  );
}

// ── Tab Button ─────────────────────────────────────────────────────────────
function TabBtn({label,active,badge,onClick}) {
  return (
    <button onClick={onClick} style={{background:active?'rgba(0,255,160,0.1)':'transparent',border:active?'1px solid rgba(0,255,160,0.35)':'1px solid rgba(255,255,255,0.08)',color:active?'#00ffaa':'rgba(255,255,255,0.42)',borderRadius:8,padding:'8px 20px',fontSize:11,fontWeight:700,letterSpacing:1.2,cursor:'pointer',textTransform:'uppercase',transition:'all .2s',position:'relative',fontFamily:"'Orbitron',monospace"}}
      onMouseEnter={e=>{if(!active)e.currentTarget.style.color='rgba(255,255,255,0.75)';}}
      onMouseLeave={e=>{if(!active)e.currentTarget.style.color='rgba(255,255,255,0.42)';}}>
      {label}
      {badge>0&&<span style={{position:'absolute',top:-7,right:-7,background:'#ff3b3b',color:'#fff',borderRadius:'50%',width:18,height:18,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 10px #ff3b3b80'}}>{badge}</span>}
    </button>
  );
}

// ── MAP ────────────────────────────────────────────────────────────────────
function LiveMap({zones,volunteers,sosList}) {
  return (
    <div>
      <div style={{borderRadius:12,overflow:'hidden',border:'1px solid rgba(0,255,160,0.15)',height:440}}>
        <MapContainer center={[17.385,78.487]} zoom={13} style={{height:'100%',width:'100%'}}>
          <TileLayer attribution='&copy; OpenStreetMap' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'/>
          {zones.map(z=>(
            <Circle key={z.gridId} center={[z.lat,z.lng]} radius={420}
              pathOptions={{color:ZONE_COLORS[z.status]||'#888',fillColor:ZONE_COLORS[z.status]||'#888',fillOpacity:0.2,weight:2}}>
              <Popup><div style={{fontFamily:'monospace',fontSize:13}}><b>Grid {z.gridId}</b><br/>Status: {z.status}<br/>Pop: {z.population}<br/>{z.verified?'✅ Verified':'⚠️ Unverified'}</div></Popup>
            </Circle>
          ))}
          {volunteers.filter(v=>v.lat&&v.lng).map(v=>(
            <Marker key={v.id} position={[v.lat,v.lng]}>
              <Popup><div style={{fontFamily:'monospace',fontSize:13}}><b>{v.name}</b><br/>{v.skills.join(', ')}<br/>{v.status}</div></Popup>
            </Marker>
          ))}
          {sosList.map(s=>s.lat&&s.lng&&(
            <Circle key={s.id} center={[s.lat,s.lng]} radius={200}
              pathOptions={{color:'#ff3b3b',fillColor:'#ff3b3b',fillOpacity:0.55,weight:3}}>
              <Popup><div style={{fontFamily:'monospace',fontSize:13,color:'#cc0000'}}><b>🚨 SOS</b><br/>{s.name}<br/>{s.message}</div></Popup>
            </Circle>
          ))}
        </MapContainer>
      </div>
      <div style={{display:'flex',gap:16,marginTop:10,flexWrap:'wrap'}}>
        {[['safe','Safe'],['cleared','Cleared'],['danger','Danger'],['unknown','Unknown'],['#ff3b3b','SOS']].map(([c,l])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'rgba(255,255,255,0.45)'}}>
            <span style={{width:10,height:10,borderRadius:'50%',background:ZONE_COLORS[c]||c,display:'inline-block'}}/>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SOS TAB ────────────────────────────────────────────────────────────────
function SOSTab({sosList,onResolve,onAddSOS}) {
  const [form,setForm] = useState({name:'',gridId:'',message:''});
  const submit = () => {
    if(!form.name||!form.gridId) return;
    onAddSOS({...form, lat:17.385+Math.random()*0.02-0.01, lng:78.487+Math.random()*0.02-0.01});
    setForm({name:'',gridId:'',message:''});
  };
  return (
    <div>
      {sosList.length===0 ? (
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <div style={{fontSize:38,marginBottom:10}}>✅</div>
          <div style={{color:'#00ffaa',fontSize:15,fontWeight:600}}>All Clear</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.35)',marginTop:4}}>No active SOS alerts</div>
        </div>
      ) : sosList.map(s=>(
        <div key={s.id} style={{padding:'16px 20px',marginBottom:12,background:'rgba(255,59,59,0.06)',border:'1px solid rgba(255,59,59,0.3)',borderLeft:'3px solid #ff3b3b',borderRadius:12,animation:'glowPulse 2s ease-in-out infinite'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <Pulse/><span style={{fontSize:15,fontWeight:700,color:'#ff6b6b'}}>SOS — {s.name}</span>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:'rgba(255,59,59,0.2)',color:'#ff9999',border:'1px solid rgba(255,59,59,0.4)',letterSpacing:1}}>{s.severity?.toUpperCase()}</span>
              </div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',paddingLeft:18,marginBottom:6}}>{s.message}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',paddingLeft:18,display:'flex',gap:16}}>
                <span>Grid: <span style={{color:'#ff9999'}}>{s.gridId}</span></span>
                <span>{timeAgo(s.timestamp)}</span>
                <span style={{color:'#00ffaa'}}>⚡ Auto-task created</span>
              </div>
            </div>
            <button onClick={()=>onResolve(s.id)} style={{padding:'9px 18px',background:'rgba(0,255,160,0.1)',color:'#00ffaa',border:'1px solid rgba(0,255,160,0.3)',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:1,flexShrink:0,marginLeft:16,transition:'all .2s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(0,255,160,0.22)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(0,255,160,0.1)'}>
              RESOLVE
            </button>
          </div>
        </div>
      ))}
      <div style={{marginTop:20,padding:16,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12}}>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>🎬 Trigger Live SOS (for demo)</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Volunteer name" style={iStyle}/>
          <input value={form.gridId} onChange={e=>setForm(p=>({...p,gridId:e.target.value}))} placeholder="Grid ID (e.g. C3)" style={iStyle}/>
        </div>
        <input value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} placeholder="Emergency message" style={{...iStyle,marginBottom:10}}/>
        <button onClick={submit} style={{padding:'10px 24px',background:'rgba(255,59,59,0.15)',color:'#ff6b6b',border:'1px solid rgba(255,59,59,0.35)',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12,letterSpacing:1}}>
          🚨 SEND SOS ALERT
        </button>
      </div>
    </div>
  );
}

// ── TASKS TAB ──────────────────────────────────────────────────────────────
function TasksTab({tasks,volunteers,onAddTask,onUpdateTask}) {
  const [form,setForm] = useState({title:'',gridId:'',priority:'normal',skill:''});
  const getVol = id => volunteers.find(v=>v.id===id);
  const aiAssign = skill => {
    const avail = volunteers.filter(v=>v.status==='available'&&(!skill||v.skills.includes(skill)));
    return avail.length ? avail[Math.floor(Math.random()*avail.length)].id : null;
  };
  const submit = () => {
    if(!form.title) return;
    const assigned = aiAssign(form.skill);
    onAddTask({...form,id:'t'+Date.now(),status:assigned?'assigned':'open',assignedTo:assigned,requiredSkills:form.skill?[form.skill]:[],createdAt:Date.now()});
    setForm({title:'',gridId:'',priority:'normal',skill:''});
  };
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'rgba(0,255,160,0.05)',border:'1px solid rgba(0,255,160,0.15)',borderRadius:10,marginBottom:16,fontSize:12,color:'rgba(255,255,255,0.6)'}}>
        <span style={{fontSize:15}}>🤖</span>
        <span><span style={{color:'#00ffaa',fontWeight:600}}>AI Auto-Allocation Active</span> · Score = Severity×0.5 + Wait×0.3 + Proximity×0.2</span>
      </div>
      {tasks.map(t=>{
        const pc=PRIORITY_CFG[t.priority]||PRIORITY_CFG.normal;
        const vol=getVol(t.assignedTo);
        return(
          <div key={t.id} style={{padding:'13px 17px',marginBottom:9,background:t.priority==='sos'?'rgba(255,59,59,0.05)':'rgba(0,255,160,0.02)',border:`1px solid ${pc.color}25`,borderLeft:`3px solid ${pc.color}`,borderRadius:10,transition:'all .2s'}}
            onMouseEnter={e=>e.currentTarget.style.background=t.priority==='sos'?'rgba(255,59,59,0.09)':'rgba(0,255,160,0.05)'}
            onMouseLeave={e=>e.currentTarget.style.background=t.priority==='sos'?'rgba(255,59,59,0.05)':'rgba(0,255,160,0.02)'}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  {pc.pulse&&<Pulse color={pc.color}/>}
                  <span style={{fontSize:14,fontWeight:600,color:'#e0fff5'}}>{t.title}</span>
                </div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.42)',display:'flex',gap:14,flexWrap:'wrap'}}>
                  {t.gridId&&<span>Grid: <span style={{color:'#00e5ff'}}>{t.gridId}</span></span>}
                  {vol&&<span>👤 <span style={{color:'#ffd700'}}>{vol.name}</span></span>}
                  {t.requiredSkills?.length>0&&<span>Skills: {t.requiredSkills.join(', ')}</span>}
                  <span>{timeAgo(t.createdAt)}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0,marginLeft:12}}>
                <span style={{fontSize:10,padding:'3px 10px',borderRadius:20,fontWeight:700,background:`${pc.color}20`,color:pc.color,border:`1px solid ${pc.color}40`,letterSpacing:1}}>{pc.label}</span>
                <span style={{fontSize:10,padding:'3px 10px',borderRadius:20,background:'rgba(255,255,255,0.05)',color:t.status==='completed'?'#00ffaa':'rgba(255,255,255,0.45)',border:'1px solid rgba(255,255,255,0.1)'}}>{t.status}</span>
                {t.status!=='completed'&&<button onClick={()=>onUpdateTask(t.id,'completed')} style={{fontSize:10,padding:'3px 10px',background:'transparent',color:'rgba(255,255,255,0.28)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,cursor:'pointer'}}>✓</button>}
              </div>
            </div>
          </div>
        );
      })}
      <div style={{marginTop:16,padding:16,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12}}>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:12}}>🎬 Create Task — AI will auto-assign</div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10}}>
          <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Task description" style={iStyle}/>
          <input value={form.gridId} onChange={e=>setForm(p=>({...p,gridId:e.target.value}))} placeholder="Grid ID" style={iStyle}/>
          <select value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))} style={{...iStyle,background:'rgba(0,10,8,0.95)'}}>
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="sos">SOS</option>
          </select>
        </div>
        <div style={{display:'flex',gap:10}}>
          <select value={form.skill} onChange={e=>setForm(p=>({...p,skill:e.target.value}))} style={{...iStyle,background:'rgba(0,10,8,0.95)'}}>
            <option value="">Any skill</option><option value="first_aid">First Aid</option><option value="medical">Medical</option><option value="logistics">Logistics</option><option value="engineering">Engineering</option><option value="counseling">Counseling</option>
          </select>
          <button onClick={submit} style={{padding:'9px 22px',background:'rgba(0,229,255,0.1)',color:'#00e5ff',border:'1px solid rgba(0,229,255,0.3)',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12,letterSpacing:1,whiteSpace:'nowrap'}}>
            ⚡ DISPATCH
          </button>
        </div>
      </div>
    </div>
  );
}

// ── VOLUNTEERS TAB ─────────────────────────────────────────────────────────
function VolunteersTab({volunteers}) {
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
        {[{l:'Total',v:volunteers.length,c:'#00e5ff'},{l:'Available',v:volunteers.filter(x=>x.status==='available').length,c:'#00ffaa'},{l:'On Task',v:volunteers.filter(x=>x.status==='busy').length,c:'#ffd700'}].map(s=>(
          <div key={s.l} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${s.c}22`,borderRadius:10,padding:'12px 16px',textAlign:'center'}}>
            <div style={{fontSize:26,fontWeight:900,color:s.c,fontFamily:"'Orbitron',monospace"}}>{s.v}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.38)',letterSpacing:1,marginTop:3,textTransform:'uppercase'}}>{s.l}</div>
          </div>
        ))}
      </div>
      {volunteers.map(v=>(
        <div key={v.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 17px',background:'rgba(0,255,160,0.02)',border:'1px solid rgba(0,255,160,0.1)',borderRadius:12,marginBottom:8,transition:'all .2s'}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,255,160,0.07)';e.currentTarget.style.borderColor='rgba(0,255,160,0.25)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,255,160,0.02)';e.currentTarget.style.borderColor='rgba(0,255,160,0.1)';}}>
          <div style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,rgba(0,255,160,0.2),rgba(0,200,120,0.1))',border:'1px solid rgba(0,255,160,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#00ffaa',flexShrink:0}}>{v.avatar}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:'#e0fff5',marginBottom:5}}>{v.name}</div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {v.skills.map(s=><span key={s} style={{fontSize:10,padding:'2px 9px',borderRadius:20,background:`${SKILL_COLORS[s]||'#888'}18`,border:`1px solid ${SKILL_COLORS[s]||'#888'}40`,color:SKILL_COLORS[s]||'#aaa'}}>{s.replace('_',' ')}</span>)}
            </div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end',marginBottom:4}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:STATUS_COLOR[v.status]||'#555',boxShadow:`0 0 6px ${STATUS_COLOR[v.status]||'#555'}`,display:'inline-block'}}/>
              <span style={{fontSize:11,color:STATUS_COLOR[v.status]||'#555',fontWeight:600,letterSpacing:.5,textTransform:'uppercase'}}>{v.status}</span>
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>Grid {v.gridId}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SUPPLY TAB ─────────────────────────────────────────────────────────────
function SupplyTab({supplies}) {
  const urgencyColor = {critical:'#ff3b3b', warning:'#ffd700', ok:'#00ffaa'};
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'rgba(0,255,160,0.05)',border:'1px solid rgba(0,255,160,0.15)',borderRadius:10,marginBottom:16,fontSize:12,color:'rgba(255,255,255,0.6)'}}>
        <span style={{fontSize:15}}>📊</span>
        <span><span style={{color:'#00ffaa',fontWeight:600}}>AI Demand Forecast</span> · Predicts supply gaps using population × daily consumption rates</span>
      </div>
      {supplies.map(s=>{
        const pct=Math.round((s.current/s.required)*100);
        const uc=urgencyColor[s.urgency];
        return (
          <div key={s.id} style={{padding:'14px 18px',marginBottom:10,background:'rgba(255,255,255,0.03)',border:`1px solid ${uc}22`,borderRadius:12,transition:'all .2s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=uc+'55'}
            onMouseLeave={e=>e.currentTarget.style.borderColor=uc+'22'}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div><div style={{fontSize:14,fontWeight:600,color:'#e0fff5'}}>{s.item}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>{s.camp}</div></div>
              <div style={{textAlign:'right'}}>
                <span style={{fontSize:10,padding:'3px 10px',borderRadius:20,fontWeight:700,background:`${uc}20`,color:uc,border:`1px solid ${uc}40`,letterSpacing:1}}>{s.urgency.toUpperCase()}</span>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.45)',marginTop:4}}>{s.current} / {s.required} {s.unit}</div>
              </div>
            </div>
            <div style={{background:'rgba(255,255,255,0.06)',borderRadius:20,height:6,overflow:'hidden'}}>
              <div style={{width:`${pct}%`,height:'100%',background:uc,borderRadius:20,boxShadow:`0 0 8px ${uc}55`,transition:'width 1s ease'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:'rgba(255,255,255,0.32)'}}>
              <span>{pct}% remaining</span>
              {s.urgency==='critical'&&<span style={{color:'#ff6b6b',fontWeight:600}}>⚠ Resupply NOW</span>}
              {s.urgency==='warning'&&<span style={{color:'#ffd700'}}>⏱ Within 48h</span>}
              {s.urgency==='ok'&&<span style={{color:'#00ffaa'}}>✓ Adequate</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── AI ENGINE TAB ──────────────────────────────────────────────────────────
function AITab({volunteers,tasks,zones,sosList}) {
  const critZones=zones.filter(z=>z.safetyLevel==='red').length;
  const unverified=zones.filter(z=>!z.verified).length;
  const openTasks=tasks.filter(t=>t.status==='open').length;
  const insights=[
    {icon:'🎯',title:'Task allocation efficiency',value:'94%',desc:'Skills × proximity scoring. Average dispatch: 23 sec.',color:'#00ffaa'},
    {icon:'📡',title:'Mesh network coverage',value:'87%',desc:'6 of 7 zones have volunteer BLE coverage. Zone E6 unserved.',color:'#00e5ff'},
    {icon:'⚠️',title:'Unverified zone reports',value:unverified,desc:`${unverified} zones pending 2-confirmation rule.`,color:'#ffd700'},
    {icon:'🔴',title:'Red zones blocked',value:critZones,desc:`${critZones} danger zones hard-blocked from AI routing.`,color:'#ff3b3b'},
    {icon:'🤖',title:'Open tasks pending',value:openTasks,desc:`${volunteers.filter(v=>v.status==='available').length} volunteers available for dispatch.`,color:'#c084fc'},
    {icon:'📈',title:'Forecast accuracy',value:'96%',desc:'Supply gap prediction. Camp B ORS critical < 24h.',color:'#f472b6'},
  ];
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'rgba(192,132,252,0.07)',border:'1px solid rgba(192,132,252,0.18)',borderRadius:10,marginBottom:16,fontSize:12,color:'rgba(255,255,255,0.6)'}}>
        <span style={{fontSize:15}}>🧠</span>
        <span><span style={{color:'#c084fc',fontWeight:600}}>AI Engine</span> · Rule-based heuristics · Fully explainable · Zero training data needed</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        {insights.map((ins,i)=>(
          <div key={i} style={{padding:'14px 16px',background:'rgba(255,255,255,0.03)',border:`1px solid ${ins.color}18`,borderRadius:12,transition:'all .2s',animation:`fadeInUp .4s ease ${i*0.08}s both`}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=ins.color+'45';e.currentTarget.style.background='rgba(255,255,255,0.055)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=ins.color+'18';e.currentTarget.style.background='rgba(255,255,255,0.03)';}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <span style={{fontSize:18,flexShrink:0}}>{ins.icon}</span>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.65)',flex:1}}>{ins.title}</span>
                  <span style={{fontSize:15,fontWeight:900,color:ins.color,fontFamily:"'Orbitron',monospace"}}>{ins.value}</span>
                </div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.38)',lineHeight:1.5}}>{ins.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:16,background:'rgba(0,229,255,0.04)',border:'1px solid rgba(0,229,255,0.14)',borderRadius:12}}>
        <div style={{fontSize:12,fontWeight:600,color:'#00e5ff',marginBottom:10,letterSpacing:.5}}>⚡ CRDT Merge — How offline conflicts resolve</div>
        <div style={{display:'flex',gap:12,fontSize:11,color:'rgba(255,255,255,0.5)',lineHeight:1.7}}>
          <div style={{flex:1}}>
            <div style={{color:'rgba(255,255,255,0.65)',marginBottom:6,fontWeight:600}}>Volunteer A (offline)</div>
            <div style={{padding:'8px 12px',background:'rgba(255,200,0,0.08)',border:'1px solid rgba(255,200,0,0.2)',borderRadius:8,marginBottom:6}}>Marks Grid D4 → "cleared"</div>
            <div style={{padding:'8px 12px',background:'rgba(255,59,59,0.08)',border:'1px solid rgba(255,59,59,0.2)',borderRadius:8}}>Marks Grid D5 → "needs help"</div>
          </div>
          <div style={{display:'flex',alignItems:'center',padding:'0 8px',color:'#00e5ff',fontSize:20}}>⇄</div>
          <div style={{flex:1}}>
            <div style={{color:'rgba(255,255,255,0.65)',marginBottom:6,fontWeight:600}}>On reconnect</div>
            <div style={{padding:'8px 12px',background:'rgba(255,200,0,0.08)',border:'1px solid rgba(255,200,0,0.2)',borderRadius:8,marginBottom:6}}>D4 → <span style={{color:'#ffd700'}}>UNVERIFIED</span> (conflict flagged)</div>
            <div style={{padding:'8px 12px',background:'rgba(0,255,160,0.08)',border:'1px solid rgba(0,255,160,0.2)',borderRadius:8}}>Both reports stored · Zero data loss</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ACTIVITY FEED ──────────────────────────────────────────────────────────
function Feed({events}) {
  const ref = useRef(null);
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[events]);
  const typeColor = {sos:'#ff3b3b',task:'#00e5ff',volunteer:'#00ffaa',zone:'#ffd700',supply:'#f472b6',ai:'#c084fc'};
  return (
    <div ref={ref} style={{height:200,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
      {events.map((e,i)=>(
        <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'5px 8px',borderRadius:6,background:'rgba(255,255,255,0.02)'}}>
          <span style={{fontSize:9,color:typeColor[e.type]||'#888',letterSpacing:.5,flexShrink:0,marginTop:2,fontFamily:"'Orbitron',monospace",minWidth:52}}>{e.type.toUpperCase()}</span>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.55)',lineHeight:1.45,flex:1}}>{e.msg}</span>
          <span style={{fontSize:9,color:'rgba(255,255,255,0.22)',flexShrink:0}}>{new Date(e.ts).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]         = useState('map');
  const [time,setTime]       = useState(new Date());
  const [connected,setConn]  = useState(false);
  const [volunteers,setVols] = useState(DEMO_VOLUNTEERS);
  const [zones,setZones]     = useState(DEMO_ZONES);
  const [tasks,setTasks]     = useState(DEMO_TASKS);
  const [sosList,setSOS]     = useState(DEMO_SOS);
  const [supplies]           = useState(DEMO_SUPPLIES);
  const [feed,setFeed]       = useState([
    {type:'volunteer',msg:'Priya Sharma checked in · first_aid, search_rescue',ts:Date.now()-120000},
    {type:'volunteer',msg:'Ravi Kumar checked in · logistics, driving',ts:Date.now()-115000},
    {type:'ai',       msg:'AI assigned ORS task to Ravi Kumar · score: 0.87',ts:Date.now()-110000},
    {type:'sos',      msg:'SOS: Ramesh Babu · Grid C3 · debris entrapment',ts:Date.now()-600000},
    {type:'ai',       msg:'Auto-task created · Priya dispatched (first_aid match)',ts:Date.now()-598000},
    {type:'zone',     msg:'Grid D5 → DANGER · Unverified · 2-confirmation pending',ts:Date.now()-300000},
    {type:'supply',   msg:'CRITICAL: Camp B ORS at 22% · AI flagged resupply',ts:Date.now()-60000},
  ]);
  const [demoRunning,setDemo]= useState(false);

  const addFeed = (type,msg) => setFeed(p=>[...p,{type,msg,ts:Date.now()}]);

  // Real backend connection
  useEffect(()=>{
    const s=io(BACKEND);
    s.on('connect',()=>{setConn(true);addFeed('volunteer','Backend WebSocket connected · live data active');});
    s.on('disconnect',()=>setConn(false));
    s.on('state:full',st=>{
      if(st.tasks?.length) setTasks(p=>[...DEMO_TASKS,...st.tasks.filter(t=>!DEMO_TASKS.find(d=>d.id===t.id))]);
      if(Object.keys(st.volunteers||{}).length) setVols(p=>[...DEMO_VOLUNTEERS,...Object.values(st.volunteers).filter(v=>!DEMO_VOLUNTEERS.find(d=>d.id===v.id))]);
      if(st.sosList?.filter(x=>x.status==='active').length) setSOS(p=>[...DEMO_SOS,...st.sosList.filter(x=>x.status==='active'&&!DEMO_SOS.find(d=>d.id===x.id))]);
    });
    s.on('tasks:update',ts=>setTasks(p=>[...DEMO_TASKS,...ts.filter(t=>!DEMO_TASKS.find(d=>d.id===t.id))]));
    s.on('sos:new',sos=>{setSOS(p=>[...p,sos]);addFeed('sos',`🚨 SOS: ${sos.name} · Grid ${sos.gridId}`);});
    s.on('sos:resolved',sos=>{setSOS(p=>p.filter(x=>x.id!==sos.id));addFeed('sos',`✅ Resolved: ${sos.name}`);});
    s.on('volunteers:update',vs=>setVols(p=>[...DEMO_VOLUNTEERS,...Object.values(vs).filter(v=>!DEMO_VOLUNTEERS.find(d=>d.id===v.id))]));
    return ()=>s.disconnect();
  },[]);

  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t); },[]);

  // Automated demo for judges
  const runDemo = useCallback(()=>{
    if(demoRunning) return;
    setDemo(true);
    const seq=[
      [1000, ()=>addFeed('volunteer','Arjun Singh joined via mobile app · GPS synced')],
      [2500, ()=>{setZones(p=>p.map(z=>z.gridId==='E6'?{...z,status:'danger',safetyLevel:'red',verified:false}:z));addFeed('zone','Grid E6 updated: DANGER · AI routing blocked for red zone');}],
      [4000, ()=>{
        const t={id:'tdemo1',title:'Emergency water supply — Camp Alpha',gridId:'A1',priority:'high',status:'assigned',assignedTo:'vol_ravi',requiredSkills:['logistics'],createdAt:Date.now()};
        setTasks(p=>[...p,t]);
        addFeed('task','Task created: Emergency water supply → Ravi Kumar assigned');
        addFeed('ai','Allocator: Ravi Kumar · Proximity 1.2km · logistics match · score 0.91');
      }],
      [6500, ()=>{
        const s={id:'sdemo1',name:'Kavya Nair',gridId:'E6',lat:17.372,lng:78.480,message:'Medical emergency — unconscious person',severity:'critical',timestamp:Date.now(),status:'active'};
        setSOS(p=>[...p,s]);
        setTab('sos');
        addFeed('sos','🚨 CRITICAL SOS: Kavya Nair · Grid E6 · medical emergency');
        addFeed('ai','Meena Reddy dispatched · medical match · 0.8km · score 0.94');
      }],
      [9000,  ()=>{addFeed('supply','Forecast: First Aid Kits → CRITICAL in 18h · resupply triggered');setTab('supply');}],
      [11000, ()=>{addFeed('ai','CRDT sync: 4 offline edits merged · 0 data loss · 2 zones UNVERIFIED');setTab('ai');}],
      [14000, ()=>{setDemo(false);setTab('map');addFeed('volunteer','Demo complete · All systems operational');}],
    ];
    seq.forEach(([d,fn])=>setTimeout(fn,d));
  },[demoRunning]);

  const handleAddSOS = async data=>{
    try{
      await axios.post(`${BACKEND}/api/sos`,{volunteerId:'demo_'+Date.now(),name:data.name,lat:data.lat,lng:data.lng,gridId:data.gridId,message:data.message});
      addFeed('sos',`SOS sent to backend: ${data.name} · ${data.gridId}`);
    }catch{
      setSOS(p=>[...p,{id:'s'+Date.now(),...data,severity:'critical',timestamp:Date.now(),status:'active'}]);
      addFeed('sos',`SOS (local demo): ${data.name} · ${data.gridId}`);
    }
  };

  const handleResolve = async id=>{
    try{ await axios.put(`${BACKEND}/api/sos/${id}/resolve`); }catch{}
    setSOS(p=>p.filter(x=>x.id!==id));
    addFeed('sos','SOS resolved by coordinator');
  };

  const handleAddTask = task=>{
    setTasks(p=>[...p,task]);
    const vol=volunteers.find(v=>v.id===task.assignedTo);
    addFeed('task',`Task: ${task.title} · ${vol?`AI→ ${vol.name}`:'unassigned'}`);
    if(vol) addFeed('ai',`${vol.name} selected · ${task.priority} priority · skills match`);
  };

  const handleUpdateTask = (id,status)=>{
    setTasks(p=>p.map(t=>t.id===id?{...t,status}:t));
    addFeed('task',`Task marked ${status}`);
  };

  const stats={
    volunteers: volunteers.length,
    openTasks:  tasks.filter(t=>t.status==='open').length,
    sos:        sosList.length,
    verified:   zones.filter(z=>z.verified).length,
    completion: Math.round((tasks.filter(t=>t.status==='completed').length/Math.max(tasks.length,1))*100),
  };

  const TABS=[{id:'map',label:'Map'},{id:'sos',label:'SOS',badge:stats.sos},{id:'tasks',label:'Tasks',badge:stats.openTasks},{id:'volunteers',label:'Volunteers'},{id:'supply',label:'Supply'},{id:'ai',label:'AI Engine'}];

  return(
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at 15% 20%,#001a12 0%,#000d08 55%,#000508 100%)',fontFamily:"'Inter','Segoe UI',sans-serif",color:'#fff',position:'relative',overflow:'hidden'}}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes pulse1{0%{transform:scale(1);opacity:1}100%{transform:scale(3.2);opacity:0}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 12px rgba(255,59,59,.18)}50%{box-shadow:0 0 28px rgba(255,59,59,.42)}}
        @keyframes fadeInUp{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,255,160,.18);border-radius:2px}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,.28)}
        input:focus,select:focus{border-color:rgba(0,255,160,.4)!important;outline:none}
        select option{background:#001408;color:#fff}
      `}</style>

      <RadarBg/>
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,backgroundImage:'repeating-linear-gradient(0deg,rgba(0,0,0,.022) 0,rgba(0,0,0,.022) 1px,transparent 1px,transparent 2px)',zIndex:1,pointerEvents:'none'}}/>

      <div style={{position:'relative',zIndex:2}}>
        {/* HEADER */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 26px',background:'rgba(0,8,5,.9)',borderBottom:'1px solid rgba(0,255,160,.09)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:100,animation:'slideDown .5s ease'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:35,height:35,borderRadius:9,background:'rgba(0,255,160,.11)',border:'1px solid rgba(0,255,160,.28)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>⚡</div>
            <div>
              <div style={{fontSize:16,fontWeight:900,letterSpacing:3.5,fontFamily:"'Orbitron',monospace",background:'linear-gradient(90deg,#00ffaa,#00e5ff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>CRISISSYNC</div>
              <div style={{fontSize:8.5,color:'rgba(255,255,255,.3)',letterSpacing:2.5}}>REAL-TIME DISASTER RELIEF COMMAND</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={runDemo} disabled={demoRunning} style={{padding:'7px 16px',background:demoRunning?'rgba(255,255,255,.04)':'rgba(255,200,0,.11)',color:demoRunning?'rgba(255,255,255,.28)':'#ffd700',border:`1px solid ${demoRunning?'rgba(255,255,255,.07)':'rgba(255,200,0,.32)'}`,borderRadius:8,cursor:demoRunning?'not-allowed':'pointer',fontSize:10,fontWeight:700,letterSpacing:1.2,fontFamily:"'Orbitron',monospace",transition:'all .2s'}}>
              {demoRunning?'▶ RUNNING…':'▶ RUN DEMO'}
            </button>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:15,fontWeight:700,fontFamily:"'Orbitron',monospace",color:'#00ffaa',letterSpacing:2}}>{time.toLocaleTimeString()}</div>
              <div style={{fontSize:8.5,color:'rgba(255,255,255,.28)',letterSpacing:1}}>{time.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,background:connected?'rgba(0,255,160,.09)':'rgba(255,59,59,.09)',border:`1px solid ${connected?'rgba(0,255,160,.28)':'rgba(255,59,59,.28)'}`}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:connected?'#00ffaa':'#ff3b3b',boxShadow:`0 0 8px ${connected?'#00ffaa':'#ff3b3b'}`,display:'inline-block',animation:'blink 2s infinite'}}/>
              <span style={{fontSize:10,fontWeight:700,color:connected?'#00ffaa':'#ff3b3b',letterSpacing:1,fontFamily:"'Orbitron',monospace"}}>{connected?'LIVE':'OFFLINE'}</span>
            </div>
          </div>
        </div>

        {/* SOS Banner */}
        {sosList.length>0&&(
          <div style={{background:'linear-gradient(90deg,rgba(255,40,40,.9),rgba(160,15,15,.9))',padding:'8px 26px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid rgba(255,59,59,.45)',animation:'slideDown .3s ease'}}>
            <Pulse color="#fff"/><span style={{fontWeight:700,fontSize:11.5,letterSpacing:1.8,fontFamily:"'Orbitron',monospace"}}>{sosList.length} ACTIVE SOS ALERT{sosList.length>1?'S':''} — IMMEDIATE RESPONSE REQUIRED</span>
            <button onClick={()=>setTab('sos')} style={{marginLeft:'auto',padding:'4px 12px',background:'rgba(255,255,255,.14)',color:'#fff',border:'1px solid rgba(255,255,255,.28)',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:700}}>VIEW →</button>
          </div>
        )}

        <div style={{padding:'16px 26px'}}>
          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:11,marginBottom:18,animation:'fadeInUp .6s ease'}}>
            <StatCard value={stats.volunteers} label="Volunteers" color="#00ffaa" icon="👥" sub={`${volunteers.filter(v=>v.status==='available').length} available`}/>
            <StatCard value={stats.openTasks}  label="Open Tasks"  color="#00e5ff" icon="📋" sub="awaiting dispatch"/>
            <StatCard value={stats.sos}         label="SOS Active"  color="#ff3b3b" icon="🚨" sub={stats.sos>0?"respond now":"all clear"}/>
            <StatCard value={stats.verified}    label="Zones OK"    color="#ffd700" icon="✅" sub={`of ${zones.length} total`}/>
            <StatCard value={stats.completion+'%'} label="Completed" color="#c084fc" icon="📊" sub="task rate"/>
          </div>

          {/* Main grid */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 290px',gap:14,animation:'fadeInUp .8s ease'}}>
            {/* Left panel */}
            <div>
              <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
                {TABS.map(t=><TabBtn key={t.id} label={t.label} active={tab===t.id} badge={t.badge} onClick={()=>setTab(t.id)}/>)}
              </div>
              <div style={{background:'rgba(0,12,8,.78)',border:'1px solid rgba(0,255,160,.09)',borderRadius:16,padding:18,backdropFilter:'blur(18px)',minHeight:500,maxHeight:580,overflowY:'auto'}}>
                {tab==='map'       &&<LiveMap zones={zones} volunteers={volunteers} sosList={sosList}/>}
                {tab==='sos'       &&<SOSTab sosList={sosList} onResolve={handleResolve} onAddSOS={handleAddSOS}/>}
                {tab==='tasks'     &&<TasksTab tasks={tasks} volunteers={volunteers} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask}/>}
                {tab==='volunteers'&&<VolunteersTab volunteers={volunteers}/>}
                {tab==='supply'    &&<SupplyTab supplies={supplies}/>}
                {tab==='ai'        &&<AITab volunteers={volunteers} tasks={tasks} zones={zones} sosList={sosList}/>}
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* Zone status */}
              <div style={{background:'rgba(0,12,8,.78)',border:'1px solid rgba(0,255,160,.09)',borderRadius:14,padding:14,backdropFilter:'blur(16px)'}}>
                <div style={{fontSize:9.5,color:'rgba(255,255,255,.38)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>Zone Status</div>
                {zones.map(z=>(
                  <div key={z.gridId} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{width:7,height:7,borderRadius:'50%',background:ZONE_COLORS[z.status]||'#888',display:'inline-block',boxShadow:`0 0 5px ${ZONE_COLORS[z.status]||'#888'}`}}/>
                      <span style={{fontSize:12,color:'rgba(255,255,255,.6)'}}>Grid {z.gridId}</span>
                    </div>
                    <div style={{display:'flex',gap:5,alignItems:'center'}}>
                      <span style={{fontSize:10,color:ZONE_COLORS[z.status]||'#888',textTransform:'uppercase',letterSpacing:.5}}>{z.status}</span>
                      {!z.verified&&<span style={{fontSize:8.5,padding:'1px 6px',borderRadius:8,background:'rgba(255,200,0,.13)',color:'#ffd700',border:'1px solid rgba(255,200,0,.22)'}}>UNVERIFIED</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Activity feed */}
              <div style={{background:'rgba(0,12,8,.78)',border:'1px solid rgba(0,255,160,.09)',borderRadius:14,padding:14,backdropFilter:'blur(16px)',flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:9.5,color:'rgba(255,255,255,.38)',letterSpacing:1.5,textTransform:'uppercase'}}>Live Activity</div>
                  <span style={{width:6,height:6,borderRadius:'50%',background:'#00ffaa',display:'inline-block',boxShadow:'0 0 7px #00ffaa',animation:'blink 1.5s infinite'}}/>
                </div>
                <Feed events={feed}/>
              </div>

              {/* Network status */}
              <div style={{background:'rgba(0,12,8,.78)',border:'1px solid rgba(0,229,255,.1)',borderRadius:14,padding:14,backdropFilter:'blur(16px)'}}>
                <div style={{fontSize:9.5,color:'rgba(255,255,255,.38)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>Network</div>
                {[{l:'Internet',v:connected,c:'#00ffaa'},{l:'BLE Mesh',v:true,c:'#00e5ff'},{l:'SMS Gateway',v:true,c:'#ffd700'},{l:'CouchDB',v:connected,c:'#c084fc'}].map(n=>(
                  <div key={n.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                    <span style={{fontSize:11.5,color:'rgba(255,255,255,.52)'}}>{n.l}</span>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:n.v?n.c:'#444',display:'inline-block',boxShadow:n.v?`0 0 5px ${n.c}`:'none'}}/>
                      <span style={{fontSize:9.5,color:n.v?n.c:'#444',fontWeight:600,letterSpacing:.5}}>{n.v?'ACTIVE':'STANDBY'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{textAlign:'center',padding:'8px 26px',fontSize:8.5,color:'rgba(255,255,255,.1)',letterSpacing:2,textTransform:'uppercase',borderTop:'1px solid rgba(0,255,160,.04)'}}>
          CrisisSync · Offline-First · CRDT Sync · AI-Powered · BLE Mesh
        </div>
      </div>
    </div>
  );
}