import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, BarChart3, Check, ChevronRight, Coffee, Eye, Heart, Image as ImageIcon,
  Facebook, Globe2, Instagram, LayoutDashboard, Linkedin, LogOut, MapPin, Menu as MenuIcon,
  MessageCircle, MessageSquareText, Music2, Pencil, Phone, Plus, QrCode, Search, Send,
  Settings, Star, Store, Trash2, UtensilsCrossed, X, Youtube
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { categories as fallbackCategories, menuItems as fallbackMenuItems, restaurant as fallbackRestaurant, type MenuItem } from "./data/demo";
import { loadRestaurantBySlug, submitFeedback, trackEvent } from "./lib/data";
import {
  bootstrapAbolManager, bootstrapPlatformAdmin, createRestaurantInvite, createRestaurantWithInvite, deleteCategory,
  deleteMenuItem, getAnalytics, getMyRestaurant, getSession, isPlatformAdmin, listAuditLogs,
  listCategories, listFeedback, listMenuItems, listOpeningHours, listPlatformRestaurants,
  onAuthChange, redeemRestaurantInvite, requestPasswordReset, resolveFeedback, saveCategory, saveMenuItem,
  saveOpeningHours, signIn, signOut, signUp, toggleMenuItem, updatePassword, updateRestaurant,
  uploadMenuImage, uploadRestaurantAsset, type AdminCategory, type AdminMenuItem, type AdminRestaurant
} from "./lib/admin";

const publicMenuUrl = (slug: string) => `https://yohannesmulugeta.github.io/Menu-Go/#/r/${slug}`;

function Brand() {
  return <Link to="/r/sora-table" className="brand"><span className="brand-mark"><UtensilsCrossed size={18}/></span><span>Menu Go</span></Link>;
}

