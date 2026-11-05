"use client";

import {useEffect, useMemo, useState} from "react";
import {supabase} from "../lib/supabase";

type Area = "Relationship" | "Personal" | "Business" | "Other";
type Status = "open" | "waiting" | "done";
type Commitment = {
  id:string; area:Area; title:string; next_action:string; review_date:string;
  status:Status; step_count:number; last_progress_at:string|null;
  completed_at:string|null;
};
type Draft = {area:Area;title:string;next_action:string;review_date:string;status:Status};
const localToday=()=>{
  const d=new Date();
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
};
const blank=():Draft=>({area:"Relationship",title:"",next_action:"",review_date:localToday(),status:"open"});
const rowStyle:React.CSSProperties={border:"1px solid var(--line, #dce2df)",borderRadius:12,padding:14,background:"var(--card, transparent)"};
const inputStyle:React.CSSProperties={boxSizing:"border-box",width:"100%",border:"1px solid #c9d1ce",borderRadius:8,padding:"10px 11px",color:"#192b26",background:"#fff"};
const smallButton:React.CSSProperties={border:"1px solid #b8c7c1",borderRadius:8,padding:"8px 12px",cursor:"pointer",background:"#fff",color:"#1b3930",fontWeight:700};
const primaryButton:React.CSSProperties={...smallButton,background:"#234b3d",color:"white"};
const formatDate=(s:string)=>new Date(s+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});

