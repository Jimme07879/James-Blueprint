"use client";

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

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

const tabs = ['Home','Daily','Stevie','Me','Relationships','Health','Goals','CEO','Analytics','Weekly','Business Hub','Settings'];
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
    <h1>Blueprint OS</h1><p className="muted">Designed for James · Private cloud</p>
    <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
    <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
    <button className="btn primary" style={{width:'100%'}}>Sign in</button>
    {message&&<div className="error">{message}</div>}
  </form></div>
}

function BlueprintApp({session}:{session:Session}) {
  const [tab,setTab]=useState('Home');
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
    const entryRows=(e||[]) as DailyEntry[];
    setEntries(entryRows); setWeekly(w||[]); setLeads(l||[]); setGoals(g||[]); setBusiness((b||[])[0]||{}); setSettings(s||{});
    const todaysEntry=entryRows.find(row=>row.entry_date===today);
    setDaily(todaysEntry||blankDaily);
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
      <div className="brand">BLUEPRINT OS<small>DESIGNED FOR JAMES</small></div>
      <nav className="nav">{tabs.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>{setTab(t);setSidebar(false)}}>{t}</button>)}</nav>
      <div className="sidebarFooter">{session.user.email}<br/><button className="btn" style={{marginTop:8}} onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
    </aside>
    <main className="main">
      <div className="topbar">
        <div style={{display:'flex',gap:10,alignItems:'center'}}><button className="btn mobileMenu" onClick={()=>setSidebar(!sidebar)}>☰</button><div><h1>{title}</h1><div className="muted">{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div></div>
      </div>
      {tab==='Home'&&<Dashboard entries={entries} goals={goals} leads={leads}/>}
      {tab==='Daily'&&<DailyForm value={daily} setValue={setDaily} save={saveDaily}/>}
      {tab==='Me'&&<MeCentre entries={entries} edit={editDaily}/>}
      {tab==='Relationships'&&<Relationships session={session} entries={entries} settings={settings} reload={loadAll}/>}
      {tab==='Health'&&<Health entries={entries}/>}
      {tab==='Goals'&&<Goals session={session} goals={goals} reload={loadAll}/>}
      {tab==='CEO'&&<CEOCentre entries={entries} business={business} leads={leads} setTab={setTab}/>}
      {tab==='Analytics'&&<Analytics entries={entries}/>}
      {tab==='Weekly'&&<Weekly session={session} records={weekly} entries={entries} reload={loadAll}/>}
      {tab==='Business Hub'&&<BusinessIntegration business={business} leads={leads} setTab={setTab}/>}
      {tab==='Settings'&&<Vision session={session} settings={settings} reload={loadAll}/>}
    </main>
  </div>
}


type StevieBrief = {
  headline:string; summary:string; action:string; observations:string[]; wins:string[]; cautions:string[];
};

function numericAverage(values:(number|null|undefined)[]){
  const valid=values.map(Number).filter(v=>Number.isFinite(v)&&v>0);
  return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:0;
}

