import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
if(!manifest.project_id || manifest.d1 !== 'DB') throw new Error('Sites identity and DB binding are required');
await rm('dist', {recursive:true,force:true});
await mkdir('dist/server', {recursive:true});
await mkdir('dist/.openai', {recursive:true});
await cp('public','dist/client',{recursive:true});
await cp('src/worker.js','dist/server/index.js');
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
await writeFile('dist/server/package.json', JSON.stringify({type:'module'}));
await writeFile('dist/server/wrangler.json', JSON.stringify({
 name:'okusuri',main:'index.js',compatibility_date:'2026-10-01',
 assets:{directory:'../client',binding:'ASSETS',run_worker_first:true},
 d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000'}]
},null,2));
console.log('Built Sites Worker, static assets, and D1 migrations in dist/');
