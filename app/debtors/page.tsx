"use client";

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

type SageCustomer = {
  account_ref:string; name?:string|null; balance?:number|null; telephone?:string|null; email?:string|null;
};
type SageTransaction = {
  tran_number:string; type?:string|null; transaction_date?:string|null; account_ref?:string|null; inv_ref?:string|null;
  details?:string|null; due_date?:string|null; gross_amount?:number|null; amount_paid?:number|null; outstanding?:number|null;
  paid_flag?:number|null; paid_status?:string|null;
};
type BridgeStatus = { last_seen?:string|null; last_transaction_count?:number|null; last_sync_message?:string|null };

const gbp=(n:any)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(n)||0);
const today=()=>new Date().toISOString().slice(0,10);
const dayDiff=(a:string,b:string)=>Math.floor((new Date(a+'T12:00:00').getTime()-new Date(b+'T12:00:00').getTime())/86400000);

export default function DebtorsPage(){
  const [session,setSession]=useState<Session|null>(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [customers,setCustomers]=useState<SageCustomer[]>([]);
  const [transactions,setTransactions]=useState<SageTransaction[]>([]);
  const [status,setStatus]=useState<BridgeStatus|null>(null);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState('');
  const [filter,setFilter]=useState<'all'|'overdue'|'90'>('overdue');

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false)});
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return()=>sub.subscription.unsubscribe();
  },[]);

  const load=async()=>{
    setLoading(true);
    const [{data:c},{data:t},{data:s}]=await Promise.all([
      supabase.from('sage_customers').select('account_ref,name,balance,telephone,email').order('name'),
      supabase.from('sage_transactions').select('tran_number,type,transaction_date,account_ref,inv_ref,details,due_date,gross_amount,amount_paid,outstanding,paid_flag,paid_status').order('transaction_date',{ascending:false}).limit(10000),
      supabase.from('sage_bridge_status').select('last_seen,last_transaction_count,last_sync_message').maybeSingle()
    ]);
    setCustomers((c||[]) as SageCustomer[]); setTransactions((t||[]) as SageTransaction[]); setStatus((s||null) as BridgeStatus|null); setLoading(false);
  };
  useEffect(()=>{if(session)load()},[session]);

  const book=useMemo(()=>{
    const names=new Map(customers.map(c=>[c.account_ref,c]));
    const map=new Map<string,any>();
    for(const tr of transactions){
      const ref=tr.account_ref||''; if(!ref)continue;
      const c=names.get(ref); const x=map.get(ref)||{account_ref:ref,name:c?.name||ref,telephone:c?.telephone||'',email:c?.email||'',total:0,current:0,d30:0,d60:0,d90:0,older:0,invoices:0,oldest:0,rows:[] as SageTransaction[]};
      const out=Math.max(0,Number(tr.outstanding)||0); if(out<=0)continue;
      x.total+=out; x.invoices++; x.rows.push(tr);
      if(!tr.due_date||tr.due_date>=today())x.current+=out;
      else { const days=Math.max(1,dayDiff(today(),tr.due_date)); x.oldest=Math.max(x.oldest,days); if(days<=30)x.d30+=out; else if(days<=60)x.d60+=out; else if(days<=90)x.d90+=out; else x.older+=out; }
      map.set(ref,x);
    }
    return [...map.values()].sort((a,b)=>(b.older*5+b.d90*4+b.d60*3+b.d30*2+b.total)-(a.older*5+a.d90*4+a.d60*3+a.d30*2+a.total));
  },[transactions,customers]);

  const total=book.reduce((a,c)=>a+c.total,0), overdue=book.reduce((a,c)=>a+c.d30+c.d60+c.d90+c.older,0);
  const d30=book.reduce((a,c)=>a+c.d30,0), d60=book.reduce((a,c)=>a+c.d60,0), d90=book.reduce((a,c)=>a+c.d90,0), older=book.reduce((a,c)=>a+c.older,0);
  const visible=book.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.account_ref.toLowerCase().includes(search.toLowerCase())).filter(c=>filter==='all'||(filter==='overdue'&&(c.d30+c.d60+c.d90+c.older)>0)||(filter==='90'&&c.older>0));
  const selectedCustomer=book.find(c=>c.account_ref===selected)||visible[0]||book[0];
  const lastSeen=status?.last_seen?new Date(status.last_seen):null; const live=!!lastSeen&&(Date.now()-lastSeen.getTime()<45*60*1000);

  if(authLoading)return <main style={styles.wrap}><div style={styles.card}>Loading Blueprint…</div></main>;
  if(!session)return <main style={styles.wrap}><div style={styles.card}><h1>Blueprint Debtors</h1><p>Sign in to Blueprint first, then reopen this page.</p><a href="/" style={styles.primary}>Open Blueprint</a></div></main>;

  return <main style={styles.wrap}>
    <div style={styles.top}><div><div style={styles.eyebrow}>BLUEPRINT OS · SAGE DEBTORS</div><h1 style={styles.h1}>Cash collection command centre</h1><p style={styles.muted}>Live read-only Sage debtor intelligence. See who owes what, how late it is and who to chase first.</p></div><div style={{...styles.status,color:live?'#147a55':'#a15c34'}}>{live?'● LIVE':'● STALE'}</div></div>
    <div style={styles.actions}><a href="/" style={styles.button}>← Blueprint</a><button style={styles.button} onClick={load}>{loading?'Refreshing…':'Refresh Sage'}</button></div>

    <section style={styles.kpis}>
      <Kpi label="Total outstanding" value={gbp(total)}/><Kpi label="Overdue" value={gbp(overdue)}/><Kpi label="1–30 days" value={gbp(d30)}/><Kpi label="31–60 days" value={gbp(d60)}/><Kpi label="61–90 days" value={gbp(d90)}/><Kpi label="90+ days" value={gbp(older)}/>
    </section>

    {!transactions.length?<section style={styles.card}><div style={styles.eyebrow}>TRANSACTION FEED</div><h2>No Sage transactions synced yet</h2><p style={styles.muted}>The debtor screen is built and ready. The Sage PC bridge now needs the 6.2 transaction sync enabled so AUDIT_HEADER can populate this page.</p><p style={styles.small}>Customers are already live; this is the final bridge step for invoice-by-invoice debtors.</p></section>:
    <section style={styles.grid}>
      <div style={styles.card}><div style={styles.cardHead}><div><div style={styles.eyebrow}>WHO NEEDS CHASING?</div><h2 style={styles.h2}>{visible.length} accounts in view</h2></div></div>
        <input style={styles.input} placeholder="Search customer or A/C…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={styles.filters}><button style={filter==='overdue'?styles.primary:styles.button} onClick={()=>setFilter('overdue')}>Overdue</button><button style={filter==='90'?styles.primary:styles.button} onClick={()=>setFilter('90')}>90+ days</button><button style={filter==='all'?styles.primary:styles.button} onClick={()=>setFilter('all')}>All outstanding</button></div>
        <div>{visible.slice(0,200).map(c=><button key={c.account_ref} onClick={()=>setSelected(c.account_ref)} style={{...styles.row,...(selectedCustomer?.account_ref===c.account_ref?styles.rowActive:{})}}><span><strong>{c.name}</strong><small style={styles.small}>{c.account_ref} · {c.invoices} open · oldest {c.oldest||0} days</small></span><span style={{textAlign:'right'}}><strong>{gbp(c.total)}</strong><small style={{...styles.small,color:c.older>0?'#b04444':c.d60+c.d90>0?'#a26720':'inherit'}}>{c.older>0?`${gbp(c.older)} 90+`:c.d30+c.d60+c.d90>0?'Overdue':'Current'}</small></span></button>)}</div>
      </div>
      {selectedCustomer&&<div>
        <section style={styles.card}><div style={styles.cardHead}><div><div style={styles.eyebrow}>CUSTOMER DEBTOR VIEW</div><h2 style={styles.h2}>{selectedCustomer.name}</h2><p style={styles.small}>A/C {selectedCustomer.account_ref}</p></div><strong style={styles.bigMoney}>{gbp(selectedCustomer.total)}</strong></div>
          <div style={styles.miniKpis}><Mini label="Current" value={gbp(selectedCustomer.current)}/><Mini label="1–30" value={gbp(selectedCustomer.d30)}/><Mini label="31–60" value={gbp(selectedCustomer.d60)}/><Mini label="61–90" value={gbp(selectedCustomer.d90)}/><Mini label="90+" value={gbp(selectedCustomer.older)}/></div>
          <div style={styles.actions}>{selectedCustomer.telephone&&<a href={`tel:${String(selectedCustomer.telephone).replace(/\s/g,'')}`} style={styles.primary}>Call customer</a>}{selectedCustomer.email&&<a href={`mailto:${selectedCustomer.email}?subject=${encodeURIComponent('Account balance')}`} style={styles.button}>Email</a>}</div>
        </section>
        <section style={styles.card}><div style={styles.eyebrow}>OPEN ITEMS</div><h2 style={styles.h2}>Invoice-by-invoice</h2><div style={{overflowX:'auto'}}><table style={styles.table}><thead><tr><th>Date</th><th>Ref</th><th>Due</th><th>Type</th><th>Gross</th><th>Outstanding</th><th>Age</th></tr></thead><tbody>{selectedCustomer.rows.sort((a:SageTransaction,b:SageTransaction)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')).map((tr:SageTransaction)=><tr key={tr.tran_number}><td>{tr.transaction_date?new Date(tr.transaction_date+'T12:00:00').toLocaleDateString('en-GB'):'—'}</td><td>{tr.inv_ref||tr.tran_number}</td><td>{tr.due_date?new Date(tr.due_date+'T12:00:00').toLocaleDateString('en-GB'):'—'}</td><td>{tr.type||'—'}</td><td>{gbp(tr.gross_amount)}</td><td><strong>{gbp(tr.outstanding)}</strong></td><td>{tr.due_date&&tr.due_date<today()?`${dayDiff(today(),tr.due_date)}d overdue`:'Current'}</td></tr>)}</tbody></table></div></section>
      </div>}
    </section>}
    <div style={styles.footer}>Last Sage heartbeat: {lastSeen?lastSeen.toLocaleString('en-GB'):'Never'} · Transactions synced: {status?.last_transaction_count||0}</div>
  </main>;
}

function Kpi({label,value}:{label:string,value:string}){return <div style={styles.card}><div style={styles.eyebrow}>{label}</div><div style={styles.kpiValue}>{value}</div></div>}
function Mini({label,value}:{label:string,value:string}){return <div><span style={styles.small}>{label}</span><strong style={{display:'block',fontSize:18}}>{value}</strong></div>}

const styles:Record<string,React.CSSProperties>={
  wrap:{minHeight:'100vh',background:'#f4f1ea',color:'#1d2b2a',padding:'34px',fontFamily:'Inter,Arial,sans-serif'}, top:{display:'flex',justifyContent:'space-between',gap:20,alignItems:'flex-start',maxWidth:1500,margin:'0 auto'}, h1:{fontSize:36,margin:'7px 0'}, h2:{margin:'5px 0 12px'}, muted:{color:'#64706c',maxWidth:760}, small:{display:'block',fontSize:12,color:'#77817e',marginTop:4}, eyebrow:{fontSize:11,fontWeight:800,letterSpacing:'1.4px',color:'#55766d'}, status:{fontWeight:800,fontSize:13,padding:'10px 14px',background:'#fff',borderRadius:999}, actions:{display:'flex',gap:10,flexWrap:'wrap',maxWidth:1500,margin:'18px auto'}, button:{display:'inline-block',background:'#fff',border:'1px solid #d7d7cf',borderRadius:9,padding:'10px 14px',color:'#1d2b2a',textDecoration:'none',cursor:'pointer'}, primary:{display:'inline-block',background:'#213c36',border:'1px solid #213c36',borderRadius:9,padding:'10px 14px',color:'#fff',textDecoration:'none',cursor:'pointer'}, kpis:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,maxWidth:1500,margin:'0 auto 18px'}, card:{background:'#fff',border:'1px solid #e1ded6',borderRadius:16,padding:20,boxShadow:'0 4px 18px rgba(35,45,42,.05)'}, kpiValue:{fontSize:27,fontWeight:800,marginTop:8}, grid:{display:'grid',gridTemplateColumns:'minmax(330px,.85fr) minmax(500px,1.5fr)',gap:18,maxWidth:1500,margin:'0 auto'}, cardHead:{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start'}, input:{width:'100%',boxSizing:'border-box',border:'1px solid #d9d7d0',borderRadius:9,padding:'11px 12px',margin:'6px 0 10px'}, filters:{display:'flex',gap:7,flexWrap:'wrap',marginBottom:10}, row:{width:'100%',display:'flex',justifyContent:'space-between',gap:12,textAlign:'left',padding:'12px',border:'0',borderTop:'1px solid #ece9e2',background:'transparent',cursor:'pointer',color:'#1d2b2a'}, rowActive:{background:'#eef3f0',borderRadius:9}, bigMoney:{fontSize:28}, miniKpis:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(90px,1fr))',gap:12,padding:'15px 0',borderTop:'1px solid #eeeae2',borderBottom:'1px solid #eeeae2'}, table:{width:'100%',borderCollapse:'collapse',fontSize:13}, footer:{maxWidth:1500,margin:'18px auto',fontSize:12,color:'#77817e'}
};