function buildStevieBrief(entries:DailyEntry[],goals:any[],leads:any[]):StevieBrief {
  const last7=entries.slice(-7);
  const previous7=entries.slice(-14,-7);
  const latest=entries.at(-1);
  const sleep=numericAverage(last7.map(e=>e.sleep_hours));
  const energy=numericAverage(last7.map(e=>e.energy));
  const mood=numericAverage(last7.map(e=>e.mood));
  const stress=numericAverage(last7.map(e=>e.stress));
  const previousEnergy=numericAverage(previous7.map(e=>e.energy));
  const exercise=last7.filter(e=>e.habits?.Exercise).length;
  const recovery=last7.filter(e=>e.habits?.['Recovery time']).length;
  const relationshipActions=last7.filter(e=>e.relationship_action).length;
  const openLeads=leads.filter(l=>!['Won','Lost'].includes(l.stage)).length;
  const overdueGoals=goals.filter(g=>g.status!=='Complete'&&g.deadline&&g.deadline<today).length;
  const observations:string[]=[];
  const wins:string[]=[];
  const cautions:string[]=[];

  if(sleep&&sleep<6) cautions.push(`Your seven-day sleep average is ${sleep.toFixed(1)} hours.`);
  else if(sleep>=7) wins.push(`Sleep is averaging ${sleep.toFixed(1)} hours.`);
  if(previousEnergy&&energy<previousEnergy-.7) cautions.push(`Energy has dropped from ${previousEnergy.toFixed(1)} to ${energy.toFixed(1)}.`);
  else if(energy>=7) wins.push(`Energy is holding strongly at ${energy.toFixed(1)}/10.`);
  if(stress>=7) cautions.push(`Stress is averaging ${stress.toFixed(1)}/10.`);
  if(exercise>=3) wins.push(`You exercised on ${exercise} of the last seven recorded days.`);
  else observations.push(`Exercise was recorded on ${exercise} of the last seven days.`);
  if(recovery<2) cautions.push('Recovery time has been limited this week.');
  if(relationshipActions>=5) wins.push('You have been consistently planning relationship actions.');
  else observations.push(`Relationship actions were planned on ${relationshipActions} recent days.`);
  if(openLeads) observations.push(`${openLeads} sales opportunities remain open.`);
  if(overdueGoals) cautions.push(`${overdueGoals} goal${overdueGoals===1?' is':'s are'} overdue.`);
  if(latest?.avoiding) cautions.push(`You recorded an avoided decision: ${latest.avoiding}`);

  let headline='Keep the day balanced.';
  let summary='Your data is still building. Consistency will make the briefing more useful.';
  let action=latest?.mission||'Complete today’s check-in and choose one meaningful action in work, health and relationships.';

  if(cautions.some(x=>x.includes('sleep'))){
    headline='Protect your energy before pushing harder.';
    summary='Recent sleep is likely to affect focus, patience and decision-making.';
    action='Keep today’s mission focused and protect a realistic recovery window.';
  } else if(latest?.avoiding){
    headline='The avoided decision deserves your attention.';
    summary='Unresolved decisions create background pressure and often keep returning.';
    action='Define the smallest next step and complete it before lower-value work.';
  } else if(openLeads>=3){
    headline='There is commercial opportunity waiting.';
    summary='Your pipeline contains several open opportunities, but the rest of life still needs protecting.';
    action='Complete one focused sales block, then deliberately switch attention to health or relationships.';
  } else if(energy>=7&&mood>=7){
    headline='You have good momentum today.';
    summary='Energy and mood are both supporting purposeful action.';
    action='Use the strongest part of the day for the task that requires courage or concentration.';
  }

  return {headline,summary,action,observations,wins,cautions};
}

