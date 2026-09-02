import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request:NextRequest){
  if(request.method!=="GET"&&request.method!=="HEAD")return NextResponse.next();
  const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return NextResponse.next();
  try{
    const endpoint=new URL(`${url}/rest/v1/website_redirects`);
    endpoint.searchParams.set("select","to_path,status_code");
    endpoint.searchParams.set("from_path",`eq.${request.nextUrl.pathname}`);
    endpoint.searchParams.set("active","eq.true");
    endpoint.searchParams.set("limit","1");
    const response=await fetch(endpoint,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:60}});
    if(!response.ok)return NextResponse.next();
    const [redirect]=await response.json() as {to_path:string;status_code:number}[];
    if(!redirect)return NextResponse.next();
    const destination=new URL(redirect.to_path,request.url);
    destination.search=request.nextUrl.search;
    return NextResponse.redirect(destination,redirect.status_code);
  }catch{return NextResponse.next()}
}

export const config={matcher:["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|assets).*)"]};
