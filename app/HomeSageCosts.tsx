"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

type CostRow={snapshot_date?:string|null;running_costs?:number|null;staff_costs?:number|null;premises_costs?:number|null;vehicle_costs?:number|null;admin_costs?:number|null;finance_costs?:number|null;rent_accrual?:number|null;electricity_accrual?:number|null;line_count?:number|null;cost_basis?:string|null};
type ProfitRow={snapshot_date?:string|null;sales_net?:number|null;gross_profit?:number|null};
type Snapshot={cost28:number;priorCost28:number;gp28:number;priorGp28:number;sales28:number;staff28:number;premises28:number;vehicle28:number;admin28:number;finance28:number;rent28:number;electric28:number;loading:boolean;error?:string};

const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n||0);
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const shift=(days:number)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return dateKey(d)};
const sum=(rows:CostRow[],key:keyof CostRow)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);

export default function HomeSageCosts(){
  const pathname=usePathname();
  const [costHost,setCostHost]=useState<HTMLElement|null>(null);
  const [netHost,setNetHost]=useState<HTMLElement|null>(null);
  const [data,setData]=useState<Snapshot>({cost28:0,priorCost28:0,gp28:0,priorGp28:0,sales28:0,staff28:0,premises28:0,vehicle28:0,admin28:0,finance28:0,rent28:0,electric28:0,loading:true});

  useEffect(()=>{
    if(pathname!=='/')return;
    let mounted=true;
    let costInserted:HTMLDivElement|null=null;
    let netInserted:HTMLDivElement|null=null;
    const attach=()=>{
      if(!mounted)return;
      const grid=document.querySelector('.businessPulse .pulseGrid');
      if(!grid)return;
      const sageProfit=grid.querySelector<HTMLElement>("[data-blueprint-sage-profit='true']");
      if(!costInserted){
        costInserted=document.createElement('div');
        costInserted.dataset.blueprintSageCosts='true';
        if(sageProfit?.nextSibling)grid.insertBefore(costInserted,sageProfit.nextSibling);else grid.appendChild(costInserted);
        setCostHost(costInserted);
      }
      if(!netInserted){
        netInserted=document.createElement('div');
        netInserted.dataset.blueprintSageNet='true';
        if(costInserted.nextSibling)grid.insertBefore(netInserted,costInserted.nextSibling);else grid.appendChild(netInserted);
        setNetHost(netInserted);
      }
    };
    attach();
    const observer=new MutationObserver(attach);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{mounted=false;observer.disconnect();costInserted?.remove();netInserted?.remove();setCostHost(null);setNetHost(null)};
  },[pathname]);

  useEffect(()=>{
    if(pathname!=='/'||(!costHost&&!netHost))return;
    let cancelled=false;
    const load=async()=>{
      const start56=shift(-55);
      const [costRes,profitRes]=await Promise.all([
        supabase.from('sage_running_cost_snapshots').select('snapshot_date,running_costs,staff_costs,premises_costs,vehicle_costs,admin_costs,finance_costs,rent_accrual,electricity_accrual,line_count,cost_basis').gte('snapshot_date',start56).order('snapshot_date',{ascending:false}),
        supabase.from('sage_profit_snapshots').select('snapshot_date,sales_net,gross_profit').gte('snapshot_date',start56).order('snapshot_date',{ascending:false})
      ]);
      if(cancelled)return;
      const error=costRes.error||profitRes.error;
      if(error){setData(d=>({...d,loading:false,error:error.message}));return;}
      const costs=(costRes.data||[]) as CostRow[];
      const profits=(profitRes.data||[]) as ProfitRow[];
      const start28=shift(-27),tomorrow=shift(1);
      const currentCosts=costs.filter(r=>{const d=r.snapshot_date||'';return d>=start28&&d<tomorrow});
      const priorCosts=costs.filter(r=>{const d=r.snapshot_date||'';return d>=start56&&d<start28});
      const currentProfit=profits.filter(r=>{const d=r.snapshot_date||'';return d>=start28&&d<tomorrow});
      const priorProfit=profits.filter(r=>{const d=r.snapshot_date||'';return d>=start56&&d<start28});
      setData({
        cost28:sum(currentCosts,'running_costs'),priorCost28:sum(priorCosts,'running_costs'),
        gp28:currentProfit.reduce((n,r)=>n+(Number(r.gross_profit)||0),0),priorGp28:priorProfit.reduce((n,r)=>n+(Number(r.gross_profit)||0),0),
        sales28:currentProfit.reduce((n,r)=>n+(Number(r.sales_net)||0),0),staff28:sum(currentCosts,'staff_costs'),premises28:sum(currentCosts,'premises_costs'),vehicle28:sum(currentCosts,'vehicle_costs'),admin28:sum(currentCosts,'admin_costs'),finance28:sum(currentCosts,'finance_costs'),rent28:sum(currentCosts,'rent_accrual'),electric28:sum(currentCosts,'electricity_accrual'),loading:false
      });
    };
    load();const timer=window.setInterval(load,15*60*1000);return()=>{cancelled=true;window.clearInterval(timer)};
  },[pathname,costHost,netHost]);

  const net=data.gp28-data.cost28;
  const priorNet=data.priorGp28-data.priorCost28;
  const costTrend=data.priorCost28?((data.cost28-data.priorCost28)/Math.abs(data.priorCost28))*100:null;
  const netTrend=priorNet?((net-priorNet)/Math.abs(priorNet))*100:null;
  const netMargin=data.sales28?(net/data.sales28)*100:0;

  return <>
    {costHost&&createPortal(<>
      <span>28-day running costs · Sage</span>
      <strong>{data.loading?'—':money(data.cost28)}</strong>
      <small className={costTrend!=null&&costTrend>0?'pulseBad':'pulseGood'}>{data.error?'Sage costs unavailable':costTrend==null?'Management cost basis':`${costTrend>=0?'+':''}${costTrend.toFixed(1)}% vs previous 28`}</small>
      {!data.loading&&!data.error&&<small style={{display:'block',marginTop:4}}>Staff {money(data.staff28)} · Premises {money(data.premises28)} · Vehicles {money(data.vehicle28)}</small>}
      {!data.loading&&!data.error&&<small style={{display:'block',marginTop:2,opacity:.72}}>Rent {money(data.rent28)} + electricity {money(data.electric28)} smoothed from trailing 12 months.</small>}
    </>,costHost)}
    {netHost&&createPortal(<>
      <span>28-day net profit · Management</span>
      <strong>{data.loading?'—':money(net)}</strong>
      <small className={net<0?'pulseBad':'pulseGood'}>{data.error?'Net profit unavailable':`${netMargin.toFixed(1)}% net margin${netTrend==null?'':` · ${netTrend>=0?'+':''}${netTrend.toFixed(1)}% vs previous 28`}`}</small>
      {!data.loading&&!data.error&&<small style={{display:'block',marginTop:4}}>Gross profit less running costs · before corporation tax/dividends</small>}
      {!data.loading&&!data.error&&<small style={{display:'block',marginTop:2,opacity:.72}}>Interest and depreciation excluded from management running costs.</small>}
    </>,netHost)}
  </>;
}
