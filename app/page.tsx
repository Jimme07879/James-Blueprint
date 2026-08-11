"use client";

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { connectMicrosoft, disconnectMicrosoft, getMicrosoftAccount, getInboxMessages, type OutlookMessage } from '../lib/microsoft';
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


type ProofItem = {
  id?: string; title: string; proof_date: string; category?: string|null; story?: string|null; created_at?: string;
};

type VaultItem = {
  id?: string; section: string; title: string; content: string; created_at?: string; updated_at?: string;
};


type DecisionItem = {
  id?: string; title: string; decision_date: string; category?: string|null; context?: string|null;
  options_considered?: string|null; decision_made: string; expected_outcome?: string|null;
  review_date?: string|null; review_status?: string|null; actual_outcome?: string|null;
  lesson?: string|null; created_at?: string;
};

type EmailSummary = {
  connected: boolean;
  account?: string;
  messages: OutlookMessage[];
  unread: number;
  action: number;
  routineOrders: number;
  urgent: number;
  handled: number;
  loading: boolean;
  error?: string;
};

const tabs = ['Home','Today','Daily','Stevie','Email','Proof','Vault','Decisions','Me','Relationships','Health','Goals','CEO','Analytics','Weekly','Business Hub','Settings'];
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
    <div className="loginBrand">B</div><h1>Blueprint OS</h1><p className="muted">Designed for James · Private cloud</p>
    <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
    <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
    <button className="btn primary" style={{width:'100%'}}>Sign in</button>
    {message&&<div className="error">{message}</div>}
  </form></div>
}

