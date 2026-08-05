"use client";

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type DailyEntry = {
  id?: string; entry_date: string; sleep_hours?: number|null; sleep_quality?: number|null;
  energy?: number|null; mood?: number|null; stress?: number|null; focus?: number|null;
  confidence?: number|null; overall_score?: number|null; mission?: string|null;
  priority_1?: string|null; priority_2?: string|null; priority_3?: string|null;
  pillar_scores?: Record<string, number>; pillar_actions?: Record<string, string>;
  opportunity?: string|null; risk?: string|null; avoiding?: string|null; delegate_task?: string|null;
  automate_task?: string|null; relationship_who?: string|null; relationship_action?: string|null;
  relationship_promise?: string|null; listened?: string|null; habits?: Record<string, boolean>;
  learning_plan?: string|null; lesson?: string|null; wins?: string|null; improvement?: string|null;
  gratitude?: string|null; tomorrow_mission?: string|null;
};

const tabs = ['Dashboard','Daily','History','Weekly','Business','Sales','Relationships','Health','Goals','Vision'];
const pillars = ['Me','Relationships','Business','Money','Life','Growth'];
const habits = ['Exercise','Water','Healthy meals','Walk','No smoking','Recovery time'];
const today = new Date().toISOString().slice(0,10);

const blankDaily: DailyEntry = {
  entry_date: today, pillar_scores: {}, pillar_actions: {}, habits: {}
};

export default function Home() {
  const [session, setSession] = useState<Session|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="loginWrap"><div className="loginCard">Loading…</div></div>;
  if (!session) return <Login />;
  return <BlueprintApp session={session} />;
}

function Login() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [message,setMessage]=useState('');
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); setMessage('');
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error)setMessage(error.message);
  };
  return <div className="loginWrap"><form className="loginCard" onSubmit={submit}>
    <h1>The James Blueprint</h1><p className="muted">Private cloud access</p>
    <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
    <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
    <button className="btn primary" style={{width:'100%'}}>Sign in</button>
    {message&&<div className="error">{message}</div>}
  </form></div>
}

