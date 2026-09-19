import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  ArrowRight, BarChart3, Check, ChevronRight, Coffee, Eye, Heart, Image as ImageIcon,
  Instagram, LayoutDashboard, LogOut, MapPin, Menu as MenuIcon, MessageSquareText,
  Pencil, Phone, Plus, QrCode, Search, Settings, Star, Store, Trash2,
  UtensilsCrossed, Wifi, X
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { categories as fallbackCategories, menuItems as fallbackMenuItems, restaurant as fallbackRestaurant, type MenuItem } from "./data/demo";
import { loadDemoRestaurant, submitFeedback, trackEvent } from "./lib/data";
import {
  claimOwnerSetup, createRestaurantInvite, createRestaurantWithInvite, deleteCategory,
  deleteMenuItem, getAnalytics, getMyRestaurant, getSession, isPlatformAdmin, listCategories,
  listFeedback, listMenuItems, listPlatformRestaurants, onAuthChange, redeemRestaurantInvite,
  resolveFeedback, saveCategory, saveMenuItem, signIn, signOut, signUp, toggleMenuItem,
  updateRestaurant, uploadMenuImage, type AdminCategory, type AdminMenuItem, type AdminRestaurant
} from "./lib/admin";

const DEMO_URL = "https://yohannesmulugeta.github.io/Menu-Go/#/demo";

function Brand() {
  return <Link to="/demo" className="brand"><span className="brand-mark"><UtensilsCrossed size={18}/></span><span>Menu Go</span></Link>;
}

