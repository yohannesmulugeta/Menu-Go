import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {createApp} from "../worker.js";
import {renderOccasion,OCCASION_ID,LOGO_PATH} from "../occasion-template.js";

const fixture=JSON.parse(readFileSync(new URL("./occasion-fixture.json",import.meta.url)));
const keys=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},false,["sign","verify"]);
const issuer="https://test.cloudflareaccess.com",audience="test-audience";
async function token(email) {
  const enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
  const now=Math.floor(Date.now()/1000);
  const text=enc({alg:"RS256",typ:"JWT"})+"."+enc({sub:"test-subject",email,type:"app",iss:issuer,aud:audience,iat:now,exp:now+600});
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(text));
  return text+"."+Buffer.from(signature).toString("base64url");
}
function setup() {
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON;"+readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
  const insert=(table,row)=>{const entries=Object.entries(row);db.prepare(`INSERT INTO ${table} (${entries.map(([k])=>k)}) VALUES (${entries.map(()=>"?")})`).run(...entries.map(([,v])=>v));};
  insert("restaurants",fixture.restaurant);
  for(const row of fixture.categories)insert("categories",row);
  for(const row of fixture.items)insert("menu_items",row);
  insert("restaurants",{id:"other-restaurant",name:"Other restaurant (test)",slug:"other-test",status:"active"});
  for(const [id,email] of [["admin-user","admin@example.test"],["occasion-user","occasion@example.test"],["other-user","other@example.test"],["disabled-user","disabled@example.test"]])insert("users",{id,email,disabled:id==="disabled-user"?1:0});
  insert("platform_admins",{user_id:"admin-user"});
  insert("restaurant_members",{id:"member-occasion",restaurant_id:OCCASION_ID,user_id:"occasion-user",role:"manager"});
  insert("restaurant_members",{id:"member-other",restaurant_id:"other-restaurant",user_id:"other-user",role:"manager"});
  function prepare(sql,params=[]) {
    return {bind(...p){return prepare(sql,p);},async first(){const row=db.prepare(sql).get(...params);return row?{...row}:null;},async all(){return {results:db.prepare(sql).all(...params).map(r=>({...r})),success:true};},async run(){const result=db.prepare(sql).run(...params);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}};
  }
  const env={ACCESS_ISSUER:issuer,ACCESS_AUD:audience,DB:{prepare,async batch(statements){db.exec("BEGIN");try{const out=[];for(const s of statements)out.push(await (s.all ? s.all():s.run()));db.exec("COMMIT");return out;}catch(e){db.exec("ROLLBACK");throw e;}}}};
  // D1 returns mutation metadata for batched writes; SQLite's all() also executes them.
  const rawPrepare=env.DB.prepare;
  env.DB.prepare=(sql)=>{
    function wrap(params=[]){return {bind(...p){return wrap(p);},first:()=>rawPrepare(sql).bind(...params).first(),all:()=>rawPrepare(sql).bind(...params).all(),async run(){return rawPrepare(sql).bind(...params).run();},_sql:sql,_params:params};}
    return wrap();
  };
  env.DB.batch=async statements=>{db.exec("BEGIN");try{const out=[];for(const s of statements){if(/^\s*(SELECT|PRAGMA)/i.test(s._sql))out.push(await s.all());else out.push(await s.run());}db.exec("COMMIT");return out;}catch(e){db.exec("ROLLBACK");throw e;}};
  const app=createApp({keyResolver:keys.publicKey});
  const request=async(path,{email,method="GET",body,headers={}}={})=>{
    if(email)headers["Cf-Access-Jwt-Assertion"]=await token(email);
    if(body){headers["Content-Type"]="application/json";headers.Origin="https://app.admakidigital.com";headers["X-Menu-Request"]="1";}
    return app.fetch(new Request("https://app.admakidigital.com"+path,{method,headers,body:body?JSON.stringify(body):undefined}),env,{});
  };
  return {db,app,env,request};
}

test("draft menu stays private; anonymous and forged sessions cannot preview",async()=>{
  const {request}=setup();
  assert.equal((await request("/r/occasion")).status,404);
  const anon=await request("/preview/occasion");
  assert.equal(anon.status,401);
  assert.equal(anon.headers.get("Cache-Control"),"private, no-store");
  assert.equal((await request("/preview/occasion",{headers:{"Cf-Access-Jwt-Assertion":"invalid"}})).status,401);
  assert.equal((await request("/preview/occasion",{email:"disabled@example.test"})).status,403);
});

