import type { CSSProperties } from "react";
import { getProducts, getStores, type WebsitePage, type WebsiteSection } from "@/lib/content";

const safeHref=(value?:string)=>value&&(value.startsWith("/")||value.startsWith("https://")||value.startsWith("http://localhost"))?value:"/";
async function PublishedSection({section}:{section:WebsiteSection}){
  if(section.type==="product_catalog"){
    const products=await getProducts();
    const groups=products.reduce<Record<string,typeof products>>((all,item)=>{(all[item.category]??=[]).push(item);return all},{});
    return <section className="cms-live-catalog"><header><h2>{section.heading}</h2><p>{section.body}</p></header>{Object.entries(groups).map(([category,items])=><div className="cms-catalog-group" key={category}><h3>{category}</h3><div>{items.map(item=><article key={item.id}><img src={item.image} alt={item.name}/><h4>{item.name}</h4><p>{item.description}</p></article>)}</div></div>)}</section>
  }
  if(section.type==="store_list"){
    const stores=await getStores();
    return <section className="cms-live-stores"><header><h2>{section.heading}</h2><p>{section.body}</p></header><div>{stores.map(store=><article key={store.id}><h3>{store.name}</h3><p>{store.address}</p><strong>{store.opening.slice(0,5)} – {store.closing.slice(0,5)}</strong></article>)}</div></section>
  }
  const imageStyle:CSSProperties={objectPosition:`${section.imagePositionX??50}% ${section.imagePositionY??50}%`,height:section.imageHeight?`${Math.max(180,Math.min(section.imageHeight,900))}px`:undefined};
  return <section className={`cms-section cms-${section.type} cms-bg-${section.background??"white"} cms-align-${section.align??"left"}`}>
    {section.imageUrl&&section.type!=="rich_text"&&<img src={section.imageUrl} alt="" style={imageStyle}/>}<div><h2>{section.heading}</h2><p>{section.body}</p>{section.buttonLabel&&<a className="button navy" href={safeHref(section.buttonUrl)}>{section.buttonLabel}</a>}</div>
  </section>
}
export function PublishedPage({page}:{page:WebsitePage}){return <main className="cms-page">{page.sections.map(section=><PublishedSection section={section} key={section.id}/>)}</main>}
