"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

type Tx={type?:string|null;transaction_date?:string|null;net_amount?:number|null;gross_amount?:number|null};
type ProfitRow={snapshot_date?:string|null;sales_net?:number|null;cost_of_goods?:number|null;gross_profit?:number|null;gross_profit_pct?:number|null;line_count?:number|null;cost_basis?:string|null;synced_at?:string|null};

type SalesSnapshot={today:number;yesterday:number;days7:number;days28:number;prior28:number;loading:boolean;error?:string};
type ProfitSnapshot={sales28:number;gp28:number;priorGp28:number;lines28:number;costBasis:string;loading:boolean;error?:string};

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
  const [salesHost,setSalesHost]=useState<HTMLElement|null>(null);
  const [profitHost,setProfitHost]=useState<HTMLElement|null>(null);
  const [snapshot,setSnapshot]=useState<SalesSnapshot>({today:0,yesterday:0,days7:0,days28:0,prior28:0,loading:true});
  const [profit,setProfit]=useState<ProfitSnapshot>({sales28:0,gp28:0,priorGp28:0,lines28:0,costBasis:'',loading:true});

  useEffect(()=>{
    if(pathname!=='/')return;
    let mounted=true;
    let salesInserted:HTMLDivElement|null=null;
    let profitInserted:HTMLDivElement|null=null;
    let hiddenSales:HTMLElement|null=null;
    let hiddenProfit:HTMLElement|null=null;
    const attach=()=>{
      if(!mounted)return;
      const grid=document.querySelector('.businessPulse .pulseGrid');
      if(!grid)return;
      const children=Array.from(grid.children) as HTMLElement[];
      if(!salesInserted){
        hiddenSales=children.find(el=>(el.querySelector('span')?.textContent||'').trim().toLowerCase()==='28-day sales')||null;
        if(hiddenSales)hiddenSales.style.display='none';
        salesInserted=document.createElement('div');
        salesInserted.dataset.blueprintSageSales='true';
        grid.insertBefore(salesInserted,grid.firstChild);
        setSalesHost(salesInserted);
      }
      if(!profitInserted){
        hiddenProfit=children.find(el=>(el.querySelector('span')?.textContent||'').trim().toLowerCase()==='gross profit')||null;
        if(hiddenProfit)hiddenProfit.style.display='none';
        profitInserted=document.createElement('div');
        profitInserted.dataset.blueprintSageProfit='true';
        if(salesInserted?.nextSibling)grid.insertBefore(profitInserted,salesInserted.nextSibling);else grid.appendChild(profitInserted);
        setProfitHost(profitInserted);
      }
    };
    attach();
    const observer=new MutationObserver(attach);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{
      mounted=false;observer.disconnect();
      if(hiddenSales)hiddenSales.style.display='';
      if(hiddenProfit)hiddenProfit.style.display='';
      salesInserted?.remove();profitInserted?.remove();
      setSalesHost(null);setProfitHost(null);
    };
  },[pathname]);

  useEffect(()=>{
    if(pathname!=='/'||!salesHost)return;
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
      setSnapshot({today:sum(today,tomorrow),yesterday:sum(yesterday,today),days7:sum(start7,tomorrow),days28:sum(start28,tomorrow),prior28:sum(start56,start28),loading:false});
    };
    load();
    const timer=window.setInterval(load,15*60*1000);
    return()=>{cancelled=true;window.clearInterval(timer)};
  },[pathname,salesHost]);

  useEffect(()=>{
    if(pathname!=='/'||!profitHost)return;
    let cancelled=false;
    const loadProfit=async()=>{
      const start56=shift(-55);
      const {data,error}=await supabase.from('sage_profit_snapshots').select('snapshot_date,sales_net,cost_of_goods,gross_profit,gross_profit_pct,line_count,cost_basis,synced_at').gte('snapshot_date',start56).order('snapshot_date',{ascending:false});
      if(cancelled)return;
      if(error){setProfit(p=>({...p,loading:false,error:error.message}));return;}
      const rows=(data||[]) as ProfitRow[];
      const start28=shift(-27), tomorrow=shift(1);
      const current=rows.filter(r=>{const d=r.snapshot_date||'';return d>=start28&&d<tomorrow});
      const prior=rows.filter(r=>{const d=r.snapshot_date||'';return d>=start56&&d<start28});
      const sales28=current.reduce((n,r)=>n+(Number(r.sales_net)||0),0);
      const gp28=current.reduce((n,r)=>n+(Number(r.gross_profit)||0),0);
      const priorGp28=prior.reduce((n,r)=>n+(Number(r.gross_profit)||0),0);
      const lines28=current.reduce((n,r)=>n+(Number(r.line_count)||0),0);
      const costBasis=current.find(r=>r.cost_basis)?.cost_basis||'';
      setProfit({sales28,gp28,priorGp28,lines28,costBasis,loading:false});
    };
    loadProfit();
    const timer=window.setInterval(loadProfit,15*60*1000);
    return()=>{cancelled=true;window.clearInterval(timer)};
  },[pathname,profitHost]);

  const salesTrend=snapshot.prior28?((snapshot.days28-snapshot.prior28)/Math.abs(snapshot.prior28))*100:null;
  const gpPct=profit.sales28?(profit.gp28/profit.sales28)*100:0;
  const gpTrend=profit.priorGp28?((profit.gp28-profit.priorGp28)/Math.abs(profit.priorGp28))*100:null;

  return <>
    {salesHost&&createPortal(<>
      <span>28-day sales · Sage</span>
      <strong>{snapshot.loading?'—':money(snapshot.days28)}</strong>
      <small className={salesTrend!=null&&salesTrend<0?'pulseBad':'pulseGood'}>{snapshot.error?'Sage sales unavailable':salesTrend==null?'Posted Sage invoices / credits':`${salesTrend>=0?'+':''}${salesTrend.toFixed(1)}% vs previous 28`}</small>
      {!snapshot.loading&&!snapshot.error&&<small style={{display:'block',marginTop:4}}>Posted: Today {money(snapshot.today)} · Yesterday {money(snapshot.yesterday)} · 7 days {money(snapshot.days7)}</small>}
    </>,salesHost)}
    {profitHost&&createPortal(<>
      <span>28-day gross profit · Sage</span>
      <strong>{profit.loading?'—':money(profit.gp28)}</strong>
      <small className={gpTrend!=null&&gpTrend<0?'pulseBad':'pulseGood'}>{profit.error?'Sage GP unavailable':`${gpPct.toFixed(1)}% GP${gpTrend==null?'':` · ${gpTrend>=0?'+':''}${gpTrend.toFixed(1)}% vs previous 28`}`}</small>
      {!profit.loading&&!profit.error&&<small style={{display:'block',marginTop:4}}>{profit.lines28.toLocaleString('en-GB')} invoice lines · Average cost basis</small>}
      {!profit.loading&&!profit.error&&<small style={{display:'block',marginTop:2,opacity:.72}}>Zero or missing Sage product costs can overstate GP.</small>}
    </>,profitHost)}
  </>;
}