function CustomerPage() {
  const { slug = "sora-table" } = useParams();
  const [category,setCategory]=useState("Popular");
  const [query,setQuery]=useState("");
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  const [feedbackText,setFeedbackText]=useState("");
  const [loadError,setLoadError]=useState("");
  const [restaurant,setRestaurant]=useState({
    ...fallbackRestaurant,id:"11111111-1111-4111-8111-111111111111",
    phone:null as string|null,
    google_maps_url:"https://maps.google.com/?q=Addis+Ababa",google_review_url:null as string|null,
    cover_image_url:null as string|null,
    logo_url:null as string|null,
    instagram_url:null as string|null,
    tiktok_url:null as string|null,
    facebook_url:null as string|null,
    youtube_url:null as string|null,
    telegram_url:null as string|null,
    whatsapp_url:null as string|null,
    linkedin_url:null as string|null,
    website_url:null as string|null
  });
  const [categories,setCategories]=useState(fallbackCategories);
  const [menuItems,setMenuItems]=useState<MenuItem[]>(fallbackMenuItems);

  useEffect(()=>{
    let active=true;
    setLoadError("");
    loadRestaurantBySlug(slug).then(data=>{
      if(!active||!data)return;
      setRestaurant({
        name:data.restaurant.name,tagline:data.restaurant.tagline??fallbackRestaurant.tagline,
        location:data.restaurant.address??fallbackRestaurant.location,hours:fallbackRestaurant.hours,
        currency:data.restaurant.currency,id:data.restaurant.id,phone:data.restaurant.phone,
        google_maps_url:data.restaurant.google_maps_url??"https://maps.google.com/?q=Addis+Ababa",
        google_review_url:data.restaurant.google_review_url,
        cover_image_url:data.restaurant.cover_image_url,
        logo_url:data.restaurant.logo_url,
        instagram_url:data.restaurant.instagram_url,
        tiktok_url:data.restaurant.tiktok_url,
        facebook_url:data.restaurant.facebook_url,
        youtube_url:data.restaurant.youtube_url,
        telegram_url:data.restaurant.telegram_url,
        whatsapp_url:data.restaurant.whatsapp_url,
        linkedin_url:data.restaurant.linkedin_url,
        website_url:data.restaurant.website_url
      });
      setCategories(data.categories); setMenuItems(data.items);
      const today=data.hours.find((h:any)=>h.weekday===new Date().getDay());
      const pretty=(value:string|null)=>{
        if(!value)return "";
        const [hh,mm]=value.split(":").map(Number);
        const suffix=hh>=12?"PM":"AM";
        const h=hh%12||12;
        return `${h}:${String(mm).padStart(2,"0")} ${suffix}`;
      };
      setRestaurant((prev:any)=>({...prev,hours:today?(today.is_closed?"Closed today":`Open today · ${pretty(today.opens_at)}–${pretty(today.closes_at)}`):prev.hours}));
      trackEvent(data.restaurant.id,"page_view",{slug:data.restaurant.slug});
    }).catch(()=>setLoadError("Restaurant not found or not available."));
    return()=>{active=false};
  },[slug]);

  const items=useMemo(()=>menuItems.filter(item=>{
    const matches=category==="Popular"?item.popular:item.category===category;
    return matches&&(item.name+" "+item.description).toLowerCase().includes(query.toLowerCase());
  }),[category,query,menuItems]);

  if(loadError) return <div className="auth-page"><div className="auth-card"><Brand/><h1>Restaurant not found</h1><p className="auth-copy">{loadError}</p><Link className="primary-button auth-submit" to="/r/sora-table">Open demo restaurant</Link></div></div>;

  return <div className="customer-page">
    <header className="hero" style={restaurant.cover_image_url?{backgroundImage:`url(${restaurant.cover_image_url})`}:undefined}><div className="hero-gradient"/><div className="hero-top"><span className="powered">Powered by <strong>Menu Go</strong></span></div>
      <div className="hero-copy"><div className="restaurant-logo">{restaurant.logo_url?<img src={restaurant.logo_url} alt={restaurant.name}/>:<Coffee size={28}/>}</div><p className="eyebrow">{slug==="abol-coffee"?"ABOL COFFEE · HAYAHULET":"DEMO RESTAURANT"}</p>
        <h1>{restaurant.name}</h1><p>{restaurant.tagline}</p><span className="open-pill"><span/> {restaurant.hours}</span></div>
    </header>
    <main className="customer-main">
      <section className="quick-actions">
        <a className="action-card accent" href="#menu" onClick={()=>trackEvent(restaurant.id,"menu_view")}><span className="action-icon"><MenuIcon size={22}/></span><span><strong>View Menu</strong><small>Browse food & drinks</small></span><ChevronRight size={20}/></a>
        <button className="action-card" onClick={()=>{trackEvent(restaurant.id,"review_click"); restaurant.google_review_url?window.open(restaurant.google_review_url,"_blank","noopener,noreferrer"):alert("Demo restaurant: add the real Google Review link in Settings.");}}><span className="action-icon"><Star size={22}/></span><span><strong>Leave a Review</strong><small>Share your experience</small></span><ChevronRight size={20}/></button>
        <a className="action-card" href={restaurant.google_maps_url} onClick={()=>trackEvent(restaurant.id,"directions_click")} target="_blank" rel="noreferrer"><span className="action-icon"><MapPin size={22}/></span><span><strong>Directions</strong><small>{restaurant.location}</small></span><ChevronRight size={20}/></a>
        {restaurant.phone&&<a className="action-card" href={`tel:${restaurant.phone}`}><span className="action-icon"><Phone size={22}/></span><span><strong>Call Us</strong><small>{restaurant.phone}</small></span><ChevronRight size={20}/></a>}
        <button className="action-card" onClick={()=>{trackEvent(restaurant.id,"feedback_open");setFeedbackOpen(true)}}><span className="action-icon"><MessageSquareText size={22}/></span><span><strong>Private Feedback</strong><small>Tell the restaurant directly</small></span><ChevronRight size={20}/></button>
      </section>
      <SocialLinks restaurant={restaurant}/>
      <section id="menu" className="menu-section">
        <div className="section-heading"><div><p className="eyebrow dark">MENU</p><h2>What are you having?</h2></div><span>{items.length} items</span></div>
        {slug==="abol-coffee"&&<p className="price-note">All prices include VAT & service charge.</p>}
        <div className="search-box"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search dishes, drinks..."/></div>
        <div className="category-scroll">{categories.map(item=><button key={item} className={item===category?"category active":"category"} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <div className="menu-grid">{items.map(item=><article className={item.image?"menu-item":"menu-item no-image"} key={item.id}>{item.image&&<img src={item.image} alt="" loading="lazy"/>}<div className="menu-item-body"><div className="menu-item-title"><h3>{item.name}</h3>{item.popular&&<span><Heart size={13}/> Popular</span>}</div><p>{item.description}</p><strong>{item.price} {restaurant.currency}</strong></div></article>)}</div>
        {items.length===0&&<div className="empty-state">No items match your search.</div>}
      </section>
      <footer className="guest-footer"><Brand/><p>A simple digital guest experience for restaurants.</p></footer>
    </main>
    {feedbackOpen&&<div className="modal-backdrop" onClick={()=>setFeedbackOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><span className="modal-icon"><MessageSquareText/></span><h3>Private feedback</h3><p>Your message goes directly to the restaurant.</p><textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} placeholder="Tell us about your experience..." rows={5}/><button onClick={async()=>{try{await submitFeedback(restaurant.id,feedbackText);setFeedbackText("");setFeedbackOpen(false);alert("Thank you. Your feedback was sent privately.");}catch(err){alert(err instanceof Error?err.message:"Could not send feedback.")}}}>Send feedback</button></div></div>}
  </div>;
}

function SocialLinks({restaurant}:{restaurant:any}){
  const links=[
    ["Instagram",restaurant.instagram_url,Instagram],
    ["TikTok",restaurant.tiktok_url,Music2],
    ["Facebook",restaurant.facebook_url,Facebook],
    ["YouTube",restaurant.youtube_url,Youtube],
    ["Telegram",restaurant.telegram_url,Send],
    ["WhatsApp",restaurant.whatsapp_url,MessageCircle],
    ["LinkedIn",restaurant.linkedin_url,Linkedin],
    ["Website",restaurant.website_url,Globe2],
  ].filter(([,url])=>Boolean(url));

  if(links.length===0)return null;

  return <section className="social-section">
    <div className="section-heading"><div><p className="eyebrow dark">CONNECT</p><h2>Follow & contact us</h2></div></div>
    <div className="social-links">
      {links.map(([label,url,Icon]:any)=><a key={label} className="social-link" href={url} target="_blank" rel="noreferrer"><Icon size={18}/><span>{label}</span></a>)}
    </div>
  </section>;
}


function AuthPage(){
  const nav=useNavigate();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(){
    setBusy(true);setMessage("");
    const normalized=email.trim().toLowerCase();
    const isAbol=normalized==="abol";
    const loginValue=isAbol ? "yohannesmulugeta084+abol@gmail.com" : normalized;
    const isInitialAdmin=loginValue==="yohannesmulugeta084@gmail.com";

    try{
      await signIn(loginValue,password);

      const pendingInvite=localStorage.getItem("menugo_pending_invite");
      if(pendingInvite){
        await redeemRestaurantInvite(pendingInvite);
        localStorage.removeItem("menugo_pending_invite");
        localStorage.removeItem("menugo_pending_invite_email");
        nav("/admin");
        return;
      }

      if(isInitialAdmin){
        if(!(await isPlatformAdmin())) await bootstrapPlatformAdmin();
        nav("/platform");
        return;
      }

      if(isAbol || loginValue==="yohannesmulugeta084+abol@gmail.com"){
        const mine=await getMyRestaurant();
        if(!mine) await bootstrapAbolManager();
        nav("/admin");
        return;
      }

      if(await isPlatformAdmin()){
        nav("/platform");
        return;
      }

      const mine=await getMyRestaurant();
      nav(mine?"/admin":"/no-access");
    }catch(signInError){
      if(isInitialAdmin || isAbol){
        try{
          const redirectTo=`${window.location.origin}${window.location.pathname}?page=${isInitialAdmin?"setup-confirm":"manager-confirm"}`;
          if(isInitialAdmin)localStorage.setItem("menugo_pending_admin_bootstrap","1");
          if(isAbol)localStorage.setItem("menugo_pending_abol_bootstrap","1");

          const result=await signUp(loginValue,password,redirectTo);

          if(result.session){
            if(isInitialAdmin){
              await bootstrapPlatformAdmin();
              localStorage.removeItem("menugo_pending_admin_bootstrap");
              nav("/platform");
            }else{
              await bootstrapAbolManager();
              localStorage.removeItem("menugo_pending_abol_bootstrap");
              nav("/admin");
            }
            return;
          }

          setMessage("Account created. Check your email and confirm it, then sign in again.");
          return;
        }catch(createError){
          setMessage(createError instanceof Error?createError.message:"Could not create the account.");
          return;
        }
      }

      setMessage(signInError instanceof Error?signInError.message:"Could not sign in.");
    }finally{
      setBusy(false);
    }
  }

  return <div className="auth-page"><div className="auth-card">
    <Brand/>
    <p className="eyebrow dark">SECURE ACCESS</p>
    <h1>Sign in to Menu Go</h1>
    <p className="auth-copy">Use your Menu Go email and password. Abol can sign in with the username <strong>abol</strong>.</p>
    <label>Email or username<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com or abol" autoComplete="username"/></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password"/></label>
    <button className="primary-button auth-submit" disabled={busy||!email||!password} onClick={submit}>{busy?"Please wait…":"Sign in"}</button>
    <Link className="auth-switch" to="/forgot-password">Forgot password?</Link>
    <p className="auth-help">Manager accounts are invitation-only. Contact your Menu Go administrator if you need access.</p>
    {message&&<div className="auth-message">{message}</div>}
    {email.trim().toLowerCase()==="yohannesmulugeta084@gmail.com"&&message&&
      <Link className="primary-button auth-submit" to="/setup">Create the Admin account first</Link>}
    <small className="auth-build">Auth build 5</small>
  </div></div>
}

function ForgotPasswordPage(){
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function send(){
    setBusy(true);setMessage("");
    try{
      const redirectTo=`${window.location.origin}${window.location.pathname}?page=reset-password`;
      await requestPasswordReset(email,redirectTo);
      setMessage("If an account exists for this email, a password reset link has been sent.");
    }catch(err){
      setMessage(err instanceof Error?err.message:"Could not send reset email.");
    }finally{
      setBusy(false);
    }
  }

  return <div className="auth-page"><div className="auth-card">
    <Brand/><p className="eyebrow dark">PASSWORD RECOVERY</p><h1>Reset your password</h1>
    <p className="auth-copy">Enter your account email and we will send a secure reset link.</p>
    <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label>
    <button className="primary-button auth-submit" disabled={busy||!email} onClick={send}>{busy?"Sending…":"Send reset link"}</button>
    <Link className="auth-switch" to="/login">Back to sign in</Link>
    {message&&<div className="auth-message">{message}</div>}
  </div></div>
}

function ResetPasswordPage(){
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState<"loading"|"yes"|"no">("loading");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    getSession().then(s=>setReady(s?"yes":"no")).catch(()=>setReady("no"));
  },[]);

  async function save(){
    if(password.length<8)return setMessage("Use at least 8 characters.");
    if(password!==confirm)return setMessage("Passwords do not match.");
    setBusy(true);setMessage("");
    try{
      await updatePassword(password);
      await signOut();
      window.location.href=`${window.location.origin}${window.location.pathname}#/login`;
    }catch(err){
      setMessage(err instanceof Error?err.message:"Could not update password.");
    }finally{
      setBusy(false);
    }
  }

  return <div className="auth-page"><div className="auth-card">
    <Brand/><p className="eyebrow dark">NEW PASSWORD</p><h1>Choose a new password</h1>
    {ready==="loading"?<div className="auth-message">Checking reset link…</div>:ready==="no"?<>
      <p className="auth-copy">This reset link is invalid or has expired.</p>
      <a className="primary-button auth-submit" href={`${window.location.origin}${window.location.pathname}#/forgot-password`}>Request another link</a>
    </>:<>
      <label>New password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
      <label>Confirm password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label>
      <button className="primary-button auth-submit" disabled={busy} onClick={save}>{busy?"Saving…":"Update password"}</button>
    </>}
    {message&&<div className="auth-message">{message}</div>}
  </div></div>
}

