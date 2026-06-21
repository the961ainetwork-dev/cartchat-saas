// data.js — Prototype data layer for CartChat Admin
//
// ⚠️ PRODUCTION NOTE: This stores everything in browser localStorage under the key
// "cc_admin_db". This is a PROTOTYPE ONLY — data is per-browser, not shared across
// devices/users, and will be lost if the user clears their browser storage.
//
// To go to production, replace every AdminData.load()/save() call with real API
// calls to a backend (Supabase is recommended — see api/admin/*.js stubs for where
// to wire this in). For file uploads (CSV lists), use a real file storage service
// (Vercel Blob, S3, Supabase Storage) — the upload UI here reads the file client-side
// and stores parsed text only, since there is no server-side storage in this prototype.
//
// The shape of the data below maps directly to what your DB tables should look like:
//   customers      -> "customers" table
//   payments       -> "payments" table (foreign key: customerId, orderId)
//   orders         -> "broadcast_orders" table (foreign key: customerId)
//   segments       -> "audience_segments" table (admin-managed, the B2B/B2C category lists)
//   customerLists  -> "customer_lists" table (foreign key: submittedByCustomerId)

const AdminData = {
  KEY: "cc_admin_db",

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : this._empty();
    } catch {
      return this._empty();
    }
  },

  save(db) {
    localStorage.setItem(this.KEY, JSON.stringify(db));
  },

  _empty() {
    return { customers: [], payments: [], orders: [], segments: [], customerLists: [] };
  },

  // ── Segment category taxonomy (fixed reference data, not stored per-list) ──────
  SEGMENT_CATEGORIES: {
    B2B: [
      { key: "firmographic", label: "Firmographic", sub: "Company Attributes", desc: "Industry vertical, employee headcount, annual revenue, geographic focus, or operating model.", examples: ["FinTech / Media / Hospitality", "MENA region / GCC markets", "NGO vs. corporate"] },
      { key: "technographic", label: "Technographic", sub: "Technology Stack", desc: "Companies categorized by the tools, infrastructure, and architectures they currently employ.", examples: ["Legacy systems vs. cloud-native", "Agentic AI / multi-agent adopters"] },
      { key: "persona", label: "Persona & Role-Based", sub: "The Decision Makers", desc: "Targeting the specific leader, not just the company.", examples: ["High-net-worth diaspora investors", "Regional policy directors", "C-suite executives", "University innovation scouts"] },
      { key: "intent", label: "Intent & Lifecycle Stage", sub: "Active Behavior", desc: "Businesses segmented by what they are actively doing right now.", examples: ["Early-stage ventures seeking sandboxes", "Recently funded companies", "Enterprises scaling internationally"] },
    ],
    B2C: [
      { key: "demographic", label: "Demographic & Geographic", sub: "Fundamental Descriptors", desc: "The basic identity markers of your individual users.", examples: ["Age brackets", "Income levels", "Education", "Beirut residents vs. diaspora"] },
      { key: "behavioral", label: "Behavioral & Engagement", sub: "Platform Interaction", desc: "Grouped by how users interact with your digital platforms or content.", examples: ["Daily news-brief readers", "Cart abandoners", "Inactive subscribers", "Highly engaged sharers"] },
      { key: "psychographic", label: "Psychographic", sub: "Interests & Lifestyles", desc: "Categorized by values, hobbies, and worldview.", examples: ["Early tech adopters", "Smart-citizenship advocates", "Artisanal / local-product buyers", "Sports fans"] },
      { key: "transactional", label: "Transactional & Geospatial", sub: "Purchase & Location", desc: "Based on purchasing history or physical location interaction.", examples: ["High-frequency buyers", "Seasonal purchasers", "Foot-traffic / event-based segments"] },
    ],
  },

  seedIfEmpty() {
    const db = this.load();
    if (db.customers.length > 0) return;

    const now = Date.now();
    const day = 86400000;

    db.customers = [
      { id: "cust_1", name: "Nadine Fares", email: "nadine@lumierebeauty.com", store: "Lumière Beauty Store", plan: "Growth", status: "active", totalSpent: 537, joinedAt: now - 18*day },
      { id: "cust_2", name: "Omar Yassine", email: "omar@urbanthreads.com", store: "UrbanThreads", plan: "Starter", status: "active", totalSpent: 177, joinedAt: now - 11*day },
      { id: "cust_3", name: "Rana Haidar", email: "rana@technest.ae", store: "TechNest", plan: "Agency", status: "active", totalSpent: 1347, joinedAt: now - 29*day },
      { id: "cust_4", name: "Karim Saade", email: "karim@petpantry.com", store: "PetPantry", plan: "Growth", status: "trial", totalSpent: 0, joinedAt: now - 1*day },
      { id: "cust_5", name: "Lina Khalil", email: "lina@homestyleco.com", store: "HomeStyle Co", plan: "Starter", status: "trial", totalSpent: 0, joinedAt: now - 6*60*60*1000 },
    ];

    db.payments = [
      { id: "pay_1", customerName: "Nadine Fares", customerEmail: "nadine@lumierebeauty.com", method: "OMT Transfer", amount: 29, reference: "OMT-7741-2026", notes: "Sent via OMT branch Hamra", status: "paid", submittedAt: now - 17*day, orderId: null },
      { id: "pay_2", customerName: "Omar Yassine", customerEmail: "omar@urbanthreads.com", method: "Bank Transfer", amount: 26.10, reference: "TXN883920", notes: "2nd broadcast — 10% recurring discount applied", status: "paid", submittedAt: now - 10*day, orderId: null },
      { id: "pay_3", customerName: "Rana Haidar", customerEmail: "rana@technest.ae", method: "Cash on Delivery", amount: 29, reference: "—", notes: "Office pickup arranged", status: "paid", submittedAt: now - 28*day, orderId: null },
      { id: "pay_4", customerName: "Karim Saade", customerEmail: "karim@petpantry.com", method: "OMT Transfer", amount: 29, reference: "OMT-5512-2026", notes: "Awaiting confirmation from branch", status: "pending", submittedAt: now - 3*60*60*1000, orderId: null },
    ];

    db.orders = [
      { id: "ord_1", customerName: "Nadine Fares", customerEmail: "nadine@lumierebeauty.com", listType: "B2C", segmentCategory: "behavioral", segmentLabel: "Behavioral & Engagement", listName: "Summer Collection Customers", listContacts: "+961 70 111 222\n+961 71 222 333\n+961 76 333 444\n(247 more contacts)", message: "✨ Our Summer Glow Collection just dropped! 20% off this week only. Shop now: lumierebeauty.com/summer", status: "sent", submittedAt: now - 9*day },
      { id: "ord_2", customerName: "Omar Yassine", customerEmail: "omar@urbanthreads.com", listType: "B2B", segmentCategory: "firmographic", segmentLabel: "Firmographic", listName: "Wholesale Partners List", listContacts: "+961 3 444 555\n+961 71 555 666\n(18 more contacts)", message: "Hi! New wholesale catalog is ready for Q3. Reply for pricing sheet.", status: "approved", submittedAt: now - 2*day },
      { id: "ord_3", customerName: "Rana Haidar", customerEmail: "rana@technest.ae", listType: "B2C", segmentCategory: "transactional", segmentLabel: "Transactional & Geospatial", listName: "VIP Customer List", listContacts: "(uploaded file: vip_customers.csv — 512 contacts)", message: "🎉 TechNest VIP early access: new iPhone cases drop tomorrow at 9 AM. You get first dibs!", status: "pending", submittedAt: now - 5*60*60*1000 },
    ];

    db.segments = [
      { id: "seg_1", name: "General B2C Audience — Lebanon", type: "B2C", category: "demographic", count: 1840, notes: "Broad national consumer base, all age brackets", addedAt: now - 60*day, source: "Manually entered" },
      { id: "seg_2", name: "Retail Wholesalers — MENA", type: "B2B", category: "firmographic", count: 312, notes: "Wholesale & distribution companies across GCC + Levant", addedAt: now - 45*day, source: "Manually entered" },
      { id: "seg_3", name: "Early Tech Adopters — Beirut", type: "B2C", category: "psychographic", count: 940, notes: "Engaged with tech product launches in the last 6 months", addedAt: now - 30*day, source: "CSV upload: tech_adopters.csv" },
      { id: "seg_4", name: "C-Suite Decision Makers — GCC", type: "B2B", category: "persona", count: 156, notes: "Verified executive contacts, opted in via partner events", addedAt: now - 20*day, source: "CSV upload: csuite_gcc.csv" },
    ];

    db.customerLists = [
      { id: "clist_1", name: "Summer Collection Customers", type: "B2C", count: 250, submittedBy: "Nadine Fares", contacts: "+961 70 111 222\n+961 71 222 333\n+961 76 333 444\n+961 78 444 555\n... (246 more)", addedAt: now - 9*day },
      { id: "clist_2", name: "Wholesale Partners List", type: "B2B", count: 20, submittedBy: "Omar Yassine", contacts: "+961 3 444 555\n+961 71 555 666\n+961 76 666 777\n... (17 more)", addedAt: now - 2*day },
    ];

    this.save(db);
  },

  // ── Helper mutators used by customer-facing pages ──────────────────────────────

  addCustomer(customer) {
    const db = this.load();
    db.customers.push(customer);
    this.save(db);
  },

  addPayment(payment) {
    const db = this.load();
    db.payments.push(payment);
    this.save(db);
  },

  addOrder(order) {
    const db = this.load();
    db.orders.push(order);
    this.save(db);
  },

  addCustomerList(list) {
    const db = this.load();
    db.customerLists.push(list);
    this.save(db);
  },

  // ── Segment (house list) CRUD — used by Admin's Mailing List Manager ───────────

  getSegments() {
    return this.load().segments;
  },

  getSegmentsByType(type) {
    return this.load().segments.filter(s => s.type === type);
  },

  addSegment(segment) {
    const db = this.load();
    db.segments.push(segment);
    this.save(db);
    return segment;
  },

  updateSegment(id, updates) {
    const db = this.load();
    const seg = db.segments.find(s => s.id === id);
    if (!seg) return null;
    Object.assign(seg, updates);
    this.save(db);
    return seg;
  },

  deleteSegment(id) {
    const db = this.load();
    db.segments = db.segments.filter(s => s.id !== id);
    this.save(db);
  },

  // Simple text parser: counts non-empty lines as contacts.
  // Accepts raw text (already read from an uploaded file client-side).
  parseContactsText(text) {
    const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return { count: lines.length, contacts: lines.join("\n") };
  },
};
