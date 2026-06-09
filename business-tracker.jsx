import { useState, useEffect, useRef } from "react";
const IRS_MILEAGE_RATE = 0.70;
const STORAGE_KEY = "biztracker_v3";
const OLD_KEYS = ["biztracker_data_v2", "biztracker_data"]; // migrate from older versions

const INCOME_CATS = [
  "Inspection – General", "Inspection – Radon Test", "Inspection – Mold Test", "Inspection – Pool/Spa", "Inspection – Other",
  "Airbnb – Rental Income", "Airbnb – Cleaning Fee", "Airbnb – Pet Fee", "Airbnb – Other",
  "Other Income",
];

const EXPENSE_GROUPS = [
  { label: "🏕️ Cabin / STR", prefix: "Cabin", color: "#f59e0b", schedule: "Schedule E" },
  { label: "📋 Airbnb Platform", prefix: "Airbnb", color: "#ff5a5f", schedule: "Schedule E" },
  { label: "🔍 Home Inspection", prefix: "Inspection", color: "#6ee7b7", schedule: "Schedule C" },
  { label: "🚗 Vehicle", prefix: "Vehicle", color: "#c4b5fd", schedule: "Schedule C" },
  { label: "💼 General Business", prefix: null, color: "#60a5fa", schedule: "Schedule C" },
];

const EXPENSE_CATS = [
  "Cabin – Purchase / Down Payment", "Cabin – Mortgage / Loan Payment", "Cabin – Property Tax",
  "Cabin – HOA Fee", "Cabin – Renovation / Remodel", "Cabin – Repair & Maintenance",
  "Cabin – Cleaning & Turnover", "Cabin – Landscaping / Lawn Care", "Cabin – Pest Control",
  "Cabin – Supplies & Toiletries", "Cabin – Furnishings & Appliances",
  "Cabin – Utilities (Electric/Gas/Water)", "Cabin – Internet / Cable",
  "Cabin – Security System", "Cabin – Snow Removal",
  "Airbnb – Host Fee / Commission", "Airbnb – Photography", "Airbnb – Listing / Marketing",
  "Inspection – Tools & Equipment", "Inspection – Training / Certification",
  "Inspection – InterNACHI Membership", "Inspection – Software / Report Tool", "Inspection – E&O Insurance",
  "Vehicle – Gas / Fuel", "Vehicle – Maintenance & Repair", "Vehicle – Insurance", "Vehicle – Registration / Tags",
  "Insurance – General Liability", "Insurance – Business Policy", "Marketing & Advertising",
  "Office Supplies", "Phone / Internet", "Professional Services (CPA/Legal)",
  "LLC – Formation / Filing Fee", "LLC – Annual Report / Renewal",
  "Meals & Entertainment (Business)", "Other Expense",
];

const TAX_SCHEDULE_E = new Set([
  "Cabin – Purchase / Down Payment","Cabin – Mortgage / Loan Payment","Cabin – Property Tax","Cabin – HOA Fee",
  "Cabin – Renovation / Remodel","Cabin – Repair & Maintenance","Cabin – Cleaning & Turnover",
  "Cabin – Landscaping / Lawn Care","Cabin – Pest Control","Cabin – Supplies & Toiletries",
  "Cabin – Furnishings & Appliances","Cabin – Utilities (Electric/Gas/Water)","Cabin – Internet / Cable",
  "Cabin – Security System","Cabin – Snow Removal",
  "Airbnb – Host Fee / Commission","Airbnb – Photography","Airbnb – Listing / Marketing",
]);

const DOC_CATS = ["Client Contract","Airbnb – Rental Agreement","Receipt / Invoice","Insurance Policy",
  "License/Certification","InterNACHI Agreement","Property Purchase Doc","HOA Document","Other"];

const getTaxSchedule = (cat) => TAX_SCHEDULE_E.has(cat) ? "E" : "C";
const getCatColor = (cat) => {
  const g = EXPENSE_GROUPS.find((g) => g.prefix && cat.startsWith(g.prefix));
  return g ? g.color : "#60a5fa";
};