function AcceptInvitePage(){
  const nav=useNavigate();
  const location=useLocation();
  const params=new URLSearchParams(location.search);
  const code=params.get("code")||"";
  const invitedEmail=(params.get("email")||"").toLowerCase();

  const [email,setEmail]=useState(invitedEmail);
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  function rememberInvite(){
    if(code)localStorage.setItem("menugo_pending_invite",code);
    if(email)localStorage.setItem("menugo_pending_invite_email",email.trim().toLowerCase());
  }

  async function createAccount(){
    if(!code)return setMessage("This invitation link is incomplete.");
    if(!email)return setMessage("Enter the invited email address.");
    if(invitedEmail && email.trim().toLowerCase()!==invitedEmail)return setMessage("Use the email address this invitation was sent to.");
    if(password.length<8)return setMessage("Use at least 8 characters for the password.");
    if(password!==confirm)return setMessage("Passwords do not match.");

    setBusy(true);setMessage("");rememberInvite();
    try{
      const redirectTo=`${window.location.origin}${window.location.pathname}?page=invite-confirm`;
      const result=await signUp(email.trim().toLowerCase(),password,redirectTo);

      if(result.session){
        await redeemRestaurantInvite(code);
        localStorage.removeItem("menugo_pending_invite");
        localStorage.removeItem("menugo_pending_invite_email");
        nav("/admin");
        return;
      }

      setMessage("Account created. Check your email to confirm it, then sign in. Your restaurant invitation will be applied automatically.");
    }catch(err){
      setMessage(err instanceof Error?err.message:"Could not create the manager account.");
    }finally{
      setBusy(false);
    }
  }

  function signInExisting(){
    rememberInvite();
    nav("/login");
  }

  return <div className="auth-page"><div className="auth-card">
    <Brand/><p className="eyebrow dark">RESTAURANT INVITATION</p><h1>Join Menu Go</h1>
    <p className="auth-copy">Create your manager account using the email address invited by Menu Go Admin.</p>
    <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={Boolean(invitedEmail)} autoComplete="email"/></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password"/></label>
    <label>Confirm password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label>
    <button className="primary-button auth-submit" disabled={busy} onClick={createAccount}>{busy?"Creating account…":"Create manager account"}</button>
    <button className="auth-switch" onClick={signInExisting}>Already have an account? Sign in</button>
    {message&&<div className="auth-message">{message}</div>}
  </div></div>
}

function InviteConfirmPage(){
  const [message,setMessage]=useState("Confirming your invitation…");

  useEffect(()=>{
    (async()=>{
      try{
        const session=await getSession();
        const code=localStorage.getItem("menugo_pending_invite");
        if(session&&code){
          await redeemRestaurantInvite(code);
          localStorage.removeItem("menugo_pending_invite");
          localStorage.removeItem("menugo_pending_invite_email");
          window.location.href=`${window.location.origin}${window.location.pathname}#/admin`;
          return;
        }
        setMessage("Email confirmed. Sign in to finish activating your restaurant access.");
      }catch{
        setMessage("Email confirmed. Sign in to finish activating your restaurant access.");
      }
    })();
  },[]);

  return <div className="auth-page"><div className="auth-card">
    <Brand/><p className="eyebrow dark">EMAIL CONFIRMATION</p><h1>Almost finished</h1>
    <div className="auth-message">{message}</div>
    <a className="primary-button auth-submit" href={`${window.location.origin}${window.location.pathname}#/login`}>Continue to sign in</a>
  </div></div>
}

function SetupPage(){
  const nav=useNavigate();
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const adminEmail="yohannesmulugeta084@gmail.com";

  async function createAdmin(){
    if(password.length<8)return setMessage("Use at least 8 characters.");
    setBusy(true);setMessage("");
    localStorage.setItem("menugo_pending_admin_bootstrap","1");

    try{
      const redirectTo=`${window.location.origin}${window.location.pathname}?page=setup-confirm`;
      const result=await signUp(adminEmail,password,redirectTo);
      if(result.session){
        await bootstrapPlatformAdmin();
        localStorage.removeItem("menugo_pending_admin_bootstrap");
        nav("/platform");
        return;
      }
      setMessage("Admin account created. Check your email and confirm it. Menu Go will then finish Admin access automatically.");
    }catch(err){
      setMessage(err instanceof Error?err.message:"Could not create Menu Go Admin.");
    }finally{
      setBusy(false);
    }
  }

  return <div className="auth-page"><div className="auth-card">
    <Brand/><p className="eyebrow dark">ONE-TIME SETUP</p><h1>Create Menu Go Admin</h1>
    <p className="auth-copy">This setup is locked to your verified Admin email.</p>
    <label>Admin email<input type="email" value={adminEmail} disabled/></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password"/></label>
    <button className="primary-button auth-submit" disabled={busy||password.length<8} onClick={createAdmin}>{busy?"Creating…":"Create Admin account"}</button>
    {message&&<div className="auth-message">{message}</div>}
  </div></div>
}

