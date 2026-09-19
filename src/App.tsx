import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Coffee,
  Eye,
  Heart,
  Image as ImageIcon,
  Instagram,
  LayoutDashboard,
  MapPin,
  Menu as MenuIcon,
  MessageSquareText,
  Phone,
  Plus,
  QrCode,
  Search,
  Settings,
  Star,
  Store,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { categories as fallbackCategories, menuItems as fallbackMenuItems, restaurant as fallbackRestaurant, type MenuItem } from "./data/demo";
import { loadDemoRestaurant, submitFeedback, trackEvent } from "./lib/data";

function Brand() {
  return (
    <Link to="/demo" className="brand">
      <span className="brand-mark"><UtensilsCrossed size={18} /></span>
      <span>Menu Go</span>
    </Link>
  );
}

function CustomerPage() {
  const [category, setCategory] = useState("Popular");
  const [query, setQuery] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [restaurant, setRestaurant] = useState({
    ...fallbackRestaurant,
    id: "11111111-1111-4111-8111-111111111111",
    google_maps_url: "https://maps.google.com/?q=Addis+Ababa",
    google_review_url: null as string | null,
  });
  const [categories, setCategories] = useState(fallbackCategories);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(fallbackMenuItems);

  useEffect(() => {
    let active = true;
    loadDemoRestaurant()
      .then((data) => {
        if (!active || !data) return;
        setRestaurant({
          name: data.restaurant.name,
          tagline: data.restaurant.tagline ?? fallbackRestaurant.tagline,
          location: data.restaurant.address ?? fallbackRestaurant.location,
          hours: fallbackRestaurant.hours,
          currency: data.restaurant.currency,
          id: data.restaurant.id,
          google_maps_url: data.restaurant.google_maps_url ?? "https://maps.google.com/?q=Addis+Ababa",
          google_review_url: data.restaurant.google_review_url,
        });
        setCategories(data.categories);
        setMenuItems(data.items);
      })
      .catch(console.error);

    trackEvent("page_view");
    return () => { active = false; };
  }, []);

  const items = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = category === "Popular" ? item.popular : item.category === category;
      const text = (item.name + " " + item.description).toLowerCase();
      return matchesCategory && text.includes(query.toLowerCase());
    });
  }, [category, query]);

  return (
    <div className="customer-page">
      <header className="hero">
        <div className="hero-gradient" />
        <div className="hero-top"><span className="powered">Powered by <strong>Menu Go</strong></span></div>
        <div className="hero-copy">
          <div className="restaurant-logo"><Coffee size={28} /></div>
          <p className="eyebrow">DEMO RESTAURANT</p>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.tagline}</p>
          <span className="open-pill"><span /> {restaurant.hours}</span>
        </div>
      </header>

      <main className="customer-main">
        <section className="quick-actions" aria-label="Restaurant actions">
          <a className="action-card accent" href="#menu">
            <span className="action-icon"><MenuIcon size={22} /></span>
            <span><strong>View Menu</strong><small>Browse food & drinks</small></span>
            <ChevronRight size={20} />
          </a>
          <button className="action-card" onClick={() => {
            trackEvent("review_click");
            if (restaurant.google_review_url) window.open(restaurant.google_review_url, "_blank", "noopener,noreferrer");
            else alert("Demo restaurant: a real restaurant's Google Review link will open here.");
          }}>
            <span className="action-icon"><Star size={22} /></span>
            <span><strong>Leave a Review</strong><small>Share your experience</small></span>
            <ChevronRight size={20} />
          </button>
          <a className="action-card" href={restaurant.google_maps_url} onClick={() => trackEvent("directions_click")} target="_blank" rel="noreferrer">
            <span className="action-icon"><MapPin size={22} /></span>
            <span><strong>Directions</strong><small>{restaurant.location}</small></span>
            <ChevronRight size={20} />
          </a>
          <button className="action-card" onClick={() => { trackEvent("wifi_click"); setWifiOpen(true); }}>
            <span className="action-icon"><Wifi size={22} /></span>
            <span><strong>Wi-Fi</strong><small>Get connection details</small></span>
            <ChevronRight size={20} />
          </button>
          <button className="action-card" onClick={() => { trackEvent("feedback_open"); setFeedbackOpen(true); }}>
            <span className="action-icon"><MessageSquareText size={22} /></span>
            <span><strong>Private Feedback</strong><small>Tell the restaurant directly</small></span>
            <ChevronRight size={20} />
          </button>
        </section>

        <section id="menu" className="menu-section">
          <div className="section-heading">
            <div><p className="eyebrow dark">MENU</p><h2>What are you having?</h2></div>
            <span>{items.length} items</span>
          </div>

          <div className="search-box">
            <Search size={19} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes, drinks..." />
          </div>

          <div className="category-scroll">
            {categories.map((item) => (
              <button key={item} className={item === category ? "category active" : "category"} onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="menu-grid">
            {items.map((item) => (
              <article className="menu-item" key={item.id}>
                <img src={item.image} alt="" loading="lazy" />
                <div className="menu-item-body">
                  <div className="menu-item-title">
                    <h3>{item.name}</h3>
                    {item.popular && <span><Heart size={13} /> Popular</span>}
                  </div>
                  <p>{item.description}</p>
                  <strong>{item.price} {restaurant.currency}</strong>
                </div>
              </article>
            ))}
          </div>
          {items.length === 0 && <div className="empty-state">No items match your search.</div>}
        </section>

        <footer className="guest-footer">
          <Brand />
          <p>A simple digital guest experience for restaurants.</p>
          <div><Instagram size={18} /><Phone size={18} /></div>
        </footer>
      </main>

      {wifiOpen && (
        <div className="modal-backdrop" onClick={() => setWifiOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-icon"><Wifi /></span>
            <h3>Restaurant Wi-Fi</h3>
            <p>This is a demo. The real restaurant can display its network details here or simply tell guests to ask staff.</p>
            <button onClick={() => setWifiOpen(false)}>Done</button>
          </div>
        </div>
      )}

      {feedbackOpen && (
        <div className="modal-backdrop" onClick={() => setFeedbackOpen(false)}>
          <div className="modal feedback-modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-icon"><MessageSquareText /></span>
            <h3>Private feedback</h3>
            <p>Your message goes to the restaurant, not to a public review page.</p>
            <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Tell us about your experience..." rows={5} />
            <button onClick={async () => {
              try {
                await submitFeedback(feedbackText);
                setFeedbackText("");
                setFeedbackOpen(false);
                alert("Thank you. Your feedback was sent privately.");
              } catch (error) {
                alert(error instanceof Error ? error.message : "Could not send feedback.");
              }
            }}>Send feedback</button>
          </div>
        </div>
      )}
    </div>
  );
}

const statCards = [
  { label: "Menu views", value: "1,284", note: "+18% this month", icon: Eye },
  { label: "QR scans", value: "946", note: "74% table scans", icon: QrCode },
  { label: "Review clicks", value: "137", note: "10.7% of visitors", icon: Star },
  { label: "Feedback", value: "23", note: "4 need attention", icon: MessageSquareText },
];

function DashboardShell({ platform = false }: { platform?: boolean }) {
  const [selected, setSelected] = useState(platform ? "Restaurants" : "Overview");
  const nav = platform
    ? [["Restaurants", Store], ["Analytics", BarChart3], ["Plans", CircleHelp], ["Settings", Settings]]
    : [["Overview", LayoutDashboard], ["Menu", MenuIcon], ["Categories", UtensilsCrossed], ["Photos", ImageIcon], ["QR Codes", QrCode], ["Feedback", MessageSquareText], ["Settings", Settings]];

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand />
        <nav>
          {nav.map(([label, Icon]) => (
            <button key={label as string} onClick={() => setSelected(label as string)} className={selected === label ? "active" : ""}>
              <Icon size={19} /><span>{label as string}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{platform ? "MG" : "ST"}</div>
          <span><strong>{platform ? "Menu Go Admin" : "Sora Table"}</strong><small>{platform ? "Platform owner" : "Restaurant admin"}</small></span>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="dash-header">
          <div><p className="eyebrow dark">{platform ? "PLATFORM ADMIN" : "RESTAURANT ADMIN"}</p><h1>{selected}</h1></div>
          <div className="dash-header-actions">
            <Link to="/demo" className="ghost-button"><Eye size={17} /> View live menu</Link>
            <button className="primary-button"><Plus size={17} /> {platform ? "Add restaurant" : "Add item"}</button>
          </div>
        </header>

        {selected === "Overview" && !platform ? <RestaurantOverview /> :
         selected === "Menu" && !platform ? <MenuManager /> :
         selected === "QR Codes" && !platform ? <QrManager /> :
         selected === "Feedback" && !platform ? <FeedbackPanel /> :
         selected === "Restaurants" && platform ? <PlatformRestaurants /> :
         <ComingSoon title={selected} />}
      </section>
    </div>
  );
}

function RestaurantOverview() {
  return (
    <>
      <div className="stats-grid">
        {statCards.map(({ label, value, note, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <div className="stat-top"><span>{label}</span><Icon size={20} /></div>
            <strong>{value}</strong><small>{note}</small>
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-heading"><div><h2>Popular menu items</h2><p>Demo analytics</p></div><button>View report <ArrowRight size={15} /></button></div>
          {fallbackMenuItems.filter(i => i.popular).map((item, index) => (
            <div className="rank-row" key={item.id}>
              <span className="rank">{index + 1}</span><img src={item.image} alt="" />
              <div><strong>{item.name}</strong><small>{item.category}</small></div>
              <span>{[412, 367, 291, 244][index] ?? 198} views</span>
            </div>
          ))}
        </div>
        <div className="panel qr-mini">
          <div className="panel-heading"><div><h2>Your table QR</h2><p>One code, always current</p></div></div>
          <div className="qr-wrap"><QRCodeSVG value="https://yohannesmulugeta.github.io/Menu-Go/#/demo" size={158} /></div>
          <p>Guests scan this QR to open the live Menu Go page. Menu changes do not require reprinting.</p>
          <button className="secondary-button"><QrCode size={16} /> Download QR</button>
        </div>
      </div>
    </>
  );
}

function MenuManager() {
  return (
    <div className="panel">
      <div className="panel-heading"><div><h2>Menu items</h2><p>Edit prices, availability and descriptions.</p></div><button className="primary-button"><Plus size={16} /> Add item</button></div>
      <div className="table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Status</th><th /></tr></thead>
      <tbody>{fallbackMenuItems.map(item => <tr key={item.id}><td><div className="table-item"><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{item.description.slice(0, 42)}…</small></span></div></td><td>{item.category}</td><td>{item.price} ETB</td><td><span className="status"><Check size={13}/> Available</span></td><td><button className="tiny-button">Edit</button></td></tr>)}</tbody></table></div>
    </div>
  );
}

function QrManager() {
  return (
    <div className="panel centered-panel">
      <p className="eyebrow dark">PERMANENT QR</p><h2>One QR. Unlimited menu changes.</h2>
      <p>Print this on tables, receipts, takeaway packaging and counter cards. The destination stays the same when the restaurant updates its menu.</p>
      <div className="large-qr"><QRCodeSVG value="https://yohannesmulugeta.github.io/Menu-Go/#/demo" size={230} /></div>
      <button className="primary-button"><QrCode size={17}/> Download print QR</button>
    </div>
  );
}

function FeedbackPanel() {
  const feedback = [
    ["Loved the macchiato and service.", "Positive", "2 hours ago"],
    ["Please add more vegetarian options.", "Suggestion", "Yesterday"],
    ["The menu loaded very quickly.", "Positive", "2 days ago"],
  ];
  return <div className="panel"><div className="panel-heading"><div><h2>Private feedback</h2><p>Direct guest comments that are not public reviews.</p></div></div>
    {feedback.map(([body, tag, time]) => <div className="feedback-row" key={body}><MessageSquareText size={18}/><div><strong>{body}</strong><small>{time}</small></div><span>{tag}</span></div>)}
  </div>;
}

function PlatformRestaurants() {
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Active restaurants</span><Store size={20}/></div><strong>1</strong><small>Sora Table demo</small></div>
        <div className="stat-card"><div className="stat-top"><span>Total QR scans</span><QrCode size={20}/></div><strong>946</strong><small>Demo data</small></div>
        <div className="stat-card"><div className="stat-top"><span>Menu views</span><Eye size={20}/></div><strong>1,284</strong><small>Demo data</small></div>
        <div className="stat-card"><div className="stat-top"><span>Platform status</span><Check size={20}/></div><strong>Ready</strong><small>Demo environment</small></div>
      </div>
      <div className="panel">
        <div className="panel-heading"><div><h2>Restaurants</h2><p>Manage every restaurant from one place.</p></div></div>
        <div className="restaurant-row">
          <div className="restaurant-avatar"><Coffee /></div><div><strong>Sora Table</strong><small>menu-go/sora-table · Demo</small></div>
          <span className="status"><Check size={13}/> Active</span><Link to="/admin" className="tiny-button">Open admin</Link>
        </div>
      </div>
    </>
  );
}

function ComingSoon({ title }: { title: string }) {
  return <div className="panel coming-soon"><span className="modal-icon"><Settings /></span><h2>{title}</h2><p>The UI shell is ready. This section will connect to Supabase after the project is created.</p></div>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/demo" replace />} />
      <Route path="/demo" element={<CustomerPage />} />
      <Route path="/admin" element={<DashboardShell />} />
      <Route path="/platform" element={<DashboardShell platform />} />
      <Route path="*" element={<Navigate to="/demo" replace />} />
    </Routes>
  );
}

export default App;