test("platform admin and Occasion manager can preview; other restaurant manager cannot",async()=>{
  const {request}=setup();
  for(const email of ["admin@example.test","occasion@example.test"]){
    const response=await request("/preview/occasion",{email});
    assert.equal(response.status,200);
    assert.match(response.headers.get("X-Robots-Tag"),/noindex/);
    const html=await response.text();
    assert.equal((html.match(/class="item"/g)||[]).length,116);
    assert.equal((html.match(/class="menu-category"/g)||[]).length,15);
    assert.match(html,/Draft preview/);
    assert.match(html,/occasion-logo-v1.png/);
  }
  const denied=await request("/preview/occasion",{email:"other@example.test"});
  assert.equal(denied.status,403);
  assert.doesNotMatch(await denied.text(),/Cheese Burger/);
});

test("existing admin API edits feed preview immediately and tenant isolation is retained",async()=>{
  const {request,db}=setup();
  const item=fixture.items.find(i=>i.name==="Cheese Burger");
  const update={name:item.name,description:item.description,price:777.77,image_url:null,category_id:item.category_id,is_available:true,is_popular:false,version:1};
  const path=`/api/admin/restaurants/${OCCASION_ID}/items/${item.id}`;
  assert.equal((await request(path,{email:"other@example.test",method:"PUT",body:update})).status,403);
  const updated=await request(path,{email:"occasion@example.test",method:"PUT",body:update});
  assert.equal(updated.status,200,await updated.text());
  assert.equal(db.prepare("SELECT price FROM menu_items WHERE id=?").get(item.id).price,777.77);
  assert.match(await (await request("/preview/occasion",{email:"occasion@example.test"})).text(),/777\.77/);
  assert.equal((await request(path,{email:"occasion@example.test",method:"PATCH",body:{is_available:false}})).status,200);
  const html=await (await request("/preview/occasion",{email:"admin@example.test"})).text();
  assert.doesNotMatch(html,/<h3>Cheese Burger<\/h3>/);
  assert.equal((html.match(/class="item"/g)||[]).length,115);
});

test("active menu uses current data, GET/HEAD semantics, and category/deletion visibility",async()=>{
  const {request,db}=setup();
  db.prepare("UPDATE restaurants SET status='active' WHERE id=?").run(OCCASION_ID);
  const response=await request("/r/occasion");
  assert.equal(response.status,200);
  assert.doesNotMatch(await response.text(),/Draft preview/);
  const head=await request("/r/occasion",{method:"HEAD"});
  assert.equal(head.status,200);assert.equal(await head.text(),"");
  assert.equal((await request("/r/occasion",{method:"POST"})).status,405);
  db.prepare("UPDATE categories SET is_active=0 WHERE id=?").run(fixture.categories.find(c=>c.name==="Breakfast").id);
  db.prepare("UPDATE menu_items SET deleted_at=CURRENT_TIMESTAMP WHERE id=?").run(fixture.items.find(i=>i.name==="Cheese Burger").id);
  const html=await (await request("/r/occasion")).text();
  assert.doesNotMatch(html,/<h3>French Toast<\/h3>|<h3>Cheese Burger<\/h3>/);
});

test("menu text is escaped, unsafe image/contact URLs omitted, money retains two decimals",()=>{
  const html=renderOccasion({restaurant:{...fixture.restaurant,name:'<script>alert(1)</script>',logo_url:'javascript:alert(1)',google_maps_url:'https://example.test/" onmouseover="alert(1)'},categories:fixture.categories,items:fixture.items.map(i=>({...i,image_url:'javascript:alert(1)'}))});
  assert.doesNotMatch(html,/<script>alert|src="javascript:|href="javascript:/);
  assert.match(html,/&lt;script&gt;alert/);
  assert.match(html,/650\.60/);
});

test("logo and supporting assets are served exactly, and unrelated routes delegate",async()=>{
  const {request,env}=setup();
  const logo=await request(LOGO_PATH);
  assert.equal(logo.headers.get("Content-Type"),"image/png");
  assert.deepEqual(Buffer.from(await logo.arrayBuffer()),readFileSync(new URL("../Occasion_Logo_Enhanced.png",import.meta.url)));
  for(const path of ["/occasion-assets/menu.css","/occasion-assets/menu.js","/occasion-assets/admin-links.js"])assert.equal((await request(path)).status,200);
  let delegated=false;
  const app=createApp({baseApp:{async fetch(request){delegated=true;return new Response(request.url,{status:202});}}});
  assert.equal((await app.fetch(new Request("https://app.admakidigital.com/api/admin/restaurants"),env,{})).status,202);
  assert.equal(delegated,true);
});