function BlueprintApp({session}:{session:Session}) {
  const [tab,setTab]=useState('Home');
  const [theme,setTheme]=useState<'light'|'dark'>('light');
  const [daily,setDaily]=useState<DailyEntry>(blankDaily);
  const [entries,setEntries]=useState<DailyEntry[]>([]);
  const [sidebar,setSidebar]=useState(false);
  const [weekly,setWeekly]=useState<any[]>([]);
  const [leads,setLeads]=useState<any[]>([]);
  const [goals,setGoals]=useState<any[]>([]);
  const [business,setBusiness]=useState<any>({});
  const [settings,setSettings]=useState<any>({});
  const [proofItems,setProofItems]=useState<ProofItem[]>([]);
  const [vaultItems,setVaultItems]=useState<VaultItem[]>([]);
  const [decisionItems,setDecisionItems]=useState<DecisionItem[]>([]);
  const [emailSummary,setEmailSummary]=useState<EmailSummary>({connected:false,messages:[],unread:0,action:0,routineOrders:0,urgent:0,handled:0,loading:true});

  const loadAll=async()=>{
    const [{data:e},{data:w},{data:l},{data:g},{data:b},{data:s},{data:p},{data:v},{data:d}] = await Promise.all([
      supabase.from('daily_entries').select('*').order('entry_date'),
      supabase.from('weekly_reviews').select('*').order('week_start',{ascending:false}),
      supabase.from('sales_leads').select('*').order('created_at',{ascending:false}),
      supabase.from('goals').select('*').order('created_at',{ascending:false}),
      supabase.from('business_snapshots').select('*').order('snapshot_date',{ascending:false}).limit(1),
      supabase.from('app_settings').select('*').maybeSingle(),
      supabase.from('proof_items').select('*').order('proof_date',{ascending:false}),
      supabase.from('vault_items').select('*').order('updated_at',{ascending:false}),
      supabase.from('decision_items').select('*').order('decision_date',{ascending:false})
    ]);
    const entryRows=(e||[]) as DailyEntry[];
    setEntries(entryRows); setWeekly(w||[]); setLeads(l||[]); setGoals(g||[]); setBusiness((b||[])[0]||{}); setSettings(s||{}); setProofItems((p||[]) as ProofItem[]); setVaultItems((v||[]) as VaultItem[]); setDecisionItems((d||[]) as DecisionItem[]);
    const todaysEntry=entryRows.find(row=>row.entry_date===today);
    setDaily(todaysEntry||blankDaily);
  };
  useEffect(()=>{loadAll()},[]);

  const refreshEmail=async()=>{
    const clientId=process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
    if(!clientId){
      setEmailSummary({connected:false,messages:[],unread:0,action:0,routineOrders:0,urgent:0,handled:0,loading:false,error:'Microsoft connection not configured yet.'});
      return;
    }
    try{
      const account=await getMicrosoftAccount();
      if(!account){
        setEmailSummary({connected:false,messages:[],unread:0,action:0,routineOrders:0,urgent:0,handled:0,loading:false});
        return;
      }
      const messages=await getInboxMessages(50);
      // Keep a private cloud copy of message metadata so Steve can remember what James has handled.
      if(messages.length){
        const rows=messages.map(m=>({
          user_id:session.user.id,
          external_id:m.id,
          subject:m.subject||null,
          sender_name:m.from?.emailAddress?.name||null,
          sender_address:m.from?.emailAddress?.address||null,
          received_at:m.receivedDateTime||new Date().toISOString(),
          is_read:!!m.isRead,
          importance:m.importance||'normal',
          has_attachments:!!m.hasAttachments,
          body_preview:m.bodyPreview||null,
          web_link:m.webLink||null,
          source:'outlook'
        }));
        await supabase.from('email_messages').upsert(rows,{onConflict:'user_id,external_id',ignoreDuplicates:false});
      }
      const {data:emailRows}=await supabase.from('email_messages').select('external_id,handled').eq('user_id',session.user.id);
      const handledMap=new Map((emailRows||[]).map((r:any)=>[r.external_id,!!r.handled]));
      const enriched=messages.map(m=>({...m,handled:handledMap.get(m.id)||false})) as (OutlookMessage & {handled?:boolean})[];
      const routine=(m:OutlookMessage)=>{
        const sender=(m.from?.emailAddress?.address||'').toLowerCase();
        const subject=(m.subject||'').toLowerCase();
        return sender.includes('fresho.com') || sender.includes('no-reply') || sender.includes('noreply') || /order confirmation|your order has|delivery confirmation|dispatch/i.test(subject);
      };
      const finance=(m:OutlookMessage)=>/invoice|statement|remittance|payment|credit|overdue|price increase|account|direct debit|vat|balance/i.test(`${m.subject||''} ${m.bodyPreview||''}`);
      const order=(m:OutlookMessage)=>/\border\b|purchase order|po number|new order|order request|quantit(y|ies)|delivery for/i.test(`${m.subject||''} ${m.bodyPreview||''}`);
      const urgent=(m:OutlookMessage)=>m.importance==='high'||/urgent|overdue|action required|final notice|credit hold|today|asap|problem|shortage|complaint/i.test(`${m.subject||''} ${m.bodyPreview||''}`);
      const active=enriched.filter(m=>!m.handled);
      const unread=active.filter(m=>!m.isRead).length;
      const routineOrders=active.filter(m=>routine(m)||order(m)).length;
      const urgentCount=active.filter(urgent).length;
      const action=active.filter(m=>urgent(m)||finance(m)||(!m.isRead&&!routine(m))).length;
      const handled=enriched.filter(m=>m.handled).length;
      setEmailSummary({connected:true,account:account.username,messages:enriched,unread,action,routineOrders,urgent:urgentCount,handled,loading:false});
    }catch(err:any){
      setEmailSummary({connected:true,messages:[],unread:0,action:0,routineOrders:0,urgent:0,handled:0,loading:false,error:err?.message||'Could not load Outlook.'});
    }
  };
  useEffect(()=>{refreshEmail()},[]);

  useEffect(()=>{
    const saved=localStorage.getItem('blueprint-theme') as 'light'|'dark'|null;
    const preferred=saved||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    setTheme(preferred);
  },[]);
  const toggleTheme=()=>setTheme(current=>{const next=current==='dark'?'light':'dark';localStorage.setItem('blueprint-theme',next);return next;});

  const saveDaily=async()=>{
    const payload={...daily,user_id:session.user.id};
    const {error}=await supabase.from('daily_entries').upsert(payload,{onConflict:'user_id,entry_date'});
    if(error) alert(error.message); else {alert('Daily record saved.'); await loadAll();}
  };
  const editDaily=(e:DailyEntry)=>{setDaily(e);setTab('Daily')};
  const deleteDaily=async(id?:string)=>{if(!id||!confirm('Delete this record?'))return;await supabase.from('daily_entries').delete().eq('id',id);loadAll()};

  const title=tab==='Daily'?'Daily Command Centre':tab;
  return <div className={`shell theme-${theme}`}>
    <aside className={`sidebar ${sidebar?'open':''}`}>
      <div className="brand">BLUEPRINT OS<small>DESIGNED FOR JAMES</small></div>
      <nav className="nav">{tabs.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>{setTab(t);setSidebar(false)}}>{t}</button>)}</nav>
      <div className="sidebarFooter">{session.user.email}<br/><button className="btn" style={{marginTop:8}} onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
    </aside>
    <main className="main">
      <div className="topbar">
        <div style={{display:'flex',gap:10,alignItems:'center'}}><button className="btn mobileMenu" onClick={()=>setSidebar(!sidebar)}>☰</button><div><h1>{title}</h1><div className="muted">{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div></div></div>
        <button className="btn themeToggle" onClick={toggleTheme} aria-label="Toggle colour theme">{theme==='dark'?'☀ Light':'☾ Dark'}</button>
      </div>
      {tab==='Home'&&<Dashboard entries={entries} goals={goals} leads={leads} proofItems={proofItems} vaultItems={vaultItems} decisionItems={decisionItems} emailSummary={emailSummary} setTab={setTab}/>}
      {tab==='Today'&&<TodayOps session={session} entries={entries} goals={goals} decisionItems={decisionItems} emailSummary={emailSummary} reload={loadAll} refreshEmail={refreshEmail} setTab={setTab}/>}
      {tab==='Daily'&&<DailyForm value={daily} setValue={setDaily} save={saveDaily}/>}
      {tab==='Email'&&<EmailCentre session={session} summary={emailSummary} refresh={refreshEmail} goals={goals} reload={loadAll}/>} 
      {tab==='Stevie'&&<StevieCentre entries={entries} goals={goals} leads={leads} business={business} emailSummary={emailSummary} setTab={setTab}/>}
      {tab==='Proof'&&<ProofTimeline session={session} items={proofItems} reload={loadAll}/>}
      {tab==='Vault'&&<BlueprintVault session={session} items={vaultItems} reload={loadAll}/>}
      {tab==='Decisions'&&<DecisionJournal session={session} items={decisionItems} reload={loadAll}/>}
      {tab==='Me'&&<MeCentre entries={entries} edit={editDaily}/>}
      {tab==='Relationships'&&<Relationships session={session} entries={entries} settings={settings} reload={loadAll}/>}
      {tab==='Health'&&<Health entries={entries}/>}
      {tab==='Goals'&&<Goals session={session} goals={goals} reload={loadAll}/>}
      {tab==='CEO'&&<CEOCentre entries={entries} business={business} leads={leads} setTab={setTab}/>}
      {tab==='Analytics'&&<Analytics entries={entries}/>}
      {tab==='Weekly'&&<Weekly session={session} records={weekly} entries={entries} reload={loadAll}/>}
      {tab==='Business Hub'&&<Business session={session} value={business} reload={loadAll}/>}
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

function StevieCentre({entries,goals,leads,business,emailSummary,setTab}:{entries:DailyEntry[],goals:any[],leads:any[],business:any,emailSummary:EmailSummary,setTab:(t:string)=>void}) {
  const brief=buildStevieBrief(entries,goals,leads);
  const latest=entries.at(-1);
  const last7=entries.slice(-7);
  const avg=(key:keyof DailyEntry)=>numericAverage(last7.map(e=>e[key] as number));
  const inboxRanked=emailSummary.messages
    .filter(m=>!(m as OutlookMessage & {handled?:boolean}).handled)
    .map(m=>({message:m,insight:getEmailInsight(m)}))
    .filter(x=>x.insight.score>=35)
    .sort((a,b)=>b.insight.score-a.insight.score);
  const inboxNext=inboxRanked[0];
  const operationalNext=inboxNext
    ? `${inboxNext.message.subject||'Inbox item'} — ${inboxNext.insight.reason}`
    : latest?.avoiding
      ? `${latest.avoiding} — an avoided decision keeps creating background pressure.`
      : latest?.priority_1
        ? `${latest.priority_1} — it is your first recorded priority.`
        : brief.action;
  return <>
    <div className="card stevieMain stevieConversation">
      <div className="stevieMark">S</div>
      <div>
        <div className="kpiLabel">Steve’s Daily Ops Brief</div>
        <h1 className="briefHeadline">{brief.headline}</h1>
        <p className="briefSummary">{brief.summary}</p>
        <div className="coachCallout"><strong>What should I do next?</strong><br/>{operationalNext}</div>
        <div className="actions" style={{marginTop:14}}>
          <button className="btn primary" onClick={()=>setTab('Today')}>Open Today board</button>
          <button className="btn" onClick={()=>setTab('Email')}>Open Inbox Ops</button>
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
          <Kpi label="Active goals" value={goals.filter(g=>g.status!=='Complete'&&g.status!=='Inbox task').length}/>
        </div>
      </div>
    </div>

    <div className="card intelligencePanel" style={{marginTop:18}}>
      <div className="goalHeader"><div><div className="kpiLabel">Steve Intelligence</div><h2>Operational signals</h2></div><span className="badge">{emailSummary.connected?`${inboxRanked.length} inbox signals`:'Outlook offline'}</span></div>
      <div className="grid cols3">
        <div className="listItem"><strong>Inbox</strong><br/><span className="muted small">{emailSummary.connected?`${emailSummary.action} messages need attention. ${emailSummary.routineOrders} routine/order messages can stay out of your way.`:'Connect Outlook to include inbox intelligence.'}</span></div>
        <div className="listItem"><strong>CEO</strong><br/><span className="muted small">{latest?.avoiding?`Avoided decision: ${latest.avoiding}`:latest?.opportunity?`Opportunity: ${latest.opportunity}`:'No CEO warning recorded today.'}</span></div>
        <div className="listItem"><strong>Balance</strong><br/><span className="muted small">{avg('stress')>=7?'Stress is running high — keep the active queue tight.':avg('sleep_hours')>0&&avg('sleep_hours')<6?'Sleep is low — protect energy and avoid unnecessary work.':'No major wellbeing constraint detected from the last seven records.'}</span></div>
      </div>
    </div>

    <div className="card" style={{marginTop:18}}>
      <h2>How Steve works</h2>
      <p className="muted">Steve Intelligence combines transparent scoring across your saved sleep, energy, mood, stress, goals, CEO entries and live Outlook metadata. Email recommendations explain why an item was prioritised. Draft replies are suggestions only and stay under your control.</p>
    </div>
  </>
}

function InsightCard({title,items,empty,tone}:{title:string,items:string[],empty:string,tone:'positive'|'neutral'|'warning'}){
  return <div className={`card insightCard ${tone}`}><h2>{title}</h2><div className="list">{items.length?items.map((item,i)=><div className="listItem" key={i}>{item}</div>):<div className="muted">{empty}</div>}</div></div>
}





type EmailInsight = {
  score:number;
  category:'Needs Action'|'Order'|'Supplier & Finance'|'Routine'|'FYI';
  reason:string;
  suggestedAction:string;
};

function getEmailInsight(m:OutlookMessage):EmailInsight {
  const subject=(m.subject||'').toLowerCase();
  const preview=(m.bodyPreview||'').toLowerCase();
  const body=`${subject} ${preview}`;
  const sender=(m.from?.emailAddress?.address||'').toLowerCase();
  const routine=sender.includes('fresho.com')||sender.includes('no-reply')||sender.includes('noreply')||/order confirmation|your order has|delivery confirmation|dispatch/.test(body);
  const order=/\border\b|purchase order|po number|new order|order request|quantity|quantities|delivery for/.test(body);
  const finance=/invoice|statement|remittance|payment|credit|overdue|price increase|account|direct debit|vat|balance/.test(body);
  const urgent=m.importance==='high'||/urgent|overdue|action required|final notice|credit hold|today|asap|problem|shortage|complaint|failed|missing/.test(body);
  const asksReply=/please (reply|confirm|advise|let me know)|can you|could you|would you|need you to|response required|confirm/.test(body);
  let score=0;
  if(!m.isRead) score+=18;
  if(urgent) score+=45;
  if(finance) score+=28;
  if(asksReply) score+=24;
  if(m.hasAttachments) score+=5;
  if(order) score+=8;
  if(routine) score-=35;
  score=Math.max(0,Math.min(100,score));
  if(routine && !urgent && !finance) return {score,category:'Routine',reason:'Routine automated/order traffic; keep it out of the main action queue.',suggestedAction:'Review only if the order needs an operational check.'};
  if(finance) return {score:Math.max(score,55),category:'Supplier & Finance',reason:urgent?'Finance/admin message with urgency language.':'Finance/admin message that may affect cash, credit, pricing or payment.',suggestedAction:'Review the amount/status and decide whether a reply, payment or follow-up is required.'};
  if(urgent || asksReply) return {score:Math.max(score,60),category:'Needs Action',reason:urgent?'Contains urgency/problem language and deserves a quick decision.':'Looks like the sender is asking for a response or confirmation.',suggestedAction:'Open it, decide the response, and either reply or create a follow-up task.'};
  if(order) return {score,category:'Order',reason:'Looks order-related but not currently showing a strong exception signal.',suggestedAction:'Check only if the order needs confirmation, amendment or an operational action.'};
  if(!m.isRead) return {score:Math.max(score,35),category:'Needs Action',reason:'Unread non-routine message; worth a quick triage before it gets buried.',suggestedAction:'Scan it and either handle, task or mark as FYI.'};
  return {score,category:'FYI',reason:'No strong urgency, finance or response signal detected.',suggestedAction:'Leave it unless it supports an active task or decision.'};
}

function draftReplyFor(m:OutlookMessage){
  const sender=m.from?.emailAddress?.name||'there';
  const insight=getEmailInsight(m);
  if(insight.category==='Supplier & Finance') return `Hi ${sender},\n\nThanks for your email. I’ve received this and I’m checking the details now. I’ll come back to you shortly once I’ve confirmed the position.\n\nRegards,\nJames`;
  if(insight.category==='Order') return `Hi ${sender},\n\nThanks for the order. I’ve received it and will check everything through. I’ll let you know if there are any issues or changes needed.\n\nRegards,\nJames`;
  if(/complaint|problem|shortage|missing/i.test(`${m.subject||''} ${m.bodyPreview||''}`)) return `Hi ${sender},\n\nThanks for letting me know. I’m looking into this now and I’ll come back to you as soon as I’ve got a clear answer for you.\n\nRegards,\nJames`;
  return `Hi ${sender},\n\nThanks for your email. I’ve picked this up and I’ll come back to you shortly.\n\nRegards,\nJames`;
}


type TodayQueueItem = {
  id:string;
  source:'Email'|'Daily'|'Goal'|'Decision'|'Relationship'|'CEO';
  title:string;
  detail?:string;
  bucket:'Now'|'Today'|'This Week'|'Waiting';
  href?:string;
  emailId?:string;
  goalId?:string;
  actionLabel?:string;
};

function TomorrowDate(){
  const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10);
}

