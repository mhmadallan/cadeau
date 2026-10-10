window.CatalogEditor = {
  init() {
    const form=document.getElementById('productForm'), block=document.createElement('div'); block.className='md:col-span-2';
    block.innerHTML='<label class="flex flex-col gap-1">Collection / category<input id="collection" class="rounded-lg border border-slate-300 px-3 py-2" maxlength="100"></label><div class="my-4 flex gap-4"><label><input id="visible" type="checkbox" checked> Visible</label><label><input id="featured" type="checkbox"> Featured</label><label><input id="new_arrival" type="checkbox"> New arrival</label></div><h3>Size & colour variants</h3><p class="text-sm my-2">Each row is one colour and size combination with its own stock. When variants exist, they replace global stock.</p><div id="variantRows"></div><button id="addVariant" type="button" class="my-3 rounded-lg border px-4 py-2">+ Add variant</button>';
    form.insertBefore(block,form.lastElementChild);
    document.getElementById('addVariant').onclick=()=>this.row({id:crypto.randomUUID(),color:'',size:'',stock:0});
  },
  row(v) {
    const row=document.createElement('div'); row.className='flex flex-wrap gap-2 my-2'; row.dataset.id=v.id;
    for(const field of ['color','size','stock']) { const input=document.createElement('input'); input.dataset.field=field; input.placeholder=field; input.setAttribute('aria-label',field); input.className='border rounded px-3 py-2'; input.style.width=field==='stock'?'90px':'130px'; input.value=v[field]; input.required=true; if(field==='stock'){input.type='number';input.min=0;input.step=1;} row.append(input); }
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>row.remove();row.append(remove);document.getElementById('variantRows').append(row);
  },
  read() {
    return {collection:document.getElementById('collection').value.trim(),images:document.getElementById('image_urls').value.split('\n').map(s=>s.trim()).filter(Boolean),visible:document.getElementById('visible').checked,featured:document.getElementById('featured').checked,new_arrival:document.getElementById('new_arrival').checked,variants:[...document.getElementById('variantRows').children].map(row=>({id:row.dataset.id,...Object.fromEntries([...row.querySelectorAll('input')].map(i=>[i.dataset.field,i.dataset.field==='stock'?Number(i.value):i.value.trim()]))}))};
  },
  load(p) { document.getElementById('collection').value=p.collection||'';document.getElementById('image_urls').value=(p.image_urls?.length ? p.image_urls : (p.images||[])).join('\n');for(const field of ['visible','featured','new_arrival'])document.getElementById(field).checked=field==='visible'?p[field]!==false:!!p[field];document.getElementById('variantRows').replaceChildren();(p.variants||[]).forEach(v=>this.row(v)); },
  reset(){this.load({});}
};
window.CatalogEditor.init();