function BlueprintApp({session}:{session:Session}) {
  const [tab,setTab]=useState('Dashboard');
  const [daily,setDaily]=useState<DailyEntry>(blankDaily);
  const [entries,setEntries]=useState<DailyEntry[]>([]);
  const [sidebar,setSidebar]=useState(false);
  const [weekly,setWeekly]=useState<any[]>([]);
  const [leads,setLeads]=useState<any[]>([]);
  const [goals,setGoals]=useState<any[]>([]);
  const [business,setBusiness]=useState<any>({});
  const [settings,setSettings]=useState<any>({});

  const loadAll=async()=>{
    const [{data:e},{data:w},{data:l},{data:g},{data:b},{data:s}] = await Promise.all([
      supabase.from('daily_entries').select('*').order('entry_date'),
      supabase.from('weekly_reviews').select('*').order('week_start',{ascending:false}),
      supabase.from('sales_leads').select('*').order('created_at',{ascending:false}),
      supabase.from('goals').select('*').order('created_at',{ascending:false}),
      supabase.from('business_snapshots').select('*').order('snapshot_date',{ascending:false}).limit(1),
      supabase.from('app_settings').select('*').maybeSingle()
    ]);
    setEntries(e||[]); setWeekly(w||[]); setLeads(l||[]); setGoals(g||[]); setBusiness((b||[])[0]||{}); setSettings(s||{});
  };
  useEffect(()=>{loadAll()},[]);

  const saveDaily=async()=>{
    const payload={...daily,user_id:session.user.id};
    const {error}=await supabase.from('daily_entries').upsert(payload,{onConflict:'user_id,entry_date'});
    if(error) alert(error.message); else {alert('Daily record saved.'); await loadAll();}
  };
  const editDaily=(e:DailyEntry)=>{setDaily(e);setTab('Daily')};
  const deleteDaily=async(id?:string)=>{if(!id||!confirm('Delete this record?'))return;await supabase.from('daily_entries').delete().eq('id',id);loadAll()};

  const title=tab==='Daily'?'Daily Command Centre':tab;
  return <div className="shell">
    <aside className={`sidebar ${sidebar?'open':''}`}>
      <div className="brand">THE JAMES BLUEPRINT<small>PRIVATE CLOUD</small></div>
      <nav className="nav">{tabs.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>{setTab(t);setSidebar(false)}}>{t}</button>)}</nav>
      <div className="sidebarFooter">{session.user.email}<br/><button className="btn" style={{marginTop:8}} onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
    </aside>
    <main className="main">
      <div className="topbar">
        <div style={{display:'flex',gap:10,alignItems:'center'}}><button className="btn mobileMenu" onClick={()=>setSidebar(!sidebar)}>☰</button><div><h1>{title}</h1><div className="muted">{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div></div>
      </div>
      {tab==='Dashboard'&&<Dashboard entries={entries} goals={goals} leads={leads}/>}
      {tab==='Daily'&&<DailyForm value={daily} setValue={setDaily} save={saveDaily}/>}
      {tab==='History'&&<History entries={entries} edit={editDaily} remove={deleteDaily}/>}
      {tab==='Weekly'&&<Weekly session={session} records={weekly} reload={loadAll}/>}
      {tab==='Business'&&<Business session={session} value={business} reload={loadAll}/>}
      {tab==='Sales'&&<Sales session={session} leads={leads} reload={loadAll}/>}
      {tab==='Relationships'&&<Relationships session={session} entries={entries} settings={settings} reload={loadAll}/>}
      {tab==='Health'&&<Health entries={entries}/>}
      {tab==='Goals'&&<Goals session={session} goals={goals} reload={loadAll}/>}
      {tab==='Vision'&&<Vision session={session} settings={settings} reload={loadAll}/>}
    </main>
  </div>
}

function Dashboard({entries,goals,leads}:{entries:DailyEntry[],goals:any[],leads:any[]}) {
  const recent=entries.slice(-30);
  const avg=(key:keyof DailyEntry)=>recent.length?recent.reduce((a,e)=>a+(Number(e[key])||0),0)/recent.length:0;
  const chart=recent.map(e=>({date:e.entry_date.slice(5),overall:e.overall_score||0,sleep:e.sleep_hours||0,energy:e.energy||0}));
  return <>
    <div className="grid cols4">
      <Kpi label="Saved days" value={entries.length}/>
      <Kpi label="Average overall" value={`${avg('overall_score').toFixed(1)}/10`}/>
      <Kpi label="Average sleep" value={`${avg('sleep_hours').toFixed(1)} hrs`}/>
      <Kpi label="Active goals" value={goals.filter(g=>g.status!=='Complete').length}/>
    </div>
    <div className="grid cols2" style={{marginTop:18}}>
      <ChartCard title="30-day overall score" data={chart} keys={['overall']}/>
      <ChartCard title="Sleep and energy" data={chart} keys={['sleep','energy']}/>
    </div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>Latest mission</h2><div className="listItem">{entries.at(-1)?.mission||'No daily record saved yet.'}</div></div>
      <div className="card"><h2>Sales pipeline</h2><div className="kpi">{leads.filter(l=>!['Won','Lost'].includes(l.stage)).length}</div><div className="muted">open opportunities</div></div>
    </div>
  </>
}

function Kpi({label,value}:{label:string,value:any}){return <div className="card"><div className="kpiLabel">{label}</div><div className="kpi">{value}</div></div>}
function ChartCard({title,data,keys}:{title:string,data:any[],keys:string[]}){return <div className="card"><h2>{title}</h2><div style={{width:'100%',height:240}}><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/>{keys.map((k,i)=><Line key={k} type="monotone" dataKey={k} stroke={i===0?'#22262b':'#8d98a5'} strokeWidth={2}/>)}</LineChart></ResponsiveContainer></div></div>}

