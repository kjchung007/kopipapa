import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type SectionType = "hero" | "text_image" | "rich_text" | "call_to_action" | "product_catalog" | "store_list";
type WebsiteSection = {
  id: string;
  type: SectionType;
  heading: string;
  body: string;
  imageUrl?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  background?: "navy" | "cream" | "white" | "gold";
  align?: "left" | "center";
  imagePositionX?: number;
  imagePositionY?: number;
  imageHeight?: number;
};
type WebsitePage = {
  id: number;
  title: string;
  slug: string;
  route_path: string;
  is_system: boolean;
  seo_title: string;
  seo_description: string;
  draft_content: { sections: WebsiteSection[] };
  published_content: { sections: WebsiteSection[] } | null;
  published_at: string | null;
  updated_at: string;
};
type Version = { id: number; version_number: number; created_at: string };
type WebsiteAsset = { id:number; storage_path:string; public_url:string; file_name:string; width:number|null; height:number|null; alt_text:string };
type WebsiteRedirect = { id:number; from_path:string; to_path:string; status_code:number; active:boolean };
type Device = "mobile" | "tablet" | "desktop";
type PreviewMode = "draft" | "live";

const newSection = (type: SectionType): WebsiteSection => ({
  id: crypto.randomUUID(),
  type,
  heading:
    type === "hero"
      ? "A new Kopi Papa story"
      : type === "product_catalog"
        ? "Explore the menu"
        : type === "store_list"
          ? "Find your nearest store"
      : type === "call_to_action"
        ? "Ready for your next cup?"
        : "Section heading",
  body: "Add your message here. Keep it clear, warm and easy to understand.",
  buttonLabel: type === "hero" || type === "call_to_action" ? "Discover more" : undefined,
  buttonUrl: type === "hero" || type === "call_to_action" ? "/menu" : undefined,
  background: type === "hero" ? "navy" : type === "call_to_action" ? "gold" : "white",
  align: type === "call_to_action" ? "center" : "left",
});

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function EditorGlyph({ name }: { name: "desktop" | "tablet" | "mobile" | "tools" | "edit" | "trash" }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "desktop" && <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></>}
    {name === "tablet" && <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></>}
    {name === "mobile" && <><rect x="8" y="2" width="8" height="20" rx="2"/><path d="M11 18h2"/></>}
    {name === "tools" && <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>}
    {name === "edit" && <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></>}
    {name === "trash" && <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>}
  </svg>;
}

