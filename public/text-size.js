(() => {
  const key='okusuri-text-size';
  const allowed=['small','medium','large'];
  let selected='medium';
  try { const saved=localStorage.getItem(key); if(allowed.includes(saved))selected=saved; } catch {}
  document.documentElement.dataset.textSize=selected;
  function bind(){
    const buttons=[...document.querySelectorAll('[data-text-size-choice]')];
    function apply(size,announce=false){
      selected=size;document.documentElement.dataset.textSize=size;
      buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.textSizeChoice===size)));
      if(announce){try{localStorage.setItem(key,size);}catch{}const status=document.querySelector('#text-size-status');if(status)status.textContent=`文字サイズを${{small:'小',medium:'中',large:'大'}[size]}にしました。`;}
    }
    buttons.forEach(button=>button.addEventListener('click',()=>apply(button.dataset.textSizeChoice,true)));
    apply(selected);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