function StevieCentre({entries,goals,leads,business,setTab}:{entries:DailyEntry[],goals:any[],leads:any[],business:any,setTab:(t:string)=>void}) {
  const brief=buildStevieBrief(entries,goals,leads);
  const latest=entries.at(-1);
  const last7=entries.slice(-7);
  const avg=(key:keyof DailyEntry)=>numericAverage(last7.map(e=>e[key] as number));
  return <>
    <div className="card stevieMain">
      <div className="stevieMark">S</div>
      <div>
        <div className="kpiLabel">Stevie Daily Brief</div>
        <h1 className="briefHeadline">{brief.headline}</h1>
        <p className="briefSummary">{brief.summary}</p>
        <div className="coachCallout"><strong>Best next action:</strong><br/>{brief.action}</div>
        <div className="actions" style={{marginTop:14}}>
          <button className="btn primary" onClick={()=>setTab('Daily')}>Update today’s record</button>
          <button className="btn" onClick={()=>setTab('CEO')}>Open CEO focus</button>
        </div>
      </div>
    </div>

    <div className="grid cols4" style={{marginTop:18}}>
      <Kpi label="Sleep · 7 days" value={`${avg('sleep_hours').toFixed(1)} hrs`}/>
      <Kpi label="Energy · 7 days" value={`${avg('energy').toFixed(1)}/10`}/>
      <Kpi label="Mood · 7 days" value={`${avg('mood').toFixed(1)}/10`}/>
      <Kpi label="Stress · 7 days" value={`${avg('stress').toFixed(1)}/10`}/>
    </div>

    <div className="grid cols3" style={{marginTop:18}}>
      <InsightCard title="What is going well" items={brief.wins} empty="Keep recording wins and habits to build this section." tone="positive"/>
      <InsightCard title="What to notice" items={brief.observations} empty="No neutral observations yet." tone="neutral"/>
      <InsightCard title="What needs attention" items={brief.cautions} empty="No immediate warnings from your recent data." tone="warning"/>
    </div>

    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card">
        <h2>Today’s commitments</h2>
        <div className="list">
          <div className="listItem"><strong>Mission</strong><br/>{latest?.mission||'Not set'}</div>
          <div className="listItem"><strong>CEO opportunity</strong><br/>{latest?.opportunity||'Not set'}</div>
          <div className="listItem"><strong>Relationship promise</strong><br/>{latest?.relationship_promise||'Not set'}</div>
        </div>
      </div>
      <div className="card">
        <h2>Business pulse</h2>
        <div className="grid cols2">
          <Kpi label="Weekly sales" value={business?.sales_actual?`£${Number(business.sales_actual).toLocaleString('en-GB')}`:'Not entered'}/>
          <Kpi label="Gross profit" value={business?.gross_profit?`£${Number(business.gross_profit).toLocaleString('en-GB')}`:'Not entered'}/>
          <Kpi label="Open leads" value={leads.filter(l=>!['Won','Lost'].includes(l.stage)).length}/>
          <Kpi label="Active goals" value={goals.filter(g=>g.status!=='Complete').length}/>
        </div>
      </div>
    </div>

    <div className="card" style={{marginTop:18}}>
      <h2>How Stevie works</h2>
      <p className="muted">This briefing currently uses transparent rules based on your own saved sleep, energy, mood, stress, habits, relationship actions, goals and CEO entries. It does not send personal data to an external AI service.</p>
    </div>
  </>
}

function InsightCard({title,items,empty,tone}:{title:string,items:string[],empty:string,tone:'positive'|'neutral'|'warning'}){
  return <div className={`card insightCard ${tone}`}><h2>{title}</h2><div className="list">{items.length?items.map((item,i)=><div className="listItem" key={i}>{item}</div>):<div className="muted">{empty}</div>}</div></div>
}

