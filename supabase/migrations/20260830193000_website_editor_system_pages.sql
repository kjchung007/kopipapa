alter table public.website_pages
  add column if not exists route_path text,
  add column if not exists is_system boolean not null default false;

update public.website_pages set route_path='/'||slug where route_path is null;
alter table public.website_pages alter column route_path set not null;
alter table public.website_pages add constraint website_pages_route_path_format check (route_path='/' or route_path ~ '^/[a-z0-9]+(?:-[a-z0-9]+)*$');
create unique index if not exists website_pages_route_path_unique on public.website_pages(route_path);

insert into public.website_pages(title,slug,route_path,is_system,seo_title,seo_description,draft_content)
values
('Home','home','/',true,'Kopi Papa | Born in Sarawak','Traditional local kopi meets modern coffee culture. Born in Sarawak and brewed forward.',
 '{"sections":[
  {"id":"home-hero","type":"hero","heading":"Born in Sarawak.\nBrewed forward.","body":"Kopi Papa brings the strength of local kopi into a modern coffee experience, made for every generation.","imageUrl":"/assets/hero-drinks.png","buttonLabel":"Order for pickup","buttonUrl":"http://localhost:5173","background":"navy","align":"left","imagePositionX":50,"imagePositionY":100,"imageHeight":620},
  {"id":"home-culture","type":"text_image","heading":"Two coffee cultures. One Double Soul.","body":"Traditional local coffee and modern espresso meet in Kopi Papa''s defining drink.","imageUrl":"/assets/about-counter.jpg","background":"cream","align":"left","imagePositionX":50,"imagePositionY":50,"imageHeight":560},
  {"id":"home-sarawak","type":"text_image","heading":"A Sarawak point of view.","body":"Local flavours are not an accent here. They are the starting point.","imageUrl":"/assets/customer-cup.webp","background":"white","align":"left","imagePositionX":50,"imagePositionY":50,"imageHeight":560},
  {"id":"home-cta","type":"call_to_action","heading":"Pick it up. Carry the tradition.","body":"Your next cup is closer than you think.","buttonLabel":"Start an order","buttonUrl":"http://localhost:5173","background":"gold","align":"center"}
 ]}'::jsonb),
('Menu','menu','/menu',true,'Menu','Explore Kopi Papa''s local kopi, signature lattes, matcha, refreshers and bites.',
 '{"sections":[
  {"id":"menu-hero","type":"hero","heading":"Choose your kind of coffee day.","body":"Traditional, modern, bold or bright. Every item shown here comes from the live Kopi Papa menu.","imageUrl":"/assets/menu-hero-image2.png","background":"navy","align":"left","imagePositionX":60,"imagePositionY":100,"imageHeight":700},
  {"id":"menu-catalog","type":"product_catalog","heading":"Made for every coffee day.","body":"The live menu catalogue remains connected to Menu Management.","background":"cream","align":"left"}
 ]}'::jsonb),
('Our Story','story','/story',true,'Our Story','The Sarawak story behind Kopi Papa.',
 '{"sections":[
  {"id":"story-hero","type":"hero","heading":"From kopitiam roots to a Sarawak dream.","body":"Our story began around a family table.","imageUrl":"/assets/customer-group.webp","background":"navy","align":"left","imagePositionX":58,"imagePositionY":50,"imageHeight":620},
  {"id":"story-origin","type":"text_image","heading":"Coffee meant more than a drink.","body":"Growing up around their parents'' eatery, the founders watched family gather around coffee. The cup came to represent familiarity, responsibility and the people who quietly kept a household moving.","imageUrl":"/assets/about-counter.jpg","background":"white","align":"left","imagePositionX":50,"imagePositionY":50,"imageHeight":650},
  {"id":"story-cta","type":"call_to_action","heading":"The next chapter is still brewing.","body":"The past gives the cup its character.","buttonLabel":"Visit Kopi Papa","buttonUrl":"/stores","background":"gold","align":"center"}
 ]}'::jsonb),
('Stores','stores','/stores',true,'Stores','Find Kopi Papa stores, opening hours and pickup details.',
 '{"sections":[
  {"id":"stores-hero","type":"hero","heading":"Find your Kopi Papa.","body":"From Kuching to more corners of Sarawak, find the counter nearest to you.","imageUrl":"/assets/store-cityone.webp","background":"navy","align":"left","imagePositionX":50,"imagePositionY":50,"imageHeight":620},
  {"id":"stores-list","type":"store_list","heading":"Your nearest counter.","body":"Store details and opening hours remain connected to Store Management.","background":"cream","align":"left"}
 ]}'::jsonb)
on conflict(slug) do update set
  route_path=excluded.route_path,
  is_system=true,
  seo_title=case when public.website_pages.published_content is null then excluded.seo_title else public.website_pages.seo_title end,
  seo_description=case when public.website_pages.published_content is null then excluded.seo_description else public.website_pages.seo_description end,
  draft_content=case when public.website_pages.published_content is null and public.website_pages.draft_content='{"sections":[]}'::jsonb then excluded.draft_content else public.website_pages.draft_content end;

notify pgrst,'reload schema';
