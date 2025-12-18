// NOTY Landing • script.js
(function(){
  // Mobile menu
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  if(toggle && nav){
    toggle.addEventListener('click', ()=>{
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e)=>{
      const id = a.getAttribute('href');
      if(id && id.length > 1){
        const el = document.querySelector(id);
        if(el){
          e.preventDefault();
          el.scrollIntoView({behavior:'smooth', block:'start'});
        }
      }
    });
  });

  // Fake form submission feedback
  const formBtn = document.getElementById('btn-demo');
  const feedback = document.getElementById('form-feedback');
  if(formBtn && feedback){
    formBtn.addEventListener('click', ()=>{
      feedback.textContent = 'Obrigado! Entraremos em contato em breve.';
      feedback.style.color = '#b6f7c8';
    });
  }
})();
