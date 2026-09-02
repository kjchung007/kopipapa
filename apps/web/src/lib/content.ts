export type Product = { id: number; name: string; description: string; priceCents: number; image: string; category: string };
export type Store = { id: number; name: string; address: string; phone: string; opening: string; closing: string };
export type Campaign = { id: number; title: string; body: string; image: string };
export type WebsiteSection = { id:string; type:"hero"|"text_image"|"rich_text"|"call_to_action"|"product_catalog"|"store_list"; heading:string; body:string; imageUrl?:string; buttonLabel?:string; buttonUrl?:string; background?:"navy"|"cream"|"white"|"gold"; align?:"left"|"center"; imagePositionX?:number; imagePositionY?:number; imageHeight?:number };
export type WebsitePage = { id:number; title:string; slug:string; routePath:string; seoTitle:string; seoDescription:string; sections:WebsiteSection[] };

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function rest<T>(table: string, params: Record<string, string>): Promise<T[]> {
  if (!url || !key) return [];
  const endpoint = new URL(`${url}/rest/v1/${table}`);
  Object.entries(params).forEach(([name, value]) => endpoint.searchParams.set(name, value));
  try {
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } });
    return response.ok ? await response.json() as T[] : [];
  } catch { return []; }
}

const fallbackProducts: Product[] = [
  { id: -1, name: "Papa Double Soul Latte", description: "Traditional local kopi meets modern espresso in one bold cup.", priceCents: 1860, image: "/assets/double-soul.webp", category: "Signature Lattes" },
  { id: -2, name: "3 Layer Kopi", description: "Layered local coffee sweetened with Sarawak gula apong.", priceCents: 1130, image: "/assets/three-layer-kopi.png", category: "Local Kopi" },
  { id: -3, name: "Strawberry Matcha Latte", description: "Earthy matcha, creamy milk and bright strawberry.", priceCents: 1860, image: "/assets/strawberry-matcha.webp", category: "Matcha Series" },
  { id: -4, name: "Signature Latte", description: "A smooth everyday espresso latte made the Kopi Papa way.", priceCents: 1280, image: "/assets/signature-latte.webp", category: "Signature Lattes" },
  { id: -5, name: "Chicken Shao Pau", description: "Warm, flaky and savoury, baked for a quick coffee pairing.", priceCents: 560, image: "/assets/chicken-shao-pao.png", category: "Bites" },
];

export async function getProducts(): Promise<Product[]> {
  type Row = { id:number; name:string; description:string|null; price_cents:number; image_url:string|null; categories:{name:string}|{name:string}[]|null };
  const rows = await rest<Row>("products", { select: "id,name,description,price_cents,image_url,categories(name)", available: "eq.true", order: "sort_order.asc" });
  if (!rows.length) return fallbackProducts;
  return rows.map((row) => ({ id: row.id, name: row.name, description: row.description || "Made fresh for your next coffee break.", priceCents: row.price_cents, image: row.image_url || fallbackProducts.find((item) => item.name === row.name)?.image || "/assets/signature-latte.webp", category: Array.isArray(row.categories) ? row.categories[0]?.name || "Menu" : row.categories?.name || "Menu" }));
}

export async function getStores(): Promise<Store[]> {
  type Row = { id:number; name:string; address:string|null; phone:string|null; opening_time:string|null; closing_time:string|null };
  const rows = await rest<Row>("stores", { select: "id,name,address,phone,opening_time,closing_time", active: "eq.true", order: "name.asc" });
  return rows.map((row) => ({ id:row.id, name:row.name, address:row.address || "Kuching, Sarawak", phone:row.phone || "", opening:row.opening_time || "10:00", closing:row.closing_time || "21:30" }));
}

export async function getCampaigns(): Promise<Campaign[]> {
  type Row = { id:number; title:string; body:string|null; image_url:string|null };
  const rows = await rest<Row>("campaigns", { select:"id,title,body,image_url", active:"eq.true", order:"sort_order.asc", limit:"3" });
  return rows.map((row) => ({ id:row.id, title:row.title, body:row.body || "Discover what is brewing at Kopi Papa.", image:row.image_url || "/assets/customer-cup.webp" }));
}

export async function getPublishedPage(slug:string): Promise<WebsitePage | null> {
  type Row = { id:number; title:string; slug:string; route_path:string; seo_title:string; seo_description:string; published_content:{sections?:WebsiteSection[]} };
  const rows = await rest<Row>("website_pages", {
    select:"id,title,slug,route_path,seo_title,seo_description,published_content",
    slug:`eq.${slug}`,
    published_content:"not.is.null",
    limit:"1",
  });
  const row = rows[0];
  if (!row) return null;
  return { id:row.id, title:row.title, slug:row.slug, routePath:row.route_path, seoTitle:row.seo_title, seoDescription:row.seo_description, sections:Array.isArray(row.published_content?.sections) ? row.published_content.sections : [] };
}

export async function getPublishedPageByPath(routePath:string): Promise<WebsitePage | null> {
  type Row = { id:number; title:string; slug:string; route_path:string; seo_title:string; seo_description:string; published_content:{sections?:WebsiteSection[]} };
  const rows = await rest<Row>("website_pages", { select:"id,title,slug,route_path,seo_title,seo_description,published_content", route_path:`eq.${routePath}`, published_content:"not.is.null", limit:"1" });
  const row=rows[0]; if(!row) return null;
  return { id:row.id,title:row.title,slug:row.slug,routePath:row.route_path,seoTitle:row.seo_title,seoDescription:row.seo_description,sections:Array.isArray(row.published_content?.sections)?row.published_content.sections:[] };
}

export const orderUrl = process.env.NEXT_PUBLIC_ORDER_APP_URL || "http://localhost:5173";
export const money = (cents:number) => `RM ${(cents / 100).toFixed(2)}`;
