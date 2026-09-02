import { getPublishedPageByPath, getStores, orderUrl } from "@/lib/content";
import { PublishedPage } from "@/components/PublishedPage";

export const metadata = { title: "Stores", description: "Find Kopi Papa stores, opening hours and pickup details." };
const images = ["/assets/store-cityone.webp", "/assets/store-plaza-merdeka.webp", "/assets/store-kapit-2.webp", "/assets/store-sibu.webp"];
const cleanTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}${hours >= 12 ? "pm" : "am"}`;
};

export default async function StoresPage() {
  const [published,live] = await Promise.all([getPublishedPageByPath("/stores"),getStores()]);
  if(published) return <PublishedPage page={published}/>;
  const stores = live.length ? live : [
    { id: 1, name: "Kopi Papa CityOne", address: "CityOne Megamall, Kuching, Sarawak", phone: "", opening: "10:00", closing: "21:30" },
    { id: 2, name: "Kopi Papa Plaza Merdeka", address: "Plaza Merdeka, Kuching, Sarawak", phone: "", opening: "10:00", closing: "21:30" },
    { id: 3, name: "Kopi Papa Kapit", address: "Kapit, Sarawak", phone: "", opening: "10:00", closing: "21:30" },
    { id: 4, name: "Kopi Papa Sibu", address: "Sibu, Sarawak", phone: "", opening: "10:00", closing: "21:30" },
  ];

  return <main className="inner-page stores-page">
    <header className="page-hero stores-hero">
      <h1>Find your<br /><em>Kopi Papa.</em></h1>
      <p>From Kuching to more corners of Sarawak, find the counter nearest to you.</p>
    </header>
    <section className="store-list">
      {stores.map((store, index) => <article key={store.id} data-reveal>
        <img src={images[index % images.length]} alt={`${store.name} storefront`} />
        <div>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <h2>{store.name}</h2>
          <p>{store.address}</p>
          <strong>{cleanTime(store.opening)} – {cleanTime(store.closing)}</strong>
          <div>
            {store.phone && <a href={`https://wa.me/${store.phone.replace(/\D/g, "")}`}>WhatsApp</a>}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`}>Open in Maps</a>
            <a href={orderUrl}>Order pickup</a>
          </div>
        </div>
      </article>)}
    </section>
  </main>;
}
