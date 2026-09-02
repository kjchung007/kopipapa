import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { type User } from "@supabase/supabase-js";
import "./App.css";
import { supabase } from "./supabase";
import { useStore, type Store } from "./StoreContext";

type MenuItem = {
  id: number;
  category: string;
  name: string;
  description: string;
  price: number;
  image: string;
  badge?: string;
};
type MenuCategory = { name: string; image: string };
type AppTab = "home" | "menu" | "orders" | "rewards" | "profile";
type AuthState = "none" | "email";
type AuthView = "login" | "signup" | "check-email" | "forgot" | "update-password";
type CartLine = {
  key: string;
  itemId: number;
  quantity: number;
  temperature: string;
  size: string;
  unitPrice: number;
  itemName: string;
  image: string;
  source?: "menu" | "upsell";
};
type PendingAction =
  | { kind: "nav"; tab: "orders" | "rewards" | "profile" }
  | { kind: "add"; line: CartLine }
  | { kind: "checkout" }
  | null;
type OrderLine = {
  id: number;
  product_id: number | null;
  product_name: string;
  unit_price_cents: number;
  quantity: number;
  customization: { temperature?: string; size?: string };
  products?: { image_url?: string } | null;
};
type CustomerOrder = {
  id: number;
  order_number: string;
  status: string;
  total_cents: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  final_total: number;
  created_at: string;
  store_id: number;
  payment_status: string;
  payment_method: "fpx" | "touch_n_go" | null;
  payment_bank: string | null;
  hitpay_payment_request_id: string | null;
  paid_at: string | null;
  stores?: Store | null;
  order_items: OrderLine[];
};
type QueueMetric = {
  activeCups: number;
  etaMinutes: number;
  updatedAt: string;
};
type ShopSettings = {
  shop_name: string;
  accepting_pickup: boolean;
  preparation_minutes: number;
  logo_url?: string;
};
type RewardSettings = {
  points_enabled: boolean;
  stamp_enabled: boolean;
  points_per_rm: number;
  stamp_threshold: number;
  stamp_reward_template_id: number | null;
};
type VoucherScope = "any_drink" | "category" | "product";
type RewardTemplate = {
  id: number;
  title: string;
  description: string;
  voucher_type: "buy_x_free_one" | "free_drink" | "amount_off";
  buy_quantity: number | null;
  buy_scope: VoucherScope;
  buy_category_ids: number[];
  buy_product_ids: number[];
  free_quantity: number;
  free_scope: VoucherScope;
  free_category_ids: number[];
  free_product_ids: number[];
  amount_off_cents: number | null;
  valid_scope: "any_drink" | "category" | "product";
  category_id: number | null;
  product_id: number | null;
  image_url: string | null;
  expires_at: string | null;
  point_cost: number | null;
  available_in_shop: boolean;
  active: boolean;
};
type UserVoucher = {
  id: number;
  status: string;
  source: string;
  claimed_at: string;
  used_at: string | null;
  expires_at: string | null;
  voucher_templates: RewardTemplate | null;
};
type RewardGrant = { id: number; source: string } | null;
type CustomerProfile = { display_name: string; phone: string };

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
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

function BottomSheet({
  children,
  close,
}: {
  children: ReactNode;
  close: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const dismiss = () => setClosing(true);
  useEffect(() => {
    if (!closing) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(close, reduced ? 10 : 220);
    return () => window.clearTimeout(timer);
  }, [closing, close]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  return (
    <div
      className={`sheet-backdrop ${closing ? "is-closing" : "is-opening"}`}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest(".sheet-close")) {
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        }
      }}
    >
      {children}
    </div>
  );
}

const STORE_TIMEZONE = "Asia/Kuala_Lumpur";
function timeMinutes(value?: string) {
  const [hour = "0", minute = "0"] = (value ?? "").split(":");
  return Number(hour) * 60 + Number(minute);
}
function malaysiaMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return (
    Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  );
}
function isStoreOpen(store: Store | null, currentMinutes: number) {
  if (
    !store ||
    currentMinutes < 0 ||
    !store.accepting_pickup ||
    !store.opening_time ||
    !store.closing_time
  )
    return false;
  const opens = timeMinutes(store.opening_time),
    closes = timeMinutes(store.closing_time);
  if (opens === closes) return true;
  return opens < closes
    ? currentMinutes >= opens && currentMinutes < closes
    : currentMinutes >= opens || currentMinutes < closes;
}
function displayTime(value?: string) {
  const total = timeMinutes(value),
    hour = (total / 60) | 0,
    minute = total % 60,
    suffix = hour >= 12 ? "pm" : "am",
    shown = hour % 12 || 12;
  return `${shown}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${suffix}`;
}
function storeHours(store: Store | null) {
  return store?.opening_time && store.closing_time
    ? `${displayTime(store.opening_time)} – ${displayTime(store.closing_time)}`
    : "Hours unavailable";
}
function whatsappNumber(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `60${digits.slice(1)}` : digits;
}

