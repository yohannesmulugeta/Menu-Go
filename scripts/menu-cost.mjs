import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';

export const pricing={verified_on:'2026-11-27',currency:'USD',workers:{base:5,requests_included:10e6,requests_per_million:.30,cpu_ms_included:30e6,cpu_per_million_ms:.02},d1:{reads_included:25e9,reads_per_million:.001,writes_included:50e6,writes_per_million:1,gb_included:5,per_gb:.75},r2:{gb_included:10,per_gb:.015,a_included:1e6,a_per_million:4.5,b_included:10e6,b_per_million:.36},sources:['https://developers.cloudflare.com/workers/platform/pricing/','https://developers.cloudflare.com/d1/platform/pricing/','https://developers.cloudflare.com/r2/pricing/']};

export function estimate({tenants,viewsPerDay=300,imagesPerView=4,eventsPerView=1,cpuMs=20,htmlRows=39,imageRows=42,eventRows=80,eventWrites=4,mediaGBPerTenant=.06,d1GBPerTenant=.00055}) {
  for(const n of [tenants,viewsPerDay,imagesPerView,eventsPerView,cpuMs,htmlRows,imageRows,eventRows,eventWrites,mediaGBPerTenant,d1GBPerTenant])assert(Number.isFinite(n)&&n>=0,'Usage must be finite and nonnegative.');
  assert(Number.isInteger(tenants)&&tenants>0);
  const views=tenants*viewsPerDay*30,images=views*imagesPerView,events=views*eventsPerView,qr=Math.ceil(views*.01),logins=tenants*2*30,managerRequests=tenants*200,uploads=tenants*20;
  const requests=views+images+events+qr+logins+managerRequests+uploads;
  // Public CPU is an explicit sensitivity assumption. Login gets a separate 200 ms allowance.
  const cpu=(requests-logins)*cpuMs+logins*200;
  const reads=(views+qr)*htmlRows+images*imageRows+events*eventRows+(logins+managerRequests+uploads)*100;
  const writes=events*eventWrites+(logins+managerRequests+uploads)*10;
  const d1GB=tenants*d1GBPerTenant,r2GB=tenants*mediaGBPerTenant;
  const over=(n,included)=>Math.max(0,n-included),p=pricing;
  const costs={workers_base:p.workers.base,workers_requests:over(requests,p.workers.requests_included)/1e6*p.workers.requests_per_million,workers_cpu:over(cpu,p.workers.cpu_ms_included)/1e6*p.workers.cpu_per_million_ms,d1_reads:over(reads,p.d1.reads_included)/1e6*p.d1.reads_per_million,d1_writes:over(writes,p.d1.writes_included)/1e6*p.d1.writes_per_million,d1_storage:over(d1GB,p.d1.gb_included)*p.d1.per_gb,
    // R2 rounds usage up to whole GB and million-operation billing units.
    r2_storage:Math.ceil(over(r2GB,p.r2.gb_included))*p.r2.per_gb,r2_class_a:Math.ceil(over(uploads,p.r2.a_included)/1e6)*p.r2.a_per_million,r2_class_b:Math.ceil(over(images,p.r2.b_included)/1e6)*p.r2.b_per_million};
  return {tenants,assumptions:{viewsPerDay,imagesPerView,eventsPerView,cpuMs,htmlRows,imageRows,eventRows,eventWrites,mediaGBPerTenant,d1GBPerTenant},monthly_usage:{views,requests,cpu_ms:cpu,d1_rows_read:reads,d1_rows_written:writes,d1_gb:d1GB,r2_gb:r2GB,r2_class_a:uploads,r2_class_b:images},costs_usd:Object.fromEntries(Object.entries(costs).map(([k,v])=>[k,Math.round(v*10000)/10000])),total_usd:Math.round(Object.values(costs).reduce((a,b)=>a+b,0)*100)/100,free_plan_daily_limits:{requests_per_day:Math.ceil(requests/30),reads_per_day:Math.ceil(reads/30),writes_per_day:Math.ceil(writes/30),exceeds_worker_requests:requests/30>100000,exceeds_d1_reads:reads/30>5e6,exceeds_d1_writes:writes/30>100000}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  assert(process.argv[2],'Supply an output JSON path.');
  const output={pricing,scope:'Planning scenarios, not an invoice or measured Worker CPU. Paid-plan allowances are account-wide and assumed unused by other apps. Excludes domain, tax, exchange rate, support, backup services, observability and exceptional abuse. Manager/event usage and media/history retention are assumptions; HTML/image row counts are measured D1 metadata.',scenarios:[20,100,1000].map(tenants=>({tenants,sensitivity:[5,20,100].map(cpuMs=>estimate({tenants,cpuMs}))}))};
  await writeFile(process.argv[2],JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output.scenarios.map(s=>({tenants:s.tenants,usd_by_cpu_ms:Object.fromEntries(s.sensitivity.map(e=>[e.assumptions.cpuMs,e.total_usd]))}))));
}