/* ─── HELPERS ─── */
const fmt$ = (n) => `$${(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;
const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
const today = () => new Date().toISOString().split("T")[0];
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
const fileToB64 = (f) => new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
const fmtSize = (b) => !b?"":b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";
const fileIcon = (t) => !t?"📄":t.startsWith("image/")?"🖼️":t==="application/pdf"?"📋":t.includes("word")?"📝":"📄";

/* ─── GOOGLE SHEETS SYNC ─── */
const GAS_URL = "https://script.google.com/macros/s/AKfycbzd_fR7-NznNsZ6E_c8qDK7P7LOkBmVAvsMCw9ocMdxBR8WZydM7G7IbHSGhoExhI0/exec";

async function fetchAllFromSheets() {
  const res = await fetch(GAS_URL + "?action=getAll");
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function saveSheetData(sheetName, records) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify({ action: "save", sheet: sheetName, records }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}


const DEFAULT_CARDS = [
  { id: "c1", name: "Chase Sapphire", last4: "", color: "#2563eb" },
  { id: "c2", name: "Chase Freedom", last4: "", color: "#16a34a" },
  { id: "c3", name: "Cash", last4: "", color: "#6b7280" },
];

function loadData() {
  // Try current key first
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return { income:[], expenses:[], mileage:[], timelog:[], documents:[], mortgages:[], cards: DEFAULT_CARDS, ...JSON.parse(r) };
  } catch {}
  // Try migrating from older versions
  for (const oldKey of OLD_KEYS) {
    try {
      const r = localStorage.getItem(oldKey);
      if (r) {
        const parsed = JSON.parse(r);
        const migrated = { income:[], expenses:[], mileage:[], timelog:[], documents:[], mortgages:[], cards: DEFAULT_CARDS, ...parsed };
        // Save to new key so future loads work
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        console.log(`Migrated data from ${oldKey}`);
        return migrated;
      }
    } catch {}
  }
  return { income:[], expenses:[], mileage:[], timelog:[], documents:[], mortgages:[], cards: DEFAULT_CARDS };
}
function saveData(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) { console.warn(e); } }

/* ─── STYLES ─── */
const S = {
  input: { width:"100%", background:"#1e2130", border:"1px solid #2a2d3a", borderRadius:10, color:"#e8e8f0", padding:"11px 14px", fontSize:15, fontFamily:"inherit", boxSizing:"border-box" },
  btn: { background:"#6ee7b7", color:"#0f1117", border:"none", borderRadius:10, padding:"12px 20px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" },
  btnGhost: { background:"#1e2130", color:"#9ca3af", border:"1px solid #2a2d3a", borderRadius:10, padding:"10px 16px", fontWeight:500, fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  btnDanger: { background:"#2a1a1a", color:"#f87171", border:"1px solid #3a2020", borderRadius:10, padding:"10px 16px", fontWeight:500, fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  card: { background:"#16181f", border:"1px solid #2a2d3a", borderRadius:14, padding:18, marginBottom:14 },
  label: { fontSize:11, color:"#6b7280", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em", display:"block" },
  mono: { fontFamily:"'DM Mono',monospace" },
  section: { fontSize:12, color:"#4b5563", fontFamily:"'DM Mono',monospace", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.07em" },
};

function Field({ label, children, style }) {
  return <div style={{ marginBottom:14, ...style }}><label style={S.label}>{label}</label>{children}</div>;
}
function Badge({ color="#6ee7b7", children }) {
  return <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
}
function StatCard({ icon, label, value, sub, color="#6ee7b7" }) {
  return (
    <div style={{ ...S.card, marginBottom:0 }}>
      <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:22, fontWeight:800, color, ...S.mono }}>{value}</div>
      <div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"#4b5563", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

/* ─── BOTTOM NAV ─── */
const NAV = [
  { id:"Dashboard", icon:"📊", label:"Home" },
  { id:"Expenses",  icon:"💸", label:"Expenses" },
  { id:"Income",    icon:"💰", label:"Income" },
  { id:"More",      icon:"☰",  label:"More" },
];
const MORE_ITEMS = ["Mileage","Time Log","Mortgage","Documents","Reports","Cards"];

/* ─── APP ─── */
export default function App() {
  const [tab, setTab]           = useState("Dashboard");
  const [data, setData]         = useState(loadData);
  const [showMore, setShowMore] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | saved | error
  const [lastSync, setLastSync] = useState(null);
  const syncTimer = useRef(null);
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });

  // Load from Google Sheets on startup
  useEffect(() => {
    setSyncStatus("syncing");
    fetchAllFromSheets()
      .then(remote => {
        // Merge: remote wins, but keep local cards if remote has none
        setData(local => ({
          ...local,
          ...remote,
          cards: (remote.cards && remote.cards.length > 0) ? remote.cards : local.cards,
        }));
        setSyncStatus("saved");
        setLastSync(new Date());
      })
      .catch(() => setSyncStatus("error"));
  }, []);

  // Auto-save to Google Sheets 2s after any change
  useEffect(() => {
    saveData(data); // always save locally too
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      setSyncStatus("syncing");
      const keys = ["income","expenses","mileage","timelog","mortgages","cards"];
      // Save documents separately (can be large)
      const allKeys = [...keys, "documents"];
      Promise.all(allKeys.map(k => saveSheetData(k, data[k] || [])))
        .then(() => { setSyncStatus("saved"); setLastSync(new Date()); })
        .catch(() => setSyncStatus("error"));
    }, 2000);
    return () => clearTimeout(syncTimer.current);
  }, [data]);

  const update = (key, items) => setData(p => ({ ...p, [key]: items }));

  const manualSync = () => {
    setSyncStatus("syncing");
    fetchAllFromSheets()
      .then(remote => {
        setData(local => ({ ...local, ...remote, cards: (remote.cards?.length > 0) ? remote.cards : local.cards }));
        setSyncStatus("saved");
        setLastSync(new Date());
      })
      .catch(() => setSyncStatus("error"));
  };

  const fi = {
    income:   data.income.filter(r => r.date?.startsWith(filterMonth)),
    expenses: data.expenses.filter(r => r.date?.startsWith(filterMonth)),
    mileage:  data.mileage.filter(r => r.date?.startsWith(filterMonth)),
    timelog:  data.timelog.filter(r => r.date?.startsWith(filterMonth)),
  };
  const totalIn  = fi.income.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const totalEx  = fi.expenses.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const totalMi  = fi.mileage.reduce((s,r)=>s+(parseFloat(r.miles)||0),0);
  const miDeduct = totalMi * IRS_MILEAGE_RATE;
  const totalHr  = fi.timelog.reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
  const netProfit = totalIn - totalEx;

  const goTab = (t) => { setTab(t); setShowMore(false); };

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", minHeight:"100vh", background:"#0f1117", color:"#e8e8f0", maxWidth:480, margin:"0 auto", position:"relative", paddingBottom:80 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ background:"#16181f", borderBottom:"1px solid #2a2d3a", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, background:"linear-gradient(135deg,#6ee7b7,#3b82f6)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🏠</div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, letterSpacing:"-0.4px" }}>BizTracker</div>
            <div onClick={manualSync} style={{ fontSize:10, color: syncStatus==="error"?"#f87171":syncStatus==="syncing"?"#fbbf24":syncStatus==="saved"?"#6ee7b7":"#4b5563", ...S.mono, cursor:"pointer" }}>
              {syncStatus==="syncing"?"⏳ Syncing...":syncStatus==="saved"?"✅ Synced":syncStatus==="error"?"❌ Sync failed — tap to retry":"○ Local only"}
            </div>
          </div>
        </div>
        <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
          style={{ background:"#1e2130", border:"1px solid #2a2d3a", borderRadius:8, color:"#e8e8f0", padding:"6px 10px", fontSize:12, ...S.mono }} />
      </header>

      {/* More drawer */}
      {showMore && (
        <div onClick={()=>setShowMore(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200 }}>
          <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", bottom:80, left:"50%", transform:"translateX(-50%)", width:"calc(100% - 32px)", maxWidth:448, background:"#16181f", borderRadius:16, padding:8, border:"1px solid #2a2d3a" }}>
            {MORE_ITEMS.map(t => (
              <button key={t} onClick={()=>goTab(t)} style={{ display:"block", width:"100%", background:"none", border:"none", color:"#e8e8f0", fontFamily:"inherit", fontSize:15, fontWeight:500, padding:"14px 18px", cursor:"pointer", textAlign:"left", borderRadius:10 }}>
                {t==="Mileage"?"🚗":t==="Time Log"?"⏱":t==="Mortgage"?"🏦":t==="Documents"?"📁":t==="Reports"?"📥":t==="Cards"?"💳":""} {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <main style={{ padding:"16px 16px 0" }}>
        {tab==="Dashboard" && <DashboardTab fi={fi} totalIn={totalIn} totalEx={totalEx} netProfit={netProfit} totalMi={totalMi} miDeduct={miDeduct} totalHr={totalHr} filterMonth={filterMonth} docs={data.documents} />}
        {tab==="Income"    && <IncomeTab records={data.income} onUpdate={v=>update("income",v)} cards={data.cards} docs={data.documents} />}
        {tab==="Expenses"  && <ExpensesTab records={data.expenses} onUpdate={v=>update("expenses",v)} cards={data.cards} docs={data.documents} />}
        {tab==="Mileage"   && <MileageTab records={data.mileage} onUpdate={v=>update("mileage",v)} totalMi={totalMi} miDeduct={miDeduct} />}
        {tab==="Time Log"  && <TimeLogTab records={data.timelog} onUpdate={v=>update("timelog",v)} totalHr={totalHr} />}
        {tab==="Mortgage"  && <MortgageTab records={data.mortgages} onUpdate={v=>update("mortgages",v)} />}
        {tab==="Documents" && <DocumentsTab records={data.documents} onUpdate={v=>update("documents",v)} />}
        {tab==="Reports"   && <ReportsTab fi={fi} filterMonth={filterMonth} totalIn={totalIn} totalEx={totalEx} netProfit={netProfit} totalMi={totalMi} miDeduct={miDeduct} totalHr={totalHr} />}
        {tab==="Cards"     && <CardsTab cards={data.cards} onUpdate={v=>update("cards",v)} expenses={data.expenses} filterMonth={filterMonth} />}
      </main>

      {/* Bottom Nav */}
      <nav style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"#16181f", borderTop:"1px solid #2a2d3a", display:"flex", zIndex:100 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={()=>n.id==="More"?setShowMore(v=>!v):goTab(n.id)}
            style={{ flex:1, background:"none", border:"none", color: (tab===n.id||(n.id==="More"&&MORE_ITEMS.includes(tab)))?"#6ee7b7":"#6b7280", fontFamily:"inherit", fontSize:10, fontWeight:600, padding:"10px 0 8px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:22 }}>{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ─── DASHBOARD ─── */
function DashboardTab({ fi, totalIn, totalEx, netProfit, totalMi, miDeduct, totalHr, filterMonth, docs }) {
  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>
        {new Date(filterMonth+"-15").toLocaleString("en-US",{month:"long",year:"numeric"})}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
        <StatCard icon="💰" label="Income" value={fmt$(totalIn)} color="#6ee7b7" />
        <StatCard icon="💸" label="Expenses" value={fmt$(totalEx)} color="#f87171" />
        <StatCard icon="📊" label="Net Profit" value={fmt$(netProfit)} color={netProfit>=0?"#60a5fa":"#f87171"} />
        <StatCard icon="🚗" label="Mileage Ded." value={fmt$(miDeduct)} sub={`${totalMi.toFixed(0)} miles`} color="#fbbf24" />
        <StatCard icon="⏱" label="Hours" value={`${totalHr.toFixed(1)}h`} color="#34d399" />
        <StatCard icon="📁" label="Documents" value={docs.length} color="#c4b5fd" />
      </div>
      <div style={S.section}>Recent Expenses</div>
      {fi.expenses.slice(-4).reverse().map(r => (
        <div key={r.id} style={{ ...S.card, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600 }}>{r.description || r.category}</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{fmtDate(r.date)} · <Badge color={getCatColor(r.category)}>{getTaxSchedule(r.category)==="E"?"Sch E":"Sch C"}</Badge></div>
          </div>
          <div style={{ fontSize:15, fontWeight:700, color:"#f87171", ...S.mono }}>{fmt$(parseFloat(r.amount))}</div>
        </div>
      ))}
      {!fi.expenses.length && <div style={{ color:"#4b5563", fontSize:13, padding:"20px 0", textAlign:"center" }}>No expenses this month</div>}
    </div>
  );
}

/* ─── CARDS TAB ─── */
function CardsTab({ cards, onUpdate, expenses, filterMonth }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name:"", last4:"", color:"#3b82f6" });
  const COLORS = ["#3b82f6","#16a34a","#dc2626","#7c3aed","#ea580c","#0891b2","#6b7280"];

  const save = () => {
    if (!form.name) return;
    onUpdate([...cards, { ...form, id: uid() }]);
    setForm({ name:"", last4:"", color:"#3b82f6" });
    setAdding(false);
  };
  const del = (id) => onUpdate(cards.filter(c => c.id !== id));

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>💳 Cards</div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>지출에 어떤 카드를 썼는지 추적</div>

      {cards.map(c => {
        const cardExpenses = expenses.filter(e => e.cardId === c.id && e.date?.startsWith(filterMonth));
        const total = cardExpenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
        return (
          <div key={c.id} style={{ ...S.card, borderLeft:`4px solid ${c.color}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>💳 {c.name}</div>
                {c.last4 && <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>···· {c.last4}</div>}
                <div style={{ fontSize:13, color:"#f87171", ...S.mono, marginTop:6 }}>{fmt$(total)} <span style={{ fontSize:11, color:"#6b7280" }}>this month · {cardExpenses.length} txn</span></div>
              </div>
              <button onClick={()=>del(c.id)} style={{ ...S.btnDanger, padding:"6px 10px", fontSize:12 }}>🗑</button>
            </div>
          </div>
        );
      })}

      {adding ? (
        <div style={S.card}>
          <div style={S.section}>NEW CARD</div>
          <Field label="Card Name"><input placeholder="Chase Sapphire, Discover, etc." value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={S.input} /></Field>
          <Field label="Last 4 Digits (optional)"><input placeholder="1234" maxLength={4} value={form.last4} onChange={e=>setForm({...form,last4:e.target.value})} style={S.input} /></Field>
          <Field label="Color">
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {COLORS.map(c => (
                <div key={c} onClick={()=>setForm({...form,color:c})}
                  style={{ width:32, height:32, borderRadius:"50%", background:c, cursor:"pointer", border: form.color===c?"3px solid #fff":"3px solid transparent" }} />
              ))}
            </div>
          </Field>
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button onClick={save} style={S.btn}>+ Save Card</button>
            <button onClick={()=>setAdding(false)} style={S.btnGhost}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={()=>setAdding(true)} style={{ ...S.btnGhost, width:"100%", marginTop:4 }}>+ Add Card</button>
      )}
    </div>
  );
}

