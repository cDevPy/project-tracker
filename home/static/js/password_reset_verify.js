(function(){
  const inputs = Array.from(document.querySelectorAll('.otp-input'));
  const resendBtn = document.getElementById('resendBtn');
  const timerEl = document.getElementById('timer');
  const status = document.getElementById('status');

  // Focus first input on load
  inputs[0].focus();

  // Move between inputs
  inputs.forEach((input, idx) => {
    input.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g,''); // only digits
      if(e.target.value && idx < inputs.length-1){
        inputs[idx+1].focus();
        inputs[idx+1].select();
      }
    });

    input.addEventListener('keydown', e => {
      if(e.key === 'Backspace' && !input.value && idx > 0){
        inputs[idx-1].focus();
        inputs[idx-1].value = '';
      }
      if(e.key === 'ArrowLeft' && idx > 0){ inputs[idx-1].focus(); }
      if(e.key === 'ArrowRight' && idx < inputs.length-1){ inputs[idx+1].focus(); }
    });

    input.addEventListener('paste', e => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
      const digits = paste.replace(/\D/g,'').slice(0,inputs.length).split('');
      digits.forEach((d,i)=>inputs[i].value=d);
      inputs[Math.min(digits.length, inputs.length-1)].focus();
    });
  });

  // Show status messages
  function showStatus(msg, type){
    status.textContent = msg;
    status.className = 'message';
    if(type==='ok') status.classList.add('ok');
    if(type==='err') status.classList.add('err');
  }

  // Clear button
  const clearBtn = document.getElementById('clearBtn');
  clearBtn.addEventListener('click', ()=> {
    inputs.forEach(i=>i.value='');
    inputs[0].focus();
    status.textContent = '';
  });

  // Resend button + timer
  let cooldown = 30; let timer = null;
  function startTimer(){
    resendBtn.disabled = true;
    timerEl.textContent = `(${cooldown}s)`;
    timer = setInterval(()=>{
      cooldown -= 1;
      timerEl.textContent = `(${cooldown}s)`;
      if(cooldown <= 0){ clearInterval(timer); resendBtn.disabled = false; timerEl.textContent=''; cooldown=30; }
    },1000);
  }
  resendBtn.addEventListener('click', ()=>{
    showStatus('Code resent. Check your email.', '');
    startTimer();
  });
  startTimer();
})();