export default function CommitmentsCentre({userId,compact=false,onOpen}:{userId:string;compact?:boolean;onOpen?:()=>void}){
  const [rows,setRows]=useState<Commitment[]>([]);
  const [draft,setDraft]=useState<Draft>(blank);
  const [edit,setEdit]=useState<{id:string;draft:Draft;logStep:boolean}|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const today=localToday();

  const load=async()=>{
    const {data,error}=await supabase.from("follow_through_commitments")
      .select("id,area,title,next_action,review_date,status,step_count,last_progress_at,completed_at")
      .eq("user_id",userId).order("review_date",{ascending:true});
    if(error){setMessage("Could not load commitments: "+error.message);}
    else {setRows((data||[]) as Commitment[]);}
    setLoading(false);
  };
  useEffect(()=>{void load()},[userId]);

  const active=useMemo(()=>rows.filter(r=>r.status!=="done")
    .sort((a,b)=>(a.review_date>b.review_date?1:a.review_date<b.review_date?-1:0)),[rows]);
  const due=active.filter(r=>r.review_date<=today);
  const waiting=active.filter(r=>r.status==="waiting");
  const finished=rows.filter(r=>r.status==="done");

  const valid=(d:Draft)=>Boolean(d.title.trim()&&d.next_action.trim()&&d.review_date);
  const add=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!valid(draft))return;
    setSaving(true);setMessage("");
    const {error}=await supabase.from("follow_through_commitments").insert({
      user_id:userId,area:draft.area,title:draft.title.trim(),
      next_action:draft.next_action.trim(),review_date:draft.review_date,status:draft.status
    });
    setSaving(false);
    if(error)setMessage("Could not save: "+error.message);
    else{setDraft(blank());setMessage("Commitment added. It now has a next action and review date.");await load();}
  };
  const beginEdit=(r:Commitment,logStep=false)=>{
    setEdit({id:r.id,logStep,draft:{area:r.area,title:r.title,next_action:r.next_action,review_date:r.review_date,status:r.status}});
    setMessage("");
  };
  const saveEdit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!edit||!valid(edit.draft))return;
    const row=rows.find(r=>r.id===edit.id);if(!row)return;
    const update:Record<string,unknown>={
      area:edit.draft.area,title:edit.draft.title.trim(),
      next_action:edit.draft.next_action.trim(),review_date:edit.draft.review_date,
      status:edit.draft.status,updated_at:new Date().toISOString()
    };
    if(edit.logStep){
      update.step_count=(row.step_count||0)+1;
      update.last_progress_at=new Date().toISOString();
    }
    setSaving(true);setMessage("");
    const {error}=await supabase.from("follow_through_commitments").update(update)
      .eq("id",edit.id).eq("user_id",userId);
    setSaving(false);
    if(error)setMessage("Could not update: "+error.message);
    else{setEdit(null);setMessage(edit.logStep?"Progress recorded and next action scheduled.":"Commitment updated.");await load();}
  };
  const markDone=async(r:Commitment)=>{
    if(!window.confirm("Is the entire commitment complete (not just the next step)?"))return;
    setSaving(true);setMessage("");
    const {error}=await supabase.from("follow_through_commitments").update({
      status:"done",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq("id",r.id).eq("user_id",userId);
    setSaving(false);
    if(error)setMessage("Could not complete: "+error.message);
    else{setMessage("Commitment completed.");await load();}
  };
  const reopen=async(r:Commitment)=>{
    setSaving(true);setMessage("");
    const {error}=await supabase.from("follow_through_commitments").update({
      status:"open",completed_at:null,review_date:today,updated_at:new Date().toISOString()
    }).eq("id",r.id).eq("user_id",userId);
    setSaving(false);
    if(error)setMessage("Could not reopen: "+error.message);
    else{setMessage("Commitment reopened for review today.");await load();}
  };
  const remove=async(r:Commitment)=>{
    if(!window.confirm("Remove this commitment? This cannot be undone."))return;
    setSaving(true);setMessage("");
    const {error}=await supabase.from("follow_through_commitments").delete()
      .eq("id",r.id).eq("user_id",userId);
    setSaving(false);
    if(error)setMessage("Could not remove: "+error.message);
    else{setMessage("Commitment removed.");await load();}
  };
  const formFields=(value:Draft,change:(next:Draft)=>void)=>(
    <div style={{display:"grid",gap:10}}>
      <label style={{display:"grid",gap:4,fontWeight:700,fontSize:13}}>Area
        <select style={inputStyle} value={value.area} onChange={e=>change({...value,area:e.target.value as Area})}>
          {(["Relationship","Personal","Business","Other"] as Area[]).map(a=><option key={a}>{a}</option>)}
        </select>
      </label>
      <label style={{display:"grid",gap:4,fontWeight:700,fontSize:13}}>Commitment / outcome
        <input style={inputStyle} maxLength={180} value={value.title} onChange={e=>change({...value,title:e.target.value})} placeholder="What have I said I will do?" required/>
      </label>
      <label style={{display:"grid",gap:4,fontWeight:700,fontSize:13}}>Very next action
        <input style={inputStyle} maxLength={500} value={value.next_action} onChange={e=>change({...value,next_action:e.target.value})} placeholder="One physical action, not a vague intention" required/>
      </label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
        <label style={{display:"grid",gap:4,fontWeight:700,fontSize:13}}>Review / action date
          <input type="date" style={inputStyle} value={value.review_date} onChange={e=>change({...value,review_date:e.target.value})} required/>
        </label>
        <label style={{display:"grid",gap:4,fontWeight:700,fontSize:13}}>Status
          <select style={inputStyle} value={value.status} onChange={e=>change({...value,status:e.target.value as Status})}>
            <option value="open">To action</option>
            <option value="waiting">Waiting / parked with a date</option>
          </select>
        </label>
      </div>
    </div>
  );

  if(compact){
    return <section style={{...rowStyle,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div><div className="kpiLabel">FOLLOW-THROUGH · TODAY</div>
          <h2 style={{margin:"5px 0"}}>Don't let commitments disappear</h2>
          <p className="muted" style={{margin:0}}>{due.length} need review today or earlier · {active.length} open in total</p>
        </div>
        <button style={primaryButton} onClick={onOpen}>Open commitments</button>
      </div>
      {message&&<p role="alert" style={{color:"#9b311e"}}>{message}</p>}
      {loading?<p className="muted">Loading commitments…</p>:
        active.length===0?<p className="muted">Nothing recorded yet. Add your next promises in Commitments.</p>:
        <div style={{display:"grid",gap:8,marginTop:12}}>
          {(due.length?due:active).slice(0,3).map(r=><div key={r.id} style={{padding:"9px 0",borderTop:"1px solid #dbe3df"}}>
            <strong>{r.area}: {r.title}</strong><div className="muted">Next: {r.next_action}</div>
            <small>{r.review_date<today?"Overdue since ":"Review "}{formatDate(r.review_date)}{r.status==="waiting"?" · Waiting":""}</small>
          </div>)}
        </div>}
    </section>;
  }

  return <section style={{display:"grid",gap:18}}>
    <div style={{...rowStyle,padding:18}}>
      <div className="kpiLabel">COMMITMENTS & FOLLOW-THROUGH</div>
      <h2 style={{margin:"6px 0"}}>Remember it. Schedule it. Do it.</h2>
      <p className="muted" style={{marginBottom:0}}>One trusted place for promises across your relationship, personal growth and business. Every open commitment has a next action and a date. Review the list even when life feels calm.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
        <span><strong>{due.length}</strong> need review</span><span><strong>{active.length}</strong> open</span>
        <span><strong>{finished.length}</strong> finished</span>
      </div>
    </div>
    {message&&<div role="status" style={{...rowStyle,borderColor:"#a9c9b9"}}>{message}</div>}
    <form onSubmit={add} style={{...rowStyle,display:"grid",gap:12}}>
      <h3 style={{margin:0}}>Capture a commitment</h3>
      {formFields(draft,setDraft)}
      <button type="submit" style={primaryButton} disabled={saving||!valid(draft)}>{saving?"Saving…":"Save commitment + next action"}</button>
    </form>
    <div style={{display:"grid",gap:12}}>
      <h3 style={{margin:0}}>What needs doing</h3>
      {loading&&<p className="muted">Loading commitments…</p>}
      {!loading&&active.length===0&&<p className="muted">No open commitments yet. Start with one small, real promise.</p>}
      {active.map(r=><article key={r.id} style={{...rowStyle,borderLeft:r.review_date<=today?"5px solid #bd7a30":"5px solid #4a8b73"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:10,flexWrap:"wrap"}}>
          <div><div className="kpiLabel">{r.area.toUpperCase()} · {r.status==="waiting"?"WAITING":"TO ACTION"}</div>
            <h4 style={{margin:"5px 0 7px"}}>{r.title}</h4>
            <div><strong>Next:</strong> {r.next_action}</div>
            <div className="muted" style={{fontSize:13,marginTop:6}}>{r.review_date<today?"Overdue · ":r.review_date===today?"Today · ":"Review · "}{formatDate(r.review_date)} · {r.step_count||0} steps logged</div>
          </div>
        </div>
        {edit?.id===r.id?
          <form onSubmit={saveEdit} style={{marginTop:14,display:"grid",gap:10}}>
            <p className="muted" style={{margin:0}}>{edit.logStep?"Great — log the step by setting what happens next.":"Update this commitment without losing track of it."}</p>
            {formFields(edit.draft,next=>setEdit(current=>current?{...current,draft:next}:current))}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button type="submit" style={primaryButton} disabled={saving||!valid(edit.draft)}>{saving?"Saving…":edit.logStep?"Log step and save next action":"Save changes"}</button>
              <button type="button" style={smallButton} onClick={()=>setEdit(null)}>Cancel</button>
            </div>
          </form>:
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:13}}>
            <button style={primaryButton} disabled={saving} onClick={()=>beginEdit(r,true)}>Step done → plan next</button>
            <button style={smallButton} disabled={saving} onClick={()=>beginEdit(r)}>Edit / reschedule</button>
            <button style={smallButton} disabled={saving} onClick={()=>markDone(r)}>Entire commitment finished</button>
          </div>}
      </article>)}
    </div>
    {finished.length>0&&<details style={rowStyle}>
      <summary style={{cursor:"pointer",fontWeight:800}}>Finished commitments ({finished.length})</summary>
      <div style={{display:"grid",gap:10,marginTop:12}}>
      {finished.map(r=><div key={r.id} style={{borderTop:"1px solid #dde5e0",paddingTop:10}}>
        <strong>{r.area}: {r.title}</strong><div className="muted" style={{fontSize:13}}>Finished {r.completed_at?new Date(r.completed_at).toLocaleDateString("en-GB"):""}</div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <button style={smallButton} disabled={saving} onClick={()=>reopen(r)}>Reopen</button>
          <button style={smallButton} disabled={saving} onClick={()=>remove(r)}>Remove</button>
        </div>
      </div>)}
      </div>
    </details>}
    <p className="muted" style={{fontSize:12}}>Stored privately in your signed-in Blueprint account. A review date brings a parked promise back to attention; it does not automatically send a notification.</p>
  </section>;
}