/* ─── INCOME TAB ─── */
function IncomeTab({ records, onUpdate, cards, docs }) {
  const blank = { date:today(), category:INCOME_CATS[0], description:"", amount:"", cardId:"", docId:"" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [showList, setShowList] = useState(false);

  const save = () => {
    if (!form.amount||!form.date) return;
    if (editing) { onUpdate(records.map(r=>r.id===editing?{...form,id:editing}:r)); setEditing(null); }
    else onUpdate([...records,{...form,id:uid()}]);
    setForm(blank);
  };
  const del = (id) => onUpdate(records.filter(r=>r.id!==id));
  const edit = (r) => { setForm(r); setEditing(r.id); setShowList(false); };
  const total = records.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>💰 Income</div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>Total all time: <span style={{ color:"#6ee7b7", ...S.mono }}>{fmt$(total)}</span></div>

      <div style={S.card}>
        <div style={S.section}>{editing?"EDIT ENTRY":"NEW INCOME"}</div>
        <Field label="Date"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.input} /></Field>
        <Field label="Category">
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={S.input}>
            {INCOME_CATS.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Amount ($)"><input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={S.input} /></Field>
        <Field label="Description"><input placeholder="Client name / job address" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={S.input} /></Field>
        <Field label="Card Used">
          <select value={form.cardId} onChange={e=>setForm({...form,cardId:e.target.value})} style={S.input}>
            <option value="">— Cash / Check —</option>
            {cards.map(c=><option key={c.id} value={c.id}>{c.name}{c.last4?" ···"+c.last4:""}</option>)}
          </select>
        </Field>
        <Field label="Attach Document">
          <select value={form.docId} onChange={e=>setForm({...form,docId:e.target.value})} style={S.input}>
            <option value="">— None —</option>
            {docs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={save} style={{ ...S.btn, flex:1 }}>{editing?"✏️ Update":"+ Add"}</button>
          {editing && <button onClick={()=>{setEditing(null);setForm(blank);}} style={S.btnGhost}>Cancel</button>}
        </div>
      </div>

      <button onClick={()=>setShowList(v=>!v)} style={{ ...S.btnGhost, width:"100%", marginBottom:12 }}>
        {showList?"▲ Hide":"▼ Show"} All Income ({records.length})
      </button>
      {showList && [...records].reverse().map(r => {
        const card = cards.find(c=>c.id===r.cardId);
        return (
          <div key={r.id} style={{ ...S.card, marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#6ee7b7", ...S.mono }}>{fmt$(parseFloat(r.amount))}</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>edit(r)} style={{ ...S.btnGhost, padding:"4px 10px", fontSize:12 }}>✏️</button>
                <button onClick={()=>del(r.id)} style={{ ...S.btnDanger, padding:"4px 10px", fontSize:12 }}>🗑</button>
              </div>
            </div>
            <div style={{ fontSize:13, marginBottom:4 }}>{r.description}</div>
            <div style={{ fontSize:11, color:"#6b7280", display:"flex", gap:8, flexWrap:"wrap" }}>
              <span>{fmtDate(r.date)}</span>
              <Badge color="#6ee7b7">{r.category}</Badge>
              {card && <Badge color={card.color}>💳 {card.name}</Badge>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── EXPENSES TAB ─── */
function ExpensesTab({ records, onUpdate, cards, docs }) {
  const blank = { date:today(), category:EXPENSE_CATS[0], description:"", amount:"", cardId:"", docId:"" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [showList, setShowList] = useState(false);
  const [filterSch, setFilterSch] = useState("All");

  const save = () => {
    if (!form.amount||!form.date) return;
    if (editing) { onUpdate(records.map(r=>r.id===editing?{...form,id:editing}:r)); setEditing(null); }
    else onUpdate([...records,{...form,id:uid()}]);
    setForm(blank);
  };
  const del = (id) => onUpdate(records.filter(r=>r.id!==id));
  const edit = (r) => { setForm(r); setEditing(r.id); setShowList(false); window.scrollTo(0,0); };

  const schC = records.reduce((s,r)=>getTaxSchedule(r.category)==="C"?s+(parseFloat(r.amount)||0):s,0);
  const schE = records.reduce((s,r)=>getTaxSchedule(r.category)==="E"?s+(parseFloat(r.amount)||0):s,0);

  const displayed = [...records].reverse().filter(r => filterSch==="All"||getTaxSchedule(r.category)===filterSch);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>💸 Expenses</div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <div style={{ flex:1, background:"#16181f", border:"1px solid #f59e0b44", borderRadius:10, padding:"10px 14px" }}>
          <div style={{ fontSize:10, color:"#f59e0b", ...S.mono }}>SCH E · RENTAL</div>
          <div style={{ fontSize:18, fontWeight:800, color:"#f59e0b", ...S.mono }}>{fmt$(schE)}</div>
        </div>
        <div style={{ flex:1, background:"#16181f", border:"1px solid #6ee7b744", borderRadius:10, padding:"10px 14px" }}>
          <div style={{ fontSize:10, color:"#6ee7b7", ...S.mono }}>SCH C · BUSINESS</div>
          <div style={{ fontSize:18, fontWeight:800, color:"#6ee7b7", ...S.mono }}>{fmt$(schC)}</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.section}>{editing?"EDIT EXPENSE":"NEW EXPENSE"}</div>
        <Field label="Date"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.input} /></Field>
        <Field label="Category">
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={S.input}>
            {EXPENSE_GROUPS.map(g=>{
              const cats = g.prefix ? EXPENSE_CATS.filter(c=>c.startsWith(g.prefix)) : EXPENSE_CATS.filter(c=>!EXPENSE_GROUPS.filter(x=>x.prefix).some(x=>c.startsWith(x.prefix)));
              return cats.length ? <optgroup key={g.label} label={g.label}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</optgroup> : null;
            })}
          </select>
        </Field>
        {form.category && (
          <div style={{ fontSize:12, marginBottom:12, padding:"8px 12px", background:"#1e2130", borderRadius:8 }}>
            <span style={{ color:"#6b7280" }}>Tax: </span>
            <span style={{ color: getTaxSchedule(form.category)==="E"?"#f59e0b":"#6ee7b7", fontWeight:700 }}>
              Schedule {getTaxSchedule(form.category)}
            </span>
            <span style={{ color:"#4b5563", marginLeft:6, fontSize:11 }}>
              {getTaxSchedule(form.category)==="E"?"→ Rental deduction":"→ Business deduction"}
            </span>
          </div>
        )}
        <Field label="Amount ($)"><input type="number" placeholder="0.00" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={S.input} /></Field>
        <Field label="Description"><input placeholder="What was this for?" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={S.input} /></Field>
        <Field label="Card Used">
          <select value={form.cardId} onChange={e=>setForm({...form,cardId:e.target.value})} style={S.input}>
            <option value="">— Cash / Check —</option>
            {cards.map(c=><option key={c.id} value={c.id}>{c.name}{c.last4?" ···"+c.last4:""}</option>)}
          </select>
        </Field>
        <Field label="Attach Receipt / Doc">
          <select value={form.docId} onChange={e=>setForm({...form,docId:e.target.value})} style={S.input}>
            <option value="">— None —</option>
            {docs.map(d=><option key={d.id} value={d.id}>{fileIcon(d.fileType)} {d.name}</option>)}
          </select>
        </Field>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={save} style={{ ...S.btn, flex:1 }}>{editing?"✏️ Update":"+ Add"}</button>
          {editing && <button onClick={()=>{setEditing(null);setForm(blank);}} style={S.btnGhost}>Cancel</button>}
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {["All","C","E"].map(f=>(
          <button key={f} onClick={()=>setFilterSch(f)}
            style={{ ...S.btnGhost, flex:1, background: filterSch===f?"#2a2d3a":"#16181f", color: filterSch===f?"#e8e8f0":"#6b7280", fontSize:12 }}>
            {f==="All"?"All":f==="C"?"Sch C":"Sch E"}
          </button>
        ))}
      </div>

      <button onClick={()=>setShowList(v=>!v)} style={{ ...S.btnGhost, width:"100%", marginBottom:12 }}>
        {showList?"▲ Hide":"▼ Show"} All Expenses ({records.length})
      </button>
      {showList && displayed.map(r=>{
        const card = cards.find(c=>c.id===r.cardId);
        const doc = docs.find(d=>d.id===r.docId);
        return (
          <div key={r.id} style={{ ...S.card, marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#f87171", ...S.mono }}>{fmt$(parseFloat(r.amount))}</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>edit(r)} style={{ ...S.btnGhost, padding:"4px 10px", fontSize:12 }}>✏️</button>
                <button onClick={()=>del(r.id)} style={{ ...S.btnDanger, padding:"4px 10px", fontSize:12 }}>🗑</button>
              </div>
            </div>
            <div style={{ fontSize:13, marginBottom:6 }}>{r.description || r.category}</div>
            <div style={{ fontSize:11, color:"#6b7280", display:"flex", gap:6, flexWrap:"wrap" }}>
              <span>{fmtDate(r.date)}</span>
              <Badge color={getCatColor(r.category)}>{r.category}</Badge>
              <Badge color={getTaxSchedule(r.category)==="E"?"#f59e0b":"#6ee7b7"}>Sch {getTaxSchedule(r.category)}</Badge>
              {card && <Badge color={card.color}>💳 {card.name}</Badge>}
              {doc && <span style={{ color:"#fbbf24" }}>🧾 {doc.name}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── MILEAGE TAB ─── */
function MileageTab({ records, onUpdate, totalMi, miDeduct }) {
  const blank = { date:today(), from:"", to:"", miles:"", purpose:"" };
  const [form, setForm] = useState(blank);
  const [showList, setShowList] = useState(false);
  const save = () => {
    if (!form.miles||!form.date) return;
    onUpdate([...records,{...form,id:uid()}]);
    setForm(blank);
  };
  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>🚗 Mileage</div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <div style={{ flex:1, ...S.card, marginBottom:0 }}>
          <div style={{ fontSize:10, color:"#c4b5fd", ...S.mono }}>TOTAL MILES</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#c4b5fd", ...S.mono }}>{totalMi.toFixed(1)}</div>
        </div>
        <div style={{ flex:1, ...S.card, marginBottom:0 }}>
          <div style={{ fontSize:10, color:"#fbbf24", ...S.mono }}>IRS DEDUCTION</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#fbbf24", ...S.mono }}>{fmt$(miDeduct)}</div>
          <div style={{ fontSize:10, color:"#4b5563" }}>${IRS_MILEAGE_RATE}/mile</div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.section}>LOG TRIP</div>
        <Field label="Date"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.input} /></Field>
        <Field label="From"><input placeholder="Starting point" value={form.from} onChange={e=>setForm({...form,from:e.target.value})} style={S.input} /></Field>
        <Field label="To"><input placeholder="Destination / inspection address" value={form.to} onChange={e=>setForm({...form,to:e.target.value})} style={S.input} /></Field>
        <Field label="Miles"><input type="number" placeholder="0.0" value={form.miles} onChange={e=>setForm({...form,miles:e.target.value})} style={S.input} /></Field>
        <Field label="Purpose"><input placeholder="Job description" value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})} style={S.input} /></Field>
        <button onClick={save} style={{ ...S.btn, width:"100%" }}>+ Log Trip</button>
      </div>
      <button onClick={()=>setShowList(v=>!v)} style={{ ...S.btnGhost, width:"100%", marginBottom:12 }}>
        {showList?"▲ Hide":"▼ Show"} Trips ({records.length})
      </button>
      {showList && [...records].reverse().map(r=>(
        <div key={r.id} style={{ ...S.card, marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>{r.purpose||"Trip"}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{r.from}{r.to?` → ${r.to}`:""}</div>
              <div style={{ fontSize:11, color:"#4b5563", marginTop:2 }}>{fmtDate(r.date)}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#c4b5fd", ...S.mono }}>{r.miles} mi</div>
              <div style={{ fontSize:12, color:"#fbbf24", ...S.mono }}>{fmt$((parseFloat(r.miles)||0)*IRS_MILEAGE_RATE)}</div>
              <button onClick={()=>onUpdate(records.filter(x=>x.id!==r.id))} style={{ ...S.btnDanger, padding:"4px 8px", fontSize:11, marginTop:4 }}>🗑</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── TIME LOG TAB ─── */
function TimeLogTab({ records, onUpdate, totalHr }) {
  const blank = { date:today(), client:"", task:"", hours:"" };
  const [form, setForm] = useState(blank);
  const [showList, setShowList] = useState(false);
  const save = () => {
    if (!form.hours||!form.date) return;
    onUpdate([...records,{...form,id:uid()}]);
    setForm(blank);
  };
  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>⏱ Time Log</div>
      <div style={{ ...S.card, marginBottom:16, display:"inline-block" }}>
        <div style={{ fontSize:10, color:"#34d399", ...S.mono }}>TOTAL HOURS</div>
        <div style={{ fontSize:24, fontWeight:800, color:"#34d399", ...S.mono }}>{totalHr.toFixed(1)}h</div>
      </div>
      <div style={S.card}>
        <div style={S.section}>LOG TIME</div>
        <Field label="Date"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.input} /></Field>
        <Field label="Client / Job"><input placeholder="Client name or address" value={form.client} onChange={e=>setForm({...form,client:e.target.value})} style={S.input} /></Field>
        <Field label="Task"><input placeholder="Inspection, report writing, travel..." value={form.task} onChange={e=>setForm({...form,task:e.target.value})} style={S.input} /></Field>
        <Field label="Hours"><input type="number" step="0.25" placeholder="1.5" value={form.hours} onChange={e=>setForm({...form,hours:e.target.value})} style={S.input} /></Field>
        <button onClick={save} style={{ ...S.btn, width:"100%" }}>+ Log Time</button>
      </div>
      <button onClick={()=>setShowList(v=>!v)} style={{ ...S.btnGhost, width:"100%", marginBottom:12 }}>
        {showList?"▲ Hide":"▼ Show"} Log ({records.length})
      </button>
      {showList && [...records].reverse().map(r=>(
        <div key={r.id} style={{ ...S.card, marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{r.client}</div>
            <div style={{ fontSize:12, color:"#6b7280" }}>{r.task} · {fmtDate(r.date)}</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#34d399", ...S.mono }}>{r.hours}h</div>
            <button onClick={()=>onUpdate(records.filter(x=>x.id!==r.id))} style={{ ...S.btnDanger, padding:"4px 8px", fontSize:11 }}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── MORTGAGE TAB ─── */
function MortgageTab({ records, onUpdate }) {
  const [loans, setLoans]       = useState(()=>records.filter(r=>r.type==="loan"));
  const [payments, setPayments] = useState(()=>records.filter(r=>r.type==="payment"));
  const [addingLoan, setAddingLoan] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loanForm, setLoanForm] = useState({ name:"", propertyAddress:"", principal:"", rate:"", termYears:"30", startDate:today() });
  const [payForm, setPayForm]   = useState({ date:today(), totalPayment:"", principal:"", interest:"", escrow:"" });

  useEffect(()=>{ onUpdate([...loans,...payments]); }, [loans,payments]);

  const monthlyPayment = (l) => {
    const r=parseFloat(l?.rate)/100/12, n=parseFloat(l?.termYears)*12, p=parseFloat(l?.principal);
    if(!r||!n||!p) return 0;
    return (p*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  };
  const calcSplit = (loan, date, total) => {
    if(!loan||!total) return {p:"",i:""};
    const r=parseFloat(loan.rate)/100/12, n=parseFloat(loan.termYears)*12, p=parseFloat(loan.principal);
    if(!r||!n||!p) return {p:"",i:""};
    const months = Math.max(0,Math.round((new Date(date)-new Date(loan.startDate))/(1000*60*60*24*30.44)));
    const mp=(p*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
    let bal=p;
    for(let i=0;i<months;i++) bal=bal-(mp-bal*r);
    bal=Math.max(0,bal);
    const interest=+(bal*r).toFixed(2);
    const principal=+(Math.max(0,parseFloat(total)-interest)).toFixed(2);
    return {p:principal.toFixed(2),i:interest.toFixed(2)};
  };
  const saveLoan = () => {
    if(!loanForm.name||!loanForm.principal||!loanForm.rate) return;
    const nl={...loanForm,id:uid(),type:"loan"};
    setLoans(prev=>[...prev,nl]); setLoanForm({name:"",propertyAddress:"",principal:"",rate:"",termYears:"30",startDate:today()});
    setAddingLoan(false); setSelected(nl.id);
  };
  const savePayment = () => {
    if(!payForm.totalPayment||!selected) return;
    setPayments(prev=>[...prev,{...payForm,id:uid(),loanId:selected,type:"payment"}]);
    setPayForm({date:today(),totalPayment:"",principal:"",interest:"",escrow:""});
  };
  const handlePayTotal = (val) => {
    const loan=loans.find(l=>l.id===selected);
    const {p,i}=calcSplit(loan,payForm.date,val);
    setPayForm(f=>({...f,totalPayment:val,principal:p,interest:i}));
  };

  const loan = loans.find(l=>l.id===selected);
  const lp   = payments.filter(p=>p.loanId===selected);
  const totalInt = lp.reduce((s,p)=>s+(parseFloat(p.interest)||0),0);
  const totalPri = lp.reduce((s,p)=>s+(parseFloat(p.principal)||0),0);
  const balance  = loan ? Math.max(0,parseFloat(loan.principal)-totalPri) : 0;
  const thisYearInt = lp.filter(p=>p.date?.startsWith(String(new Date().getFullYear()))).reduce((s,p)=>s+(parseFloat(p.interest)||0),0);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>🏦 Mortgage</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {loans.map(l=>(
          <button key={l.id} onClick={()=>setSelected(l.id)}
            style={{ ...S.btnGhost, flex:1, minWidth:130, background:selected===l.id?"#1a2a1f":"#16181f", border:`1px solid ${selected===l.id?"#6ee7b7":"#2a2d3a"}`, color:selected===l.id?"#6ee7b7":"#9ca3af", textAlign:"left" }}>
            <div style={{ fontWeight:700, fontSize:13 }}>{l.name}</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{fmt$(monthlyPayment(l))}/mo</div>
          </button>
        ))}
        <button onClick={()=>setAddingLoan(true)} style={{ ...S.btnGhost, flex:1, minWidth:100 }}>+ Add Loan</button>
      </div>

      {addingLoan && (
        <div style={S.card}>
          <div style={S.section}>NEW LOAN</div>
          <Field label="Loan Name"><input placeholder="Cabin Mortgage" value={loanForm.name} onChange={e=>setLoanForm({...loanForm,name:e.target.value})} style={S.input} /></Field>
          <Field label="Property Address"><input placeholder="Address" value={loanForm.propertyAddress} onChange={e=>setLoanForm({...loanForm,propertyAddress:e.target.value})} style={S.input} /></Field>
          <Field label="Loan Amount ($)"><input type="number" placeholder="250000" value={loanForm.principal} onChange={e=>setLoanForm({...loanForm,principal:e.target.value})} style={S.input} /></Field>
          <Field label="Interest Rate (%)"><input type="number" step="0.01" placeholder="6.75" value={loanForm.rate} onChange={e=>setLoanForm({...loanForm,rate:e.target.value})} style={S.input} /></Field>
          <Field label="Term">
            <select value={loanForm.termYears} onChange={e=>setLoanForm({...loanForm,termYears:e.target.value})} style={S.input}>
              {["10","15","20","25","30"].map(y=><option key={y} value={y}>{y} years</option>)}
            </select>
          </Field>
          <Field label="Start Date"><input type="date" value={loanForm.startDate} onChange={e=>setLoanForm({...loanForm,startDate:e.target.value})} style={S.input} /></Field>
          {loanForm.principal&&loanForm.rate&&<div style={{ fontSize:13, color:"#fbbf24", marginBottom:12, ...S.mono }}>Est. {fmt$(monthlyPayment(loanForm))}/mo</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={saveLoan} style={{ ...S.btn, flex:1 }}>+ Save</button>
            <button onClick={()=>setAddingLoan(false)} style={S.btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {loan && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            <StatCard icon="💰" label="Balance" value={fmt$(balance)} color="#f87171" sub="Remaining" />
            <StatCard icon="🧾" label="Interest This Year" value={fmt$(thisYearInt)} color="#fbbf24" sub="Sch E deductible ✅" />
            <StatCard icon="✅" label="Total Interest" value={fmt$(totalInt)} color="#f59e0b" sub="All time" />
            <StatCard icon="❌" label="Principal Paid" value={fmt$(totalPri)} color="#6b7280" sub="Not deductible" />
          </div>
          <div style={S.card}>
            <div style={S.section}>LOG PAYMENT — {loan.name}</div>
            <Field label="Date"><input type="date" value={payForm.date} onChange={e=>setPayForm(f=>({...f,date:e.target.value}))} style={S.input} /></Field>
            <Field label="Total Payment ($)"><input type="number" value={payForm.totalPayment} onChange={e=>handlePayTotal(e.target.value)} style={S.input} /></Field>
            <div style={{ display:"flex", gap:8 }}>
              <Field label="Principal ($)" style={{ flex:1 }}><input type="number" value={payForm.principal} onChange={e=>setPayForm(f=>({...f,principal:e.target.value}))} style={S.input} /></Field>
              <Field label="Interest ($)" style={{ flex:1 }}><input type="number" value={payForm.interest} onChange={e=>setPayForm(f=>({...f,interest:e.target.value}))} style={S.input} /></Field>
            </div>
            <Field label="Escrow ($)"><input type="number" placeholder="0" value={payForm.escrow} onChange={e=>setPayForm(f=>({...f,escrow:e.target.value}))} style={S.input} /></Field>
            {payForm.interest&&<div style={{ fontSize:12, padding:"8px 12px", background:"#1e2130", borderRadius:8, marginBottom:12 }}>
              <span style={{ color:"#fbbf24" }}>{fmt$(parseFloat(payForm.interest))} interest</span><span style={{ color:"#6ee7b7" }}> ✅ Sch E</span>
              <span style={{ color:"#6b7280", marginLeft:12 }}>{fmt$(parseFloat(payForm.principal))} principal</span><span style={{ color:"#4b5563" }}> ❌</span>
            </div>}
            <button onClick={savePayment} style={{ ...S.btn, width:"100%" }}>+ Log Payment</button>
          </div>
          <div style={S.section}>{lp.length} payments logged</div>
          {[...lp].reverse().map(p=>(
            <div key={p.id} style={{ ...S.card, marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, ...S.mono }}>{fmt$(parseFloat(p.totalPayment))}</div>
                  <div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>{fmtDate(p.date)}</div>
                  <div style={{ fontSize:11, marginTop:3, display:"flex", gap:8 }}>
                    <span style={{ color:"#fbbf24" }}>I: {fmt$(parseFloat(p.interest))}</span>
                    <span style={{ color:"#6b7280" }}>P: {fmt$(parseFloat(p.principal))}</span>
                    {p.escrow&&<span style={{ color:"#c4b5fd" }}>E: {fmt$(parseFloat(p.escrow))}</span>}
                  </div>
                </div>
                <button onClick={()=>setPayments(prev=>prev.filter(x=>x.id!==p.id))} style={{ ...S.btnDanger, padding:"6px 10px", fontSize:12 }}>🗑</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ─── DOCUMENTS TAB ─── */
function DocumentsTab({ records, onUpdate }) {
  const [form, setForm]     = useState({ date:today(), name:"", category:DOC_CATS[0], notes:"", fileData:null, fileName:"", fileType:"", fileSize:0 });
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 8*1024*1024) { alert("Max 8MB per file"); return; }
    setUploading(true);
    try {
      const b64 = await fileToB64(file);
      setForm(f=>({ ...f, fileData:b64, fileName:file.name, fileType:file.type, fileSize:file.size, name:f.name||file.name.replace(/\.[^.]+$/,"") }));
    } catch { alert("Failed to read file"); }
    setUploading(false);
  };

  const save = () => {
    if (!form.name||!form.fileData) { alert("Please add a name and upload a file"); return; }
    onUpdate([...records,{...form,id:uid()}]);
    setForm({ date:today(), name:"", category:DOC_CATS[0], notes:"", fileData:null, fileName:"", fileType:"", fileSize:0 });
    if(fileRef.current) fileRef.current.value="";
  };
  const del = (id) => { if(confirm("Delete this document?")) onUpdate(records.filter(r=>r.id!==id)); };
  const download = (doc) => { const a=document.createElement("a"); a.href=doc.fileData; a.download=doc.fileName||doc.name; a.click(); };

  const filtered = records.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.notes?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>📁 Documents</div>

      <div style={S.card}>
        <div style={S.section}>UPLOAD DOCUMENT</div>
        <Field label="Category">
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={S.input}>
            {DOC_CATS.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Name"><input placeholder="Document name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={S.input} /></Field>
        <Field label="Date"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={S.input} /></Field>
        <Field label="Notes"><input placeholder="Client, address, notes..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={S.input} /></Field>

        {/* File Upload — fixed for mobile */}
        <div style={S.label}>File (PDF, Image, Word)</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          capture="environment"
          onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); }}
          style={{ display:"none" }}
        />
        <div
          onClick={()=>fileRef.current?.click()}
          style={{ border:"2px dashed #2a2d3a", borderRadius:12, padding:24, textAlign:"center", cursor:"pointer", background: form.fileData?"#1a2a1f":"#13151c", marginBottom:14 }}>
          {uploading ? (
            <div style={{ color:"#6b7280" }}>⏳ Reading...</div>
          ) : form.fileData ? (
            <div>
              <div style={{ fontSize:36, marginBottom:6 }}>{fileIcon(form.fileType)}</div>
              <div style={{ color:"#6ee7b7", fontWeight:600, fontSize:14 }}>{form.fileName}</div>
              <div style={{ color:"#6b7280", fontSize:12, marginTop:3 }}>{fmtSize(form.fileSize)} · Tap to replace</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:36, marginBottom:6 }}>📎</div>
              <div style={{ color:"#9ca3af", fontSize:14, fontWeight:600 }}>Tap to upload</div>
              <div style={{ color:"#4b5563", fontSize:12, marginTop:3 }}>PDF · Image · Word · Max 8MB</div>
              <div style={{ color:"#4b5563", fontSize:11, marginTop:3 }}>📸 Can use phone camera</div>
            </div>
          )}
        </div>
        <button onClick={save} style={{ ...S.btn, width:"100%", opacity: form.fileData?1:0.5 }}>+ Save Document</button>
      </div>

      <input placeholder="🔍 Search documents..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...S.input, marginBottom:12 }} />
      <div style={{ fontSize:12, color:"#4b5563", marginBottom:12 }}>{filtered.length} documents</div>

      {filtered.map(doc=>(
        <div key={doc.id} style={{ ...S.card, marginBottom:10 }}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <div onClick={()=>setPreview(doc)} style={{ width:56, height:56, background:"#1e2130", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, cursor:"pointer", flexShrink:0, overflow:"hidden" }}>
              {doc.fileType?.startsWith("image/") ? <img src={doc.fileData} style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:10 }} /> : fileIcon(doc.fileType)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{doc.name}</div>
              {doc.notes && <div style={{ fontSize:12, color:"#6b7280", marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{doc.notes}</div>}
              <div style={{ fontSize:11, color:"#4b5563", marginTop:3, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                <Badge color="#60a5fa">{doc.category}</Badge>
                <span>{fmtDate(doc.date)}</span>
                <span>{fmtSize(doc.fileSize)}</span>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button onClick={()=>setPreview(doc)} style={{ ...S.btnGhost, flex:1, fontSize:12 }}>👁 View</button>
            <button onClick={()=>download(doc)} style={{ ...S.btnGhost, flex:1, fontSize:12, color:"#60a5fa" }}>⬇️ Save</button>
            <button onClick={()=>del(doc.id)} style={{ ...S.btnDanger, padding:"10px 14px", fontSize:12 }}>🗑</button>
          </div>
        </div>
      ))}

      {/* Preview Modal */}
      {preview && (
        <div onClick={()=>setPreview(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:1000, display:"flex", flexDirection:"column" }}>
          <div style={{ background:"#16181f", padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #2a2d3a" }}>
            <div style={{ fontWeight:700, fontSize:14, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{preview.name}</div>
            <div style={{ display:"flex", gap:8, flexShrink:0 }}>
              <button onClick={(e)=>{e.stopPropagation();download(preview);}} style={{ ...S.btnGhost, fontSize:12, padding:"6px 12px" }}>⬇️</button>
              <button onClick={()=>setPreview(null)} style={{ ...S.btnDanger, fontSize:12, padding:"6px 12px" }}>✕</button>
            </div>
          </div>
          <div onClick={e=>e.stopPropagation()} style={{ flex:1, overflow:"auto", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            {preview.fileType?.startsWith("image/") ? (
              <img src={preview.fileData} style={{ maxWidth:"100%", maxHeight:"80vh", borderRadius:8, objectFit:"contain" }} />
            ) : preview.fileType==="application/pdf" ? (
              <iframe src={preview.fileData} style={{ width:"100%", height:"75vh", border:"none", borderRadius:8 }} />
            ) : (
              <div style={{ textAlign:"center", color:"#6b7280" }}>
                <div style={{ fontSize:64, marginBottom:16 }}>{fileIcon(preview.fileType)}</div>
                <button onClick={()=>download(preview)} style={S.btn}>⬇️ Download to View</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── REPORTS TAB ─── */
function ReportsTab({ fi, filterMonth, totalIn, totalEx, netProfit, totalMi, miDeduct, totalHr }) {
  const schC = fi.expenses.filter(r=>getTaxSchedule(r.category)==="C").reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const schE = fi.expenses.filter(r=>getTaxSchedule(r.category)==="E").reduce((s,r)=>s+(parseFloat(r.amount)||0),0);

  const exportTax = () => {
    const e = fi.expenses;
    const lines = [
      `TAX REPORT — ${filterMonth}`,"",
      "=== SCHEDULE E (Rental / Airbnb) ===",
      "Date,Category,Description,Amount",
      ...e.filter(r=>getTaxSchedule(r.category)==="E").map(r=>[r.date,r.category,r.description,r.amount].join(",")),
      `Sch E Total,$${schE.toFixed(2)}`,"",
      "=== SCHEDULE C (Business / Inspection) ===",
      "Date,Category,Description,Amount",
      ...e.filter(r=>getTaxSchedule(r.category)==="C").map(r=>[r.date,r.category,r.description,r.amount].join(",")),
      `Sch C Total,$${schC.toFixed(2)}`,"",
      "=== MILEAGE (Schedule C) ===",
      "Date,From,To,Miles,Deduction,Purpose",
      ...fi.mileage.map(r=>[r.date,r.from,r.to,r.miles,((parseFloat(r.miles)||0)*IRS_MILEAGE_RATE).toFixed(2),r.purpose].join(",")),
      `Total Miles,${totalMi.toFixed(1)}`,`Mileage Deduction,$${miDeduct.toFixed(2)}`,"",
      "=== INCOME ===","Date,Category,Description,Amount",
      ...fi.income.map(r=>[r.date,r.category,r.description,r.amount].join(",")),
      `Total Income,$${totalIn.toFixed(2)}`,
    ];
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/csv"})); a.download=`TAX_${filterMonth}.csv`; a.click();
  };

  const exportFull = () => {
    const lines = [
      "Date,Type,Category,Tax Schedule,Description,Amount",
      ...fi.income.map(r=>[r.date,"Income",r.category,"",r.description,r.amount].join(",")),
      ...fi.expenses.map(r=>[r.date,"Expense",r.category,`Sch ${getTaxSchedule(r.category)}`,r.description,r.amount].join(",")),
      ...fi.mileage.map(r=>[r.date,"Mileage","Vehicle","Sch C",`${r.from}→${r.to}`,r.miles+" mi"].join(",")),
    ];
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/csv"})); a.download=`full_${filterMonth}.csv`; a.click();
  };

  const groups = EXPENSE_GROUPS.map(g=>{
    const cats = g.prefix ? fi.expenses.filter(r=>r.category.startsWith(g.prefix)) : fi.expenses.filter(r=>!EXPENSE_GROUPS.filter(x=>x.prefix).some(x=>r.category.startsWith(x.prefix)));
    return { ...g, total: cats.reduce((s,r)=>s+(parseFloat(r.amount)||0),0) };
  }).filter(g=>g.total>0);

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16 }}>📥 Reports</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <StatCard icon="💰" label="Income" value={fmt$(totalIn)} color="#6ee7b7" />
        <StatCard icon="💸" label="Expenses" value={fmt$(totalEx)} color="#f87171" />
        <StatCard icon="📊" label="Net Profit" value={fmt$(netProfit)} color={netProfit>=0?"#60a5fa":"#f87171"} />
        <StatCard icon="🚗" label="Mileage Ded." value={fmt$(miDeduct)} color="#fbbf24" sub={`${totalMi.toFixed(0)} mi`} />
      </div>

      <div style={S.card}>
        <div style={S.section}>TAX SCHEDULE SPLIT</div>
        <div style={{ display:"flex", gap:10, marginBottom:16 }}>
          <div style={{ flex:1, background:"#1a1f10", border:"1px solid #f59e0b33", borderRadius:10, padding:14 }}>
            <div style={{ fontSize:10, color:"#f59e0b", ...S.mono }}>SCHEDULE E</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#f59e0b", ...S.mono }}>{fmt$(schE)}</div>
            <div style={{ fontSize:11, color:"#6b7280" }}>Cabin / Airbnb</div>
          </div>
          <div style={{ flex:1, background:"#0f1a14", border:"1px solid #6ee7b733", borderRadius:10, padding:14 }}>
            <div style={{ fontSize:10, color:"#6ee7b7", ...S.mono }}>SCHEDULE C</div>
            <div style={{ fontSize:20, fontWeight:800, color:"#6ee7b7", ...S.mono }}>{fmt$(schC)}</div>
            <div style={{ fontSize:11, color:"#6b7280" }}>Inspection / Biz</div>
          </div>
        </div>
        {groups.map(g=>(
          <div key={g.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13 }}>{g.label}</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:80, height:5, background:"#1e2130", borderRadius:3, overflow:"hidden" }}>
                <div style={{ width:`${Math.min(100,(g.total/totalEx)*100)}%`, height:"100%", background:g.color, borderRadius:3 }} />
              </div>
              <div style={{ fontSize:13, color:g.color, ...S.mono, minWidth:70, textAlign:"right" }}>{fmt$(g.total)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.section}>EXPORT FOR TAX FILING</div>
        <button onClick={exportTax} style={{ ...S.btn, width:"100%", marginBottom:10, background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff" }}>
          🧾 Tax-Ready CSV (Sch C + E split)
        </button>
        <button onClick={exportFull} style={{ ...S.btn, width:"100%", background:"linear-gradient(135deg,#6ee7b7,#3b82f6)", color:"#0f1117" }}>
          📥 Full Report CSV
        </button>
        <div style={{ fontSize:12, color:"#4b5563", marginTop:12 }}>
          💡 Tax-Ready CSV는 Schedule C / E 로 분리되어 회계사에게 바로 전달 가능
        </div>
      </div>
    </div>
  );
}
