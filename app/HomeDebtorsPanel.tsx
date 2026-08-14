"use client";

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

type Tx={account_ref?:string|null;due_date?:string|null;outstanding?:number|null};
type Action={account_ref:string;action_type:'called'|'promised_payment'|'paid'|'follow_up'|'note';promised_amount?:number|null;follow_up_date?:string|null;balance_at_action?:number|null;contacted_at:string};
type Snapshot={chase:number;overdue:number;outstanding:number;promises:number;broken:number;followups:number;live:boolean;loading:boolean};

const today=()=>new Date().toISOString().slice(0,10);
const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n||0);

export default function HomeDebtorsPanel(){
  const pathname=usePathname();
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [snapshot,setSnapshot]=useState<Snapshot>({chase:0,overdue:0,outstanding:0,promises:0,broken:0,followups:0,live:false,loading:true});

  useEffect(()=>{
    if(pathname!=='/')return;
    let mounted=true;
    let inserted:HTMLDivElement|null=null;
    const attach=()=>{
      if(!mounted)return;
      const pulse=document.querySelector('.businessPulse');
      if(pulse&&!inserted){
        inserted=document.createElement('div');
        inserted.dataset.blueprintDebtorsHome='true';
        pulse.insertAdjacentElement('afterend',inserted);
        setHost(inserted);
      }else if(!pulse&&inserted){
        inserted.remove(); inserted=null; setHost(null);
      }
    };
    attach();
    const observer=new MutationObserver(attach);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{mounted=false;observer.disconnect();inserted?.remove();setHost(null)};
  },[pathname]);

  useEffect(()=>{
    if(pathname!=='/'||!host)return;
    let cancelled=false;
    const load=async()=>{
      const [{data:t},{data:a},{data:s}]=await Promise.all([
        supabase.from('sage_transactions').select('account_ref,due_date,outstanding').limit(10000),
        supabase.from('debtor_collection_actions').select('account_ref,action_type,promised_amount,follow_up_date,balance_at_action,contacted_at').order('contacted_at',{ascending:false}).limit(5000),
        supabase.from('sage_bridge_status').select('last_seen').maybeSingle()
      ]);
      if(cancelled)return;
      const tx=(t||[]) as Tx[], actions=(a||[]) as Action[];
      const totals=new Map<string,{total:number;overdue:number}>();
      for(const tr of tx){
        const ref=tr.account_ref||''; if(!ref)continue;
        const out=Math.max(0,Number(tr.outstanding)||0); if(out<=0)continue;
        const x=totals.get(ref)||{total:0,overdue:0}; x.total+=out;
        if(tr.due_date&&tr.due_date<today())x.overdue+=out;
        totals.set(ref,x);
      }
      const byAccount=new Map<string,Action[]>();
      for(const action of actions){const arr=byAccount.get(action.account_ref)||[];arr.push(action);byAccount.set(action.account_ref,arr)}
      let chase=0,promises=0,broken=0,followups=0,outstanding=0,overdue=0;
      for(const [ref,x] of totals){
        outstanding+=x.total; overdue+=x.overdue;
        const aa=byAccount.get(ref)||[], last=aa[0], lastPromise=aa.find(v=>v.action_type==='promised_payment');
        const paidAfterPromise=!!lastPromise&&aa.some(v=>v.action_type==='paid'&&new Date(v.contacted_at).getTime()>new Date(lastPromise.contacted_at).getTime());
        const promiseAmount=Number(lastPromise?.promised_amount)||0, baseline=Number(lastPromise?.balance_at_action);
        const autoPaid=!!lastPromise&&promiseAmount>0&&lastPromise?.balance_at_action!=null&&Number.isFinite(baseline)&&x.total<=Math.max(0,baseline-promiseAmount+0.01);
        const satisfied=paidAfterPromise||autoPaid, promiseDate=lastPromise?.follow_up_date||null;
        const promiseDue=!!promiseDate&&promiseDate===today()&&!satisfied&&x.total>0;
        const brokenPromise=!!promiseDate&&promiseDate<today()&&!satisfied&&x.total>0;
        const followDue=!!last?.follow_up_date&&last.follow_up_date<=today()&&last.action_type!=='promised_payment';
        const contactedToday=!!last?.contacted_at&&last.contacted_at.slice(0,10)===today();
        if(promiseDue)promises++;
        if(brokenPromise)broken++;
        if(followDue)followups++;
        if(brokenPromise||promiseDue||followDue||(x.overdue>0&&!contactedToday))chase++;
      }
      const lastSeen=(s as any)?.last_seen?new Date((s as any).last_seen):null;
      setSnapshot({chase,overdue,outstanding,promises,broken,followups,live:!!lastSeen&&(Date.now()-lastSeen.getTime()<45*60*1000),loading:false});
    };
    load();
    return()=>{cancelled=true};
  },[pathname,host]);

  const content=useMemo(()=>{
    if(!host)return null;
    return <div className="card" style={{marginTop:18,marginBottom:18}}>
      <div className="goalHeader">
        <div><div className="kpiLabel">CASH COLLECTION · SAGE LIVE</div><h2 style={{marginBottom:4}}>Debtors command snapshot</h2><p className="muted" style={{marginTop:0}}>What needs collecting today, without leaving Blueprint Home.</p></div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}><span className="badge">{snapshot.live?'● LIVE':'● STALE'}</span><a className="btn primary" href="/debtors">Open Debtors</a></div>
      </div>
      <div className="pulseGrid" style={{marginTop:14}}>
        <div><span>Chase today</span><strong>{snapshot.loading?'—':snapshot.chase}</strong><small>{snapshot.broken?`${snapshot.broken} broken promise${snapshot.broken===1?'':'s'}`:'Priority collection queue'}</small></div>
        <div><span>Overdue</span><strong>{snapshot.loading?'—':money(snapshot.overdue)}</strong><small>Past due date in Sage</small></div>
        <div><span>Promises due</span><strong>{snapshot.loading?'—':snapshot.promises}</strong><small>Payment promises due today</small></div>
        <div><span>Broken promises</span><strong>{snapshot.loading?'—':snapshot.broken}</strong><small>{snapshot.broken?'Needs immediate follow-up':'None outstanding'}</small></div>
        <div><span>Follow-ups due</span><strong>{snapshot.loading?'—':snapshot.followups}</strong><small>Scheduled collection follow-ups</small></div>
        <div><span>Total outstanding</span><strong>{snapshot.loading?'—':money(snapshot.outstanding)}</strong><small>Sage open-item balance</small></div>
      </div>
    </div>;
  },[host,snapshot]);

  return host&&content?createPortal(content,host):null;
}
