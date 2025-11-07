(function(){
  const inputs=Array.from(document.querySelectorAll('.otp-input'));
  const submitBtn=document.getElementById('submitBtn');
  const clearBtn=document.getElementById('clearBtn');
  const status=document.getElementById('status');
  const resendBtn=document.getElementById('resendBtn');
  const timerEl=document.getElementById('timer');

  inputs[0].focus();
  function showStatus(text,type){
    status.textContent=text; status.className='message';
    if(type==='ok') status.classList.add('ok');
    if(type==='err') status.classList.add('err');
  }

  inputs.forEach((input,idx)=>{
    input.addEventListener('input',e=>{
      const v=e.target.value.replace(/\D/g,''); e.target.value=v;
      if(v && idx<inputs.length-1){inputs[idx+1].focus();inputs[idx+1].select();}
    });
    input.addEventListener('keydown',e=>{
      if(e.key==='Backspace'&&!e.target.value&&idx>0){inputs[idx-1].focus();inputs[idx-1].value='';e.preventDefault();}
      if(e.key==='ArrowLeft'&&idx>0){inputs[idx-1].focus();e.preventDefault();}
      if(e.key==='ArrowRight'&&idx<inputs.length-1){inputs[idx+1].focus();e.preventDefault();}
      if(e.key.length===1&&!/\d/.test(e.key)&&e.key!==' '){e.preventDefault();}
      if(e.key==='Enter'){submitCode();}
    });
    input.addEventListener('paste',e=>{
      e.preventDefault();
      const paste=(e.clipboardData||window.clipboardData).getData('text')||'';
      const digits=paste.replace(/\D/g,'').slice(0,inputs.length).split('');
      digits.forEach((d,i)=>{inputs[i].value=d;});
      inputs[Math.min(digits.length,inputs.length-1)].focus();
    });
  });

  function readCode(){return inputs.map(i=>i.value).join('');}
  function submitCode(){
    const code=readCode();
    if(code.length!==inputs.length){showStatus('Enter full 6-digit code','err'); shakeInputs(); return;}
    showStatus('Verifying…',''); submitBtn.disabled=true;
    setTimeout(()=>{
      submitBtn.disabled=false;
      if(code==='123456'){showStatus('Verified — redirecting…','ok');}
      else{showStatus('Invalid code. Try again','err'); shakeInputs();}
    },700);
  }
  function shakeInputs(){inputs.forEach(i=>{i.classList.remove('shake'); void i.offsetWidth; i.classList.add('shake');});}

  submitBtn.addEventListener('click',submitCode);
  clearBtn.addEventListener('click',()=>{inputs.forEach(i=>i.value='');inputs[0].focus();status.textContent='';});

  let cooldown=30; let timer=null;
  function startTimer(){
    resendBtn.disabled=true; timerEl.textContent=`(${cooldown}s)`;
    timer=setInterval(()=>{
      cooldown-=1; timerEl.textContent=`(${cooldown}s)`;
      if(cooldown<=0){clearInterval(timer);resendBtn.disabled=false;timerEl.textContent='';cooldown=30;}
    },1000);
  }
  resendBtn.addEventListener('click',()=>{showStatus('Code resent. Check your messages.',''); startTimer();});
  startTimer();
})();