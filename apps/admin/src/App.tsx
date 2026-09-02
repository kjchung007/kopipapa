import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ActivityLog, CustomerManagement, DangerZone, type CustomerRecord } from "./AdminControls";
import { WebsiteEditor } from "./WebsiteEditor";
import "./App.css";

type Page =
  | "overview"
  | "orders"
  | "menu"
  | "stores"
  | "customers"
  | "campaigns"
  | "rewards"
  | "activity"
  | "website"
  | "settings";
type Product = {
  id: number;
  name: string;
  category: string;
  categoryId?: number;
  description?: string;
  image?: string;
  price: number;
  available: boolean;
  sold: number;
  sizes: { name: string; price_delta_cents: number }[];
  temperatures: string[];
  toppings: { name: string; price_cents: number }[];
};
type Order = {
  id: string;
  dbId?: number;
  userId: string | null;
  customer: string;
  customerEmail: string;
  items: string;
  lines: { name: string; quantity: number }[];
  storeId: number | null;
  storeName: string;
  gross: number;
  discount: number;
  total: number;
  voucherTitle: string | null;
  upsellCount: number;
  paymentStatus: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  paymentMethod: "fpx" | "touch_n_go" | "cash" | "card" | null;
  status: "New" | "Preparing" | "Ready" | "Picked Up" | "Cancelled";
  time: string;
};
type Campaign = {
  id: number;
  title: string;
  body: string;
  image: string;
  active: boolean;
  sortOrder: number;
};
type ShopSettings = {
  shop_name: string;
  accepting_pickup: boolean;
  preparation_minutes: number;
  logo_url?: string;
};
type AdminIdentity = {
  role: "global_admin" | "store_manager" | "staff";
  storeId: number | null;
};
type Category = {
  id: number;
  name: string;
  image: string;
  active: boolean;
  displayOrder: number;
};
type Store = {
  id: number;
  name: string;
  address: string;
  phone: string;
  preparationMinutes: number;
  openingTime: string;
  closingTime: string;
  acceptingPickup: boolean;
  active: boolean;
};
type StaffMember = {
  userId: string;
  displayName: string;
  role: AdminIdentity["role"];
  storeId: number | null;
  active: boolean;
  email?: string;
};
type RewardSettings = {
  points_enabled: boolean;
  stamp_enabled: boolean;
  points_per_rm: number;
  stamp_threshold: number;
  stamp_reward_template_id: number | null;
};
type VoucherScope = "any_drink" | "category" | "product";
type VoucherTemplate = {
  id: number;
  title: string;
  description: string;
  voucherType: "buy_x_free_one" | "free_drink" | "amount_off";
  buyQuantity: number | null;
  buyScope: VoucherScope;
  buyCategoryIds: number[];
  buyProductIds: number[];
  freeQuantity: number;
  freeScope: VoucherScope;
  freeCategoryIds: number[];
  freeProductIds: number[];
  amountOffCents: number | null;
  validScope: VoucherScope;
  categoryId: number | null;
  productId: number | null;
  image: string;
  expiresAt: string | null;
  pointCost: number | null;
  availableInShop: boolean;
  active: boolean;
};
type VoucherCode = {
  id: number;
  voucherTemplateId: number;
  code: string;
  maxClaims: number;
  claimCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};
type VoucherClaim = {
  id: number;
  status: string;
  source: string;
  claimedAt: string;
  usedAt: string | null;
  title: string;
};
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabase = url && key ? createClient(url, key) : null;
function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [identity, setIdentity] = useState<AdminIdentity | null>(null),
    [checking, setChecking] = useState(true),
    [allowed, setAllowed] = useState(false);
  async function verify(candidate: User | null) {
    if (!supabase || !candidate) {
      setChecking(false);
      setAllowed(false);
      return;
    }
    const { data } = await supabase
      .from("staff")
      .select("role,store_id")
      .eq("user_id", candidate.id)
      .eq("active", true)
      .maybeSingle();
    if (!data) {
      await supabase.auth.signOut();
      setAllowed(false);
    } else {
      setUser(candidate);
      setIdentity({ role: data.role, storeId: data.store_id });
      setAllowed(true);
    }
    setChecking(false);
  }
  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }
    const guard = window.setTimeout(() => setChecking(false), 4000);
    supabase.auth
      .getUser()
      .then(({ data }) => verify(data.user))
      .catch(() => setChecking(false));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      const candidate = session?.user ?? null;
      window.setTimeout(() => void verify(candidate), 0);
    });
    return () => {
      window.clearTimeout(guard);
      data.subscription.unsubscribe();
    };
  }, []);
  if (checking)
    return (
      <div className="loading">
        <Seal />
        <p>Securing the counter…</p>
      </div>
    );
  if (!allowed)
    return (
      <Login
        enter={(u, nextIdentity) => {
          setUser(u);
          setIdentity(nextIdentity);
          setAllowed(true);
        }}
      />
    );
  return (
    <Shell
      user={user}
      identity={identity!}
      logout={async () => {
        if (supabase) await supabase.auth.signOut();
        setAllowed(false);
        setUser(null);
        setIdentity(null);
      }}
    />
  );
}
function Seal({ logo }: { logo?: string }) {
  return logo ? (
    <img className="seal seal-image" src={logo} alt="Shop logo" />
  ) : (
    <span className="seal">KP</span>
  );
}
function Login({
  enter,
}: {
  enter: (u: User, identity: AdminIdentity) => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!supabase) {
      setError("Admin authentication is not configured.");
      return;
    }
    setBusy(true);
    const { data, error: a } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (a || !data.user) {
      setError("That email or password is incorrect.");
      setBusy(false);
      return;
    }
    const { data: role } = await supabase
      .from("staff")
      .select("role,store_id")
      .eq("user_id", data.user.id)
      .eq("active", true)
      .maybeSingle();
    if (!role) {
      await supabase.auth.signOut();
      setError("This account does not have administrator access.");
      setBusy(false);
      return;
    }
    enter(data.user, { role: role.role, storeId: role.store_id });
  }
  return (
    <main className="login">
      <section className="login-world">
        <Brand />
        <div>
          <h1>The shop, clearly in hand.</h1>
          <p>
            Manage today’s menu, service and customer experience from one
            private workspace.
          </p>
        </div>
        <footer>
          <span>Single-shop operations</span>
          <strong>Asia / Singapore</strong>
        </footer>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <span className="mobile-seal">
            <Seal />
          </span>
          <h2>Admin sign in</h2>
          <p>Use the administrator account configured in Supabase.</p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Checking access…" : "Enter admin dashboard"}
            <Icon>
              <path d="m9 18 6-6-6-6" />
            </Icon>
          </button>
          <small>
            <Icon size={15}>
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </Icon>
            Credentials are verified by Supabase and never stored in this app.
          </small>
        </form>
      </section>
    </main>
  );
}
function Brand() {
  return (
    <span className="brand">
      <Seal />
      <span>
        <strong>Kopi Papa</strong>
        <small>Admin workspace</small>
      </span>
    </span>
  );
}

