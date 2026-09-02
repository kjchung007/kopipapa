import { getProducts, getPublishedPageByPath, money, orderUrl } from "@/lib/content";
import { PublishedPage } from "@/components/PublishedPage";

export const metadata = {
  title: "Menu",
  description: "Explore Kopi Papa's local kopi, signature lattes, matcha, refreshers and bites.",
};

export default async function MenuPage() {
  const [published,products] = await Promise.all([getPublishedPageByPath("/menu"),getProducts()]);
  if(published) return <PublishedPage page={published}/>;
  const groups = products.reduce<Record<string, typeof products>>((all, item) => {
    (all[item.category] ||= []).push(item);
    return all;
  }, {});

  return <main className="inner-page">
    <header className="page-hero menu-hero">
      <div className="menu-hero-copy">
        <h1>Choose your kind<br />of <em>coffee day.</em></h1>
        <p>Traditional, modern, bold or bright. Every item shown here comes from the live Kopi Papa menu.</p>
      </div>
      <div className="menu-hero-cup">
        <img src="/assets/menu-hero-image2.png" alt="Kopi Papa coffee" width="512" height="512" />
      </div>
    </header>
    <nav className="category-jump" aria-label="Menu categories">
      {Object.keys(groups).map((name) => <a key={name} href={`#${name.toLowerCase().replaceAll(" ", "-")}`}>{name}</a>)}
    </nav>
    <div className="menu-sections">
      {Object.entries(groups).map(([category, items]) => <section id={category.toLowerCase().replaceAll(" ", "-")} key={category} data-reveal>
        <div className="menu-category-heading"><h2>{category}</h2><span>{items.length} items</span></div>
        <div className="menu-grid">
          {items.map((item) => <article key={item.id}>
            <div><img src={item.image} alt={item.name} /></div>
            <span>{money(item.priceCents)}</span>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            <a href={orderUrl}>Order this drink</a>
          </article>)}
        </div>
      </section>)}
    </div>
  </main>;
}
