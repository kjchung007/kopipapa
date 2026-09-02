import Link from "next/link";
import { getPublishedPageByPath } from "@/lib/content";
import { PublishedPage } from "@/components/PublishedPage";

export const metadata = {
  title: "Our Story",
  description: "The Sarawak story behind Kopi Papa, founded by brothers Mike and Jim Siau.",
};

export default async function StoryPage() {
  const published=await getPublishedPageByPath("/story");
  if(published) return <PublishedPage page={published}/>;
  return <main className="inner-page story-page">
    <header className="page-hero story-hero">
      <p>Our story began around a family table.</p>
      <h1>From kopitiam roots<br />to a <em>Sarawak dream.</em></h1>
    </header>
    <section className="story-opening" data-reveal>
      <img src="/assets/about-counter.jpg" alt="Kopi Papa store counter" />
      <div><h2>Coffee meant more than a drink.</h2><p>Growing up around their parents&apos; eatery, brothers Mike and Jim Siau watched the men in their family gather around coffee. The cup came to represent familiarity, responsibility and the people who quietly kept a household moving.</p><p>Years later, university nights and changing café culture turned that early memory into a new ambition.</p></div>
    </section>
    <section className="story-quote" data-reveal><blockquote>Quality, strong “kaw” coffee at an affordable price, serving both traditional and modern styles.</blockquote><p>The idea behind Kopi Papa</p></section>
    <section className="story-chapters section" data-reveal>
      <article><span>2023</span><h2>The first pour</h2><p>After months of research and development, Kopi Papa launched in Kuching with a clear purpose: bring the best of traditional kopi and modern espresso into one contemporary experience.</p></article>
      <article><span>Double Soul</span><h2>The meeting point</h2><p>The signature recipe combines traditional local coffee with espresso. It became the clearest expression of what Kopi Papa wanted to contribute to coffee culture.</p></article>
      <article><span>Sarawak</span><h2>The bigger dream</h2><p>From TT3 to CityOne, coffee trucks, Kapit and beyond, the goal is to grow while supporting local farmers and giving Sarawak coffee a wider stage.</p></article>
    </section>
    <section className="story-gallery" data-reveal><img src="/assets/store-kapit-2.webp" alt="Kopi Papa storefront in Kapit" /><img src="/assets/customer-group.webp" alt="Customers with Kopi Papa drinks" /></section>
    <section className="closing-cta"><p>The past gives the cup its character.</p><h2>The next chapter<br />is still brewing.</h2><Link className="button gold" href="/stores">Visit Kopi Papa</Link></section>
  </main>;
}