function Dashboard({entries,goals,leads,setTab}:{entries:DailyEntry[],goals:any[],leads:any[],setTab:(t:string)=>void}) {
  const recent=entries.slice(-30);
  const last7=entries.slice(-7);
  const latest=entries.at(-1);
  const avg=(rows:DailyEntry[],key:keyof DailyEntry)=>rows.length?rows.reduce((a,e)=>a+(Number(e[key])||0),0)/rows.length:0;
  const chart=recent.map(e=>({date:e.entry_date.slice(5),overall:e.overall_score||0,sleep:e.sleep_hours||0,energy:e.energy||0}));
  const smokeFree=recent.filter(e=>e.habits?.['No smoking']).length;
  const exerciseDays=recent.filter(e=>e.habits?.Exercise).length;
  const openLeads=leads.filter(l=>!['Won','Lost'].includes(l.stage)).length;
  const activeGoals=goals.filter(g=>g.status!=='Complete').length;
  const completeGoals=goals.filter(g=>g.status==='Complete').length;
  const greetingHour=new Date().getHours();
  const greeting=greetingHour<12?'Good morning':greetingHour<18?'Good afternoon':'Good evening';
  const habitStreak=(habit:string)=>{
    let streak=0;
    for(let i=entries.length-1;i>=0;i--){
      if(entries[i].habits?.[habit]) streak++; else break;
    }
    return streak;
  };
  const entryStreak=()=>{
    if(!entries.length)return 0;
    let streak=0;
    let cursor=new Date();
    const dates=new Set(entries.map(e=>e.entry_date));
    if(!dates.has(cursor.toISOString().slice(0,10))) cursor.setDate(cursor.getDate()-1);
    while(dates.has(cursor.toISOString().slice(0,10))){
      streak++; cursor.setDate(cursor.getDate()-1);
    }
    return streak;
  };
  const brief=buildStevieBrief(entries,goals,leads);
  return <>
    <div className="card heroCard intelligenceHero" style={{marginBottom:18}}>
      <div>
        <div className="kpiLabel">{greeting}, James</div>
        <div className="heroText">{latest?.mission||'Set today’s mission and decide what matters most.'}</div>
        <div className="actions" style={{marginTop:14}}>
          <button className="btn primary" onClick={()=>setTab('Daily')}>Open Daily Command Centre</button>
          <button className="btn" onClick={()=>setTab('Stevie')}>Read Stevie Brief</button>
        </div>
      </div>
      <div className="streakBadge">{entryStreak()} day check-in streak</div>
    </div>

    <div className="grid cols4">
      <Kpi label="7-day overall" value={`${avg(last7,'overall_score').toFixed(1)}/10`}/>
      <Kpi label="7-day sleep" value={`${avg(last7,'sleep_hours').toFixed(1)} hrs`}/>
      <Kpi label="Open opportunities" value={openLeads}/>
      <Kpi label="Active goals" value={activeGoals}/>
    </div>

    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card steviePreview">
        <div className="kpiLabel">Stevie’s priority</div>
        <h2>{brief.headline}</h2>
        <p className="muted">{brief.summary}</p>
        <div className="coachCallout">{brief.action}</div>
        <button className="btn" style={{marginTop:12}} onClick={()=>setTab('Stevie')}>See full briefing</button>
      </div>
      <div className="card">
        <h2>Today’s balance</h2>
        <div className="list">
          <div className="listItem"><strong>CEO focus</strong><br/>{latest?.opportunity||'Choose the most valuable opportunity today.'}</div>
          <div className="listItem"><strong>Relationship</strong><br/>{latest?.relationship_action||'Plan one clear action that makes someone feel valued.'}</div>
          <div className="listItem"><strong>Health</strong><br/>{latest?.sleep_hours?`${latest.sleep_hours} hours sleep · energy ${latest.energy||'-'}/10`:'Complete your morning health check.'}</div>
        </div>
      </div>
    </div>

    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card">
        <h2>Momentum & streaks</h2>
        <div className="grid cols2">
          <Kpi label="Exercise streak" value={`${habitStreak('Exercise')} days`}/>
          <Kpi label="Smoke-free streak" value={`${habitStreak('No smoking')} days`}/>
          <Kpi label="Exercise days / 30" value={exerciseDays}/>
          <Kpi label="Smoke-free days / 30" value={smokeFree}/>
        </div>
      </div>
      <div className="card">
        <h2>Goal progress</h2>
        <div className="goalProgressNumber">{completeGoals} of {goals.length} complete</div>
        <div className="progress"><span style={{width:`${goals.length?(completeGoals/goals.length)*100:0}%`}}></span></div>
        <h3 style={{marginTop:18}}>Decision being avoided</h3>
        <div className="listItem">{latest?.avoiding||'Nothing recorded today.'}</div>
      </div>
    </div>

    <div className="grid cols2" style={{marginTop:18}}>
      <ChartCard title="30-day overall score" data={chart} keys={['overall']}/>
      <ChartCard title="Sleep and energy" data={chart} keys={['sleep','energy']}/>
    </div>
  </>
}

function Kpi({label,value}:{label:string,value:any}){return <div className="card"><div className="kpiLabel">{label}</div><div className="kpi">{value}</div></div>}
function ChartCard({title,data,keys}:{title:string,data:any[],keys:string[]}){return <div className="card"><h2>{title}</h2><div style={{width:'100%',height:240}}><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/>{keys.map((k,i)=><Line key={k} type="monotone" dataKey={k} stroke={i===0?'#22262b':'#8d98a5'} strokeWidth={2}/>)}</LineChart></ResponsiveContainer></div></div>}