function TodayOps({session,entries,goals,decisionItems,emailSummary,reload,refreshEmail,setTab}:{session:Session,entries:DailyEntry[],goals:any[],decisionItems:DecisionItem[],emailSummary:EmailSummary,reload:()=>void,refreshEmail:()=>void,setTab:(t:string)=>void}){
  const [busy,setBusy]=useState<string|null>(null);
  const [view,setView]=useState<'All'|'Now'|'Today'|'This Week'|'Waiting'>('All');
  const latest=entries.at(-1);
  const tomorrow=TomorrowDate();
  const weekEnd=new Date(); weekEnd.setDate(weekEnd.getDate()+7); const weekEndStr=weekEnd.toISOString().slice(0,10);
  const emailText=(m:OutlookMessage)=>`${m.subject||''} ${m.bodyPreview||''}`.toLowerCase();
  const emailSender=(m:OutlookMessage)=>(m.from?.emailAddress?.address||'').toLowerCase();
  const emailRoutine=(m:OutlookMessage)=>emailSender(m).includes('fresho.com')||emailSender(m).includes('no-reply')||emailSender(m).includes('noreply')||/order confirmation|your order has|delivery confirmation|dispatch/.test(emailText(m));
  const emailFinance=(m:OutlookMessage)=>/invoice|statement|remittance|payment|credit|overdue|price increase|account|direct debit|vat|balance/.test(emailText(m));
  const emailUrgent=(m:OutlookMessage)=>m.importance==='high'||/urgent|overdue|action required|final notice|credit hold|today|asap|problem|shortage|complaint/.test(emailText(m));
  const emailHandled=(m:OutlookMessage)=>!!(m as OutlookMessage & {handled?:boolean}).handled;
  const actionEmails=emailSummary.messages
    .filter(m=>!emailHandled(m))
    .map(m=>({message:m,insight:getEmailInsight(m)}))
    .filter(x=>x.insight.score>=35&&x.insight.category!=='Routine')
    .sort((a,b)=>b.insight.score-a.insight.score);

  const items:TodayQueueItem[]=[];
  actionEmails.slice(0,12).forEach(({message:m,insight})=>items.push({
    id:`email-${m.id}`,source:'Email',title:m.subject||'Inbox follow-up',detail:`Steve: ${insight.reason} · ${insight.suggestedAction}`,
    bucket:insight.score>=60?'Now':'Today',href:m.webLink,emailId:m.id,actionLabel:'Handle'
  }));
  const priorities=[latest?.priority_1,latest?.priority_2,latest?.priority_3].filter(Boolean) as string[];
  priorities.forEach((x,i)=>items.push({id:`daily-${i}`,source:'Daily',title:x,bucket:i===0?'Now':'Today',detail:'Daily priority'}));
  if(latest?.opportunity) items.push({id:'ceo-opportunity',source:'CEO',title:latest.opportunity,bucket:'Now',detail:'Biggest opportunity'});
  if(latest?.avoiding) items.push({id:'ceo-avoiding',source:'CEO',title:latest.avoiding,bucket:'Now',detail:'Decision being avoided'});
  if(latest?.relationship_promise) items.push({id:'relationship-promise',source:'Relationship',title:latest.relationship_promise,bucket:'Today',detail:'Promise to keep'});

  goals.filter(g=>g.status!=='Complete').forEach(g=>{
    if(g.status==='Waiting') items.push({id:`goal-${g.id}`,source:'Goal',title:g.title,detail:g.next_action,bucket:'Waiting',goalId:g.id});
    else if(g.deadline&&g.deadline<today) items.push({id:`goal-${g.id}`,source:'Goal',title:g.title,detail:`Overdue · ${g.next_action||'No next action'}`,bucket:'Now',goalId:g.id});
    else if(g.deadline===today||g.status==='Inbox task') items.push({id:`goal-${g.id}`,source:'Goal',title:g.title,detail:g.next_action,bucket:'Today',goalId:g.id});
    else if(g.deadline&&g.deadline<=weekEndStr) items.push({id:`goal-${g.id}`,source:'Goal',title:g.title,detail:`Due ${g.deadline} · ${g.next_action||''}`,bucket:'This Week',goalId:g.id});
  });
  decisionItems.filter(d=>d.review_status!=='Reviewed'&&d.review_date&&d.review_date<=today).forEach(d=>items.push({id:`decision-${d.id}`,source:'Decision',title:`Review: ${d.title}`,detail:d.decision_made,bucket:'Now'}));

  const unique=Array.from(new Map(items.map(i=>[i.id,i])).values());
  const filtered=view==='All'?unique:unique.filter(i=>i.bucket===view);
  const count=(b:TodayQueueItem['bucket'])=>unique.filter(i=>i.bucket===b).length;
  const topThree=unique.filter(i=>i.bucket==='Now').slice(0,3);
  const remaining=unique.filter(i=>i.bucket==='Now'||i.bucket==='Today').length;

  const markEmailHandled=async(emailId:string)=>{
    setBusy(emailId); const {error}=await supabase.from('email_messages').update({handled:true}).eq('user_id',session.user.id).eq('external_id',emailId); setBusy(null);
    if(error)alert(error.message);else refreshEmail();
  };
  const emailTomorrow=async(item:TodayQueueItem)=>{
    if(!item.emailId)return; setBusy(item.emailId);
    const {error}=await supabase.from('goals').insert({user_id:session.user.id,title:item.title,next_action:[item.detail,item.href].filter(Boolean).join(' · '),deadline:tomorrow,status:'Inbox task'});
    if(!error) await supabase.from('email_messages').update({handled:true}).eq('user_id',session.user.id).eq('external_id',item.emailId);
    setBusy(null); if(error)alert(error.message);else{await reload();await refreshEmail();}
  };
  const completeGoal=async(id:string)=>{setBusy(id);const {error}=await supabase.from('goals').update({status:'Complete'}).eq('id',id);setBusy(null);if(error)alert(error.message);else reload();};
  const waitGoal=async(id:string)=>{setBusy(id);const {error}=await supabase.from('goals').update({status:'Waiting'}).eq('id',id);setBusy(null);if(error)alert(error.message);else reload();};
  const tomorrowGoal=async(id:string)=>{setBusy(id);const {error}=await supabase.from('goals').update({deadline:tomorrow,status:'In progress'}).eq('id',id);setBusy(null);if(error)alert(error.message);else reload();};

  return <>
    <div className="card todayHero">
      <div><div className="kpiLabel">Steve · Personal Assistant & Operations Manager</div><div className="heroText">Today’s Operations Brief</div><p className="briefSummary">{remaining?`${remaining} things need attention today. ${count('Now')} should be dealt with first.`:'Today is under control. Use the space to protect your priorities rather than create more work.'}</p></div>
      <div className="todayHeroBadge"><strong>{count('Now')}</strong><span>NOW</span></div>
    </div>
    <div className="grid cols4" style={{marginTop:18}}><Kpi label="Now" value={count('Now')}/><Kpi label="Today" value={count('Today')}/><Kpi label="This week" value={count('This Week')}/><Kpi label="Waiting" value={count('Waiting')}/></div>
    <div className="grid todayTopGrid" style={{marginTop:18}}>
      <div className="card steveTopThree"><div className="kpiLabel">Steve’s Top 3</div><h2>Do these before the noise</h2><div className="list">{topThree.length?topThree.map((i,n)=><div className="listItem" key={i.id}><span className="todayNumber">{n+1}</span><strong>{i.title}</strong><div className="muted small">{i.source}{i.detail?` · ${i.detail}`:''}</div></div>):<div className="muted">Nothing urgent is competing for your attention.</div>}</div></div>
      <div className="card"><div className="kpiLabel">Today’s compass</div><h2>Keep the day balanced</h2><div className="list"><div className="listItem"><strong>Mission</strong><br/>{latest?.mission||'Set today’s mission in Daily.'}</div><div className="listItem"><strong>Relationship</strong><br/>{latest?.relationship_action||latest?.relationship_promise||'Choose one meaningful connection action.'}</div><div className="listItem"><strong>Health</strong><br/>{latest?.sleep_hours?`${latest.sleep_hours}h sleep · Energy ${latest.energy||'-'}/10 · Stress ${latest.stress||'-'}/10`:'Complete the morning health check.'}</div></div></div>
    </div>
    <div className="card nextActionCard" style={{marginTop:18}}>
      <div className="stevieMark">S</div>
      <div>
        <div className="kpiLabel">What should I do next?</div>
        <h2>{topThree[0]?.title||'Protect the space you have created.'}</h2>
        <p className="muted">{topThree[0]?.detail||'There is nothing critical in the Now queue. Work deliberately on the mission rather than filling the gap with low-value admin.'}</p>
        <div className="actions">
          {topThree[0]?.href&&<a className="btn primary emailOpen" href={topThree[0].href} target="_blank" rel="noreferrer">Open it now</a>}
          {!topThree[0]?.href&&topThree[0]&&<button className="btn primary" onClick={()=>setTab(topThree[0].source==='Decision'?'Decisions':topThree[0].source==='CEO'?'CEO':topThree[0].source==='Email'?'Email':'Daily')}>Open source</button>}
        </div>
      </div>
    </div>
    <div className="card todayBoard" style={{marginTop:18}}>
      <div className="inboxBriefTop"><div><div className="kpiLabel">Unified action queue</div><h2>One board for the day</h2></div><div className="todayFilters">{(['All','Now','Today','This Week','Waiting'] as const).map(x=><button key={x} className={`emailFilter ${view===x?'active':''}`} onClick={()=>setView(x)}>{x}</button>)}</div></div>
      <div className="todayQueue">{filtered.length?filtered.map(item=><div className={`todayItem today-${item.bucket.toLowerCase().replace(' ','-')}`} key={item.id}><div className="todayItemMain"><div className="goalHeader"><strong>{item.title}</strong><span className="badge">{item.bucket}</span></div><div className="muted small">{item.source}{item.detail?` · ${item.detail}`:''}</div></div><div className="actions todayActions">{item.href&&<a className="btn emailOpen" href={item.href} target="_blank" rel="noreferrer">Open</a>}{item.emailId&&<button className="btn primary" disabled={busy===item.emailId} onClick={()=>markEmailHandled(item.emailId!)}>Done</button>}{item.emailId&&<button className="btn" disabled={busy===item.emailId} onClick={()=>emailTomorrow(item)}>Tomorrow</button>}{item.goalId&&<button className="btn primary" disabled={busy===item.goalId} onClick={()=>completeGoal(item.goalId!)}>Done</button>}{item.goalId&&item.bucket!=='Waiting'&&<button className="btn" disabled={busy===item.goalId} onClick={()=>tomorrowGoal(item.goalId!)}>Tomorrow</button>}{item.goalId&&item.bucket!=='Waiting'&&<button className="btn" disabled={busy===item.goalId} onClick={()=>waitGoal(item.goalId!)}>Waiting</button>}{!item.emailId&&!item.goalId&&<button className="btn" onClick={()=>setTab(item.source==='Decision'?'Decisions':item.source==='CEO'?'CEO':'Daily')}>Open source</button>}</div></div>):<div className="todayEmpty"><strong>Nothing in this bucket.</strong><span>That is a good thing.</span></div>}</div>
    </div>
    <div className="card endDayCard" style={{marginTop:18}}><div><div className="kpiLabel">End of day · 2 minutes</div><h2>Close the loop before tomorrow</h2><p className="muted">{remaining?`${remaining} Now/Today items are still open. Decide what gets finished, moved or consciously left.`:'You have cleared the active queue. Capture the win and set tomorrow up.'}</p></div><div className="endDayGrid"><div className="listItem"><strong>Wins</strong><br/>{latest?.wins||'Not recorded yet.'}</div><div className="listItem"><strong>Lesson</strong><br/>{latest?.lesson||'Not recorded yet.'}</div><div className="listItem"><strong>Tomorrow’s mission</strong><br/>{latest?.tomorrow_mission||'Not set yet.'}</div></div><button className="btn primary" onClick={()=>setTab('Daily')}>Complete Evening Review</button></div>
  </>;
}