export function WebsiteEditor({ client, onExit }: { client: SupabaseClient; onExit: () => void }) {
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [assets, setAssets] = useState<WebsiteAsset[]>([]);
  const [redirects, setRedirects] = useState<WebsiteRedirect[]>([]);
  const [device, setDevice] = useState<Device>("desktop");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("live");
  const [editing, setEditing] = useState(false);
  const [pagesVisible, setPagesVisible] = useState(true);
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<WebsiteAsset | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const page = pages.find((item) => item.id === selectedId) ?? null;
  const sections = page?.draft_content?.sections ?? [];
  const activeSection = sections.find((section) => section.id === selectedSection) ?? null;

  const load = useCallback(async () => {
    const [{data,error:loadError},{data:assetRows},{data:redirectRows}] = await Promise.all([
      client.from("website_pages").select("id,title,slug,route_path,is_system,seo_title,seo_description,draft_content,published_content,published_at,updated_at").order("updated_at", { ascending: false }),
      client.from("website_assets").select("id,storage_path,public_url,file_name,width,height,alt_text").order("created_at",{ascending:false}),
      client.from("website_redirects").select("id,from_path,to_path,status_code,active").order("created_at",{ascending:false}),
    ]);
    if (loadError) {
      setError(loadError.message.includes("website_pages") ? "Website Editor database setup is not installed yet." : loadError.message);
      return;
    }
    const rows = (data ?? []) as WebsitePage[];
    setPages(rows);
    setAssets((assetRows??[]) as WebsiteAsset[]);
    setRedirects((redirectRows??[]) as WebsiteRedirect[]);
    setSelectedId((current) => current ?? rows[0]?.id ?? null);
  }, [client]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedId) return;
    client.from("website_page_versions").select("id,version_number,created_at").eq("page_id", selectedId)
      .order("version_number", { ascending: false }).limit(10)
      .then(({ data }) => setVersions((data ?? []) as Version[]));
  }, [client, selectedId]);

  function patchPage(patch: Partial<WebsitePage>) {
    if (!page) return;
    setPages((current) => current.map((item) => item.id === page.id ? { ...item, ...patch } : item));
  }
  function patchSection(sectionId: string, patch: Partial<WebsiteSection>) {
    patchPage({ draft_content: { sections: sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) } });
  }

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    setBusy(true); setError("");
    const { data: auth } = await client.auth.getUser();
    const { data, error: createError } = await client.from("website_pages").insert({
      title, slug: slugify(title), route_path:`/${slugify(title)}`, created_by: auth.user?.id, updated_by: auth.user?.id,
      draft_content: { sections: [newSection("hero")] },
    }).select("*").single();
    setBusy(false);
    if (createError) { setError(createError.message); return; }
    setPages((current) => [data as WebsitePage, ...current]);
    setSelectedId(data.id); setSelectedSection(data.draft_content.sections[0].id);
    event.currentTarget.reset();
  }

  async function saveDraft():Promise<boolean> {
    if (!page) return false;
    setBusy(true); setError(""); setNotice("");
    const { data: auth } = await client.auth.getUser();
    const { error: saveError } = await client.from("website_pages").update({
      title: page.title.trim(), slug: slugify(page.slug), seo_title: page.seo_title,
      route_path:page.is_system?page.route_path:`/${slugify(page.slug)}`,
      seo_description: page.seo_description, draft_content: page.draft_content,
      updated_by: auth.user?.id, updated_at: new Date().toISOString(),
    }).eq("id", page.id);
    setBusy(false);
    if (saveError) { setError(saveError.message); return false; }
    setNotice("Draft saved");
    return true;
  }

  async function publish() {
    if (!page) return;
    if(!await saveDraft()) return;
    setBusy(true); setError("");
    const { error: publishError } = await client.rpc("publish_website_page", { p_page_id: page.id });
    setBusy(false);
    if (publishError) { setError(publishError.message); return; }
    setPublishConfirm(false);
    setNotice("Published successfully");
    await load();
  }

  async function restore(versionId: number) {
    setBusy(true); setError("");
    const { error: restoreError } = await client.rpc("restore_website_page_version", { p_version_id: versionId });
    setBusy(false);
    if (restoreError) { setError(restoreError.message); return; }
    setNotice("Version restored to your draft");
    await load();
  }

  function addSection(type: SectionType) {
    const section = newSection(type);
    patchPage({ draft_content: { sections: [...sections, section] } });
    setSelectedSection(section.id);
  }
  function moveSection(id: string, direction: -1 | 1) {
    const index = sections.findIndex((section) => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    patchPage({ draft_content: { sections: next } });
  }
  function removeSection(id: string) {
    patchPage({ draft_content: { sections: sections.filter((section) => section.id !== id) } });
    setSelectedSection(null);
  }

  async function uploadAsset(file:File){
    if(!file.type.startsWith("image/")){setError("Choose an image file.");return}
    if(file.size>5_000_000){setError("Image must be smaller than 5 MB.");return}
    setBusy(true);setError("");
    const dimensions=await new Promise<{width:number;height:number}>((resolve,reject)=>{const image=new Image();image.onload=()=>{resolve({width:image.naturalWidth,height:image.naturalHeight});URL.revokeObjectURL(image.src)};image.onerror=reject;image.src=URL.createObjectURL(file)}).catch(()=>({width:0,height:0}));
    const safeName=file.name.replace(/[^a-z0-9._-]/gi,"-");
    const path=`website/${crypto.randomUUID()}-${safeName}`;
    const {error:uploadError}=await client.storage.from("public-assets").upload(path,file,{contentType:file.type});
    if(uploadError){setBusy(false);setError(uploadError.message);return}
    const {data:publicData}=client.storage.from("public-assets").getPublicUrl(path);
    const {data:asset,error:assetError}=await client.from("website_assets").insert({storage_path:path,public_url:publicData.publicUrl,file_name:file.name,mime_type:file.type,width:dimensions.width||null,height:dimensions.height||null}).select("id,storage_path,public_url,file_name,width,height,alt_text").single();
    setBusy(false);
    if(assetError){setError(assetError.message);return}
    setAssets(current=>[asset as WebsiteAsset,...current]);
    if(activeSection){
      patchSection(activeSection.id,{imageUrl:publicData.publicUrl,imagePositionX:50,imagePositionY:50,imageHeight:560});
      setNotice("Image uploaded and added to this section.");
    }else{
      setNotice("Image uploaded to the media library. Select a section to place it.");
    }
  }

  async function addRedirect(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);const from=String(form.get("from")??"").trim();const to=String(form.get("to")??"").trim();
    if(!from.startsWith("/")||!to.startsWith("/")){setError("Redirect paths must start with /");return}
    const {data,error:redirectError}=await client.from("website_redirects").insert({from_path:from,to_path:to,status_code:308,active:true}).select("id,from_path,to_path,status_code,active").single();
    if(redirectError){setError(redirectError.message);return}setRedirects(current=>[data as WebsiteRedirect,...current]);event.currentTarget.reset();setNotice("Redirect added");
  }
  async function removeRedirect(id:number){const {error:removeError}=await client.from("website_redirects").delete().eq("id",id);if(removeError){setError(removeError.message);return}setRedirects(current=>current.filter(item=>item.id!==id))}

  function requestAssetDeletion(asset: WebsiteAsset) {
    const usedBy = pages.filter((candidate) => {
      const draftSections = candidate.draft_content?.sections ?? [];
      const publishedSections = candidate.published_content?.sections ?? [];
      return [...draftSections, ...publishedSections].some((section) => section.imageUrl === asset.public_url);
    });
    if (usedBy.length) {
      setError(`This image is still used by ${usedBy.map((candidate) => candidate.title).join(", ")}. Remove it from those sections before deleting it.`);
      return;
    }
    setError("");
    setAssetToDelete(asset);
  }

  async function deleteAsset() {
    if (!assetToDelete) return;
    setBusy(true); setError("");
    const { error: storageError } = await client.storage.from("public-assets").remove([assetToDelete.storage_path]);
    if (storageError) { setBusy(false); setError(storageError.message); return; }
    const { error: rowError } = await client.from("website_assets").delete().eq("id", assetToDelete.id);
    setBusy(false);
    if (rowError) { setError(`The file was removed, but its media record could not be cleared: ${rowError.message}`); return; }
    setAssets((current) => current.filter((asset) => asset.id !== assetToDelete.id));
    setNotice("Image permanently deleted.");
    setAssetToDelete(null);
  }

  const previewStyle = useMemo(() => ({
    width: device === "mobile" ? 390 : device === "tablet" ? 768 : "100%",
  }), [device]);
  const configuredWebsiteUrl = (import.meta.env.VITE_WEBSITE_URL as string | undefined)?.replace(/\/$/, "");
  const fallbackWebsiteUrl = import.meta.env.PROD
    ? "https://kopipapa.vercel.app"
    : `${window.location.protocol}//${window.location.hostname}:3000`;
  const liveWebsiteUrl = `${configuredWebsiteUrl || fallbackWebsiteUrl}${page?.route_path ?? "/"}`;

  function startEditing() {
    if (window.innerWidth < 1024) {
      setError("Website editing is available on laptop and desktop screens only.");
      return;
    }
    setDevice("desktop");
    setPreviewMode("draft");
    setEditing(true);
    setPagesVisible(true);
    setInspectorVisible(true);
  }

  return <section className={`website-editor website-editor-fullscreen ${editing ? "is-editing" : "is-previewing"}`}>
    {(error || notice) && <div className={error ? "editor-message error" : "editor-message success"} role="status">{error || notice}</div>}
    {controlsVisible ? <header className="fullscreen-editor-toolbar">
      <button className="editor-back-button" type="button" onClick={onExit} aria-label="Back to admin dashboard">← <span>Back to admin</span></button>
      <div className="preview-mode-switch" aria-label="Preview source">
        <button className={previewMode === "draft" ? "active" : ""} onClick={() => setPreviewMode("draft")}>Draft</button>
        <button className={previewMode === "live" ? "active" : ""} onClick={() => setPreviewMode("live")}>Current website</button>
      </div>
      <div className="fullscreen-editor-actions">
        <div className="device-icon-switch" aria-label="Preview device">
          {(["desktop", "tablet", "mobile"] as Device[]).map((name) => <button type="button" className={device === name ? "active" : ""} key={name} onClick={() => setDevice(name)} aria-label={`${name} preview`} title={`${name} preview`}><EditorGlyph name={name}/></button>)}
        </div>
        {!editing && <button className="enter-edit-mode" type="button" onClick={startEditing}><EditorGlyph name="edit"/><span>Edit</span></button>}
        {editing && <button className="publish-button" type="button" onClick={() => setPublishConfirm(true)} disabled={busy}>Publish</button>}
        <div className="editor-tools-menu">
          <button type="button" className={toolsOpen ? "active tools-trigger" : "tools-trigger"} onClick={() => setToolsOpen((value) => !value)} aria-label="Open editor tools" aria-expanded={toolsOpen}><EditorGlyph name="tools"/><span>Tools</span></button>
          {toolsOpen && <><button className="tools-backdrop" type="button" aria-label="Close editor tools" onClick={() => setToolsOpen(false)}/><div className="editor-tools-popover">
            {editing && <><button type="button" onClick={() => setPagesVisible((value) => !value)}><span>Pages & redirects</span><b>{pagesVisible ? "Shown" : "Hidden"}</b></button><button type="button" onClick={() => setInspectorVisible((value) => !value)}><span>Editor settings</span><b>{inspectorVisible ? "Shown" : "Hidden"}</b></button><button type="button" onClick={() => {setEditing(false);setToolsOpen(false)}}>Exit editing</button><button type="button" onClick={() => void saveDraft()} disabled={busy}>Save draft</button></>}
            <button type="button" onClick={() => {setControlsVisible(false);setToolsOpen(false)}}>Hide all controls</button>
          </div></>}
        </div>
      </div>
    </header> : <button className="show-editor-controls" type="button" onClick={() => setControlsVisible(true)}>Show controls</button>}
    <p className="desktop-edit-note">Editing is available on laptop and desktop screens. Preview remains available on smaller devices.</p>
    <div className={`website-editor-grid ${pagesVisible ? "show-pages" : ""} ${inspectorVisible ? "show-inspector" : ""}`}>
      {editing && pagesVisible && <aside className="website-pages-panel panel floating-editor-panel">
        <div className="editor-panel-heading"><div><span>Website pages</span><h2>{pages.length} pages</h2></div></div>
        <form className="new-page-form" onSubmit={createPage}>
          <input name="title" aria-label="New page title" placeholder="New page title" required />
          <button disabled={busy}>Add</button>
        </form>
        <div className="website-page-list">
          {pages.map((item) => <button className={item.id === selectedId ? "active" : ""} key={item.id} onClick={() => { setSelectedId(item.id); setSelectedSection(null); }}>
            <span><strong>{item.title}</strong><small>{item.route_path}</small></span>
            <i className={item.published_at ? "published" : "draft"}>{item.published_at ? "Live" : "Draft"}</i>
          </button>)}
          {!pages.length && <p>Create your first editable website page.</p>}
        </div>
        <div className="redirect-manager">
          <span>URL redirects</span>
          <form onSubmit={addRedirect}><input name="from" aria-label="Old path" placeholder="/old-page" required/><input name="to" aria-label="New path" placeholder="/new-page" required/><button>Add redirect</button></form>
          <div>{redirects.map(redirect=><article key={redirect.id}><span><strong>{redirect.from_path}</strong><small>→ {redirect.to_path}</small></span><button aria-label={`Remove redirect from ${redirect.from_path}`} onClick={()=>void removeRedirect(redirect.id)}>Remove</button></article>)}</div>
        </div>
      </aside>}

      <div className="website-canvas-column">
        {page ? <>
          <div className="website-preview-stage">
            <div className={`website-preview ${device}`} style={previewStyle}>
              <div className="preview-browser"><span /><span /><span /><small>/{page.slug}</small></div>
              {previewMode === "live" ? <iframe className="live-website-frame" title={`Current ${page.title} website`} src={liveWebsiteUrl} /> : <>
              <header className="preview-site-header">
                <div className="preview-site-brand"><span className="preview-logo">KP</span><span><strong>Kopi Papa</strong><small>Dad&apos;s Secret, Sip of Tradition</small></span></div>
                <nav><span>Home</span><span>Menu</span><span>Our Story</span><span>Stores</span><b>Order Now</b></nav>
              </header>
              <main className="preview-cms-page">
              {sections.map((section, index) => <article key={section.id} onClick={() => setSelectedSection(section.id)} className={`preview-section cms-${section.type} cms-bg-${section.background ?? "white"} ${selectedSection === section.id ? "selected" : ""} cms-align-${section.align ?? "left"}`}>
                {section.imageUrl && section.type !== "rich_text" && <img src={section.imageUrl} alt="" style={{objectPosition:`${section.imagePositionX??50}% ${section.imagePositionY??50}%`,height:section.imageHeight?`${section.imageHeight}px`:undefined}} />}
                <div><small className="preview-section-number">{String(index + 1).padStart(2, "0")}</small><h2>{section.heading}</h2><p>{section.body}</p>{(section.type==="product_catalog"||section.type==="store_list")&&<span className="live-data-label">Live Supabase data</span>}{section.buttonLabel && <span className="preview-cta">{section.buttonLabel}</span>}</div>
              </article>)}
              {!sections.length && <div className="empty-preview"><h2>Start with a section</h2><p>Choose a section from the inspector to begin designing this page.</p></div>}
              </main>
              <footer className="preview-site-footer"><div><span className="preview-logo">KP</span><span><strong>Kopi Papa</strong><p>Born in Sarawak. Brewed forward.</p></span></div><nav><span>Home</span><span>Menu</span><span>Our Story</span><span>Stores</span></nav></footer>
              </>}
            </div>
          </div>
        </> : <div className="panel editor-empty"><h2>Select or create a page</h2><p>Your responsive live preview will appear here.</p></div>}
      </div>

      {editing && inspectorVisible && <aside className="website-inspector panel floating-editor-panel">
        {page ? <>
          <div className="inspector-tabs"><strong>{activeSection ? "Section" : "Page"}</strong><span>{activeSection?.type.replaceAll("_", " ") ?? "Settings"}</span></div>
          {!activeSection ? <div className="inspector-form">
            <label>Page title<input value={page.title} onChange={(event) => patchPage({ title: event.target.value })} /></label>
            <label>URL path<div className="slug-input"><span>/</span><input disabled={page.is_system} value={page.route_path==="/"?"":page.slug} onChange={(event) => patchPage({ slug: slugify(event.target.value),route_path:`/${slugify(event.target.value)}` })} /></div>{page.is_system&&<small className="field-help">Protected system route</small>}</label>
            <label>SEO title <small>{page.seo_title.length}/70</small><input maxLength={70} value={page.seo_title} onChange={(event) => patchPage({ seo_title: event.target.value })} /></label>
            <label>SEO description <small>{page.seo_description.length}/180</small><textarea maxLength={180} value={page.seo_description} onChange={(event) => patchPage({ seo_description: event.target.value })} /></label>
            <div className="page-media-library">
              <div><strong>Images</strong><small>Upload here, then select a section in the preview to place an image.</small></div>
              <label className="asset-upload">Upload image<input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(file)void uploadAsset(file)}}/><span>{busy ? "Uploading..." : "Add image"}</span></label>
              {!!assets.length&&<div className="asset-library"><span>Media library</span><div>{assets.slice(0,12).map(asset=><article className="asset-tile" key={asset.id}><button type="button" title={asset.file_name} onClick={()=>setError("Select a section in the website preview, then choose this image again.")}><img src={asset.public_url} alt={asset.alt_text}/></button><button className="delete-asset" type="button" aria-label={`Delete ${asset.file_name}`} title="Delete image" onClick={()=>requestAssetDeletion(asset)}><EditorGlyph name="trash"/></button></article>)}</div></div>}
            </div>
            <div className="add-section"><span>Add a section</span>{(["hero", "text_image", "rich_text", "call_to_action", "product_catalog", "store_list"] as SectionType[]).map((type) => <button key={type} onClick={() => addSection(type)}>{type.replaceAll("_", " ")}</button>)}</div>
            {!!versions.length && <div className="version-list"><span>Published history</span>{versions.map((version) => <button key={version.id} onClick={() => void restore(version.id)}><strong>Version {version.version_number}</strong><small>{new Date(version.created_at).toLocaleString()}</small></button>)}</div>}
          </div> : <div className="inspector-form">
            <button className="back-page-settings" onClick={() => setSelectedSection(null)}>← Page settings</button>
            <label>Heading<textarea value={activeSection.heading} onChange={(event) => patchSection(activeSection.id, { heading: event.target.value })} /></label>
            <label>Body<textarea value={activeSection.body} onChange={(event) => patchSection(activeSection.id, { body: event.target.value })} /></label>
            {!(["rich_text","product_catalog","store_list"] as SectionType[]).includes(activeSection.type)&&<>
              <label className="asset-upload">Section image<input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(file)void uploadAsset(file)}}/><span>{busy?"Uploading…":"Choose image"}</span></label>
              {!!assets.length&&<div className="asset-library"><span>Image library</span><div>{assets.slice(0,12).map(asset=><article className="asset-tile" key={asset.id}><button type="button" title={asset.file_name} onClick={()=>patchSection(activeSection.id,{imageUrl:asset.public_url,imagePositionX:50,imagePositionY:50})}><img src={asset.public_url} alt={asset.alt_text}/></button><button className="delete-asset" type="button" aria-label={`Delete ${asset.file_name}`} title="Delete image" onClick={()=>requestAssetDeletion(asset)}><EditorGlyph name="trash"/></button></article>)}</div></div>}
              <label>Image URL<input value={activeSection.imageUrl ?? ""} placeholder="https://…" onChange={(event) => patchSection(activeSection.id, { imageUrl: event.target.value })} /></label>
              {activeSection.imageUrl&&<div className="image-controls"><label>Horizontal focus <small>{activeSection.imagePositionX??50}%</small><input type="range" min="0" max="100" value={activeSection.imagePositionX??50} onChange={event=>patchSection(activeSection.id,{imagePositionX:Number(event.target.value)})}/></label><label>Vertical focus <small>{activeSection.imagePositionY??50}%</small><input type="range" min="0" max="100" value={activeSection.imagePositionY??50} onChange={event=>patchSection(activeSection.id,{imagePositionY:Number(event.target.value)})}/></label><label>Image height <small>{activeSection.imageHeight??560}px</small><input type="range" min="180" max="900" step="20" value={activeSection.imageHeight??560} onChange={event=>patchSection(activeSection.id,{imageHeight:Number(event.target.value)})}/></label></div>}
            </>}
            <label>Background<select value={activeSection.background} onChange={(event) => patchSection(activeSection.id, { background: event.target.value as WebsiteSection["background"] })}><option value="white">White</option><option value="cream">Cream</option><option value="navy">Navy</option><option value="gold">Gold</option></select></label>
            <label>Text alignment<select value={activeSection.align} onChange={(event) => patchSection(activeSection.id, { align: event.target.value as WebsiteSection["align"] })}><option value="left">Left</option><option value="center">Center</option></select></label>
            {(activeSection.type === "hero" || activeSection.type === "call_to_action") && <><label>Button label<input value={activeSection.buttonLabel ?? ""} onChange={(event) => patchSection(activeSection.id, { buttonLabel: event.target.value })} /></label><label>Button link<input value={activeSection.buttonUrl ?? ""} onChange={(event) => patchSection(activeSection.id, { buttonUrl: event.target.value })} /></label></>}
            <div className="section-actions"><button onClick={() => moveSection(activeSection.id, -1)}>Move up</button><button onClick={() => moveSection(activeSection.id, 1)}>Move down</button><button className="danger" onClick={() => removeSection(activeSection.id)}>Delete section</button></div>
          </div>}
        </> : <p>Select a page to edit its content and settings.</p>}
      </aside>}
    </div>
    {publishConfirm && page && <div className="website-editor-modal-backdrop" role="presentation">
      <section className="website-editor-modal publish-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="publish-confirm-title">
        <span className="modal-eyebrow">Publish website page</span>
        <h2 id="publish-confirm-title">Replace the live {page.title} page?</h2>
        <p>The draft currently shown in the editor will replace the public page at <strong>{page.route_path}</strong>.</p>
        <ul>
          <li>Your latest draft changes will be saved first.</li>
          <li>The previous published version remains available in Published History.</li>
          <li>Visitors may take up to about 60 seconds to receive the updated page.</li>
          <li>Orders, products, customers and the admin system are not changed.</li>
        </ul>
        <div className="publish-warning">Review the Draft preview carefully. Publishing Home can replace the current hand-built Home layout with this editor version.</div>
        <footer><button type="button" onClick={() => setPublishConfirm(false)} disabled={busy}>Keep editing</button><button className="confirm-publish" type="button" onClick={() => void publish()} disabled={busy}>{busy ? "Publishing..." : `Publish ${page.title}`}</button></footer>
      </section>
    </div>}
    {assetToDelete && <div className="website-editor-modal-backdrop" role="presentation">
      <section className="website-editor-modal delete-image-modal" role="dialog" aria-modal="true" aria-labelledby="delete-image-title">
        <span className="modal-eyebrow">Delete image</span>
        <h2 id="delete-image-title">Permanently delete this image?</h2>
        <div className="delete-image-preview"><img src={assetToDelete.public_url} alt={assetToDelete.alt_text}/><div><strong>{assetToDelete.file_name}</strong><small>This removes the file from Supabase Storage and the media library. It cannot be recovered.</small></div></div>
        <footer><button type="button" onClick={() => setAssetToDelete(null)} disabled={busy}>Cancel</button><button className="confirm-delete-image" type="button" onClick={() => void deleteAsset()} disabled={busy}>{busy ? "Deleting..." : "Delete permanently"}</button></footer>
      </section>
    </div>}
  </section>;
}
