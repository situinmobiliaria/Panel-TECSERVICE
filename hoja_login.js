// ═══════════════════════════════════════════════════════════════
// hoja_login.js — Autenticación OTP + init gráficos facturación
// Depende de: emailjs (CDN), hoja_facturacion.js (renderFcGraficos)
// ═══════════════════════════════════════════════════════════════

// Renderizar gráficos de facturación al cargar (vista puede estar oculta)
setTimeout(()=>{try{renderFcGraficos();}catch(e){console.warn(e);}},200);

// ─── AUTH OTP ─────────────────────────────────────────────────
emailjs.init('mUdCW_6gSRGS0A6fN');
const EJS_SVC='service_35l3vus',EJS_TPL='template_ut5xtwb';
const ALLOWED=new Set([
  'marcelo.ruminot@gemco.cl','alexis.flores@tecservice.cl',
  'marcelo.ruminot@tecservice.cl','alexis.flores@gemco.cl',
  'cristian.valenzuela@aspencapital.cl','ignacio.cargioli@aspencapital.cl',
  'cristobal.munoz@aspencapital.cl','rafael.vergara@gemco.cl',
  'rafael.vergara@aspencapital.cl',
  'cristian.valenzuela@situ.cl'
]);
let _otp=null,_otpEmail=null,_otpExpiry=null,_otpTimer=null;

function checkAuth(){
  const u=localStorage.getItem('cvg_user');
  if(u&&ALLOWED.has(u))document.getElementById('login-screen').style.display='none';
}

async function sendOtp(){
  const em=(document.getElementById('lg-email').value||'').trim().toLowerCase();
  const errEl=document.getElementById('lg-err');
  if(!em){errEl.textContent='Ingresa tu correo.';return;}
  if(!ALLOWED.has(em)){errEl.textContent='Correo no autorizado. Contacta al administrador.';return;}
  const btn=document.getElementById('lg-send-btn');
  btn.disabled=true;btn.textContent='Enviando...';errEl.textContent='';
  _otp=String(Math.floor(100000+Math.random()*900000));
  _otpEmail=em;_otpExpiry=Date.now()+10*60*1000;
  try{
    await emailjs.send(EJS_SVC,EJS_TPL,{to_email:em,otp:_otp});
    document.getElementById('lg-step1').style.display='none';
    document.getElementById('lg-step2').style.display='block';
    document.getElementById('lg-email-shown').textContent=em;
    document.getElementById('lg-otp').focus();
    startOtpTimer();
  }catch(e){
    console.error('EmailJS error:', e);
    const detail = e && (e.text || e.message || JSON.stringify(e));
    errEl.textContent='Error al enviar el correo: ' + (detail || 'revisa la consola del navegador (F12).');
    btn.disabled=false;btn.textContent='Enviar código';_otp=null;
  }
}

function verifyOtp(){
  const entered=(document.getElementById('lg-otp').value||'').trim();
  const errEl=document.getElementById('lg-err2');
  if(!entered){errEl.textContent='Ingresa el código.';return;}
  if(Date.now()>_otpExpiry){errEl.textContent='El código expiró. Solicita uno nuevo.';_otp=null;return;}
  if(entered!==_otp){errEl.textContent='Código incorrecto. Intenta nuevamente.';return;}
  _otp=null;clearInterval(_otpTimer);
  localStorage.setItem('cvg_user',_otpEmail);
  document.getElementById('login-screen').style.display='none';
}

function backToEmail(){
  _otp=null;clearInterval(_otpTimer);
  document.getElementById('lg-step2').style.display='none';
  document.getElementById('lg-step1').style.display='block';
  const btn=document.getElementById('lg-send-btn');
  btn.disabled=false;btn.textContent='Enviar código';
  document.getElementById('lg-err2').textContent='';
  document.getElementById('lg-otp').value='';
}

function startOtpTimer(){
  const el=document.getElementById('lg-timer');
  _otpTimer=setInterval(()=>{
    const rem=Math.max(0,_otpExpiry-Date.now());
    const m=Math.floor(rem/60000),s=Math.floor((rem%60000)/1000);
    el.textContent='Código válido por '+m+':'+(s<10?'0':'')+s;
    if(rem===0){clearInterval(_otpTimer);el.textContent='Código expirado.';}
  },1000);
}

function doLogout(){
  localStorage.removeItem('cvg_user');
  _otp=null;clearInterval(_otpTimer);
  document.getElementById('lg-step1').style.display='block';
  document.getElementById('lg-step2').style.display='none';
  document.getElementById('lg-send-btn').disabled=false;
  document.getElementById('lg-send-btn').textContent='Enviar código';
  document.getElementById('lg-err').textContent='';
  document.getElementById('lg-otp').value='';
  document.getElementById('login-screen').style.display='flex';
}

checkAuth();