export default function App() {
  const { stores, selectedStore, loadingStores, storeError, selectStore } =
    useStore();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [campaigns, setCampaigns] = useState<
    { title: string; copy: string; image: string }[]
  >([]);
  const [settings, setSettings] = useState<ShopSettings>({
    shop_name: "Kopi Papa Main Shop",
    accepting_pickup: true,
    preparation_minutes: 8,
  });
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile>({
    display_name: "",
    phone: "",
  });
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [queue, setQueue] = useState<QueueMetric>({
    activeCups: 0,
    etaMinutes: 0,
    updatedAt: "",
  });
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>({
    points_enabled: true,
    stamp_enabled: false,
    points_per_rm: 10,
    stamp_threshold: 8,
    stamp_reward_template_id: null,
  });
  const [rewardBalance, setRewardBalance] = useState({
    points_balance: 0,
    stamp_count: 0,
    lifetime_points: 0,
  });
  const [rewardTemplates, setRewardTemplates] = useState<RewardTemplate[]>([]);
  const [userVouchers, setUserVouchers] = useState<UserVoucher[]>([]);
  const [rewardGrant, setRewardGrant] = useState<RewardGrant>(null);
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<{
    orderId: number;
    amount: number;
    method: "fpx" | "touch_n_go";
    voucherKey: string;
    bank: string | null;
  } | null>(null);
  const [tab, setTab] = useState<AppTab>("home");
  const [fulfillment, setFulfillment] = useState<"pickup" | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [temperature, setTemperature] = useState("Iced");
  const [drinkSize, setDrinkSize] = useState("Regular");
  const [sheetQuantity, setSheetQuantity] = useState(1);
  const [slide, setSlide] = useState(0);
  const [auth, setAuth] = useState<AuthState>("none");
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeDetailsOpen, setStoreDetailsOpen] = useState(false);
  const [currentMinutes, setCurrentMinutes] = useState(-1);
  const [deliverySoon, setDeliverySoon] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(false);
  const [detailOrder, setDetailOrder] = useState<CustomerOrder | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const paymentReconciliationRunning = useRef(false);
  const cartRef = useRef<Record<string, CartLine>>({});
  const cloudCartKey = useRef("");
  const cloudCartWriting = useRef(false);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    const update = () => setCurrentMinutes(malaysiaMinutes(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadPublicData() {
      const [
        { data: productRows },
        { data: categoryRows },
        { data: campaignRows },
        { data: settingsRow },
        { data: stockRows },
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,description,price_cents,image_url,badge,categories(name)",
          )
          .eq("available", true)
          .order("sort_order"),
        supabase
          .from("categories")
          .select("name,image_url")
          .eq("active", true)
          .order("display_order"),
        supabase
          .from("campaigns")
          .select("title,body,image_url")
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("shop_settings")
          .select("shop_name,accepting_pickup,preparation_minutes,logo_url")
          .eq("id", true)
          .single(),
        selectedStore
          ? supabase
              .from("store_product_availability")
              .select("product_id,available")
              .eq("store_id", selectedStore.id)
          : Promise.resolve({ data: null }),
      ]);
      const storeStock = stockRows
        ? new Map(stockRows.map((row) => [row.product_id, row.available]))
        : null;
      setMenu(
        (productRows ?? [])
          .filter((row: any) => storeStock?.get(row.id) ?? true)
          .map((row: any) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            price: row.price_cents / 100,
            image: row.image_url ?? "",
            badge: row.badge ?? undefined,
            category: row.categories?.name ?? "Other",
          })),
      );
      setCategories(
        (categoryRows ?? []).map((row) => ({
          name: row.name,
          image: row.image_url ?? "",
        })),
      );
      setActiveCategory(categoryRows?.[0]?.name ?? "");
      setCampaigns(
        (campaignRows ?? []).map((row) => ({
          title: row.title,
          copy: row.body,
          image: row.image_url ?? "",
        })),
      );
      if (settingsRow) setSettings(settingsRow);
    }
    loadPublicData();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.is_anonymous) {
        void supabase.auth.signOut();
        return;
      }
      if (data.user) {
        setUser(data.user);
        setAuth("email");
        setEmail(data.user.email ?? "");
        void loadOrders(data.user);
        void loadRewards(data.user);
        void loadProfile(data.user);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user ?? null;
      if (next?.is_anonymous) {
        void supabase.auth.signOut();
        return;
      }
      setUser(next);
      setAuth(next ? "email" : "none");
      if (event === "PASSWORD_RECOVERY") {
        setAuthView("update-password");
        setAuthOpen(true);
      }
      if (next) {
        void loadRewards(next);
        void loadProfile(next);
      } else setProfile({ display_name: "", phone: "" });
    });
    const liveMenu = supabase
      .channel("customer-catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => void loadPublicData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => void loadPublicData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns" },
        () => void loadPublicData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_settings" },
        () => void loadPublicData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_product_availability" },
        () => void loadPublicData(),
      )
      .subscribe();
    return () => {
      data.subscription.unsubscribe();
      void supabase.removeChannel(liveMenu);
    };
  }, [selectedStore?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`customer-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        () => void loadOrders(user),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !selectedStore) {
      cloudCartKey.current = "";
      return;
    }
    const key = `${user.id}:${selectedStore.id}`;
    let disposed = false;
    cloudCartKey.current = "";
    const loadCloudCart = async () => {
      const localBeforeLoad = cartRef.current;
      const { data, error } = await supabase
        .from("customer_cart_items")
        .select("item_key,product_id,quantity,customization,source,products(name,price_cents,image_url)")
        .eq("user_id", user.id)
        .eq("store_id", selectedStore.id)
        .order("updated_at");
      if (disposed || error) return;
      const rows = data ?? [];
      if (rows.length) {
        const next: Record<string, CartLine> = {};
        rows.forEach((row: any) => {
          const product = Array.isArray(row.products) ? row.products[0] : row.products;
          if (!product) return;
          const customization = row.customization ?? {};
          next[row.item_key] = {
            key: row.item_key,
            itemId: row.product_id,
            quantity: row.quantity,
            temperature: customization.temperature ?? "Iced",
            size: customization.size ?? "Regular",
            unitPrice: product.price_cents / 100 + (String(customization.size ?? "").startsWith("Large") ? 1 : 0),
            itemName: product.name,
            image: product.image_url ?? "",
            source: row.source,
          };
        });
        setCart(next);
      } else if (Object.keys(localBeforeLoad).length) {
        await supabase.rpc("replace_customer_cart", {
          p_store_id: selectedStore.id,
          p_items: Object.values(localBeforeLoad).map((line) => ({ item_key: line.key, product_id: line.itemId, quantity: line.quantity, customization: { temperature: line.temperature, size: line.size }, source: line.source ?? "menu" })),
        });
      } else setCart({});
      cloudCartKey.current = key;
    };
    void loadCloudCart();
    const channel = supabase.channel(`cloud-cart-${key}`).on("postgres_changes", { event: "*", schema: "public", table: "customer_cart_items", filter: `user_id=eq.${user.id}` }, () => {
      if (!cloudCartWriting.current) void loadCloudCart();
    }).subscribe();
    return () => { disposed = true; void supabase.removeChannel(channel); };
  }, [user?.id, selectedStore?.id]);

  useEffect(() => {
    if (!user || !selectedStore || cloudCartKey.current !== `${user.id}:${selectedStore.id}`) return;
    const timer = window.setTimeout(async () => {
      cloudCartWriting.current = true;
      await supabase.rpc("replace_customer_cart", {
        p_store_id: selectedStore.id,
        p_items: Object.values(cart).map((line) => ({ item_key: line.key, product_id: line.itemId, quantity: line.quantity, customization: { temperature: line.temperature, size: line.size }, source: line.source ?? "menu" })),
      });
      window.setTimeout(() => { cloudCartWriting.current = false; }, 250);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [cart, user?.id, selectedStore?.id]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "return") return;
    const orderId = Number(params.get("order_id"));
    setTab("orders");
    setCartOpen(false);
    const reconcile = async () => {
      if (Number.isSafeInteger(orderId) && orderId > 0) {
        const { data, error } = await supabase.functions.invoke(
          "reconcile-hitpay-payment",
          { body: { order_id: orderId } },
        );
        if (error || data?.error)
          setAuthError(
            data?.error ??
              error?.message ??
              "We could not confirm the payment yet. Please refresh Orders shortly.",
          );
        else if (data?.payment_status === "paid") {
          setCart({});
          if (selectedStore) await supabase.rpc("replace_customer_cart", { p_store_id: selectedStore.id, p_items: [] });
        } else
          setAuthError(
            "Payment is still being confirmed. This page will update automatically.",
          );
      }
      await loadOrders(user);
      window.history.replaceState({}, "", window.location.pathname);
    };
    void reconcile();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => void loadRewards(user);
    const vouchersChanged = (payload: {
      eventType: string;
      new: Record<string, unknown>;
    }) => {
      if (payload.eventType === "INSERT")
        setRewardGrant({
          id: Number(payload.new.id),
          source: String(payload.new.source),
        });
      refresh();
    };
    const channel = supabase
      .channel(`customer-rewards-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reward_accounts",
          filter: `user_id=eq.${user.id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_vouchers",
          filter: `user_id=eq.${user.id}`,
        },
        vouchersChanged,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reward_settings" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voucher_templates" },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedStore) {
      setQueue({ activeCups: 0, etaMinutes: 0, updatedAt: "" });
      return;
    }
    const apply = (row: { active_cups: number; updated_at: string }) =>
      setQueue({
        activeCups: row.active_cups,
        etaMinutes: Math.ceil(
          row.active_cups * Number(selectedStore.minutes_per_cup) +
            selectedStore.buffer_minutes,
        ),
        updatedAt: row.updated_at,
      });
    const load = async () => {
      const { data } = await supabase
        .from("store_queue_metrics")
        .select("active_cups,updated_at")
        .eq("store_id", selectedStore.id)
        .maybeSingle();
      if (data) apply(data);
    };
    void load();
    const channel = supabase
      .channel(`store-queue-${selectedStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "store_queue_metrics",
          filter: `store_id=eq.${selectedStore.id}`,
        },
        (payload) =>
          apply(payload.new as { active_cups: number; updated_at: string }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    selectedStore?.id,
    selectedStore?.minutes_per_cup,
    selectedStore?.buffer_minutes,
  ]);

  async function loadOrders(currentUser = user, reconcilePending = true) {
    if (!currentUser) return;
    const { data } = await supabase
      .from("orders")
      .select(
        "id,order_number,status,total_cents,subtotal,discount_amount,tax_amount,final_total,created_at,store_id,payment_status,payment_method,payment_bank,hitpay_payment_request_id,paid_at,stores(id,name,address,phone,preparation_minutes,minutes_per_cup,buffer_minutes,accepting_pickup,opening_time,closing_time,image_url),order_items(id,product_id,product_name,unit_price_cents,quantity,customization,products(image_url))",
      )
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });
    const normalized = (data ?? []).map((order) => ({
      ...order,
      stores: Array.isArray(order.stores)
        ? (order.stores[0] ?? null)
        : order.stores,
      order_items: order.order_items.map((line) => ({
        ...line,
        products: Array.isArray(line.products)
          ? (line.products[0] ?? null)
          : line.products,
      })),
    }));
    setOrders(normalized as CustomerOrder[]);
    const pending = (normalized as CustomerOrder[])
      .filter(
        (order) =>
          order.payment_status === "pending" && order.hitpay_payment_request_id,
      )
      .slice(0, 3);
    if (
      reconcilePending &&
      pending.length &&
      !paymentReconciliationRunning.current
    ) {
      paymentReconciliationRunning.current = true;
      try {
        const results = await Promise.all(
          pending.map((order) =>
            supabase.functions.invoke("reconcile-hitpay-payment", {
              body: { order_id: order.id },
            }),
          ),
        );
        if (results.some((result) => result.data?.payment_status && result.data.payment_status !== "pending"))
          await loadOrders(currentUser, false);
      } finally {
        paymentReconciliationRunning.current = false;
      }
    }
  }

  async function loadRewards(currentUser = user) {
    if (!currentUser) {
      setRewardBalance({
        points_balance: 0,
        stamp_count: 0,
        lifetime_points: 0,
      });
      setUserVouchers([]);
      return;
    }
    const [
      { data: config },
      { data: account },
      { data: templates },
      { data: owned },
    ] = await Promise.all([
      supabase
        .from("reward_settings")
        .select(
          "points_enabled,stamp_enabled,points_per_rm,stamp_threshold,stamp_reward_template_id",
        )
        .eq("id", true)
        .single(),
      supabase
        .from("reward_accounts")
        .select("points_balance,stamp_count,lifetime_points")
        .eq("user_id", currentUser.id)
        .maybeSingle(),
      supabase
        .from("voucher_templates")
        .select(
          "id,title,description,voucher_type,buy_quantity,buy_scope,buy_category_ids,buy_product_ids,free_quantity,free_scope,free_category_ids,free_product_ids,amount_off_cents,valid_scope,category_id,product_id,image_url,expires_at,point_cost,available_in_shop,active",
        )
        .eq("active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_vouchers")
        .select(
          "id,status,source,claimed_at,used_at,expires_at,voucher_templates(id,title,description,voucher_type,buy_quantity,buy_scope,buy_category_ids,buy_product_ids,free_quantity,free_scope,free_category_ids,free_product_ids,amount_off_cents,valid_scope,category_id,product_id,image_url,expires_at,point_cost,available_in_shop,active)",
        )
        .eq("user_id", currentUser.id)
        .order("claimed_at", { ascending: false }),
    ]);
    if (config) setRewardSettings(config as RewardSettings);
    setRewardBalance(
      account ?? { points_balance: 0, stamp_count: 0, lifetime_points: 0 },
    );
    setRewardTemplates((templates ?? []) as RewardTemplate[]);
    setUserVouchers(
      (owned ?? []).map((x: any) => ({
        ...x,
        voucher_templates: Array.isArray(x.voucher_templates)
          ? (x.voucher_templates[0] ?? null)
          : x.voucher_templates,
      })) as UserVoucher[],
    );
  }

  async function loadProfile(currentUser = user) {
    if (!currentUser) {
      setProfile({ display_name: "", phone: "" });
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("display_name,phone")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    setProfile({
      display_name:
        data?.display_name ??
        String(currentUser.user_metadata?.display_name ?? ""),
      phone: data?.phone ?? "",
    });
  }

  const cartCount = Object.values(cart).reduce(
    (total, line) => total + line.quantity,
    0,
  );
  const cartTotal = useMemo(
    () =>
      Object.values(cart).reduce(
        (total, line) => total + line.unitPrice * line.quantity,
        0,
      ),
    [cart],
  );
  const cartItems = Object.values(cart).map((line) => ({
    line,
    item: menu.find((entry) => entry.id === line.itemId) ?? {
      id: line.itemId,
      name: line.itemName,
      image: line.image,
      price: line.unitPrice,
      category: "",
      description: "",
    },
  }));
  const selectedStoreIsOpen = isStoreOpen(selectedStore, currentMinutes);

  const openAuth = (action: PendingAction) => {
    setPending(action);
    setAuthView("login");
    setAuthOpen(true);
  };
  const makeLine = (item: MenuItem): CartLine => {
    const key = `${item.id}-${temperature}-${drinkSize}`;
    return {
      key,
      itemId: item.id,
      quantity: sheetQuantity,
      temperature,
      size: drinkSize,
      unitPrice: item.price + (drinkSize.startsWith("Large") ? 1 : 0),
      itemName: item.name,
      image: item.image,
      source: "menu",
    };
  };
  const addLine = (line: CartLine) =>
    setCart((current) => ({
      ...current,
      [line.key]: current[line.key]
        ? { ...line, quantity: current[line.key].quantity + line.quantity }
        : line,
    }));
  const gatedAdd = (item: MenuItem) => {
    if (!selectedStoreIsOpen) {
      setAuthError(
        `This store is closed. Ordering resumes at ${displayTime(selectedStore?.opening_time)}.`,
      );
      return;
    }
    const line = makeLine(item);
    setSelectedItem(null);
    setSheetQuantity(1);
    if (auth === "none") openAuth({ kind: "add", line });
    else addLine(line);
  };
  const resumePending = () => {
    setAuth("email");
    setAuthOpen(false);
    if (pending?.kind === "nav") setTab(pending.tab);
    if (pending?.kind === "add") addLine(pending.line);
    if (pending?.kind === "checkout") setCartOpen(true);
    setPending(null);
  };
  const requestTab = (nextTab: AppTab) => {
    if (nextTab === "menu" && !fulfillment) {
      setFulfillmentOpen(true);
      return;
    }
    if (nextTab === "rewards" && auth !== "email") {
      setAuthError("Sign in or create an account to access Rewards.");
      openAuth({ kind: "nav", tab: "rewards" });
      return;
    }
    if ((nextTab === "orders" || nextTab === "profile") && auth === "none") {
      openAuth({ kind: "nav", tab: nextTab });
      return;
    }
    setTab(nextTab);
    if (nextTab === "orders") loadOrders();
    if (nextTab === "rewards") loadRewards();
  };
  const selectPickup = () => {
    setFulfillmentOpen(false);
    setDeliverySoon(false);
    setStoreOpen(true);
  };
  const confirmStore = (store: Store) => {
    selectStore(store);
    setFulfillment("pickup");
    setStoreOpen(false);
    setTab("menu");
  };
  const showDeliverySoon = () => {
    setDeliverySoon(true);
    setFulfillmentOpen(true);
  };
  const jumpToCategory = (category: string) => {
    setActiveCategory(category);
    document
      .getElementById(`category-${category}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      setAuthError(error?.message ?? "Unable to sign in.");
      return;
    }
    setUser(data.user);
    resumePending();
    await Promise.all([loadOrders(data.user), loadProfile(data.user)]);
  };
  const submitSignUp = async (displayName: string) => {
    setAuthError("");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/?auth=confirmed`,
      },
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    if (data.session && data.user) {
      setUser(data.user);
      resumePending();
      return true;
    }
    return true;
  };
  const signInWithProvider = async (provider: "google" | "apple") => {
    setAuthError("");
    if (provider === "apple") {
      setToast("Sign in with Apple is coming soon.");
      window.setTimeout(() => setToast(""), 2800);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/?auth=callback` },
    });
    if (error) setAuthError(error.message);
  };
  const sendPasswordReset = async () => {
    setAuthError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?auth=reset`,
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  };
  const resendConfirmation = async () => {
    setAuthError("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/?auth=confirmed` },
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  };
  const updatePassword = async (nextPassword: string) => {
    setAuthError("");
    const { data, error } = await supabase.auth.updateUser({
      password: nextPassword,
    });
    if (error || !data.user) {
      setAuthError(error?.message ?? "Your password could not be updated.");
      return false;
    }
    setUser(data.user);
    window.history.replaceState({}, "", window.location.pathname);
    resumePending();
    return true;
  };
  const openCart = () => {
    if (auth === "none") openAuth({ kind: "checkout" });
    else setCartOpen(true);
  };
  const reorder = (order: CustomerOrder) => {
    const next: Record<string, CartLine> = {};
    order.order_items.forEach((line) => {
      if (!line.product_id) return;
      const temperature = line.customization?.temperature ?? "Iced",
        size = line.customization?.size ?? "Regular",
        key = `${line.product_id}-${temperature}-${size}`;
      next[key] = {
        key,
        itemId: line.product_id,
        quantity: line.quantity,
        temperature,
        size,
        unitPrice: line.unit_price_cents / 100,
        itemName: line.product_name,
        image: line.products?.image_url ?? "",
      };
    });
    setCart((current) => ({ ...current, ...next }));
    if (order.stores) selectStore(order.stores);
    setFulfillment("pickup");
    setDetailOrder(null);
    setTab("menu");
  };
  const placeOrder = async (
    paymentMethod: "fpx" | "touch_n_go",
    totalAmount: number,
    voucher?: { userVoucherId?: number; secretCode?: string },
    paymentBank?: string,
  ) => {
    if (!user || !selectedStore || orderBusy) return;
    if (!selectedStoreIsOpen) {
      setAuthError(
        `This store is closed. Ordering resumes at ${displayTime(selectedStore.opening_time)}.`,
      );
      return;
    }
    setOrderBusy(true);
    const voucherKey = voucher?.userVoucherId
      ? `voucher:${voucher.userVoucherId}`
      : voucher?.secretCode
        ? `code:${voucher.secretCode}`
        : "none";
    let orderId =
      paymentDraft?.amount === totalAmount &&
      paymentDraft.method === paymentMethod &&
      paymentDraft.bank === (paymentBank ?? null) &&
      paymentDraft.voucherKey === voucherKey
        ? paymentDraft.orderId
        : null;
    if (!orderId) {
      const payload = cartItems.map(({ item, line }) => ({
        product_id: item.id,
        quantity: line.quantity,
        customization: { temperature: line.temperature, size: line.size },
        source: line.source ?? "menu",
      }));
      const { data: created, error } = await supabase.rpc(
        "create_pickup_order",
        {
          p_customer_name:
            profile.display_name.trim() || user.email?.split("@")[0] || "Customer",
          p_items: payload,
          p_store_id: selectedStore.id,
          p_user_voucher_id: voucher?.userVoucherId ?? null,
          p_secret_code: voucher?.secretCode ?? null,
          p_payment_method: paymentMethod,
        },
      );
      if (error || !created) {
        setOrderBusy(false);
        setAuthError(error?.message ?? "Order could not be created.");
        return;
      }
      orderId = Number((created as { id: number }).id);
      setPaymentDraft({
        orderId,
        amount: totalAmount,
        method: paymentMethod,
        voucherKey,
        bank: paymentBank ?? null,
      });
    }
    const { data, error } = await supabase.functions.invoke(
      "create-hitpay-payment",
      {
        body: {
          order_id: orderId,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          fpx_bank: paymentMethod === "fpx" ? paymentBank : null,
        },
      },
    );
    setOrderBusy(false);
    if (error || !data?.url) {
      setAuthError(
        data?.error ??
          error?.message ??
          "Payment could not be started. Your pending order is saved, so you can safely try again.",
      );
      return;
    }
    setPlacedOrder(true);
    setPaymentDraft(null);
    window.location.href = data.url;
  };

  return (
    <div className="app-shell">
      {toast && <div className="app-toast" role="status"><Icon size={18}><path d="M12 8v5M12 17v.01"/><circle cx="12" cy="12" r="9"/></Icon>{toast}</div>}
      <div className="scroll-area">
        <header className="topbar">
          <button
            className="wordmark"
            onClick={() => setTab("home")}
            aria-label={`${settings.shop_name} home`}
          >
            {settings.logo_url ? (
              <img
                className="brand-mark brand-image"
                src={settings.logo_url}
                alt=""
              />
            ) : (
              <span className="brand-mark">KP</span>
            )}
            <span>
              <strong>{settings.shop_name}</strong>
              <small>Dad’s secret, sip of tradition</small>
            </span>
          </button>
          <button
            className="icon-button"
            aria-label="Open profile"
            onClick={() => requestTab("profile")}
          >
            <Icon>
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
            </Icon>
          </button>
        </header>

        {tab === "home" && (
          <HomePage
            campaigns={campaigns}
            slide={slide}
            setSlide={setSlide}
            auth={auth}
            greetingName={
              profile.display_name.trim() || user?.email?.split("@")[0] || ""
            }
            fulfillment={fulfillment}
            selectPickup={selectPickup}
            showDeliverySoon={showDeliverySoon}
            requestTab={requestTab}
            settings={settings}
            selectedStore={selectedStore}
            lastOrder={orders[0]}
            queue={queue}
            rewardSettings={rewardSettings}
            rewardBalance={rewardBalance}
            activeVoucherCount={
              userVouchers.filter(
                (v) =>
                  v.status === "active" &&
                  (!v.expires_at ||
                    new Date(v.expires_at).getTime() > Date.now()),
              ).length
            }
          />
        )}
        {tab === "menu" && (
          <MenuPage
            menu={menu}
            categories={categories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            jumpToCategory={jumpToCategory}
            cartCount={cartCount}
            cartTotal={cartTotal}
            cart={cart}
            setSelectedItem={(item) => {
              setTemperature("Iced");
              setDrinkSize("Regular");
              setSheetQuantity(1);
              setSelectedItem(item);
            }}
            settings={settings}
            selectedStore={selectedStore}
            queue={queue}
            storeIsOpen={selectedStoreIsOpen}
            showStoreDetails={() => setStoreDetailsOpen(true)}
            changeStore={() => setStoreOpen(true)}
          />
        )}
        {tab === "orders" && (
          <OrdersPage
            orders={orders}
            placedOrder={placedOrder}
            onBrowse={() => requestTab("menu")}
            openOrder={setDetailOrder}
          />
        )}
        {tab === "rewards" && (
          <RewardsPage
            settings={rewardSettings}
            balance={rewardBalance}
            templates={rewardTemplates}
            vouchers={userVouchers}
            rewardGrant={rewardGrant}
            announceGrant={setRewardGrant}
            refresh={() => loadRewards()}
          />
        )}
        {tab === "profile" && (
          <ProfilePage
            email={email}
            profile={profile}
            save={async (next) => {
              if (!user) return "Sign in to save your profile.";
              const { error } = await supabase
                .from("profiles")
                .upsert(
                  {
                    user_id: user.id,
                    display_name: next.display_name.trim() || null,
                    phone: next.phone.trim() || null,
                  },
                  { onConflict: "user_id" },
                );
              if (error) return error.message;
              setProfile(next);
              await supabase.auth.updateUser({
                data: { display_name: next.display_name.trim() },
              });
              return "";
            }}
            onSignOut={async () => {
              await supabase.auth.signOut();
              setUser(null);
              setProfile({ display_name: "", phone: "" });
              setAuth("none");
              setTab("home");
              setCart({});
              setOrders([]);
              setPlacedOrder(false);
            }}
            onDeleteAccount={async () => {
              const { data, error } = await supabase.functions.invoke("delete-my-account", { body: {} });
              if (error || data?.error) return data?.error ?? error?.message ?? "Account deletion failed.";
              await supabase.auth.signOut({ scope: "local" });
              setUser(null);
              setProfile({ display_name: "", phone: "" });
              setAuth("none");
              setTab("home");
              setCart({});
              setOrders([]);
              setPlacedOrder(false);
              return "";
            }}
          />
        )}
      </div>

      {cartCount > 0 && tab === "menu" && (
        <button className="cart-bar" onClick={openCart}>
          <span className="cart-count">{cartCount}</span>
          <span>View cart</span>
          <strong>RM {cartTotal.toFixed(2)}</strong>
          <Icon size={18}>
            <path d="m9 18 6-6-6-6" />
          </Icon>
        </button>
      )}
      <BottomNav tab={tab} requestTab={requestTab} menuLocked={!fulfillment} />

      {selectedItem && (
        <BottomSheet close={() => setSelectedItem(null)}>
          <section
            className="customization-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customize-title"
          >
            <button
              className="sheet-close"
              onClick={() => setSelectedItem(null)}
              aria-label="Close customization"
            >
              <Icon>
                <path d="m6 6 12 12M18 6 6 18" />
              </Icon>
            </button>
            {selectedItem.image && <img src={selectedItem.image} alt="" />}
            <div className="sheet-content">
              <h2 id="customize-title">{selectedItem.name}</h2>
              <p>{selectedItem.description}</p>
              <fieldset>
                <legend>Temperature</legend>
                <div className="choice-row">
                  {["Iced", "Hot"].map((choice) => (
                    <button
                      type="button"
                      className={temperature === choice ? "active" : ""}
                      onClick={() => setTemperature(choice)}
                      key={choice}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Size</legend>
                <div className="choice-row">
                  {["Regular", "Large +RM 1.00"].map((choice) => (
                    <button
                      type="button"
                      className={drinkSize === choice ? "active" : ""}
                      onClick={() => setDrinkSize(choice)}
                      key={choice}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="quantity-row">
                <span>
                  <strong>Quantity</strong>
                  <small>How many would you like?</small>
                </span>
                <div>
                  <button
                    onClick={() => setSheetQuantity((q) => Math.max(1, q - 1))}
                    disabled={sheetQuantity === 1}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <b>{sheetQuantity}</b>
                  <button
                    onClick={() => setSheetQuantity((q) => Math.min(20, q + 1))}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
              {!selectedStoreIsOpen && (
                <p className="closed-message" role="status">
                  This store is closed. You can still browse the menu.
                </p>
              )}
              <button
                className="sheet-add"
                disabled={!selectedStoreIsOpen}
                onClick={() => gatedAdd(selectedItem)}
              >
                <span>
                  {selectedStoreIsOpen
                    ? `Add ${sheetQuantity} to cart`
                    : "Store closed"}
                </span>
                <strong>
                  {selectedStoreIsOpen
                    ? `RM ${((selectedItem.price + (drinkSize.startsWith("Large") ? 1 : 0)) * sheetQuantity).toFixed(2)}`
                    : storeHours(selectedStore)}
                </strong>
              </button>
            </div>
          </section>
        </BottomSheet>
      )}
      {fulfillmentOpen && (
        <FulfillmentSheet
          deliverySoon={deliverySoon}
          selectPickup={selectPickup}
          showDeliverySoon={showDeliverySoon}
          close={() => {
            setFulfillmentOpen(false);
            setDeliverySoon(false);
          }}
        />
      )}
      {storeOpen && (
        <StoreSheet
          stores={stores}
          loading={loadingStores}
          error={storeError}
          selected={selectedStore}
          choose={confirmStore}
          close={() => setStoreOpen(false)}
        />
      )}
      {storeDetailsOpen && selectedStore && (
        <StoreDetailsSheet
          store={selectedStore}
          open={selectedStoreIsOpen}
          changeStore={() => {
            setStoreDetailsOpen(false);
            setStoreOpen(true);
          }}
          close={() => setStoreDetailsOpen(false)}
        />
      )}
      {authOpen && (
        <AuthSheet
          initialView={authView}
          accountRequired={pending?.kind === "nav" && pending.tab === "rewards"}
          error={authError}
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          submitLogin={submitLogin}
          signup={submitSignUp}
          oauth={signInWithProvider}
          sendPasswordReset={sendPasswordReset}
          resendConfirmation={resendConfirmation}
          updatePassword={updatePassword}
          close={() => {
            setAuthOpen(false);
            setPending(null);
            setAuthError("");
          }}
        />
      )}
      {cartOpen && selectedStore && (
        <CheckoutPage
          error={authError}
          busy={orderBusy}
          auth={auth}
          store={selectedStore}
          etaMinutes={queue.etaMinutes}
          cartItems={cartItems}
          subtotal={cartTotal}
          vouchers={userVouchers}
          updateQuantity={(key, delta) =>
            setCart((current) => {
              const line = current[key];
              if (!line) return current;
              const quantity = Math.max(0, Math.min(20, line.quantity + delta));
              if (quantity === 0) {
                const next = { ...current };
                delete next[key];
                return next;
              }
              return { ...current, [key]: { ...line, quantity } };
            })
          }
          remove={(key) =>
            setCart((current) => {
              const next = { ...current };
              delete next[key];
              return next;
            })
          }
          addRecommended={(item) => {
            const key = `${item.id}-Standard-Regular`;
            addLine({
              key,
              itemId: item.id,
              quantity: 1,
              temperature: "Standard",
              size: "Regular",
              unitPrice: item.price,
              itemName: item.name,
              image: item.image,
              source: "upsell",
            });
          }}
          addMore={() => {
            setCartOpen(false);
            setTab("menu");
          }}
          close={() => setCartOpen(false)}
          placeOrder={placeOrder}
        />
      )}
      {detailOrder && (
        <OrderDetails
          order={detailOrder}
          queue={queue}
          close={() => setDetailOrder(null)}
          reorder={() => reorder(detailOrder)}
        />
      )}
    </div>
  );
}

function HomePage({
  campaigns,
  slide,
  setSlide,
  auth,
  greetingName,
  fulfillment,
  selectPickup,
  showDeliverySoon,
  requestTab,
  settings,
  selectedStore,
  lastOrder,
  queue,
  rewardSettings,
  rewardBalance,
  activeVoucherCount,
}: {
  campaigns: { title: string; copy: string; image: string }[];
  slide: number;
  setSlide: (value: number) => void;
  auth: AuthState;
  greetingName: string;
  fulfillment: "pickup" | null;
  selectPickup: () => void;
  showDeliverySoon: () => void;
  requestTab: (tab: AppTab) => void;
  settings: ShopSettings;
  selectedStore: Store | null;
  lastOrder?: CustomerOrder;
  queue: QueueMetric;
  rewardSettings: RewardSettings;
  rewardBalance: {
    points_balance: number;
    stamp_count: number;
    lifetime_points: number;
  };
  activeVoucherCount: number;
}) {
  const campaign = campaigns[slide];
  const rewardMetricCount =
    1 +
    Number(rewardSettings.points_enabled) +
    Number(rewardSettings.stamp_enabled);
  const showRewardSummary = auth === "email" && rewardMetricCount > 1;
  const showVoucherGreeting = auth === "email" && rewardMetricCount === 1;
  return (
    <main className="home-page">
      <section className="home-welcome">
        <div>
          <span>{auth === "none" ? "Welcome to" : "Good to see you,"}</span>
          <h1>
            {auth === "email" ? greetingName : settings.shop_name}
          </h1>
          <p>Pickup ordering, made comfortably quick.</p>
        </div>
        {showVoucherGreeting && (
          <button
            className="welcome-voucher"
            onClick={() => requestTab("rewards")}
            aria-label={`${activeVoucherCount} ${activeVoucherCount === 1 ? "voucher" : "vouchers"} available. Open rewards.`}
          >
            <span className="welcome-voucher-icon">
              <Icon size={34}>
                <path d="M5 7h14v3a2.5 2.5 0 0 0 0 5v3H5v-3a2.5 2.5 0 0 0 0-5V7Z" />
                <path d="M10 7v11" strokeDasharray="2 2" />
              </Icon>
              <strong>{activeVoucherCount}</strong>
            </span>
            <small>{activeVoucherCount === 1 ? "Voucher" : "Vouchers"}</small>
          </button>
        )}
      </section>
      <section className="fulfillment-choices" aria-label="Choose order type">
        <button
          disabled={!settings.accepting_pickup}
          className={fulfillment === "pickup" ? "active" : ""}
          onClick={selectPickup}
        >
          <Icon>
            <path d="M6 8h12l-1 12H7L6 8Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </Icon>
          <span>
            <strong>{selectedStore?.name ?? "Choose pickup store"}</strong>
            <small>
              {selectedStore
                ? storeHours(selectedStore)
                : "Select a branch to continue"}
            </small>
          </span>
        </button>
        <button onClick={showDeliverySoon}>
          <Icon>
            <path d="M3 7h12v10H3zM15 10h3l3 3v4h-6z" />
            <circle cx="7" cy="19" r="2" />
            <circle cx="18" cy="19" r="2" />
          </Icon>
          <span>
            <strong>Delivery</strong>
            <small>Coming soon</small>
          </span>
        </button>
      </section>
      {selectedStore && (
        <section className="brewing-banner" role="status" aria-atomic="true">
          <span className="brewing-icon">
            <Icon>
              <path d="M7 8h10l-1 12H8L7 8ZM9 4h6M18 10h2a2 2 0 0 1 0 4h-3" />
            </Icon>
          </span>
          <span>
            <strong>Now Brewing</strong>
            <small>
              {queue.activeCups} {queue.activeCups === 1 ? "cup" : "cups"} in
              the queue at {selectedStore.name}
            </small>
          </span>
          <span className="brewing-eta">
            <small>Estimated wait</small>
            <strong>{queue.etaMinutes} min</strong>
          </span>
        </section>
      )}
      {showRewardSummary && (
        <section className="home-reward-overview">
          <h2>My Reward</h2>
          <button
            className={`home-reward-metrics metrics-${rewardMetricCount}`}
            onClick={() => requestTab("rewards")}
            aria-label="Open My Rewards"
          >
            <span className="reward-metric">
              <Icon size={31}>
                <path d="M5 7h14v3a2.5 2.5 0 0 0 0 5v3H5v-3a2.5 2.5 0 0 0 0-5V7Z" />
                <path d="M10 7v11" strokeDasharray="2 2" />
              </Icon>
              <strong>{activeVoucherCount}</strong>
              <small>Vouchers</small>
            </span>
            {rewardSettings.points_enabled && (
              <span className="reward-metric">
                <Icon size={30}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9 8h4a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h4M12 6v12" />
                </Icon>
                <strong>{rewardBalance.points_balance.toLocaleString()}</strong>
                <small>Points</small>
              </span>
            )}
            {rewardSettings.stamp_enabled && (
              <span className="reward-metric">
                <img
                  className="reward-mascot-icon"
                  src="/kopi-papa-mascot-stamp.png"
                  alt=""
                />
                <strong>
                  {rewardBalance.stamp_count}
                  <i>/</i>
                  {rewardSettings.stamp_threshold}
                </strong>
                <small>Stamps</small>
              </span>
            )}
          </button>
        </section>
      )}
      {campaign ? (
        <section
          className="campaign-carousel"
          style={{
            backgroundImage: `linear-gradient(90deg,rgba(8,17,60,.86),rgba(8,17,60,.18)),url(${campaign.image})`,
          }}
          aria-label="Featured stories"
        >
          <div>
            <span>Featured</span>
            <h2>{campaign.title}</h2>
            <p>{campaign.copy}</p>
            <button onClick={() => requestTab("menu")}>
              Browse menu{" "}
              <Icon size={17}>
                <path d="m9 18 6-6-6-6" />
              </Icon>
            </button>
          </div>
          {campaigns.length > 1 && (
            <div className="carousel-controls">
              <button
                onClick={() =>
                  setSlide((slide + campaigns.length - 1) % campaigns.length)
                }
                aria-label="Previous story"
              >
                <Icon size={18}>
                  <path d="m15 18-6-6 6-6" />
                </Icon>
              </button>
              <span>
                {campaigns.map((_, index) => (
                  <button
                    key={index}
                    className={index === slide ? "active" : ""}
                    onClick={() => setSlide(index)}
                    aria-label={`Show story ${index + 1}`}
                  />
                ))}
              </span>
              <button
                onClick={() => setSlide((slide + 1) % campaigns.length)}
                aria-label="Next story"
              >
                <Icon size={18}>
                  <path d="m9 18 6-6-6-6" />
                </Icon>
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No featured campaigns</h2>
          <p>Published campaigns will appear here.</p>
        </section>
      )}
      <section className="last-order">
        <h2>Your Last Order</h2>
        {lastOrder ? (
          <button onClick={() => requestTab("orders")}>
            <span className="last-order-image">
              {lastOrder.order_items?.[0]?.products?.image_url ? (
                <img
                  src={lastOrder.order_items[0].products!.image_url}
                  alt=""
                />
              ) : (
                <Icon>
                  <path d="M6 3h12v18H6z" />
                  <path d="M9 8h6M9 12h6" />
                </Icon>
              )}
            </span>
            <span>
              <strong>{lastOrder.order_number}</strong>
              <small>
                {lastOrder.order_items
                  ?.map((line) => `${line.quantity}× ${line.product_name}`)
                  .join(", ") || "Pickup order"}
              </small>
              <small>
                {new Date(lastOrder.created_at).toLocaleDateString()} · RM{" "}
                {(lastOrder.total_cents / 100).toFixed(2)}
              </small>
            </span>
            <StatusBadge status={lastOrder.status} />
            <Icon size={18}>
              <path d="m9 18 6-6-6-6" />
            </Icon>
          </button>
        ) : (
          <div className="last-order-empty">
            <span>No previous orders yet.</span>
            <button onClick={() => requestTab("menu")}>Browse menu</button>
          </div>
        )}
      </section>
      <p className="prototype-note home-note">
        Live menu and campaigns · Pickup timing is estimated
      </p>
    </main>
  );
}

function categoryIcon(name: string) {
  const key = name.toLowerCase();
  if (key.includes("popular")) return "/category-icons/popular.svg";
  if (key.includes("matcha")) return "/category-icons/matcha-series.svg";
  if (
    key.includes("fruit") ||
    key.includes("refresher") ||
    key.includes("non-coffee")
  )
    return "/category-icons/fruity-refreshers.svg";
  if (key.includes("bite") || key.includes("food"))
    return "/category-icons/bites.svg";
  if (key.includes("local") || key.includes("kopi") || key.includes("classic"))
    return "/category-icons/local-kopi.svg";
  return "/category-icons/signature-lattes.svg";
}
function MenuPage({
  menu,
  categories,
  activeCategory,
  setActiveCategory,
  jumpToCategory,
  cartCount,
  cartTotal,
  cart,
  setSelectedItem,
  settings,
  selectedStore,
  queue,
  storeIsOpen,
  showStoreDetails,
  changeStore,
}: {
  menu: MenuItem[];
  categories: MenuCategory[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  jumpToCategory: (category: string) => void;
  cartCount: number;
  cartTotal: number;
  cart: Record<string, CartLine>;
  setSelectedItem: (item: MenuItem) => void;
  settings: ShopSettings;
  selectedStore: Store | null;
  queue: QueueMetric;
  storeIsOpen: boolean;
  showStoreDetails: () => void;
  changeStore: () => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!selectedStore) return;
    const root = document.querySelector(".scroll-area");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const category = visible?.target.id.replace(/^category-/, "");
        if (category) setActiveCategory(category);
      },
      { root, rootMargin: "-150px 0px -55% 0px", threshold: [0.15, 0.35, 0.6] },
    );
    categories.forEach((category) => {
      const section = document.getElementById(`category-${category.name}`);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [categories, setActiveCategory, selectedStore]);
  const storeName = selectedStore?.name ?? settings.shop_name;
  const filtered = menu.filter((item) =>
    `${item.name} ${item.description} ${item.category}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <section className="order-context menu-context">
        <div className="mode-row">
          <button className="mode-button active">
            <Icon size={18}>
              <path d="M6 8h12l-1 12H7L6 8Z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </Icon>
            Pickup
          </button>
          <span className={`single-store ${storeIsOpen ? "" : "closed"}`}>
            {storeIsOpen ? storeHours(selectedStore) : "Closed"}
          </span>
        </div>
        <div className="store-row">
          <button
            className="store-summary-button"
            onClick={showStoreDetails}
            aria-label={`View ${storeName} details`}
          >
            <span className="store-icon">
              <Icon>
                <path d="M4 10h16" />
                <path d="m5 10 1-5h12l1 5" />
                <path d="M6 10v9h12v-9" />
              </Icon>
            </span>
            <span>
              <small>Collect from</small>
              <strong>{storeName}</strong>
            </span>
          </button>
          <button className="change-store" onClick={changeStore}>
            <Icon size={17}>
              <path d="M4 20h4l10-10-4-4L4 16v4ZM12 8l4 4" />
            </Icon>
            Change
          </button>
        </div>
        <div
          className="wait-strip"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="pulse-dot" />
          <span>Now brewing</span>
          <strong>
            {queue.activeCups} {queue.activeCups === 1 ? "cup" : "cups"}
          </strong>
          <span className="wait-note">About {queue.etaMinutes} min</span>
        </div>
      </section>
      <label className="menu-search">
        <Icon size={19}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </Icon>
        <span className="sr-only">Search menu</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search drinks and bites"
        />
        <span>{filtered.length}</span>
      </label>
      <main className="menu-layout">
        <aside className="category-rail" aria-label="Menu categories">
          {categories.map((category) => (
            <button
              key={category.name}
              className={activeCategory === category.name ? "active" : ""}
              onClick={() => jumpToCategory(category.name)}
            >
              <img
                className="category-symbol"
                src={category.image || categoryIcon(category.name)}
                alt=""
              />
              <span>{category.name}</span>
            </button>
          ))}
        </aside>
        <div className="menu-content">
          {filtered.length ? (
            categories.map((category) => {
              const items = filtered.filter(
                (item) => item.category === category.name,
              );
              return items.length ? (
                <section
                  className="menu-section"
                  id={`category-${category.name}`}
                  key={category.name}
                >
                  <div className="section-heading">
                    <h2>{category.name}</h2>
                    <span>{items.length} items</span>
                  </div>
                  <div className="product-list">
                    {items.map((item) => (
                      <article className="product" key={item.id}>
                        <button
                          className="product-image"
                          disabled={!storeIsOpen}
                          onClick={() => setSelectedItem(item)}
                          aria-label={
                            storeIsOpen
                              ? `Customize ${item.name}`
                              : `${item.name}, store closed`
                          }
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              loading="lazy"
                            />
                          ) : (
                            <span>{item.name.slice(0, 2).toUpperCase()}</span>
                          )}
                          {item.badge && <span>{item.badge}</span>}
                        </button>
                        <div className="product-copy">
                          <button
                            className="product-name"
                            disabled={!storeIsOpen}
                            onClick={() => setSelectedItem(item)}
                          >
                            {item.name}
                          </button>
                          <p>{item.description}</p>
                          <div className="product-footer">
                            <strong>RM {item.price.toFixed(2)}</strong>
                            <button
                              className="add-button"
                              disabled={!storeIsOpen}
                              onClick={() => setSelectedItem(item)}
                              aria-label={
                                storeIsOpen
                                  ? `Customize ${item.name}`
                                  : `${item.name} unavailable while store is closed`
                              }
                            >
                              <Icon size={19}>
                                <path d="M12 5v14M5 12h14" />
                              </Icon>
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null;
            })
          ) : (
            <section className="empty-state">
              <h2>No menu items found</h2>
              <p>Try a different drink name or category.</p>
            </section>
          )}
        </div>
        <aside className="desktop-summary" aria-label="Current order summary">
          <span>Current order</span>
          <h2>Your pickup</h2>
          {cartCount === 0 ? (
            <p>
              {storeIsOpen
                ? "Choose a drink to start your order."
                : "This store is closed. The menu remains available to browse."}
            </p>
          ) : (
            <>
              <div className="summary-count">
                <strong>{cartCount} items</strong>
                <span>RM {cartTotal.toFixed(2)}</span>
              </div>
              <p>{Object.keys(cart).length} customized selections.</p>
            </>
          )}
          <div className="summary-detail">
            <small>Collect from</small>
            <strong>{storeName}</strong>
            <small>Opening hours</small>
            <strong>{storeHours(selectedStore)}</strong>
          </div>
        </aside>
      </main>
    </>
  );
}

function OrdersPage({
  orders,
  placedOrder,
  onBrowse,
  openOrder,
}: {
  orders: CustomerOrder[];
  placedOrder: boolean;
  onBrowse: () => void;
  openOrder: (order: CustomerOrder) => void;
}) {
  const active = orders.filter(
      (order) => !["completed", "cancelled"].includes(order.status),
    ),
    history = orders.filter((order) =>
      ["completed", "cancelled"].includes(order.status),
    );
  return (
    <main className="simple-page orders-page">
      <header>
        <h1>Your orders</h1>
        <p>Track preparation and open any past receipt.</p>
      </header>
      {active.length ? (
        <section className="order-group active-group">
          <h2>Active orders</h2>
          {active.map((order) => (
            <div className="active-order-card" key={order.id}>
              <div className="active-order-head">
                <span>
                  <small>{order.order_number}</small>
                  <strong>{order.stores?.name ?? "Pickup order"}</strong>
                </span>
                <StatusBadge status={order.status} paymentStatus={order.payment_status} />
              </div>
              <OrderStepper status={order.status} paymentStatus={order.payment_status} />
              <button className="open-order" onClick={() => openOrder(order)}>
                View order details{" "}
                <Icon size={17}>
                  <path d="m9 18 6-6-6-6" />
                </Icon>
              </button>
            </div>
          ))}
        </section>
      ) : placedOrder ? (
        <p className="order-loading">Loading your latest order…</p>
      ) : null}
      <section className="order-group history-group">
        <h2>Order History</h2>
        {history.length ? (
          history.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              open={() => openOrder(order)}
            />
          ))
        ) : (
          <div className="history-empty">
            <span>No completed orders yet.</span>
          </div>
        )}
      </section>
      {!orders.length && !placedOrder && (
        <section className="empty-state">
          <span className="empty-icon">
            <Icon size={34}>
              <path d="M6 3h12v18H6z" />
              <path d="M9 8h6M9 12h6M9 16h4" />
            </Icon>
          </span>
          <h2>No orders yet</h2>
          <p>
            Your active and previous orders will appear here after checkout.
          </p>
          <button onClick={onBrowse}>Browse the menu</button>
        </section>
      )}
    </main>
  );
}

function StatusBadge({ status, paymentStatus }: { status: string; paymentStatus?: string }) {
  if (paymentStatus === "pending") return <span className="order-status verifying">Verifying Payment</span>;
  if (paymentStatus === "failed" || paymentStatus === "cancelled") return <span className="order-status payment-failed">Payment Failed</span>;
  const label =
    status === "completed"
      ? "Picked Up"
      : status === "cancelled"
        ? "Cancelled"
        : status === "preparing"
          ? "Preparing"
          : status === "ready"
            ? "Ready"
            : "Received";
  return <span className={`order-status ${status}`}>{label}</span>;
}
function OrderCard({
  order,
  open,
}: {
  order: CustomerOrder;
  open: () => void;
}) {
  const first = order.order_items?.[0];
  return (
    <article className="history-card">
      <button className="history-summary" onClick={open}>
        <span className="history-image">
          {first?.products?.image_url ? (
            <img src={first.products.image_url} alt="" />
          ) : (
            <Icon>
              <path d="M6 3h12v18H6z" />
              <path d="M9 8h6M9 12h6" />
            </Icon>
          )}
        </span>
        <span className="history-copy">
          <small>{order.order_number}</small>
          <strong>
            {first
              ? `${first.product_name}${order.order_items.length > 1 ? ` +${order.order_items.length - 1} more` : ""}`
              : "Pickup order"}
          </strong>
          <small>{new Date(order.created_at).toLocaleString()}</small>
        </span>
        <StatusBadge status={order.status} />
        <Icon size={18}>
          <path d="m9 18 6-6-6-6" />
        </Icon>
      </button>
    </article>
  );
}
function OrderStepper({ status, paymentStatus = "paid" }: { status: string; paymentStatus?: string }) {
  const failed = paymentStatus === "failed" || paymentStatus === "cancelled";
  const pendingPayment = paymentStatus === "pending";
  const normalized = status.toLowerCase().replaceAll("_", " "),
    complete = ["ready", "picked up", "completed", "done"].includes(normalized),
    step = complete ? 3 : normalized === "preparing" ? 2 : 1;
  const labels = [failed ? "Payment Failed" : pendingPayment ? "Verifying Payment" : "Order Accepted", "Preparing Order", "Ready to Pick Up"];
  return (
    <ol className="order-stepper" aria-label="Order progress">
      {labels.map((label, index) => {
        const position = index + 1,
          done = position <= step;
        return (
          <li className={failed && position === 1 ? "failed" : !failed && !pendingPayment && done ? "done" : pendingPayment && position === 1 ? "verifying" : ""} key={label}>
            <span>
              {failed && position === 1 ? <Icon size={16}><path d="m6 6 12 12M18 6 6 18" /></Icon> : pendingPayment && position === 1 ? <Icon size={16}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></Icon> : (done && position < 3) || complete ? (
                <Icon size={16}>
                  <path d="m5 12 4 4L19 6" />
                </Icon>
              ) : (
                position
              )}
            </span>
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}
function OrderDetails({
  order,
  queue,
  close,
  reorder,
}: {
  order: CustomerOrder;
  queue: QueueMetric;
  close: () => void;
  reorder: () => void;
}) {
  const [contactOpen, setContactOpen] = useState(false);
  const active = !["completed", "cancelled"].includes(order.status);
  const pickupTime = new Date(
    Date.now() + queue.etaMinutes * 60000,
  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="order-detail-layer">
      <section
        className="order-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
      >
        <header>
          <button onClick={close} aria-label="Back to orders">
            <Icon>
              <path d="m15 18-6-6 6-6" />
            </Icon>
          </button>
          <span>
            <small>Order details</small>
            <h2 id="order-detail-title">{order.order_number}</h2>
          </span>
          <span className="order-header-actions">
            <button onClick={() => setContactOpen(true)} aria-label="Contact this store">
              <Icon><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 13h3v6H5a2 2 0 0 1-1-2v-4ZM20 13h-3v6h2a2 2 0 0 0 1-2v-4ZM17 19c0 2-2 2-4 2"/></Icon>
            </button>
            <StatusBadge status={order.status} paymentStatus={order.payment_status} />
          </span>
        </header>
        {order.status !== "cancelled" && <OrderStepper status={order.status} paymentStatus={order.payment_status} />}
        {order.payment_status === "pending" && <div className="payment-recovery pending" role="status"><strong>Verifying your payment</strong><span>HitPay confirmation can take a moment. Preparation starts only after payment is confirmed.</span></div>}
        {(order.payment_status === "failed" || order.payment_status === "cancelled") && <div className="payment-recovery failed" role="alert"><strong>Payment was not completed</strong><span>Your order has not been accepted by the store. Try ordering again or contact this branch for help.</span></div>}
        <main>
          <section className="detail-card pickup-detail">
            <span className="detail-card-icon">
              <Icon>
                <path d="M4 10h16M5 10l1-5h12l1 5M6 10v9h12v-9" />
              </Icon>
            </span>
            <span>
              <small>Pickup location</small>
              <strong>{order.stores?.name ?? "Kopi Papa"}</strong>
              <p>{order.stores?.address ?? "Store address unavailable"}</p>
            </span>
            <span className="pickup-time">
              <small>{active ? "Estimated pickup" : "Order status"}</small>
              <strong>
                {active
                  ? pickupTime
                  : order.status === "completed"
                    ? "Picked up"
                    : "Cancelled"}
              </strong>
            </span>
          </section>
          <section className="detail-card order-summary">
            <h3>Order summary</h3>
            {order.order_items.map((line) => (
              <div className="detail-line" key={line.id}>
                <span className="detail-image">
                  {line.products?.image_url ? (
                    <img src={line.products.image_url} alt="" />
                  ) : (
                    <Icon>
                      <path d="M7 8h10l-1 12H8L7 8Z" />
                    </Icon>
                  )}
                </span>
                <span>
                  <strong>
                    {line.quantity}× {line.product_name}
                  </strong>
                  <small>
                    {[line.customization?.temperature, line.customization?.size]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <b>
                  RM{" "}
                  {((line.unit_price_cents * line.quantity) / 100).toFixed(2)}
                </b>
              </div>
            ))}
            <div className="detail-total">
              <span>Total</span>
              <strong>RM {(order.total_cents / 100).toFixed(2)}</strong>
            </div>
          </section>
          <section className="detail-card payment-detail enhanced-payment">
            <h3>Payment details</h3>
            <div className="payment-method-head">
              <span className={`payment-brand ${order.payment_method ?? "unknown"}`}>{order.payment_method === "fpx" ? "FPX" : order.payment_method === "touch_n_go" ? "TNG" : "—"}</span>
              <span><small>Payment method</small><strong>{order.payment_method === "touch_n_go" ? "Touch ’n Go eWallet" : order.payment_method === "fpx" ? `FPX Online Banking${order.payment_bank ? ` · ${order.payment_bank.replaceAll("_", " ")}` : ""}` : "Not selected"}</strong></span>
              <em className={`payment-status ${order.payment_status}`}>{order.payment_status === "paid" ? "Paid" : order.payment_status === "pending" ? "Verifying Payment" : order.payment_status}</em>
            </div>
            <div className="payment-breakdown">
              <span>Subtotal</span><strong>RM {((order.subtotal ?? order.total_cents) / 100).toFixed(2)}</strong>
              <span>Voucher discount</span><strong className="negative">− RM {((order.discount_amount ?? 0) / 100).toFixed(2)}</strong>
              <span>Fees / taxes</span><strong>RM {((order.tax_amount ?? 0) / 100).toFixed(2)}</strong>
            </div>
            <div className="payment-grand-total"><span>Grand total</span><strong>RM {((order.final_total ?? order.total_cents) / 100).toFixed(2)}</strong></div>
          </section>
        </main>
        <footer>
          <button onClick={reorder}>
            <Icon>
              <path d="M4 12a8 8 0 1 0 3-6M4 4v6h6" />
            </Icon>
            {order.payment_status === "failed" || order.payment_status === "cancelled" ? "Try Again" : "Order Again"}
          </button>
          {(order.payment_status === "failed" || order.payment_status === "cancelled") && order.stores?.phone && <a className="contact-support" href={`https://wa.me/${whatsappNumber(order.stores.phone)}`} target="_blank" rel="noreferrer"><Icon><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5Z"/></Icon>Contact Support</a>}
        </footer>
      </section>
      {contactOpen && <div className="contact-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setContactOpen(false); }}>
        <section className="contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-title">
          <button className="contact-close" onClick={() => setContactOpen(false)} aria-label="Close contact details"><Icon><path d="m6 6 12 12M18 6 6 18"/></Icon></button>
          <span className="contact-headphones"><Icon size={28}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 13h3v6H5a2 2 0 0 1-1-2v-4ZM20 13h-3v6h2a2 2 0 0 0 1-2v-4Z"/></Icon></span>
          <h3 id="contact-title">Contact {order.stores?.name ?? "this store"}</h3>
          <p>Our team can help with collection and order questions during branch hours.</p>
          <div><small>Working hours</small><strong>{storeHours(order.stores ?? null)}</strong></div>
          {order.stores?.phone ? <a href={`https://wa.me/${whatsappNumber(order.stores.phone)}`} target="_blank" rel="noreferrer"><Icon><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5Z"/></Icon>Contact Us on WhatsApp</a> : <button disabled>WhatsApp number unavailable</button>}
        </section>
      </div>}
    </div>
  );
}

function StampCard({ count, target }: { count: number; target: number }) {
  const [animatedIndex, setAnimatedIndex] = useState(-1);
  useEffect(() => {
    const key = "kopi-papa-last-seen-stamps",
      stored = window.localStorage.getItem(key);
    if (stored === null) {
      window.localStorage.setItem(key, String(count));
      return;
    }
    const seen = Number(stored);
    window.localStorage.setItem(key, String(count));
    if (count > seen) {
      setAnimatedIndex(Math.min(count, target) - 1);
      const timer = window.setTimeout(() => setAnimatedIndex(-1), 900);
      return () => window.clearTimeout(timer);
    }
  }, [count, target]);
  return (
    <section className="stamp-balance">
      <div className="stamp-heading">
        <span>Your stamp card</span>
        <strong>
          {count}
          <i>/</i>
          {target}
        </strong>
        <small>CUPS</small>
      </div>
      <div
        className="stamp-track"
        style={{ "--stamp-columns": Math.ceil(target / 2) } as CSSProperties}
        aria-label={`${count} of ${target} stamps`}
      >
        {Array.from({ length: target }, (_, i) => (
          <span
            className={`${i < count ? "filled" : ""} ${i === animatedIndex ? "just-stamped" : ""}`}
            key={i}
          >
            {i < count ? (
              <img src="/kopi-papa-mascot-stamp.png" alt="" />
            ) : (
              <Icon size={20}>
                <path d="M7 8h10l-1 12H8L7 8ZM9 5h6" />
              </Icon>
            )}
            {i === animatedIndex && (
              <i className="stamp-sparks" aria-hidden="true">
                <b />
                <b />
                <b />
                <b />
              </i>
            )}
          </span>
        ))}
      </div>
      <p>Your next voucher is created automatically when the card is full.</p>
    </section>
  );
}

function RewardsPage({
  settings,
  balance,
  templates,
  vouchers,
  rewardGrant,
  announceGrant,
  refresh,
}: {
  settings: RewardSettings;
  balance: {
    points_balance: number;
    stamp_count: number;
    lifetime_points: number;
  };
  templates: RewardTemplate[];
  vouchers: UserVoucher[];
  rewardGrant: RewardGrant;
  announceGrant: (grant: RewardGrant) => void;
  refresh: () => Promise<void>;
}) {
  const [view, setView] = useState<"mine" | "shop">("mine"),
    [history, setHistory] = useState(false),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [insufficient, setInsufficient] = useState<RewardTemplate | null>(null),
    [newVoucherId, setNewVoucherId] = useState<number | null>(null),
    [pendingStampVoucherId, setPendingStampVoucherId] = useState<number | null>(
      null,
    ),
    [showFullStampBoard, setShowFullStampBoard] = useState(false);
  const lastCelebratedId = useRef<number | null>(null),
    celebrationTimers = useRef<number[]>([]);
  const now = Date.now(),
    active = vouchers.filter(
      (v) =>
        v.id !== pendingStampVoucherId &&
        v.status === "active" &&
        (!v.expires_at || new Date(v.expires_at).getTime() > now),
    ),
    past = vouchers.filter(
      (v) =>
        v.status !== "active" ||
        (v.expires_at && new Date(v.expires_at).getTime() <= now),
    ),
    shop = templates.filter((v) => v.available_in_shop && v.point_cost);
  useEffect(() => {
    if (!settings.points_enabled && view === "shop") setView("mine");
  }, [settings.points_enabled, view]);
  useEffect(
    () => () =>
      celebrationTimers.current.forEach((timer) => window.clearTimeout(timer)),
    [],
  );
  useEffect(() => {
    if (!rewardGrant || lastCelebratedId.current === rewardGrant.id) return;
    lastCelebratedId.current = rewardGrant.id;
    setView("mine");
    setHistory(false);
    if (rewardGrant.source === "stamp_reward") {
      setPendingStampVoucherId(rewardGrant.id);
      setShowFullStampBoard(true);
      celebrationTimers.current.push(
        window.setTimeout(() => {
          setShowFullStampBoard(false);
          setPendingStampVoucherId(null);
          setNewVoucherId(rewardGrant.id);
        }, 1100),
      );
    } else setNewVoucherId(rewardGrant.id);
    announceGrant(null);
  }, [rewardGrant, announceGrant]);
  useEffect(() => {
    if (newVoucherId === null) return;
    const timer = window.setTimeout(() => setNewVoucherId(null), 1500);
    celebrationTimers.current.push(timer);
    return () => window.clearTimeout(timer);
  }, [newVoucherId]);
  const message = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 4000);
  };
  async function claim(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_voucher_code", {
      p_code: code.trim(),
    });
    setBusy(false);
    if (error) {
      message(error.message);
      return;
    }
    setCode("");
    setView("mine");
    setHistory(false);
    if (data) announceGrant({ id: Number(data), source: "secret_code" });
    message("Voucher added to My Rewards.");
    await refresh();
  }
  async function purchase(template: RewardTemplate) {
    const cost = template.point_cost ?? 0;
    if (balance.points_balance < cost) {
      setInsufficient(template);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("purchase_reward", {
      p_template_id: template.id,
    });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("enough points"))
        setInsufficient(template);
      else message(error.message);
      return;
    }
    setView("mine");
    setHistory(false);
    if (data) announceGrant({ id: Number(data), source: "points_shop" });
    message("Reward redeemed. It is ready in My Vouchers.");
    await refresh();
  }
  const VoucherCard = ({ voucher }: { voucher: UserVoucher }) => {
    const template = voucher.voucher_templates;
    if (!template) return null;
    const isPast =
      voucher.status !== "active" ||
      (voucher.expires_at && new Date(voucher.expires_at).getTime() <= now);
    return (
      <article
        className={`reward-voucher-card ${voucher.id === newVoucherId ? "voucher-bubble-in" : ""}`}
      >
        {template.image_url ? (
          <img src={template.image_url} alt="" />
        ) : (
          <span className="reward-voucher-art">
            <Icon size={30}>
              <path d="M4 7h16v12H4zM8 7V5h8v2M8 13h8" />
            </Icon>
          </span>
        )}
        <div>
          <span className="voucher-kicker">
            {template.voucher_type === "amount_off"
              ? `RM ${((template.amount_off_cents ?? 0) / 100).toFixed(0)} OFF`
              : template.voucher_type === "free_drink"
                ? "COMPLIMENTARY DRINK"
                : `BUY ${template.buy_quantity}, FREE ${template.free_quantity}`}
          </span>
          <h3>{template.title}</h3>
          <p>{template.description}</p>
          <small>
            {voucher.expires_at
              ? `Valid until ${new Date(voucher.expires_at).toLocaleDateString()}`
              : "No expiry date"}
          </small>
        </div>
        {isPast && (
          <span className="voucher-used">
            {voucher.status === "used" ? "Used" : "Expired"}
          </span>
        )}
      </article>
    );
  };
  return (
    <main className={`rewards-page rewards-${view}`}>
      <header className="rewards-hero">
        <div>
          <span>KOPI PAPA MEMBERS</span>
          <h1>Rewards worth returning for.</h1>
          <p>Every cup brings your next little treat closer.</p>
        </div>
      </header>
      <div
        className={`reward-view-toggle ${settings.points_enabled ? "" : "single"}`}
        role="tablist"
      >
        <button
          className={view === "mine" ? "active" : ""}
          onClick={() => setView("mine")}
        >
          My Rewards
        </button>
        {settings.points_enabled && (
          <button
            className={view === "shop" ? "active" : ""}
            onClick={() => setView("shop")}
          >
            Voucher Shop
          </button>
        )}
      </div>
      {notice && (
        <div className="rewards-notice" role="status">
          {notice}
        </div>
      )}
      {view === "shop" && settings.points_enabled && (
        <section className="points-balance">
          <div className="points-copy">
            <span>Available balance</span>
            <strong>{balance.points_balance.toLocaleString()}</strong>
            <small>MEMBER POINTS</small>
          </div>
          <span className="points-medallion">
            <Icon size={30}>
              <path d="M9 8h4a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h4M12 6v12" />
            </Icon>
          </span>
          <p>
            <strong>{settings.points_per_rm} pts</strong> for every RM 1 spent.
          </p>
        </section>
      )}
      {view === "mine" ? (
        <>
          {settings.points_enabled && (
            <section className="points-balance">
              <div className="points-copy">
                <span>Available balance</span>
                <strong>{balance.points_balance.toLocaleString()}</strong>
                <small>MEMBER POINTS</small>
              </div>
              <span className="points-medallion">
                <Icon size={30}>
                  <path d="M9 8h4a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h4M12 6v12" />
                </Icon>
              </span>
              <p>
                <strong>{settings.points_per_rm} pts</strong> for every RM 1
                spent.
              </p>
            </section>
          )}
          {settings.stamp_enabled && (
            <StampCard
              count={
                showFullStampBoard
                  ? settings.stamp_threshold
                  : balance.stamp_count
              }
              target={settings.stamp_threshold}
            />
          )}
          <form className="secret-code" onSubmit={claim}>
            <div>
              <span>Have a secret code?</span>
              <strong>Unlock a Kopi Papa treat</strong>
            </div>
            <label>
              <span className="sr-only">Secret voucher code</span>
              <input
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  )
                }
                placeholder="e.g. SECRETCODE"
                required
              />
              <button disabled={busy || !code}>
                {busy ? "CLAIMING…" : "CLAIM"}
              </button>
            </label>
            <small>
              Launch codes to try: PAPAWELCOME · KOPIFREE · PAPABUY2
            </small>
          </form>
          <section className="my-vouchers">
            <div className="voucher-subtabs">
              <button
                className={!history ? "active" : ""}
                onClick={() => setHistory(false)}
              >
                My Vouchers <span>{active.length}</span>
              </button>
              <button
                className={history ? "active" : ""}
                onClick={() => setHistory(true)}
              >
                Vouchers History
              </button>
            </div>
            <div className="voucher-stack">
              {(history ? past : active).length ? (
                (history ? past : active).map((v) => (
                  <VoucherCard voucher={v} key={v.id} />
                ))
              ) : (
                <div className="reward-empty">
                  <Icon size={36}>
                    <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
                  </Icon>
                  <h2>
                    {history
                      ? "No voucher history"
                      : "Your reward pocket is empty"}
                  </h2>
                  <p>
                    {history
                      ? "Used and expired vouchers will appear here."
                      : settings.points_enabled
                        ? "Claim a secret code or browse the Voucher Shop."
                        : "Claim a secret code to add your first reward."}
                  </p>
                  {!history && settings.points_enabled && (
                    <button onClick={() => setView("shop")}>
                      Browse rewards
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="voucher-shop">
          <div className="shop-heading">
            <div>
              <span>MEMBER EXCLUSIVES</span>
              <h2>Choose your next reward</h2>
            </div>
          </div>
          <div className="reward-shop-grid">
            {shop.length ? (
              shop.map((template) => (
                <article key={template.id}>
                  {template.image_url ? (
                    <img src={template.image_url} alt="" />
                  ) : (
                    <span className="shop-art">
                      <Icon size={34}>
                        <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
                      </Icon>
                    </span>
                  )}
                  <div>
                    <span>
                      {template.voucher_type === "amount_off"
                        ? `SAVE RM ${((template.amount_off_cents ?? 0) / 100).toFixed(0)}`
                        : template.voucher_type === "free_drink"
                          ? "FREE DRINK"
                          : `BUY ${template.buy_quantity}, FREE ${template.free_quantity}`}
                    </span>
                    <h3>{template.title}</h3>
                    <p>{template.description}</p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => void purchase(template)}
                  >
                    <span>Redeem</span>
                    <strong>
                      {template.point_cost?.toLocaleString()} points
                    </strong>
                  </button>
                </article>
              ))
            ) : (
              <div className="reward-empty">
                <Icon size={36}>
                  <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
                </Icon>
                <h2>No rewards available</h2>
                <p>New redeemable vouchers will appear here.</p>
              </div>
            )}
          </div>
        </section>
      )}
      {insufficient && (
        <div
          className="reward-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInsufficient(null);
          }}
        >
          <section
            className="insufficient-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="insufficient-title"
          >
            <span className="insufficient-icon">
              <Icon size={30}>
                <path d="M12 3v10M12 18v.01" />
                <circle cx="12" cy="12" r="9" />
              </Icon>
            </span>
            <h2 id="insufficient-title">Insufficient Points</h2>
            <p>
              You need{" "}
              <strong>
                {Math.max(
                  0,
                  (insufficient.point_cost ?? 0) - balance.points_balance,
                ).toLocaleString()}{" "}
                more points
              </strong>{" "}
              to redeem {insufficient.title}.
            </p>
            <div>
              <button onClick={() => setInsufficient(null)} autoFocus>
                Keep browsing
              </button>
              <button
                onClick={() => {
                  setInsufficient(null);
                  setView("mine");
                }}
              >
                View my balance
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ProfilePage({
  email,
  profile,
  save,
  onSignOut,
  onDeleteAccount,
}: {
  email: string;
  profile: CustomerProfile;
  save: (profile: CustomerProfile) => Promise<string>;
  onSignOut: () => void;
  onDeleteAccount: () => Promise<string>;
}) {
  const [draft, setDraft] = useState(profile),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [deleteOpen, setDeleteOpen] = useState(false),
    [deleteText, setDeleteText] = useState("");
  useEffect(() => setDraft(profile), [profile.display_name, profile.phone]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const error = await save(draft);
    setBusy(false);
    setNotice(error || "Profile saved.");
    window.setTimeout(() => setNotice(""), 3500);
  }
  return (
    <main className="simple-page profile-page">
      <header>
        <h1>Your profile</h1>
        <p>Keep your pickup details current.</p>
      </header>
      <section className="profile-identity">
        <span>
          {(draft.display_name[0] || email[0] || "K").toUpperCase()}
        </span>
        <div>
          <strong>
            {draft.display_name || email.split("@")[0] || "Kopi Papa member"}
          </strong>
          <small>{email}</small>
        </div>
      </section>
      <form className="profile-form" onSubmit={submit}>
        <label>
          <span>Name</span>
          <input
            value={draft.display_name}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                display_name: event.target.value,
              }))
            }
            placeholder="Your name"
            autoComplete="name"
          />
        </label>
        <label>
          <span>Phone number</span>
          <input
            value={draft.phone}
            onChange={(event) =>
              setDraft((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="e.g. 012-345 6789"
            type="tel"
            autoComplete="tel"
          />
        </label>
        {notice && (
          <p className="profile-notice" role="status">
            {notice}
          </p>
        )}
        <button className="save-profile" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>
      <nav className="profile-links" aria-label="More information">
        <a href="mailto:support@kopipapa.my">
          <span>
            <Icon>
              <path d="M4 5h16v14H4zM4 7l8 6 8-6" />
            </Icon>
            <span>
              <strong>Help &amp; Support</strong>
              <small>Questions, feedback or order support</small>
            </span>
          </span>
          <Icon size={18}>
            <path d="m9 18 6-6-6-6" />
          </Icon>
        </a>
        <a href={`${(import.meta.env.VITE_WEBSITE_URL as string | undefined)?.replace(/\/$/, "") || (import.meta.env.PROD ? "https://kopipapa.vercel.app" : "http://localhost:3000")}/story`}>
          <span>
            <Icon>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6M12 7v.01" />
            </Icon>
            <span>
              <strong>About Us</strong>
              <small>Our story and the Kopi Papa tradition</small>
            </span>
          </span>
          <Icon size={18}>
            <path d="m9 18 6-6-6-6" />
          </Icon>
        </a>
      </nav>
      <button className="sign-out" onClick={onSignOut}>
        Sign out
      </button>
      <div className="profile-delete-action">
        <button type="button" onClick={() => setDeleteOpen(true)}>Delete my account</button>
      </div>
      {deleteOpen && (
        <div className="account-delete-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteOpen(false); }}>
          <section className="account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <h2 id="delete-account-title">Permanently delete your account?</h2>
            <p>This action is permanent and cannot be undone.</p>
            <label>Type <strong>DELETE</strong> to confirm<input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoFocus /></label>
            {notice && <p className="profile-notice" role="status">{notice}</p>}
            <div><button type="button" onClick={() => setDeleteOpen(false)}>Cancel</button><button type="button" className="confirm-account-delete" disabled={busy || deleteText !== "DELETE"} onClick={async () => { setBusy(true); const error = await onDeleteAccount(); setBusy(false); if (error) setNotice(error); }}>{busy ? "Deleting…" : "Delete permanently"}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

function BottomNav({
  tab,
  requestTab,
  menuLocked,
}: {
  tab: AppTab;
  requestTab: (tab: AppTab) => void;
  menuLocked: boolean;
}) {
  const items: { id: AppTab; label: string; icon: ReactNode }[] = [
    {
      id: "home",
      label: "Home",
      icon: (
        <>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6 9.5V20h12V9.5" />
          <path d="M10 20v-6h4v6" />
        </>
      ),
    },
    {
      id: "menu",
      label: "Menu",
      icon: (
        <>
          <path d="M6 3h12v18H6z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </>
      ),
    },
    {
      id: "orders",
      label: "Orders",
      icon: (
        <>
          <path d="M5 4h14v17H5z" />
          <path d="M8 9h8M8 13h8" />
        </>
      ),
    },
    {
      id: "rewards",
      label: "Reward",
      icon: (
        <>
          <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-4 0-5-5-2-5 2 0 2 3 2 5Zm0 0c4 0 5-5 2-5-2 0-2 3-2 5Z" />
        </>
      ),
    },
  ];
  return (
    <nav className="bottom-nav four" aria-label="Primary navigation">
      {items.map((item) => (
        <button
          key={item.id}
          className={tab === item.id ? "active" : ""}
          onClick={() => requestTab(item.id)}
          aria-label={
            menuLocked && item.id === "menu"
              ? "Menu, choose pickup first"
              : item.label
          }
        >
          <Icon>{item.icon}</Icon>
          <span>{item.label}</span>
          {menuLocked && item.id === "menu" && <i />}
        </button>
      ))}
    </nav>
  );
}

function StoreSheet({
  stores,
  loading,
  error,
  selected,
  choose,
  close,
}: {
  stores: Store[];
  loading: boolean;
  error: string;
  selected: Store | null;
  choose: (store: Store) => void;
  close: () => void;
}) {
  return (
    <BottomSheet close={close}>
      <section
        className="decision-sheet store-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-title"
      >
        <button
          className="sheet-close light"
          onClick={close}
          aria-label="Close store selection"
        >
          <Icon>
            <path d="m6 6 12 12M18 6 6 18" />
          </Icon>
        </button>
        <h2 id="store-title">Select your pickup store</h2>
        <p>Your order and availability will follow this branch.</p>
        {error && (
          <div className="coming-soon" role="alert">
            <strong>Stores could not be loaded</strong>
            <span>{error}</span>
          </div>
        )}
        {loading ? (
          <p>Loading stores…</p>
        ) : (
          <div className="store-options">
            {stores.map((store) => (
              <button
                key={store.id}
                disabled={!store.accepting_pickup}
                className={selected?.id === store.id ? "selected" : ""}
                onClick={() => choose(store)}
              >
                <span className="store-icon">
                  <Icon>
                    <path d="M4 10h16" />
                    <path d="m5 10 1-5h12l1 5" />
                    <path d="M6 10v9h12v-9" />
                  </Icon>
                </span>
                <span>
                  <strong>{store.name}</strong>
                  <small>{store.address}</small>
                  <small>
                    {store.accepting_pickup
                      ? storeHours(store)
                      : "Pickup paused"}
                  </small>
                </span>
                <Icon size={18}>
                  <path d="m9 18 6-6-6-6" />
                </Icon>
              </button>
            ))}
          </div>
        )}
      </section>
    </BottomSheet>
  );
}

function StoreDetailsSheet({
  store,
  open,
  changeStore,
  close,
}: {
  store: Store;
  open: boolean;
  changeStore: () => void;
  close: () => void;
}) {
  return (
    <BottomSheet close={close}>
      <section
        className="decision-sheet store-details-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-details-title"
      >
        <button
          className="sheet-close light"
          onClick={close}
          aria-label="Close store details"
        >
          <Icon>
            <path d="m6 6 12 12M18 6 6 18" />
          </Icon>
        </button>
        <span className={`store-state ${open ? "open" : "closed"}`}>
          {open ? "Open now" : "Closed"}
        </span>
        <h2 id="store-details-title">{store.name}</h2>
        <div className="store-detail-line">
          <span className="store-icon">
            <Icon>
              <path d="M4 10h16" />
              <path d="m5 10 1-5h12l1 5" />
              <path d="M6 10v9h12v-9" />
            </Icon>
          </span>
          <span>
            <small>Full address</small>
            <strong>{store.address || "Address unavailable"}</strong>
          </span>
        </div>
        <div className="store-detail-line">
          <span className="store-icon">
            <Icon>
              <circle cx="12" cy="12" r="8" />
              <path d="M12 7v5l3 2" />
            </Icon>
          </span>
          <span>
            <small>Opening hours</small>
            <strong>{storeHours(store)}</strong>
          </span>
        </div>
        <button className="login-primary" onClick={changeStore}>
          Change pickup store
        </button>
      </section>
    </BottomSheet>
  );
}

function FulfillmentSheet({
  deliverySoon,
  selectPickup,
  showDeliverySoon,
  close,
}: {
  deliverySoon: boolean;
  selectPickup: () => void;
  showDeliverySoon: () => void;
  close: () => void;
}) {
  return (
    <BottomSheet close={close}>
      <section
        className="decision-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-type-title"
      >
        <button
          className="sheet-close light"
          onClick={close}
          aria-label="Close"
        >
          <Icon>
            <path d="m6 6 12 12M18 6 6 18" />
          </Icon>
        </button>
        <h2 id="order-type-title">How would you like your order?</h2>
        <p>Choose pickup to browse the prototype menu.</p>
        {deliverySoon && (
          <div className="coming-soon">
            <strong>Delivery is coming soon</strong>
            <span>
              We’ll add addresses, delivery zones and fees after the pickup flow
              is live.
            </span>
          </div>
        )}
        <div className="decision-options">
          <button onClick={selectPickup}>
            <Icon>
              <path d="M6 8h12l-1 12H7L6 8Z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </Icon>
            <span>
              <strong>Pickup</strong>
            </span>
            <Icon size={18}>
              <path d="m9 18 6-6-6-6" />
            </Icon>
          </button>
          <button onClick={showDeliverySoon} className="disabled-choice">
            <Icon>
              <path d="M3 7h12v10H3zM15 10h3l3 3v4h-6z" />
            </Icon>
            <span>
              <strong>Delivery</strong>
            </span>
            <span className="soon-pill">Soon</span>
          </button>
        </div>
      </section>
    </BottomSheet>
  );
}

function AuthSheet({
  initialView,
  accountRequired = false,
  error,
  email,
  password,
  setEmail,
  setPassword,
  submitLogin,
  signup,
  oauth,
  sendPasswordReset,
  resendConfirmation,
  updatePassword,
  close,
}: {
  initialView: AuthView;
  accountRequired?: boolean;
  error: string;
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  submitLogin: (event: FormEvent) => void;
  signup: (displayName: string) => Promise<boolean>;
  oauth: (provider: "google" | "apple") => Promise<void>;
  sendPasswordReset: () => Promise<boolean>;
  resendConfirmation: () => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  close: () => void;
}) {
  const [mode, setMode] = useState<AuthView>(initialView),
    [displayName, setDisplayName] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => setMode(initialView), [initialView]);
  async function submit(event: FormEvent) {
    if (mode === "login") {
      submitLogin(event);
      return;
    }
    event.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const ok = await signup(displayName);
      if (ok) setMode("check-email");
    } else if (mode === "forgot") {
      const ok = await sendPasswordReset();
      if (ok) setSent(true);
    } else if (mode === "update-password") {
      const ok = await updatePassword(newPassword);
      if (ok) close();
    }
    setBusy(false);
  }
  const title =
    mode === "signup"
      ? "Create your account"
      : mode === "check-email"
        ? "Check your email"
        : mode === "forgot"
          ? "Reset your password"
          : mode === "update-password"
            ? "Choose a new password"
            : accountRequired
              ? "Sign in to continue"
              : "Welcome back";
  return (
    <BottomSheet close={close}>
      <section
        className="auth-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        <button
          className="sheet-close light"
          onClick={close}
          aria-label="Close login"
        >
          <Icon>
            <path d="m6 6 12 12M18 6 6 18" />
          </Icon>
        </button>
        <span className="auth-mark">KP</span>
        <h2 id="login-title">{title}</h2>
        <p>
          {mode === "check-email"
            ? `We sent a confirmation link to ${email}. Confirm your address before signing in.`
            : mode === "forgot"
              ? sent
                ? `A secure reset link is on its way to ${email}.`
                : "Enter your account email and we’ll send a secure reset link."
              : mode === "update-password"
                ? "Use a unique password with at least eight characters."
                : accountRequired
                  ? "Use a verified account to order, track purchases and collect rewards."
                  : "Your orders, cart and rewards stay securely connected to your account."}
        </p>
        {(mode === "login" || mode === "signup") && (
          <>
            <div className="oauth-actions">
              <button type="button" onClick={() => void oauth("google")}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.2a10 10 0 0 0 0 9.1L6.5 14Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.2 7.5l3.3 2.6A5.8 5.8 0 0 1 12 6Z"/></svg>
                Continue with Google
              </button>
              <button type="button" onClick={() => void oauth("apple")}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.1 12.6c0-2.6 2.1-3.8 2.2-3.9a4.7 4.7 0 0 0-3.7-2c-1.6-.2-3.1 1-3.9 1-.8 0-2-1-3.4-1-1.7 0-3.4 1-4.3 2.6-1.9 3.2-.5 8 1.3 10.6.9 1.3 2 2.7 3.4 2.6 1.3-.1 1.9-.9 3.5-.9 1.6 0 2.1.9 3.5.8 1.5 0 2.4-1.3 3.3-2.6a11.5 11.5 0 0 0 1.5-3.1 4.5 4.5 0 0 1-3.4-4.1ZM14.6 5c.8-1 1.3-2.3 1.2-3.6-1.2.1-2.6.8-3.4 1.8-.7.8-1.3 2.2-1.1 3.4 1.3.1 2.6-.6 3.3-1.6Z"/></svg>
                Continue with Apple
              </button>
            </div>
            <div className="or"><span>or use email</span></div>
            <div className="auth-modes">
              <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
              <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button>
            </div>
          </>
        )}
        {error && (
          <div className="coming-soon" role="alert">
            {error}
          </div>
        )}
        {(mode === "login" || mode === "signup" || mode === "forgot" || mode === "update-password") && <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                placeholder="Your name"
                required
              />
            </label>
          )}
          {mode !== "update-password" && <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>}
          {(mode === "login" || mode === "signup") && <label>
            Password
            <input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>}
          {mode === "update-password" && <label>
            New password
            <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} placeholder="At least 8 characters" required />
          </label>}
          <button disabled={busy} type="submit" className="login-primary">
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? sent ? "Send another link" : "Send reset link"
                    : "Update password"}
          </button>
          {mode === "login" && <button type="button" className="auth-text-action" onClick={() => { setSent(false); setMode("forgot"); }}>Forgot password?</button>}
        </form>}
        {mode === "check-email" && <div className="auth-email-actions">
          <button className="login-primary" disabled={busy} onClick={async () => { setBusy(true); await resendConfirmation(); setBusy(false); }}>Resend confirmation</button>
          <button className="auth-text-action" onClick={() => setMode("login")}>Back to sign in</button>
        </div>}
        {(mode === "forgot" || mode === "update-password") && <button className="auth-text-action standalone" onClick={() => setMode("login")}>Back to sign in</button>}
        <small>Secure authentication is provided by Supabase.</small>
      </section>
    </BottomSheet>
  );
}

function CheckoutPage({
  error,
  busy,
  auth,
  store,
  etaMinutes,
  cartItems,
  subtotal,
  vouchers,
  updateQuantity,
  remove,
  addRecommended,
  addMore,
  close,
  placeOrder,
}: {
  error: string;
  busy: boolean;
  auth: AuthState;
  store: Store;
  etaMinutes: number;
  cartItems: { item: MenuItem; line: CartLine }[];
  subtotal: number;
  vouchers: UserVoucher[];
  updateQuantity: (key: string, delta: number) => void;
  remove: (key: string) => void;
  addRecommended: (item: MenuItem) => void;
  addMore: () => void;
  close: () => void;
  placeOrder: (
    method: "fpx" | "touch_n_go",
    total: number,
    voucher?: { userVoucherId?: number; secretCode?: string },
    paymentBank?: string,
  ) => void;
}) {
  const [recommendations, setRecommendations] = useState<MenuItem[]>([]),
    [code, setCode] = useState(""),
    [voucherOpen, setVoucherOpen] = useState(false),
    [checking, setChecking] = useState(false),
    [validationError, setValidationError] = useState(""),
    [applied, setApplied] = useState<{
      title: string;
      discount: number;
      userVoucherId?: number;
      secretCode?: string;
    } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"fpx" | "touch_n_go">(
    "fpx",
  );
  const [paymentBank, setPaymentBank] = useState("");
  const fpxBanks = [
    ["maybank2u", "Maybank2u"],
    ["cimb_clicks", "CIMB Clicks"],
    ["public_bank", "Public Bank"],
    ["rhb_now", "RHB Now"],
    ["hong_leong", "Hong Leong Connect"],
    ["ambank", "AmOnline"],
    ["bank_islam", "Bank Islam"],
  ];
  const activeVouchers = vouchers.filter(
    (v) =>
      v.status === "active" &&
      (!v.expires_at || new Date(v.expires_at).getTime() > Date.now()) &&
      v.voucher_templates,
  );
  const itemPayload = cartItems.map(({ item, line }) => ({
    product_id: item.id,
    quantity: line.quantity,
    customization: { temperature: line.temperature, size: line.size },
    source: line.source ?? "menu",
  }));
  const cartFingerprint = cartItems
    .map(({ line }) => `${line.key}:${line.quantity}`)
    .join("|");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("products")
        .select(
          "id,name,description,price_cents,image_url,badge,sold,categories(name)",
        )
        .eq("available", true)
        .order("sold", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const inCart = new Set(cartItems.map(({ item }) => item.id)),
        rows = (data ?? []).filter((row: any) => !inCart.has(row.id));
      const baked = rows.filter((row: any) =>
          /baked|bite|pastry|cake/i.test(row.categories?.name ?? ""),
        ),
        picked = [
          ...baked,
          ...rows.filter((row: any) => !baked.includes(row)),
        ].slice(0, 4);
      setRecommendations(
        picked.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description ?? "",
          price: row.price_cents / 100,
          image: row.image_url ?? "",
          badge: row.badge ?? undefined,
          category: row.categories?.name ?? "Other",
        })),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [cartFingerprint]);
  async function validateVoucher(
    input: { userVoucherId?: number; secretCode?: string },
    quiet = false,
  ) {
    if (!cartItems.length) return;
    setChecking(true);
    const { data, error: previewError } = await supabase.rpc(
      "preview_checkout_voucher",
      {
        p_items: itemPayload,
        p_store_id: store.id,
        p_user_voucher_id: input.userVoucherId ?? null,
        p_secret_code: input.secretCode ?? null,
      },
    );
    setChecking(false);
    if (previewError) {
      setApplied(null);
      if (!quiet) setValidationError(previewError.message);
      return;
    }
    const result = data as { discount_amount: number; voucher_title: string };
    setApplied({
      title: result.voucher_title,
      discount: (result.discount_amount ?? 0) / 100,
      ...input,
    });
    setVoucherOpen(false);
    setCode("");
  }
  useEffect(() => {
    if (applied)
      void validateVoucher(
        {
          userVoucherId: applied.userVoucherId,
          secretCode: applied.secretCode,
        },
        true,
      );
  }, [cartFingerprint]);
  const discount = applied?.discount ?? 0,
    tax = 0,
    finalTotal = Math.max(0, subtotal - discount + tax);
  return (
    <div className="checkout-layer">
      <main className="checkout-page" aria-labelledby="checkout-title">
        <header>
          <button onClick={close} aria-label="Return to cart">
            <Icon>
              <path d="m15 18-6-6 6-6" />
            </Icon>
          </button>
          <div>
            <small>SECURE CHECKOUT</small>
            <h1 id="checkout-title">Confirm your pickup</h1>
          </div>
        </header>
        <div className="checkout-content">
          {error && (
            <div className="checkout-error" role="alert">
              {error}
            </div>
          )}
          <section className="checkout-section pickup-card">
            <span>
              <Icon>
                <path d="M4 10h16M5 10l1-5h12l1 5M6 10v9h12v-9" />
              </Icon>
            </span>
            <div>
              <small>Pickup from</small>
              <h2>{store.name}</h2>
              <p>{store.address}</p>
            </div>
            <div>
              <small>Estimated</small>
              <strong>{etaMinutes || store.preparation_minutes} min</strong>
            </div>
          </section>
          <section className="checkout-section">
            <div className="checkout-heading">
              <div>
                <small>YOUR ORDER</small>
                <h2>Order summary</h2>
              </div>
              <button onClick={addMore}>
                <Icon size={17}>
                  <path d="M12 5v14M5 12h14" />
                </Icon>
                Add more items
              </button>
            </div>
            <div className="checkout-lines">
              {cartItems.map(({ item, line }) => (
                <article key={line.key}>
                  {item.image ? (
                    <img src={item.image} alt="" />
                  ) : (
                    <span className="cart-placeholder">
                      {item.name.slice(0, 2)}
                    </span>
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {line.temperature} · {line.size}
                    </small>
                    <b>RM {(line.unitPrice * line.quantity).toFixed(2)}</b>
                  </div>
                  <div className="checkout-quantity">
                    <button
                      onClick={() => updateQuantity(line.key, -1)}
                      aria-label={`Decrease ${item.name} quantity`}
                    >
                      <Icon size={15}>
                        <path d="M5 12h14" />
                      </Icon>
                    </button>
                    <strong>{line.quantity}</strong>
                    <button
                      onClick={() => updateQuantity(line.key, 1)}
                      aria-label={`Increase ${item.name} quantity`}
                    >
                      <Icon size={15}>
                        <path d="M12 5v14M5 12h14" />
                      </Icon>
                    </button>
                  </div>
                  <button
                    className="checkout-delete"
                    onClick={() => remove(line.key)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Icon size={18}>
                      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
                    </Icon>
                  </button>
                </article>
              ))}
            </div>
          </section>
          {recommendations.length > 0 && (
            <section className="checkout-section upsell-section">
              <div className="checkout-heading">
                <div>
                  <small>POPULAR WITH YOUR ORDER</small>
                  <h2>Add a little extra</h2>
                </div>
              </div>
              <div className="upsell-scroll">
                {recommendations.map((item) => (
                  <article key={item.id}>
                    {item.image ? (
                      <img src={item.image} alt="" />
                    ) : (
                      <span>{item.name.slice(0, 2)}</span>
                    )}
                    <strong>{item.name}</strong>
                    <small>RM {item.price.toFixed(2)}</small>
                    <button
                      onClick={() => addRecommended(item)}
                      aria-label={`Add ${item.name} to order`}
                    >
                      <Icon size={16}>
                        <path d="M12 5v14M5 12h14" />
                      </Icon>
                      Add
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section className="checkout-section voucher-checkout">
            <div className="checkout-heading">
              <div>
                <small>VOUCHER</small>
                <h2>Apply a reward</h2>
              </div>
              {applied && (
                <button
                  className="remove-voucher"
                  onClick={() => setApplied(null)}
                >
                  Remove
                </button>
              )}
            </div>
            {applied ? (
              <div className="applied-voucher">
                <Icon>
                  <path d="M5 7h14v3a2.5 2.5 0 0 0 0 5v3H5v-3a2.5 2.5 0 0 0 0-5V7Z" />
                  <path d="M10 7v11" strokeDasharray="2 2" />
                </Icon>
                <span>
                  <strong>{applied.title}</strong>
                  <small>
                    RM {applied.discount.toFixed(2)} discount applied
                  </small>
                </span>
              </div>
            ) : (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void validateVoucher({ secretCode: code.trim() });
                  }}
                >
                  <label htmlFor="checkout-code">Secret voucher code</label>
                  <div>
                    <input
                      id="checkout-code"
                      value={code}
                      onChange={(event) =>
                        setCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, ""),
                        )
                      }
                      placeholder="e.g. SECRETCODE"
                    />
                    <button disabled={checking || !code}>
                      {checking ? "Checking…" : "Apply"}
                    </button>
                  </div>
                </form>
                <button
                  className="select-voucher"
                  disabled={auth !== "email" || !activeVouchers.length}
                  onClick={() => setVoucherOpen(true)}
                >
                  <Icon>
                    <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
                  </Icon>
                  <span>
                    <strong>Select from My Vouchers</strong>
                    <small>
                      {auth !== "email"
                        ? "Sign in with an account to use rewards"
                        : activeVouchers.length
                          ? `${activeVouchers.length} available`
                          : "No active vouchers"}
                    </small>
                  </span>
                  <Icon size={17}>
                    <path d="m9 18 6-6-6-6" />
                  </Icon>
                </button>
              </>
            )}
          </section>
          <section className="checkout-section payment-method">
            <div className="checkout-heading">
              <div>
                <small>PAYMENT</small>
                <h2>Choose how to pay</h2>
              </div>
              <span className="sandbox-chip">HitPay Sandbox</span>
            </div>
            <div
              className="payment-choices"
              role="radiogroup"
              aria-label="Payment method"
            >
              <button
                type="button"
                role="radio"
                aria-checked={paymentMethod === "fpx"}
                className={paymentMethod === "fpx" ? "selected" : ""}
                onClick={() => setPaymentMethod("fpx")}
              >
                <span className="payment-logo fpx-logo">FPX</span>
                <span>
                  <strong>Online Banking</strong>
                  <small>Pay securely through FPX</small>
                </span>
                <i>
                  {paymentMethod === "fpx" ? (
                    <Icon size={16}>
                      <path d="m5 12 4 4L19 6" />
                    </Icon>
                  ) : null}
                </i>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={paymentMethod === "touch_n_go"}
                className={paymentMethod === "touch_n_go" ? "selected" : ""}
                onClick={() => setPaymentMethod("touch_n_go")}
              >
                <span className="payment-logo tng-logo">TNG</span>
                <span>
                  <strong>Touch ’n Go eWallet</strong>
                  <small>Continue in your eWallet</small>
                </span>
                <i>
                  {paymentMethod === "touch_n_go" ? (
                    <Icon size={16}>
                      <path d="m5 12 4 4L19 6" />
                    </Icon>
                  ) : null}
                </i>
              </button>
            </div>
            {paymentMethod === "fpx" && (
              <label className="fpx-bank-select">
                <span>Select your bank</span>
                <select value={paymentBank} onChange={(event) => setPaymentBank(event.target.value)} required>
                  <option value="">Choose an FPX bank</option>
                  {fpxBanks.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
                <small>You’ll still complete authentication securely on HitPay.</small>
              </label>
            )}
            <p className="payment-security">
              <Icon size={15}>
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </Icon>
              Payment is completed on HitPay’s hosted checkout.
            </p>
          </section>
          <section className="checkout-section cost-summary">
            <h2>Payment summary</h2>
            <div>
              <span>Subtotal</span>
              <strong>RM {subtotal.toFixed(2)}</strong>
            </div>
            <div className={discount ? "discount-row" : ""}>
              <span>Discount</span>
              <strong>
                {discount ? `− RM ${discount.toFixed(2)}` : "RM 0.00"}
              </strong>
            </div>
            <div>
              <span>Taxes</span>
              <strong>RM {tax.toFixed(2)}</strong>
            </div>
            <div className="checkout-final">
              <span>Final total</span>
              <strong>RM {finalTotal.toFixed(2)}</strong>
            </div>
          </section>
        </div>
        <footer>
          <button
            disabled={busy || !cartItems.length || checking || (paymentMethod === "fpx" && !paymentBank)}
            onClick={() =>
              placeOrder(
                paymentMethod,
                finalTotal,
                applied
                  ? {
                      userVoucherId: applied.userVoucherId,
                      secretCode: applied.secretCode,
                    }
                  : undefined,
                paymentMethod === "fpx" ? paymentBank : undefined,
              )
            }
          >
            {busy ? "Opening HitPay…" : paymentMethod === "fpx" && !paymentBank ? "Select a bank to continue" : `Pay now · RM ${finalTotal.toFixed(2)}`}
          </button>
          <small>
            You’ll continue to HitPay to complete your{" "}
            {paymentMethod === "fpx" ? "FPX" : "Touch ’n Go"} payment.
          </small>
        </footer>
      </main>
      {voucherOpen && (
        <div
          className="checkout-sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setVoucherOpen(false);
          }}
        >
          <section
            className="checkout-voucher-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-sheet-title"
          >
            <span className="sheet-handle" />
            <div>
              <h2 id="voucher-sheet-title">My Vouchers</h2>
              <button
                onClick={() => setVoucherOpen(false)}
                aria-label="Close voucher selection"
              >
                <Icon>
                  <path d="m6 6 12 12M18 6 6 18" />
                </Icon>
              </button>
            </div>
            <div className="checkout-voucher-list">
              {activeVouchers.map((voucher) => {
                const template = voucher.voucher_templates!;
                return (
                  <article className="checkout-voucher-card" key={voucher.id}>
                    {template.image_url ? (
                      <img src={template.image_url} alt="" />
                    ) : (
                      <span className="checkout-voucher-art">
                        <Icon size={30}>
                          <path d="M5 7h14v3a2.5 2.5 0 0 0 0 5v3H5v-3a2.5 2.5 0 0 0 0-5V7Z" />
                        </Icon>
                      </span>
                    )}
                    <div>
                      <span className="voucher-kicker">
                        {template.voucher_type === "amount_off"
                          ? `RM ${((template.amount_off_cents ?? 0) / 100).toFixed(0)} OFF`
                          : template.voucher_type === "free_drink"
                            ? "COMPLIMENTARY DRINK"
                            : `BUY ${template.buy_quantity}, FREE ${template.free_quantity}`}
                      </span>
                      <strong>{template.title}</strong>
                      <small>{template.description}</small>
                      <small>
                        {voucher.expires_at
                          ? `Valid until ${new Date(voucher.expires_at).toLocaleDateString()}`
                          : "No expiry date"}
                      </small>
                    </div>
                    <button
                      disabled={checking}
                      onClick={() =>
                        void validateVoucher({ userVoucherId: voucher.id })
                      }
                    >
                      {checking ? "Checking…" : "Apply"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {validationError && (
        <div
          className="reward-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setValidationError("");
          }}
        >
          <section
            className="insufficient-modal checkout-validation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="voucher-error-title"
          >
            <span className="insufficient-icon">
              <Icon size={30}>
                <path d="M12 3v10M12 18v.01" />
                <circle cx="12" cy="12" r="9" />
              </Icon>
            </span>
            <h2 id="voucher-error-title">Voucher cannot be applied</h2>
            <p>{validationError}</p>
            <button onClick={() => setValidationError("")} autoFocus>
              Update my order
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