function SetupConfirmPage(){
  const [message,setMessage]=useState("Finishing Menu Go Admin setup…");

  useEffect(()=>{
    (async()=>{
      try{
        const session=await getSession();
        const pending=localStorage.getItem("menugo_pending_admin_bootstrap");
        if(session&&pending){
          await bootstrapPlatformAdmin();
          localStorage.removeItem("menugo_pending_admin_bootstrap");
          window.location.href=`${window.location.origin}${window.location.pathname}#/platform`;
          return;
        }
        setMessage("Email confirmed. Sign in with your Admin email and password.");
      }catch(err){
        setMessage(err instanceof Error?err.message:"Could not finish Admin setup.");
      }
    })();
  },[]);

  return <div className="auth-page"><div className="auth-card">
    <Brand/><p className="eyebrow dark">ADMIN SETUP</p><h1>Finalizing access</h1>
    <div className="auth-message">{message}</div>
    <a className="primary-button auth-submit" href={`${window.location.origin}${window.location.pathname}#/login`}>Continue to sign in</a>
  </div></div>
}

function ManagerConfirmPage(){
  const [message,setMessage]=useState("Finishing Abol Manager setup…");

  useEffect(()=>{
    (async()=>{
      try{
        const session=await getSession();
        const pending=localStorage.getItem("menugo_pending_abol_bootstrap");
        if(session&&pending){
          await bootstrapAbolManager();
          localStorage.removeItem("menugo_pending_abol_bootstrap");
          window.location.href=`${window.location.origin}${window.location.pathname}#/admin`;
          return;
        }
        setMessage("Email confirmed. Sign in with username abol and your password.");
      }catch(err){
        setMessage(err instanceof Error?err.message:"Could not finish Abol Manager setup.");
      }
    })();
  },[]);

  return <div className="auth-page"><div className="auth-card">
    <Brand/><p className="eyebrow dark">MANAGER SETUP</p><h1>Finalizing access</h1>
    <div className="auth-message">{message}</div>
    <a className="primary-button auth-submit" href={`${window.location.origin}${window.location.pathname}#/login`}>Continue to sign in</a>
  </div></div>
}

function NoAccessPage(){
  const nav=useNavigate();
  return <div className="auth-page"><div className="auth-card">
    <Brand/><p className="eyebrow dark">ACCESS REQUIRED</p><h1>No restaurant assigned</h1>
    <p className="auth-copy">This email is signed in, but it does not have Menu Go Admin or Restaurant Manager access.</p>
    <button className="primary-button auth-submit" onClick={async()=>{await signOut();nav("/login")}}>Sign out</button>
  </div></div>
}

function PreviewGate({role,children}:{role:"admin"|"manager",children:React.ReactNode}){
  const allowed=sessionStorage.getItem("menugo_preview_role")===role;
  if(!allowed)return <Navigate to="/login" replace/>;
  return <>{children}</>;
}

function PreviewPlatformDashboard(){
  const nav=useNavigate();
  const restaurants=[
    {name:"Abol Coffee",slug:"abol-coffee",status:"active",address:"22 Mazoria, Addis Ababa"},
    {name:"Addis Harvest",slug:"addis-harvest",status:"active",address:"Bole, Addis Ababa — Demo"},
    {name:"Sora Table",slug:"sora-table",status:"active",address:"Demo restaurant"}
  ];
  return <div className="dashboard">
    <aside className="sidebar"><Brand/><nav>
      <button className="active"><Store size={19}/><span>Restaurants</span></button>
      <button><BarChart3 size={19}/><span>Analytics</span></button>
      <button><Settings size={19}/><span>Settings</span></button>
    </nav><div className="sidebar-footer"><div className="avatar">MG</div><span><strong>Menu Go</strong><small>Admin Preview</small></span></div></aside>
    <section className="dashboard-content">
      <header className="dash-header"><div><p className="eyebrow dark">MENU GO ADMIN · PREVIEW</p><h1>Restaurants</h1></div>
        <div className="dash-header-actions"><button className="primary-button" onClick={()=>alert("Preview mode: restaurant creation is disabled.")}><Plus size={17}/> Add restaurant</button>
        <button className="ghost-button" onClick={()=>{sessionStorage.removeItem("menugo_preview_role");nav("/login")}}><LogOut size={17}/> Exit preview</button></div>
      </header>
      <div className="preview-banner">Preview access — you can inspect the Admin experience, but changes are disabled.</div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Restaurants</span><Store size={20}/></div><strong>{restaurants.length}</strong><small>Platform tenants</small></div>
        <div className="stat-card"><div className="stat-top"><span>Active</span><Check size={20}/></div><strong>{restaurants.length}</strong><small>Currently live</small></div>
        <div className="stat-card"><div className="stat-top"><span>Managers</span><Settings size={20}/></div><strong>1+</strong><small>Per restaurant</small></div>
        <div className="stat-card"><div className="stat-top"><span>Public access</span><QrCode size={20}/></div><strong>QR</strong><small>No customer login</small></div>
      </div>
      <div className="panel"><div className="panel-heading"><div><h2>Restaurant tenants</h2><p>Admin controls every restaurant and manager assignment.</p></div></div>
        {restaurants.map(r=><div className="restaurant-row" key={r.slug}>
          <div className="restaurant-avatar"><Coffee/></div><div><strong>{r.name}</strong><small>/{r.slug} · {r.address}</small></div>
          <span className="status"><Check size={13}/> {r.status}</span>
          <Link className="tiny-button" to={`/r/${r.slug}`}><Eye size={14}/> Public</Link>
          {r.slug==="abol-coffee"?<Link className="tiny-button" to="/preview/manager"><Settings size={14}/> Manage</Link>:<button className="tiny-button" onClick={()=>alert("Preview mode")}>Manage</button>}
        </div>)}
      </div>
    </section>
  </div>;
}