function EmailCentre({session,summary,refresh,goals,reload}:{session:Session,summary:EmailSummary,refresh:()=>void,goals:any[],reload:()=>void}) {
  const [filter,setFilter]=useState<'Needs Action'|'Orders'|'Supplier & Finance'|'Routine'|'Handled'>('Needs Action');
  const [busy,setBusy]=useState<string|null>(null);
  const text=(m:OutlookMessage)=>`${m.subject||''} ${m.bodyPreview||''}`.toLowerCase();
  const sender=(m:OutlookMessage)=>(m.from?.emailAddress?.address||'').toLowerCase();
  const isRoutine=(m:OutlookMessage)=>sender(m).includes('fresho.com')||sender(m).includes('no-reply')||sender(m).includes('noreply')||/order confirmation|your order has|delivery confirmation|dispatch/.test(text(m));
  const isFinance=(m:OutlookMessage)=>/invoice|statement|remittance|payment|credit|overdue|price increase|account|direct debit|vat|balance/.test(text(m));
  const isOrder=(m:OutlookMessage)=>/\border\b|purchase order|po number|new order|order request|quantity|quantities|delivery for/.test(text(m));
  const isUrgent=(m:OutlookMessage)=>m.importance==='high'||/urgent|overdue|action required|final notice|credit hold|today|asap|problem|shortage|complaint/.test(text(m));
  const isHandled=(m:OutlookMessage)=>!!(m as OutlookMessage & {handled?:boolean}).handled;
  const needsAction=(m:OutlookMessage)=>!isHandled(m)&&(isUrgent(m)||isFinance(m)||(!m.isRead&&!isRoutine(m)));
  const primaryLabel=(m:OutlookMessage)=>isHandled(m)?'Handled':getEmailInsight(m).category;
  const filtered=summary.messages.filter(m=>{
    if(filter==='Handled')return isHandled(m);
    if(filter==='Needs Action')return !isHandled(m)&&getEmailInsight(m).score>=35&&getEmailInsight(m).category!=='Routine';
    if(filter==='Orders')return !isHandled(m)&&(isOrder(m)||isRoutine(m));
    if(filter==='Supplier & Finance')return !isHandled(m)&&isFinance(m);
    return !isHandled(m)&&isRoutine(m);
  });
  const rankedFiltered=[...filtered].sort((a,b)=>getEmailInsight(b).score-getEmailInsight(a).score);
  const financeCount=summary.messages.filter(m=>!isHandled(m)&&isFinance(m)).length;
  const orderCount=summary.messages.filter(m=>!isHandled(m)&&(isOrder(m)||isRoutine(m))).length;
  const inboxTasks=goals.filter(g=>g.status==='Inbox task');
  const nextEmail=summary.messages
    .filter(m=>!isHandled(m))
    .map(m=>({message:m,insight:getEmailInsight(m)}))
    .filter(x=>x.insight.score>=35&&x.insight.category!=='Routine')
    .sort((a,b)=>b.insight.score-a.insight.score)[0];
  const brief=nextEmail
    ? `${summary.action} message${summary.action===1?'':'s'} need attention. Start with “${nextEmail.message.subject||'the top message'}” because ${nextEmail.insight.reason.toLowerCase()}`
    : `Inbox is under control. ${orderCount} order-related message${orderCount===1?'':'s'} are in the current view.`;

  const markHandled=async(m:OutlookMessage)=>{
    setBusy(m.id);
    const {error}=await supabase.from('email_messages').update({handled:true}).eq('user_id',session.user.id).eq('external_id',m.id);
    setBusy(null);
    if(error) alert(error.message); else refresh();
  };
  const reopen=async(m:OutlookMessage)=>{
    setBusy(m.id);
    const {error}=await supabase.from('email_messages').update({handled:false}).eq('user_id',session.user.id).eq('external_id',m.id);
    setBusy(null);
    if(error) alert(error.message); else refresh();
  };
  const createTask=async(m:OutlookMessage)=>{
    setBusy(m.id);
    const who=m.from?.emailAddress?.name||m.from?.emailAddress?.address||'Email';
    const next=[`From: ${who}`,m.bodyPreview?.slice(0,180),m.webLink].filter(Boolean).join(' · ');
    const {error}=await supabase.from('goals').insert({user_id:session.user.id,title:m.subject||'Inbox follow-up',next_action:next,deadline:today,status:'Inbox task'});
    if(!error) await supabase.from('email_messages').update({handled:true}).eq('user_id',session.user.id).eq('external_id',m.id);
    setBusy(null);
    if(error) alert(error.message); else {await reload();await refresh();}
  };
  const completeTask=async(id:string)=>{await supabase.from('goals').delete().eq('id',id);reload();};

  if(!process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID){
    return <div className="card emailConnect"><div className="stevieMark">S</div><div><div className="kpiLabel">Steve · Personal Assistant & Operations Manager</div><h2>Email connection needs one final setup step</h2><p className="muted">Add the Microsoft Client ID to Vercel, then come back here to connect Outlook.</p></div></div>;
  }
  if(!summary.connected){
    return <div className="card emailConnect"><div className="stevieMark">S</div><div><div className="kpiLabel">Steve · Personal Assistant & Operations Manager</div><h2>Connect your Outlook inbox</h2><p className="muted">Steve will triage the inbox, surface actions, separate order traffic and turn emails into follow-up tasks.</p><button className="btn primary" onClick={()=>connectMicrosoft()}>Connect Outlook</button></div></div>;
  }
  return <>
    <div className="card emailHero emailOpsHero">
      <div><div className="kpiLabel">Steve · Personal Assistant & Operations Manager</div><div className="heroText">Inbox Ops</div><p className="briefSummary">{brief}</p><p className="muted small">{summary.account||'Outlook connected'}</p></div>
      <div className="actions"><button className="btn" onClick={refresh}>Refresh inbox</button><button className="btn" onClick={()=>disconnectMicrosoft()}>Disconnect</button></div>
    </div>
    {summary.error&&<div className="notice" style={{marginTop:18}}>{summary.error}</div>}
    <div className="grid cols4" style={{marginTop:18}}>
      <Kpi label="Needs action" value={summary.action}/>
      <Kpi label="Orders" value={orderCount}/>
      <Kpi label="Supplier & finance" value={financeCount}/>
      <Kpi label="Inbox tasks" value={inboxTasks.length}/>
    </div>
    <div className="card inboxControl" style={{marginTop:18}}>
      <div className="inboxBriefTop"><div><div className="kpiLabel">Steve's triage</div><h2>What do you want to see?</h2></div><div className="emailStatusLine"><span>{summary.unread} unread</span><span>{summary.urgent} urgent</span><span>{summary.handled} handled</span></div></div>
      <div className="emailFilters">{(['Needs Action','Orders','Supplier & Finance','Routine','Handled'] as const).map(x=><button key={x} className={`emailFilter ${filter===x?'active':''}`} onClick={()=>setFilter(x)}>{x}</button>)}</div>
    </div>
    <div className="grid emailOpsGrid" style={{marginTop:18}}>
      <div className="card">
        <div className="goalHeader"><h2>{filter}</h2><span className="badge">{filtered.length}</span></div>
        <div className="list">{rankedFiltered.length?rankedFiltered.slice(0,30).map(m=><EmailRow key={m.id} message={m} label={primaryLabel(m)} insight={getEmailInsight(m)} busy={busy===m.id} handled={isHandled(m)} createTask={()=>createTask(m)} markHandled={()=>markHandled(m)} reopen={()=>reopen(m)}/>):<div className="muted">Nothing in this bucket right now.</div>}</div>
      </div>
      <div className="card inboxTaskCard">
        <div className="kpiLabel">Action board</div><h2>Tasks created from email</h2>
        <div className="list">{inboxTasks.length?inboxTasks.slice(0,12).map(t=><div className="listItem" key={t.id}><div className="goalHeader"><strong>{t.title}</strong><span className="badge">Inbox task</span></div><div className="muted small">Due {t.deadline||'not set'}</div><p className="emailPreview">{t.next_action}</p><button className="btn" onClick={()=>completeTask(t.id)}>Complete & remove</button></div>):<div className="muted">Use “Create task” on any email that needs a follow-up. It will appear here and in Goals.</div>}</div>
      </div>
    </div>
  </>;
}