function CustomerPage() {
  const [category,setCategory]=useState("Popular");
  const [query,setQuery]=useState("");
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  const [wifiOpen,setWifiOpen]=useState(false);
  const [feedbackText,setFeedbackText]=useState("");
  const [restaurant,setRestaurant]=useState({
    ...fallbackRestaurant,id:"11111111-1111-4111-8111-111111111111",
    google_maps_url:"https://maps.google.com/?q=Addis+Ababa",google_review_url:null as string|null
  });
  const [categories,setCategories]=useState(fallbackCategories);
  const [menuItems,setMenuItems]=useState<MenuItem[]>(fallbackMenuItems);

  useEffect(()=>{
    let active=true;
    loadDemoRestaurant().then(data=>{
      if(!active||!data)return;
      setRestaurant({
        name:data.restaurant.name,tagline:data.restaurant.tagline??fallbackRestaurant.tagline,
        location:data.restaurant.address??fallbackRestaurant.location,hours:fallbackRestaurant.hours,
        currency:data.restaurant.currency,id:data.restaurant.id,
        google_maps_url:data.restaurant.google_maps_url??"https://maps.google.com/?q=Addis+Ababa",
        google_review_url:data.restaurant.google_review_url
      });
      setCategories(data.categories); setMenuItems(data.items);
    }).catch(console.error);
    trackEvent("page_view");
    return()=>{active=false};
  },[]);

  const items=useMemo(()=>menuItems.filter(item=>{
    const matches=category==="Popular"?item.popular:item.category===category;
    return matches&&(item.name+" "+item.description).toLowerCase().includes(query.toLowerCase());
  }),[category,query,menuItems]);

  return <div className="customer-page">
    <header className="hero"><div className="hero-gradient"/><div className="hero-top"><span className="powered">Powered by <strong>Menu Go</strong></span></div>
      <div className="hero-copy"><div className="restaurant-logo"><Coffee size={28}/></div><p className="eyebrow">DEMO RESTAURANT</p>
        <h1>{restaurant.name}</h1><p>{restaurant.tagline}</p><span className="open-pill"><span/> {restaurant.hours}</span></div>
    </header>
    <main className="customer-main">
      <section className="quick-actions">
        <a className="action-card accent" href="#menu" onClick={()=>trackEvent("menu_view")}><span className="action-icon"><MenuIcon size={22}/></span><span><strong>View Menu</strong><small>Browse food & drinks</small></span><ChevronRight size={20}/></a>
        <button className="action-card" onClick={()=>{trackEvent("review_click"); restaurant.google_review_url?window.open(restaurant.google_review_url,"_blank","noopener,noreferrer"):alert("Demo restaurant: add the real Google Review link in Settings.");}}><span className="action-icon"><Star size={22}/></span><span><strong>Leave a Review</strong><small>Share your experience</small></span><ChevronRight size={20}/></button>
        <a className="action-card" href={restaurant.google_maps_url} onClick={()=>trackEvent("directions_click")} target="_blank" rel="noreferrer"><span className="action-icon"><MapPin size={22}/></span><span><strong>Directions</strong><small>{restaurant.location}</small></span><ChevronRight size={20}/></a>
        <button className="action-card" onClick={()=>{trackEvent("wifi_click");setWifiOpen(true)}}><span className="action-icon"><Wifi size={22}/></span><span><strong>Wi-Fi</strong><small>Get connection details</small></span><ChevronRight size={20}/></button>
        <button className="action-card" onClick={()=>{trackEvent("feedback_open");setFeedbackOpen(true)}}><span className="action-icon"><MessageSquareText size={22}/></span><span><strong>Private Feedback</strong><small>Tell the restaurant directly</small></span><ChevronRight size={20}/></button>
      </section>
      <section id="menu" className="menu-section">
        <div className="section-heading"><div><p className="eyebrow dark">MENU</p><h2>What are you having?</h2></div><span>{items.length} items</span></div>
        <div className="search-box"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search dishes, drinks..."/></div>
        <div className="category-scroll">{categories.map(item=><button key={item} className={item===category?"category active":"category"} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <div className="menu-grid">{items.map(item=><article className="menu-item" key={item.id}><img src={item.image} alt="" loading="lazy"/><div className="menu-item-body"><div className="menu-item-title"><h3>{item.name}</h3>{item.popular&&<span><Heart size={13}/> Popular</span>}</div><p>{item.description}</p><strong>{item.price} {restaurant.currency}</strong></div></article>)}</div>
        {items.length===0&&<div className="empty-state">No items match your search.</div>}
      </section>
      <footer className="guest-footer"><Brand/><p>A simple digital guest experience for restaurants.</p><div><Instagram size={18}/><Phone size={18}/></div></footer>
    </main>
    {wifiOpen&&<div className="modal-backdrop" onClick={()=>setWifiOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><span className="modal-icon"><Wifi/></span><h3>Restaurant Wi-Fi</h3><p>Sora Guest — ask staff for today's password.</p><button onClick={()=>setWifiOpen(false)}>Done</button></div></div>}
    {feedbackOpen&&<div className="modal-backdrop" onClick={()=>setFeedbackOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><span className="modal-icon"><MessageSquareText/></span><h3>Private feedback</h3><p>Your message goes directly to the restaurant.</p><textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} placeholder="Tell us about your experience..." rows={5}/><button onClick={async()=>{try{await submitFeedback(feedbackText);setFeedbackText("");setFeedbackOpen(false);alert("Thank you. Your feedback was sent privately.");}catch(err){alert(err instanceof Error?err.message:"Could not send feedback.")}}}>Send feedback</button></div></div>}
  </div>;
}

function AuthPage(){
  const nav=useNavigate();
  const [mode,setMode]=useState<"signin"|"signup">("signin");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [setupCode,setSetupCode]=useState(""); const [inviteCode,setInviteCode]=useState("");
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");

  async function submit(){
    setBusy(true);setMessage("");
    try{
      if(mode==="signin") await signIn(email,password);
      else {
        const result=await signUp(email,password);
        if(!result.session){setMessage("Account created. Check your email to confirm it, then sign in.");setMode("signin");return;}
      }
      const platform=await isPlatformAdmin();
      nav(platform?"/platform":"/admin");
    }catch(err){setMessage(err instanceof Error?err.message:"Authentication failed.");}
    finally{setBusy(false)}
  }

  async function claim(type:"owner"|"invite"){
    if(!setupCode && type==="owner") return setMessage("Enter the owner setup code.");
    if(!inviteCode && type==="invite") return setMessage("Enter the restaurant invite code.");
    setBusy(true);setMessage("");
    try{
      const session=await getSession();
      if(!session) throw new Error("Sign in first, then redeem the code.");
      if(type==="owner"){await claimOwnerSetup(setupCode);setMessage("Menu Go owner access activated.");nav("/platform");}
      else {await redeemRestaurantInvite(inviteCode);setMessage("Restaurant access activated.");nav("/admin");}
    }catch(err){setMessage(err instanceof Error?err.message:"Could not redeem code.");}
    finally{setBusy(false)}
  }

  return <div className="auth-page"><div className="auth-card"><Brand/><p className="eyebrow dark">SECURE ACCESS</p><h1>{mode==="signin"?"Sign in to Menu Go":"Create your account"}</h1><p className="auth-copy">Restaurant owners and Menu Go administrators manage menus from here.</p>
    <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label>
    <button className="primary-button auth-submit" disabled={busy} onClick={submit}>{busy?"Please wait…":mode==="signin"?"Sign in":"Create account"}</button>
    <button className="auth-switch" onClick={()=>setMode(mode==="signin"?"signup":"signin")}>{mode==="signin"?"Need an account? Create one":"Already have an account? Sign in"}</button>
    <div className="auth-divider">ACCESS CODE</div>
    <label>Menu Go owner setup code<input value={setupCode} onChange={e=>setSetupCode(e.target.value.toUpperCase())} placeholder="MGO-..."/></label>
    <button className="secondary-button auth-submit" disabled={busy} onClick={()=>claim("owner")}>Activate platform owner</button>
    <label>Restaurant invite code<input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} placeholder="MG-..."/></label>
    <button className="ghost-button auth-submit" disabled={busy} onClick={()=>claim("invite")}>Join a restaurant</button>
    {message&&<div className="auth-message">{message}</div>}
  </div></div>
}

function Protected({platform=false}:{platform?:boolean}){
  const [state,setState]=useState<"loading"|"ok"|"no">("loading");
  useEffect(()=>{
    const check=async()=>{const s=await getSession(); if(!s)return setState("no"); if(platform){const ok=await isPlatformAdmin();setState(ok?"ok":"no")}else setState("ok")};
    check(); return onAuthChange(check);
  },[platform]);
  if(state==="loading") return <div className="screen-loader">Loading Menu Go…</div>;
  if(state==="no") return <Navigate to="/login" replace/>;
  return platform?<PlatformDashboard/>:<RestaurantDashboard/>;
}

type AdminTab="Overview"|"Menu"|"Categories"|"Feedback"|"Analytics"|"QR Codes"|"Settings";

function RestaurantDashboard(){
  const nav=useNavigate();
  const [tab,setTab]=useState<AdminTab>("Overview");
  const [restaurant,setRestaurant]=useState<AdminRestaurant|null>(null);
  const [role,setRole]=useState("");
  const [items,setItems]=useState<AdminMenuItem[]>([]);
  const [categories,setCategories]=useState<AdminCategory[]>([]);
  const [feedback,setFeedback]=useState<any[]>([]);
  const [analytics,setAnalytics]=useState<Record<string,number>>({});
  const [loading,setLoading]=useState(true);
  const [editor,setEditor]=useState<AdminMenuItem|null|undefined>(undefined);

  async function refresh(){
    setLoading(true);
    try{
      const mine=await getMyRestaurant();
      if(!mine){setRestaurant(null);return}
      setRestaurant(mine.restaurant);setRole(mine.role);
      const [c,m,f,a]=await Promise.all([listCategories(mine.restaurant.id),listMenuItems(mine.restaurant.id),listFeedback(mine.restaurant.id),getAnalytics(mine.restaurant.id)]);
      setCategories(c);setItems(m);setFeedback(f);setAnalytics(a);
    }finally{setLoading(false)}
  }
  useEffect(()=>{refresh()},[]);

  if(loading) return <div className="screen-loader">Loading restaurant dashboard…</div>;
  if(!restaurant) return <div className="auth-page"><div className="auth-card"><Brand/><h1>No restaurant assigned yet</h1><p className="auth-copy">Ask the Menu Go platform owner for a restaurant invite code, then redeem it on the login page.</p><Link className="primary-button auth-submit" to="/login">Enter invite code</Link></div></div>;

  const navItems:[AdminTab,any][]=[["Overview",LayoutDashboard],["Menu",MenuIcon],["Categories",UtensilsCrossed],["Feedback",MessageSquareText],["Analytics",BarChart3],["QR Codes",QrCode],["Settings",Settings]];
  return <div className="dashboard"><aside className="sidebar"><Brand/><nav>{navItems.map(([label,Icon])=><button key={label} className={tab===label?"active":""} onClick={()=>setTab(label)}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="sidebar-footer"><div className="avatar">{restaurant.name.slice(0,2).toUpperCase()}</div><span><strong>{restaurant.name}</strong><small>{role}</small></span></div></aside>
    <section className="dashboard-content"><header className="dash-header"><div><p className="eyebrow dark">RESTAURANT ADMIN</p><h1>{tab}</h1></div><div className="dash-header-actions"><Link to="/demo" className="ghost-button"><Eye size={17}/> View live menu</Link><button className="ghost-button" onClick={async()=>{await signOut();nav("/login")}}><LogOut size={17}/> Sign out</button></div></header>
      {tab==="Overview"&&<RestaurantOverview analytics={analytics} items={items}/>}
      {tab==="Menu"&&<MenuManager restaurantId={restaurant.id} items={items} categories={categories} onRefresh={refresh} onEdit={setEditor}/>}
      {tab==="Categories"&&<CategoryManager restaurantId={restaurant.id} categories={categories} onRefresh={refresh}/>}
      {tab==="Feedback"&&<FeedbackPanel rows={feedback} onResolve={async id=>{await resolveFeedback(id);refresh()}}/>}
      {tab==="Analytics"&&<AnalyticsPanel data={analytics}/>}
      {tab==="QR Codes"&&<QrManager/>}
      {tab==="Settings"&&<RestaurantSettings restaurant={restaurant} onRefresh={refresh}/>}
    </section>
    {editor!==undefined&&<MenuItemEditor restaurantId={restaurant.id} categories={categories} item={editor} onClose={()=>setEditor(undefined)} onSaved={async()=>{setEditor(undefined);await refresh()}}/>}
  </div>;
}

function RestaurantOverview({analytics,items}:{analytics:Record<string,number>,items:AdminMenuItem[]}){
  const stats=[["Menu views",analytics.menu_view??0,Eye],["QR scans",analytics.qr_scan??0,QrCode],["Review clicks",analytics.review_click??0,Star],["Feedback",analytics.feedback_submit??0,MessageSquareText]] as const;
  return <><div className="stats-grid">{stats.map(([label,value,Icon])=><div className="stat-card" key={label}><div className="stat-top"><span>{label}</span><Icon size={20}/></div><strong>{value}</strong><small>Live Supabase data</small></div>)}</div>
    <div className="dash-grid"><div className="panel"><div className="panel-heading"><div><h2>Popular menu items</h2><p>Items marked as popular</p></div></div>{items.filter(i=>i.is_popular).slice(0,5).map((item,index)=><div className="rank-row" key={item.id}><span className="rank">{index+1}</span><img src={item.image_url||fallbackMenuItems[0].image} alt=""/><div><strong>{item.name}</strong><small>{item.category?.name||"Uncategorized"}</small></div><span>{item.is_available?"Available":"Hidden"}</span></div>)}</div>
    <div className="panel qr-mini"><div className="panel-heading"><div><h2>Your table QR</h2><p>One code, always current</p></div></div><div className="qr-wrap"><QRCodeSVG value={DEMO_URL} size={158}/></div><p>Menu changes appear instantly without replacing printed QR codes.</p></div></div></>;
}

function MenuManager({restaurantId,items,categories,onRefresh,onEdit}:{restaurantId:string,items:AdminMenuItem[],categories:AdminCategory[],onRefresh:()=>Promise<void>,onEdit:(i:AdminMenuItem|null)=>void}){
  return <div className="panel"><div className="panel-heading"><div><h2>Menu items</h2><p>Edit prices, photos and availability.</p></div><button className="primary-button" onClick={()=>onEdit(null)}><Plus size={16}/> Add item</button></div>
    <div className="table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><div className="table-item"><img src={item.image_url||fallbackMenuItems[0].image} alt=""/><span><strong>{item.name}</strong><small>{item.description?.slice(0,42)||"No description"}</small></span></div></td><td>{item.category?.name||"—"}</td><td>{item.price} ETB</td><td><button className={item.is_available?"status":"status status-off"} onClick={async()=>{await toggleMenuItem(item.id,!item.is_available);onRefresh()}}>{item.is_available?<><Check size={13}/> Available</>:<>Unavailable</>}</button></td><td><div className="row-actions"><button className="tiny-button" onClick={()=>onEdit(item)}><Pencil size={14}/></button><button className="tiny-button danger" onClick={async()=>{if(confirm("Delete this menu item?")){await deleteMenuItem(item.id);onRefresh()}}}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>
  </div>;
}

function MenuItemEditor({restaurantId,categories,item,onClose,onSaved}:{restaurantId:string,categories:AdminCategory[],item:AdminMenuItem|null,onClose:()=>void,onSaved:()=>void}){
  const [name,setName]=useState(item?.name||""); const [description,setDescription]=useState(item?.description||"");
  const [price,setPrice]=useState(item?.price?.toString()||""); const [categoryId,setCategoryId]=useState(item?.category_id||categories[0]?.id||"");
  const [imageUrl,setImageUrl]=useState(item?.image_url||""); const [available,setAvailable]=useState(item?.is_available??true); const [popular,setPopular]=useState(item?.is_popular??false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  return <div className="modal-backdrop" onClick={onClose}><div className="modal admin-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow dark">{item?"EDIT ITEM":"NEW ITEM"}</p><h3>{item?.name||"Add menu item"}</h3></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <div className="form-grid"><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Price (ETB)<input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)}/></label><label className="span-2">Description<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Category<select value={categoryId} onChange={e=>setCategoryId(e.target.value)}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Image URL<input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="Or upload below"/></label><label className="span-2 upload-box"><ImageIcon size={18}/> Upload food photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;setBusy(true);try{setImageUrl(await uploadMenuImage(restaurantId,f))}catch(err){setError(err instanceof Error?err.message:"Upload failed")}finally{setBusy(false)}}}/></label><label className="check-label"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)}/> Available</label><label className="check-label"><input type="checkbox" checked={popular} onChange={e=>setPopular(e.target.checked)}/> Popular</label></div>
    {error&&<div className="auth-message">{error}</div>}<button className="primary-button auth-submit" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{if(!name.trim())throw new Error("Item name is required.");const p=Number(price);if(!Number.isFinite(p)||p<0)throw new Error("Enter a valid price.");await saveMenuItem(restaurantId,{id:item?.id,name,description,price:p,category_id:categoryId||null,image_url:imageUrl,is_available:available,is_popular:popular});onSaved()}catch(err){setError(err instanceof Error?err.message:"Could not save item.")}finally{setBusy(false)}}}>{busy?"Saving…":"Save item"}</button>
  </div></div>;
}

