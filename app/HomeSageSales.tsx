"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

type Tx={type?:string|null;transaction_date?:string|null;net_amount?:number|null;gross_amount?:number|null};

type SalesSnapshot={today:number;yesterday:number;days7:number;days28:number;prior28:number;loading:boolean;error?:string};

const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n||0);
const dateKey=(d:Date)=>{
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const shift=(days:number)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return dateKey(d)};

export default function HomeSageSales(){
  const pathname=usePathname();
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [snapshot,setSnapshot]=useState<SalesSnapshot>({today:0,yesterday:0,days7:0,days28:0,prior28:0,loading:true});

  useEffect(()=>{
    if(pathname!=='/')return;
    let mounted=true;
    let inserted:HTMLDivElement|null=null;
    let hidden:HTMLElement|null=null;
    const attach=()=>{
      if(!mounted)return;
      const grid=document.querySelector('.businessPulse .pulseGrid');
      if(grid&&!inserted){
        const children=Array.from(grid.children) as HTMLElement[];
        hidden=children.find(el=>(el.querySelector('span')?.textContent||'').trim().toLowerCase()==='28-day sales')||null;
        if(hidden)hidden.style.display='none';
        inserted=document.createElement('div');
        inserted.dataset.blueprintSageSales='true';
        grid.insertBefore(inserted,grid.firstChild);
        setHost(inserted);
      }
    };
    attach();
    const observer=new MutationObserver(attach);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{mounted=false;observer.disconnect();if(hidden)hidden.style.display='';inserted?.remove();setHost(null)};
  },[pathname]);

  useEffect(()=>{
    if(pathname!=='/'||!host)return;
    let cancelled=false;
    const load=async()=>{
      const {data,error}=await supabase.from('sage_transactions').select('type,transaction_date,net_amount,gross_amount').in('type',['SI','SC']).order('transaction_date',{ascending:false}).limit(10000);
      if(cancelled)return;
      if(error){setSnapshot(s=>({...s,loading:false,error:error.message}));return;}
      const rows=(data||[]) as Tx[];
      const value=(r:Tx)=>{
        const amount=Number(r.net_amount)||0;
        return (r.type||'').toUpperCase()==='SC'?-Math.abs(amount):Math.abs(amount);
      };
      const sum=(from:string,to?:string)=>rows.reduce((total,r)=>{
        const d=r.transaction_date||'';
        if(!d||d<from||(to&&d>=to))return total;
        return total+value(r);
      },0);
      const today=shift(0), tomorrow=shift(1), yesterday=shift(-1), start7=shift(-6), start28=shift(-27), start56=shift(-55);
      setSnapshot({
        today:sum(today,tomorrow),
        yesterday:sum(yesterday,today),
        days7:sum(start7,tomorrow),
        days28:sum(start28,tomorrow),
        prior28:sum(start56,start28),
        loading:false
      });
    };
    load();
    const timer=window.setInterval(load,15*60*1000);
    return()=>{cancelled=true;window.clearInterval(timer)};
  },[pathname,host]);

  if(!host)return null;
  const trend=snapshot.prior28?((snapshot.days28-snapshot.prior28)/Math.abs(snapshot.prior28))*100:null;
  return createPortal(<>
    <span>28-day sales · Sage</span>
    <strong>{snapshot.loading?'—':money(snapshot.days28)}</strong>
    <small className={trend!=null&&trend<0?'pulseBad':'pulseGood'}>{snapshot.error?'Sage sales unavailable':trend==null?'Live from Sage invoices / credits':`${trend>=0?'+':''}${trend.toFixed(1)}% vs previous 28`}</small>
    {!snapshot.loading&&!snapshot.error&&<small style={{display:'block',marginTop:4}}>Today {money(snapshot.today)} · Yesterday {money(snapshot.yesterday)} · 7 days {money(snapshot.days7)}</small>}
  </>,host);
}