function EmailRow({message,label,insight,busy,handled,createTask,markHandled,reopen}:{message:OutlookMessage,label:string,insight:EmailInsight,busy:boolean,handled:boolean,createTask:()=>void|Promise<void>,markHandled:()=>void|Promise<void>,reopen:()=>void|Promise<void>}) {
  const sender=message.from?.emailAddress?.name||message.from?.emailAddress?.address||'Unknown sender';
  const received=message.receivedDateTime?new Date(message.receivedDateTime).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  const [showDraft,setShowDraft]=useState(false);
  const [draft,setDraft]=useState(()=>draftReplyFor(message));
  const copyDraft=async()=>{try{await navigator.clipboard.writeText(draft);alert('Draft copied. Open Outlook, paste it and edit before sending.');}catch{alert('Could not copy automatically. Select the draft text and copy it manually.');}};
  return <div className={`listItem emailRow ${!message.isRead?'emailUnread':''} ${handled?'emailHandled':''}`}>
    <div className="goalHeader"><strong>{message.subject||'(No subject)'}</strong><span className={`badge emailBadge ${label.toLowerCase().replaceAll(' ','-').replace('&','and')}`}>{label}</span></div>
    <div className="muted small">{sender} · {received}{message.hasAttachments?' · attachment':''} · Steve score {insight.score}/100</div>
    {message.bodyPreview&&<p className="emailPreview">{message.bodyPreview}</p>}
    {!handled&&<div className="emailWhy"><strong>Why this matters</strong><span>{insight.reason}</span><strong>Suggested action</strong><span>{insight.suggestedAction}</span></div>}
    {showDraft&&<div className="draftReplyBox"><div className="goalHeader"><strong>Steve draft</strong><span className="badge">Review before sending</span></div><textarea value={draft} onChange={e=>setDraft(e.target.value)}/><div className="actions"><button className="btn primary" onClick={copyDraft}>Copy draft</button>{message.webLink&&<a className="btn emailOpen" href={message.webLink} target="_blank" rel="noreferrer">Open Outlook</a>}<button className="btn" onClick={()=>setShowDraft(false)}>Close</button></div></div>}
    <div className="actions emailActions">
      {!handled&&<button className="btn primary" disabled={busy} onClick={createTask}>{busy?'Working…':'Create task'}</button>}
      {!handled&&<button className="btn" onClick={()=>setShowDraft(v=>!v)}>Draft reply</button>}
      {!handled&&<button className="btn" disabled={busy} onClick={markHandled}>Mark handled</button>}
      {handled&&<button className="btn" disabled={busy} onClick={reopen}>Reopen</button>}
      {message.webLink&&<a className="btn emailOpen" href={message.webLink} target="_blank" rel="noreferrer">Open in Outlook</a>}
    </div>
  </div>;
}

