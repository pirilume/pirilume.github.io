(() => {
 const cfg=window.PIRILUME_ACCESS||{};
 const configured=Boolean(cfg.supabaseUrl && cfg.anonKey);
 let session=null, pending=false, refreshTimer, pollTimer, readerScrolled=false;
 const section=document.createElement('section'); section.id='biblioteca'; section.className='shell account-panel';
 section.innerHTML='<p class="eyebrow">SEU CANTINHO NO BOSQUE</p><h2>Minha biblioteca</h2><p>Use o e-mail do responsável para acessar sua coleção.</p><form id="account-form"><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><div class="account-actions"><button class="button primary" name="action" value="login">Entrar</button><button class="button secondary" name="action" value="signup">Criar conta</button><button class="text-link" type="button" id="recover-account">Esqueci a senha</button></div></form><div id="account-signed" hidden><p id="account-email"></p><div class="account-actions"><button id="account-refresh" class="button secondary">Verificar minha coleção</button><button id="account-buy" class="button primary">Comprar coleção · R$ 19,90</button><button id="account-logout" class="text-link">Sair</button></div></div><p id="account-status" role="status" aria-live="polite"></p><div id="owned-books" class="account-books"></div>';
 document.getElementById('home-view').append(section);
 const nav=document.querySelector('.site-header nav'); const link=document.createElement('a'); link.href='#biblioteca'; link.textContent='Minha biblioteca'; nav?.append(link);
 const $=id=>document.getElementById(id);
 const say=text=>{$('account-status').textContent=text;};
 const mode=cfg.mode==='live'?'':'Teste: nenhum pagamento real deve ser feito. ';
 const STORAGE_KEY='pirilume.session';
 function saveSession(data){try{if(data?.access_token&&data?.refresh_token){localStorage.setItem(STORAGE_KEY,JSON.stringify({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+((data.expires_in||3600)*1000),user:{id:data.user?.id,email:data.user?.email}}));}else{localStorage.removeItem(STORAGE_KEY);}}catch{}}
 function loadStoredSession(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):null;}catch{return null;}}
 function clearStoredSession(){try{localStorage.removeItem(STORAGE_KEY);}catch{}}
 async function auth(path,body,token) {
   const response=await fetch(cfg.supabaseUrl+'/auth/v1/'+path,{method:'POST',headers:{apikey:cfg.anonKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
   const data=await response.json();
   if(!response.ok) throw Error(path.startsWith('token')?'Não foi possível entrar. Confira seus dados ou recupere a senha.':'Não foi possível concluir. Confira os dados e tente novamente.');
   return data;
 }
 function setSession(data) {
   session=data?.access_token?data:null; clearTimeout(refreshTimer);
   // Only tokens (no password) are persisted, so a return from checkout keeps the session across reloads.
   if(session) saveSession(session); else clearStoredSession();
   if(session?.refresh_token) refreshTimer=setTimeout(async()=>{try{setSession(await auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token}));}catch{logout();}},Math.max(30000,((session.expires_in||3600)-60)*1000));
   $('account-form').hidden=Boolean(session); $('account-signed').hidden=!session;
   $('account-email').textContent=session?.user?.email||'';
 }
 async function api(path,method='GET') {
   if(!session) throw Error('Entre na sua conta para continuar.');
   const response=await fetch(cfg.supabaseUrl+'/functions/v1/pirilume-api'+path,{method,headers:{Authorization:'Bearer '+session.access_token,apikey:cfg.anonKey}});
   const data=await response.json(); if(!response.ok) throw Error(data.error||'Não foi possível acessar a biblioteca.'); return data;
 }
 function setReaderMode(unlocked) {
   document.body.classList.toggle('modo-leitor',unlocked);
   if(unlocked && !readerScrolled) {readerScrolled=true; section.scrollIntoView({block:'start',behavior:'smooth'});}
 }
 // Mesmo fluxo usado pelo botão do livro no painel #biblioteca; exposto para o botão "Abrir este livro"
 // dos cards da coleção (#colecao), que em modo leitor precisa buscar e abrir do mesmo jeito.
 function openBook(book) {
   return run(async()=>{const full=await api('/book/'+book.id); Object.assign(book,full); let option=[...$('book-picker').options].find(o=>o.value===book.id); if(!option){option=document.createElement('option');option.value=book.id;option.textContent=book.title;$('book-picker').append(option);} location.hash='#livro/'+book.id;});
 }
 window.PIRILUME_OPEN_BOOK=openBook;
 async function library() {
   const data=await api('/library'); $('owned-books').replaceChildren();
   $('account-buy').hidden=data.unlocked;
   setReaderMode(data.unlocked);
   const mp={test_user:'Mercado Pago: vendedor de teste OK. ',production:'Mercado Pago: token de CONTA REAL. Compra de teste bloqueada até trocar pelo vendedor de teste. ',test_credentials:'Mercado Pago: credenciais TEST- (sandbox, sem webhook automático). ',invalid:'Mercado Pago: token não reconhecido. ',unknown:'Mercado Pago: não foi possível verificar o token. ',missing:'Mercado Pago: token ausente. '}[data.mpAccount]||'';
   say(data.unlocked?'Sua coleção está liberada. Escolha uma história.':mode+mp+'Sua coleção ainda não foi liberada. Se acabou de pagar, aguarde a confirmação e verifique novamente.');
   if(data.unlocked) for(const book of window.PIRILUME_BOOKS.filter(b=>!b.free)) {
     const button=document.createElement('button'); button.className='button secondary'; button.textContent=book.title;
     button.onclick=()=>openBook(book);
     $('owned-books').append(button);
   }
   clearTimeout(pollTimer);
   if(!data.unlocked && new URLSearchParams(location.search).has('compra')) pollTimer=setTimeout(()=>run(library),10000);
   return data.unlocked;
 }
 async function run(fn) {if(pending)return;pending=true;section.setAttribute('aria-busy','true');try{await fn();}catch(e){say(e.message);}finally{pending=false;section.removeAttribute('aria-busy');}}
 async function buy() {if(!session){location.hash='#biblioteca';say('Entre ou crie sua conta para continuar.');$('account-form').elements.email.focus();return;} await run(async()=>{say(mode+'Preparando pagamento…');const result=await api('/checkout','POST');if(result.alreadyOwned){await library();return;}const url=new URL(result.checkoutUrl);if(url.protocol!=='https:'||!['www.mercadopago.com.br','sandbox.mercadopago.com.br'].includes(url.hostname))throw Error('Endereço de pagamento inválido.');location.assign(url.href);});}
 function logout(){clearTimeout(refreshTimer);clearTimeout(pollTimer);setSession(null);document.body.classList.remove('modo-leitor');$('owned-books').replaceChildren();for(const b of window.PIRILUME_BOOKS.filter(b=>!b.free)){delete b.chapters;delete b.cover;}[...$('book-picker').options].filter(o=>o.value!=='luzes').forEach(o=>o.remove());location.hash='#biblioteca';say('Você saiu da sua conta.');}
 async function restoreSession(){const stored=loadStoredSession();if(!stored?.refresh_token)return;document.body.classList.add('modo-leitor');try{setSession(await auth('token?grant_type=refresh_token',{refresh_token:stored.refresh_token}));await library();}catch{setSession(null);document.body.classList.remove('modo-leitor');say('Sua sessão expirou. Entre novamente.');}}
 $('account-form').onsubmit=e=>{e.preventDefault();run(async()=>{const form=e.currentTarget;const body={email:form.elements.email.value.trim(),password:form.elements.password.value};say('Aguarde…');const signup=e.submitter?.value==='signup';const result=await auth(signup?'signup':'token?grant_type=password',body);form.elements.password.value='';if(!result.access_token){say('Confira seu e-mail para confirmar a conta. Depois, volte aqui para entrar.');return;}setSession(result);await library();});};
 $('recover-account').onclick=()=>run(async()=>{const email=$('account-form').elements.email.value.trim();if(!email)throw Error('Preencha seu e-mail para recuperar a senha.');await auth('recover?redirect_to='+encodeURIComponent(location.origin+location.pathname+'#biblioteca'),{email});say('Se houver uma conta, você receberá as instruções por e-mail.');});
 $('account-refresh').onclick=()=>run(async()=>{say(mode+'Verificando com o Mercado Pago…');await library();}); $('account-buy').onclick=buy;
 $('account-logout').onclick=()=>run(async()=>{try{await auth('logout',{},session?.access_token);}finally{logout();}});
 window.PIRILUME_BUY=buy;
 function wirePurchaseButton(id){const button=$(id);if(!button)return;button.disabled=!configured;button.textContent=cfg.mode==='live'?'Comprar as 5 histórias por R$ 19,90':'Experimentar compra de teste';button.onclick=buy;}
 ['buy-collection','buy-collection-hero'].forEach(wirePurchaseButton);
 if(!configured){section.querySelectorAll('button,input').forEach(el=>el.disabled=true);say('Estamos preparando o acesso à coleção. A história gratuita já está disponível.');}
 else say(mode+'Entre para acessar sua biblioteca.');
 if(location.hash==='#biblioteca') section.scrollIntoView({block:'start'});
 window.addEventListener('hashchange',()=>{if(location.hash==='#biblioteca')section.scrollIntoView({block:'start'});});
 // Email confirmation/recovery flow; remove tokens from browser URL immediately.
 const hash=new URLSearchParams(location.hash.slice(1));
 if(configured && hash.has('access_token')) {
   const access=hash.get('access_token'), refresh=hash.get('refresh_token'), recovery=hash.get('type')==='recovery';
   history.replaceState(null,'',location.pathname+'#biblioteca');
   run(async()=>{const response=await fetch(cfg.supabaseUrl+'/auth/v1/user',{headers:{apikey:cfg.anonKey,Authorization:'Bearer '+access}});if(!response.ok)throw Error('Este link expirou. Solicite um novo.');setSession({access_token:access,refresh_token:refresh,expires_in:Number(hash.get('expires_in'))||3600,user:await response.json()});if(recovery){const form=document.createElement('form');form.innerHTML='<label>Nova senha<input type="password" name="password" minlength="8" required autocomplete="new-password"></label><button class="button primary">Salvar nova senha</button>';section.append(form);form.onsubmit=e=>{e.preventDefault();run(async()=>{const r=await fetch(cfg.supabaseUrl+'/auth/v1/user',{method:'PUT',headers:{apikey:cfg.anonKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({password:form.elements.password.value})});if(!r.ok)throw Error('Não foi possível atualizar a senha.');form.remove();await library();});};say('Escolha sua nova senha.');}else await library();});
 } else if(configured) { restoreSession(); }
})();