function DailyForm({value,setValue,save}:{value:DailyEntry,setValue:any,save:()=>void}) {
  const set=(k:keyof DailyEntry,v:any)=>setValue((p:DailyEntry)=>({...p,[k]:v}));
  const setP=(group:'pillar_scores'|'pillar_actions',k:string,v:any)=>setValue((p:DailyEntry)=>({...p,[group]:{...(p[group]||{}),[k]:v}}));
  const required=[
    value.sleep_hours,value.energy,value.mood,value.stress,value.focus,value.confidence,
    value.mission,value.priority_1,value.relationship_action,value.relationship_promise,
    value.wins,value.gratitude,value.tomorrow_mission,value.overall_score
  ];
  const completed=required.filter(v=>v!==null&&v!==undefined&&v!=='').length;
  const completion=Math.round((completed/required.length)*100);
  return <>
    <div className="card dailyProgress" style={{marginBottom:18}}>
      <div>
        <div className="kpiLabel">Today’s worksheet completion</div>
        <div className="heroText">{completion}% complete</div>
      </div>
      <div className="progress progressWide"><span style={{width:`${completion}%`}}></span></div>
    </div>
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


function MeCentre({entries,edit}:{entries:DailyEntry[],edit:(e:DailyEntry)=>void}) {
  const latest=entries.at(-1);
  const recent=entries.slice(-7);
  const avg=(key:keyof DailyEntry)=>recent.length?recent.reduce((a,e)=>a+(Number(e[key])||0),0)/recent.length:0;
  return <>
    <div className="grid cols4">
      <Kpi label="Mood" value={`${avg('mood').toFixed(1)}/10`}/>
      <Kpi label="Energy" value={`${avg('energy').toFixed(1)}/10`}/>
      <Kpi label="Focus" value={`${avg('focus').toFixed(1)}/10`}/>
      <Kpi label="Confidence" value={`${avg('confidence').toFixed(1)}/10`}/>
    </div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>What is on my mind?</h2><div className="listItem"><strong>Current lesson</strong><br/>{latest?.lesson||'Nothing recorded yet.'}</div><div className="listItem" style={{marginTop:10}}><strong>What I am avoiding</strong><br/>{latest?.avoiding||'Nothing recorded.'}</div></div>
      <div className="card"><h2>Personal reflection</h2><div className="listItem"><strong>Recent wins</strong><br/>{latest?.wins||'Complete an evening review to capture your wins.'}</div><div className="listItem" style={{marginTop:10}}><strong>Gratitude</strong><br/>{latest?.gratitude||'Not entered yet.'}</div>{latest&&<button className="btn primary" style={{marginTop:12}} onClick={()=>edit(latest)}>Open today’s entry</button>}</div>
    </div>
  </>
}

function CEOCentre({entries,business,leads,setTab}:{entries:DailyEntry[],business:any,leads:any[],setTab:(t:string)=>void}) {
  const latest=entries.at(-1);
  const openLeads=leads.filter(l=>!['Won','Lost'].includes(l.stage)).length;
  const money=(n:any)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(n)||0);
  return <>
    <div className="grid cols4">
      <Kpi label="Weekly sales" value={money(business.sales_actual)}/>
      <Kpi label="Gross profit" value={money(business.gross_profit)}/>
      <Kpi label="Debtors" value={money(business.debtors)}/>
      <Kpi label="Open opportunities" value={openLeads}/>
    </div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>CEO focus</h2><div className="list"><div className="listItem"><strong>Biggest opportunity</strong><br/>{latest?.opportunity||'Not entered'}</div><div className="listItem"><strong>Biggest risk</strong><br/>{latest?.risk||'Not entered'}</div><div className="listItem"><strong>Decision I am avoiding</strong><br/>{latest?.avoiding||'None recorded'}</div></div></div>
      <div className="card"><h2>Leverage</h2><div className="list"><div className="listItem"><strong>Delegate</strong><br/>{latest?.delegate_task||'Not entered'}</div><div className="listItem"><strong>Automate</strong><br/>{latest?.automate_task||'Not entered'}</div></div><button className="btn" style={{marginTop:12}} onClick={()=>setTab('Business Hub')}>Open Business Hub</button></div>
    </div>
  </>
}