function DailyForm({value,setValue,save}:{value:DailyEntry,setValue:any,save:()=>void}) {
  const set=(k:keyof DailyEntry,v:any)=>setValue((p:DailyEntry)=>({...p,[k]:v}));
  const setP=(group:'pillar_scores'|'pillar_actions',k:string,v:any)=>setValue((p:DailyEntry)=>({...p,[group]:{...(p[group]||{}),[k]:v}}));
  return <>
    <div className="notice">Complete the morning sections first, then finish the evening review before saving.</div>
    <div className="grid cols3">
      <div className="card"><h2>Day details</h2><Field label="Date"><input type="date" value={value.entry_date} onChange={e=>set('entry_date',e.target.value)}/></Field><Num label="Hours slept" value={value.sleep_hours} set={v=>set('sleep_hours',v)} step=".25"/><Num label="Sleep quality" value={value.sleep_quality} set={v=>set('sleep_quality',v)}/></div>
      <div className="card"><h2>Morning check-in</h2><Num label="Energy" value={value.energy} set={v=>set('energy',v)}/><Num label="Mood" value={value.mood} set={v=>set('mood',v)}/><Num label="Stress" value={value.stress} set={v=>set('stress',v)}/></div>
      <div className="card"><h2>Mindset</h2><Num label="Focus" value={value.focus} set={v=>set('focus',v)}/><Num label="Confidence" value={value.confidence} set={v=>set('confidence',v)}/><Num label="Overall score" value={value.overall_score} set={v=>set('overall_score',v)}/></div>
    </div>
    <div className="card" style={{marginTop:18}}><h2>Today’s direction</h2><Text label="My ONE mission" value={value.mission} set={v=>set('mission',v)}/><div className="grid cols3"><Text label="Priority 1" value={value.priority_1} set={v=>set('priority_1',v)} input/><Text label="Priority 2" value={value.priority_2} set={v=>set('priority_2',v)} input/><Text label="Priority 3" value={value.priority_3} set={v=>set('priority_3',v)} input/></div></div>
    <div className="card" style={{marginTop:18}}><h2>Six pillars</h2><div className="pillars">{pillars.map(p=><div className="pillar" key={p}><strong>{p}</strong><Num label="Score" value={value.pillar_scores?.[p]} set={v=>setP('pillar_scores',p,v)}/><Text label="One action today" value={value.pillar_actions?.[p]} set={v=>setP('pillar_actions',p,v)} input/></div>)}</div></div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>CEO focus</h2><Text label="Biggest opportunity" value={value.opportunity} set={v=>set('opportunity',v)}/><Text label="Biggest risk" value={value.risk} set={v=>set('risk',v)}/><Text label="Decision I am avoiding" value={value.avoiding} set={v=>set('avoiding',v)}/><Text label="One thing to delegate" value={value.delegate_task} set={v=>set('delegate_task',v)} input/><Text label="One thing to automate" value={value.automate_task} set={v=>set('automate_task',v)} input/></div>
      <div className="card"><h2>Relationship compass</h2><Text label="Who needs my attention?" value={value.relationship_who} set={v=>set('relationship_who',v)}/><Text label="How will I show appreciation?" value={value.relationship_action} set={v=>set('relationship_action',v)}/><Text label="One promise I will keep" value={value.relationship_promise} set={v=>set('relationship_promise',v)}/><Field label="Did I genuinely listen?"><select value={value.listened||''} onChange={e=>set('listened',e.target.value)}><option value="">Select</option><option>Yes</option><option>Mostly</option><option>No</option></select></Field></div>
    </div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>Health habits</h2><div className="checks">{habits.map(h=><label className="check" key={h}><input type="checkbox" checked={!!value.habits?.[h]} onChange={e=>setValue((p:DailyEntry)=>({...p,habits:{...(p.habits||{}),[h]:e.target.checked}}))}/>{h}</label>)}</div></div>
      <div className="card"><h2>Learning</h2><Text label="What will I learn today?" value={value.learning_plan} set={v=>set('learning_plan',v)}/><Text label="Biggest lesson" value={value.lesson} set={v=>set('lesson',v)}/></div>
    </div>
    <div className="card" style={{marginTop:18}}><h2>Evening review</h2><div className="grid cols2"><Text label="Three wins" value={value.wins} set={v=>set('wins',v)}/><Text label="What could I improve?" value={value.improvement} set={v=>set('improvement',v)}/><Text label="What am I grateful for?" value={value.gratitude} set={v=>set('gratitude',v)}/><Text label="Tomorrow’s mission" value={value.tomorrow_mission} set={v=>set('tomorrow_mission',v)}/></div></div>
    <div className="actions" style={{marginTop:18}}><button className="btn primary" onClick={save}>Save daily record</button><button className="btn" onClick={()=>setValue(blankDaily)}>New blank day</button></div>
  </>
}