function ProofTimeline({session,items,reload}:{session:Session,items:ProofItem[],reload:()=>void}) {
  const [form,setForm]=useState<ProofItem>({title:'',proof_date:today,category:'Achievement',story:''});
  const add=async()=>{
    if(!form.title.trim()){alert('Add a title first.');return;}
    const {error}=await supabase.from('proof_items').insert({...form,user_id:session.user.id});
    if(error)alert(error.message);else{setForm({title:'',proof_date:today,category:'Achievement',story:''});reload();}
  };
  const remove=async(id?:string)=>{if(!id||!confirm('Delete this proof item?'))return;await supabase.from('proof_items').delete().eq('id',id);reload();};
  return <>
    <div className="card proofHero"><div><div className="kpiLabel">Evidence beats self-doubt</div><div className="heroText">Your Proof Timeline</div><p className="muted">Record difficult things completed, promises kept, milestones reached and moments you are proud of.</p></div><div className="streakBadge">{items.length} proof items</div></div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>Add proof</h2><Text label="What did you do?" value={form.title} set={v=>setForm({...form,title:v})} input/><div className="grid cols2"><Field label="Date"><input type="date" value={form.proof_date} onChange={e=>setForm({...form,proof_date:e.target.value})}/></Field><Field label="Category"><select value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})}><option>Achievement</option><option>Courage</option><option>Health</option><option>Relationship</option><option>CEO</option><option>Learning</option><option>Personal</option></select></Field></div><Text label="Why does this matter?" value={form.story} set={v=>setForm({...form,story:v})}/><button className="btn primary" onClick={add}>Save to Proof</button></div>
      <div className="card"><h2>Latest evidence</h2><div className="list">{items.slice(0,4).map(item=><div className="listItem" key={item.id}><div className="goalHeader"><strong>{item.title}</strong><span className="badge">{item.category}</span></div><div className="muted small">{item.proof_date}</div>{item.story&&<p>{item.story}</p>}</div>)}</div></div>
    </div>
    <div className="card" style={{marginTop:18}}><h2>Full timeline</h2>{items.length?<div className="timeline">{items.map(item=><div className="timelineItem" key={item.id}><div className="timelineDot"></div><div className="listItem"><div className="goalHeader"><strong>{item.title}</strong><span className="badge">{item.proof_date}</span></div><div className="muted small">{item.category}</div>{item.story&&<p>{item.story}</p>}<button className="btn danger" onClick={()=>remove(item.id)}>Delete</button></div></div>)}</div>:<div className="muted">Your first proof could be: “I built and deployed my own cloud software instead of giving up.”</div>}</div>
  </>
}

function BlueprintVault({session,items,reload}:{session:Session,items:VaultItem[],reload:()=>void}) {
  const [form,setForm]=useState<VaultItem>({section:'Vision',title:'',content:''});
  const add=async()=>{
    if(!form.title.trim()||!form.content.trim()){alert('Add a title and content first.');return;}
    const {error}=await supabase.from('vault_items').insert({...form,user_id:session.user.id});
    if(error)alert(error.message);else{setForm({section:'Vision',title:'',content:''});reload();}
  };
  const remove=async(id?:string)=>{if(!id||!confirm('Delete this vault item?'))return;await supabase.from('vault_items').delete().eq('id',id);reload();};
  const sections=['Vision','Values','Principles','Annual Goals','Lessons','Ideas','Quotes'];
  return <>
    <div className="card vaultHero"><div><div className="kpiLabel">Your permanent reference point</div><div className="heroText">Blueprint Vault</div><p className="muted">Keep the ideas, standards and lessons that should guide your decisions over time.</p></div><div className="streakBadge">{items.length} saved items</div></div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>Add to the vault</h2><Field label="Section"><select value={form.section} onChange={e=>setForm({...form,section:e.target.value})}>{sections.map(s=><option key={s}>{s}</option>)}</select></Field><Text label="Title" value={form.title} set={v=>setForm({...form,title:v})} input/><Text label="Content" value={form.content} set={v=>setForm({...form,content:v})}/><button className="btn primary" onClick={add}>Save to Vault</button></div>
      <div className="card"><h2>North Star</h2><div className="coachCallout">Use the Vault to answer: <strong>What matters most, and what kind of man and CEO am I choosing to become?</strong></div><div className="list" style={{marginTop:12}}>{sections.map(section=><div className="listItem" key={section}><strong>{section}</strong><br/><span className="muted small">{items.filter(i=>i.section===section).length} saved</span></div>)}</div></div>
    </div>
    <div className="card" style={{marginTop:18}}><h2>Saved vault</h2>{items.length?<div className="vaultGrid">{items.map(item=><div className="listItem vaultItem" key={item.id}><div className="goalHeader"><strong>{item.title}</strong><span className="badge">{item.section}</span></div><p>{item.content}</p><button className="btn danger" onClick={()=>remove(item.id)}>Delete</button></div>)}</div>:<div className="muted">Start with your vision for December 2026, your values, and the principle you want to follow when things feel difficult.</div>}</div>
  </>
}

function calculateBlueprintScore(entries:DailyEntry[]) {
  const last7=entries.slice(-7);
  const average=(values:(number|null|undefined)[])=>numericAverage(values);
  const health=average(last7.map(e=>{
    const sleep=Math.min(10,Math.max(0,(Number(e.sleep_hours)||0)/7*10));
    const energy=Number(e.energy)||0;
    return (sleep+energy)/2;
  }));
  const relationships=average(last7.map(e=>e.pillar_scores?.Relationships));
  const ceo=average(last7.map(e=>e.pillar_scores?.Business));
  const growth=average(last7.map(e=>e.pillar_scores?.Growth));
  const recovery=last7.length?last7.filter(e=>e.habits?.['Recovery time']).length/last7.length*10:0;
  const reflection=last7.length?last7.filter(e=>e.wins||e.gratitude||e.lesson).length/last7.length*10:0;
  const components=[
    {label:'Health',score:health,weight:25},
    {label:'Relationships',score:relationships,weight:20},
    {label:'CEO',score:ceo,weight:20},
    {label:'Growth',score:growth,weight:15},
    {label:'Recovery',score:recovery,weight:10},
    {label:'Reflection',score:reflection,weight:10}
  ];
  const available=components.filter(c=>c.score>0);
  const totalWeight=available.reduce((n,c)=>n+c.weight,0);
  const score=totalWeight?Math.round(available.reduce((n,c)=>n+c.score*c.weight,0)/totalWeight*10):0;
  return {score,components};
}