function PreviewManagerDashboard(){
  const nav=useNavigate();
  const [tab,setTab]=useState<AdminTab>("Overview");
  const [restaurant,setRestaurant]=useState<any>(null);
  const [items,setItems]=useState<MenuItem[]>([]);
  const [categories,setCategories]=useState<string[]>([]);
  const [hours,setHours]=useState<any[]>([]);
  useEffect(()=>{
    loadRestaurantBySlug("abol-coffee").then(data=>{
      if(!data)return;
      setRestaurant(data.restaurant);setItems(data.items);setCategories(data.categories);setHours(data.hours);
    });
  },[]);
  const navItems:[AdminTab,any][]=[
    ["Overview",LayoutDashboard],["Menu",MenuIcon],["Categories",UtensilsCrossed],
    ["Hours",Settings],["Feedback",MessageSquareText],["Analytics",BarChart3],
    ["Activity",Eye],["QR Codes",QrCode],["Settings",Settings]
  ];
  if(!restaurant)return <div className="screen-loader">Loading Abol Coffee preview…</div>;
  return <div className="dashboard">
    <aside className="sidebar"><Brand/><nav>{navItems.map(([label,Icon])=><button key={label} className={tab===label?"active":""} onClick={()=>setTab(label)}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-footer"><div className="avatar">AC</div><span><strong>Abol Coffee</strong><small>Manager Preview</small></span></div></aside>
    <section className="dashboard-content">
      <header className="dash-header"><div><p className="eyebrow dark">RESTAURANT MANAGER · PREVIEW</p><h1>{tab}</h1></div>
        <div className="dash-header-actions"><Link to="/r/abol-coffee" className="ghost-button"><Eye size={17}/> View live menu</Link>
        <button className="ghost-button" onClick={()=>{sessionStorage.removeItem("menugo_preview_role");nav("/login")}}><LogOut size={17}/> Exit preview</button></div>
      </header>
      <div className="preview-banner">Preview access — this shows the Abol Coffee manager dashboard. Editing is disabled until a real manager account is created.</div>
      {tab==="Overview"&&<><div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Menu items</span><MenuIcon size={20}/></div><strong>{items.length}</strong><small>Live Abol menu</small></div>
        <div className="stat-card"><div className="stat-top"><span>Categories</span><UtensilsCrossed size={20}/></div><strong>{categories.length}</strong><small>Live categories</small></div>
        <div className="stat-card"><div className="stat-top"><span>Availability</span><Check size={20}/></div><strong>{items.length}</strong><small>Visible items</small></div>
        <div className="stat-card"><div className="stat-top"><span>Public link</span><QrCode size={20}/></div><strong>Live</strong><small>/r/abol-coffee</small></div>
      </div><div className="panel"><div className="panel-heading"><div><h2>Manager responsibilities</h2><p>Everything the restaurant manager can maintain.</p></div></div>
        <div className="preview-feature-grid"><span>Menu & prices</span><span>Logo & cover</span><span>Categories</span><span>Opening hours</span><span>Availability</span><span>Feedback</span><span>Analytics</span><span>QR code</span></div>
      </div></>}
      {tab==="Menu"&&<div className="panel"><div className="panel-heading"><div><h2>Abol Coffee menu</h2><p>{items.length} live items. In the real manager account these can be edited.</p></div><button className="primary-button" onClick={()=>alert("Preview mode")}><Plus size={16}/> Add item</button></div>
        {items.slice(0,18).map(i=><div className="preview-menu-row" key={i.id}><div><strong>{i.name}</strong><small>{i.category}</small></div><span>{i.price} ETB</span><button className="tiny-button" onClick={()=>alert("Preview mode")}>Edit</button></div>)}
      </div>}
      {tab==="Categories"&&<div className="panel"><div className="panel-heading"><div><h2>Categories</h2><p>Manager can organize the menu.</p></div></div>{categories.map(c=><div className="preview-menu-row" key={c}><strong>{c}</strong><button className="tiny-button" onClick={()=>alert("Preview mode")}>Edit</button></div>)}</div>}
      {tab==="Hours"&&<div className="panel"><div className="panel-heading"><div><h2>Opening hours</h2><p>Editable in the real manager account.</p></div></div>{hours.map((h:any)=><div className="preview-menu-row" key={h.weekday}><strong>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][h.weekday]}</strong><span>{h.is_closed?"Closed":`${String(h.opens_at).slice(0,5)} – ${String(h.closes_at).slice(0,5)}`}</span></div>)}</div>}
      {tab==="Feedback"&&<div className="panel centered-panel"><MessageSquareText size={32}/><h2>Private feedback</h2><p>Managers see customer feedback here and can mark it resolved.</p></div>}
      {tab==="Analytics"&&<div className="stats-grid"><div className="stat-card"><span>Page views</span><strong>—</strong><small>Available after real sign-in</small></div><div className="stat-card"><span>Review clicks</span><strong>—</strong><small>Available after real sign-in</small></div><div className="stat-card"><span>Directions</span><strong>—</strong><small>Available after real sign-in</small></div></div>}
      {tab==="Activity"&&<div className="panel centered-panel"><Eye size={32}/><h2>Activity log</h2><p>Real manager changes such as price edits and availability updates are recorded here.</p></div>}
      {tab==="QR Codes"&&<div className="panel centered-panel"><p className="eyebrow dark">PERMANENT QR</p><h2>Abol Coffee</h2><div className="large-qr"><QRCodeSVG value={publicMenuUrl("abol-coffee")} size={230}/></div><p className="mono-url">{publicMenuUrl("abol-coffee")}</p></div>}
      {tab==="Settings"&&<div className="panel settings-panel"><div className="panel-heading"><div><h2>Restaurant profile</h2><p>Logo, cover, contact details and social links are managed here.</p></div></div>
        <div className="form-grid"><label>Name<input value={restaurant.name} disabled/></label><label>Tagline<input value={restaurant.tagline||""} disabled/></label><label>Phone<input value={restaurant.phone||""} disabled/></label><label>Address<input value={restaurant.address||""} disabled/></label></div>
      </div>}
    </section>
  </div>;
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

type AdminTab="Overview"|"Menu"|"Categories"|"Hours"|"Feedback"|"Analytics"|"Activity"|"QR Codes"|"Settings";

function RestaurantDashboard(){
  const nav=useNavigate();
  const { restaurantId: requestedRestaurantId } = useParams();
  const [tab,setTab]=useState<AdminTab>("Overview");
  const [restaurant,setRestaurant]=useState<AdminRestaurant|null>(null);
  const [role,setRole]=useState("");
  const [items,setItems]=useState<AdminMenuItem[]>([]);
  const [categories,setCategories]=useState<AdminCategory[]>([]);
  const [feedback,setFeedback]=useState<any[]>([]);
  const [analytics,setAnalytics]=useState<Record<string,number>>({});
  const [hours,setHours]=useState<any[]>([]);
  const [audit,setAudit]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [editor,setEditor]=useState<AdminMenuItem|null|undefined>(undefined);

  async function refresh(){
    setLoading(true);
    try{
      const mine=await getMyRestaurant(requestedRestaurantId);
      if(!mine){setRestaurant(null);return}
      setRestaurant(mine.restaurant);setRole(mine.role);
      const [c,m,f,a,h,l]=await Promise.all([
        listCategories(mine.restaurant.id),
        listMenuItems(mine.restaurant.id),
        listFeedback(mine.restaurant.id),
        getAnalytics(mine.restaurant.id),
        listOpeningHours(mine.restaurant.id),
        listAuditLogs(mine.restaurant.id)
      ]);
      setCategories(c);setItems(m);setFeedback(f);setAnalytics(a);setHours(h);setAudit(l);
    }finally{setLoading(false)}
  }
  useEffect(()=>{refresh()},[requestedRestaurantId]);

  if(loading) return <div className="screen-loader">Loading restaurant dashboard…</div>;
  if(!restaurant) return <div className="auth-page"><div className="auth-card"><Brand/><h1>No restaurant assigned yet</h1><p className="auth-copy">Ask the Menu Go platform owner for a restaurant invite code, then redeem it on the login page.</p><Link className="primary-button auth-submit" to="/login">Enter invite code</Link></div></div>;

  const navItems:[AdminTab,any][]=[
    ["Overview",LayoutDashboard],["Menu",MenuIcon],["Categories",UtensilsCrossed],
    ["Hours",Settings],["Feedback",MessageSquareText],["Analytics",BarChart3],
    ["Activity",Eye],["QR Codes",QrCode],["Settings",Settings]
  ];
  return <div className="dashboard"><aside className="sidebar"><Brand/><nav>{navItems.map(([label,Icon])=><button key={label} className={tab===label?"active":""} onClick={()=>setTab(label)}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="sidebar-footer"><div className="avatar">{restaurant.name.slice(0,2).toUpperCase()}</div><span><strong>{restaurant.name}</strong><small>{role==="platform_admin"?"Menu Go Admin":"Restaurant Manager"}</small></span></div></aside>
    <section className="dashboard-content"><header className="dash-header"><div><p className="eyebrow dark">RESTAURANT ADMIN</p><h1>{tab}</h1></div><div className="dash-header-actions"><Link to={`/r/${restaurant.slug}`} className="ghost-button"><Eye size={17}/> View live menu</Link><button className="ghost-button" onClick={async()=>{await signOut();nav("/login")}}><LogOut size={17}/> Sign out</button></div></header>
      {tab==="Overview"&&<RestaurantOverview analytics={analytics} items={items} slug={restaurant.slug}/>}
      {tab==="Menu"&&<MenuManager restaurantId={restaurant.id} items={items} categories={categories} onRefresh={refresh} onEdit={setEditor}/>}
      {tab==="Categories"&&<CategoryManager restaurantId={restaurant.id} categories={categories} onRefresh={refresh}/>}
      {tab==="Hours"&&<HoursManager restaurantId={restaurant.id} rows={hours} onRefresh={refresh}/>}
      {tab==="Feedback"&&<FeedbackPanel rows={feedback} onResolve={async id=>{await resolveFeedback(id);refresh()}}/>}
      {tab==="Analytics"&&<AnalyticsPanel data={analytics}/>}
      {tab==="Activity"&&<ActivityPanel rows={audit}/>}
      {tab==="QR Codes"&&<QrManager slug={restaurant.slug}/>} 
      {tab==="Settings"&&<RestaurantSettings restaurant={restaurant} onRefresh={refresh}/>}
    </section>
    {editor!==undefined&&<MenuItemEditor restaurantId={restaurant.id} categories={categories} item={editor} onClose={()=>setEditor(undefined)} onSaved={async()=>{setEditor(undefined);await refresh()}}/>}
  </div>;
}

function RestaurantOverview({analytics,items,slug}:{analytics:Record<string,number>,items:AdminMenuItem[],slug:string}){
  const stats=[["Menu views",analytics.menu_view??0,Eye],["QR scans",analytics.qr_scan??0,QrCode],["Review clicks",analytics.review_click??0,Star],["Feedback",analytics.feedback_submit??0,MessageSquareText]] as const;
  return <><div className="stats-grid">{stats.map(([label,value,Icon])=><div className="stat-card" key={label}><div className="stat-top"><span>{label}</span><Icon size={20}/></div><strong>{value}</strong><small>Live Supabase data</small></div>)}</div>
    <div className="dash-grid"><div className="panel"><div className="panel-heading"><div><h2>Popular menu items</h2><p>Items marked as popular</p></div></div>{items.filter(i=>i.is_popular).slice(0,5).map((item,index)=><div className="rank-row" key={item.id}><span className="rank">{index+1}</span><img src={item.image_url||fallbackMenuItems[0].image} alt=""/><div><strong>{item.name}</strong><small>{item.category?.name||"Uncategorized"}</small></div><span>{item.is_available?"Available":"Hidden"}</span></div>)}</div>
    <div className="panel qr-mini"><div className="panel-heading"><div><h2>Your table QR</h2><p>One code, always current</p></div></div><div className="qr-wrap"><QRCodeSVG value={publicMenuUrl(slug)} size={158}/></div><p>Menu changes appear instantly without replacing printed QR codes.</p></div></div></>;
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
  const entries=[["Page views","page_view"],["Menu opens","menu_view"],["QR scans","qr_scan"],["Review clicks","review_click"],["Directions clicks","directions_click"],["Feedback opens","feedback_open"],["Feedback sent","feedback_submit"]];
  return <div className="stats-grid analytics-grid">{entries.map(([label,key])=><div className="stat-card" key={key}><div className="stat-top"><span>{label}</span><BarChart3 size={18}/></div><strong>{data[key]??0}</strong><small>Tracked events</small></div>)}</div>;
}


function HoursManager({restaurantId,rows,onRefresh}:{restaurantId:string,rows:any[],onRefresh:()=>Promise<void>}){
  const labels=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const initial=labels.map((_,weekday)=>{
    const found=rows.find(r=>r.weekday===weekday);
    return found??{weekday,opens_at:"07:00",closes_at:"21:00",is_closed:false};
  });
  const [form,setForm]=useState(initial);
  useEffect(()=>setForm(labels.map((_,weekday)=>rows.find(r=>r.weekday===weekday)??{weekday,opens_at:"07:00",closes_at:"21:00",is_closed:false})),[rows]);

  const change=(weekday:number,key:string,value:any)=>setForm(prev=>prev.map(r=>r.weekday===weekday?{...r,[key]:value}:r));
  return <div className="panel settings-panel">
    <div className="panel-heading"><div><h2>Opening hours</h2><p>These hours appear on the public restaurant page.</p></div></div>
    <div className="hours-list">{form.map(row=><div className="hours-row" key={row.weekday}>
      <strong>{labels[row.weekday]}</strong>
      <label className="check-label"><input type="checkbox" checked={row.is_closed} onChange={e=>change(row.weekday,"is_closed",e.target.checked)}/> Closed</label>
      <input type="time" disabled={row.is_closed} value={(row.opens_at||"07:00").slice(0,5)} onChange={e=>change(row.weekday,"opens_at",e.target.value)}/>
      <span>to</span>
      <input type="time" disabled={row.is_closed} value={(row.closes_at||"21:00").slice(0,5)} onChange={e=>change(row.weekday,"closes_at",e.target.value)}/>
    </div>)}</div>
    <button className="primary-button" onClick={async()=>{await saveOpeningHours(restaurantId,form.map(r=>({weekday:r.weekday,opens_at:r.is_closed?null:r.opens_at,closes_at:r.is_closed?null:r.closes_at,is_closed:r.is_closed})));await onRefresh()}}>Save hours</button>
  </div>;
}

function ActivityPanel({rows}:{rows:any[]}){
  const label=(row:any)=>{
    const data=row.new_data||row.old_data||{};
    if(row.entity_type==="menu_items") return data.name||"Menu item";
    if(row.entity_type==="categories") return data.name||"Category";
    if(row.entity_type==="restaurants") return data.name||"Restaurant";
    if(row.entity_type==="opening_hours") return `Opening hours · day ${data.weekday??""}`;
    return row.entity_type;
  };
  const detail=(row:any)=>{
    if(row.action==="update"&&row.entity_type==="menu_items"&&row.old_data&&row.new_data&&row.old_data.price!==row.new_data.price)
      return `Price: ${row.old_data.price} ETB → ${row.new_data.price} ETB`;
    if(row.action==="update"&&row.entity_type==="menu_items"&&row.old_data&&row.new_data&&row.old_data.is_available!==row.new_data.is_available)
      return row.new_data.is_available?"Marked available":"Marked unavailable";
    return row.action.charAt(0).toUpperCase()+row.action.slice(1);
  };
  return <div className="panel">
    <div className="panel-heading"><div><h2>Activity log</h2><p>Recent restaurant changes for accountability.</p></div></div>
    {rows.length===0?<div className="empty-state">No activity recorded yet.</div>:rows.map(row=><div className="activity-row" key={row.id}>
      <div><strong>{label(row)}</strong><small>{detail(row)}</small></div>
      <span>{new Date(row.created_at).toLocaleString()}</span>
    </div>)}
  </div>;
}

function QrManager({slug}:{slug:string}){
  const url=publicMenuUrl(slug);
  return <div className="panel centered-panel"><p className="eyebrow dark">PERMANENT QR</p><h2>One QR. Unlimited menu changes.</h2><p>Print this QR once. Menu updates do not require reprinting.</p><div className="large-qr"><QRCodeSVG value={url} size={230}/></div><p className="mono-url">{url}</p></div>;
}

function RestaurantSettings({restaurant,onRefresh}:{restaurant:AdminRestaurant,onRefresh:()=>Promise<void>}){
  const [form,setForm]=useState({...restaurant});
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const set=(k:keyof AdminRestaurant,v:any)=>setForm(prev=>({...prev,[k]:v}));

  async function upload(kind:"logo"|"cover",file?:File){
    if(!file)return;
    setBusy(true);setMessage("");
    try{
      const url=await uploadRestaurantAsset(restaurant.id,file,kind);
      set(kind==="logo"?"logo_url":"cover_image_url",url);
      setMessage(`${kind==="logo"?"Logo":"Cover image"} uploaded. Save settings to publish it.`);
    }catch(err){setMessage(err instanceof Error?err.message:"Upload failed.");}
    finally{setBusy(false)}
  }

  return <div className="panel settings-panel">
    <div className="panel-heading"><div><h2>Restaurant profile</h2><p>Managers can maintain the public restaurant page. The permanent link is controlled by Menu Go Admin.</p></div></div>
    <div className="asset-grid">
      <label className="asset-upload"><strong>Restaurant logo</strong>{form.logo_url&&<img src={form.logo_url} alt="Logo preview"/>}<input type="file" accept="image/*" disabled={busy} onChange={e=>upload("logo",e.target.files?.[0])}/></label>
      <label className="asset-upload cover-upload"><strong>Cover image</strong>{form.cover_image_url&&<img src={form.cover_image_url} alt="Cover preview"/>}<input type="file" accept="image/*" disabled={busy} onChange={e=>upload("cover",e.target.files?.[0])}/></label>
    </div>
    <div className="form-grid">
      <label>Name<input value={form.name} onChange={e=>set("name",e.target.value)}/></label>
      <label>Tagline<input value={form.tagline||""} onChange={e=>set("tagline",e.target.value)}/></label>
      <label>Phone<input value={form.phone||""} onChange={e=>set("phone",e.target.value)}/></label>
      <label>Address<input value={form.address||""} onChange={e=>set("address",e.target.value)}/></label>
      <label className="span-2">Google Maps URL<input value={form.google_maps_url||""} onChange={e=>set("google_maps_url",e.target.value)}/></label>
      <label className="span-2">Google Review URL<input value={form.google_review_url||""} onChange={e=>set("google_review_url",e.target.value)}/></label>
      <label>Instagram URL<input value={form.instagram_url||""} onChange={e=>set("instagram_url",e.target.value)}/></label>
      <label>TikTok URL<input value={form.tiktok_url||""} onChange={e=>set("tiktok_url",e.target.value)}/></label>
      <label>Facebook URL<input value={form.facebook_url||""} onChange={e=>set("facebook_url",e.target.value)}/></label>
      <label>YouTube URL<input value={form.youtube_url||""} onChange={e=>set("youtube_url",e.target.value)}/></label>
      <label>Telegram URL<input value={form.telegram_url||""} onChange={e=>set("telegram_url",e.target.value)}/></label>
      <label>WhatsApp URL<input value={form.whatsapp_url||""} onChange={e=>set("whatsapp_url",e.target.value)}/></label>
      <label>LinkedIn URL<input value={form.linkedin_url||""} onChange={e=>set("linkedin_url",e.target.value)}/></label>
      <label>Website URL<input value={form.website_url||""} onChange={e=>set("website_url",e.target.value)}/></label>
    </div>
    <button className="primary-button" disabled={busy} onClick={async()=>{await updateRestaurant(restaurant.id,{
      name:form.name,tagline:form.tagline,phone:form.phone,address:form.address,
      google_maps_url:form.google_maps_url,google_review_url:form.google_review_url,
      instagram_url:form.instagram_url,tiktok_url:form.tiktok_url,facebook_url:form.facebook_url,
      youtube_url:form.youtube_url,telegram_url:form.telegram_url,whatsapp_url:form.whatsapp_url,
      linkedin_url:form.linkedin_url,website_url:form.website_url,logo_url:form.logo_url,
      cover_image_url:form.cover_image_url
    });setMessage("Saved.");onRefresh()}}>Save settings</button>
    {message&&<span className="saved-note">{message}</span>}
  </div>;
}


function PlatformDashboard(){
  const nav=useNavigate();
  const [restaurants,setRestaurants]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [inviteRestaurant,setInviteRestaurant]=useState<any|null>(null);
  const [inviteEmail,setInviteEmail]=useState("");
  const [inviteLink,setInviteLink]=useState("");
  const [inviteBusy,setInviteBusy]=useState(false);
  const [form,setForm]=useState({name:"",slug:"",tagline:"",address:""});

  async function refresh(){
    setLoading(true);
    try{setRestaurants(await listPlatformRestaurants())}
    finally{setLoading(false)}
  }
  useEffect(()=>{refresh()},[]);

  function managerInviteUrl(code:string,email:string){
    return `${window.location.origin}${window.location.pathname}#/accept-invite?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
  }

  async function createManagerInvitation(){
    if(!inviteRestaurant)return;
    if(!inviteEmail.includes("@"))return alert("Enter a valid manager email.");
    setInviteBusy(true);
    try{
      const result=await createRestaurantInvite(inviteRestaurant.id,inviteEmail);
      setInviteLink(managerInviteUrl(result.invite_code,inviteEmail.trim().toLowerCase()));
    }catch(err){
      alert(err instanceof Error?err.message:"Could not create manager invitation.");
    }finally{
      setInviteBusy(false);
    }
  }

  return <div className="dashboard">
    <aside className="sidebar"><Brand/><nav>
      <button className="active"><Store size={19}/><span>Restaurants</span></button>
      <button><BarChart3 size={19}/><span>Analytics</span></button>
      <button><Settings size={19}/><span>Settings</span></button>
    </nav><div className="sidebar-footer"><div className="avatar">MG</div><span><strong>Menu Go</strong><small>Platform Admin</small></span></div></aside>

    <section className="dashboard-content">
      <header className="dash-header"><div><p className="eyebrow dark">MENU GO ADMIN</p><h1>Restaurants</h1></div>
        <div className="dash-header-actions">
          <button className="primary-button" onClick={()=>setOpen(true)}><Plus size={17}/> Add restaurant</button>
          <button className="ghost-button" onClick={async()=>{await signOut();nav("/login")}}><LogOut size={17}/> Sign out</button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Restaurants</span><Store size={20}/></div><strong>{restaurants.length}</strong><small>All tenants</small></div>
        <div className="stat-card"><div className="stat-top"><span>Active</span><Check size={20}/></div><strong>{restaurants.filter(r=>r.status==="active").length}</strong><small>Currently live</small></div>
        <div className="stat-card"><div className="stat-top"><span>Access model</span><Settings size={20}/></div><strong>Invite</strong><small>Managers join by email</small></div>
        <div className="stat-card"><div className="stat-top"><span>Public access</span><QrCode size={20}/></div><strong>QR</strong><small>No customer login</small></div>
      </div>

      <div className="panel">
        <div className="panel-heading"><div><h2>Restaurant tenants</h2><p>Create restaurants, manage them, and invite one restaurant manager by email.</p></div></div>
        {loading?<div className="empty-state">Loading…</div>:restaurants.map(r=><div className="restaurant-row" key={r.id}>
          <div className="restaurant-avatar"><Coffee/></div>
          <div><strong>{r.name}</strong><small>/{r.slug} · {r.address||"No address yet"}</small></div>
          <span className="status"><Check size={13}/> {r.status}</span>
          <Link className="tiny-button" to={`/r/${r.slug}`}><Eye size={14}/> Public</Link>
          <Link className="tiny-button" to={`/admin/${r.id}`}><Settings size={14}/> Manage</Link>
          <button className="tiny-button" onClick={()=>{setInviteRestaurant(r);setInviteEmail("");setInviteLink("")}}>Invite manager</button>
        </div>)}
      </div>
    </section>

    {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><div className="modal admin-modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow dark">NEW RESTAURANT</p><h3>Add restaurant</h3></div><button className="icon-button" onClick={()=>setOpen(false)}><X/></button></div>
      <div className="form-grid">
        <label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label>Slug<input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-")})} placeholder="restaurant-name"/></label>
        <label className="span-2">Tagline<input value={form.tagline} onChange={e=>setForm({...form,tagline:e.target.value})}/></label>
        <label className="span-2">Address<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
      </div>
      <button className="primary-button auth-submit" onClick={async()=>{
        try{
          await createRestaurantWithInvite(form);
          setOpen(false);setForm({name:"",slug:"",tagline:"",address:""});
          await refresh();
        }catch(err){alert(err instanceof Error?err.message:"Could not create restaurant.")}
      }}>Create restaurant</button>
    </div></div>}

    {inviteRestaurant&&<div className="modal-backdrop" onClick={()=>setInviteRestaurant(null)}><div className="modal invite-modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow dark">MANAGER ACCESS</p><h3>Invite {inviteRestaurant.name} manager</h3></div><button className="icon-button" onClick={()=>setInviteRestaurant(null)}><X/></button></div>
      {!inviteLink?<>
        <p>Enter the manager's email. Menu Go will create a secure one-time invitation link valid for 14 days.</p>
        <label>Manager email<input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="manager@restaurant.com"/></label>
        <button className="primary-button auth-submit" disabled={inviteBusy||!inviteEmail} onClick={createManagerInvitation}>{inviteBusy?"Creating…":"Create invitation"}</button>
      </>:<>
        <div className="invite-success"><Check size={20}/><strong>Invitation ready</strong></div>
        <p className="mono-url invite-link-text">{inviteLink}</p>
        <div className="invite-actions">
          <button className="primary-button" onClick={()=>navigator.clipboard.writeText(inviteLink)}>Copy invitation link</button>
          <a className="ghost-button" href={`mailto:${encodeURIComponent(inviteEmail)}?subject=${encodeURIComponent("You're invited to manage "+inviteRestaurant.name+" on Menu Go")}&body=${encodeURIComponent("You have been invited to manage "+inviteRestaurant.name+" on Menu Go. Open this secure invitation link to create your account:\n\n"+inviteLink+"\n\nThis invitation expires in 14 days.")}`}>Email invitation</a>
        </div>
        <p className="auth-help">For now, “Email invitation” opens your email app with the message prepared. Automatic transactional email can be connected when Menu Go gets its production domain/SMTP.</p>
      </>}
    </div></div>}
  </div>;
}

function App(){
  const specialPage=new URLSearchParams(window.location.search).get("page");
  if(specialPage==="reset-password")return <ResetPasswordPage/>;
  if(specialPage==="invite-confirm")return <InviteConfirmPage/>;
  if(specialPage==="setup-confirm")return <SetupConfirmPage/>;
  if(specialPage==="manager-confirm")return <ManagerConfirmPage/>;

  return <Routes>
    <Route path="/" element={<Navigate to="/r/abol-coffee" replace/>}/>
    <Route path="/demo" element={<Navigate to="/r/sora-table" replace/>}/>
    <Route path="/r/:slug" element={<CustomerPage/>}/>
    <Route path="/login" element={<AuthPage/>}/>
    <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
    <Route path="/accept-invite" element={<AcceptInvitePage/>}/>
    <Route path="/setup" element={<SetupPage/>}/>
    <Route path="/no-access" element={<NoAccessPage/>}/>
    <Route path="/preview-admin" element={<PreviewPlatformDashboard/>}/>
    <Route path="/preview-manager" element={<PreviewManagerDashboard/>}/>
    <Route path="/preview/platform" element={<PreviewGate role="admin"><PreviewPlatformDashboard/></PreviewGate>}/>
    <Route path="/preview/manager" element={<PreviewGate role="manager"><PreviewManagerDashboard/></PreviewGate>}/>
    <Route path="/admin" element={<Protected/>}/>
    <Route path="/admin/:restaurantId" element={<Protected/>}/>
    <Route path="/platform" element={<Protected platform/>}/>
    <Route path="*" element={<Navigate to="/r/abol-coffee" replace/>}/>
  </Routes>;
}
export default App;
