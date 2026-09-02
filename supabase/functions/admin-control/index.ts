import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

type AdminClient=ReturnType<typeof createClient>;

async function clearCustomerData(admin:AdminClient,userId:string){
  for(const table of ["customer_cart_items","reward_ledger","reward_accounts","profiles"]){
    const {error}=await admin.from(table).delete().eq("user_id",userId);
    if(error) throw error;
  }
  const {error:voucherError}=await admin.from("user_vouchers").delete().eq("user_id",userId);
  if(voucherError) throw voucherError;
  const {error:orderError}=await admin.from("orders").delete().eq("user_id",userId);
  if(orderError) throw orderError;
}

async function deleteAuthUser(admin:AdminClient,userId:string){
  const {error}=await admin.auth.admin.deleteUser(userId,false);
  if(error) throw new Error(`Database data was removed, but Auth deletion failed: ${error.message}`);
}

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
  const {data:operator}=await admin.from("staff").select("role,active").eq("user_id",user.id).maybeSingle();
  if(!operator?.active||operator.role!=="global_admin") return respond({error:"Global administrator access required"},403);

  try{
    const body=await req.json(),action=String(body.action??""),targetId=String(body.targetId??"");
    if(action==="delete_staff"){
      if(!targetId||targetId===user.id) return respond({error:"You cannot delete your own administrator account"},400);
      const {data:target}=await admin.from("staff").select("role,display_name").eq("user_id",targetId).maybeSingle();
      if(!target) return respond({error:"Team account not found"},404);
      if(target.role==="global_admin"){
        const {count}=await admin.from("staff").select("user_id",{count:"exact",head:true}).eq("role","global_admin").eq("active",true);
        if((count??0)<=1) return respond({error:"The final global administrator cannot be deleted"},409);
      }
      await admin.from("staff").delete().eq("user_id",targetId).throwOnError();
      await admin.from("admin_users").delete().eq("user_id",targetId).throwOnError();
      await deleteAuthUser(admin,targetId);
      await admin.from("admin_audit_logs").insert({admin_id:user.id,action_type:"team.account_deleted",target_id:targetId,details_json:{display_name:target.display_name,role:target.role}}).throwOnError();
      return respond({ok:true});
    }
    if(action==="delete_customer"){
      if(!targetId) return respond({error:"Customer is required"},400);
      const {data:team}=await admin.from("staff").select("user_id").eq("user_id",targetId).maybeSingle();
      if(team) return respond({error:"Team accounts must be deleted from Store Management"},409);
      await clearCustomerData(admin,targetId);
      await deleteAuthUser(admin,targetId);
      await admin.from("admin_audit_logs").insert({admin_id:user.id,action_type:"customer.hard_deleted",target_id:targetId,details_json:{scope:"orders, cart, profile and rewards"}}).throwOnError();
      return respond({ok:true});
    }
    if(action==="system_reset"){
      const reset=String(body.reset??""),confirmation=String(body.confirmation??"");
      const phrases:Record<string,string>={customers:"WIPE CUSTOMERS",products:"WIPE PRODUCTS",stores_team:"WIPE STORES AND TEAM",factory:"FACTORY RESET"};
      if(!phrases[reset]||confirmation!==phrases[reset]) return respond({error:`Type ${phrases[reset]??"the exact confirmation phrase"} to continue`},400);
      const deletedAuthIds:string[]=[];
      if(reset==="customers"||reset==="factory"){
        const {data:staffRows}=await admin.from("staff").select("user_id");
        const staffIds=new Set((staffRows??[]).map((x)=>x.user_id));
        let page=1;
        while(true){
          const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000}); if(error) throw error;
          const batch=data.users.filter((x)=>!staffIds.has(x.id));
          for(const customer of batch){await clearCustomerData(admin,customer.id);await deleteAuthUser(admin,customer.id);deletedAuthIds.push(customer.id);}
          if(data.users.length<1000) break; page++;
        }
      }
      if(reset==="products"||reset==="factory"){
        await admin.from("store_product_availability").delete().neq("product_id",0).throwOnError();
        await admin.from("products").delete().neq("id",0).throwOnError();
      }
      if(reset==="stores_team"||reset==="factory"){
        const {data:teamRows}=await admin.from("staff").select("user_id,role").neq("user_id",user.id);
        await admin.from("orders").delete().not("store_id","is",null).throwOnError();
        await admin.from("customer_cart_items").delete().neq("id",0).throwOnError();
        await admin.from("staff").delete().neq("user_id",user.id).throwOnError();
        await admin.from("stores").delete().neq("id",0).throwOnError();
        for(const member of teamRows??[]){await admin.from("admin_users").delete().eq("user_id",member.user_id);await deleteAuthUser(admin,member.user_id);deletedAuthIds.push(member.user_id);}
      }
      if(reset==="factory"){
        for(const table of ["voucher_codes","user_vouchers","reward_ledger","reward_accounts","voucher_templates","campaigns","categories"]){
          const key=table==="reward_accounts"?"user_id":"id";
          await admin.from(table).delete().not(key,"is",null).throwOnError();
        }
      }
      await admin.from("admin_audit_logs").insert({admin_id:user.id,action_type:`system.reset.${reset}`,target_id:null,details_json:{confirmation,deleted_auth_accounts:deletedAuthIds.length,owner_account_preserved:true}}).throwOnError();
      return respond({ok:true,deletedAuthAccounts:deletedAuthIds.length,ownerPreserved:true});
    }
    return respond({error:"Unknown admin action"},400);
  }catch(error){return respond({error:error instanceof Error?error.message:"Admin operation failed"},400);}
});