function DecisionJournal({session,items,reload}:{session:Session,items:DecisionItem[],reload:()=>void}) {
  const [form,setForm]=useState<DecisionItem>({title:'',decision_date:today,category:'Personal',decision_made:'',review_status:'Open'});
  const add=async()=>{
    if(!form.title.trim()||!form.decision_made.trim()){alert('Add a decision title and what you decided.');return;}
    const {error}=await supabase.from('decision_items').insert({...form,user_id:session.user.id});
    if(error)alert(error.message);else{setForm({title:'',decision_date:today,category:'Personal',decision_made:'',review_status:'Open'});reload();}
  };
  const update=async(id:string,updates:Partial<DecisionItem>)=>{const {error}=await supabase.from('decision_items').update(updates).eq('id',id);if(error)alert(error.message);else reload();};
  const remove=async(id?:string)=>{if(!id||!confirm('Delete this decision?'))return;await supabase.from('decision_items').delete().eq('id',id);reload();};
  const due=items.filter(i=>i.review_status!=='Reviewed'&&i.review_date&&i.review_date<=today);
  return <>
    <div className="card decisionHero"><div><div className="kpiLabel">Improve judgement over time</div><div className="heroText">Decision Journal</div><p className="muted">Record what you decided, why, what you expect to happen, and what the result eventually taught you.</p></div><div className="streakBadge">{due.length} reviews due</div></div>
    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card"><h2>Record a decision</h2><Text label="Decision title" value={form.title} set={v=>setForm({...form,title:v})} input/><div className="grid cols2"><Field label="Decision date"><input type="date" value={form.decision_date} onChange={e=>setForm({...form,decision_date:e.target.value})}/></Field><Field label="Category"><select value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})}><option>Personal</option><option>CEO</option><option>Relationship</option><option>Health</option><option>Money</option><option>Growth</option></select></Field></div><Text label="Context — what was happening?" value={form.context} set={v=>setForm({...form,context:v})}/><Text label="Options considered" value={form.options_considered} set={v=>setForm({...form,options_considered:v})}/><Text label="What did you decide?" value={form.decision_made} set={v=>setForm({...form,decision_made:v})}/><Text label="Expected outcome" value={form.expected_outcome} set={v=>setForm({...form,expected_outcome:v})}/><Field label="Review date"><input type="date" value={form.review_date||''} onChange={e=>setForm({...form,review_date:e.target.value})}/></Field><button className="btn primary" onClick={add}>Save decision</button></div>
      <div className="card"><h2>Reviews due</h2><div className="list">{due.length?due.map(item=><div className="listItem" key={item.id}><div className="goalHeader"><strong>{item.title}</strong><span className="badge">{item.review_date}</span></div><p>{item.decision_made}</p><Text label="What actually happened?" value={item.actual_outcome} set={v=>update(item.id!,{actual_outcome:v})}/><Text label="Lesson" value={item.lesson} set={v=>update(item.id!,{lesson:v})}/><button className="btn primary" onClick={()=>update(item.id!,{review_status:'Reviewed'})}>Mark reviewed</button></div>):<div className="muted">No decision reviews are due.</div>}</div></div>
    </div>
    <div className="card" style={{marginTop:18}}><h2>Decision history</h2>{items.length?<div className="decisionGrid">{items.map(item=><div className="listItem decisionItem" key={item.id}><div className="goalHeader"><strong>{item.title}</strong><span className="badge">{item.category}</span></div><div className="muted small">{item.decision_date} · Review: {item.review_date||'Not set'} · {item.review_status||'Open'}</div>{item.context&&<p><strong>Context:</strong> {item.context}</p>}<p><strong>Decision:</strong> {item.decision_made}</p>{item.expected_outcome&&<p><strong>Expected:</strong> {item.expected_outcome}</p>}{item.actual_outcome&&<p><strong>Actual:</strong> {item.actual_outcome}</p>}{item.lesson&&<p><strong>Lesson:</strong> {item.lesson}</p>}<button className="btn danger" onClick={()=>remove(item.id)}>Delete</button></div>)}</div>:<div className="muted">Start with one meaningful personal or CEO decision you want to learn from later.</div>}</div>
  </>
}