function Analytics({entries}:{entries:DailyEntry[]}) {
  const recent=entries.slice(-30);
  const last7=entries.slice(-7);
  const avg=(values:any[])=>numericAverage(values.map(Number));
  const data=recent.map(e=>({date:e.entry_date.slice(5),mood:e.mood||0,energy:e.energy||0,stress:e.stress||0,overall:e.overall_score||0}));
  const balance=[
    {area:'Health',score:avg(last7.map(e=>((Number(e.energy)||0)+(Number(e.sleep_quality)||0))/2))},
    {area:'Relationships',score:avg(last7.map(e=>e.pillar_scores?.Relationships))},
    {area:'CEO',score:avg(last7.map(e=>e.pillar_scores?.Business))},
    {area:'Growth',score:avg(last7.map(e=>e.pillar_scores?.Growth))},
    {area:'Life',score:avg(last7.map(e=>e.pillar_scores?.Life))},
    {area:'Money',score:avg(last7.map(e=>e.pillar_scores?.Money))},
    {area:'Me',score:avg(last7.map(e=>e.pillar_scores?.Me))}
  ];
  return <>
    <div className="grid cols2">
      <div className="card">
        <h2>Life Balance · seven days</h2>
        <div style={{width:'100%',height:340}}>
          <ResponsiveContainer>
            <RadarChart data={balance}>
              <PolarGrid/>
              <PolarAngleAxis dataKey="area"/>
              <Radar dataKey="score" stroke="#22262b" fill="#22262b" fillOpacity={0.18}/>
              <Tooltip/>
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="muted small">The wheel becomes more accurate as you score your six pillars consistently.</p>
      </div>
      <div className="card">
        <h2>Balance summary</h2>
        <div className="list">{balance.map(b=><div className="listItem" key={b.area}><div className="goalHeader"><strong>{b.area}</strong><span className="badge">{b.score.toFixed(1)}/10</span></div><div className="progress"><span style={{width:`${Math.min(100,b.score*10)}%`}}></span></div></div>)}</div>
      </div>
    </div>
    <div className="grid cols2" style={{marginTop:18}}>
      <ChartCard title="Mood and energy" data={data} keys={['mood','energy']}/>
      <ChartCard title="Stress and overall score" data={data} keys={['stress','overall']}/>
    </div>
  </>
}