function CategoryManager({restaurantId,categories,onRefresh}:{restaurantId:string,categories:AdminCategory[],onRefresh:()=>Promise<void>}){
  const [name,setName]=useState("");
  return <div className="panel"><div className="panel-heading"><div><h2>Categories</h2><p>Keep the guest menu easy to scan.</p></div><div className="inline-form"><input value={name} onChange={e=>setName(e.target.value)} placeholder="New category"/><button className="primary-button" onClick={async()=>{if(!name.trim())return;await saveCategory(restaurantId,name);setName("");onRefresh()}}><Plus size={15}/> Add</button></div></div>
    <div className="category-list">{categories.map((c,index)=><div className="category-row" key={c.id}><span className="rank">{index+1}</span><strong>{c.name}</strong><span className="status"><Check size={12}/> Active</span><button className="tiny-button danger" onClick={async()=>{if(confirm("Delete this category? Items will become uncategorized.")){await deleteCategory(c.id);onRefresh()}}}><Trash2 size={14}/></button></div>)}</div>
  </div>;
}

function FeedbackPanel({rows,onResolve}:{rows:any[],onResolve:(id:string)=>void}){
  return <div className="panel"><div className="panel-heading"><div><h2>Private feedback</h2><p>Guest comments sent directly to the restaurant.</p></div></div>{rows.length===0?<div className="empty-state">No feedback yet.</div>:rows.map(row=><div className="feedback-row" key={row.id}><MessageSquareText size={18}/><div><strong>{row.message}</strong><small>{new Date(row.created_at).toLocaleString()}</small></div><span>{row.status}</span>{row.status!=="resolved"&&<button className="tiny-button" onClick={()=>onResolve(row.id)}>Resolve</button>}</div>)}</div>;
}