function Shell({
  user,
  identity,
  logout,
}: {
  user: User | null;
  identity: AdminIdentity;
  logout: () => void;
}) {
  const [page, setPage] = useState<Page>("overview"),
    [products, setProducts] = useState<Product[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [stores, setStores] = useState<Store[]>([]),
    [team, setTeam] = useState<StaffMember[]>([]),
    [customers, setCustomers] = useState<CustomerRecord[]>([]),
    [rewardSettings, setRewardSettings] = useState<RewardSettings>({
      points_enabled: true,
      stamp_enabled: false,
      points_per_rm: 10,
      stamp_threshold: 8,
      stamp_reward_template_id: null,
    }),
    [vouchers, setVouchers] = useState<VoucherTemplate[]>([]),
    [voucherCodes, setVoucherCodes] = useState<VoucherCode[]>([]),
    [voucherClaims, setVoucherClaims] = useState<VoucherClaim[]>([]),
    [settings, setSettings] = useState<ShopSettings>({
      shop_name: "Kopi Papa Main Shop",
      accepting_pickup: true,
      preparation_minutes: 8,
    }),
    [edit, setEdit] = useState<Product | null>(null),
    [search, setSearch] = useState(""),
    [contextStoreId, setContextStoreId] = useState<number | null>(
      identity.role === "global_admin" ? null : identity.storeId,
    );

  useEffect(() => {
    async function load() {
      let orderQuery = supabase!
        .from("orders")
        .select(
          "id,order_number,user_id,customer_name,customer_email,total_cents,subtotal,discount_amount,final_total,voucher_title,upsell_item_count,payment_status,payment_method,status,created_at,store_id,stores(name),order_items(quantity,product_name)",
        )
        .order("created_at", { ascending: false });
      if (identity.role === "store_manager" && identity.storeId)
        orderQuery = orderQuery.eq("store_id", identity.storeId);
      const [
        { data: p, error: productLoadError },
        { data: o },
        { data: c },
        { data: s },
        { data: cats },
        { data: branches },
        { data: people },
        { data: profileRows },
        { data: rewardConfig },
        { data: rewardRows },
        { data: codeRows },
        { data: claimRows },
      ] = await Promise.all([
        supabase!
          .from("products")
          .select(
            "id,name,description,price_cents,image_url,available,sold,category_id,size_options,temperature_options,topping_options,categories(name)",
          )
          .order("sort_order"),
        orderQuery,
        supabase!
          .from("campaigns")
          .select("id,title,body,image_url,active,sort_order")
          .order("sort_order"),
        supabase!
          .from("shop_settings")
          .select("shop_name,accepting_pickup,preparation_minutes,logo_url")
          .eq("id", true)
          .single(),
        supabase!
          .from("categories")
          .select("id,name,image_url,active,display_order")
          .order("display_order"),
        supabase!
          .from("stores")
          .select(
            "id,name,address,phone,preparation_minutes,opening_time,closing_time,accepting_pickup,active",
          )
          .order("name"),
        supabase!
          .from("staff")
          .select("user_id,display_name,role,store_id,active")
          .order("display_name"),
        supabase!
          .from("profiles")
          .select("user_id,display_name,phone,created_at")
          .order("created_at", { ascending: false }),
        supabase!
          .from("reward_settings")
          .select(
            "points_enabled,stamp_enabled,points_per_rm,stamp_threshold,stamp_reward_template_id",
          )
          .eq("id", true)
          .single(),
        supabase!
          .from("voucher_templates")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase!
          .from("voucher_codes")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase!
          .from("user_vouchers")
          .select(
            "id,status,source,claimed_at,used_at,voucher_templates(title)",
          )
          .order("claimed_at", { ascending: false })
          .limit(100),
      ]);
      let productRows: any[] | null = p as any[] | null;
      if (productLoadError) {
        console.warn(
          "Extended menu options are not available yet; loading the existing catalog.",
          productLoadError.message,
        );
        const { data: legacyProducts, error: legacyProductError } =
          await supabase!
            .from("products")
            .select(
              "id,name,description,price_cents,image_url,available,sold,category_id,categories(name)",
            )
            .order("sort_order");
        if (legacyProductError)
          console.error("Menu products could not be loaded.", legacyProductError);
        productRows = legacyProducts;
      }
      let branchStock: Map<number, boolean> | null = null;
      if (identity.role === "store_manager" && identity.storeId) {
        const { data: stock } = await supabase!
          .from("store_product_availability")
          .select("product_id,available")
          .eq("store_id", identity.storeId);
        branchStock = new Map(
          (stock ?? []).map((row) => [row.product_id, row.available]),
        );
      }
      if (productRows)
        setProducts(
          productRows.map((x: any) => ({
            id: x.id,
            name: x.name,
            description: x.description,
            image: x.image_url,
            category: x.categories?.name ?? "Other",
            categoryId: x.category_id,
            price: x.price_cents / 100,
            available: branchStock?.get(x.id) ?? x.available,
            sold: x.sold ?? 0,
            sizes: x.size_options ?? [{ name: "Regular", price_delta_cents: 0 }],
            temperatures: x.temperature_options ?? ["Iced"],
            toppings: x.topping_options ?? [],
          })),
        );
      if (o)
        setOrders(
          o.map((x: any) => ({
            id: x.order_number,
            dbId: x.id,
            userId: x.user_id,
            customer: x.customer_name,
            customerEmail: x.customer_email ?? "",
            items: `${(x.order_items ?? []).reduce((n: number, i: any) => n + i.quantity, 0)} items`,
            lines: (x.order_items ?? []).map((i: any) => ({
              name: i.product_name,
              quantity: i.quantity,
            })),
            storeId: x.store_id,
            storeName:
              (Array.isArray(x.stores) ? x.stores[0]?.name : x.stores?.name) ??
              "Unknown store",
            gross: (x.subtotal ?? x.total_cents) / 100,
            discount: (x.discount_amount ?? 0) / 100,
            total: (x.final_total ?? x.total_cents) / 100,
            voucherTitle: x.voucher_title ?? null,
            upsellCount: x.upsell_item_count ?? 0,
            paymentStatus: x.payment_status ?? "pending",
            paymentMethod: x.payment_method ?? null,
            status:
              x.status === "new"
                ? "New"
                : x.status === "preparing"
                  ? "Preparing"
                  : x.status === "ready"
                    ? "Ready"
                    : x.status === "cancelled"
                      ? "Cancelled"
                      : "Picked Up",
            time: new Date(x.created_at).toLocaleString(),
          })),
        );
      if (c)
        setCampaigns(
          c.map((x: any) => ({
            id: x.id,
            title: x.title,
            body: x.body,
            image: x.image_url ?? "",
            active: x.active,
            sortOrder: x.sort_order,
          })),
        );
      if (s) setSettings(s);
      if (cats)
        setCategories(
          cats.map((x: any) => ({
            id: x.id,
            name: x.name,
            image: x.image_url ?? "",
            active: x.active,
            displayOrder: x.display_order,
          })),
        );
      if (branches)
        setStores(
          branches.map((x: any) => ({
            id: x.id,
            name: x.name,
            address: x.address,
            phone: x.phone ?? "",
            preparationMinutes: x.preparation_minutes,
            openingTime: x.opening_time?.slice(0, 5) ?? "10:00",
            closingTime: x.closing_time?.slice(0, 5) ?? "22:00",
            acceptingPickup: x.accepting_pickup,
            active: x.active,
          })),
        );
      if (people)
        setTeam(
          people.map((x: any) => ({
            userId: x.user_id,
            displayName: x.display_name ?? "Unnamed",
            role: x.role,
            storeId: x.store_id,
            active: x.active,
          })),
        );
      if (profileRows) {
        const customerStats = new Map<string, { orders: number; spend: number; lastOrder: string; email: string }>();
        for (const order of o ?? []) {
          if (!order.user_id) continue;
          const current = customerStats.get(order.user_id) ?? { orders: 0, spend: 0, lastOrder: order.created_at, email: order.customer_email ?? "" };
          customerStats.set(order.user_id, {
            orders: current.orders + 1,
            spend: current.spend + ((order.final_total ?? order.total_cents) / 100),
            lastOrder: current.lastOrder > order.created_at ? current.lastOrder : order.created_at,
            email: current.email || order.customer_email || "",
          });
        }
        setCustomers(profileRows.map((profile: any) => {
          const stats = customerStats.get(profile.user_id) ?? { orders: 0, spend: 0, lastOrder: "", email: "" };
          return { userId: profile.user_id, name: profile.display_name || stats.email.split("@")[0] || "Customer", email: stats.email, phone: profile.phone ?? "", orders: stats.orders, spend: stats.spend, lastOrder: stats.lastOrder ? new Date(stats.lastOrder).toLocaleString() : "" };
        }));
      }
      if (rewardConfig) setRewardSettings(rewardConfig as RewardSettings);
      if (rewardRows)
        setVouchers(
          rewardRows.map((x: any) => ({
            id: x.id,
            title: x.title,
            description: x.description ?? "",
            voucherType: x.voucher_type,
            buyQuantity: x.buy_quantity,
            buyScope: x.buy_scope ?? x.valid_scope,
            buyCategoryIds:
              x.buy_category_ids ?? (x.category_id ? [x.category_id] : []),
            buyProductIds:
              x.buy_product_ids ?? (x.product_id ? [x.product_id] : []),
            freeQuantity: x.free_quantity ?? 1,
            freeScope: x.free_scope ?? x.valid_scope,
            freeCategoryIds:
              x.free_category_ids ?? (x.category_id ? [x.category_id] : []),
            freeProductIds:
              x.free_product_ids ?? (x.product_id ? [x.product_id] : []),
            amountOffCents: x.amount_off_cents,
            validScope: x.valid_scope,
            categoryId: x.category_id,
            productId: x.product_id,
            image: x.image_url ?? "",
            expiresAt: x.expires_at,
            pointCost: x.point_cost,
            availableInShop: x.available_in_shop,
            active: x.active,
          })),
        );
      if (codeRows)
        setVoucherCodes(
          codeRows.map((x: any) => ({
            id: x.id,
            voucherTemplateId: x.voucher_template_id,
            code: x.code,
            maxClaims: x.max_claims,
            claimCount: x.claim_count,
            expiresAt: x.expires_at,
            active: x.active,
            createdAt: x.created_at,
          })),
        );
      if (claimRows)
        setVoucherClaims(
          claimRows.map((x: any) => ({
            id: x.id,
            status: x.status,
            source: x.source,
            claimedAt: x.claimed_at,
            usedAt: x.used_at,
            title:
              (Array.isArray(x.voucher_templates)
                ? x.voucher_templates[0]?.title
                : x.voucher_templates?.title) ?? "Voucher",
          })),
        );
    }
    load();
    const channel = supabase!
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        load,
      )
      .subscribe();
    return () => {
      supabase!.removeChannel(channel);
    };
  }, [identity.role, identity.storeId]);

  async function saveProduct(item: Product) {
    item = {
      ...item,
      sizes: item.sizes.map((entry) => ({ ...entry, name: entry.name.trim() })).filter((entry) => entry.name),
      temperatures: item.temperatures.map((entry) => entry.trim()).filter(Boolean),
      toppings: item.toppings.map((entry) => ({ ...entry, name: entry.name.trim() })).filter((entry) => entry.name),
    };
    if (!item.sizes.length) throw new Error("Add at least one size.");
    if (!item.temperatures.length) throw new Error("Choose at least one temperature.");
    const categoryId = categories.find(
      (category) => category.name === item.category,
    )?.id;
    if (!categoryId) throw new Error("Choose a valid category before saving.");
    item = { ...item, categoryId };
    const payload = {
      name: item.name,
      description: item.description ?? "",
      price_cents: Math.round(item.price * 100),
      available: item.available,
      category_id: categoryId,
      image_url: item.image ?? null,
      size_options: item.sizes,
      temperature_options: item.temperatures,
      topping_options: item.toppings,
    };
    if (products.some((p) => p.id === item.id)) {
      const { error } = await supabase!
        .from("products")
        .update(payload)
        .eq("id", item.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase!
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      item = { ...item, id: data!.id, categoryId };
    }
    setProducts((p) =>
      p.some((i) => i.id === item.id)
        ? p.map((i) => (i.id === item.id ? item : i))
        : [item, ...p],
    );
    setEdit(null);
  }
  const allNav: [Page, string, ReactNode][] = [
    [
      "overview",
      "Overview",
      <>
        <rect x="4" y="4" width="6" height="6" />
        <rect x="14" y="4" width="6" height="6" />
        <rect x="4" y="14" width="6" height="6" />
        <rect x="14" y="14" width="6" height="6" />
      </>,
    ],
    [
      "orders",
      "Orders",
      <>
        <path d="M6 3h12v18H6z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>,
    ],
    [
      "menu",
      identity.role === "global_admin" ? "Menu Management" : "Stock",
      <path key="menu-icon" d="M5 5h14M5 12h14M5 19h14" />,
    ],
    [
      "stores",
      "Stores",
      <>
        <path d="M4 10h16M5 10l1-5h12l1 5M6 10v9h12v-9" />
      </>,
    ],
    [
      "customers",
      "Customers",
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 6c2 .3 3 1.5 3 3.2S18 12 16.5 12.5" />
      </>,
    ],
    [
      "campaigns",
      "Campaigns",
      <>
        <path d="m4 13 12-5v10L4 13Z" />
        <path d="M7 14v5h4v-3" />
      </>,
    ],
    [
      "rewards",
      "Rewards",
      <>
        <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-4 0-5-5-2-5 2 0 2 3 2 5Zm0 0c4 0 5-5 2-5-2 0-2 3-2 5Z" />
      </>,
    ],
    [
      "activity",
      "Activity Log",
      <>
        <path d="M4 5h16v14H4zM8 9h8M8 13h5" />
        <path d="M16 16h.01" />
      </>,
    ],
    [
      "website",
      "Website Editor",
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 9v11" />
      </>,
    ],
    [
      "settings",
      "Settings",
      <>
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="9" />
      </>,
    ],
  ];
  const nav = allNav.filter(
    ([id]) =>
      identity.role === "global_admin" ||
      !(
        ["stores", "customers", "campaigns", "rewards", "activity", "website", "settings"] as Page[]
      ).includes(id),
  );
  const effectiveStoreId =
    identity.role === "global_admin" ? contextStoreId : identity.storeId;
  const visibleOrders = effectiveStoreId
    ? orders.filter((order) => order.storeId === effectiveStoreId)
    : orders;
  const liveOrderCount = visibleOrders.filter(
    (order) =>
      order.paymentStatus === "paid" &&
      ["New", "Preparing", "Ready"].includes(order.status),
  ).length;
  const contextStore = stores.find((store) => store.id === effectiveStoreId);
  const contextLabel = contextStore?.name ?? "All Stores";
  const heads = {
    overview: ["Good afternoon", "Here is how Kopi Papa is moving today."],
    orders: ["Live orders", "Keep the counter moving without losing context."],
    menu: [
      "Menu Management",
      "Manage products and customer-facing categories together.",
    ],
    stores: [
      "Stores",
      "Choose a branch, then manage its settings and assigned team.",
    ],
    customers: [
      "Customers",
      "Understand returning guests without overreaching.",
    ],
    campaigns: ["Campaigns", "Shape what customers see on Home."],
    rewards: [
      "Rewards",
      "Configure loyalty, vouchers and one-time campaign codes.",
    ],
    activity: ["Activity Log", "Review every privileged change across the workspace."],
    website: ["Website Editor", "Build, preview and publish the Kopi Papa brand website."],
    settings: ["Shop settings", "Control the single-shop operating defaults."],
  }[page];
  if (page === "website" && supabase) {
    return <WebsiteEditor client={supabase} onExit={() => setPage("overview")} />;
  }
  return (
    <div className="shell">
      <aside className="admin-navigation">
        <button className="brand-button" onClick={() => setPage("overview")}>
          <span className="brand">
            <Seal logo={settings.logo_url} />
            <span>
              <strong>{settings.shop_name}</strong>
              <small>Admin workspace</small>
            </span>
          </span>
        </button>
        <nav>
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon>{icon}</Icon>
              {label}
              {id === "orders" && liveOrderCount > 0 && <b>{liveOrderCount}</b>}
            </button>
          ))}
        </nav>
        <div className="operator">
          <span>{(user?.email?.[0] ?? "A").toUpperCase()}</span>
          <div>
            <strong>
              {identity.role === "global_admin"
                ? "Global admin"
                : identity.role === "store_manager"
                  ? "Store manager"
                  : "Staff"}
            </strong>
            <small>{user?.email}</small>
          </div>
          <button onClick={logout} aria-label="Sign out">
            <Icon>
              <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
            </Icon>
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <div>
            <h1>{heads[0]}</h1>
            <p>{heads[1]}</p>
          </div>
          <div className="header-tools">
            <label
              className={`store-context ${identity.role === "global_admin" ? "" : "assigned-store"}`}
            >
              <span>Showing data for</span>
              {identity.role === "global_admin" ? (
                <select
                  value={contextStoreId ?? ""}
                  onChange={(event) =>
                    setContextStoreId(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                >
                  <option value="">All Stores</option>
                  {stores.map((store) => (
                    <option value={store.id} key={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{contextLabel}</strong>
              )}
            </label>
            <label>
              <Icon size={18}>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </Icon>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  page === "orders"
                    ? "Search order or customer"
                    : "Search workspace"
                }
              />
            </label>
            <button
              aria-label="View active orders"
              onClick={() => setPage("orders")}
            >
              <Icon>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </Icon>
              {liveOrderCount > 0 && <i />}
            </button>
          </div>
        </header>
        <div className="content">
          {page === "overview" && (
            <Overview
              orders={visibleOrders}
              products={products}
              settings={settings}
              go={setPage}
              contextLabel={contextLabel}
            />
          )}{" "}
          {page === "orders" && (
            <Orders
              orders={visibleOrders}
              allOrders={orders}
              update={setOrders}
              search={search}
              contextLabel={contextLabel}
            />
          )}{" "}
          {page === "menu" && (
            <MenuManagement
              products={products}
              update={setProducts}
              edit={setEdit}
              search={search}
              identity={identity}
              categories={categories}
              setCategories={setCategories}
            />
          )}{" "}
          {page === "stores" && (
            <StoreManagement
              identity={identity}
              stores={stores}
              setStores={setStores}
              team={team}
              setTeam={setTeam}
            />
          )}{" "}
          {page === "customers" && supabase && (
            <CustomerManagement client={supabase} customers={customers} vouchers={vouchers} onCustomerDeleted={(id) => setCustomers((current) => current.filter((customer) => customer.userId !== id))} />
          )}{" "}
          {page === "campaigns" && (
            <Campaigns campaigns={campaigns} setCampaigns={setCampaigns} />
          )}{" "}
          {page === "rewards" && (
            <RewardsManagement
              settings={rewardSettings}
              setSettings={setRewardSettings}
              vouchers={vouchers}
              setVouchers={setVouchers}
              codes={voucherCodes}
              setCodes={setVoucherCodes}
              claims={voucherClaims}
              products={products}
              categories={categories}
            />
          )}{" "}
          {page === "settings" && (
            <Settings settings={settings} setSettings={setSettings} client={supabase} showSystemReset={identity.role === "global_admin"} />
          )}
          {page === "activity" && supabase && <ActivityLog client={supabase} />}
        </div>
      </main>
      {edit && (
        <Editor
          item={edit}
          categories={categories}
          close={() => setEdit(null)}
          save={saveProduct}
        />
      )}
    </div>
  );
}

function Overview({
  orders,
  products,
  settings,
  go,
  contextLabel,
}: {
  orders: Order[];
  products: Product[];
  settings: ShopSettings;
  go: (p: Page) => void;
  contextLabel: string;
}) {
  const grossSales = orders.reduce((sum, order) => sum + order.gross, 0),
    netSales = orders.reduce((sum, order) => sum + order.total, 0),
    average = orders.length ? netSales / orders.length : 0;
  const productSales = new Map<string, number>();
  orders.forEach((order) =>
    order.lines.forEach((line) =>
      productSales.set(
        line.name,
        (productSales.get(line.name) ?? 0) + line.quantity,
      ),
    ),
  );
  const topProducts = [...products]
    .sort(
      (a, b) =>
        (productSales.get(b.name) ?? 0) - (productSales.get(a.name) ?? 0),
    )
    .slice(0, 5);
  const voucherUses = new Map<string, { uses: number; discount: number }>();
  orders.forEach((order) => {
    if (!order.voucherTitle) return;
    const current = voucherUses.get(order.voucherTitle) ?? {
      uses: 0,
      discount: 0,
    };
    voucherUses.set(order.voucherTitle, {
      uses: current.uses + 1,
      discount: current.discount + order.discount,
    });
  });
  const voucherPerformance = [...voucherUses.entries()].sort(
    (a, b) => b[1].uses - a[1].uses,
  );
  const upsellOrders = orders.filter((order) => order.upsellCount > 0).length,
    upsellConversion = orders.length ? (upsellOrders / orders.length) * 100 : 0;
  return (
    <>
      <div className="data-context">
        <span>Showing data for</span>
        <strong>{contextLabel}</strong>
      </div>
      <section className="day">
        <div>
          <Icon>
            <path d="M4 7h16v13H4zM8 3v4M16 3v4M4 11h16" />
          </Icon>
          <span>
            <small>
              {new Intl.DateTimeFormat("en-MY", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </small>
            <strong>
              {settings.accepting_pickup
                ? "Open · accepting pickup orders"
                : "Pickup ordering is paused"}
            </strong>
          </span>
        </div>
        <button onClick={() => go("settings")}>
          Shop controls{" "}
          <Icon size={16}>
            <path d="m9 18 6-6-6-6" />
          </Icon>
        </button>
      </section>
      <section className="metrics">
        <article>
          <span>Gross revenue</span>
          <strong>RM {grossSales.toFixed(2)}</strong>
          <small>Before voucher discounts</small>
        </article>
        <article>
          <span>Net revenue</span>
          <strong>RM {netSales.toFixed(2)}</strong>
          <small>After voucher discounts</small>
        </article>
        <article>
          <span>Orders today</span>
          <strong>{orders.length}</strong>
          <small>
            {new Set(orders.map((order) => order.customer)).size} customers
          </small>
        </article>
        <article>
          <span>Average order</span>
          <strong>RM {average.toFixed(2)}</strong>
          <small>Across recorded orders</small>
        </article>
        <article>
          <span>Upsell conversion</span>
          <strong>{upsellConversion.toFixed(1)}%</strong>
          <small>{upsellOrders} orders added a recommendation</small>
        </article>
      </section>
      <section className="overview-grid">
        <div className="panel">
          <PanelHead
            title="Counter right now"
            copy={`${orders.length} active pickup ${orders.length === 1 ? "order" : "orders"}`}
            action="View all"
            click={() => go("orders")}
          />
          {orders.map((o) => (
            <div className="order-line" key={o.id}>
              <i className={o.status.toLowerCase()} />
              <strong>{o.id}</strong>
              <span>{o.customer}</span>
              <small>{o.items}</small>
              <b>{o.status}</b>
              <time>{o.time}</time>
            </div>
          ))}
        </div>
        <div className="panel">
          <PanelHead
            title="Top sellers"
            copy="Products currently available"
            action="Manage menu"
            click={() => go("menu")}
          />
          {topProducts.map((p, i) => (
            <div className="seller" key={p.id}>
              <span>{i + 1}</span>
              <div>
                <strong>{p.name}</strong>
                <small>{p.category}</small>
              </div>
              <b>{productSales.get(p.name) ?? 0} sold</b>
            </div>
          ))}
        </div>
        <div className="panel voucher-performance-panel">
          <PanelHead
            title="Voucher performance"
            copy={`${voucherPerformance.reduce((sum, [, value]) => sum + value.uses, 0)} redemptions`}
          />
          {voucherPerformance.length ? (
            voucherPerformance.map(([title, value]) => (
              <div className="voucher-performance-row" key={title}>
                <div>
                  <strong>{title}</strong>
                  <small>RM {value.discount.toFixed(2)} total discount</small>
                </div>
                <b>{value.uses} used</b>
              </div>
            ))
          ) : (
            <div className="admin-empty-row">
              Voucher usage will appear after the first discounted order.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
function PanelHead({
  title,
  copy,
  action,
  click,
}: {
  title: string;
  copy: string;
  action?: string;
  click?: () => void;
}) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {action && click && <button onClick={click}>{action}</button>}
    </div>
  );
}
function Orders({
  orders,
  allOrders,
  update,
  search,
  contextLabel,
}: {
  orders: Order[];
  allOrders: Order[];
  update: (o: Order[]) => void;
  search: string;
  contextLabel: string;
}) {
  const [view, setView] = useState<"live" | "history">("live");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const paymentLabel = (method: Order["paymentMethod"]) =>
    method === "touch_n_go"
      ? "Touch ’n Go"
      : method === "fpx"
        ? "FPX online banking"
        : method === "cash"
          ? "Cash"
          : method === "card"
            ? "Card at counter"
            : "Not selected";
  const needle = search.trim().toLowerCase();
  const liveStatuses: Order["status"][] = ["New", "Preparing", "Ready"];
  const historyStatuses: Order["status"][] = ["Picked Up", "Cancelled"];
  const viewOrders = orders.filter((order) =>
    (view === "live" ? liveStatuses : historyStatuses).includes(order.status),
  );
  const filtered = viewOrders.filter(
    (order) =>
      (statusFilter === "all" || order.status === statusFilter) &&
      (!needle ||
        order.id.toLowerCase().includes(needle) ||
        order.customer.toLowerCase().includes(needle) ||
        order.customerEmail.toLowerCase().includes(needle)),
  );
  async function next(id: string) {
    const target = allOrders.find((o) => o.id === id);
    const nextStatus =
      target?.status === "New"
        ? "Preparing"
        : target?.status === "Preparing"
          ? "Ready"
          : "Picked Up";
    const dbStatus =
      nextStatus === "Picked Up" ? "completed" : nextStatus.toLowerCase();
    if (target?.dbId)
      await supabase!
        .from("orders")
        .update({ status: dbStatus, updated_at: new Date().toISOString() })
        .eq("id", target.dbId);
    update(
      allOrders.map((o) => (o.id === id ? { ...o, status: nextStatus } : o)),
    );
  }
  async function cancel(id: string) {
    const target = allOrders.find((o) => o.id === id);
    if (target?.dbId)
      await supabase!
        .from("orders")
        .update({ status: "cancelled", payment_status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", target.dbId);
    update(
      allOrders.map((o) => (o.id === id ? { ...o, status: "Cancelled", paymentStatus: "cancelled" } : o)),
    );
  }
  async function setPaymentStatus(id: string, paymentStatus: Order["paymentStatus"]) {
    const target = allOrders.find((o) => o.id === id);
    if (target?.dbId) {
      const { error } = await supabase!.from("orders").update({
        payment_status: paymentStatus,
        paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", target.dbId);
      if (error) return;
    }
    update(allOrders.map((o) => o.id === id ? { ...o, paymentStatus } : o));
  }
  return (
    <section className="panel data">
      <div className="tabs">
        <div>
          <button
            className={view === "live" ? "active" : ""}
            onClick={() => {
              setView("live");
              setStatusFilter("all");
            }}
          >
            Live Orders{" "}
            <b>
              {
                orders.filter((order) => liveStatuses.includes(order.status))
                  .length
              }
            </b>
          </button>
          <button
            className={view === "history" ? "active" : ""}
            onClick={() => {
              setView("history");
              setStatusFilter("all");
            }}
          >
            Order History{" "}
            <b>
              {
                orders.filter((order) => historyStatuses.includes(order.status))
                  .length
              }
            </b>
          </button>
        </div>
        <label className="order-status-filter">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {(view === "live" ? liveStatuses : historyStatuses).map(
              (status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <p className="order-context-label">
        Showing data for: <strong>{contextLabel}</strong>
      </p>
      <div className="order-table order-summary-head th">
        <span>Order</span>
        <span>Customer</span>
        <span>Total</span>
        <span>Payment</span>
        <span>Status</span>
        <span>Received</span>
        <span />
      </div>
      {filtered.map((o) => (
        <article className={`order-entry ${expandedId === o.id ? "expanded" : ""}`} key={o.id}>
          <div className="order-table order-summary-row">
            <strong>{o.id}</strong>
            <span className="order-customer"><strong>{o.customer}</strong><small>{o.lines.reduce((sum, line) => sum + line.quantity, 0)} items</small></span>
            <strong>RM {o.total.toFixed(2)}</strong>
            <span className={`payment-state ${o.paymentStatus}`}>{o.paymentStatus === "pending" ? "Verifying" : o.paymentStatus}</span>
            <span className={`status ${o.status.toLowerCase()}`}>{o.status}</span>
            <time>{o.time}</time>
            <button className="order-expand" aria-expanded={expandedId === o.id} onClick={() => setExpandedId(current => current === o.id ? null : o.id)}>{expandedId === o.id ? "Close" : "Details"}<Icon size={15}><path d="m7 10 5 5 5-5" /></Icon></button>
          </div>
          <div className="order-expand-shell" aria-hidden={expandedId !== o.id} inert={expandedId !== o.id ? true : undefined}>
            <div className="order-expanded-content">
              <div className="order-detail-grid">
                <section><span>Customer</span><strong>{o.customer}</strong><small>{o.customerEmail || "Email unavailable"}</small></section>
                <section><span>Pickup branch</span><strong>{o.storeName || contextLabel}</strong><small>Received {o.time}</small></section>
                <section><span>Payment</span><strong>{paymentLabel(o.paymentMethod)}</strong><small>Gross RM {o.gross.toFixed(2)} · Discount RM {o.discount.toFixed(2)}</small></section>
              </div>
              <div className="order-item-list"><span>Order items</span>{o.lines.length ? o.lines.map((line, index) => <div key={`${o.id}-${line.name}-${index}`}><strong>{line.quantity}×</strong><span>{line.name}</span></div>) : <p>{o.items || "No item details available"}</p>}</div>
              <div className="order-expanded-actions">
                <label><span>Payment status</span><select aria-label={`Update payment status for ${o.id}`} value={o.paymentStatus} onChange={(event) => void setPaymentStatus(o.id,event.target.value as Order["paymentStatus"])}><option value="pending">Verifying</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option><option value="cancelled">Cancelled</option></select></label>
                <div><button className="cancel-order" disabled={["Picked Up", "Cancelled"].includes(o.status)} onClick={() => cancel(o.id)}>Cancel order</button><button className="primary" disabled={["Picked Up", "Cancelled"].includes(o.status)} title={o.paymentStatus === "pending" ? "Manual acceptance while payment is being verified" : undefined} onClick={() => next(o.id)}>{o.status === "New" ? "Accept order" : o.status === "Preparing" ? "Mark ready" : o.status === "Ready" ? "Mark picked up" : "Completed"}</button></div>
              </div>
            </div>
          </div>
        </article>
      ))}
      {!filtered.length && (
        <div className="empty-state">
          <strong>
            No matching {view === "live" ? "live" : "past"} orders
          </strong>
          <span>
            Try another order number, customer name, email, or status.
          </span>
        </div>
      )}
    </section>
  );
}
function MenuManagement({
  products,
  update,
  edit,
  search,
  identity,
  categories,
  setCategories,
}: {
  products: Product[];
  update: (items: Product[]) => void;
  edit: (item: Product) => void;
  search: string;
  identity: AdminIdentity;
  categories: Category[];
  setCategories: (items: Category[]) => void;
}) {
  const [section, setSection] = useState<"items" | "categories">("items");
  if (identity.role !== "global_admin")
    return (
      <Menu
        products={products}
        update={update}
        edit={edit}
        search={search}
        identity={identity}
      />
    );
  return (
    <div className="management-stack">
      <nav className="section-switch" aria-label="Menu management sections">
        <button
          className={section === "items" ? "active" : ""}
          onClick={() => setSection("items")}
        >
          Menu items <b>{products.length}</b>
        </button>
        <button
          className={section === "categories" ? "active" : ""}
          onClick={() => setSection("categories")}
        >
          Categories <b>{categories.length}</b>
        </button>
      </nav>
      {section === "items" ? (
        <Menu
          products={products}
          update={update}
          edit={edit}
          search={search}
          identity={identity}
        />
      ) : (
        <Categories categories={categories} setCategories={setCategories} />
      )}
    </div>
  );
}
function Menu({
  products,
  update,
  edit,
  search,
  identity,
}: {
  products: Product[];
  update: (p: Product[]) => void;
  edit: (p: Product) => void;
  search: string;
  identity: AdminIdentity;
}) {
  const canManageMaster = identity.role === "global_admin";
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");
  async function removeProduct(product: Product) {
    if (
      !canManageMaster ||
      !window.confirm(
        `Delete “${product.name}” from the master menu?\n\nIt will disappear from every store. Historical order receipts will be kept.`,
      )
    )
      return;
    setDeletingId(product.id);
    setDeleteError("");
    const { error } = await supabase!
      .from("products")
      .delete()
      .eq("id", product.id);
    if (error)
      setDeleteError(`Could not delete ${product.name}. ${error.message}`);
    else update(products.filter((item) => item.id !== product.id));
    setDeletingId(null);
  }
  return (
    <section className="panel data">
      <div className="tabs">
        <div>
          <button className="active">
            All items <b>{products.length}</b>
          </button>
        </div>
        {canManageMaster && (
          <button
            className="primary"
            onClick={() =>
              edit({
                id: Date.now(),
                name: "New menu item",
                category: "Popular",
                price: 0,
                available: true,
                sold: 0,
                sizes: [{ name: "Regular", price_delta_cents: 0 }],
                temperatures: ["Iced", "Hot"],
                toppings: [],
              })
            }
          >
            + Add item
          </button>
        )}
      </div>
      {deleteError && (
        <div className="menu-error" role="alert">
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError("")}
            aria-label="Dismiss delete error"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="menu-table th">
        <span>Item</span>
        <span>Category</span>
        <span>Price</span>
        <span>Availability</span>
        <span>Sold</span>
        <span />
      </div>
      {products
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
        .map((p) => (
          <div className="menu-table" key={p.id}>
            <div className="product">
              {p.image ? (
                <img src={p.image} alt="" />
              ) : (
                <span>{p.name.slice(0, 2).toUpperCase()}</span>
              )}
              <strong>{p.name}</strong>
            </div>
            <span>{p.category}</span>
            <strong>RM {p.price.toFixed(2)}</strong>
            <label className="switch">
              <input
                type="checkbox"
                checked={p.available}
                onChange={async () => {
                  const available = !p.available;
                  if (canManageMaster) {
                    await supabase!
                      .from("products")
                      .update({
                        available,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", p.id);
                  } else if (identity.storeId) {
                    await supabase!
                      .from("store_product_availability")
                      .upsert(
                        {
                          store_id: identity.storeId,
                          product_id: p.id,
                          available,
                          updated_at: new Date().toISOString(),
                        },
                        { onConflict: "store_id,product_id" },
                      );
                  }
                  update(
                    products.map((x) =>
                      x.id === p.id ? { ...x, available } : x,
                    ),
                  );
                }}
              />
              <i />
              <span>{p.available ? "Available" : "Sold out"}</span>
            </label>
            <span>{p.sold}</span>
            {canManageMaster ? (
              <div className="menu-actions">
                <button onClick={() => edit(p)} disabled={deletingId === p.id}>
                  Edit
                </button>
                <button
                  className="delete-item"
                  onClick={() => removeProduct(p)}
                  disabled={deletingId === p.id}
                >
                  {deletingId === p.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            ) : (
              <span>Branch stock</span>
            )}
          </div>
        ))}
    </section>
  );
}
function Categories({
  categories,
  setCategories,
}: {
  categories: Category[];
  setCategories: (items: Category[]) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null),
    [error, setError] = useState("");
  async function save(item: Category) {
    setBusy(item.id);
    setError("");
    const { error: e } = await supabase!
      .from("categories")
      .update({
        name: item.name,
        image_url: item.image || null,
        active: item.active,
        display_order: item.displayOrder,
        sort_order: item.displayOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (e) setError(e.message);
    setBusy(null);
  }
  async function add() {
    const next = Math.max(0, ...categories.map((x) => x.displayOrder)) + 1;
    const { data, error: e } = await supabase!
      .from("categories")
      .insert({
        name: `New category ${next}`,
        display_order: next,
        sort_order: next,
        active: true,
      })
      .select("id,name,image_url,active,display_order")
      .single();
    if (e) {
      setError(e.message);
      return;
    }
    setCategories([
      ...categories,
      {
        id: data.id,
        name: data.name,
        image: data.image_url ?? "",
        active: data.active,
        displayOrder: data.display_order,
      },
    ]);
  }
  async function upload(item: Category, file: File) {
    setBusy(item.id);
    const path = `categories/${item.id}-${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "-")}`;
    const { error: e } = await supabase!.storage
      .from("public-assets")
      .upload(path, file, { contentType: file.type });
    if (e) {
      setError(e.message);
      setBusy(null);
      return;
    }
    const { data } = supabase!.storage.from("public-assets").getPublicUrl(path);
    const updated = { ...item, image: data.publicUrl };
    setCategories(categories.map((x) => (x.id === item.id ? updated : x)));
    await save(updated);
  }
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const copy = [...categories],
      [a, b] = [copy[index], copy[target]];
    copy[index] = { ...b, displayOrder: a.displayOrder };
    copy[target] = { ...a, displayOrder: b.displayOrder };
    setCategories(copy);
    await Promise.all(
      copy.filter((x) => x.id === a.id || x.id === b.id).map(save),
    );
  }
  return (
    <section className="panel data management">
      <div className="tabs">
        <div>
          <button className="active">
            Customer menu rail <b>{categories.length}</b>
          </button>
        </div>
        <button className="primary" onClick={add}>
          + Add category
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="management-list">
        {categories.map((item, index) => (
          <article key={item.id}>
            <label className="management-image">
              {item.image ? (
                <img src={item.image} alt="" />
              ) : (
                <span>{item.name.slice(0, 1)}</span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(item, file);
                }}
              />
              <b>Change image</b>
            </label>
            <label>
              Name
              <input
                value={item.name}
                onChange={(e) =>
                  setCategories(
                    categories.map((x) =>
                      x.id === item.id ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label className="setting-check compact">
              <span>
                <strong>Visible</strong>
                <small>Show in customer menu</small>
              </span>
              <input
                type="checkbox"
                checked={item.active}
                onChange={(e) =>
                  setCategories(
                    categories.map((x) =>
                      x.id === item.id ? { ...x, active: e.target.checked } : x,
                    ),
                  )
                }
              />
            </label>
            <div className="row-actions">
              <button disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button
                disabled={index === categories.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                className="primary"
                disabled={busy === item.id}
                onClick={() => save(item)}
              >
                {busy === item.id ? "Saving…" : "Save"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function StoreManagement({
  identity,
  stores,
  setStores,
  team,
  setTeam,
}: {
  identity: AdminIdentity;
  stores: Store[];
  setStores: (items: Store[]) => void;
  team: StaffMember[];
  setTeam: (items: StaffMember[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
      stores[0]?.id ?? 0,
    ),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (selectedId === 0 && stores[0]) setSelectedId(stores[0].id);
  }, [selectedId, stores]);
  const selected = stores.find((store) => store.id === selectedId) ?? null;
  function change(patch: Partial<Store>) {
    if (!selected) return;
    setStores(
      stores.map((store) =>
        store.id === selected.id ? { ...store, ...patch } : store,
      ),
    );
  }
  function add() {
    const draft: Store = {
      id: -Date.now(),
      name: "New branch",
      address: "",
      phone: "",
      preparationMinutes: 8,
      openingTime: "10:00",
      closingTime: "22:00",
      acceptingPickup: false,
      active: true,
    };
    setStores([...stores, draft]);
    setSelectedId(draft.id);
  }
  async function save() {
    if (!selected) return;
    setError("");
    setSaved(false);
    if (!selected.openingTime || !selected.closingTime) {
      setError("Choose both opening and closing times.");
      return;
    }
    const payload = {
      name: selected.name,
      address: selected.address,
      phone: selected.phone || null,
      preparation_minutes: selected.preparationMinutes,
      opening_time: selected.openingTime,
      closing_time: selected.closingTime,
      accepting_pickup: selected.acceptingPickup,
      active: selected.active,
      updated_at: new Date().toISOString(),
    };
    if (selected.id < 0) {
      const { data, error: saveError } = await supabase!
        .from("stores")
        .insert(payload)
        .select("id")
        .single();
      if (saveError) {
        setError(saveError.message);
        return;
      }
      setStores(
        stores.map((store) =>
          store.id === selected.id ? { ...selected, id: data.id } : store,
        ),
      );
      setSelectedId(data.id);
    } else {
      const { error: saveError } = await supabase!
        .from("stores")
        .update(payload)
        .eq("id", selected.id);
      if (saveError) {
        setError(saveError.message);
        return;
      }
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }
  return (
    <div className="store-master-detail">
      <section className="panel store-master">
        <div className="tabs">
          <div>
            <button className="active">
              Locations <b>{stores.length}</b>
            </button>
          </div>
          <button className="primary" onClick={add}>
            + Add store
          </button>
        </div>
        <div className="store-master-list">
          {stores.map((store) => (
            <button
              key={store.id}
              className={store.id === selectedId ? "active" : ""}
              onClick={() => setSelectedId(store.id)}
            >
              <span className="store-avatar">
                {store.name.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>{store.name}</strong>
                <small>{store.address || "Address required"}</small>
              </span>
              <b>{store.acceptingPickup ? "Open" : "Paused"}</b>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <div className="store-detail">
          <section className="panel settings-card store-settings">
            <div className="detail-heading">
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Back to stores"
              >
                <Icon>
                  <path d="m15 18-6-6 6-6" />
                </Icon>
              </button>
              <span>
                <h2>{selected.id < 0 ? "Create store" : selected.name}</h2>
                <p>Branch details and pickup controls</p>
              </span>
            </div>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <label>
              Store name
              <input
                value={selected.name}
                onChange={(event) => change({ name: event.target.value })}
              />
            </label>
            <label>
              Address
              <textarea
                value={selected.address}
                onChange={(event) => change({ address: event.target.value })}
              />
            </label>
            <div className="pair">
              <label>
                Phone
                <input
                  value={selected.phone}
                  onChange={(event) => change({ phone: event.target.value })}
                />
              </label>
              <label>
                Prep minutes
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={selected.preparationMinutes}
                  onChange={(event) =>
                    change({ preparationMinutes: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="store-hours">
              <h3>Opening hours</h3>
              <p>
                These times are shown to customers and control ordering for this
                branch.
              </p>
              <div className="pair">
                <label>
                  Opens
                  <input
                    type="time"
                    required
                    value={selected.openingTime}
                    onChange={(event) =>
                      change({ openingTime: event.target.value })
                    }
                  />
                </label>
                <label>
                  Closes
                  <input
                    type="time"
                    required
                    value={selected.closingTime}
                    onChange={(event) =>
                      change({ closingTime: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <label className="setting-check">
              <span>
                <strong>Accept pickup orders</strong>
                <small>Controls this branch only.</small>
              </span>
              <input
                type="checkbox"
                checked={selected.acceptingPickup}
                onChange={(event) =>
                  change({ acceptingPickup: event.target.checked })
                }
              />
            </label>
            <label className="setting-check">
              <span>
                <strong>Active location</strong>
                <small>Visible in customer store selection.</small>
              </span>
              <input
                type="checkbox"
                checked={selected.active}
                onChange={(event) => change({ active: event.target.checked })}
              />
            </label>
            <button className="primary" onClick={save}>
              {saved ? "Saved" : "Save store"}
            </button>
          </section>
          {selected.id > 0 && (
            <Team
              key={selected.id}
              identity={identity}
              stores={[selected]}
              team={team.filter((person) => person.storeId === selected.id)}
              reload={(next) =>
                setTeam([
                  ...team.filter((person) => person.storeId !== selected.id),
                  ...next,
                ])
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
function Team({
  identity,
  stores,
  team,
  reload,
}: {
  identity: AdminIdentity;
  stores: Store[];
  team: StaffMember[];
  reload: (items: StaffMember[]) => void;
}) {
  const allowedStores =
      identity.role === "global_admin"
        ? stores
        : stores.filter((x) => x.id === identity.storeId),
    defaultStore = allowedStores[0]?.id ?? 0;
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [storeId, setStoreId] = useState(defaultStore),
    [role, setRole] = useState<"store_manager" | "staff">(
      identity.role === "global_admin" ? "store_manager" : "staff",
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!storeId && defaultStore) setStoreId(defaultStore);
  }, [defaultStore, storeId]);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase!.functions.invoke(
      "create-staff-account",
      { body: { email, password, displayName: name, role, storeId } },
    );
    if (error || !data?.userId) {
      setMessage(data?.error ?? error?.message ?? "Unable to create account.");
    } else {
      reload([
        ...team,
        {
          userId: data.userId,
          displayName: name,
          role,
          storeId,
          active: true,
          email,
        },
      ]);
      setEmail("");
      setPassword("");
      setName("");
      setMessage("Account created successfully.");
    }
    setBusy(false);
  }
  async function toggle(person: StaffMember) {
    const active = !person.active;
    const { error } = await supabase!
      .from("staff")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("user_id", person.userId);
    if (error) {
      setMessage(error.message);
      return;
    }
    reload(
      team.map((x) => (x.userId === person.userId ? { ...x, active } : x)),
    );
  }
  async function remove(person: StaffMember) {
    if (!window.confirm(`Permanently delete ${person.displayName}'s team account? This also removes their Supabase login.`)) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase!.functions.invoke("admin-control", {
      body: { action: "delete_staff", targetId: person.userId },
    });
    if (error || data?.error) setMessage(data?.error ?? error?.message ?? "Unable to delete account.");
    else {
      reload(team.filter((x) => x.userId !== person.userId));
      setMessage("Team account permanently deleted.");
    }
    setBusy(false);
  }
  return (
    <div className="team-layout">
      <form className="panel settings-card" onSubmit={create}>
        <h2>Create team account</h2>
        <p>
          {identity.role === "global_admin"
            ? "Managers are locked to their selected branch."
            : "You can create staff only for your branch."}
        </p>
        {message && (
          <div
            className={message.includes("success") ? "success" : "error"}
            role="status"
          >
            {message}
          </div>
        )}
        <label>
          Full name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Temporary password
          <input
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {identity.role === "global_admin" && (
          <label>
            Role
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "store_manager" | "staff")
              }
            >
              <option value="store_manager">Store manager</option>
              <option value="staff">Staff</option>
            </select>
          </label>
        )}
        <label>
          Store
          <select
            value={storeId}
            onChange={(e) => setStoreId(Number(e.target.value))}
          >
            {allowedStores.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={busy || !storeId}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <section className="panel data">
        <PanelHead
          title="Current team"
          copy={`${team.length} authorized accounts`}
        />
        <div className="team-list">
          {team.map((person) => (
            <div key={person.userId}>
              <span className="store-avatar">
                {person.displayName.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>{person.displayName}</strong>
                <small>
                  {person.role.replace("_", " ")} ·{" "}
                  {stores.find((x) => x.id === person.storeId)?.name ??
                    "All stores"}
                </small>
              </span>
              <span className="team-actions">
                <button
                  disabled={
                    person.userId ===
                    team.find((x) => x.role === "global_admin")?.userId
                  }
                  onClick={() => toggle(person)}
                >
                  {person.active ? "Deactivate" : "Activate"}
                </button>
                {identity.role === "global_admin" && (
                  <button className="team-delete" disabled={busy} onClick={() => void remove(person)}>
                    Delete
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function Campaigns({
  campaigns,
  setCampaigns,
}: {
  campaigns: Campaign[];
  setCampaigns: (c: Campaign[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
      campaigns[0]?.id ?? null,
    ),
    [device, setDevice] = useState<"mobile" | "desktop">("mobile"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const selected =
    campaigns.find((item) => item.id === selectedId) ?? campaigns[0] ?? null;
  function change(patch: Partial<Campaign>) {
    if (selected) {
      setSaved(false);
      setCampaigns(
        campaigns.map((item) =>
          item.id === selected.id ? { ...item, ...patch } : item,
        ),
      );
    }
  }
  function add() {
    const draft: Campaign = {
      id: -Date.now(),
      title: "New campaign",
      body: "Add a short message for customers.",
      image: "",
      active: false,
      sortOrder: Math.max(0, ...campaigns.map((item) => item.sortOrder)) + 1,
    };
    setCampaigns([draft, ...campaigns]);
    setSelectedId(draft.id);
    setError("");
    setSaved(false);
  }
  async function upload(file: File) {
    if (!selected) return;
    if (file.size > 1_500_000) {
      setError("Image is larger than 1.5 MB. Compress it and try again.");
      return;
    }
    setBusy(true);
    setError("");
    const path = `campaigns/${Math.abs(selected.id)}-${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "-")}`;
    const { error: uploadError } = await supabase!.storage
      .from("public-assets")
      .upload(path, file, { contentType: file.type });
    if (uploadError) setError(uploadError.message);
    else {
      const { data } = supabase!.storage
        .from("public-assets")
        .getPublicUrl(path);
      change({ image: data.publicUrl });
    }
    setBusy(false);
  }
  async function save() {
    if (!selected) return;
    if (!selected.title.trim()) {
      setError("Add a campaign title before saving.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    const payload = {
      title: selected.title.trim(),
      body: selected.body.trim(),
      image_url: selected.image || null,
      active: selected.active,
      sort_order: selected.sortOrder,
      updated_at: new Date().toISOString(),
    };
    if (selected.id < 0) {
      const { data, error: saveError } = await supabase!
        .from("campaigns")
        .insert(payload)
        .select("id")
        .single();
      if (saveError) setError(saveError.message);
      else {
        setCampaigns(
          campaigns.map((item) =>
            item.id === selected.id ? { ...selected, id: data.id } : item,
          ),
        );
        setSelectedId(data.id);
        setSaved(true);
      }
    } else {
      const { error: saveError } = await supabase!
        .from("campaigns")
        .update(payload)
        .eq("id", selected.id);
      if (saveError) setError(saveError.message);
      else setSaved(true);
    }
    setBusy(false);
  }
  async function remove() {
    if (
      !selected ||
      !window.confirm(
        `Remove “${selected.title}”? This campaign will disappear from customer Home.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    if (selected.id > 0) {
      const { error: removeError } = await supabase!
        .from("campaigns")
        .delete()
        .eq("id", selected.id);
      if (removeError) {
        setError(removeError.message);
        setBusy(false);
        return;
      }
    }
    const remaining = campaigns.filter((item) => item.id !== selected.id);
    setCampaigns(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    setBusy(false);
  }
  return (
    <section className="campaign-workspace">
      <aside className="panel campaign-list">
        <div className="tabs">
          <div>
            <button className="active">
              Home campaigns <b>{campaigns.length}</b>
            </button>
          </div>
          <button className="primary" onClick={add}>
            + Add New
          </button>
        </div>
        {campaigns.map((item) => (
          <button
            key={item.id}
            className={item.id === selected?.id ? "active" : ""}
            onClick={() => setSelectedId(item.id)}
          >
            <span>
              {item.image ? <img src={item.image} alt="" /> : <b>KP</b>}
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.active ? "Published" : "Hidden"}</small>
            </span>
          </button>
        ))}
        {!campaigns.length && (
          <div className="empty-state">
            <strong>No campaigns yet</strong>
            <span>Add your first Home banner.</span>
          </div>
        )}
      </aside>
      <div className="campaign-editor">
        <section className="panel campaign-guide">
          <h2>Campaign image guide</h2>
          <p>
            Use one wide image with the important subject near the centre so it
            survives both crops.
          </p>
          <dl>
            <div>
              <dt>Canvas</dt>
              <dd>1600 × 900 px</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>WebP, JPEG or PNG</dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>1.5 MB maximum</dd>
            </div>
            <div>
              <dt>Safe area</dt>
              <dd>
                Keep text out of the image and the subject inside the centre 900
                × 700 px
              </dd>
            </div>
          </dl>
        </section>
        {selected ? (
          <>
            <section className="panel campaign-form">
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <div className="campaign-form-head">
                <div>
                  <h2>
                    {selected.id < 0 ? "Create campaign" : "Edit campaign"}
                  </h2>
                  <p>Customer-facing copy and publication state</p>
                </div>
                <button
                  className="campaign-delete"
                  onClick={remove}
                  disabled={busy}
                >
                  Remove
                </button>
              </div>
              <label>
                Campaign title
                <input
                  value={selected.title}
                  maxLength={70}
                  onChange={(event) => change({ title: event.target.value })}
                />
              </label>
              <label>
                Short message
                <textarea
                  rows={3}
                  maxLength={180}
                  value={selected.body}
                  onChange={(event) => change({ body: event.target.value })}
                />
              </label>
              <label className="campaign-upload">
                Banner image
                <span>
                  {selected.image ? (
                    <img src={selected.image} alt="Current campaign banner" />
                  ) : (
                    <b>No banner uploaded</b>
                  )}
                  <b>{busy ? "Working…" : "Choose image"}</b>
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload(file);
                  }}
                />
              </label>
              <label className="setting-check">
                <span>
                  <strong>Published on Home</strong>
                  <small>Customers can see this campaign immediately.</small>
                </span>
                <input
                  type="checkbox"
                  checked={selected.active}
                  onChange={(event) => change({ active: event.target.checked })}
                />
              </label>
              <button
                className="primary campaign-save"
                onClick={save}
                disabled={busy}
              >
                {busy ? "Saving…" : saved ? "Saved" : "Save campaign"}
              </button>
            </section>
            <section className="panel preview-panel">
              <div className="preview-head">
                <span>
                  <h2>Device preview</h2>
                  <p>Shows the same crop used on customer Home.</p>
                </span>
                <div>
                  <button
                    className={device === "mobile" ? "active" : ""}
                    onClick={() => setDevice("mobile")}
                  >
                    Mobile
                  </button>
                  <button
                    className={device === "desktop" ? "active" : ""}
                    onClick={() => setDevice("desktop")}
                  >
                    Desktop
                  </button>
                </div>
              </div>
              <div className={`campaign-device ${device}`}>
                <article
                  style={
                    selected.image
                      ? {
                          backgroundImage: `linear-gradient(90deg,rgba(8,17,60,.88),rgba(8,17,60,.16)),url(${selected.image})`,
                        }
                      : undefined
                  }
                >
                  <div>
                    <span>Featured</span>
                    <h3>{selected.title || "Campaign title"}</h3>
                    <p>{selected.body || "Campaign message"}</p>
                    <b>Browse menu</b>
                  </div>
                </article>
              </div>
            </section>
          </>
        ) : (
          <section className="panel empty-state">
            <strong>Select or create a campaign</strong>
            <span>Campaign settings and previews will appear here.</span>
          </section>
        )}
      </div>
    </section>
  );
}
function Settings({
  settings,
  setSettings,
  client,
  showSystemReset,
}: {
  settings: ShopSettings;
  setSettings: (s: ShopSettings) => void;
  client: SupabaseClient | null;
  showSystemReset: boolean;
}) {
  const [saved, setSaved] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  async function upload(file: File) {
    setUploading(true);
    setError("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `logos/shop-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase!.storage
      .from("public-assets")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase!.storage.from("public-assets").getPublicUrl(path);
    const next = { ...settings, logo_url: data.publicUrl };
    const { error: updateError } = await supabase!
      .from("shop_settings")
      .update({
        logo_url: data.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (updateError) setError(updateError.message);
    else setSettings(next);
    setUploading(false);
  }
  async function save() {
    setError("");
    const { error } = await supabase!
      .from("shop_settings")
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  return (
    <div className="settings">
      <section className="panel settings-card">
        <h2>Shop operations</h2>
        <p>These values will control availability and customer estimates.</p>
        <label className="image-picker">
          Shop logo
          <span>
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Current shop logo" />
            ) : (
              <Seal />
            )}
            <b>{uploading ? "Uploading…" : "Choose image"}</b>
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <label>
          Shop name
          <input
            value={settings.shop_name}
            onChange={(e) =>
              setSettings({ ...settings, shop_name: e.target.value })
            }
          />
        </label>
        <label>
          Preparation estimate
          <select
            value={settings.preparation_minutes}
            onChange={(e) =>
              setSettings({
                ...settings,
                preparation_minutes: Number(e.target.value),
              })
            }
          >
            <option value="5">5 minutes</option>
            <option value="8">8 minutes</option>
            <option value="10">10 minutes</option>
          </select>
        </label>
        <label className="setting-check">
          <span>
            <strong>Accept pickup orders</strong>
            <small>Pause online ordering when needed.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.accepting_pickup}
            onChange={(e) =>
              setSettings({ ...settings, accepting_pickup: e.target.checked })
            }
          />
        </label>
        <button className="primary" onClick={save}>
          {saved ? "Saved" : "Save shop settings"}
        </button>
      </section>
      <section className="panel settings-card">
        <h2>Admin security</h2>
        <p>Credentials are managed by Supabase Auth, never this frontend.</p>
        <div className="security">
          <Icon>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </Icon>
          <span>
            <strong>Password and email</strong>
            <small>Change through Supabase Authentication.</small>
          </span>
        </div>
        <div className="security">
          <Icon>
            <path d="M12 3 4 6v5c0 5 3.2 8.5 8 10 4.8-1.5 8-5 8-10V6l-8-3Z" />
            <path d="m9 12 2 2 4-4" />
          </Icon>
          <span>
            <strong>Database authorization</strong>
            <small>Protected by the admin allowlist.</small>
          </span>
        </div>
      </section>
      {showSystemReset && client && <DangerZone client={client} />}
    </div>
  );
}
function Editor({
  item,
  categories,
  close,
  save,
}: {
  item: Product;
  categories: Category[];
  close: () => void;
  save: (p: Product) => Promise<void>;
}) {
  const [d, setD] = useState(item),
    [uploading, setUploading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const updateSize = (index: number, patch: Partial<Product["sizes"][number]>) =>
    setD({ ...d, sizes: d.sizes.map((entry, position) => position === index ? { ...entry, ...patch } : entry) });
  const updateTopping = (index: number, patch: Partial<Product["toppings"][number]>) =>
    setD({ ...d, toppings: d.toppings.map((entry, position) => position === index ? { ...entry, ...patch } : entry) });
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [close]);
  async function upload(file: File) {
    setUploading(true);
    setError("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `products/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "-")}.${ext}`;
    const { error: uploadError } = await supabase!.storage
      .from("public-assets")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase!.storage.from("public-assets").getPublicUrl(path);
    setD({ ...d, image: data.publicUrl });
    setUploading(false);
  }
  return (
    <div
      className="modal-wrap"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        className="modal"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            await save(d);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to save this item.",
            );
            setSaving(false);
          }
        }}
      >
        <button type="button" className="close" onClick={close}>
          ×
        </button>
        <h2>Edit menu item</h2>
        <p>Changes are saved to the live customer menu.</p>
        <label className="image-picker">
          Item image
          <span>
            {d.image ? (
              <img src={d.image} alt="Menu item preview" />
            ) : (
              <b>No image selected</b>
            )}
            <b>{uploading ? "Uploading…" : "Choose image"}</b>
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <label>
          Product name
          <input
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            value={d.description ?? ""}
            onChange={(e) => setD({ ...d, description: e.target.value })}
            rows={3}
            placeholder="Describe the drink, flavour, and key ingredients."
          />
        </label>
        <div className="pair">
          <label>
            Category
            <select
              value={d.category}
              onChange={(e) => {
                const category = categories.find(
                  (item) => item.name === e.target.value,
                );
                setD({
                  ...d,
                  category: e.target.value,
                  categoryId: category?.id,
                });
              }}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Price (RM)
            <input
              type="number"
              min="0"
              step=".1"
              value={d.price}
              onChange={(e) => setD({ ...d, price: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="setting-check">
          <span>
            <strong>Available to order</strong>
            <small>Customers can add this item.</small>
          </span>
          <input
            type="checkbox"
            checked={d.available}
            onChange={(e) => setD({ ...d, available: e.target.checked })}
          />
        </label>
        <section className="product-options-editor">
          <div className="option-editor-heading">
            <div><strong>Sizes</strong><small>Set the choices and their extra charge.</small></div>
            <button type="button" onClick={() => setD({ ...d, sizes: [...d.sizes, { name: "", price_delta_cents: 0 }] })}>+ Add size</button>
          </div>
          {d.sizes.map((entry, index) => <div className="option-editor-row" key={`size-${index}`}>
            <input aria-label={`Size ${index + 1} name`} placeholder="e.g. Large" value={entry.name} onChange={(e) => updateSize(index, { name: e.target.value })}/>
            <label><span>Extra RM</span><input type="number" min="0" step=".1" value={entry.price_delta_cents / 100} onChange={(e) => updateSize(index, { price_delta_cents: Math.round(Number(e.target.value) * 100) })}/></label>
            <button type="button" className="remove-option" aria-label={`Remove ${entry.name || "size"}`} disabled={d.sizes.length === 1} onClick={() => setD({ ...d, sizes: d.sizes.filter((_, position) => position !== index) })}>Remove</button>
          </div>)}
        </section>
        <section className="product-options-editor">
          <div className="option-editor-heading"><div><strong>Temperature</strong><small>Select every temperature available for this item.</small></div></div>
          <div className="temperature-checks">{["Iced", "Hot", "Room temperature"].map((choice) => <label key={choice}><input type="checkbox" checked={d.temperatures.includes(choice)} onChange={(e) => setD({ ...d, temperatures: e.target.checked ? [...d.temperatures, choice] : d.temperatures.filter((entry) => entry !== choice) })}/><span>{choice}</span></label>)}</div>
        </section>
        <section className="product-options-editor">
          <div className="option-editor-heading">
            <div><strong>Toppings</strong><small>Optional extras shown in the customer app and POS.</small></div>
            <button type="button" onClick={() => setD({ ...d, toppings: [...d.toppings, { name: "", price_cents: 0 }] })}>+ Add topping</button>
          </div>
          {d.toppings.length === 0 && <p className="option-empty">No toppings configured for this item.</p>}
          {d.toppings.map((entry, index) => <div className="option-editor-row" key={`topping-${index}`}>
            <input aria-label={`Topping ${index + 1} name`} placeholder="e.g. Extra shot" value={entry.name} onChange={(e) => updateTopping(index, { name: e.target.value })}/>
            <label><span>Price RM</span><input type="number" min="0" step=".1" value={entry.price_cents / 100} onChange={(e) => updateTopping(index, { price_cents: Math.round(Number(e.target.value) * 100) })}/></label>
            <button type="button" className="remove-option" onClick={() => setD({ ...d, toppings: d.toppings.filter((_, position) => position !== index) })}>Remove</button>
          </div>)}
        </section>
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" disabled={uploading || saving}>
            {saving ? "Saving…" : "Save item"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function RewardsManagement({
  settings,
  setSettings,
  vouchers,
  setVouchers,
  codes,
  setCodes,
  claims,
  products,
  categories,
}: {
  settings: RewardSettings;
  setSettings: (value: RewardSettings) => void;
  vouchers: VoucherTemplate[];
  setVouchers: (value: VoucherTemplate[]) => void;
  codes: VoucherCode[];
  setCodes: (value: VoucherCode[]) => void;
  claims: VoucherClaim[];
  products: Product[];
  categories: Category[];
}) {
  const empty: VoucherTemplate = {
    id: 0,
    title: "",
    description: "",
    voucherType: "amount_off",
    buyQuantity: 2,
    buyScope: "any_drink",
    buyCategoryIds: [],
    buyProductIds: [],
    freeQuantity: 1,
    freeScope: "any_drink",
    freeCategoryIds: [],
    freeProductIds: [],
    amountOffCents: 300,
    validScope: "any_drink",
    categoryId: null,
    productId: null,
    image: "",
    expiresAt: null,
    pointCost: 350,
    availableInShop: true,
    active: true,
  };
  const [section, setSection] = useState<"system" | "vouchers" | "codes">(
      "system",
    ),
    [draft, setDraft] = useState<VoucherTemplate>(empty),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [codeTemplate, setCodeTemplate] = useState<number>(vouchers[0]?.id ?? 0),
    [code, setCode] = useState(""),
    [maxClaims, setMaxClaims] = useState(1),
    [codeExpiry, setCodeExpiry] = useState("");
  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
  };
  async function saveSettings() {
    setBusy(true);
    const { error } = await supabase!
      .from("reward_settings")
      .update(settings)
      .eq("id", true);
    setBusy(false);
    notify(error ? error.message : "Reward system saved.");
  }
  async function uploadVoucher(file: File) {
    setBusy(true);
    const path = `rewards/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "-")}`;
    const { error } = await supabase!.storage
      .from("public-assets")
      .upload(path, file, { contentType: file.type });
    if (error) {
      setBusy(false);
      notify(error.message);
      return;
    }
    const { data } = supabase!.storage.from("public-assets").getPublicUrl(path);
    setDraft((current) => ({ ...current, image: data.publicUrl }));
    setBusy(false);
  }
  async function saveVoucher(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      voucher_type: draft.voucherType,
      buy_quantity:
        draft.voucherType === "buy_x_free_one" ? draft.buyQuantity : null,
      buy_scope: draft.buyScope,
      buy_category_ids:
        draft.buyScope === "category" ? draft.buyCategoryIds : [],
      buy_product_ids: draft.buyScope === "product" ? draft.buyProductIds : [],
      free_quantity:
        draft.voucherType === "amount_off" ? 1 : draft.freeQuantity,
      free_scope: draft.freeScope,
      free_category_ids:
        draft.freeScope === "category" ? draft.freeCategoryIds : [],
      free_product_ids:
        draft.freeScope === "product" ? draft.freeProductIds : [],
      amount_off_cents:
        draft.voucherType === "amount_off" ? draft.amountOffCents : null,
      valid_scope: draft.freeScope,
      category_id:
        draft.freeScope === "category"
          ? (draft.freeCategoryIds[0] ?? null)
          : null,
      product_id:
        draft.freeScope === "product"
          ? (draft.freeProductIds[0] ?? null)
          : null,
      image_url: draft.image || null,
      expires_at: draft.expiresAt || null,
      point_cost: draft.availableInShop ? draft.pointCost : null,
      available_in_shop: draft.availableInShop,
      active: draft.active,
    };
    const result = draft.id
      ? await supabase!
          .from("voucher_templates")
          .update(payload)
          .eq("id", draft.id)
          .select()
          .single()
      : await supabase!
          .from("voucher_templates")
          .insert(payload)
          .select()
          .single();
    setBusy(false);
    if (result.error) {
      notify(result.error.message);
      return;
    }
    const x: any = result.data,
      next: VoucherTemplate = {
        id: x.id,
        title: x.title,
        description: x.description ?? "",
        voucherType: x.voucher_type,
        buyQuantity: x.buy_quantity,
        buyScope: x.buy_scope,
        buyCategoryIds: x.buy_category_ids ?? [],
        buyProductIds: x.buy_product_ids ?? [],
        freeQuantity: x.free_quantity ?? 1,
        freeScope: x.free_scope,
        freeCategoryIds: x.free_category_ids ?? [],
        freeProductIds: x.free_product_ids ?? [],
        amountOffCents: x.amount_off_cents,
        validScope: x.valid_scope,
        categoryId: x.category_id,
        productId: x.product_id,
        image: x.image_url ?? "",
        expiresAt: x.expires_at,
        pointCost: x.point_cost,
        availableInShop: x.available_in_shop,
        active: x.active,
      };
    setVouchers(
      draft.id
        ? vouchers.map((v) => (v.id === next.id ? next : v))
        : [next, ...vouchers],
    );
    setDraft(empty);
    if (!codeTemplate) setCodeTemplate(next.id);
    notify("Voucher saved.");
  }
  async function removeVoucher(item: VoucherTemplate) {
    if (
      !window.confirm(
        `Remove ${item.title}? Existing customer vouchers will remain in history.`,
      )
    )
      return;
    const { error } = await supabase!
      .from("voucher_templates")
      .update({ active: false, available_in_shop: false })
      .eq("id", item.id);
    if (error) {
      notify(error.message);
      return;
    }
    setVouchers(
      vouchers.map((v) =>
        v.id === item.id ? { ...v, active: false, availableInShop: false } : v,
      ),
    );
    notify("Voucher archived.");
  }
  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
      bytes = crypto.getRandomValues(new Uint8Array(8));
    setCode(`PAPA${[...bytes].map((n) => chars[n % chars.length]).join("")}`);
  }
  async function createCode(event: FormEvent) {
    event.preventDefault();
    if (!codeTemplate) {
      notify("Choose a voucher first.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase!
      .from("voucher_codes")
      .insert({
        voucher_template_id: codeTemplate,
        code: code.trim().toUpperCase(),
        max_claims: maxClaims,
        expires_at: codeExpiry || null,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      notify(error.message);
      return;
    }
    const x: any = data;
    setCodes([
      {
        id: x.id,
        voucherTemplateId: x.voucher_template_id,
        code: x.code,
        maxClaims: x.max_claims,
        claimCount: x.claim_count,
        expiresAt: x.expires_at,
        active: x.active,
        createdAt: x.created_at,
      },
      ...codes,
    ]);
    setCode("");
    notify("Claim code created.");
  }
  return (
    <section className="rewards-admin">
      <div className="reward-tabs" role="tablist">
        <button
          className={section === "system" ? "active" : ""}
          onClick={() => setSection("system")}
        >
          Reward system
        </button>
        <button
          className={section === "vouchers" ? "active" : ""}
          onClick={() => setSection("vouchers")}
        >
          Voucher library
        </button>
        <button
          className={section === "codes" ? "active" : ""}
          onClick={() => setSection("codes")}
        >
          Codes & history
        </button>
      </div>
      {message && (
        <div className="reward-notice" role="status">
          {message}
        </div>
      )}
      {section === "system" && (
        <div className="reward-system-stack">
          <article className="reward-panel">
            <span className="eyebrow">Independent reward systems</span>
            <h2>Run either program, both, or neither</h2>
            <p>
              Each enabled program rewards completed member orders. Turning one
              off keeps every existing balance and voucher intact.
            </p>
            <div className="system-choice independent">
              <label className={settings.stamp_enabled ? "active" : ""}>
                <Icon>
                  <rect x="5" y="4" width="14" height="16" rx="2" />
                  <path d="M8 9h8M8 13h5" />
                </Icon>
                <span>
                  <strong>Stamp Card</strong>
                  <small>One stamp for each completed cup</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={settings.stamp_enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      stamp_enabled: e.target.checked,
                    })
                  }
                />
                <i />
              </label>
              <label className={settings.points_enabled ? "active" : ""}>
                <Icon>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9 9.5c0-1 1.2-2 3-2s3 1 3 2-1 1.7-3 2-3 1-3 2 1.2 2.5 3 2.5 3-1 3-2.5M12 5v14" />
                </Icon>
                <span>
                  <strong>Points-Based Tier</strong>
                  <small>Points based on completed spend</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={settings.points_enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      points_enabled: e.target.checked,
                    })
                  }
                />
                <i />
              </label>
            </div>
            {!settings.points_enabled && !settings.stamp_enabled && (
              <div className="systems-paused">
                <Icon size={18}>
                  <path d="M12 3v18M3 12h18" />
                </Icon>
                <span>
                  <strong>Rewards earning is paused</strong>
                  <small>
                    Members keep existing vouchers, but new orders earn no
                    points or stamps.
                  </small>
                </span>
              </div>
            )}
          </article>
          <div className="reward-admin-grid">
            <article
              className={`reward-panel configure-panel ${settings.points_enabled ? "" : "disabled-config"}`}
            >
              <span className="eyebrow">Points configuration</span>
              <h2>Points earning rate</h2>
              <label>
                Points awarded for every RM 1
                <input
                  type="number"
                  min="1"
                  disabled={!settings.points_enabled}
                  value={settings.points_per_rm}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      points_per_rm: Number(e.target.value),
                    })
                  }
                />
              </label>
              <p className="reward-preview">
                RM 12.90 order →{" "}
                <strong>
                  {Math.floor(12.9 * settings.points_per_rm)} points
                </strong>
              </p>
            </article>
            <article
              className={`reward-panel configure-panel ${settings.stamp_enabled ? "" : "disabled-config"}`}
            >
              <span className="eyebrow">Stamp configuration</span>
              <h2>Stamp card target</h2>
              <label>
                Cups required
                <input
                  type="number"
                  min="1"
                  max="20"
                  disabled={!settings.stamp_enabled}
                  value={settings.stamp_threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      stamp_threshold: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Voucher issued
                <select
                  disabled={!settings.stamp_enabled}
                  value={settings.stamp_reward_template_id ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      stamp_reward_template_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">Choose a voucher</option>
                  {vouchers
                    .filter((v) => v.active)
                    .map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.title}
                      </option>
                    ))}
                </select>
              </label>
              <p className="reward-preview">
                Buy {settings.stamp_threshold} cups → <strong>1 voucher</strong>
              </p>
            </article>
          </div>
          <button
            className="primary-action save-systems"
            disabled={busy}
            onClick={saveSettings}
          >
            {busy ? "Saving…" : "Save reward settings"}
          </button>
        </div>
      )}
      {section === "vouchers" && (
        <div className="voucher-admin-layout">
          <form className="reward-panel voucher-form" onSubmit={saveVoucher}>
            <div>
              <span className="eyebrow">
                {draft.id ? "Edit voucher" : "New voucher"}
              </span>
              <h2>{draft.id ? draft.title : "Create a reward"}</h2>
            </div>
            <label>
              Voucher title
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
                placeholder="RM3 off your next cup"
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                required
              />
            </label>
            <div className="pair">
              <label>
                Type
                <select
                  value={draft.voucherType}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      voucherType: e.target
                        .value as VoucherTemplate["voucherType"],
                    })
                  }
                >
                  <option value="buy_x_free_one">Buy X, Free Y</option>
                  <option value="free_drink">Free X drink</option>
                  <option value="amount_off">RM X off</option>
                </select>
              </label>
              {draft.voucherType === "buy_x_free_one" ? (
                <label>
                  Buy quantity
                  <input
                    type="number"
                    min="1"
                    value={draft.buyQuantity ?? 2}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        buyQuantity: Number(e.target.value),
                      })
                    }
                  />
                </label>
              ) : draft.voucherType === "amount_off" ? (
                <label>
                  Discount (RM)
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={(draft.amountOffCents ?? 0) / 100}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        amountOffCents: Math.round(
                          Number(e.target.value) * 100,
                        ),
                      })
                    }
                  />
                </label>
              ) : (
                <span />
              )}
            </div>
            {draft.voucherType === "buy_x_free_one" && (
              <fieldset className="voucher-criteria">
                <legend>Buy criteria</legend>
                <div className="pair">
                  <label>
                    Eligible purchased items
                    <select value={draft.buyScope} onChange={(e)=>setDraft({...draft,buyScope:e.target.value as VoucherScope})}>
                      <option value="any_drink">All drinks</option><option value="category">Specific categories</option><option value="product">Specific individual drinks</option>
                    </select>
                  </label>
                  {draft.buyScope === "category" ? <label>Categories<select multiple value={draft.buyCategoryIds.map(String)} onChange={(e)=>setDraft({...draft,buyCategoryIds:Array.from(e.currentTarget.selectedOptions,o=>Number(o.value))})}>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><small>Hold Ctrl / Command to select multiple.</small></label> : draft.buyScope === "product" ? <label>Drinks<select multiple value={draft.buyProductIds.map(String)} onChange={(e)=>setDraft({...draft,buyProductIds:Array.from(e.currentTarget.selectedOptions,o=>Number(o.value))})}>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><small>Hold Ctrl / Command to select multiple.</small></label> : <span />}
                </div>
              </fieldset>
            )}
            {draft.voucherType !== "amount_off" && (
              <fieldset className="voucher-criteria">
                <legend>Free criteria</legend>
                <div className="pair">
                  <label>Free quantity<input type="number" min="1" max="20" value={draft.freeQuantity} onChange={(e)=>setDraft({...draft,freeQuantity:Number(e.target.value)})}/></label>
                  <label>Free item eligibility<select value={draft.freeScope} onChange={(e)=>setDraft({...draft,freeScope:e.target.value as VoucherScope})}><option value="any_drink">Any drink</option><option value="category">Specific categories</option><option value="product">Specific individual drinks</option></select></label>
                </div>
                {draft.freeScope === "category" ? <label>Free categories<select multiple value={draft.freeCategoryIds.map(String)} onChange={(e)=>setDraft({...draft,freeCategoryIds:Array.from(e.currentTarget.selectedOptions,o=>Number(o.value))})}>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><small>Hold Ctrl / Command to select multiple.</small></label> : draft.freeScope === "product" ? <label>Free drinks<select multiple value={draft.freeProductIds.map(String)} onChange={(e)=>setDraft({...draft,freeProductIds:Array.from(e.currentTarget.selectedOptions,o=>Number(o.value))})}>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><small>Hold Ctrl / Command to select multiple.</small></label> : null}
              </fieldset>
            )}
            <label className="image-picker">
              Voucher image
              <span>
                {draft.image ? (
                  <img src={draft.image} alt="Voucher preview" />
                ) : (
                  <b>1200 × 800 px recommended</b>
                )}
                <b>{busy ? "Uploading…" : "Choose image"}</b>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadVoucher(file);
                }}
              />
            </label>
            <div className="pair">
              <label>
                Expiry date
                <input
                  type="datetime-local"
                  value={draft.expiresAt?.slice(0, 16) ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, expiresAt: e.target.value || null })
                  }
                />
              </label>
              <label>
                Point cost
                <input
                  type="number"
                  min="1"
                  value={draft.pointCost ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      pointCost: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
            </div>
            <label className="setting-check">
              <span>
                <strong>Show in Voucher Shop</strong>
                <small>Customers can redeem it with points.</small>
              </span>
              <input
                type="checkbox"
                checked={draft.availableInShop}
                onChange={(e) =>
                  setDraft({ ...draft, availableInShop: e.target.checked })
                }
              />
            </label>
            <div className="form-actions">
              <button type="button" onClick={() => setDraft(empty)}>
                Clear
              </button>
              <button className="primary-action" disabled={busy}>
                {busy ? "Saving…" : "Save voucher"}
              </button>
            </div>
          </form>
          <div className="voucher-library">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Voucher library</span>
                <h2>{vouchers.length} rewards</h2>
              </div>
            </div>
            {vouchers.map((v) => (
              <article className={!v.active ? "archived" : ""} key={v.id}>
                {v.image ? (
                  <img src={v.image} alt="" />
                ) : (
                  <span className="voucher-art">
                    <Icon>
                      <path d="M4 7h16v12H4zM8 7V5h8v2M8 13h8" />
                    </Icon>
                  </span>
                )}
                <div>
                  <span>
                    {v.voucherType === "amount_off"
                      ? `RM ${((v.amountOffCents ?? 0) / 100).toFixed(0)} OFF`
                      : v.voucherType === "free_drink"
                        ? "FREE DRINK"
                        : `BUY ${v.buyQuantity}, FREE ${v.freeQuantity}`}
                  </span>
                  <h3>{v.title}</h3>
                  <p>{v.description}</p>
                  <small>
                    {v.availableInShop
                      ? `${v.pointCost?.toLocaleString() ?? "—"} points`
                      : "Code / stamp only"}{" "}
                    · {v.active ? "Active" : "Archived"}
                  </small>
                </div>
                <div className="voucher-actions">
                  <button onClick={() => setDraft(v)}>Edit</button>
                  {v.active && (
                    <button
                      className="danger"
                      onClick={() => void removeVoucher(v)}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      {section === "codes" && (
        <div className="reward-admin-grid code-grid">
          <form className="reward-panel" onSubmit={createCode}>
            <span className="eyebrow">One-time claim codes</span>
            <h2>Generate a secret code</h2>
            <label>
              Voucher
              <select
                value={codeTemplate}
                onChange={(e) => setCodeTemplate(Number(e.target.value))}
                required
              >
                <option value="">Choose a voucher</option>
                {vouchers
                  .filter((v) => v.active)
                  .map((v) => (
                    <option value={v.id} key={v.id}>
                      {v.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Secret code
              <div className="code-input">
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                    )
                  }
                  placeholder="PAPAWELCOME"
                  required
                />
                <button type="button" onClick={randomCode}>
                  Random
                </button>
              </div>
            </label>
            <div className="pair">
              <label>
                Maximum claims
                <input
                  type="number"
                  min="1"
                  value={maxClaims}
                  onChange={(e) => setMaxClaims(Number(e.target.value))}
                />
              </label>
              <label>
                Expiry
                <input
                  type="datetime-local"
                  value={codeExpiry}
                  onChange={(e) => setCodeExpiry(e.target.value)}
                />
              </label>
            </div>
            <button className="primary-action" disabled={busy}>
              Create claim code
            </button>
            <p className="security-note">
              Codes are normalized to uppercase and locked during claim to
              prevent double redemption.
            </p>
          </form>
          <article className="reward-panel">
            <span className="eyebrow">Launch test codes</span>
            <h2>Ready to claim</h2>
            <div className="launch-codes">
              <code>PAPAWELCOME</code>
              <code>KOPIFREE</code>
              <code>PAPABUY2</code>
            </div>
            <p>
              These seeded promotion codes use real menu artwork and the
              configured expiry rules.
            </p>
          </article>
        </div>
      )}
      {section === "codes" && (
        <div className="history-tables">
          <section className="reward-panel">
            <div className="section-heading">
              <h2>Code inventory</h2>
              <span>{codes.reduce((n, c) => n + c.claimCount, 0)} claims</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Voucher</th>
                    <th>Claims</th>
                    <th>Expiry</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <code>{c.code}</code>
                      </td>
                      <td>
                        {vouchers.find((v) => v.id === c.voucherTemplateId)
                          ?.title ?? "Voucher"}
                      </td>
                      <td>
                        {c.claimCount} / {c.maxClaims}
                      </td>
                      <td>
                        {c.expiresAt
                          ? new Date(c.expiresAt).toLocaleDateString()
                          : "No expiry"}
                      </td>
                      <td>{c.active ? "Active" : "Closed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="reward-panel">
            <div className="section-heading">
              <h2>Redemption history</h2>
              <span>Latest 100</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Voucher</th>
                    <th>Source</th>
                    <th>Claimed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.length ? (
                    claims.map((c) => (
                      <tr key={c.id}>
                        <td>{c.title}</td>
                        <td>{c.source.replace("_", " ")}</td>
                        <td>{new Date(c.claimedAt).toLocaleString()}</td>
                        <td>{c.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>No vouchers claimed yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