function Field({label,children}:{label:string,children:any}){return <div className="field"><label>{label}</label>{children}</div>}
function Num({label,value,set,step}:{label:string,value:any,set:(v:any)=>void,step?:string}){return <Field label={`${label} (1–10 where applicable)`}><input type="number" min="0" max="24" step={step||"1"} value={value??''} onChange={e=>set(e.target.value===''?null:Number(e.target.value))}/></Field>}
function Text({label,value,set,input}:{label:string,value:any,set:(v:string)=>void,input?:boolean}){return <Field label={label}>{input?<input value={value||''} onChange={e=>set(e.target.value)}/>:<textarea value={value||''} onChange={e=>set(e.target.value)}/>}</Field>}

function History({entries,edit,remove}:{entries:DailyEntry[],edit:(e:DailyEntry)=>void,remove:(id?:string)=>void}) {
  return <div className="card"><h2>Daily records</h2>{entries.length?<table className="table"><thead><tr><th>Date</th><th>Mission</th><th>Sleep</th><th>Energy</th><th>Overall</th><th></th></tr></thead><tbody>{[...entries].reverse().map(e=><tr key={e.id}><td>{e.entry_date}</td><td>{e.mission}</td><td>{e.sleep_hours??'-'}</td><td>{e.energy??'-'}</td><td><span className="badge">{e.overall_score??'-'}/10</span></td><td><button className="btn" onClick={()=>edit(e)}>Open</button> <button className="btn danger" onClick={()=>remove(e.id)}>Delete</button></td></tr>)}</tbody></table>:<div className="muted">No records yet.</div>}</div>
}

function Weekly({session,records,reload}:{session:Session,records:any[],reload:()=>void}) {
  const [f,setF]=useState<any>({week_start:today});
  const saveIt=async()=>{const {error}=await supabase.from('weekly_reviews').insert({...f,user_id:session.user.id});if(error)alert(error.message);else{setF({week_start:today});reload()}};
  return <><div className="grid cols2"><div className="card"><h2>Weekly review</h2><Field label="Week commencing"><input type="date" value={f.week_start} onChange={e=>setF({...f,week_start:e.target.value})}/></Field><Text label="Biggest wins" value={f.wins} set={v=>setF({...f,wins:v})}/><Text label="Biggest lessons" value={f.lessons} set={v=>setF({...f,lessons:v})}/><Text label="What did not work?" value={f.not_worked} set={v=>setF({...f,not_worked:v})}/></div><div className="card"><h2>Next week</h2><Text label="Top priority" value={f.priority} set={v=>setF({...f,priority:v})}/><Text label="Three key actions" value={f.actions} set={v=>setF({...f,actions:v})}/><Text label="Relationship intention" value={f.relationship_intention} set={v=>setF({...f,relationship_intention:v})}/><Text label="Health intention" value={f.health_intention} set={v=>setF({...f,health_intention:v})}/><button className="btn primary" onClick={saveIt}>Save weekly review</button></div></div><div className="card" style={{marginTop:18}}><h2>Saved reviews</h2><div className="list">{records.map(r=><div className="listItem" key={r.id}><strong>{r.week_start}</strong><br/>{r.priority}</div>)}</div></div></>
}