function AnalyticsPanel({data}:{data:Record<string,number>}){
  const entries=[["Page views","page_view"],["Menu opens","menu_view"],["QR scans","qr_scan"],["Review clicks","review_click"],["Directions clicks","directions_click"],["Wi-Fi clicks","wifi_click"],["Feedback opens","feedback_open"],["Feedback sent","feedback_submit"]];
  return <div className="stats-grid analytics-grid">{entries.map(([label,key])=><div className="stat-card" key={key}><div className="stat-top"><span>{label}</span><BarChart3 size={18}/></div><strong>{data[key]??0}</strong><small>Tracked events</small></div>)}</div>;
}

function QrManager(){
  return <div className="panel centered-panel"><p className="eyebrow dark">PERMANENT QR</p><h2>One QR. Unlimited menu changes.</h2><p>Print this QR once. Menu updates do not require reprinting.</p><div className="large-qr"><QRCodeSVG value={DEMO_URL} size={230}/></div><p className="mono-url">{DEMO_URL}</p></div>;
}

function RestaurantSettings({restaurant,onRefresh}:{restaurant:AdminRestaurant,onRefresh:()=>Promise<void>}){
  const [form,setForm]=useState({...restaurant}); const [message,setMessage]=useState("");
  const set=(k:keyof AdminRestaurant,v:any)=>setForm(prev=>({...prev,[k]:v}));
  return <div className="panel settings-panel"><div className="panel-heading"><div><h2>Restaurant profile</h2><p>These details feed the guest-facing page.</p></div></div><div className="form-grid"><label>Name<input value={form.name} onChange={e=>set("name",e.target.value)}/></label><label>Tagline<input value={form.tagline||""} onChange={e=>set("tagline",e.target.value)}/></label><label>Phone<input value={form.phone||""} onChange={e=>set("phone",e.target.value)}/></label><label>Address<input value={form.address||""} onChange={e=>set("address",e.target.value)}/></label><label className="span-2">Google Maps URL<input value={form.google_maps_url||""} onChange={e=>set("google_maps_url",e.target.value)}/></label><label className="span-2">Google Review URL<input value={form.google_review_url||""} onChange={e=>set("google_review_url",e.target.value)}/></label><label>Instagram URL<input value={form.instagram_url||""} onChange={e=>set("instagram_url",e.target.value)}/></label><label>TikTok URL<input value={form.tiktok_url||""} onChange={e=>set("tiktok_url",e.target.value)}/></label></div><button className="primary-button" onClick={async()=>{await updateRestaurant(restaurant.id,{name:form.name,tagline:form.tagline,phone:form.phone,address:form.address,google_maps_url:form.google_maps_url,google_review_url:form.google_review_url,instagram_url:form.instagram_url,tiktok_url:form.tiktok_url});setMessage("Saved.");onRefresh()}}>Save settings</button>{message&&<span className="saved-note">{message}</span>}</div>;
}

