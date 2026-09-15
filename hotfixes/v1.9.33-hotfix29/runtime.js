/* ESTUDEX_V193_HOTFIX29_ROOM_SOCIAL_RUNTIME */
(() => {
  'use strict';
  const root=globalThis;
  const E=root.EstudexEngine;
  if(!E?.room||!E?.social)return;
  const q=(s,r=document)=>r?.querySelector?.(s)||null;
  const clean=v=>String(v??'').trim();
  const friendIds=new Set(),pendingIds=new Set();
  let refreshTicket=0;

  function installStyle(){
    if(q('#estudexHotfix29RoomSocialStyle'))return;
    const style=document.createElement('style');
    style.id='estudexHotfix29RoomSocialStyle';
    style.textContent=`
      .room-participant-icons .v193-hf29-add-friend{margin-left:auto;min-height:26px;padding:0 8px;border:1px solid color-mix(in srgb,var(--theme-color,#2563EB) 48%,rgba(255,255,255,.15));border-radius:8px;background:color-mix(in srgb,var(--theme-color,#2563EB) 15%,#071426);color:#eaf2ff;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
      .room-participant-icons .v193-hf29-add-friend:hover{background:color-mix(in srgb,var(--theme-color,#2563EB) 28%,#071426)}
      .room-participant-icons .v193-hf29-add-friend:disabled{opacity:.58;cursor:default}
    `;
    document.head.appendChild(style);
  }

  function currentUserId(){
    return clean(root.EstudexCloudSocial?.getUser?.()?.id);
  }

  function memberByClientId(clientId){
    const state=E.room.getState?.()||{};
    return (state.members||[]).find(item=>clean(item?.clientId||item?.id)===clean(clientId))||null;
  }

  async function refreshRelations(){
    const ticket=++refreshTicket;
    const [friends,pending]=await Promise.all([
      Promise.resolve(E.social.listFriends?.()).catch(()=>[]),
      Promise.resolve(E.social.listPending?.()).catch(()=>[])
    ]);
    if(ticket!==refreshTicket)return;
    friendIds.clear();pendingIds.clear();
    for(const item of friends||[]){const id=clean(item?.id||item?.userId);if(id)friendIds.add(id);}
    for(const item of pending||[]){
      const id=clean(item?.user?.id || (item?.pendingDirection==='outgoing'?item?.receiverId:item?.senderId) || item?.userId || item?.id);
      if(id)pendingIds.add(id);
    }
    decorate();
  }

  function decorate(){
    installStyle();
    const self=currentUserId();
    document.querySelectorAll?.('#roomParticipantsStrip [data-room-member-id]')?.forEach(card=>{
      const clientId=clean(card.dataset?.roomMemberId);
      const member=memberByClientId(clientId);
      const userId=clean(member?.userId||member?.socialId||member?.profile?.id);
      const row=q('.room-participant-icons',card);
      let button=q('.v193-hf29-add-friend',card);
      if(!row||!userId||userId===self){button?.remove();return;}
      if(!button){
        button=document.createElement('button');
        button.type='button';
        button.className='v193-hf29-add-friend';
        button.addEventListener('click',async event=>{
          event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
          const target=clean(button.dataset.userId);if(!target||button.disabled)return;
          button.disabled=true;button.textContent='Enviando...';
          try{
            await E.social.sendFriendRequest(target);
            pendingIds.add(target);
            button.textContent='Pedido enviado';
            try{showToast?.('Pedido de amizade enviado.');}catch{}
          }catch(error){
            button.disabled=false;button.textContent='Adicionar amigo';
            try{showToast?.(error?.message||'Não foi possível enviar o pedido de amizade.');}catch{}
          }
        },true);
        row.appendChild(button);
      }
      button.dataset.userId=userId;
      if(friendIds.has(userId)){button.disabled=true;button.textContent='Amigo';}
      else if(pendingIds.has(userId)){button.disabled=true;button.textContent='Pedido enviado';}
      else{button.disabled=false;button.textContent='Adicionar amigo';}
    });
  }

  let queued=false;
  const queueDecorate=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});};
  const roomOff=E.room.onChange?.(event=>{
    const type=clean(event?.type);
    if(['joined','reconnected','member-joined','member-left','member-identity','profile-update','media-status','stream-status'].includes(type))queueDecorate();
  });
  const socialOff=E.social.onChange?.(()=>refreshRelations().catch(()=>{}));
  const strip=q('#roomParticipantsStrip');
  const observer=strip&&typeof MutationObserver==='function'?new MutationObserver(queueDecorate):null;
  observer?.observe(strip,{childList:true,subtree:true});
  installStyle();
  refreshRelations().catch(()=>decorate());
  queueDecorate();
  root.EstudexV193Hotfix29RoomSocial=Object.freeze({version:'1.0.0',refresh:refreshRelations,destroy(){try{roomOff?.();}catch{}try{socialOff?.();}catch{}try{observer?.disconnect?.();}catch{}}});
})();