function Business({session,value,reload}:{session:Session,value:any,reload:()=>void}) {
  const [f,setF]=useState<any>(value||{}); useEffect(()=>setF(value||{}),[value]);
  const saveIt=async()=>{const payload={...f,user_id:session.user.id,snapshot_date:today};delete payload.id;const {error}=await supabase.from('business_snapshots').upsert(payload,{onConflict:'user_id,snapshot_date'});if(error)alert(error.message);else reload()};
  return <><div className="grid cols4">{[['Sales target','sales_target'],['Actual sales','sales_actual'],['Gross profit','gross_profit'],['Money owed','debtors']].map(([l,k])=><div className="card" key={k}><div className="kpiLabel">{l}</div><input type="number" value={f[k]??''} onChange={e=>setF({...f,[k]:Number(e.target.value)})}/></div>)}</div><div className="card" style={{marginTop:18}}><h2>CEO notes</h2><textarea value={f.notes||''} onChange={e=>setF({...f,notes:e.target.value})}/><button className="btn primary" style={{marginTop:10}} onClick={saveIt}>Save business snapshot</button></div></>
}

function Sales({session,leads,reload}:{session:Session,leads:any[],reload:()=>void}) {
  const [f,setF]=useState<any>({stage:'Prospect'});
  const add=async()=>{const {error}=await supabase.from('sales_leads').insert({...f,user_id:session.user.id});if(error)alert(error.message);else{setF({stage:'Prospect'});reload()}};
  const del=async(id:string)=>{await supabase.from('sales_leads').delete().eq('id',id);reload()};
  return <div className="card"><h2>Sales pipeline</h2><div className="grid cols4"><input placeholder="Prospect/customer" value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/><input placeholder="Contact details" value={f.contact||''} onChange={e=>setF({...f,contact:e.target.value})}/><select value={f.stage} onChange={e=>setF({...f,stage:e.target.value})}>{['Prospect','Contacted','Meeting','Quoted','Won','Lost'].map(x=><option key={x}>{x}</option>)}</select><input placeholder="Next action" value={f.next_action||''} onChange={e=>setF({...f,next_action:e.target.value})}/></div><button className="btn primary" style={{marginTop:10}} onClick={add}>Add record</button><table className="table" style={{marginTop:18}}><thead><tr><th>Name</th><th>Stage</th><th>Contact</th><th>Next action</th><th></th></tr></thead><tbody>{leads.map(l=><tr key={l.id}><td>{l.name}</td><td><span className="badge">{l.stage}</span></td><td>{l.contact}</td><td>{l.next_action}</td><td><button className="btn danger" onClick={()=>del(l.id)}>Delete</button></td></tr>)}</tbody></table></div>
}

function Relationships({session,entries,settings,reload}:{session:Session,entries:DailyEntry[],settings:any,reload:()=>void}) {
  const [notes,setNotes]=useState(settings.relationship_notes||''); const [ideas,setIdeas]=useState(settings.date_ideas||'');
  useEffect(()=>{setNotes(settings.relationship_notes||'');setIdeas(settings.date_ideas||'')},[settings]);
  const saveIt=async()=>{const payload={user_id:session.user.id,relationship_notes:notes,date_ideas:ideas,mission_statement:settings.mission_statement||''};const {error}=await supabase.from('app_settings').upsert(payload,{onConflict:'user_id'});if(error)alert(error.message);else reload()};
  const data=entries.slice(-30).map(e=>({date:e.entry_date.slice(5),score:e.pillar_scores?.Relationships||0}));
  return <div className="grid cols2"><div className="card"><h2>Connection notes</h2><Text label="Important things to remember" value={notes} set={setNotes}/><Text label="Ideas for quality time" value={ideas} set={setIdeas}/><button className="btn primary" onClick={saveIt}>Save</button></div><ChartCard title="Relationship trend" data={data} keys={['score']}/></div>
}