function Weekly({session,records,entries,reload}:{session:Session,records:any[],entries:DailyEntry[],reload:()=>void}) {
  const [f,setF]=useState<any>({week_start:today});
  const last7=entries.slice(-7);
  const average=(key:keyof DailyEntry)=>last7.length?last7.reduce((a,e)=>a+(Number(e[key])||0),0)/last7.length:0;
  const missions=last7.filter(e=>e.mission).length;
  const exercise=last7.filter(e=>e.habits?.Exercise).length;
  const smokeFree=last7.filter(e=>e.habits?.['No smoking']).length;
  const saveIt=async()=>{const {error}=await supabase.from('weekly_reviews').insert({...f,user_id:session.user.id});if(error)alert(error.message);else{setF({week_start:today});reload()}};
  return <>
    <div className="grid cols4">
      <Kpi label="7-day overall" value={`${average('overall_score').toFixed(1)}/10`}/>
      <Kpi label="Missions set" value={`${missions}/7`}/>
      <Kpi label="Exercise days" value={`${exercise}/7`}/>
      <Kpi label="Smoke-free days" value={`${smokeFree}/7`}/>
    </div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>Weekly review</h2><Field label="Week commencing"><input type="date" value={f.week_start} onChange={e=>setF({...f,week_start:e.target.value})}/></Field><Text label="Biggest wins" value={f.wins} set={v=>setF({...f,wins:v})}/><Text label="Biggest lessons" value={f.lessons} set={v=>setF({...f,lessons:v})}/><Text label="What did not work?" value={f.not_worked} set={v=>setF({...f,not_worked:v})}/></div>
      <div className="card"><h2>Next week</h2><Text label="Top priority" value={f.priority} set={v=>setF({...f,priority:v})}/><Text label="Three key actions" value={f.actions} set={v=>setF({...f,actions:v})}/><Text label="Relationship intention" value={f.relationship_intention} set={v=>setF({...f,relationship_intention:v})}/><Text label="Health intention" value={f.health_intention} set={v=>setF({...f,health_intention:v})}/><button className="btn primary" onClick={saveIt}>Save weekly review</button></div>
    </div>
    <div className="card" style={{marginTop:18}}><h2>Saved reviews</h2><div className="list">{records.length?records.map(r=><div className="listItem" key={r.id}><strong>{r.week_start}</strong><br/><span className="muted">Priority:</span> {r.priority||'Not entered'}</div>):<div className="muted">No weekly reviews saved yet.</div>}</div></div>
  </>
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
  const [f,setF]=useState<any>({status:'Not started'});
  const add=async()=>{if(!f.title?.trim()){alert('Add a goal or project name first.');return;}const {error}=await supabase.from('goals').insert({...f,user_id:session.user.id});if(error)alert(error.message);else{setF({status:'Not started'});reload()}};
  const del=async(id:string)=>{await supabase.from('goals').delete().eq('id',id);reload()};
  const updateStatus=async(id:string,status:string)=>{await supabase.from('goals').update({status}).eq('id',id);reload()};
  const complete=goals.filter(g=>g.status==='Complete').length;
  const overdue=(deadline:string,status:string)=>deadline&&status!=='Complete'&&new Date(deadline)<new Date(today);
  return <>
    <div className="grid cols4">
      <Kpi label="Total goals" value={goals.length}/>
      <Kpi label="In progress" value={goals.filter(g=>g.status==='In progress').length}/>
      <Kpi label="Waiting" value={goals.filter(g=>g.status==='Waiting').length}/>
      <Kpi label="Complete" value={complete}/>
    </div>
    <div className="card" style={{marginTop:18}}>
      <h2>Add a goal or project</h2>
      <div className="grid cols4"><input placeholder="Goal or project" value={f.title||''} onChange={e=>setF({...f,title:e.target.value})}/><input placeholder="Next action" value={f.next_action||''} onChange={e=>setF({...f,next_action:e.target.value})}/><input type="date" value={f.deadline||''} onChange={e=>setF({...f,deadline:e.target.value})}/><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{['Not started','In progress','Waiting','Complete'].map(x=><option key={x}>{x}</option>)}</select></div>
      <button className="btn primary" style={{marginTop:10}} onClick={add}>Add goal</button>
    </div>
    <div className="card" style={{marginTop:18}}>
      <h2>Goal progress</h2>
      <div className="goalProgressNumber">{complete} of {goals.length} complete</div>
      <div className="progress"><span style={{width:`${goals.length?(complete/goals.length)*100:0}%`}}></span></div>
      <div className="list" style={{marginTop:18}}>{goals.length?goals.map(g=><div className={`listItem ${overdue(g.deadline,g.status)?'overdue':''}`} key={g.id}>
        <div className="goalHeader"><strong>{g.title}</strong><span className="badge">{g.status}</span></div>
        <div className="muted small">Next: {g.next_action||'Not set'} · Deadline: {g.deadline||'Not set'} {overdue(g.deadline,g.status)?'· OVERDUE':''}</div>
        <div className="actions" style={{marginTop:8}}>
          {g.status!=='Complete'&&<button className="btn" onClick={()=>updateStatus(g.id,'Complete')}>Mark complete</button>}
          <button className="btn danger" onClick={()=>del(g.id)}>Delete</button>
        </div>
      </div>):<div className="muted">No goals or projects yet.</div>}</div>
    </div>
  </>
}

function Vision({session,settings,reload}:{session:Session,settings:any,reload:()=>void}) {
  const [mission,setMission]=useState(settings.mission_statement||'To build a life I am proud of through integrity, discipline, kindness, meaningful relationships, good health and a successful business.');
  useEffect(()=>setMission(settings.mission_statement||mission),[settings]);
  const saveIt=async()=>{const payload={user_id:session.user.id,mission_statement:mission,relationship_notes:settings.relationship_notes||'',date_ideas:settings.date_ideas||''};const {error}=await supabase.from('app_settings').upsert(payload,{onConflict:'user_id'});if(error)alert(error.message);else reload()};
  return <div className="grid cols2"><div className="card"><h2>My mission</h2><textarea style={{minHeight:220}} value={mission} onChange={e=>setMission(e.target.value)}/><button className="btn primary" style={{marginTop:10}} onClick={saveIt}>Save mission</button></div><div className="card"><h2>The James Standard</h2><div className="list">{['I keep my word.','I do difficult things before easy things.','I listen before I respond.','I take responsibility.','I protect my health and relationships.','I improve the business every day.','I build a business that serves my life.'].map(x=><div className="listItem" key={x}>{x}</div>)}</div></div></div>
}
