"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type DisciplineItem = {
  id?: string;
  kind: 'pain'|'purpose'|'proof';
  position: number;
  content: string;
};

type Failure = {
  id: string;
  failure_date: string;
  title: string;
  what_happened?: string|null;
  trigger?: string|null;
  correction?: string|null;
  lesson?: string|null;
  recovered: boolean;
  created_at?: string;
};

type ReminderSettings = {
  reminder_enabled: boolean;
  reminder_time: string;
  last_reminded_on?: string|null;
};

const today = () => new Date().toISOString().slice(0,10);
const blankItems = ():DisciplineItem[] =>
  (['pain','purpose','proof'] as const).flatMap(kind =>
    [1,2,3].map(position => ({kind,position,content:''}))
  );

const colours = {
  pain: {main:'#9f3f3f',soft:'#fff3f3',line:'#e4b6b6'},
  purpose: {main:'#9a6a1f',soft:'#fff8e8',line:'#ead5a5'},
  proof: {main:'#167257',soft:'#eef9f4',line:'#a9d8c7'}
};

export default function DisciplineCentre({userId}:{userId:string}) {
  const [items,setItems]=useState<DisciplineItem[]>(blankItems);
  const [failures,setFailures]=useState<Failure[]>([]);
  const [settings,setSettings]=useState<ReminderSettings>({reminder_enabled:false,reminder_time:'07:00'});
  const [failure,setFailure]=useState<any>({failure_date:today(),title:'',what_happened:'',trigger:'',correction:'',lesson:''});
  const [saving,setSaving]=useState('');
  const [message,setMessage]=useState('');

  const load=async()=>{
    const [{data:i,error:ie},{data:f,error:fe},{data:s,error:se}]=await Promise.all([
      supabase.from('discipline_items').select('id,kind,position,content').order('kind').order('position'),
      supabase.from('discipline_failures').select('*').order('failure_date',{ascending:false}).order('created_at',{ascending:false}),
      supabase.from('discipline_settings').select('*').maybeSingle()
    ]);
    const error=ie||fe||se;
    if(error){setMessage(error.message);return}
    const saved=(i||[]) as DisciplineItem[];
    setItems(blankItems().map(base=>saved.find(x=>x.kind===base.kind&&x.position===base.position)||base));
    setFailures((f||[]) as Failure[]);
    if(s)setSettings({reminder_enabled:!!s.reminder_enabled,reminder_time:String(s.reminder_time||'07:00').slice(0,5),last_reminded_on:s.last_reminded_on});
  };
  useEffect(()=>{load()},[]);

  const section=(kind:DisciplineItem['kind'])=>items.filter(x=>x.kind===kind).sort((a,b)=>a.position-b.position);
  const setItem=(kind:DisciplineItem['kind'],position:number,content:string)=>
    setItems(current=>current.map(x=>x.kind===kind&&x.position===position?{...x,content}:x));

  const saveTriangle=async()=>{
    setSaving('triangle');setMessage('');
    const rows=items.map(({kind,position,content})=>({user_id:userId,kind,position,content:content.trim()}));
    const {error}=await supabase.from('discipline_items').upsert(rows,{onConflict:'user_id,kind,position'});
    setSaving('');
    if(error)setMessage(error.message);else{setMessage('Discipline triangle saved.');load()}
  };

  const saveReminder=async()=>{
    setSaving('reminder');setMessage('');
    if(settings.reminder_enabled&&typeof Notification!=='undefined'&&Notification.permission==='default'){
      await Notification.requestPermission();
    }
    const {error}=await supabase.from('discipline_settings').upsert({
      user_id:userId,
      reminder_enabled:settings.reminder_enabled,
      reminder_time:settings.reminder_time,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
    setSaving('');
    if(error)setMessage(error.message);else setMessage('Daily reminder saved.');
  };

  const testReminder=()=>{
    const purposes=section('purpose').map(x=>x.content.trim()).filter(Boolean);
    const body=purposes.length?purposes.map((x,i)=>`${i+1}. ${x}`).join('\n'):'Add your purposes first.';
    if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('Your purpose today',{body});
    else alert(`YOUR PURPOSE TODAY\n\n${body}`);
  };

  const addFailure=async()=>{
    if(!failure.title.trim()){setMessage('Give the failure a short title first.');return}
    setSaving('failure');setMessage('');
    const {error}=await supabase.from('discipline_failures').insert({...failure,user_id:userId,recovered:false});
    setSaving('');
    if(error)setMessage(error.message);
    else{
      setFailure({failure_date:today(),title:'',what_happened:'',trigger:'',correction:'',lesson:''});
      setMessage('Failure recorded. Now use the correction, not the shame.');
      load();
    }
  };

  const toggleRecovered=async(row:Failure)=>{
    const {error}=await supabase.from('discipline_failures').update({recovered:!row.recovered}).eq('id',row.id);
    if(error)setMessage(error.message);else load();
  };

  const removeFailure=async(id:string)=>{
    if(!confirm('Delete this failure record?'))return;
    const {error}=await supabase.from('discipline_failures').delete().eq('id',id);
    if(error)setMessage(error.message);else load();
  };

  const counts=useMemo(()=>({
    pain:section('pain').filter(x=>x.content.trim()).length,
    purpose:section('purpose').filter(x=>x.content.trim()).length,
    proof:section('proof').filter(x=>x.content.trim()).length
  }),[items]);

  return <div>
    <div style={s.hero}>
      <div><div style={s.eyebrow}>THE DISCIPLINE TRIANGLE</div><h2 style={s.heroTitle}>Remember why. Act anyway. Record the proof.</h2><p style={s.heroCopy}>Pain is what you refuse to return to. Purpose is what you are building. Proof is the evidence that you kept your word.</p></div>
      <div style={s.heroScore}><strong>{counts.proof}/3</strong><span>proofs defined</span></div>
    </div>

    {message&&<div style={message.toLowerCase().includes('saved')||message.toLowerCase().includes('recorded')?s.success:s.notice}>{message}</div>}

    <div style={s.triangleWrap} aria-label="Pain, Purpose and Proof discipline triangle">
      <div style={{...s.triangleLayer,...s.proofTriangle}}>PROOF</div>
      <div style={{...s.triangleLayer,...s.purposeTriangle}}>PURPOSE</div>
      <div style={{...s.triangleLayer,...s.painTriangle}}>PAIN</div>
    </div>

    <div style={s.threeColumns}>
      <DisciplineBox title="1. Pain" subtitle="What happens if nothing changes?" kind="pain" values={section('pain')} setItem={setItem}/>
      <DisciplineBox title="2. Purpose" subtitle="What makes the hard work worth it?" kind="purpose" values={section('purpose')} setItem={setItem}/>
      <DisciplineBox title="3. Proof" subtitle="What action proves who you are becoming?" kind="proof" values={section('proof')} setItem={setItem}/>
    </div>
    <button style={s.primary} disabled={saving==='triangle'} onClick={saveTriangle}>{saving==='triangle'?'Saving…':'Save discipline triangle'}</button>

    <div style={s.twoColumns}>
      <section style={s.card}>
        <div style={s.eyebrow}>DAILY PURPOSE REMINDER</div>
        <h2>Keep the reason in front of you</h2>
        <p style={s.muted}>Blueprint will show your three purposes at the chosen time. Desktop notification works while Blueprint is open.</p>
        <label style={s.checkRow}><input type="checkbox" checked={settings.reminder_enabled} onChange={e=>setSettings({...settings,reminder_enabled:e.target.checked})}/><span>Remind me every day</span></label>
        <label style={s.label}>Reminder time<input style={s.input} type="time" value={settings.reminder_time} onChange={e=>setSettings({...settings,reminder_time:e.target.value})}/></label>
        <div style={s.actions}><button style={s.primary} disabled={saving==='reminder'} onClick={saveReminder}>{saving==='reminder'?'Saving…':'Save reminder'}</button><button style={s.button} onClick={testReminder}>Test reminder</button></div>
      </section>

      <section style={s.card}>
        <div style={s.eyebrow}>FAILURE RECORD</div>
        <h2>Record it. Learn from it. Correct it.</h2>
        <label style={s.label}>Date<input style={s.input} type="date" value={failure.failure_date} onChange={e=>setFailure({...failure,failure_date:e.target.value})}/></label>
        <label style={s.label}>Short title<input style={s.input} value={failure.title} onChange={e=>setFailure({...failure,title:e.target.value})} placeholder="What did I fail to follow through on?"/></label>
        <label style={s.label}>What happened?<textarea style={s.textarea} value={failure.what_happened} onChange={e=>setFailure({...failure,what_happened:e.target.value})}/></label>
        <label style={s.label}>What triggered it?<textarea style={s.textarea} value={failure.trigger} onChange={e=>setFailure({...failure,trigger:e.target.value})}/></label>
        <label style={s.label}>Next corrective action<input style={s.input} value={failure.correction} onChange={e=>setFailure({...failure,correction:e.target.value})} placeholder="The next action, not a vague promise"/></label>
        <label style={s.label}>Lesson<input style={s.input} value={failure.lesson} onChange={e=>setFailure({...failure,lesson:e.target.value})}/></label>
        <button style={s.primary} disabled={saving==='failure'} onClick={addFailure}>{saving==='failure'?'Recording…':'Record failure'}</button>
      </section>
    </div>

    <section style={{...s.card,marginTop:18}}>
      <div style={s.historyHeader}><div><div style={s.eyebrow}>FAILURE HISTORY</div><h2 style={{marginBottom:4}}>Patterns, corrections and recoveries</h2></div><div style={s.failureCount}>{failures.length} recorded</div></div>
      <div style={s.history}>
        {failures.map(row=><div key={row.id} style={{...s.failureRow,...(row.recovered?s.recovered:{})}}>
          <div style={s.failureTop}><div><strong>{row.title}</strong><div style={s.small}>{new Date(row.failure_date+'T12:00:00').toLocaleDateString('en-GB')}</div></div><span style={row.recovered?s.recoveredBadge:s.openBadge}>{row.recovered?'Recovered':'Correction due'}</span></div>
          {row.what_happened&&<p><strong>What happened:</strong> {row.what_happened}</p>}
          {row.trigger&&<p><strong>Trigger:</strong> {row.trigger}</p>}
          {row.correction&&<p style={s.correction}><strong>Correction:</strong> {row.correction}</p>}
          {row.lesson&&<p><strong>Lesson:</strong> {row.lesson}</p>}
          <div style={s.actions}><button style={s.button} onClick={()=>toggleRecovered(row)}>{row.recovered?'Reopen':'Mark recovered'}</button><button style={s.danger} onClick={()=>removeFailure(row.id)}>Delete</button></div>
        </div>)}
        {!failures.length&&<div style={s.empty}>No failures recorded. This is a learning record—not a punishment list.</div>}
      </div>
    </section>
  </div>;
}

function DisciplineBox({title,subtitle,kind,values,setItem}:{title:string,subtitle:string,kind:DisciplineItem['kind'],values:DisciplineItem[],setItem:(kind:DisciplineItem['kind'],position:number,value:string)=>void}) {
  const c=colours[kind];
  return <section style={{...s.disciplineBox,background:c.soft,borderColor:c.line}}>
    <div style={{...s.boxNumber,background:c.main}}>{title}</div>
    <p style={s.boxSubtitle}>{subtitle}</p>
    {values.map(row=><label key={row.position} style={s.label}><span>{kind[0].toUpperCase()+kind.slice(1)} {row.position}</span><textarea style={s.textarea} maxLength={280} value={row.content} onChange={e=>setItem(kind,row.position,e.target.value)} placeholder={kind==='pain'?'The cost of staying the same…':kind==='purpose'?'The person or future this is for…':'The action that demonstrates discipline…'}/></label>)}
  </section>
}

export function DisciplineReminder({userId,openDiscipline}:{userId:string,openDiscipline:()=>void}) {
  const [purposes,setPurposes]=useState<string[]>([]);
  const [settings,setSettings]=useState<ReminderSettings|null>(null);
  const [show,setShow]=useState(false);

  useEffect(()=>{
    let active=true;
    const check=async()=>{
      const [{data:i},{data:s}]=await Promise.all([
        supabase.from('discipline_items').select('content').eq('kind','purpose').order('position'),
        supabase.from('discipline_settings').select('*').maybeSingle()
      ]);
      if(!active||!s?.reminder_enabled)return;
      const list=(i||[]).map((x:any)=>String(x.content||'').trim()).filter(Boolean);
      setPurposes(list);setSettings(s as ReminderSettings);
      const now=new Date();
      const localDay=now.toISOString().slice(0,10);
      const current=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const reminder=String(s.reminder_time||'07:00').slice(0,5);
      if(current>=reminder&&s.last_reminded_on!==localDay&&list.length){
        setShow(true);
        if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
          new Notification('Your purpose today',{body:list.map((x:string,n:number)=>`${n+1}. ${x}`).join('\n')});
        }
        await supabase.from('discipline_settings').update({last_reminded_on:localDay,updated_at:new Date().toISOString()}).eq('user_id',userId);
      }
    };
    check();
    const timer=setInterval(check,60000);
    return()=>{active=false;clearInterval(timer)};
  },[userId]);

  if(!show||!settings)return null;
  return <div style={s.reminder}>
    <div><div style={s.eyebrow}>YOUR PURPOSE TODAY</div>{purposes.map((x,i)=><div key={i} style={s.reminderPurpose}><strong>{i+1}</strong><span>{x}</span></div>)}</div>
    <div style={s.actions}><button style={s.primary} onClick={()=>{setShow(false);openDiscipline()}}>Open Discipline</button><button style={s.button} onClick={()=>setShow(false)}>I remember</button></div>
  </div>;
}

const s:Record<string,React.CSSProperties>={
  hero:{display:'flex',justifyContent:'space-between',gap:24,alignItems:'center',padding:'28px',borderRadius:18,background:'linear-gradient(135deg,#172f2a,#294d44)',color:'#fff',boxShadow:'0 12px 30px rgba(23,47,42,.18)'},
  eyebrow:{fontSize:11,fontWeight:800,letterSpacing:'1.4px',color:'#78a99b'},
  heroTitle:{fontSize:30,margin:'8px 0'},heroCopy:{maxWidth:760,margin:0,color:'#d8e6e1',lineHeight:1.55},
  heroScore:{minWidth:120,textAlign:'center',padding:'18px',border:'1px solid rgba(255,255,255,.2)',borderRadius:14,background:'rgba(255,255,255,.08)'},heroTitle2:{margin:0},muted:{color:'#687773',lineHeight:1.5},
  triangleWrap:{maxWidth:620,margin:'28px auto 12px',display:'flex',flexDirection:'column',alignItems:'center',gap:5},
  triangleLayer:{height:72,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,letterSpacing:'2px',color:'#fff',filter:'drop-shadow(0 5px 8px rgba(0,0,0,.12))'},
  proofTriangle:{width:'38%',background:'#167257',clipPath:'polygon(50% 0,100% 100%,0 100%)',paddingTop:24},
  purposeTriangle:{width:'69%',background:'#9a6a1f',clipPath:'polygon(23% 0,77% 0,100% 100%,0 100%)'},
  painTriangle:{width:'100%',background:'#9f3f3f',clipPath:'polygon(15% 0,85% 0,100% 100%,0 100%)'},
  threeColumns:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,margin:'20px 0'},
  twoColumns:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:18,marginTop:22},
  card:{background:'#fff',border:'1px solid #e1ded6',borderRadius:16,padding:20,boxShadow:'0 4px 18px rgba(35,45,42,.05)'},
  disciplineBox:{border:'1px solid',borderRadius:16,padding:18},
  boxNumber:{display:'inline-block',color:'#fff',fontWeight:800,padding:'7px 11px',borderRadius:999},
  boxSubtitle:{minHeight:40,color:'#56635f',fontSize:13,lineHeight:1.4},
  label:{display:'block',fontSize:12,fontWeight:700,color:'#556460',margin:'11px 0 4px'},
  input:{display:'block',width:'100%',boxSizing:'border-box',border:'1px solid #d8d8d0',borderRadius:9,padding:'10px 11px',marginTop:5,font:'inherit',background:'#fff',color:'#1d2b2a'},
  textarea:{display:'block',width:'100%',boxSizing:'border-box',minHeight:70,border:'1px solid #d8d8d0',borderRadius:9,padding:'10px 11px',marginTop:5,font:'inherit',resize:'vertical',background:'#fff',color:'#1d2b2a'},
  button:{background:'#fff',border:'1px solid #d7d7cf',borderRadius:9,padding:'10px 14px',color:'#1d2b2a',cursor:'pointer',fontWeight:700},
  primary:{display:'inline-block',background:'#213c36',border:'1px solid #213c36',borderRadius:9,padding:'10px 14px',color:'#fff',cursor:'pointer',fontWeight:800},
  danger:{background:'#fff',border:'1px solid #dfb5b5',borderRadius:9,padding:'10px 14px',color:'#9f3f3f',cursor:'pointer',fontWeight:700},
  actions:{display:'flex',gap:8,flexWrap:'wrap',marginTop:12},
  checkRow:{display:'flex',gap:10,alignItems:'center',fontWeight:800,margin:'18px 0'},
  success:{margin:'14px 0',padding:'11px 14px',borderRadius:10,background:'#e9f6ef',border:'1px solid #b9dfca',color:'#147a55',fontWeight:800},
  notice:{margin:'14px 0',padding:'11px 14px',borderRadius:10,background:'#fff8e8',border:'1px solid #ead5a5',color:'#7a561e',fontWeight:800},
  historyHeader:{display:'flex',justifyContent:'space-between',gap:15,alignItems:'center'},
  failureCount:{padding:'8px 12px',borderRadius:999,background:'#f3f1eb',fontWeight:800,fontSize:12},
  history:{display:'grid',gap:12,marginTop:18},
  failureRow:{padding:16,border:'1px solid #ead5a5',borderLeft:'5px solid #9a6a1f',borderRadius:12,background:'#fffdfa'},
  recovered:{borderColor:'#b9dfca',borderLeftColor:'#167257',background:'#f5fbf8'},
  failureTop:{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'},
  openBadge:{padding:'5px 8px',borderRadius:999,background:'#fff1d2',color:'#7a561e',fontSize:11,fontWeight:800},
  recoveredBadge:{padding:'5px 8px',borderRadius:999,background:'#dff3e9',color:'#126147',fontSize:11,fontWeight:800},
  small:{fontSize:12,color:'#77817e',marginTop:4},correction:{padding:'10px',borderRadius:8,background:'#f6f3ea'},
  empty:{padding:26,textAlign:'center',color:'#77817e',border:'1px dashed #d8d8d0',borderRadius:12},
  reminder:{position:'fixed',right:22,bottom:22,zIndex:9999,width:'min(440px,calc(100vw - 44px))',boxSizing:'border-box',background:'#fff',border:'2px solid #c8a34c',borderRadius:16,padding:20,boxShadow:'0 18px 60px rgba(0,0,0,.28)',color:'#1d2b2a'},
  reminderPurpose:{display:'grid',gridTemplateColumns:'28px 1fr',gap:8,alignItems:'start',marginTop:10,lineHeight:1.4}
};