function Health({entries}:{entries:DailyEntry[]}) {
  const recent=entries.slice(-30); const avg=(k:keyof DailyEntry)=>recent.length?recent.reduce((a,e)=>a+(Number(e[k])||0),0)/recent.length:0;
  const data=recent.map(e=>({date:e.entry_date.slice(5),sleep:e.sleep_hours||0,energy:e.energy||0}));
  return <><div className="grid cols3"><Kpi label="Average sleep" value={`${avg('sleep_hours').toFixed(1)} hrs`}/><Kpi label="Average energy" value={`${avg('energy').toFixed(1)}/10`}/><Kpi label="Exercise days" value={recent.filter(e=>e.habits?.Exercise).length}/></div><div style={{marginTop:18}}><ChartCard title="Sleep and energy" data={data} keys={['sleep','energy']}/></div></>
}

function Goals({session,goals,reload}:{session:Session,goals:any[],reload:()=>void}) {
  const [f,setF]=useState<any>({status:'Not started'}); const add=async()=>{const {error}=await supabase.from('goals').insert({...f,user_id:session.user.id});if(error)alert(error.message);else{setF({status:'Not started'});reload()}};
  const del=async(id:string)=>{await supabase.from('goals').delete().eq('id',id);reload()};
  return <div className="card"><h2>Goals & projects</h2><div className="grid cols4"><input placeholder="Goal or project" value={f.title||''} onChange={e=>setF({...f,title:e.target.value})}/><input placeholder="Next action" value={f.next_action||''} onChange={e=>setF({...f,next_action:e.target.value})}/><input type="date" value={f.deadline||''} onChange={e=>setF({...f,deadline:e.target.value})}/><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{['Not started','In progress','Waiting','Complete'].map(x=><option key={x}>{x}</option>)}</select></div><button className="btn primary" style={{marginTop:10}} onClick={add}>Add goal</button><div className="list" style={{marginTop:18}}>{goals.map(g=><div className="listItem" key={g.id}><strong>{g.title}</strong> <span className="badge">{g.status}</span><div className="muted small">Next: {g.next_action||'Not set'} · Deadline: {g.deadline||'Not set'}</div><button className="btn danger" style={{marginTop:8}} onClick={()=>del(g.id)}>Delete</button></div>)}</div></div>
}

function Vision({session,settings,reload}:{session:Session,settings:any,reload:()=>void}) {
  const [mission,setMission]=useState(settings.mission_statement||'To build a life I am proud of through integrity, discipline, kindness, meaningful relationships, good health and a successful business.');
  useEffect(()=>setMission(settings.mission_statement||mission),[settings]);
  const saveIt=async()=>{const payload={user_id:session.user.id,mission_statement:mission,relationship_notes:settings.relationship_notes||'',date_ideas:settings.date_ideas||''};const {error}=await supabase.from('app_settings').upsert(payload,{onConflict:'user_id'});if(error)alert(error.message);else reload()};
  return <div className="grid cols2"><div className="card"><h2>My mission</h2><textarea style={{minHeight:220}} value={mission} onChange={e=>setMission(e.target.value)}/><button className="btn primary" style={{marginTop:10}} onClick={saveIt}>Save mission</button></div><div className="card"><h2>The James Standard</h2><div className="list">{['I keep my word.','I do difficult things before easy things.','I listen before I respond.','I take responsibility.','I protect my health and relationships.','I improve the business every day.','I build a business that serves my life.'].map(x=><div className="listItem" key={x}>{x}</div>)}</div></div></div>
}