function PlatformDashboard(){
  const nav=useNavigate(); const [restaurants,setRestaurants]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false); const [invite,setInvite]=useState(""); const [form,setForm]=useState({name:"",slug:"",tagline:"",address:""});
  async function refresh(){setLoading(true);try{setRestaurants(await listPlatformRestaurants())}finally{setLoading(false)}}
  useEffect(()=>{refresh()},[]);
  return <div className="dashboard"><aside className="sidebar"><Brand/><nav><button className="active"><Store size={19}/><span>Restaurants</span></button><button><BarChart3 size={19}/><span>Analytics</span></button><button><Settings size={19}/><span>Settings</span></button></nav><div className="sidebar-footer"><div className="avatar">MG</div><span><strong>Menu Go</strong><small>Platform owner</small></span></div></aside>
    <section className="dashboard-content"><header className="dash-header"><div><p className="eyebrow dark">PLATFORM ADMIN</p><h1>Restaurants</h1></div><div className="dash-header-actions"><button className="primary-button" onClick={()=>setOpen(true)}><Plus size={17}/> Add restaurant</button><button className="ghost-button" onClick={async()=>{await signOut();nav("/login")}}><LogOut size={17}/> Sign out</button></div></header>
      <div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>Restaurants</span><Store size={20}/></div><strong>{restaurants.length}</strong><small>All tenants</small></div><div className="stat-card"><div className="stat-top"><span>Active</span><Check size={20}/></div><strong>{restaurants.filter(r=>r.status==="active").length}</strong><small>Currently live</small></div><div className="stat-card"><div className="stat-top"><span>Architecture</span><QrCode size={20}/></div><strong>Multi</strong><small>Multi-restaurant</small></div><div className="stat-card"><div className="stat-top"><span>Backend</span><BarChart3 size={20}/></div><strong>Live</strong><small>Supabase</small></div></div>
      <div className="panel"><div className="panel-heading"><div><h2>Restaurant tenants</h2><p>Create restaurants and issue owner invite codes.</p></div></div>{loading?<div className="empty-state">Loading…</div>:restaurants.map(r=><div className="restaurant-row" key={r.id}><div className="restaurant-avatar"><Coffee/></div><div><strong>{r.name}</strong><small>/{r.slug} · {r.address||"No address yet"}</small></div><span className="status"><Check size={13}/> {r.status}</span><button className="tiny-button" onClick={async()=>{const result=await createRestaurantInvite(r.id,"admin");setInvite(result.invite_code)}}>New invite</button></div>)}</div>
    </section>
    {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal admin-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow dark">NEW TENANT</p><h3>Add restaurant</h3></div><button className="icon-button" onClick={()=>setOpen(false)}><X/></button></div><div className="form-grid"><label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Slug<input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-")})} placeholder="restaurant-name"/></label><label className="span-2">Tagline<input value={form.tagline} onChange={e=>setForm({...form,tagline:e.target.value})}/></label><label className="span-2">Address<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label></div><button className="primary-button auth-submit" onClick={async()=>{try{const result=await createRestaurantWithInvite(form);setInvite(result.invite_code);setOpen(false);setForm({name:"",slug:"",tagline:"",address:""});refresh()}catch(err){alert(err instanceof Error?err.message:"Could not create restaurant.")}}}>Create restaurant</button></div></div>}
    {invite&&<div className="modal-backdrop" onClick={()=>setInvite("")}><div className="modal invite-modal" onClick={e=>e.stopPropagation()}><span className="modal-icon"><QrCode/></span><h3>Restaurant invite created</h3><p>Give this one-time code to the restaurant admin. It expires in 14 days.</p><div className="invite-code">{invite}</div><button onClick={async()=>{await navigator.clipboard.writeText(invite);setInvite("")}}>Copy code & close</button></div></div>}
  </div>;
}

function App(){
  return <Routes><Route path="/" element={<Navigate to="/demo" replace/>}/><Route path="/demo" element={<CustomerPage/>}/><Route path="/login" element={<AuthPage/>}/><Route path="/admin" element={<Protected/>}/><Route path="/platform" element={<Protected platform/>}/><Route path="*" element={<Navigate to="/demo" replace/>}/></Routes>;
}
export default App;