function Dashboard({entries,goals,leads,proofItems,vaultItems,decisionItems,emailSummary,setTab}:{entries:DailyEntry[],goals:any[],leads:any[],proofItems:ProofItem[],vaultItems:VaultItem[],decisionItems:DecisionItem[],emailSummary:EmailSummary,setTab:(t:string)=>void}) {
  const recent=entries.slice(-30);
  const last7=entries.slice(-7);
  const latest=entries.at(-1);
  const avg=(rows:DailyEntry[],key:keyof DailyEntry)=>rows.length?rows.reduce((a,e)=>a+(Number(e[key])||0),0)/rows.length:0;
  const chart=recent.map(e=>({date:e.entry_date.slice(5),overall:e.overall_score||0,sleep:e.sleep_hours||0,energy:e.energy||0}));
  const smokeFree=recent.filter(e=>e.habits?.['No smoking']).length;
  const exerciseDays=recent.filter(e=>e.habits?.Exercise).length;
  const openLeads=leads.filter(l=>!['Won','Lost'].includes(l.stage)).length;
  const activeGoals=goals.filter(g=>g.status!=='Complete'&&g.status!=='Inbox task').length;
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
  const blueprint=calculateBlueprintScore(entries);
  const decisionsDue=decisionItems.filter(i=>i.review_status!=='Reviewed'&&i.review_date&&i.review_date<=today).length;
  return <>
    <div className="card heroCard intelligenceHero executiveHero" style={{marginBottom:18}}>
      <div>
        <div className="kpiLabel">{greeting}, James</div>
        <div className="heroText">{latest?.mission||'Set today’s mission and decide what matters most.'}</div>
        <div className="actions" style={{marginTop:14}}>
          <button className="btn primary" onClick={()=>setTab('Today')}>Open Today Board</button>
          <button className="btn" onClick={()=>setTab('Daily')}>Daily Command Centre</button>
          <button className="btn" onClick={()=>setTab('Stevie')}>Read Steve’s Brief</button>
        </div>
      </div>
      <div className="streakBadge">{entryStreak()} day check-in streak</div>
    </div>

    <div className="grid scoreGrid">
      <div className="card blueprintScoreCard"><div className="scoreRing" style={{'--score':`${blueprint.score}%`} as React.CSSProperties}><div><strong>{blueprint.score}</strong><span>/100</span></div></div><div><div className="kpiLabel">Blueprint Score</div><h2>{blueprint.score>=80?'Strong balance':blueprint.score>=60?'Moving forward':'Needs attention'}</h2><p className="muted">A weighted seven-day view of health, relationships, CEO focus, growth, recovery and reflection.</p></div></div>
      <div className="card"><h2>Score breakdown</h2><div className="scoreBreakdown">{blueprint.components.map(c=><div key={c.label}><div className="goalHeader"><strong>{c.label}</strong><span>{c.score.toFixed(1)}/10</span></div><div className="progress"><span style={{width:`${Math.min(100,c.score*10)}%`}}></span></div></div>)}</div></div>
    </div>

    <div className="card todayLaunchCard">
      <div><div className="kpiLabel">Steve Daily Ops</div><h2>One queue for everything that matters today</h2><p className="muted">Email actions, CEO focus, Daily priorities, goal deadlines and relationship commitments in one place.</p></div>
      <button className="btn primary" onClick={()=>setTab('Today')}>Open Today Board</button>
    </div>

    <div className="card inboxBriefCard">
      <div className="inboxBriefTop">
        <div><div className="kpiLabel">Steve’s Inbox Brief</div><h2>{emailSummary.connected?`${emailSummary.action} email${emailSummary.action===1?'':'s'} need attention`:'Outlook not connected'}</h2></div>
        <button className="btn" onClick={()=>setTab('Email')}>{emailSummary.connected?'Open Email Focus':'Connect Outlook'}</button>
      </div>
      {emailSummary.connected?
        <div className="emailMiniGrid"><span><strong>{emailSummary.unread}</strong> unread</span><span><strong>{emailSummary.routineOrders}</strong> routine orders</span><span><strong>{emailSummary.urgent}</strong> urgent signals</span></div>:
        <p className="muted">Connect Outlook so Steve can separate routine traffic from messages that deserve your attention.</p>}
    </div>

    <div className="grid cols4">

      <Kpi label="7-day overall" value={`${avg(last7,'overall_score').toFixed(1)}/10`}/>
      <Kpi label="7-day sleep" value={`${avg(last7,'sleep_hours').toFixed(1)} hrs`}/>
      <Kpi label="Open opportunities" value={openLeads}/>
      <Kpi label="Active goals" value={activeGoals}/>
    </div>

    <div className="grid cols2" style={{marginTop:18}}>
      <div className="card steviePreview">
        <div className="kpiLabel">Steve’s priority</div>
        <h2>{brief.headline}</h2>
        <p className="muted">{brief.summary}</p>
        <div className="coachCallout">{brief.action}</div>
        <button className="btn" style={{marginTop:12}} onClick={()=>setTab('Stevie')}>See Steve’s full brief</button>
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

    <div className="grid cols3" style={{marginTop:18}}>
      <div className="card">
        <div className="goalHeader"><h2>Proof</h2><button className="btn" onClick={()=>setTab('Proof')}>Open timeline</button></div>
        {proofItems.length?<div className="listItem"><strong>{proofItems[0].title}</strong><br/><span className="muted small">{proofItems[0].proof_date} · {proofItems[0].category||'Achievement'}</span><br/>{proofItems[0].story||''}</div>:<div className="muted">Record the difficult things you have done so you can look back when confidence dips.</div>}
      </div>
      <div className="card">
        <div className="goalHeader"><h2>Blueprint Vault</h2><button className="btn" onClick={()=>setTab('Vault')}>Open vault</button></div>
        {vaultItems.length?<div className="listItem"><strong>{vaultItems[0].title}</strong><br/><span className="muted small">{vaultItems[0].section}</span><br/>{vaultItems[0].content}</div>:<div className="muted">Store your vision, values, principles, goals and lessons here.</div>}
      </div>      <div className="card">
        <div className="goalHeader"><h2>Decisions</h2><button className="btn" onClick={()=>setTab('Decisions')}>Open journal</button></div>
        <div className="kpi">{decisionsDue}</div><div className="muted">reviews due</div>
        {decisionItems.length?<div className="listItem" style={{marginTop:12}}><strong>{decisionItems[0].title}</strong><br/><span className="muted small">{decisionItems[0].decision_date} · {decisionItems[0].category}</span><br/>{decisionItems[0].decision_made}</div>:<div className="muted" style={{marginTop:12}}>Record important choices and review whether they worked.</div>}
      </div>

    </div>

    <div className="grid cols2" style={{marginTop:18}}>
      <ChartCard title="30-day overall score" data={chart} keys={['overall']}/>
      <ChartCard title="Sleep and energy" data={chart} keys={['sleep','energy']}/>
    </div>
  </>
}

function Kpi({label,value}:{label:string,value:any}){return <div className="card kpiCard"><div className="kpiLabel">{label}</div><div className="kpi">{value}</div></div>}
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
  const projects=goals.filter(g=>g.status!=='Inbox task');
  const inboxTasks=goals.filter(g=>g.status==='Inbox task');
  const complete=projects.filter(g=>g.status==='Complete').length;
  const overdue=(deadline:string,status:string)=>deadline&&status!=='Complete'&&new Date(deadline)<new Date(today);
  return <>
    <div className="grid cols4">
      <Kpi label="Total goals" value={projects.length}/>
      <Kpi label="In progress" value={projects.filter(g=>g.status==='In progress').length}/>
      <Kpi label="Waiting" value={projects.filter(g=>g.status==='Waiting').length}/>
      <Kpi label="Inbox tasks" value={inboxTasks.length}/>
    </div>
    <div className="card" style={{marginTop:18}}>
      <h2>Add a goal or project</h2>
      <div className="grid cols4"><input placeholder="Goal or project" value={f.title||''} onChange={e=>setF({...f,title:e.target.value})}/><input placeholder="Next action" value={f.next_action||''} onChange={e=>setF({...f,next_action:e.target.value})}/><input type="date" value={f.deadline||''} onChange={e=>setF({...f,deadline:e.target.value})}/><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{['Not started','In progress','Waiting','Complete'].map(x=><option key={x}>{x}</option>)}</select></div>
      <button className="btn primary" style={{marginTop:10}} onClick={add}>Add goal</button>
    </div>
    {inboxTasks.length>0&&<div className="card" style={{marginTop:18}}><div className="goalHeader"><h2>Inbox tasks</h2><span className="badge">From Steve Inbox Ops</span></div><div className="list">{inboxTasks.map(g=><div className="listItem" key={g.id}><div className="goalHeader"><strong>{g.title}</strong><span className="badge">Inbox task</span></div><div className="muted small">{g.next_action||'Follow up'} · Due {g.deadline||'Not set'}</div><div className="actions" style={{marginTop:8}}><button className="btn primary" onClick={()=>del(g.id)}>Complete & remove</button></div></div>)}</div></div>}
    <div className="card" style={{marginTop:18}}>
      <h2>Goal progress</h2>
      <div className="goalProgressNumber">{complete} of {projects.length} complete</div>
      <div className="progress"><span style={{width:`${projects.length?(complete/projects.length)*100:0}%`}}></span></div>
      <div className="list" style={{marginTop:18}}>{projects.length?projects.map(g=><div className={`listItem ${overdue(g.deadline,g.status)?'overdue':''}`} key={g.id}>
        <div className="goalHeader"><strong>{g.title}</strong><span className="badge">{g.status}</span></div>
        <div className="muted small">Next: {g.next_action||'Not set'} · Deadline: {g.deadline||'Not set'} {overdue(g.deadline,g.status)?'· OVERDUE':''}</div>
        <div className="actions" style={{marginTop:8}}>
          {g.status!=='Complete'&&<button className="btn" onClick={()=>updateStatus(g.id,'Complete')}>Mark complete</button>}
          <button className="btn danger" onClick={()=>del(g.id)}>Delete</button>
        </div>
      </div>):<div className="muted">No goals or projects yet.</div>}</div>
    </div>
  </>;
}

function Vision({session,settings,reload}:{session:Session,settings:any,reload:()=>void}) {
  const [mission,setMission]=useState(settings.mission_statement||'To build a life I am proud of through integrity, discipline, kindness, meaningful relationships, good health and a successful business.');
  useEffect(()=>setMission(settings.mission_statement||mission),[settings]);
  const saveIt=async()=>{const payload={user_id:session.user.id,mission_statement:mission,relationship_notes:settings.relationship_notes||'',date_ideas:settings.date_ideas||''};const {error}=await supabase.from('app_settings').upsert(payload,{onConflict:'user_id'});if(error)alert(error.message);else reload()};
  return <div className="grid cols2"><div className="card"><h2>My mission</h2><textarea style={{minHeight:220}} value={mission} onChange={e=>setMission(e.target.value)}/><button className="btn primary" style={{marginTop:10}} onClick={saveIt}>Save mission</button></div><div className="card"><h2>The James Standard</h2><div className="list">{['I keep my word.','I do difficult things before easy things.','I listen before I respond.','I take responsibility.','I protect my health and relationships.','I improve the business every day.','I build a business that serves my life.'].map(x=><div className="listItem" key={x}>{x}</div>)}</div></div></div>
}
