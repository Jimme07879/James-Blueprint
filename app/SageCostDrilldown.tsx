"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";

type CostRow={
  cost_key:string;transaction_date:string;transaction_number?:string|null;split_number?:string|null;
  type?:string|null;nominal_code:string;nominal_name?:string|null;reference?:string|null;details?:string|null;
  net_amount:number;normalized_cost:number;category:string;included_in_management:boolean;exclusion_reason?:string|null;
};

const money=(n:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",minimumFractionDigits:2}).format(n||0);
const today=()=>new Date().toISOString().slice(0,10);

export default function SageCostDrilldown(){
  const [active,setActive]=useState(false);
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [rows,setRows]=useState<CostRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [from,setFrom]=useState("2026-04-01");
  const [to,setTo]=useState(today());
  const [category,setCategory]=useState("All included costs");
  const [search,setSearch]=useState("");
  const [expanded,setExpanded]=useState(false);

  useEffect(()=>{
    const sync=()=>{
      const heading=document.querySelector(".main .topbar h1")?.textContent?.trim();
      setActive(heading==="Finance");
      setHost(document.querySelector(".liveTabMount section") as HTMLElement|null);
    };
    sync();const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    if(!active)return;
    let cancelled=false;
    const load=async()=>{
      setLoading(true);setError("");
      const {data,error}=await supabase.from("sage_cost_transactions")
        .select("cost_key,transaction_date,transaction_number,split_number,type,nominal_code,nominal_name,reference,details,net_amount,normalized_cost,category,included_in_management,exclusion_reason")
        .gte("transaction_date",from).lte("transaction_date",to)
        .order("transaction_date",{ascending:false}).limit(5000);
      if(cancelled)return;
      if(error)setError(error.message);else setRows((data||[]) as CostRow[]);
      setLoading(false);
    };
    load();return()=>{cancelled=true};
  },[active,from,to]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return rows.filter(row=>{
      if(category==="All included costs"&&!row.included_in_management)return false;
      if(category==="Excluded / accounting only"&&row.included_in_management)return false;
      if(category!=="All Sage entries"&&category!=="All included costs"&&category!=="Excluded / accounting only"&&row.category!==category)return false;
      if(!q)return true;
      return [row.nominal_code,row.nominal_name,row.reference,row.details,row.transaction_number,row.type].some(v=>(v||"").toLowerCase().includes(q));
    });
  },[rows,category,search]);

  const grouped=useMemo(()=>{
    const map=new Map<string,{code:string;name:string;category:string;total:number;entries:number}>();
    filtered.forEach(row=>{const key=`${row.category}|${row.nominal_code}`;const item=map.get(key)||{code:row.nominal_code,name:row.nominal_name||"Unlabelled nominal",category:row.category,total:0,entries:0};item.total+=Number(row.normalized_cost)||0;item.entries++;map.set(key,item)});
    return [...map.values()].sort((a,b)=>Math.abs(b.total)-Math.abs(a.total));
  },[filtered]);
  const total=filtered.reduce((sum,row)=>sum+(Number(row.normalized_cost)||0),0);
  const categories=["All included costs","All Sage entries","Staff","Premises","Vehicles","Admin / tech","Finance","Excluded / accounting only"];

  if(!active||!host)return null;
  return createPortal(<div style={{marginTop:18}} className="sageCostDrilldown">
    <div className="card" style={{borderWidth:2}}>
      <div className="goalHeader"><div><div className="kpiLabel">SAGE COST DRILL-DOWN · FROM 1 APRIL 2026</div><h2 style={{margin:"7px 0 4px"}}>Individual cost entries</h2><div className="muted">Trace each cost category to its Sage nominal code, reference and transaction.</div></div><button className="btn" onClick={()=>setExpanded(v=>!v)}>{expanded?"Hide entries":"Show entries"}</button></div>
      <div className="grid cols3" style={{marginTop:14}}>
        <label><span className="kpiLabel">FROM</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label><span className="kpiLabel">TO</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
        <label><span className="kpiLabel">COST AREA</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
      </div>
      <label style={{display:"block",marginTop:12}}><span className="kpiLabel">SEARCH NOMINAL, SUPPLIER, REFERENCE OR DESCRIPTION</span><input style={{width:"100%"}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="For example: insurance, fuel, 7300…"/></label>
      {error&&<div className="notice" style={{marginTop:12}}>{error.includes("Could not find the table")?"The drill-down database is ready to be installed.":error}</div>}
      {!error&&!loading&&!rows.length&&<div className="notice" style={{marginTop:12}}>The screen is ready. Run the updated Sage bridge once on the office PC to load the individual entries.</div>}
      <div className="kpiGrid" style={{marginTop:14}}><div className="card"><div className="kpiLabel">FILTERED COST</div><div className="kpiValue">{loading?"—":money(total)}</div><small>{filtered.length.toLocaleString("en-GB")} Sage entries</small></div><div className="card"><div className="kpiLabel">NOMINAL ACCOUNTS</div><div className="kpiValue">{loading?"—":grouped.length}</div><small>Sorted by largest absolute cost</small></div></div>
      <div style={{overflowX:"auto",marginTop:16}}><table><thead><tr><th>Category</th><th>Nominal</th><th>Name</th><th>Entries</th><th>Total</th></tr></thead><tbody>{grouped.map(x=><tr key={`${x.category}-${x.code}`}><td>{x.category}</td><td><b>{x.code}</b></td><td>{x.name}</td><td>{x.entries}</td><td><b>{money(x.total)}</b></td></tr>)}</tbody></table></div>
      {expanded&&<div style={{overflowX:"auto",marginTop:18}}><table><thead><tr><th>Date</th><th>Category</th><th>Nominal</th><th>Reference / details</th><th>Type</th><th>Cost</th><th>Status</th></tr></thead><tbody>{filtered.slice(0,1000).map(row=><tr key={row.cost_key}><td>{new Date(`${row.transaction_date}T12:00:00`).toLocaleDateString("en-GB")}</td><td>{row.category}</td><td><b>{row.nominal_code}</b>{row.nominal_name?<><br/><small>{row.nominal_name}</small></>:null}</td><td>{row.reference||row.details||row.transaction_number||"—"}{row.reference&&row.details?<><br/><small>{row.details}</small></>:null}</td><td>{row.type||"—"}</td><td><b>{money(row.normalized_cost)}</b></td><td>{row.included_in_management?"Included":row.exclusion_reason||"Excluded"}</td></tr>)}</tbody></table>{filtered.length>1000&&<div className="muted" style={{marginTop:8}}>Showing the newest 1,000 of {filtered.length.toLocaleString("en-GB")} filtered entries.</div>}</div>}
      <div className="muted small" style={{marginTop:12}}>Rent and electricity actual postings are shown under “All Sage entries” but excluded from the management total because Blueprint replaces them with smoothed accruals.</div>
    </div>
  </div>,host);
}
