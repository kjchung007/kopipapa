import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return respond({error:"Method not allowed"},405);
  const authorization=req.headers.get("Authorization");
  if(!authorization) return respond({error:"Authentication required"},401);
  const url=Deno.env.get("SUPABASE_URL")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller=createClient(url,anonKey,{global:{headers:{Authorization:authorization}}});
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await caller.auth.getUser();
  if(userError||!user) return respond({error:"Invalid session"},401);
  const {data:team}=await admin.from("staff").select("user_id").eq("user_id",user.id).maybeSingle();
  if(team) return respond({error:"Team accounts must be removed by another global administrator"},403);
  const {error:prepareError}=await caller.rpc("prepare_self_account_deletion");
  if(prepareError) return respond({error:prepareError.message},400);
  const {error:deleteError}=await admin.auth.admin.deleteUser(user.id,false);
  if(deleteError) return respond({error:`Your profile was anonymized, but sign-in removal needs support: ${deleteError.message}`},409);
  return respond({ok:true});
});
