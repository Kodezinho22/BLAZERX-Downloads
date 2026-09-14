const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const socket = io();

let currentUser = null;
let currentRoom = null;
let toastTimer;
let currentWallpaperURL = null;
let currentProfileAvatarURL = null;
let currentProfileBannerURL = null;
let lastRealtimeState = null;

const DEFAULT_PROFILE_STATUS = "available";

const profileState = {
  about: "",
  status: DEFAULT_PROFILE_STATUS,
  avatarDataUrl: null,
  connectedAt: null,
  createdRooms: 0
};

const DEFAULT_THEME = "#8F18D8";

const appearanceState = {
  themeColor: DEFAULT_THEME,
  lobbyOnly: true,
  hsv: {
    h: 278,
    s: 89,
    v: 85
  }
};

/* =========================================================
   UTIL
========================================================= */

const escapeHTML = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function initials(name) {
  const parts = String(name || "U")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function showToast(message) {
  const toast = $("#toast");

  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");

  toastTimer = setTimeout(
    () => toast.classList.remove("show"),
    2600
  );
}

function peopleIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="2.5"></circle>
      <circle cx="16" cy="9" r="2"></circle>
      <path d="M4 19c.4-3.5 2-5 5-5s4.6 1.5 5 5"></path>
      <path d="M14 15c2.6 0 4.4 1.4 5 4"></path>
    </svg>
  `;
}

function clockIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8"></circle>
      <path d="M12 8v5l3 2"></path>
    </svg>
  `;
}

function showEmpty(container, title, text) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">•</div>
      <strong>${escapeHTML(title)}</strong>
      <span>${escapeHTML(text)}</span>
    </div>
  `;
}

/* =========================================================
   NAVEGAÇÃO
========================================================= */

function showPage(page) {
  if (!["home", "rooms", "friends", "inbox", "room", "profile", "appearance"].includes(page)) {
    showToast("Esta tela ainda não foi adicionada nesta versão de teste.");
    return;
  }

  document.body.dataset.currentPage = page;

  $$(".page-view").forEach(view => {
    view.classList.remove("active");
  });

  const viewMap = {
    home: "#homeView",
    rooms: "#roomsView",
    friends: "#friendsView",
    inbox: "#inboxView",
    room: "#roomView",
    profile: "#profileView",
    appearance: "#appearanceView"
  };

  $(viewMap[page]).classList.add("active");

  $$(".menu-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.page === page
    );
  });

  if (page === "appearance") {
    requestAnimationFrame(() => {
      updatePickerHandles();
      setTimeout(updatePickerHandles, 40);
    });
  }

  if (page === "profile") {
    updateProfilePage();
  }

  if (page === "rooms") {
    renderRoomsPage();
  }

  if (page === "friends") {
    renderFriendsPage();
  }

  if (page === "inbox") {
    renderInboxPage();
  }

  if (page === "room") {
    renderTransmissionRoom();
  }
}

$$(".menu-item").forEach(item => {
  item.addEventListener("click", () => {
    showPage(item.dataset.page);
  });
});

$("#sidebarProfileButton").addEventListener("click", () => {
  showPage("profile");
});

/* =========================================================
   REALTIME - PERFIL
========================================================= */

function setIdentityUI(user) {
  if (!user) return;

  currentUser = user;

  profileState.about = user.about || "";
  profileState.status = user.status || DEFAULT_PROFILE_STATUS;
  profileState.connectedAt = user.connectedAt || profileState.connectedAt;
  profileState.createdRooms = Number(user.createdRooms || 0);

  $("#profileUsername").textContent = user.username;
  $("#welcomeUsername").textContent = user.username;
  $("#profilePageUsername").textContent = user.username;

  setAvatarElement(
    $("#profileAvatar"),
    user.username,
    profileState.avatarDataUrl
  );

  setAvatarElement(
    $("#topAvatar"),
    user.username,
    profileState.avatarDataUrl
  );

  setAvatarElement(
    $("#profileLargeAvatar"),
    user.username,
    profileState.avatarDataUrl
  );

  setAvatarElement(
    $("#editAvatarPreview"),
    user.username,
    profileState.avatarDataUrl
  );

  updateOwnStatusUI(profileState.status);
  updateProfilePage();
}

function renderLiveRooms(rooms) {
  const container = $("#liveRooms");

  if (!rooms.length) {
    showEmpty(
      container,
      "Nenhuma sala ao vivo",
      "Quando alguém criar uma sala, ela aparece aqui."
    );
    return;
  }

  container.innerHTML = rooms.map(room => `
    <button
      class="live-room"
      data-room-code="${escapeHTML(room.code)}"
      title="Entrar em ${escapeHTML(room.title)}"
    >
      <div class="live-room-cover">
        <span>#${escapeHTML(room.code)}</span>
      </div>

      <div class="room-copy">
        <strong>${escapeHTML(room.title)}</strong>
        <span>${escapeHTML(room.owner)}</span>
      </div>

      <div class="live-meta">
        <span class="live-badge">AO VIVO</span>

        <span class="live-viewers">
          ${peopleIcon()}
          ${Number(room.viewers || 0)}
        </span>
      </div>
    </button>
  `).join("");

  container
    .querySelectorAll("[data-room-code]")
    .forEach(button => {
      button.addEventListener("click", () => {
        socket.emit("room:join", {
          code: button.dataset.roomCode
        });
      });
    });
}

function renderRecentRooms(rooms) {
  const container = $("#recentRooms");

  if (!rooms.length) {
    showEmpty(
      container,
      "Nenhuma sala recente",
      "As salas que você criar ou visitar aparecem aqui."
    );
    return;
  }

  container.innerHTML = rooms.map(room => `
    <button
      class="recent-room"
      data-recent-code="${escapeHTML(room.code)}"
    >
      <span class="recent-doc">
        ${clockIcon()}
      </span>

      <span class="recent-copy">
        <strong>${escapeHTML(room.title)}</strong>
        <span>
          ${escapeHTML(room.subtitle)}
          • #${escapeHTML(room.code)}
        </span>
      </span>

      <span class="recent-viewers">
        ${peopleIcon()}
        ${Number(room.viewers || 0)}
      </span>
    </button>
  `).join("");

  container
    .querySelectorAll("[data-recent-code]")
    .forEach(button => {
      button.addEventListener("click", () => {
        socket.emit("room:join", {
          code: button.dataset.recentCode
        });
      });
    });
}

function renderFriends(friends) {
  const container = $("#friends");

  if (!friends.length) {
    showEmpty(
      container,
      "Nenhum amigo online",
      "Quando outro usuário entrar, ele aparece aqui."
    );
    return;
  }

  container.innerHTML = friends.map(friend => {
    const state = friendStateClass(friend) || "available";
    const label = friendStatusLabel(friend);

    return `
      <button
        class="friend-row"
        data-friend-id="${escapeHTML(friend.id)}"
      >
        ${
          friend.avatar
            ? `<span class="friend-dynamic-avatar friend-avatar-image"><img src="${escapeHTML(friend.avatar)}" alt=""></span>`
            : `<span class="dynamic-avatar friend-dynamic-avatar">${escapeHTML(initials(friend.name))}</span>`
        }

        <span class="friend-copy">
          <strong>${escapeHTML(friend.name)}</strong>
          <span class="status-${escapeHTML(state)}">
            ${escapeHTML(label)}
          </span>
        </span>
      </button>
    `;
  }).join("");
}

function renderState(state) {
  lastRealtimeState = state;

  setIdentityUI(state.me);
  renderLiveRooms(state.liveRooms || []);
  renderRecentRooms(state.recentRooms || []);
  renderFriends(state.onlineFriends || []);

  $("#profileFriendsCount").textContent =
    String((state.onlineFriends || []).length);

  updateProfilePage();
  renderRoomsPage();
  syncFriendPresence();
  renderFriendsPage();
}

function startPresence(username) {
  const cleanName = String(username || "").trim();

  if (!cleanName) {
    showToast("Digite seu nome.");
    return;
  }

  localStorage.setItem(
    "estudex-test-username",
    cleanName
  );

  socket.emit("presence:join", {
    username: cleanName,
    about: profileState.about,
    status: profileState.status,
    avatar: profileState.avatarDataUrl
  });

  $("#identityModal").classList.add("hidden");
}

socket.on("connect", async () => {
  await initLocalProfile();

  const savedName =
    localStorage.getItem("estudex-test-username");

  if (savedName) {
    $("#identityName").value = savedName;

    socket.emit("presence:join", {
      username: savedName,
      about: profileState.about,
      status: profileState.status,
      avatar: profileState.avatarDataUrl
    });

    $("#identityModal").classList.add("hidden");
  } else {
    $("#identityModal").classList.remove("hidden");

    setTimeout(
      () => $("#identityName").focus(),
      80
    );
  }
});

socket.on("state:update", renderState);

socket.on("presence:error", data => {
  showToast(
    data?.message ||
    "Erro ao entrar."
  );

  $("#identityModal")
    .classList
    .remove("hidden");
});

socket.on("profile:error", data => {
  showToast(
    data?.message ||
    "Não foi possível atualizar o perfil."
  );
});

socket.on("profile:updated", data => {
  if (data?.username) {
    localStorage.setItem(
      "estudex-test-username",
      data.username
    );
  }

  showToast("Perfil atualizado.");
});

socket.on("room:error", data => {
  showToast(
    data?.message ||
    "Erro na sala."
  );
});

socket.on("room:joined", data => {
  if (currentRoom?.code && currentRoom.code !== data?.code) {
    resetRoomWebRTC();
  }

  currentRoom = data;
  activeRoomState = null;
  roomWebRTCState.roomCode = data?.code || null;

  $("#joinModal").classList.add("hidden");
  $("#roomNameModal").classList.add("hidden");

  $("#codeInput").value = "";
  $("#roomNameInput").value = "";

  showToast(
    data.owner
      ? `Sala criada: ${data.code}`
      : `Você entrou em ${data.title}`
  );

  showPage("room");
  socket.emit("room:request-state");
  renderTransmissionRoom();
});

socket.on("room:ended", data => {
  resetRoomWebRTC();
  currentRoom = null;
  activeRoomState = null;
  stopRoomLocalMedia();

  if (document.body.dataset.currentPage === "room") {
    showPage("rooms");
  }

  showToast(
    data?.message ||
    "A sala foi encerrada."
  );
});

socket.on("room:deleted", data => {
  if (
    currentRoom &&
    currentRoom.code === data?.code
  ) {
    currentRoom = null;
    activeRoomState = null;
    stopRoomLocalMedia();

    if (document.body.dataset.currentPage === "room") {
      showPage("rooms");
    }
  }

  showToast(
    data?.message ||
    "Sala encerrada."
  );
});

/* perfil */

$("#saveIdentity").addEventListener("click", () => {
  startPresence(
    $("#identityName").value
  );
});

$("#identityName").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    $("#saveIdentity").click();
  }
});

/* criar sala */

$("#createRoom").addEventListener("click", () => {
  $("#roomNameModal").classList.remove("hidden");

  const fallback =
    currentUser
      ? `Sala de ${currentUser.username}`
      : "";

  $("#roomNameInput").value = fallback;
  $("#roomNameInput").select();
});

$("#closeRoomName").addEventListener("click", () => {
  $("#roomNameModal").classList.add("hidden");
});

$("#confirmCreateRoom").addEventListener("click", () => {
  socket.emit("room:create", {
    title: $("#roomNameInput").value
  });
});

$("#roomNameInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    $("#confirmCreateRoom").click();
  }
});

/* entrar por código */

$("#openJoin").addEventListener("click", () => {
  $("#joinModal").classList.remove("hidden");

  setTimeout(
    () => $("#codeInput").focus(),
    60
  );
});

$("#closeJoin").addEventListener("click", () => {
  $("#joinModal").classList.add("hidden");
});

$("#joinModal").addEventListener("click", event => {
  if (event.target === $("#joinModal")) {
    $("#joinModal").classList.add("hidden");
  }
});

$("#roomNameModal").addEventListener("click", event => {
  if (event.target === $("#roomNameModal")) {
    $("#roomNameModal").classList.add("hidden");
  }
});

$("#confirmJoin").addEventListener("click", () => {
  const code =
    $("#codeInput")
      .value
      .trim()
      .toUpperCase();

  if (!code) {
    showToast("Digite o código da sala.");
    return;
  }

  socket.emit("room:join", {
    code
  });
});

$("#codeInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    $("#confirmJoin").click();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    $("#joinModal").classList.add("hidden");
    $("#roomNameModal").classList.add("hidden");
  }
});


/* =========================================================
   V7 — PÁGINA DE SALAS
========================================================= */

const roomsPageState = {
  search: "",
  sort: "recent",
  ownerFilter: "all",
  withViewers: false
};

const ROOMS_SORT_LABELS = {
  recent: "Mais recentes",
  oldest: "Mais antigas",
  viewers: "Mais espectadores",
  name: "Nome A–Z"
};

const ROOM_COVERS = [
  "/assets/rooms/math.png",
  "/assets/rooms/physics.png",
  "/assets/rooms/python.png"
];

function roomHash(value) {
  let hash = 0;

  for (const char of String(value || "")) {
    hash =
      ((hash << 5) - hash) +
      char.charCodeAt(0);

    hash |= 0;
  }

  return Math.abs(hash);
}

function roomCover(room) {
  const index =
    roomHash(room?.code || room?.title) %
    ROOM_COVERS.length;

  return ROOM_COVERS[index];
}

function roomAvatarStyle(avatar) {
  if (!avatar) return "";

  return `style="background-image:url('${escapeHTML(avatar)}')"`;
}

function bookmarkIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <path d="M6 4h12v16l-6-4-6 4V4z"></path>
    </svg>
  `;
}

function trashIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <path d="M4 7h16"></path>
      <path d="M9 7V4h6v3"></path>
      <path d="M7 7l1 13h8l1-13"></path>
      <path d="M10 11v5M14 11v5"></path>
    </svg>
  `;
}

function savedRoomsRead() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          "estudex-saved-rooms"
        ) || "[]"
      );

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function savedRoomsWrite(rooms) {
  localStorage.setItem(
    "estudex-saved-rooms",
    JSON.stringify(
      rooms.slice(0, 100)
    )
  );
}

function isRoomSaved(code) {
  return savedRoomsRead()
    .some(room => room.code === code);
}

function saveRoom(room) {
  const saved =
    savedRoomsRead()
      .filter(item => item.code !== room.code);

  saved.unshift({
    code: room.code,
    title: room.title,
    owner: room.owner,
    ownerAvatar: room.ownerAvatar || null,
    viewers: Number(room.viewers || 0),
    createdAt: room.createdAt || Date.now(),
    savedAt: Date.now()
  });

  savedRoomsWrite(saved);
}

function removeSavedRoom(code) {
  savedRoomsWrite(
    savedRoomsRead()
      .filter(room => room.code !== code)
  );
}

function toggleSavedRoom(room) {
  if (isRoomSaved(room.code)) {
    removeSavedRoom(room.code);
    showToast("Sala removida das salvas.");
  } else {
    saveRoom(room);
    showToast("Sala salva.");
  }

  renderRoomsPage();
}

function roomMatchesSearch(room) {
  const search =
    roomsPageState.search
      .trim()
      .toLocaleLowerCase("pt-BR");

  if (!search) return true;

  return [
    room.title,
    room.owner,
    room.code
  ]
    .filter(Boolean)
    .some(value =>
      String(value)
        .toLocaleLowerCase("pt-BR")
        .includes(search)
    );
}

function filterLiveRooms(rooms) {
  return rooms.filter(room => {
    if (!roomMatchesSearch(room)) {
      return false;
    }

    if (
      roomsPageState.ownerFilter === "mine" &&
      !room.isMine
    ) {
      return false;
    }

    if (
      roomsPageState.ownerFilter === "others" &&
      room.isMine
    ) {
      return false;
    }

    if (
      roomsPageState.withViewers &&
      Number(room.viewers || 0) < 1
    ) {
      return false;
    }

    return true;
  });
}

function sortRooms(rooms) {
  const copy = [...rooms];

  switch (roomsPageState.sort) {
    case "oldest":
      return copy.sort(
        (a, b) =>
          Number(a.createdAt || 0) -
          Number(b.createdAt || 0)
      );

    case "viewers":
      return copy.sort(
        (a, b) =>
          Number(b.viewers || 0) -
          Number(a.viewers || 0)
      );

    case "name":
      return copy.sort(
        (a, b) =>
          String(a.title || "")
            .localeCompare(
              String(b.title || ""),
              "pt-BR"
            )
      );

    case "recent":
    default:
      return copy.sort(
        (a, b) =>
          Number(b.createdAt || 0) -
          Number(a.createdAt || 0)
      );
  }
}

function roomsEmptyMarkup(title, text, extraClass = "") {
  return `
    <div class="rooms-page-empty ${extraClass}">
      <strong>${escapeHTML(title)}</strong>
      <span>${escapeHTML(text)}</span>
    </div>
  `;
}

function liveRoomCard(room) {
  const saved =
    isRoomSaved(room.code);

  const avatar =
    room.ownerAvatar
      ? ""
      : escapeHTML(initials(room.owner));

  return `
    <article class="rooms-page-live-card" data-room-card="${escapeHTML(room.code)}">
      <div
        class="rooms-page-cover"
        style="background-image:url('${roomCover(room)}')"
      >
        <span
          class="rooms-owner-avatar"
          ${roomAvatarStyle(room.ownerAvatar)}
        >${avatar}</span>

        <button
          class="rooms-save-button ${saved ? "saved" : ""}"
          data-save-room="${escapeHTML(room.code)}"
          type="button"
          title="${saved ? "Remover das salvas" : "Salvar sala"}"
        >
          ${bookmarkIcon()}
        </button>
      </div>

      <div class="rooms-page-card-body">
        <h3>${escapeHTML(room.title)}</h3>
        <p>${escapeHTML(room.owner)}</p>

        <div class="rooms-card-status">
          <span>
            <i class="rooms-live-dot"></i>
            AO VIVO
          </span>

          <span>
            ${peopleIcon()}
            ${Number(room.viewers || 0)}
          </span>
        </div>

        <button
          class="rooms-enter-button"
          data-enter-room="${escapeHTML(room.code)}"
          type="button"
        >
          ${room.isMine ? "Abrir sala" : "Entrar"}
        </button>
      </div>
    </article>
  `;
}

function myRoomCard(room) {
  const avatar =
    room.ownerAvatar
      ? ""
      : escapeHTML(initials(room.owner));

  return `
    <article class="my-room-card">
      <div
        class="my-room-cover"
        style="background-image:url('${roomCover(room)}')"
      >
        <span
          class="my-room-avatar"
          ${roomAvatarStyle(room.ownerAvatar)}
        >${avatar}</span>
      </div>

      <div class="my-room-copy">
        <h3>${escapeHTML(room.title)}</h3>
        <p>Você é o criador</p>

        <div class="my-room-meta">
          <span>
            <i class="rooms-live-dot"></i>
            AO VIVO
          </span>

          <span>
            ${peopleIcon()}
            ${Number(room.viewers || 0)}
          </span>
        </div>
      </div>

      <div class="my-room-actions">
        <button
          class="my-room-open"
          data-open-own-room="${escapeHTML(room.code)}"
          type="button"
        >
          Abrir sala
        </button>

        <button
          class="my-room-delete"
          data-delete-room="${escapeHTML(room.code)}"
          type="button"
          title="Encerrar sala"
        >
          ${trashIcon()}
        </button>
      </div>
    </article>
  `;
}

function savedRoomCard(savedRoom, liveRoom) {
  const room =
    liveRoom
      ? {
          ...savedRoom,
          ...liveRoom
        }
      : savedRoom;

  const avatar =
    room.ownerAvatar
      ? ""
      : escapeHTML(initials(room.owner));

  return `
    <article class="saved-room-card">
      <span
        class="saved-room-avatar"
        ${roomAvatarStyle(room.ownerAvatar)}
      >${avatar}</span>

      <span class="saved-room-copy">
        <strong>${escapeHTML(room.title || "Sala salva")}</strong>
        <span>
          ${escapeHTML(room.owner || "Usuário")}
          ${liveRoom ? " • Ao vivo" : " • Offline"}
        </span>
      </span>

      <span class="saved-room-actions">
        <button
          class="saved-room-bookmark"
          data-unsave-room="${escapeHTML(room.code)}"
          type="button"
          title="Remover das salvas"
        >
          ${bookmarkIcon()}
        </button>

        <button
          class="saved-room-enter"
          data-enter-saved-room="${escapeHTML(room.code)}"
          type="button"
        >
          ${liveRoom ? "Entrar" : "Offline"}
        </button>
      </span>
    </article>
  `;
}

function bindRoomsPageActions() {
  $$("[data-enter-room]").forEach(button => {
    button.addEventListener("click", () => {
      const code =
        button.dataset.enterRoom;

      const room =
        (lastRealtimeState?.liveRooms || [])
          .find(item => item.code === code);

      if (!room) {
        showToast("A sala não está mais ao vivo.");
        return;
      }

      if (room.isMine) {
        currentRoom = {
          code: room.code,
          title: room.title,
          owner: true
        };

        showPage("room");
        socket.emit("room:request-state");

        showToast(
          `Sua sala ${room.title} está aberta. Código: ${room.code}`
        );

        return;
      }

      socket.emit("room:join", {
        code
      });
    });
  });

  $$("[data-save-room]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();

      const code =
        button.dataset.saveRoom;

      const room =
        (lastRealtimeState?.liveRooms || [])
          .find(item => item.code === code);

      if (room) {
        toggleSavedRoom(room);
      }
    });
  });

  $$("[data-open-own-room]").forEach(button => {
    button.addEventListener("click", () => {
      const code =
        button.dataset.openOwnRoom;

      const room =
        (lastRealtimeState?.liveRooms || [])
          .find(item => item.code === code);

      if (!room) {
        showToast("A sala não está mais ao vivo.");
        return;
      }

      currentRoom = {
        code: room.code,
        title: room.title,
        owner: true
      };

      showPage("room");
      socket.emit("room:request-state");

      showToast(
        `Sala aberta. Código de convite: ${room.code}`
      );
    });
  });

  $$("[data-delete-room]").forEach(button => {
    button.addEventListener("click", () => {
      const code =
        button.dataset.deleteRoom;

      const room =
        (lastRealtimeState?.liveRooms || [])
          .find(item => item.code === code);

      if (!room) {
        showToast("A sala já foi encerrada.");
        return;
      }

      const confirmed =
        window.confirm(
          `Encerrar "${room.title}"?`
        );

      if (!confirmed) return;

      socket.emit("room:delete", {
        code
      });
    });
  });

  $$("[data-unsave-room]").forEach(button => {
    button.addEventListener("click", () => {
      removeSavedRoom(
        button.dataset.unsaveRoom
      );

      showToast("Sala removida das salvas.");
      renderRoomsPage();
    });
  });

  $$("[data-enter-saved-room]").forEach(button => {
    button.addEventListener("click", () => {
      const code =
        button.dataset.enterSavedRoom;

      const live =
        (lastRealtimeState?.liveRooms || [])
          .find(item => item.code === code);

      if (!live) {
        showToast(
          "Esta sala salva não está ao vivo agora."
        );

        return;
      }

      if (live.isMine) {
        currentRoom = {
          code: live.code,
          title: live.title,
          owner: true
        };

        showPage("room");
        socket.emit("room:request-state");

        showToast(
          `Sua sala está aberta. Código: ${live.code}`
        );

        return;
      }

      socket.emit("room:join", {
        code
      });
    });
  });
}

function renderRoomsPage() {
  const liveGrid =
    $("#roomsLiveGrid");

  const myRoomsList =
    $("#myRoomsList");

  const savedGrid =
    $("#savedRoomsGrid");

  if (
    !liveGrid ||
    !myRoomsList ||
    !savedGrid
  ) {
    return;
  }

  const allLive =
    lastRealtimeState?.liveRooms || [];

  const filteredLive =
    sortRooms(
      filterLiveRooms(allLive)
    );

  if (filteredLive.length) {
    liveGrid.innerHTML =
      filteredLive
        .map(liveRoomCard)
        .join("");
  } else {
    const text =
      roomsPageState.search
        ? "Nenhuma sala corresponde à sua busca."
        : "Quando alguém criar uma sala, ela aparecerá aqui.";

    liveGrid.innerHTML =
      roomsEmptyMarkup(
        "Nenhuma sala encontrada",
        text,
        "rooms-search-empty"
      );
  }

  const mine =
    allLive.filter(room => room.isMine);

  if (mine.length) {
    myRoomsList.innerHTML =
      mine.map(myRoomCard).join("");
  } else {
    myRoomsList.innerHTML =
      roomsEmptyMarkup(
        "Você ainda não tem uma sala ao vivo",
        "Use “Criar sala” para abrir uma nova sala."
      );
  }

  const saved =
    savedRoomsRead();

  if (saved.length) {
    savedGrid.innerHTML =
      saved.map(item => {
        const live =
          allLive.find(
            room => room.code === item.code
          );

        return savedRoomCard(
          item,
          live || null
        );
      }).join("");
  } else {
    savedGrid.innerHTML =
      roomsEmptyMarkup(
        "Nenhuma sala salva",
        "Use o marcador em uma sala ao vivo para salvá-la.",
        "rooms-search-empty"
      );
  }

  $("#roomsSortLabel").textContent =
    ROOMS_SORT_LABELS[
      roomsPageState.sort
    ] || "Mais recentes";

  $$("#roomsSortMenu [data-room-sort]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.roomSort ===
          roomsPageState.sort
      );
    });

  $("#roomsOwnerFilter").value =
    roomsPageState.ownerFilter;

  $("#roomsWithViewersFilter").checked =
    roomsPageState.withViewers;

  const activeFilters =
    Number(
      roomsPageState.ownerFilter !== "all"
    ) +
    Number(
      roomsPageState.withViewers
    );

  const count =
    $("#roomsFilterCount");

  count.textContent =
    String(activeFilters);

  count.classList.toggle(
    "hidden",
    activeFilters === 0
  );

  bindRoomsPageActions();
}

/* search */

$("#roomsSearchInput").addEventListener(
  "input",
  event => {
    roomsPageState.search =
      event.target.value || "";

    renderRoomsPage();
  }
);

/* create room */

$("#roomsCreateRoom").addEventListener(
  "click",
  () => {
    $("#roomNameModal")
      .classList
      .remove("hidden");

    const fallback =
      currentUser
        ? `Sala de ${currentUser.username}`
        : "";

    $("#roomNameInput").value =
      fallback;

    $("#roomNameInput").select();
  }
);

/* sort dropdown */

$("#roomsSortButton").addEventListener(
  "click",
  event => {
    event.stopPropagation();

    $("#roomsSortMenu")
      .classList
      .toggle("hidden");

    $("#roomsFilterMenu")
      .classList
      .add("hidden");
  }
);

$$("#roomsSortMenu [data-room-sort]")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        roomsPageState.sort =
          button.dataset.roomSort;

        $("#roomsSortMenu")
          .classList
          .add("hidden");

        renderRoomsPage();
      }
    );
  });

/* filter popover */

$("#roomsFilterButton").addEventListener(
  "click",
  event => {
    event.stopPropagation();

    $("#roomsFilterMenu")
      .classList
      .toggle("hidden");

    $("#roomsSortMenu")
      .classList
      .add("hidden");
  }
);

$("#roomsOwnerFilter").addEventListener(
  "change",
  event => {
    roomsPageState.ownerFilter =
      event.target.value;

    renderRoomsPage();
  }
);

$("#roomsWithViewersFilter").addEventListener(
  "change",
  event => {
    roomsPageState.withViewers =
      event.target.checked;

    renderRoomsPage();
  }
);

$("#clearRoomFilters").addEventListener(
  "click",
  () => {
    roomsPageState.ownerFilter = "all";
    roomsPageState.withViewers = false;

    renderRoomsPage();
  }
);

document.addEventListener(
  "click",
  event => {
    const sortWrap =
      $(".rooms-sort-wrap");

    const filterWrap =
      $(".rooms-filter-wrap");

    if (
      sortWrap &&
      !sortWrap.contains(event.target)
    ) {
      $("#roomsSortMenu")
        ?.classList
        .add("hidden");
    }

    if (
      filterWrap &&
      !filterWrap.contains(event.target)
    ) {
      $("#roomsFilterMenu")
        ?.classList
        .add("hidden");
    }
  }
);

/* "Ver todas" helpers */

$("#roomsShowAllLive").addEventListener(
  "click",
  () => {
    roomsPageState.search = "";
    roomsPageState.ownerFilter = "all";
    roomsPageState.withViewers = false;

    $("#roomsSearchInput").value = "";

    renderRoomsPage();

    $("#roomsLiveGrid")
      .scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
  }
);

$("#roomsShowAllMine").addEventListener(
  "click",
  () => {
    $("#myRoomsList")
      .scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
  }
);

$("#roomsShowAllSaved").addEventListener(
  "click",
  () => {
    $("#savedRoomsGrid")
      .scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
  }
);

/* =========================================================
   V8 — SALA DE TRANSMISSÃO
========================================================= */

let activeRoomState = null;
let roomPingTimer = null;
let roomPingValue = null;

const roomLocalState = {
  micStream: null,
  cameraStream: null,
  screenStream: null,
  micEnabled: false,
  audioEnabled: true,
  cameraEnabled: false,
  screenEnabled: false,
  voiceStream: null,
  voiceRecorder: null,
  voiceChunks: [],
  voiceStartedAt: 0,
  isRecordingVoice: false
};

/* =========================================================
   V10.7 — WEBRTC P2P DA SALA
   Socket.IO transporta apenas sinalização; vídeo/áudio seguem
   diretamente entre os participantes por RTCPeerConnection.
========================================================= */

const ROOM_RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

const roomWebRTCState = {
  peers: new Map(),
  remoteStreams: new Map(),
  selectedMemberId: null,
  suppressRemoteAutoSelect: false,
  roomCode: null
};

function isOwnRoomMemberId(memberId) {
  return Boolean(memberId && socket?.id && memberId === socket.id);
}

function getLocalPrimaryVideoTrack() {
  if (roomLocalState.screenEnabled) {
    return roomLocalState.screenStream?.getVideoTracks()?.[0] || null;
  }

  if (roomLocalState.cameraEnabled) {
    return roomLocalState.cameraStream?.getVideoTracks()?.[0] || null;
  }

  return null;
}

function getLocalPrimaryVisualStream() {
  if (roomLocalState.screenEnabled && roomLocalState.screenStream) {
    return roomLocalState.screenStream;
  }

  if (roomLocalState.cameraEnabled && roomLocalState.cameraStream) {
    return roomLocalState.cameraStream;
  }

  return null;
}

function getLocalMicTrack() {
  if (!roomLocalState.micEnabled) return null;
  return roomLocalState.micStream?.getAudioTracks()?.[0] || null;
}

function getLocalScreenAudioTrack() {
  if (!roomLocalState.screenEnabled || !roomLocalState.audioEnabled) return null;
  return roomLocalState.screenStream?.getAudioTracks()?.[0] || null;
}

async function syncRoomPeerTracks(peer) {
  if (!peer?.pc || peer.pc.signalingState === "closed") return;

  const desired = {
    primaryVideo: getLocalPrimaryVideoTrack(),
    micAudio: getLocalMicTrack(),
    screenAudio: getLocalScreenAudioTrack()
  };

  const jobs = [];

  for (const [source, sender] of Object.entries(peer.senders || {})) {
    const nextTrack = desired[source] || null;
    if (sender.track !== nextTrack) {
      jobs.push(sender.replaceTrack(nextTrack));
    }
  }

  await Promise.allSettled(jobs);
}

async function syncAllRoomPeerTracks() {
  await Promise.allSettled(
    [...roomWebRTCState.peers.values()].map(syncRoomPeerTracks)
  );
}

function emitRoomWebRTCSignal(targetId, signal) {
  if (!currentRoom?.code || !targetId || !signal) return;

  socket.emit("room:webrtc:signal", {
    targetId,
    signal
  });
}

function createRoomPeer(remoteId) {
  if (!remoteId || isOwnRoomMemberId(remoteId)) return null;

  const existing = roomWebRTCState.peers.get(remoteId);
  if (existing?.pc && existing.pc.signalingState !== "closed") {
    return existing;
  }

  const pc = new RTCPeerConnection(ROOM_RTC_CONFIG);
  const remoteStream = new MediaStream();
  const peer = {
    remoteId,
    pc,
    remoteStream,
    makingOffer: false,
    ignoreOffer: false,
    isSettingRemoteAnswerPending: false,
    polite: String(socket.id || "").localeCompare(String(remoteId)) > 0,
    senders: {}
  };

  roomWebRTCState.remoteStreams.set(remoteId, remoteStream);
  roomWebRTCState.peers.set(remoteId, peer);

  // Criamos os canais uma vez. Depois replaceTrack troca câmera/tela/mic
  // sem desmontar a conexão a cada clique do usuário.
  peer.senders.primaryVideo = pc.addTransceiver("video", { direction: "sendrecv" }).sender;
  peer.senders.micAudio = pc.addTransceiver("audio", { direction: "sendrecv" }).sender;
  peer.senders.screenAudio = pc.addTransceiver("audio", { direction: "sendrecv" }).sender;

  pc.onicecandidate = event => {
    if (event.candidate) {
      emitRoomWebRTCSignal(remoteId, {
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = event => {
    const track = event.track;
    if (!remoteStream.getTracks().some(item => item.id === track.id)) {
      remoteStream.addTrack(track);
    }

    track.onunmute = () => updateStagePreview();
    track.onended = () => updateStagePreview();
    track.onmute = () => updateStagePreview();

    updateStagePreview();
  };

  pc.onnegotiationneeded = async () => {
    try {
      peer.makingOffer = true;
      await syncRoomPeerTracks(peer);
      await pc.setLocalDescription();
      emitRoomWebRTCSignal(remoteId, {
        description: pc.localDescription
      });
    } catch (error) {
      console.warn("ESTUDEX WebRTC negotiation error", error);
    } finally {
      peer.makingOffer = false;
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      updateStagePreview();
      return;
    }

    if (pc.connectionState === "failed") {
      try { pc.restartIce(); } catch {}
    }
  };

  syncRoomPeerTracks(peer).catch(() => {});
  return peer;
}

function closeRoomPeer(remoteId) {
  const peer = roomWebRTCState.peers.get(remoteId);
  if (peer?.pc) {
    try { peer.pc.close(); } catch {}
  }

  const stream = roomWebRTCState.remoteStreams.get(remoteId);
  if (stream) {
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch {}
    }
  }

  roomWebRTCState.peers.delete(remoteId);
  roomWebRTCState.remoteStreams.delete(remoteId);

  if (roomWebRTCState.selectedMemberId === remoteId) {
    roomWebRTCState.selectedMemberId = null;
  }
}

function resetRoomWebRTC() {
  for (const remoteId of [...roomWebRTCState.peers.keys()]) {
    closeRoomPeer(remoteId);
  }

  roomWebRTCState.peers.clear();
  roomWebRTCState.remoteStreams.clear();
  roomWebRTCState.selectedMemberId = null;
  roomWebRTCState.suppressRemoteAutoSelect = false;
  roomWebRTCState.roomCode = null;
}

function reconcileRoomPeers() {
  if (!currentRoom?.code || !activeRoomState?.members || !socket?.id) return;

  if (roomWebRTCState.roomCode && roomWebRTCState.roomCode !== currentRoom.code) {
    resetRoomWebRTC();
  }

  roomWebRTCState.roomCode = currentRoom.code;

  const remoteIds = new Set(
    activeRoomState.members
      .map(member => member?.id)
      .filter(memberId => memberId && !isOwnRoomMemberId(memberId))
  );

  for (const remoteId of remoteIds) {
    createRoomPeer(remoteId);
  }

  for (const remoteId of [...roomWebRTCState.peers.keys()]) {
    if (!remoteIds.has(remoteId)) {
      closeRoomPeer(remoteId);
    }
  }

  syncAllRoomPeerTracks().catch(() => {});
}

function findRoomMember(memberId) {
  return (activeRoomState?.members || []).find(member => member.id === memberId) || null;
}

function memberHasVisualMedia(member) {
  if (!member) return false;
  if (isOwnRoomMemberId(member.id)) {
    return Boolean(getLocalPrimaryVisualStream());
  }
  return Boolean(member.media?.screen || member.media?.camera);
}

function resolveStageMemberId() {
  const members = activeRoomState?.members || [];
  const selected = findRoomMember(roomWebRTCState.selectedMemberId);

  if (selected && memberHasVisualMedia(selected)) {
    return selected.id;
  }

  const ownMember = members.find(member => isOwnRoomMemberId(member.id));
  if (ownMember && memberHasVisualMedia(ownMember)) {
    roomWebRTCState.selectedMemberId = ownMember.id;
    return ownMember.id;
  }

  // Depois que o usuário escolhe sair da tela de um amigo, não forçamos
  // a mesma transmissão de volta automaticamente. Ele continua na sala e
  // pode clicar novamente no card do participante quando quiser assistir.
  if (roomWebRTCState.suppressRemoteAutoSelect) {
    return null;
  }

  const remoteBroadcaster = members.find(member =>
    !isOwnRoomMemberId(member.id) && memberHasVisualMedia(member)
  );

  roomWebRTCState.selectedMemberId = remoteBroadcaster?.id || null;
  return roomWebRTCState.selectedMemberId;
}

function selectRoomStageMember(memberId, options = {}) {
  const member = findRoomMember(memberId);
  if (!member) return;

  if (!memberHasVisualMedia(member)) {
    if (!options.silent) {
      showToast(`${member.name} não está compartilhando tela ou câmera.`);
    }
    return;
  }

  roomWebRTCState.selectedMemberId = member.id;
  roomWebRTCState.suppressRemoteAutoSelect = false;
  updateStagePreview();
  renderRoomParticipantSelection();

  if (!options.silent && !isOwnRoomMemberId(member.id)) {
    showToast(`Assistindo à transmissão de ${member.name}.`);
  }
}

function exitRemoteStageView() {
  const selectedId = roomWebRTCState.selectedMemberId;

  // O botão só deve atuar quando estivermos assistindo outra pessoa.
  if (!selectedId || isOwnRoomMemberId(selectedId)) return;

  roomWebRTCState.selectedMemberId = null;
  roomWebRTCState.suppressRemoteAutoSelect = true;

  updateStagePreview();
  renderRoomParticipantSelection();
  showToast("Você saiu da transmissão. A sala continua aberta.");
}


function roomStageHasLiveVideo() {
  const selectedId = resolveStageMemberId();
  const stream = getCurrentPreviewStream();

  return Boolean(
    stream?.getVideoTracks()?.some(track =>
      track.readyState === "live" &&
      (isOwnRoomMemberId(selectedId) || !track.muted)
    )
  );
}

function syncRoomFullscreenButton() {
  const stage = $("#roomStageView");
  const button = $("#roomFullscreenButton");
  if (!stage || !button) return;

  const isFullscreen = document.fullscreenElement === stage;
  button.classList.toggle("is-fullscreen", isFullscreen);
  button.title = isFullscreen ? "Sair da tela cheia" : "Colocar transmissão em tela cheia";
  button.setAttribute("aria-label", button.title);
}

async function toggleRoomStageFullscreen() {
  const stage = $("#roomStageView");
  if (!stage) return;

  try {
    if (document.fullscreenElement === stage) {
      await document.exitFullscreen();
      return;
    }

    if (!roomStageHasLiveVideo()) {
      showToast("Inicie ou abra uma transmissão antes de usar a tela cheia.");
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }

    await stage.requestFullscreen();
  } catch {
    showToast("Não foi possível abrir a transmissão em tela cheia.");
  }
}

function renderRoomParticipantSelection() {
  $$("[data-room-member-id]").forEach(card => {
    const selected = card.dataset.roomMemberId === roomWebRTCState.selectedMemberId;
    card.classList.toggle("stage-selected", selected);
  });
}

async function handleRoomWebRTCSignal(fromId, signal) {
  if (!fromId || !signal || !currentRoom?.code) return;

  const peer = createRoomPeer(fromId);
  if (!peer) return;

  const { pc } = peer;

  try {
    if (signal.description) {
      const description = signal.description;
      const readyForOffer =
        !peer.makingOffer &&
        (pc.signalingState === "stable" || peer.isSettingRemoteAnswerPending);
      const offerCollision =
        description.type === "offer" && !readyForOffer;

      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) return;

      peer.isSettingRemoteAnswerPending = description.type === "answer";
      await pc.setRemoteDescription(description);
      peer.isSettingRemoteAnswerPending = false;

      if (description.type === "offer") {
        await syncRoomPeerTracks(peer);
        await pc.setLocalDescription();
        emitRoomWebRTCSignal(fromId, {
          description: pc.localDescription
        });
      }

      updateStagePreview();
      return;
    }

    if (signal.candidate) {
      try {
        await pc.addIceCandidate(signal.candidate);
      } catch (error) {
        if (!peer.ignoreOffer) throw error;
      }
    }
  } catch (error) {
    console.warn("ESTUDEX WebRTC signal error", error);
  }
}

socket.on("room:webrtc:signal", payload => {
  handleRoomWebRTCSignal(payload?.fromId, payload?.signal);
});

const ROOM_PREFS_KEY = "estudex_room_preferences_v82";
const defaultRoomPrefs = {
  quality: "1080p",
  fps: "60",
  cameraDeviceId: "default",
  micDeviceId: "default",
  speakerDeviceId: "default"
};

let roomPrefs = loadRoomPrefs();

function loadRoomPrefs() {
  try {
    const raw = localStorage.getItem(ROOM_PREFS_KEY);
    if (!raw) return { ...defaultRoomPrefs };
    return { ...defaultRoomPrefs, ...JSON.parse(raw) };
  } catch {
    return { ...defaultRoomPrefs };
  }
}

function saveRoomPrefs() {
  try {
    localStorage.setItem(ROOM_PREFS_KEY, JSON.stringify(roomPrefs));
  } catch {}
}

function getRoomQualitySize() {
  switch (roomPrefs.quality) {
    case "720p":
      return { width: 1280, height: 720 };
    case "1440p":
      return { width: 2560, height: 1440 };
    default:
      return { width: 1920, height: 1080 };
  }
}

function getRoomFpsValue() {
  return Number(roomPrefs.fps || 60) || 60;
}

function buildMicConstraints() {
  const audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };

  if (roomPrefs.micDeviceId && roomPrefs.micDeviceId !== "default") {
    audio.deviceId = { exact: roomPrefs.micDeviceId };
  }

  return audio;
}

function buildCameraConstraints() {
  const { width, height } = getRoomQualitySize();
  const video = {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: getRoomFpsValue(), max: getRoomFpsValue() }
  };

  if (roomPrefs.cameraDeviceId && roomPrefs.cameraDeviceId !== "default") {
    video.deviceId = { exact: roomPrefs.cameraDeviceId };
  }

  return video;
}

function buildScreenConstraints() {
  const { width, height } = getRoomQualitySize();
  return {
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: getRoomFpsValue(), max: getRoomFpsValue() }
  };
}

function isRoomLive() {
  const members = activeRoomState?.members || [];
  return members.some(member => member.media?.screen || member.media?.camera) || roomLocalState.screenEnabled || roomLocalState.cameraEnabled;
}

function applyRoomAudioOutput() {
  const video = $("#roomStageVideo");
  const deviceId = roomPrefs.speakerDeviceId;

  if (!video || !deviceId || deviceId === "default") return;

  if (typeof video.setSinkId === "function") {
    video.setSinkId(deviceId).catch(() => {});
  }
}

function fillDeviceSelect(select, devices, selectedId, emptyLabel) {
  if (!select) return;

  const list = devices.length ? devices : [{ deviceId: "default", label: emptyLabel }];

  select.innerHTML = list
    .map((device, index) => {
      const value = device.deviceId || "default";
      const label = escapeHTML(device.label || `${emptyLabel} ${index + 1}`);
      return `<option value="${escapeHTML(value)}">${label}</option>`;
    })
    .join("");

  select.value = list.some(device => (device.deviceId || "default") === selectedId)
    ? selectedId
    : (list[0].deviceId || "default");
}

async function populateRoomSettingsDevices() {
  const cameraSelect = $("#roomSettingsCameraSelect");
  const micSelect = $("#roomSettingsMicSelect");
  const speakerSelect = $("#roomSettingsSpeakerSelect");

  if (!cameraSelect || !navigator.mediaDevices?.enumerateDevices) return;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    fillDeviceSelect(cameraSelect, devices.filter(device => device.kind === "videoinput"), roomPrefs.cameraDeviceId, "Câmera padrão");
    fillDeviceSelect(micSelect, devices.filter(device => device.kind === "audioinput"), roomPrefs.micDeviceId, "Microfone padrão");
    fillDeviceSelect(speakerSelect, devices.filter(device => device.kind === "audiooutput"), roomPrefs.speakerDeviceId, "Saída padrão");
  } catch {
    fillDeviceSelect(cameraSelect, [], roomPrefs.cameraDeviceId, "Câmera padrão");
    fillDeviceSelect(micSelect, [], roomPrefs.micDeviceId, "Microfone padrão");
    fillDeviceSelect(speakerSelect, [], roomPrefs.speakerDeviceId, "Saída padrão");
  }
}

function syncRoomSettingsForm() {
  $("#roomSettingsQuality") && ($("#roomSettingsQuality").value = roomPrefs.quality);
  $("#roomSettingsFps") && ($("#roomSettingsFps").value = roomPrefs.fps);
  $("#roomQualityLabel") && ($("#roomQualityLabel").textContent = roomPrefs.quality);
  $("#roomFpsLabel") && ($("#roomFpsLabel").textContent = `${roomPrefs.fps} FPS`);
}

function updateRoomLiveUI() {
  const live = isRoomLive();
  const badge = $("#roomLiveBadge");
  const health = $("#roomConnectionStatus");
  const healthRow = health?.closest('.stage-health');

  if (badge) {
    badge.textContent = live ? "AO VIVO" : "INATIVO";
    badge.classList.toggle("live", live);
    badge.classList.toggle("idle", !live);
  }

  if (health) {
    health.textContent = live ? "Transmissão em andamento" : "Aguardando transmissão";
  }

  if (healthRow) {
    healthRow.classList.toggle("live", live);
  }
}

async function restartRoomDevicesIfNeeded() {
  if (roomLocalState.micEnabled) {
    stopSingleStream(roomLocalState.micStream);
    roomLocalState.micStream = null;
    await ensureMicStream();
    roomLocalState.micEnabled = true;
    roomLocalState.micStream?.getAudioTracks().forEach(track => { track.enabled = true; });
  }

  if (roomLocalState.cameraEnabled) {
    stopSingleStream(roomLocalState.cameraStream);
    roomLocalState.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: buildCameraConstraints(),
      audio: false
    });
    roomLocalState.cameraEnabled = true;
  }

  applyRoomAudioOutput();
}

async function applyRoomSettingsFromModal() {
  roomPrefs = {
    quality: $("#roomSettingsQuality")?.value || defaultRoomPrefs.quality,
    fps: $("#roomSettingsFps")?.value || defaultRoomPrefs.fps,
    cameraDeviceId: $("#roomSettingsCameraSelect")?.value || "default",
    micDeviceId: $("#roomSettingsMicSelect")?.value || "default",
    speakerDeviceId: $("#roomSettingsSpeakerSelect")?.value || "default"
  };

  saveRoomPrefs();
  syncRoomSettingsForm();
renderRoomPing();

  try {
    await restartRoomDevicesIfNeeded();
  } catch {}

  updateStagePreview();
  $("#roomSettingsModal")?.classList.add("hidden");
  showToast("Configurações da sala aplicadas.");
}


function renderRoomPing() {
  const label = $("#roomPingLabel");
  if (!label) return;

  if (typeof roomPingValue === "number" && Number.isFinite(roomPingValue)) {
    label.textContent = `${roomPingValue} ms`;
  } else {
    label.textContent = "-- ms";
  }
}

function stopRoomPingLoop() {
  if (roomPingTimer) {
    clearInterval(roomPingTimer);
    roomPingTimer = null;
  }
  roomPingValue = null;
  renderRoomPing();
}

function sampleRoomPing() {
  if (!socket || !socket.connected) {
    roomPingValue = null;
    renderRoomPing();
    return;
  }

  const startedAt = Date.now();
  try {
    socket.timeout(2500).emit("room:ping", startedAt, payload => {
      const endedAt = Date.now();
      const echoedAt = Number(payload?.startedAt || startedAt);
      const base = Number.isFinite(echoedAt) ? echoedAt : startedAt;
      roomPingValue = Math.max(1, endedAt - base);
      renderRoomPing();
    });
  } catch {
    roomPingValue = null;
    renderRoomPing();
  }
}

function startRoomPingLoop() {
  stopRoomPingLoop();
  sampleRoomPing();
  roomPingTimer = setInterval(sampleRoomPing, 5000);
}

function avatarStyle(avatar) {
  return avatar
    ? `style="background-image:url('${escapeHTML(avatar)}')"`
    : "";
}

function formatChatTime(timestamp) {
  const date = new Date(Number(timestamp || Date.now()));
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function roomMicIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="11" rx="3"></rect>
      <path d="M6 10a6 6 0 0 0 12 0"></path>
      <path d="M12 16v5"></path>
      <path d="M8 21h8"></path>
    </svg>
  `;
}

function roomAudioIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <path d="M4 14h4l5 4V6L8 10H4z"></path>
      <path d="M17 9a4 4 0 0 1 0 6"></path>
      <path d="M19 6a8 8 0 0 1 0 12"></path>
    </svg>
  `;
}

function roomCameraIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <rect x="3" y="6" width="14" height="12" rx="2"></rect>
      <path d="m17 10 4-2v8l-4-2"></path>
    </svg>
  `;
}

function roomScreenIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="12" rx="2"></rect>
      <path d="M8 20h8"></path>
      <path d="M12 16v4"></path>
    </svg>
  `;
}

function setRoomControlState(button, active) {
  if (!button) return;
  button.classList.toggle("active", Boolean(active));
}

function getCurrentPreviewStream() {
  const selectedId = resolveStageMemberId();

  if (!selectedId) return null;

  if (isOwnRoomMemberId(selectedId)) {
    return getLocalPrimaryVisualStream();
  }

  return roomWebRTCState.remoteStreams.get(selectedId) || null;
}

function stopSingleStream(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {}
  }
}

function updateStagePreview() {
  const video = $("#roomStageVideo");
  const placeholder = $("#roomStagePlaceholder");
  const placeholderTitle = $("#roomStagePlaceholderTitle");
  const placeholderText = $("#roomStagePlaceholderText");
  const selectedId = resolveStageMemberId();
  const selectedMember = findRoomMember(selectedId);
  const exitRemoteButton = $("#roomExitRemoteViewButton");
  const fullscreenButton = $("#roomFullscreenButton");
  const isWatchingRemote = Boolean(selectedId && !isOwnRoomMemberId(selectedId));
  exitRemoteButton?.classList.toggle("hidden", !isWatchingRemote);
  const stream = getCurrentPreviewStream();
  const hasLiveVideo = Boolean(
    stream?.getVideoTracks()?.some(track =>
      track.readyState === "live" &&
      (isOwnRoomMemberId(selectedId) || !track.muted)
    )
  );

  fullscreenButton?.classList.toggle("hidden", !hasLiveVideo);
  syncRoomFullscreenButton();

  if (!hasLiveVideo && document.fullscreenElement === $("#roomStageView")) {
    document.exitFullscreen().catch(() => {});
  }

  if (!video || !placeholder) return;

  if (stream && hasLiveVideo) {
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    // Nunca reproduzimos o áudio da própria captura para evitar eco.
    video.muted = isOwnRoomMemberId(selectedId) || !roomLocalState.audioEnabled;
    video.classList.remove("hidden");
    placeholder.classList.add("hidden");
    applyRoomAudioOutput();
    video.play().catch(() => {});
  } else {
    video.pause();
    video.srcObject = null;
    video.classList.add("hidden");
    placeholder.classList.remove("hidden");

    if (selectedMember && !isOwnRoomMemberId(selectedMember.id) && memberHasVisualMedia(selectedMember)) {
      if (placeholderTitle) placeholderTitle.textContent = `Conectando à tela de ${selectedMember.name}...`;
      if (placeholderText) placeholderText.textContent = "A transmissão P2P está sendo negociada. Isso normalmente leva apenas alguns instantes.";
    } else {
      if (placeholderTitle) placeholderTitle.textContent = "Compartilhe sua tela";
      if (placeholderText) placeholderText.textContent = "Ligue sua tela ou clique em um participante que esteja transmitindo para assistir.";
    }
  }

  setRoomControlState($("#roomMicButton"), roomLocalState.micEnabled);
  setRoomControlState($("#roomAudioButton"), roomLocalState.audioEnabled);
  setRoomControlState($("#roomCameraButton"), roomLocalState.cameraEnabled);
  setRoomControlState($("#roomScreenButton"), roomLocalState.screenEnabled);
  $("#roomVoiceButton")?.classList.toggle("recording", roomLocalState.isRecordingVoice);

  updateRoomSettingsSnapshot();
  syncRoomSettingsForm();
  updateRoomLiveUI();
  renderRoomParticipantSelection();
}

function emitLocalRoomMediaState() {
  if (!currentRoom) return;

  syncAllRoomPeerTracks().catch(() => {});

  socket.emit("room:media:update", {
    mic: roomLocalState.micEnabled,
    audio: roomLocalState.audioEnabled,
    camera: roomLocalState.cameraEnabled,
    screen: roomLocalState.screenEnabled
  });
}

async function ensureMicStream() {
  if (roomLocalState.micStream) {
    return roomLocalState.micStream;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: buildMicConstraints(),
    video: false
  });

  roomLocalState.micStream = stream;
  return stream;
}

async function toggleRoomMic() {
  try {
    if (!roomLocalState.micStream) {
      await ensureMicStream();
      roomLocalState.micEnabled = true;
    } else {
      roomLocalState.micEnabled = !roomLocalState.micEnabled;
    }

    roomLocalState.micStream
      ?.getAudioTracks()
      .forEach(track => {
        track.enabled = roomLocalState.micEnabled;
      });

    updateStagePreview();
    emitLocalRoomMediaState();

    showToast(
      roomLocalState.micEnabled
        ? "Microfone ativado."
        : "Microfone desativado."
    );
  } catch {
    showToast("Não foi possível acessar o microfone.");
  }
}

async function toggleRoomCamera() {
  try {
    if (!roomLocalState.cameraEnabled) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildCameraConstraints(),
        audio: false
      });

      stopSingleStream(roomLocalState.cameraStream);
      roomLocalState.cameraStream = stream;
      roomLocalState.cameraEnabled = true;
    } else {
      stopSingleStream(roomLocalState.cameraStream);
      roomLocalState.cameraStream = null;
      roomLocalState.cameraEnabled = false;
    }

    updateStagePreview();
    emitLocalRoomMediaState();

    showToast(
      roomLocalState.cameraEnabled
        ? "Câmera ligada."
        : "Câmera desligada."
    );
  } catch {
    showToast("Não foi possível acessar a câmera.");
  }
}

function handleScreenShareEnded() {
  stopSingleStream(roomLocalState.screenStream);
  roomLocalState.screenStream = null;
  roomLocalState.screenEnabled = false;
  updateStagePreview();
  emitLocalRoomMediaState();
}

async function toggleRoomScreen() {
  try {
    if (!roomLocalState.screenEnabled) {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: buildScreenConstraints(),
        audio: roomLocalState.audioEnabled
      });

      const [videoTrack] = stream.getVideoTracks();

      if (videoTrack) {
        videoTrack.onended = () => {
          handleScreenShareEnded();
        };
      }

      stopSingleStream(roomLocalState.screenStream);
      roomLocalState.screenStream = stream;
      roomLocalState.screenEnabled = true;
    } else {
      handleScreenShareEnded();
    }

    updateStagePreview();
    emitLocalRoomMediaState();

    showToast(
      roomLocalState.screenEnabled
        ? "Compartilhamento de tela iniciado."
        : "Compartilhamento de tela finalizado."
    );
  } catch {
    showToast("Não foi possível compartilhar a tela.");
  }
}

function toggleRoomAudio() {
  roomLocalState.audioEnabled = !roomLocalState.audioEnabled;
  updateStagePreview();
  emitLocalRoomMediaState();

  showToast(
    roomLocalState.audioEnabled
      ? "Áudio ativado."
      : "Áudio silenciado."
  );
}

function stopRoomLocalMedia() {
  stopSingleStream(roomLocalState.micStream);
  stopSingleStream(roomLocalState.cameraStream);
  stopSingleStream(roomLocalState.screenStream);
  stopSingleStream(roomLocalState.voiceStream);

  roomLocalState.micStream = null;
  roomLocalState.cameraStream = null;
  roomLocalState.screenStream = null;
  roomLocalState.voiceStream = null;
  roomLocalState.voiceRecorder = null;
  roomLocalState.voiceChunks = [];
  roomLocalState.voiceStartedAt = 0;
  roomLocalState.isRecordingVoice = false;

  roomLocalState.micEnabled = false;
  roomLocalState.cameraEnabled = false;
  roomLocalState.screenEnabled = false;
  roomLocalState.audioEnabled = true;

  updateStagePreview();
  emitLocalRoomMediaState();
}

function roomParticipantCard(member) {
  const avatarText = member.avatar
    ? ""
    : escapeHTML(initials(member.name));

  const roleLabel = member.isOwner
    ? "(Anfitrião)"
    : "Participante";

  const presenceLabel = member.media?.screen
    ? "Compartilhando tela"
    : member.media?.camera
      ? "Câmera ligada"
      : (member.statusLabel || member.statusText || member.status || "Conectado");

  const isMe = isOwnRoomMemberId(member.id);
  const isBroadcasting = Boolean(member.media?.screen || member.media?.camera || (isMe && getLocalPrimaryVisualStream()));
  const isSelected = member.id === roomWebRTCState.selectedMemberId;

  return `
    <article
      class="room-participant-chip showcase ${isMe ? "me" : ""} ${isBroadcasting ? "broadcasting" : ""} ${isSelected ? "stage-selected" : ""}"
      data-room-member-id="${escapeHTML(member.id || "")}"
      title="${isBroadcasting ? `Assistir transmissão de ${escapeHTML(member.name)}` : `${escapeHTML(member.name)} não está transmitindo`}"
    >
      <div class="room-participant-top">
        <div class="room-participant-avatar-wrap">
          <span class="room-participant-avatar" ${avatarStyle(member.avatar)}>${avatarText}</span>
          ${member.isOwner ? '<span class="room-host-badge" title="Anfitrião">★</span>' : ''}
        </div>

        <span class="room-participant-copy">
          <strong>${escapeHTML(member.name)}</strong>
          <span>${roleLabel}</span>
        </span>
      </div>

      <div class="room-participant-presence">
        <i class="presence-dot"></i>
        <span>${escapeHTML(presenceLabel)}</span>
      </div>

      <div class="room-participant-icons">
        <i class="${member.media?.mic ? "on" : ""}" title="Microfone">${roomMicIcon()}</i>
        <i class="${member.media?.camera ? "on" : ""}" title="Câmera">${roomCameraIcon()}</i>
        <i class="${member.media?.screen ? "on" : ""}" title="Tela">${roomScreenIcon()}</i>
      </div>
    </article>
  `;
}

function roomMessageMarkup(message) {
  if (message.kind === "system") {
    return `
      <div class="room-system-message">
        ${escapeHTML(message.text)}
      </div>
    `;
  }

  const isMe =
    currentUser &&
    message.authorName === currentUser.username;

  const avatarText = message.authorAvatar
    ? ""
    : escapeHTML(initials(message.authorName));

  let media = "";
  let label = "";

  if (message.kind === "image" && message.dataUrl) {
    media = `
      <div class="room-chat-media">
        <img src="${message.dataUrl}" alt="Imagem enviada">
      </div>
    `;
  }

  if (message.kind === "video" && message.dataUrl) {
    media = `
      <div class="room-chat-media">
        <video controls src="${message.dataUrl}"></video>
      </div>
    `;
  }

  if (
    (message.kind === "audio" || message.kind === "voice") &&
    message.dataUrl
  ) {
    media = `
      <div class="room-chat-media">
        <audio controls src="${message.dataUrl}"></audio>
      </div>
    `;

    if (message.kind === "voice") {
      label = `
        <span class="room-media-label">
          Mensagem de voz ${message.duration ? `(${formatDuration(message.duration)})` : ""}
        </span>
      `;
    } else if (message.fileName) {
      label = `
        <span class="room-media-label">
          ${escapeHTML(message.fileName)}
        </span>
      `;
    }
  }

  return `
    <article class="room-chat-message ${isMe ? "me" : ""}">
      <span class="room-chat-avatar" ${avatarStyle(message.authorAvatar)}>${avatarText}</span>

      <div class="room-chat-bubble">
        <div class="room-chat-meta">
          <strong>${escapeHTML(message.authorName)}</strong>
          <span>${formatChatTime(message.createdAt)}</span>
        </div>

        ${message.text ? `<div class="room-chat-text">${escapeHTML(message.text)}</div>` : ""}
        ${media}
        ${label}
      </div>
    </article>
  `;
}

function renderRoomMessages() {
  const container = $("#roomChatMessages");
  if (!container) return;

  const messages = activeRoomState?.messages || [];

  if (!messages.length) {
    container.innerHTML = `
      <div class="room-chat-empty">
        O chat da sala aparecerá aqui.
      </div>
    `;
    return;
  }

  container.innerHTML = messages
    .map(roomMessageMarkup)
    .join("");

  container.scrollTop = container.scrollHeight;
}

function renderTransmissionRoom() {
  if (!$("#roomView")) return;

  const title =
    activeRoomState?.title ||
    currentRoom?.title ||
    "Sala de transmissão";

  $("#roomPageTitle").textContent = title;
  $("#roomStageRoomTitle").textContent = title;
  $("#roomSubjectText").textContent =
    activeRoomState?.subject ||
    "Programação em Python";

  const ownerName =
    activeRoomState?.ownerName ||
    currentRoom?.title ||
    "Sala";

  const ownerAvatar = activeRoomState?.ownerAvatar || null;

  const ownerAvatarEl = $("#roomOwnerAvatar");
  ownerAvatarEl.textContent = ownerAvatar ? "" : initials(ownerName);
  ownerAvatarEl.style.backgroundImage = ownerAvatar ? `url("${ownerAvatar}")` : "none";
  ownerAvatarEl.style.backgroundSize = ownerAvatar ? "cover" : "";
  ownerAvatarEl.style.backgroundPosition = ownerAvatar ? "center" : "";

  const participants = activeRoomState?.members || [];

  $("#roomParticipantCount").textContent =
    `${participants.length} participante${participants.length === 1 ? "" : "s"}`;

  $("#roomChatSubtitle").textContent =
    `${participants.length} online`;

  $("#roomCodeLabel") && ($("#roomCodeLabel").textContent = currentRoom?.code || "—");

  const strip = $("#roomParticipantsStrip");

  if (participants.length) {
    strip.innerHTML = participants
      .map(roomParticipantCard)
      .join("");

    $$("[data-room-member-id]").forEach(card => {
      card.addEventListener("click", () => {
        selectRoomStageMember(card.dataset.roomMemberId);
      });
    });
  } else {
    strip.innerHTML = `
      <div class="room-chat-empty" style="min-height:70px; width:100%;">
        Nenhum participante conectado.
      </div>
    `;
  }

  reconcileRoomPeers();
  resolveStageMemberId();
  renderRoomMessages();
  syncRoomSettingsForm();
  updateRoomLiveUI();
  updateStagePreview();
  updateRoomBookmarkButton();
  startRoomPingLoop();
}

function updateRoomBookmarkButton() {
  const button = $("#roomBookmarkButton");
  if (!button || !currentRoom) return;

  const saved = isRoomSaved(currentRoom.code);
  button.classList.toggle("saved", saved);
  button.title = saved ? "Remover sala salva" : "Salvar sala";
}

function updateRoomSettingsSnapshot() {
  syncRoomSettingsForm();
}

function leaveTransmissionRoom() {
  if (!currentRoom) {
    resetRoomWebRTC();
    stopRoomPingLoop();
    showPage("rooms");
    return;
  }

  stopRoomLocalMedia();
  resetRoomWebRTC();
  stopRoomPingLoop();
  socket.emit("room:leave");
  currentRoom = null;
  activeRoomState = null;
  showPage("rooms");
  showToast("Você saiu da sala.");
}

async function fileToDataURL(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sendRoomAttachment(file, kind) {
  if (!currentRoom) {
    showToast("Entre em uma sala primeiro.");
    return;
  }

  if (!file) return;

  if (file.size > 7 * 1024 * 1024) {
    showToast("Arquivo muito grande. Use até 7 MB nesta versão de teste.");
    return;
  }

  try {
    const dataUrl = await fileToDataURL(file);

    socket.emit("room:message", {
      kind,
      dataUrl,
      fileName: file.name
    });

    showToast("Arquivo enviado.");
  } catch {
    showToast("Não foi possível enviar o arquivo.");
  }
}

function sendRoomTextMessage() {
  const input = $("#roomChatInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  socket.emit("room:message", {
    kind: "text",
    text
  });

  input.value = "";
  $("#roomEmojiPicker")?.classList.add("hidden");
}

async function toggleVoiceRecording() {
  if (!currentRoom) {
    showToast("Entre em uma sala primeiro.");
    return;
  }

  const button = $("#roomVoiceButton");

  if (roomLocalState.isRecordingVoice && roomLocalState.voiceRecorder) {
    roomLocalState.voiceRecorder.stop();
    roomLocalState.isRecordingVoice = false;
    button?.classList.remove("recording");
    showToast("Processando mensagem de voz...");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    roomLocalState.voiceStream = stream;
    roomLocalState.voiceChunks = [];
    roomLocalState.voiceStartedAt = Date.now();

    const recorder = new MediaRecorder(stream);
    roomLocalState.voiceRecorder = recorder;
    roomLocalState.isRecordingVoice = true;

    recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        roomLocalState.voiceChunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(roomLocalState.voiceChunks, {
          type: "audio/webm"
        });

        const duration =
          (Date.now() - roomLocalState.voiceStartedAt) / 1000;

        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        socket.emit("room:message", {
          kind: "voice",
          dataUrl,
          duration
        });

        showToast("Mensagem de voz enviada.");
      } catch {
        showToast("Não foi possível enviar a mensagem de voz.");
      } finally {
        stopSingleStream(roomLocalState.voiceStream);
        roomLocalState.voiceStream = null;
        roomLocalState.voiceRecorder = null;
        roomLocalState.voiceChunks = [];
        roomLocalState.voiceStartedAt = 0;
        roomLocalState.isRecordingVoice = false;
        button?.classList.remove("recording");
      }
    };

    recorder.start();
    button?.classList.add("recording");
    showToast("Gravando mensagem de voz...");
  } catch {
    showToast("Não foi possível iniciar a gravação de voz.");
  }
}

socket.on("room:state", data => {
  if (!currentRoom || data?.code !== currentRoom.code) {
    return;
  }

  activeRoomState = data;
  renderTransmissionRoom();
});

socket.on("disconnect", () => {
  resetRoomWebRTC();
});

syncRoomSettingsForm();

if ($("#roomMicButton")) {
  $("#roomMicButton").addEventListener("click", toggleRoomMic);
  $("#roomAudioButton").addEventListener("click", toggleRoomAudio);
  $("#roomCameraButton").addEventListener("click", toggleRoomCamera);
  $("#roomScreenButton").addEventListener("click", toggleRoomScreen);
  $("#roomLeaveButton").addEventListener("click", leaveTransmissionRoom);
  $("#roomExitRemoteViewButton")?.addEventListener("click", exitRemoteStageView);
  $("#roomFullscreenButton")?.addEventListener("click", toggleRoomStageFullscreen);
  document.addEventListener("fullscreenchange", syncRoomFullscreenButton);

  $("#roomSettingsButton").addEventListener("click", async () => {
    updateRoomSettingsSnapshot();
    await populateRoomSettingsDevices();
    $("#roomSettingsModal").classList.remove("hidden");
  });

  $("#roomCodeButton")?.addEventListener("click", async () => {
    const code = currentRoom?.code;
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      showToast("Código da sala copiado.");
    } catch {
      showToast(`Código da sala: ${code}`);
    }
  });

  $("#closeRoomSettings").addEventListener("click", () => {
    $("#roomSettingsModal").classList.add("hidden");
  });

  $("#closeRoomSettingsFooter").addEventListener("click", () => {
    $("#roomSettingsModal").classList.add("hidden");
  });

  $("#applyRoomSettings").addEventListener("click", applyRoomSettingsFromModal);

  $("#roomSettingsModal").addEventListener("click", event => {
    if (event.target === $("#roomSettingsModal")) {
      $("#roomSettingsModal").classList.add("hidden");
    }
  });

  $("#roomSendButton").addEventListener("click", sendRoomTextMessage);

  $("#roomChatInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      sendRoomTextMessage();
    }
  });

  $("#roomImageButton").addEventListener("click", () => {
    $("#roomImageInput").click();
  });

  $("#roomVideoButton").addEventListener("click", () => {
    $("#roomVideoInput").click();
  });

  $("#roomAudioFileButton").addEventListener("click", () => {
    $("#roomAudioInput").click();
  });

  $("#roomImageInput").addEventListener("change", async event => {
    await sendRoomAttachment(event.target.files?.[0], "image");
    event.target.value = "";
  });

  $("#roomVideoInput").addEventListener("change", async event => {
    await sendRoomAttachment(event.target.files?.[0], "video");
    event.target.value = "";
  });

  $("#roomAudioInput").addEventListener("change", async event => {
    await sendRoomAttachment(event.target.files?.[0], "audio");
    event.target.value = "";
  });

  $("#roomEmojiButton").addEventListener("click", () => {
    $("#roomEmojiPicker").classList.toggle("hidden");
  });

  $$("#roomEmojiPicker button").forEach(button => {
    button.addEventListener("click", () => {
      const input = $("#roomChatInput");
      input.value += button.textContent;
      input.focus();
      $("#roomEmojiPicker").classList.add("hidden");
    });
  });

  $("#roomVoiceButton").addEventListener("click", toggleVoiceRecording);

  $("#roomBookmarkButton").addEventListener("click", () => {
    if (!currentRoom) return;

    const room =
      (lastRealtimeState?.liveRooms || [])
        .find(item => item.code === currentRoom.code);

    if (room) {
      toggleSavedRoom(room);
    } else if (activeRoomState) {
      toggleSavedRoom({
        code: activeRoomState.code,
        title: activeRoomState.title,
        owner: activeRoomState.ownerName,
        ownerAvatar: activeRoomState.ownerAvatar,
        viewers: activeRoomState.viewers,
        createdAt: Date.now()
      });
    }

    updateRoomBookmarkButton();
  });
}

/* =========================================================
   V6 — PERFIL / STATUS
========================================================= */

const STATUS_META = {
  available: {
    label: "Disponível",
    className: "available"
  },
  away: {
    label: "Ausente",
    className: "away"
  },
  dnd: {
    label: "Não perturbar",
    className: "dnd"
  },
  invisible: {
    label: "Invisível",
    className: "invisible"
  }
};

function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.available;
}

function setAvatarElement(element, username, dataUrl) {
  if (!element) return;

  if (dataUrl) {
    element.classList.add("has-image");
    element.style.backgroundImage = `url("${dataUrl}")`;
    element.textContent = "";
  } else {
    element.classList.remove("has-image");
    element.style.backgroundImage = "";
    element.textContent = initials(username);
  }
}

function updateOwnStatusUI(status) {
  const meta = statusMeta(status);

  profileState.status = status;

  $("#profileStatusText").textContent = meta.label;
  $("#profileStatusText").className = `profile-status-label ${meta.className}`;
  $("#sidebarStatusText").textContent = meta.label;
  $("#sidebarStatusText").className = `sidebar-status-label ${meta.className}`;

  const statusDot = $("#profileStatusDot");
  statusDot.className = `status-dot ${meta.className}`;

  const sidebarDot = $(".sidebar-status-dot");
  sidebarDot.className = `sidebar-status-dot ${meta.className}`;

  const ring = $("#profileStatusRing");
  ring.className = `profile-status-ring ${meta.className}`;

  $("#editProfileStatus").value = status;
}

function formatMemberSince() {
  const stored =
    localStorage.getItem("estudex-member-since");

  if (!stored) {
    const now = new Date().toISOString();
    localStorage.setItem("estudex-member-since", now);
    return formatMemberSince();
  }

  const date = new Date(stored);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "pt-BR",
    {
      month: "short",
      year: "numeric"
    }
  );
}

function updateSessionHours() {
  if (!profileState.connectedAt) {
    $("#profileHours").textContent = "—";
    return;
  }

  const elapsed =
    Math.max(
      0,
      Date.now() - profileState.connectedAt
    );

  const minutes =
    Math.floor(elapsed / 60000);

  if (minutes < 60) {
    $("#profileHours").textContent =
      `${minutes} min`;
  } else {
    const hours =
      (minutes / 60).toFixed(1);

    $("#profileHours").textContent =
      `${hours} h`;
  }
}

function updateProfilePage() {
  if (!currentUser) return;

  $("#profilePageUsername").textContent =
    currentUser.username;

  $("#profileAboutText").textContent =
    profileState.about ||
    "Adicione uma descrição sobre você.";

  $("#profileCreatedRooms").textContent =
    String(profileState.createdRooms || 0);

  $("#profileMemberSince").textContent =
    formatMemberSince();

  if (lastRealtimeState) {
    $("#profileFriendsCount").textContent =
      String(
        (lastRealtimeState.onlineFriends || []).length
      );
  }

  updateSessionHours();
  updateOwnStatusUI(profileState.status);

  setAvatarElement(
    $("#profileLargeAvatar"),
    currentUser.username,
    profileState.avatarDataUrl
  );

  setAvatarElement(
    $("#editAvatarPreview"),
    currentUser.username,
    profileState.avatarDataUrl
  );
}

setInterval(updateSessionHours, 30000);

function openProfileEditor() {
  if (!currentUser) return;

  $("#editProfileName").value =
    currentUser.username;

  $("#editProfileAbout").value =
    profileState.about || "";

  $("#editProfileStatus").value =
    profileState.status;

  $("#profileAboutCounter").textContent =
    String(
      $("#editProfileAbout").value.length
    );

  setAvatarElement(
    $("#editAvatarPreview"),
    currentUser.username,
    profileState.avatarDataUrl
  );

  $("#editProfileModal")
    .classList
    .remove("hidden");

  setTimeout(
    () => $("#editProfileName").focus(),
    80
  );
}

function closeProfileEditor() {
  $("#editProfileModal")
    .classList
    .add("hidden");
}

$("#openEditProfile").addEventListener(
  "click",
  openProfileEditor
);

$("#editAboutButton").addEventListener(
  "click",
  openProfileEditor
);

$("#closeEditProfile").addEventListener(
  "click",
  closeProfileEditor
);

$("#cancelEditProfile").addEventListener(
  "click",
  closeProfileEditor
);

$("#editProfileModal").addEventListener(
  "click",
  event => {
    if (event.target === $("#editProfileModal")) {
      closeProfileEditor();
    }
  }
);

$("#editProfileAbout").addEventListener(
  "input",
  () => {
    $("#profileAboutCounter").textContent =
      String(
        $("#editProfileAbout").value.length
      );
  }
);

$("#profileStatusButton").addEventListener(
  "click",
  event => {
    event.stopPropagation();

    $("#statusPopover")
      .classList
      .toggle("hidden");
  }
);

document.addEventListener("click", event => {
  if (
    !$("#statusPopover").contains(event.target) &&
    !$("#profileStatusButton").contains(event.target)
  ) {
    $("#statusPopover")
      .classList
      .add("hidden");
  }
});

$$("[data-status-value]").forEach(button => {
  button.addEventListener("click", () => {
    const status =
      button.dataset.statusValue;

    saveStatusImmediately(status);

    $("#statusPopover")
      .classList
      .add("hidden");
  });
});

function saveStatusImmediately(status) {
  profileState.status = status;

  localStorage.setItem(
    "estudex-profile-status",
    status
  );

  updateOwnStatusUI(status);

  socket.emit("profile:update", {
    status
  });
}

$("#saveProfileChanges").addEventListener(
  "click",
  () => {
    const username =
      $("#editProfileName")
        .value
        .trim();

    const about =
      $("#editProfileAbout")
        .value
        .trim();

    const status =
      $("#editProfileStatus").value;

    if (!username) {
      showToast(
        "O nome do perfil não pode ficar vazio."
      );

      $("#editProfileName").focus();
      return;
    }

    profileState.about = about;
    profileState.status = status;

    localStorage.setItem(
      "estudex-test-username",
      username
    );

    localStorage.setItem(
      "estudex-profile-about",
      about
    );

    localStorage.setItem(
      "estudex-profile-status",
      status
    );

    socket.emit("profile:update", {
      username,
      about,
      status,
      avatar: profileState.avatarDataUrl
    });

    closeProfileEditor();
  }
);

/* =========================================================
   FOTO / BANNER DO PERFIL
========================================================= */

const PROFILE_AVATAR_KEY = "profile-avatar";
const PROFILE_BANNER_KEY = "profile-banner";

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);

    reader.readAsDataURL(blob);
  });
}

async function loadProfileAssetBlob(key) {
  try {
    const db = await openSettingsDB();

    const blob =
      await new Promise((resolve, reject) => {
        const tx =
          db.transaction(
            STORE_NAME,
            "readonly"
          );

        const request =
          tx.objectStore(STORE_NAME)
            .get(key);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });

    db.close();
    return blob;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function saveProfileAssetBlob(key, blob) {
  const db = await openSettingsDB();

  await new Promise((resolve, reject) => {
    const tx =
      db.transaction(
        STORE_NAME,
        "readwrite"
      );

    tx.objectStore(STORE_NAME)
      .put(blob, key);

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

function applyProfileBanner(url) {
  const banner = $("#profileBanner");

  if (
    currentProfileBannerURL &&
    currentProfileBannerURL.startsWith("blob:")
  ) {
    URL.revokeObjectURL(
      currentProfileBannerURL
    );
  }

  currentProfileBannerURL = url || null;

  if (url) {
    banner.style.backgroundImage =
      `linear-gradient(180deg,transparent 40%,rgba(1,7,19,.58) 100%),url("${url}")`;

    banner.style.backgroundSize = "cover";
    banner.style.backgroundPosition = "center";
  } else {
    banner.style.backgroundImage = "";
  }
}

async function initLocalProfile() {
  profileState.about =
    localStorage.getItem(
      "estudex-profile-about"
    ) || "";

  profileState.status =
    localStorage.getItem(
      "estudex-profile-status"
    ) || DEFAULT_PROFILE_STATUS;

  formatMemberSince();

  const avatarBlob =
    await loadProfileAssetBlob(
      PROFILE_AVATAR_KEY
    );

  if (avatarBlob) {
    try {
      profileState.avatarDataUrl =
        await blobToDataURL(avatarBlob);
    } catch (error) {
      console.error(error);
    }
  }

  const bannerBlob =
    await loadProfileAssetBlob(
      PROFILE_BANNER_KEY
    );

  if (bannerBlob) {
    applyProfileBanner(
      URL.createObjectURL(bannerBlob)
    );
  }

  updateOwnStatusUI(
    profileState.status
  );
}

$("#chooseProfileAvatar").addEventListener(
  "click",
  () => {
    $("#profileAvatarFile").click();
  }
);

$("#chooseProfileBanner").addEventListener(
  "click",
  () => {
    $("#profileBannerFile").click();
  }
);

$("#profileAvatarFile").addEventListener(
  "change",
  async event => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Escolha uma imagem válida.");
      return;
    }

    const maxSize =
      3 * 1024 * 1024;

    if (file.size > maxSize) {
      showToast(
        "A foto de perfil deve ter no máximo 3 MB."
      );

      event.target.value = "";
      return;
    }

    await saveProfileAssetBlob(
      PROFILE_AVATAR_KEY,
      file
    );

    profileState.avatarDataUrl =
      await blobToDataURL(file);

    const username =
      currentUser?.username ||
      localStorage.getItem(
        "estudex-test-username"
      ) ||
      "U";

    setAvatarElement(
      $("#editAvatarPreview"),
      username,
      profileState.avatarDataUrl
    );

    setAvatarElement(
      $("#profileLargeAvatar"),
      username,
      profileState.avatarDataUrl
    );

    setAvatarElement(
      $("#profileAvatar"),
      username,
      profileState.avatarDataUrl
    );

    setAvatarElement(
      $("#topAvatar"),
      username,
      profileState.avatarDataUrl
    );

    socket.emit("profile:update", {
      avatar: profileState.avatarDataUrl
    });

    showToast("Foto de perfil atualizada.");

    event.target.value = "";
  }
);

$("#profileBannerFile").addEventListener(
  "change",
  async event => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Escolha uma imagem ou GIF válido.");
      return;
    }

    const maxSize =
      15 * 1024 * 1024;

    if (file.size > maxSize) {
      showToast(
        "O banner deve ter no máximo 15 MB."
      );

      event.target.value = "";
      return;
    }

    await saveProfileAssetBlob(
      PROFILE_BANNER_KEY,
      file
    );

    applyProfileBanner(
      URL.createObjectURL(file)
    );

    showToast("Banner do perfil atualizado.");

    event.target.value = "";
  }
);


/* =========================================================
   CORES - CONVERSÕES
========================================================= */

function normalizeHex(hex) {
  const value = String(hex || "")
    .trim()
    .toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(value)) {
    return value;
  }

  if (/^[0-9A-F]{6}$/.test(value)) {
    return `#${value}`;
  }

  return null;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;

  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map(v => clamp(Math.round(v), 0, 255)
      .toString(16)
      .padStart(2, "0"))
      .join("")
  ).toUpperCase();
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * (((b - r) / delta) + 2);
    } else {
      h = 60 * (((r - g) / delta) + 4);
    }
  }

  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return {
    h,
    s: s * 100,
    v: v * 100
  };
}

function hsvToRgb(h, s, v) {
  s /= 100;
  v /= 100;

  const c = v * s;
  const x =
    c *
    (1 - Math.abs(((h / 60) % 2) - 1));

  const m = v - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) {
    rp = c; gp = x;
  } else if (h < 120) {
    rp = x; gp = c;
  } else if (h < 180) {
    gp = c; bp = x;
  } else if (h < 240) {
    gp = x; bp = c;
  } else if (h < 300) {
    rp = x; bp = c;
  } else {
    rp = c; bp = x;
  }

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255
  };
}

function hsvToHex(h, s, v) {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function mixRgb(rgb, target, amount) {
  return {
    r: rgb.r + (target.r - rgb.r) * amount,
    g: rgb.g + (target.g - rgb.g) * amount,
    b: rgb.b + (target.b - rgb.b) * amount
  };
}

/* =========================================================
   TEMA
========================================================= */

function applyThemeColor(hex, options = {}) {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    return false;
  }

  const rgb = hexToRgb(normalized);

  const light = mixRgb(
    rgb,
    { r:255, g:255, b:255 },
    .22
  );

  const dark = mixRgb(
    rgb,
    { r:0, g:0, b:0 },
    .28
  );

  const root = document.documentElement;

  root.style.setProperty(
    "--theme",
    normalized
  );

  root.style.setProperty(
    "--theme-rgb",
    `${rgb.r},${rgb.g},${rgb.b}`
  );

  root.style.setProperty(
    "--theme-light",
    rgbToHex(light.r, light.g, light.b)
  );

  root.style.setProperty(
    "--theme-dark",
    rgbToHex(dark.r, dark.g, dark.b)
  );

  appearanceState.themeColor = normalized;

  $("#themeHexInput").value = normalized;
  $("#themeNativePicker").value = normalized;

  if (!options.skipHsvSync) {
    appearanceState.hsv =
      rgbToHsv(rgb.r, rgb.g, rgb.b);
  }

  updatePickerHandles();
  updateSelectedColorButtons();

  localStorage.setItem(
    "estudex-theme-color",
    normalized
  );

  return true;
}

function updateSelectedColorButtons() {
  const selected =
    appearanceState.themeColor.toUpperCase();

  $$("#quickColors [data-color]").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.color.toUpperCase() === selected
    );
  });
}

$("#themeNativePicker").addEventListener("input", event => {
  // "input" atualiza em tempo real enquanto a pessoa mexe
  // no seletor nativo de cor.
  applyThemeColor(event.target.value);
});

$("#themeNativePicker").addEventListener("change", event => {
  applyThemeColor(event.target.value);
});

$("#themeHexInput").addEventListener("change", () => {
  const value =
    normalizeHex(
      $("#themeHexInput").value
    );

  if (!value) {
    $("#themeHexInput").value =
      appearanceState.themeColor;

    showToast("Use uma cor HEX válida. Ex: #8F18D8");
    return;
  }

  applyThemeColor(value);
});

$("#themeHexInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    $("#themeHexInput").blur();
  }
});

$("#restoreTheme").addEventListener("click", () => {
  applyThemeColor(DEFAULT_THEME);
  showToast("Cor padrão restaurada.");
});

$$("#quickColors [data-color]").forEach(button => {
  button.addEventListener("click", () => {
    applyThemeColor(
      button.dataset.color
    );
  });
});

/* =========================================================
   COLOR WHEEL HSV
========================================================= */

function updatePickerHandles() {
  const wheel = $("#colorWheel");
  const wheelHandle = $("#wheelHandle");
  const slider = $("#brightnessControl");
  const sliderHandle = $("#brightnessHandle");

  if (!wheel || !slider) return;

  // Se a página ainda estiver oculta, clientWidth = 0.
  // Não move os marcadores até o seletor realmente estar visível.
  if (wheel.clientWidth === 0 || slider.clientHeight === 0) return;

  const radius = wheel.clientWidth / 2;
  const satRadius =
    radius *
    (appearanceState.hsv.s / 100);

  /*
    CSS conic-gradient começa no topo e gira no sentido horário.
    Ajustamos o ângulo para o HSV.
  */
  const angle =
    (appearanceState.hsv.h - 90) *
    Math.PI / 180;

  const x =
    radius +
    Math.cos(angle) *
    satRadius;

  const y =
    radius +
    Math.sin(angle) *
    satRadius;

  wheelHandle.style.left = `${x}px`;
  wheelHandle.style.top = `${y}px`;

  sliderHandle.style.top =
    `${(1 - appearanceState.hsv.v / 100) * slider.clientHeight}px`;

  const fullColor =
    hsvToHex(
      appearanceState.hsv.h,
      appearanceState.hsv.s,
      100
    );

  slider.style.setProperty(
    "--picker-full-color",
    fullColor
  );
}

function pickWheel(clientX, clientY) {
  const wheel = $("#colorWheel");
  const rect = wheel.getBoundingClientRect();

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const dx = clientX - cx;
  const dy = clientY - cy;

  const radius = rect.width / 2;
  const distance =
    Math.min(
      Math.sqrt(dx * dx + dy * dy),
      radius
    );

  let angle =
    Math.atan2(dy, dx) *
    180 / Math.PI;

  angle += 90;

  if (angle < 0) angle += 360;

  appearanceState.hsv.h = angle;
  appearanceState.hsv.s =
    (distance / radius) * 100;

  const hex =
    hsvToHex(
      appearanceState.hsv.h,
      appearanceState.hsv.s,
      appearanceState.hsv.v
    );

  applyThemeColor(
    hex,
    { skipHsvSync:true }
  );
}

function pickBrightness(clientY) {
  const slider = $("#brightnessControl");
  const rect = slider.getBoundingClientRect();

  const y =
    clamp(
      clientY - rect.top,
      0,
      rect.height
    );

  appearanceState.hsv.v =
    (1 - y / rect.height) * 100;

  const hex =
    hsvToHex(
      appearanceState.hsv.h,
      appearanceState.hsv.s,
      appearanceState.hsv.v
    );

  applyThemeColor(
    hex,
    { skipHsvSync:true }
  );
}

function bindPointerDrag(element, handler) {
  let dragging = false;

  element.addEventListener("pointerdown", event => {
    dragging = true;
    element.setPointerCapture(event.pointerId);
    handler(event);
  });

  element.addEventListener("pointermove", event => {
    if (dragging) {
      handler(event);
    }
  });

  element.addEventListener("pointerup", event => {
    dragging = false;

    try {
      element.releasePointerCapture(event.pointerId);
    } catch {}
  });

  element.addEventListener("pointercancel", () => {
    dragging = false;
  });
}

bindPointerDrag(
  $("#colorWheel"),
  event => pickWheel(
    event.clientX,
    event.clientY
  )
);

bindPointerDrag(
  $("#brightnessControl"),
  event => pickBrightness(
    event.clientY
  )
);

/* =========================================================
   WALLPAPER — IndexedDB
   Imagem/GIF fica salva no navegador sem converter para Base64.
========================================================= */

const DB_NAME = "estudex-local-settings";
const DB_VERSION = 1;
const STORE_NAME = "assets";
const WALLPAPER_KEY = "lobby-wallpaper";

function openSettingsDB() {
  return new Promise((resolve, reject) => {
    const request =
      indexedDB.open(
        DB_NAME,
        DB_VERSION
      );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function saveWallpaperBlob(blob) {
  const db = await openSettingsDB();

  await new Promise((resolve, reject) => {
    const tx =
      db.transaction(
        STORE_NAME,
        "readwrite"
      );

    tx.objectStore(STORE_NAME)
      .put(
        blob,
        WALLPAPER_KEY
      );

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

async function loadWallpaperBlob() {
  const db = await openSettingsDB();

  const blob =
    await new Promise((resolve, reject) => {
      const tx =
        db.transaction(
          STORE_NAME,
          "readonly"
        );

      const request =
        tx.objectStore(STORE_NAME)
          .get(WALLPAPER_KEY);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

  db.close();
  return blob;
}

async function deleteWallpaperBlob() {
  const db = await openSettingsDB();

  await new Promise((resolve, reject) => {
    const tx =
      db.transaction(
        STORE_NAME,
        "readwrite"
      );

    tx.objectStore(STORE_NAME)
      .delete(WALLPAPER_KEY);

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

function setWallpaperURL(url) {
  if (
    currentWallpaperURL &&
    currentWallpaperURL.startsWith("blob:")
  ) {
    URL.revokeObjectURL(
      currentWallpaperURL
    );
  }

  currentWallpaperURL = url || null;

  const root =
    document.documentElement;

  if (url) {
    root.style.setProperty(
      "--lobby-wallpaper",
      `url("${url}")`
    );

    $("#wallpaperThumb")
      .classList
      .add("has-wallpaper");
  } else {
    root.style.setProperty(
      "--lobby-wallpaper",
      "none"
    );

    $("#wallpaperThumb")
      .classList
      .remove("has-wallpaper");
  }
}

async function restoreSavedWallpaper() {
  try {
    const blob =
      await loadWallpaperBlob();

    if (!blob) {
      setWallpaperURL(null);
      return;
    }

    const url =
      URL.createObjectURL(blob);

    setWallpaperURL(url);
  } catch (error) {
    console.error(
      "Não foi possível carregar o wallpaper:",
      error
    );
  }
}

$("#chooseWallpaper").addEventListener("click", () => {
  $("#wallpaperFile").click();
});

$("#wallpaperFile").addEventListener("change", async event => {
  const file =
    event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Escolha uma imagem ou GIF.");
    return;
  }

  /*
    IndexedDB aguenta arquivos grandes melhor que localStorage.
    Limitamos a 50 MB apenas para evitar travar o navegador de teste.
  */
  const maxSize =
    50 * 1024 * 1024;

  if (file.size > maxSize) {
    showToast("A imagem/GIF deve ter no máximo 50 MB.");
    event.target.value = "";
    return;
  }

  try {
    await saveWallpaperBlob(file);

    const url =
      URL.createObjectURL(file);

    setWallpaperURL(url);

    showToast(
      file.type === "image/gif"
        ? "GIF aplicado ao lobby."
        : "Imagem aplicada ao lobby."
    );
  } catch (error) {
    console.error(error);

    showToast(
      "Não foi possível salvar o papel de parede."
    );
  }

  event.target.value = "";
});

$("#restoreWallpaper").addEventListener("click", async () => {
  try {
    await deleteWallpaperBlob();
    setWallpaperURL(null);

    showToast(
      "Papel de parede restaurado."
    );
  } catch (error) {
    console.error(error);

    showToast(
      "Não foi possível restaurar o wallpaper."
    );
  }
});

/* =========================================================
   APLICAR SOMENTE NO LOBBY
========================================================= */

function setLobbyOnly(enabled) {
  appearanceState.lobbyOnly = Boolean(enabled);

  localStorage.setItem(
    "estudex-wallpaper-lobby-only",
    enabled ? "1" : "0"
  );

  document.body.classList.toggle(
    "wallpaper-lobby-only",
    enabled
  );

  $("#lobbyOnlyToggle")
    .classList
    .toggle(
      "active",
      enabled
    );

  $("#lobbyOnlyToggle")
    .setAttribute(
      "aria-checked",
      enabled ? "true" : "false"
    );
}

$("#lobbyOnlyToggle").addEventListener("click", () => {
  setLobbyOnly(
    !appearanceState.lobbyOnly
  );
});

/* =========================================================
   INICIALIZAÇÃO DA APARÊNCIA
========================================================= */

async function initAppearance() {
  const savedTheme =
    normalizeHex(
      localStorage.getItem(
        "estudex-theme-color"
      )
    ) ||
    DEFAULT_THEME;

  const savedLobbyOnly =
    localStorage.getItem(
      "estudex-wallpaper-lobby-only"
    );

  setLobbyOnly(
    savedLobbyOnly === null
      ? true
      : savedLobbyOnly === "1"
  );

  applyThemeColor(savedTheme);

  /*
    Espera um frame para o wheel ter dimensões reais,
    mesmo que a tela Aparência esteja inicialmente oculta.
  */
  requestAnimationFrame(() => {
    updatePickerHandles();
  });

  await restoreSavedWallpaper();
}

window.addEventListener("resize", () => {
  updatePickerHandles();
});

initAppearance();


document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    $("#editProfileModal")?.classList.add("hidden");
    $("#statusPopover")?.classList.add("hidden");
  }
});


/* =========================================================
   AMIGOS / SOCIAL
========================================================= */
const FRIENDS_STORAGE_KEY = "estudex-social-friends-v1";
const friendsUIState = {
  tab: "all",
  search: "",
  addSearch: "",
  selectedFriendId: null,
  menuFriendId: null,
  messageFriendId: null
};
let socialFriends = loadSocialFriends();

function defaultSocialFriends() {
  // Sem amigos fictícios: a estrutura visual continua pronta,
  // mas os cards só aparecem quando houver usuários reais adicionados.
  return [];
}

function loadSocialFriends() {
  try {
    const raw = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (!raw) return defaultSocialFriends();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultSocialFriends();

    // Migração V9.1: remove os dois perfis de demonstração usados
    // apenas como referência visual na V9 anterior.
    const cleaned = parsed.filter(friend => {
      const id = String(friend?.id || "").toLowerCase();
      const name = String(friend?.name || "").trim().toLowerCase();
      const username = String(friend?.username || "").trim().toLowerCase();

      const isOldSample =
        id === "friend-piru666" ||
        id === "friend-ratex" ||
        name === "piru666" ||
        name === "ratex" ||
        username === "piru666" ||
        username === "ratex";

      return !isOldSample;
    });

    if (cleaned.length !== parsed.length) {
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch {
    return defaultSocialFriends();
  }
}

function saveSocialFriends() {
  localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(socialFriends));
}

function renderAvatarMarkup(friend, large = false) {
  const cls = large ? 'friend-avatar-large' : 'friend-profile-avatar-wrap';
  if (friend.avatar) {
    return '<span class="' + cls + '"><img src="' + escapeHTML(friend.avatar) + '" alt=""></span>';
  }
  return '<span class="' + cls + '"><span class="dynamic-avatar">' + escapeHTML(initials(friend.name)) + '</span></span>';
}

function relationLabel(relation) {
  if (relation === 'blocked') return 'Bloqueado';
  if (relation === 'pending') return 'Pendente';
  return 'Amigo';
}

function friendStatusLabel(friend) {
  const state = friend.state || 'offline';
  if (state === 'available' || state === 'online') return 'Online';
  if (state === 'away') return 'Ausente';
  if (state === 'dnd') return 'Não perturbar';
  if (state === 'invisible') return 'Invisível';
  return 'Offline';
}

function friendStateClass(friend) {
  const state = friend.state || 'offline';
  return state === 'online' ? 'available' : state;
}

function statusColorForState(state) {
  const normalized = state === "online" ? "available" : (state || "offline");
  if (normalized === "available") return "#39DB83";
  if (normalized === "away") return "#F2B84B";
  if (normalized === "dnd") return "#FF5367";
  return "#94A1C7";
}

function syncFriendPresence() {
  const online = (lastRealtimeState?.onlineFriends || []).map(friend => ({
    ...friend,
    _nameKey: String(friend.name || '').trim().toLowerCase()
  }));

  socialFriends = socialFriends.map(friend => {
    if (friend.relation !== 'friend') {
      return friend;
    }

    const match = online.find(item => {
      const name = String(friend.name || '').trim().toLowerCase();
      const username = String(friend.username || '').trim().toLowerCase();
      return item._nameKey === name || item._nameKey === username;
    });

    if (!match) {
      return { ...friend, state: 'offline' };
    }

    return {
      ...friend,
      state: match.state || match.status || 'available',
      avatar: friend.avatar || match.avatar || null
    };
  });

  saveSocialFriends();

  if (typeof syncInboxThreadContacts === "function") {
    syncInboxThreadContacts();
  }
}

function getFriendCounts() {
  const friendItems = socialFriends.filter(item => item.relation === 'friend');
  return {
    all: friendItems.length,
    online: friendItems.filter(item => ['available','online','away','dnd','invisible'].includes(item.state)).length,
    pending: socialFriends.filter(item => item.relation === 'pending').length,
    blocked: socialFriends.filter(item => item.relation === 'blocked').length
  };
}

function getFilteredFriends() {
  const search = friendsUIState.search.trim().toLowerCase();
  return socialFriends.filter(friend => {
    if (friendsUIState.tab === 'all' && friend.relation !== 'friend') return false;
    if (friendsUIState.tab === 'online' && !(friend.relation === 'friend' && ['available','online','away','dnd','invisible'].includes(friend.state))) return false;
    if (friendsUIState.tab === 'pending' && friend.relation !== 'pending') return false;
    if (friendsUIState.tab === 'blocked' && friend.relation !== 'blocked') return false;
    if (!search) return true;
    return [friend.name, friend.username, friend.about].some(value => String(value || '').toLowerCase().includes(search));
  });
}

function renderFriendsPage() {
  const counts = getFriendCounts();
  const panel = document.getElementById('friendsListPanel');
  if (!panel) return;

  document.getElementById('friendsAllCount').textContent = counts.all;
  document.getElementById('friendsOnlineCount').textContent = counts.online;
  document.getElementById('friendsPendingCount').textContent = counts.pending;
  document.getElementById('friendsBlockedCount').textContent = counts.blocked;

  document.querySelectorAll('.friends-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.friendsTab === friendsUIState.tab);
  });

  const filtered = getFilteredFriends();

  if (!filtered.length) {
    const label = friendsUIState.tab === 'online'
      ? 'Nenhum amigo online'
      : friendsUIState.tab === 'pending'
      ? 'Nenhum convite pendente'
      : friendsUIState.tab === 'blocked'
      ? 'Nenhum usuário bloqueado'
      : 'Nenhum amigo adicionado';

    const text = friendsUIState.search
      ? 'Tente buscar outro nome ou limpe o campo de busca.'
      : 'Se outro ESTUDEX estiver na mesma rede, adicione a pessoa e ela aparecerá aqui.';

    panel.innerHTML = '<div class="friend-item-row empty"><div class="friends-empty-state"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"></circle><circle cx="17" cy="9" r="2.5"></circle><path d="M2 20c.5-4 2.5-6 6-6s5.5 2 6 6"></path><path d="M15 15c3 0 5 1.6 6 5"></path></svg><strong>' + escapeHTML(label) + '</strong><span>' + escapeHTML(text) + '</span></div></div>';
  } else {
    panel.innerHTML = filtered.map(friend => {
      const showMessage = friend.relation === 'friend';
      const menuHtml = friend.relation === 'blocked'
        ? '<button data-friend-action="unblock" data-friend-id="' + escapeHTML(friend.id) + '" type="button">Desbloquear</button><button class="danger" data-friend-action="remove" data-friend-id="' + escapeHTML(friend.id) + '" type="button">Remover</button>'
        : '<button data-friend-action="block" data-friend-id="' + escapeHTML(friend.id) + '" type="button">Bloquear</button><button class="danger" data-friend-action="remove" data-friend-id="' + escapeHTML(friend.id) + '" type="button">Remover</button>';
      return '<div class="friend-item-row">' +
        renderAvatarMarkup(friend, true) +
        '<div class="friend-main-copy"><strong>' + escapeHTML(friend.name) + '</strong><div class="friend-secondary-line"><span class="friend-status-dot ' + escapeHTML(friendStateClass(friend)) + '"></span><span class="friend-status-label ' + escapeHTML(friendStateClass(friend)) + '">' + escapeHTML(friendStatusLabel(friend)) + '</span></div></div>' +
        '<div class="friend-actions">' +
          (showMessage ? '<button class="friend-action-button" data-friend-message="' + escapeHTML(friend.id) + '" type="button"><svg viewBox="0 0 24 24"><path d="M4 6h16v10a2 2 0 0 1-2 2H9l-5 4V8a2 2 0 0 1 2-2z"></path></svg><span>Mensagem</span></button>' : '') +
          '<button class="friend-action-button" data-friend-profile="' + escapeHTML(friend.id) + '" type="button"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c.5-5 3-7 8-7s7.5 2 8 7"></path></svg><span>Ver perfil</span></button>' +
          '<div class="friend-more-wrap"><button class="friend-more-button" data-friend-menu-button="' + escapeHTML(friend.id) + '" type="button"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg></button><div class="friend-more-menu ' + (friendsUIState.menuFriendId === friend.id ? '' : 'hidden') + '" data-friend-menu="' + escapeHTML(friend.id) + '">' + menuHtml + '</div></div>' +
        '</div></div>';
    }).join('');
  }

  renderRadminPanel();
}

function getDetectedNetworkUsers() {
  const online = lastRealtimeState?.onlineFriends || [];
  const existingNames = new Set(socialFriends.map(friend => String(friend.name || '').trim().toLowerCase()));
  const existingUsers = new Set(socialFriends.map(friend => String(friend.username || '').trim().toLowerCase()));
  return online.filter(friend => {
    const name = String(friend.name || '').trim().toLowerCase();
    if (!name) return false;
    if (currentUser && name === String(currentUser.username || '').trim().toLowerCase()) return false;
    return !existingNames.has(name) && !existingUsers.has(name);
  }).map(friend => ({
    id: 'detected-' + String(friend.id || friend.name).replace(/[^a-z0-9-_]/gi, '-').toLowerCase(),
    name: friend.name,
    username: friend.name,
    avatar: friend.avatar || null,
    about: 'Usuário detectado na sua rede Radmin.',
    state: friend.state || 'available',
    relation: 'network'
  }));
}

function renderRadminPanel() {
  const panel = document.getElementById('radminPeoplePanel');
  if (!panel) return;
  const users = getDetectedNetworkUsers();

  if (!users.length) {
    panel.innerHTML = '<div class="radmin-empty-state"><div class="radmin-empty-icon search-guide-icon"><span class="search-guide-ring outer"></span><span class="search-guide-ring inner"></span><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 5 5"></path></svg></div><strong>Ninguém detectado na rede</strong><div class="sub">Rede Radmin indisponível</div><p>Use o botão no canto superior direito para atualizar e detectar usuários na rede.</p></div>';
    return;
  }

  panel.innerHTML = users.map(user => '<div class="network-user-card">' +
    renderAvatarMarkup(user, true) +
    '<div class="friend-main-copy"><strong>' + escapeHTML(user.name) + '</strong><div class="friend-secondary-line"><span class="friend-status-dot ' + escapeHTML(friendStateClass(user)) + '"></span><span class="friend-status-label ' + escapeHTML(friendStateClass(user)) + '">' + escapeHTML(friendStatusLabel(user)) + '</span></div><small>' + escapeHTML(user.about) + '</small></div>' +
    '<div class="network-user-actions"><button class="social-primary-button" data-add-network-friend="' + escapeHTML(user.id) + '" type="button">Adicionar amigo</button></div></div>').join('');
}

function openFriendProfile(friendId) {
  const friend = socialFriends.find(item => item.id === friendId);
  if (!friend) return;
  friendsUIState.selectedFriendId = friendId;
  const wrap = document.getElementById('friendProfileAvatarWrap');
  wrap.innerHTML = friend.avatar
    ? '<img src="' + escapeHTML(friend.avatar) + '" alt="">'
    : '<span class="dynamic-avatar">' + escapeHTML(initials(friend.name)) + '</span>';
  document.getElementById('friendProfileName').textContent = friend.name;
  document.getElementById('friendProfileStatus').textContent = friendStatusLabel(friend);
  document.getElementById('friendProfileStatus').className = `friend-profile-status ${friendStateClass(friend)}`;
  document.getElementById('friendProfileRelation').textContent = relationLabel(friend.relation);
  document.getElementById('friendProfileUsername').textContent = '@' + (friend.username || friend.name);
  document.getElementById('friendProfileAbout').textContent = friend.about || 'Sem descrição no momento.';
  document.getElementById('friendProfileModal').classList.remove('hidden');
}

function closeFriendProfile() {
  document.getElementById('friendProfileModal').classList.add('hidden');
}

function openAddFriendModal() {
  document.getElementById('addFriendModal').classList.remove('hidden');
  friendsUIState.addSearch = '';
  document.getElementById('addFriendSearchInput').value = '';
  renderAddFriendModal();
}

function closeAddFriendModal() {
  document.getElementById('addFriendModal').classList.add('hidden');
}

function openRadminGuideModal() {
  document.getElementById('radminGuideModal').classList.remove('hidden');
}

function closeRadminGuideModal() {
  document.getElementById('radminGuideModal').classList.add('hidden');
}

function renderAddFriendModal() {
  const results = document.getElementById('addFriendResults');
  if (!results) return;
  const query = friendsUIState.addSearch.trim().toLowerCase();
  const detected = getDetectedNetworkUsers().filter(friend => {
    if (!query) return true;
    return [friend.name, friend.username].some(value => String(value || '').toLowerCase().includes(query));
  });

  if (!detected.length) {
    results.innerHTML = '<div class="radmin-empty-state add-friend-empty-state"><div class="radmin-empty-icon person-guide-icon"><span class="person-guide-ring outer"></span><span class="person-guide-ring middle"></span><span class="person-guide-ring inner"></span><span class="person-guide-spark s1"></span><span class="person-guide-spark s2"></span><span class="person-guide-spark s3"></span><span class="person-guide-spark s4"></span><svg viewBox="0 0 64 64"><circle cx="32" cy="24" r="6"></circle><path d="M20 44c1.1-7.8 5.2-11.8 12-11.8S42.9 36.2 44 44"></path></svg></div><strong>Rede Radmin indisponível</strong><div class="sub">Ninguém encontrado.</div><p>Quando outro ESTUDEX aparecer na rede, ele será listado aqui.</p></div>';
    return;
  }

  results.innerHTML = detected.map(friend => '<div class="network-user-card">' +
    renderAvatarMarkup(friend, true) +
    '<div class="friend-main-copy"><strong>' + escapeHTML(friend.name) + '</strong><div class="friend-secondary-line"><span class="friend-status-dot ' + escapeHTML(friendStateClass(friend)) + '"></span><span class="friend-status-label ' + escapeHTML(friendStateClass(friend)) + '">' + escapeHTML(friendStatusLabel(friend)) + '</span></div><small>Disponível na mesma rede.</small></div>' +
    '<div class="network-user-actions"><button class="social-primary-button" data-invite-detected="' + escapeHTML(friend.id) + '" type="button">Enviar convite</button></div></div>').join('');
}

function addDetectedUserAsFriend(detectedId, pending = true) {
  const detected = getDetectedNetworkUsers().find(item => item.id === detectedId);
  if (!detected) {
    showToast('Nenhum usuário detectado no momento.');
    return;
  }
  socialFriends.unshift({
    id: 'friend-' + detectedId,
    name: detected.name,
    username: detected.username,
    avatar: detected.avatar,
    state: detected.state,
    about: detected.about,
    relation: pending ? 'pending' : 'friend'
  });
  saveSocialFriends();
  renderFriendsPage();
  renderAddFriendModal();
  showToast(pending ? 'Convite enviado para ' + detected.name + '.' : detected.name + ' adicionado aos amigos.');
}

function handleFriendAction(action, friendId) {
  const idx = socialFriends.findIndex(item => item.id === friendId);
  if (idx === -1) return;
  if (action === 'block') {
    socialFriends[idx].relation = 'blocked';
    showToast('Usuário bloqueado.');
  } else if (action === 'unblock') {
    socialFriends[idx].relation = 'friend';
    showToast('Usuário desbloqueado.');
  } else if (action === 'remove') {
    const name = socialFriends[idx].name;
    socialFriends.splice(idx, 1);
    showToast(name + ' removido da sua lista.');
  }
  friendsUIState.menuFriendId = null;
  saveSocialFriends();
  renderFriendsPage();
}

function openMessageToFriend(friendId) {
  const friend = socialFriends.find(item => item.id === friendId);
  if (!friend) return;
  openInboxConversation(friend);
}

function initFriendsFeature() {
  document.getElementById('friendsSearchInput')?.addEventListener('input', event => {
    friendsUIState.search = event.target.value || '';
    renderFriendsPage();
  });

  document.querySelectorAll('.friends-tab').forEach(button => {
    button.addEventListener('click', () => {
      friendsUIState.tab = button.dataset.friendsTab;
      renderFriendsPage();
    });
  });

  document.getElementById('openAddFriendModal')?.addEventListener('click', openAddFriendModal);
  document.getElementById('closeAddFriendModal')?.addEventListener('click', closeAddFriendModal);
  document.getElementById('addFriendSearchInput')?.addEventListener('input', event => {
    friendsUIState.addSearch = event.target.value || '';
    renderAddFriendModal();
  });

  document.getElementById('refreshRadminUsers')?.addEventListener('click', () => {
    syncFriendPresence();
    renderFriendsPage();
    renderAddFriendModal();
    showToast('Rede Radmin atualizada.');
  });

  document.getElementById('closeFriendProfileModal')?.addEventListener('click', closeFriendProfile);
  document.getElementById('friendProfileCloseButton')?.addEventListener('click', closeFriendProfile);
  document.getElementById('friendProfileMessageButton')?.addEventListener('click', () => {
    if (!friendsUIState.selectedFriendId) return;
    openMessageToFriend(friendsUIState.selectedFriendId);
  });

  document.getElementById('closeRadminGuideModal')?.addEventListener('click', closeRadminGuideModal);
  document.getElementById('closeRadminGuideFooter')?.addEventListener('click', closeRadminGuideModal);
  document.getElementById('radminRefreshFromGuide')?.addEventListener('click', () => {
    closeRadminGuideModal();
    syncFriendPresence();
    renderFriendsPage();
    showToast('Tentando detectar usuários na rede.');
  });

  document.getElementById('friendsListPanel')?.addEventListener('click', event => {
    const messageBtn = event.target.closest('[data-friend-message]');
    const profileBtn = event.target.closest('[data-friend-profile]');
    const menuBtn = event.target.closest('[data-friend-menu-button]');
    const actionBtn = event.target.closest('[data-friend-action]');
    if (messageBtn) {
      openMessageToFriend(messageBtn.dataset.friendMessage);
      return;
    }
    if (profileBtn) {
      openFriendProfile(profileBtn.dataset.friendProfile);
      return;
    }
    if (menuBtn) {
      friendsUIState.menuFriendId = friendsUIState.menuFriendId === menuBtn.dataset.friendMenuButton ? null : menuBtn.dataset.friendMenuButton;
      document.getElementById('friendMenuBackdrop').classList.toggle('hidden', !friendsUIState.menuFriendId);
      renderFriendsPage();
      return;
    }
    if (actionBtn) {
      handleFriendAction(actionBtn.dataset.friendAction, actionBtn.dataset.friendId);
      document.getElementById('friendMenuBackdrop').classList.add('hidden');
    }
  });

  document.getElementById('radminPeoplePanel')?.addEventListener('click', event => {
    const addBtn = event.target.closest('[data-add-network-friend]');
    if (addBtn) {
      addDetectedUserAsFriend(addBtn.dataset.addNetworkFriend, false);
      return;
    }

    if (event.target.closest('#openRadminGuideButton')) {
      openRadminGuideModal();
      return;
    }
    if (event.target.closest('#retryRadminDetectionButton')) {
      syncFriendPresence();
      renderFriendsPage();
      showToast('Procurando pessoas na rede...');
    }
  });

  document.getElementById('addFriendResults')?.addEventListener('click', event => {
    const inviteBtn = event.target.closest('[data-invite-detected]');
    if (inviteBtn) {
      addDetectedUserAsFriend(inviteBtn.dataset.inviteDetected, true);
      return;
    }
    // A atualização/configuração da rede agora é feita pelo botão do canto superior direito.

  });

  document.getElementById('friendMenuBackdrop')?.addEventListener('click', () => {
    friendsUIState.menuFriendId = null;
    document.getElementById('friendMenuBackdrop').classList.add('hidden');
    renderFriendsPage();
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.friend-more-wrap')) {
      if (friendsUIState.menuFriendId) {
        friendsUIState.menuFriendId = null;
        document.getElementById('friendMenuBackdrop').classList.add('hidden');
        renderFriendsPage();
      }
    }
  });
}

initFriendsFeature();
renderFriendsPage();


/* =========================================================
   V10 — CAIXA DE ENTRADA / MENSAGENS DIRETAS
========================================================= */
const INBOX_STORAGE_KEY = "estudex-inbox-v10";
const inboxState = {
  activePeerKey: null,
  search: ""
};
let inboxThreads = loadInboxThreads();

function normalizePeerKey(value) {
  return String(value || "").trim().toLowerCase();
}

function loadInboxThreads() {
  try {
    const raw = localStorage.getItem(INBOX_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    // Migra automaticamente conversas salvas por versões antigas.
    // Algumas builds usavam a chave original (ex.: "OIE") no objeto,
    // mas o card da conversa já trabalhava com peerKey normalizado ("oie").
    // Isso fazia a linha ficar selecionada sem o painel conseguir abrir a DM.
    const normalized = {};

    Object.entries(parsed).forEach(([storageKey, value]) => {
      if (!value || typeof value !== "object") return;

      const username = value.username || value.name || storageKey;
      const peerKey = normalizePeerKey(value.peerKey || username || storageKey);
      if (!peerKey) return;

      const previous = normalized[peerKey] || {};
      const previousMessages = Array.isArray(previous.messages) ? previous.messages : [];
      const incomingMessages = Array.isArray(value.messages) ? value.messages : [];
      const messageMap = new Map();

      [...previousMessages, ...incomingMessages].forEach(message => {
        if (!message || typeof message !== "object") return;
        const key = message.id || [message.from, message.to, message.createdAt, message.text].join("|");
        messageMap.set(key, message);
      });

      normalized[peerKey] = {
        ...previous,
        ...value,
        peerKey,
        username,
        name: value.name || previous.name || username,
        avatar: value.avatar || previous.avatar || null,
        state: value.state || previous.state || "offline",
        about: value.about || previous.about || "",
        messages: Array.from(messageMap.values()).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)),
        unread: Math.max(Number(previous.unread || 0), Number(value.unread || 0)),
        updatedAt: Math.max(Number(previous.updatedAt || 0), Number(value.updatedAt || 0), Date.now())
      };
    });

    localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return {};
  }
}

function saveInboxThreads() {
  try {
    localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(inboxThreads));
  } catch {}
}

function findSocialFriendByPeer(peer) {
  const key = normalizePeerKey(peer);
  return socialFriends.find(friend => {
    return normalizePeerKey(friend.username) === key || normalizePeerKey(friend.name) === key;
  }) || null;
}

function ensureInboxThread(contact) {
  if (!contact) return null;
  const username = contact.username || contact.name;
  const peerKey = normalizePeerKey(username);
  if (!peerKey) return null;

  const existing = inboxThreads[peerKey] || {};
  inboxThreads[peerKey] = {
    peerKey,
    username,
    name: contact.name || username,
    avatar: contact.avatar || existing.avatar || null,
    state: contact.state || existing.state || "offline",
    about: contact.about || existing.about || "",
    messages: Array.isArray(existing.messages) ? existing.messages : [],
    unread: Number(existing.unread || 0),
    updatedAt: Number(existing.updatedAt || Date.now())
  };
  saveInboxThreads();
  return inboxThreads[peerKey];
}

function formatInboxTime(timestamp) {
  const date = new Date(Number(timestamp || Date.now()));
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function inboxAvatarStyle(avatar) {
  return avatar ? `style="background-image:url('${escapeHTML(avatar)}')"` : "";
}

function inboxPeerPresence(thread) {
  const friend = findSocialFriendByPeer(thread.username) || findSocialFriendByPeer(thread.name);

  if (friend) {
    const state = friendStateClass(friend) || "offline";
    return {
      state,
      label: friendStatusLabel(friend)
    };
  }

  const online = (lastRealtimeState?.onlineFriends || []).find(item => {
    const itemName = normalizePeerKey(item.name);
    const itemUsername = normalizePeerKey(item.username || item.name);
    const threadName = normalizePeerKey(thread.name);
    const threadUsername = normalizePeerKey(thread.username);
    return itemName === threadName || itemName === threadUsername || itemUsername === threadUsername;
  });

  if (online) {
    const state = friendStateClass({ state: online.state || online.status || "available" }) || "available";
    return {
      state,
      label: friendStatusLabel({ state })
    };
  }

  return {
    state: "offline",
    label: "Offline"
  };
}

function syncInboxThreadContacts() {
  let changed = false;

  Object.values(inboxThreads || {}).forEach(thread => {
    if (!thread) return;

    const friend = findSocialFriendByPeer(thread.username) || findSocialFriendByPeer(thread.name);
    if (!friend) return;

    const nextName = friend.name || friend.username || thread.name;
    const nextUsername = friend.username || friend.name || thread.username;
    const nextAvatar = friend.avatar || null;
    const nextState = friend.state || "offline";
    const nextAbout = friend.about || thread.about || "";

    if (thread.name !== nextName) {
      thread.name = nextName;
      changed = true;
    }
    if (thread.username !== nextUsername) {
      thread.username = nextUsername;
      changed = true;
    }
    if ((thread.avatar || null) !== nextAvatar) {
      thread.avatar = nextAvatar;
      changed = true;
    }
    if ((thread.state || "offline") !== nextState) {
      thread.state = nextState;
      changed = true;
    }
    if ((thread.about || "") !== nextAbout) {
      thread.about = nextAbout;
      changed = true;
    }
  });

  if (changed) saveInboxThreads();
}

function getSortedInboxThreads() {
  const search = inboxState.search.trim().toLowerCase();
  return Object.values(inboxThreads)
    .filter(thread => {
      if (!search) return true;
      return [thread.name, thread.username].some(value => String(value || "").toLowerCase().includes(search));
    })
    .sort((a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function renderInboxThreadList() {
  const panel = document.getElementById("inboxThreadList");
  if (!panel) return;
  syncInboxThreadContacts();
  const threads = getSortedInboxThreads();
  if (!threads.length) {
    panel.innerHTML = `<div class="inbox-list-empty"><svg viewBox="0 0 24 24"><path d="M4 6h16v10a2 2 0 0 1-2 2H9l-5 4V8a2 2 0 0 1 2-2z"></path></svg><strong>Nenhuma conversa</strong><span>As conversas reais vão aparecer aqui.</span></div>`;
    return;
  }
  panel.innerHTML = threads.map(thread => {
    const last = thread.messages?.[thread.messages.length - 1];
    const preview = last?.text || "Conversa iniciada";
    const avatarText = thread.avatar ? "" : escapeHTML(initials(thread.name));
    return `<button class="inbox-thread-item ${inboxState.activePeerKey === thread.peerKey ? "active" : ""}" data-inbox-peer="${escapeHTML(thread.peerKey)}" type="button">
      <span class="inbox-thread-avatar" ${inboxAvatarStyle(thread.avatar)}>${avatarText}</span>
      <span class="inbox-thread-copy">
        <span class="inbox-thread-top"><strong>${escapeHTML(thread.name)}</strong><span class="inbox-thread-time">${last ? formatInboxTime(last.createdAt) : ""}</span></span>
        <span class="inbox-thread-preview">${escapeHTML(preview)}</span>
      </span>
      ${thread.unread ? `<span class="inbox-unread-badge">${thread.unread}</span>` : ""}
    </button>`;
  }).join("");
}

function renderInboxMessages(thread) {
  const list = document.getElementById("inboxMessageList");
  if (!list) return;
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  if (!messages.length) {
    list.innerHTML = `<div class="inbox-list-empty" style="min-height:100%;"><strong>Comece a conversa</strong><span>Envie a primeira mensagem para ${escapeHTML(thread.name)}.</span></div>`;
    return;
  }
  list.innerHTML = messages.map(message => {
    const mine = normalizePeerKey(message.from) === normalizePeerKey(currentUser?.username);
    const avatar = mine ? currentUser?.avatar : thread.avatar;
    const name = mine ? currentUser?.username : thread.name;
    return `<div class="inbox-message-row ${mine ? "mine" : "theirs"}">
      <span class="inbox-message-avatar" ${inboxAvatarStyle(avatar)}>${avatar ? "" : escapeHTML(initials(name))}</span>
      <div class="inbox-message-bubble">${escapeHTML(message.text)}<span class="inbox-message-meta">${formatInboxTime(message.createdAt)}${mine && message.delivered === false ? " · enviado" : ""}</span></div>
    </div>`;
  }).join("");
  list.scrollTop = list.scrollHeight;
}

function resolveInboxThread(peerKey) {
  const normalizedKey = normalizePeerKey(peerKey);
  if (!normalizedKey) return null;

  if (inboxThreads[normalizedKey]) {
    return inboxThreads[normalizedKey];
  }

  const legacyEntry = Object.entries(inboxThreads).find(([storageKey, thread]) => {
    return normalizePeerKey(storageKey) === normalizedKey || normalizePeerKey(thread?.peerKey) === normalizedKey || normalizePeerKey(thread?.username) === normalizedKey;
  });

  if (!legacyEntry) return null;

  const [legacyStorageKey, thread] = legacyEntry;
  thread.peerKey = normalizedKey;
  inboxThreads[normalizedKey] = thread;

  if (legacyStorageKey !== normalizedKey) {
    delete inboxThreads[legacyStorageKey];
  }

  saveInboxThreads();
  return thread;
}

function activateInboxThread(peerKey) {
  const thread = resolveInboxThread(peerKey);
  if (!thread) {
    showToast("Não foi possível abrir esta conversa.");
    renderInboxPage();
    return false;
  }

  inboxState.activePeerKey = thread.peerKey;
  thread.unread = 0;
  thread.updatedAt = Math.max(Number(thread.updatedAt || 0), Date.now());
  saveInboxThreads();
  renderInboxPage();
  updateHomeNotificationBadge();

  requestAnimationFrame(() => {
    document.getElementById("inboxMessageInput")?.focus();
  });

  return true;
}

function renderInboxPage() {
  const activeChat = document.getElementById("inboxActiveChat");
  const empty = document.getElementById("inboxEmptyState");
  if (!activeChat || !empty) return;

  syncInboxThreadContacts();
  renderInboxThreadList();
  const thread = inboxState.activePeerKey ? resolveInboxThread(inboxState.activePeerKey) : null;
  if (!thread) {
    activeChat.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  thread.unread = 0;
  saveInboxThreads();
  empty.classList.add("hidden");
  activeChat.classList.remove("hidden");

  const avatarEl = document.getElementById("inboxPeerAvatar");
  avatarEl.textContent = thread.avatar ? "" : initials(thread.name);
  avatarEl.style.backgroundImage = thread.avatar ? `url("${thread.avatar}")` : "none";
  document.getElementById("inboxPeerName").textContent = thread.name;
  const presence = inboxPeerPresence(thread);
  const statusEl = document.getElementById("inboxPeerStatus");
  statusEl.textContent = presence.label;
  statusEl.className = `inbox-peer-status ${presence.state}`;
  statusEl.style.color = statusColorForState(presence.state);
  renderInboxMessages(thread);
  renderInboxThreadList();
}

function openInboxConversation(contact) {
  const thread = ensureInboxThread(contact);
  if (!thread) return;
  showPage("inbox");
  activateInboxThread(thread.peerKey);
}

function addInboxMessage(message) {
  const me = normalizePeerKey(currentUser?.username);
  const from = normalizePeerKey(message.from);
  const to = normalizePeerKey(message.to);
  const peerKey = from === me ? to : from;
  if (!peerKey) return;

  const friend = findSocialFriendByPeer(peerKey);
  const thread = ensureInboxThread(friend || {
    username: peerKey,
    name: message.fromName || message.toName || message.from || message.to,
    avatar: from === me ? message.toAvatar : message.fromAvatar,
    state: "available",
    about: ""
  });
  if (!thread) return;

  if (thread.messages.some(item => item.id === message.id)) return;
  thread.messages.push(message);
  thread.messages = thread.messages.slice(-300);
  thread.updatedAt = Number(message.createdAt || Date.now());
  const inboxIsVisible = document.body.dataset.currentPage === "inbox" && inboxState.activePeerKey === peerKey;
  if (from !== me && !inboxIsVisible) thread.unread = Number(thread.unread || 0) + 1;
  saveInboxThreads();
  renderInboxPage();
}

function sendInboxMessage() {
  const input = document.getElementById("inboxMessageInput");
  const thread = inboxState.activePeerKey ? inboxThreads[inboxState.activePeerKey] : null;
  if (!input || !thread) return;
  const text = input.value.trim();
  if (!text) return;
  socket.emit("dm:send", { to: thread.username, text });
  input.value = "";
  document.getElementById("inboxEmojiPicker")?.classList.add("hidden");
}

function openInboxPeerProfile() {
  const thread = inboxState.activePeerKey ? inboxThreads[inboxState.activePeerKey] : null;
  if (!thread) return;
  const friend = findSocialFriendByPeer(thread.username) || {
    id: "inbox-peer-" + thread.peerKey,
    name: thread.name,
    username: thread.username,
    avatar: thread.avatar,
    state: thread.state || "offline",
    about: thread.about || "Sem descrição no momento.",
    relation: "friend"
  };

  const wrap = document.getElementById("friendProfileAvatarWrap");
  wrap.innerHTML = friend.avatar ? `<img src="${escapeHTML(friend.avatar)}" alt="">` : `<span class="dynamic-avatar">${escapeHTML(initials(friend.name))}</span>`;
  document.getElementById("friendProfileName").textContent = friend.name;
  document.getElementById("friendProfileStatus").textContent = friendStatusLabel(friend);
  document.getElementById("friendProfileRelation").textContent = relationLabel(friend.relation);
  document.getElementById("friendProfileUsername").textContent = "@" + (friend.username || friend.name);
  document.getElementById("friendProfileAbout").textContent = friend.about || "Sem descrição no momento.";
  friendsUIState.selectedFriendId = friend.id;
  document.getElementById("friendProfileModal").classList.remove("hidden");
}

function initInboxFeature() {
  document.getElementById("inboxSearchInput")?.addEventListener("input", event => {
    inboxState.search = event.target.value || "";
    renderInboxThreadList();
  });
  document.getElementById("inboxThreadList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-inbox-peer]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    activateInboxThread(button.dataset.inboxPeer);
  });
  document.getElementById("inboxSendButton")?.addEventListener("click", sendInboxMessage);
  document.getElementById("inboxMessageInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") sendInboxMessage();
  });
  document.getElementById("inboxEmojiButton")?.addEventListener("click", () => {
    document.getElementById("inboxEmojiPicker")?.classList.toggle("hidden");
  });
  document.querySelectorAll("#inboxEmojiPicker button").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById("inboxMessageInput");
      if (!input) return;
      input.value += button.textContent;
      input.focus();
      document.getElementById("inboxEmojiPicker")?.classList.add("hidden");
    });
  });
  document.getElementById("inboxVoiceMessageButton")?.addEventListener("click", () => showToast("Gravação de voz da conversa preparada para a próxima etapa."));
  document.getElementById("inboxVoiceCallButton")?.addEventListener("click", () => {
    const thread = inboxThreads[inboxState.activePeerKey];
    if (thread) showToast("Iniciando chamada de voz com " + thread.name + ".");
  });
  document.getElementById("inboxShareButton")?.addEventListener("click", () => {
    const thread = inboxThreads[inboxState.activePeerKey];
    if (thread) showToast("Preparando compartilhamento de tela com " + thread.name + ".");
  });
  document.getElementById("inboxVideoCallButton")?.addEventListener("click", () => {
    const thread = inboxThreads[inboxState.activePeerKey];
    if (thread) showToast("Iniciando chamada de vídeo com " + thread.name + ".");
  });
  document.getElementById("inboxOpenProfileButton")?.addEventListener("click", openInboxPeerProfile);

  // Fallback global: garante abertura mesmo se a lista tiver sido re-renderizada
  // por uma atualização em tempo real exatamente durante o clique.
  document.addEventListener("click", event => {
    const button = event.target.closest("#inboxThreadList [data-inbox-peer]");
    if (!button) return;
    if (inboxState.activePeerKey === normalizePeerKey(button.dataset.inboxPeer) && !document.getElementById("inboxActiveChat")?.classList.contains("hidden")) {
      return;
    }
    activateInboxThread(button.dataset.inboxPeer);
  });
}

socket.on("dm:message", message => {
  addInboxMessage(message);
  updateHomeNotificationBadge();
  if (normalizePeerKey(message.from) !== normalizePeerKey(currentUser?.username)) {
    renderHomeNotifications();
  }
});

socket.on("dm:error", payload => {
  showToast(payload?.message || "Não foi possível enviar a mensagem.");
});

initInboxFeature();
renderInboxPage();


/* =========================================================
   V10.2 — PESQUISA / NOTIFICAÇÕES / PERFIL NA HOME
========================================================= */
function getUnreadInboxCount() {
  return Object.values(inboxThreads || {}).reduce((total, thread) => total + Number(thread.unread || 0), 0);
}

function updateHomeNotificationBadge() {
  const badge = document.getElementById("homeNotificationCount");
  if (!badge) return;
  const count = getUnreadInboxCount();
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.classList.toggle("hidden", count <= 0);
}

function buildHomeSearchResults(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const results = [];
  const seen = new Set();

  const add = item => {
    const key = `${item.type}:${item.key}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  };

  (lastRealtimeState?.liveRooms || []).forEach(room => {
    const haystack = `${room.title || ""} ${room.owner || ""} ${room.code || ""}`.toLowerCase();
    if (haystack.includes(q)) add({type:"room", key:room.code, name:room.title || "Sala", subtitle:`Sala ao vivo · #${room.code || ""}`, code:room.code});
  });

  (lastRealtimeState?.recentRooms || []).forEach(room => {
    const haystack = `${room.title || ""} ${room.subtitle || ""} ${room.code || ""}`.toLowerCase();
    if (haystack.includes(q)) add({type:"room", key:room.code, name:room.title || "Sala", subtitle:`Sala recente · #${room.code || ""}`, code:room.code});
  });

  (socialFriends || []).forEach(friend => {
    const haystack = `${friend.name || ""} ${friend.username || ""}`.toLowerCase();
    if (haystack.includes(q)) add({type:"friend", key:friend.id, name:friend.name || friend.username, subtitle:friendStatusLabel(friend), avatar:friend.avatar || null, friendId:friend.id});
  });

  Object.values(inboxThreads || {}).forEach(thread => {
    const haystack = `${thread.name || ""} ${thread.username || ""}`.toLowerCase();
    if (haystack.includes(q)) add({type:"conversation", key:thread.peerKey, name:thread.name || thread.username, subtitle:"Conversa na Caixa de entrada", avatar:thread.avatar || null, peerKey:thread.peerKey});
  });

  return results.slice(0, 16);
}

function searchResultIcon(type) {
  if (type === "room") return `<span class="home-result-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M8 21h8"></path><path d="M12 19v2"></path></svg></span>`;
  return "";
}

function renderHomeGlobalSearch() {
  const input = document.getElementById("homeGlobalSearchInput");
  const panel = document.getElementById("homeGlobalSearchResults");
  if (!input || !panel) return;
  const query = input.value || "";
  const results = buildHomeSearchResults(query);

  if (!query.trim()) {
    panel.innerHTML = `<div class="home-search-empty"><strong>O que você procura?</strong><span>Busque por uma sala, amigo ou conversa real.</span></div>`;
    return;
  }
  if (!results.length) {
    panel.innerHTML = `<div class="home-search-empty"><strong>Nada encontrado</strong><span>Nenhum resultado corresponde à sua busca.</span></div>`;
    return;
  }

  panel.innerHTML = results.map(item => {
    const avatar = item.avatar
      ? `<span class="home-result-avatar"><img src="${escapeHTML(item.avatar)}" alt=""></span>`
      : item.type === "room"
      ? searchResultIcon(item.type)
      : `<span class="home-result-avatar">${escapeHTML(initials(item.name))}</span>`;
    return `<button class="home-search-result" type="button" data-search-type="${escapeHTML(item.type)}" data-search-key="${escapeHTML(item.key)}">${avatar}<span class="home-result-copy"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.subtitle || "")}</span></span></button>`;
  }).join("");
}

function renderHomeNotifications() {
  const panel = document.getElementById("homeNotificationsList");
  if (!panel) return;
  const threads = Object.values(inboxThreads || {})
    .filter(thread => Number(thread.unread || 0) > 0)
    .sort((a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

  updateHomeNotificationBadge();

  if (!threads.length) {
    panel.innerHTML = `<div class="home-notifications-empty"><strong>Nenhuma notificação</strong><span>Quando chegar uma mensagem nova, ela aparece aqui.</span></div>`;
    return;
  }

  panel.innerHTML = threads.map(thread => {
    const avatar = thread.avatar
      ? `<span class="home-result-avatar"><img src="${escapeHTML(thread.avatar)}" alt=""></span>`
      : `<span class="home-result-avatar">${escapeHTML(initials(thread.name))}</span>`;
    const last = Array.isArray(thread.messages) && thread.messages.length ? thread.messages[thread.messages.length - 1] : null;
    return `<button class="home-notification-item" type="button" data-notification-peer="${escapeHTML(thread.peerKey)}">${avatar}<span class="home-result-copy"><strong>${escapeHTML(thread.name)}</strong><span>${escapeHTML(last?.text || "Nova mensagem")}</span></span><span class="inbox-unread-badge">${Number(thread.unread || 0)}</span></button>`;
  }).join("");
}

function closeHomeSearchModal() {
  document.getElementById("homeSearchModal")?.classList.add("hidden");
}

function closeHomeNotificationsModal() {
  document.getElementById("homeNotificationsModal")?.classList.add("hidden");
}

function initHomeUtilityButtons() {
  document.getElementById("homeSearchButton")?.addEventListener("click", () => {
    const modal = document.getElementById("homeSearchModal");
    const input = document.getElementById("homeGlobalSearchInput");
    modal?.classList.remove("hidden");
    if (input) input.value = "";
    renderHomeGlobalSearch();
    setTimeout(() => input?.focus(), 40);
  });
  document.getElementById("closeHomeSearch")?.addEventListener("click", closeHomeSearchModal);
  document.getElementById("homeSearchModal")?.addEventListener("click", event => {
    if (event.target === document.getElementById("homeSearchModal")) closeHomeSearchModal();
  });
  document.getElementById("homeGlobalSearchInput")?.addEventListener("input", renderHomeGlobalSearch);
  document.getElementById("homeGlobalSearchResults")?.addEventListener("click", event => {
    const button = event.target.closest("[data-search-type]");
    if (!button) return;
    const type = button.dataset.searchType;
    const key = button.dataset.searchKey;
    closeHomeSearchModal();
    if (type === "room") {
      socket.emit("room:join", {code:key});
      return;
    }
    if (type === "friend") {
      showPage("friends");
      openFriendProfile(key);
      return;
    }
    if (type === "conversation") {
      inboxState.activePeerKey = key;
      const thread = inboxThreads[key];
      if (thread) thread.unread = 0;
      saveInboxThreads();
      showPage("inbox");
      renderInboxPage();
      updateHomeNotificationBadge();
    }
  });

  document.getElementById("homeNotificationsButton")?.addEventListener("click", () => {
    renderHomeNotifications();
    document.getElementById("homeNotificationsModal")?.classList.remove("hidden");
  });
  document.getElementById("closeHomeNotifications")?.addEventListener("click", closeHomeNotificationsModal);
  document.getElementById("homeNotificationsModal")?.addEventListener("click", event => {
    if (event.target === document.getElementById("homeNotificationsModal")) closeHomeNotificationsModal();
  });
  document.getElementById("homeNotificationsList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-notification-peer]");
    if (!button) return;
    const peerKey = button.dataset.notificationPeer;
    const thread = inboxThreads[peerKey];
    if (!thread) return;
    thread.unread = 0;
    inboxState.activePeerKey = peerKey;
    saveInboxThreads();
    closeHomeNotificationsModal();
    showPage("inbox");
    renderInboxPage();
    updateHomeNotificationBadge();
  });

  document.getElementById("homeProfileButton")?.addEventListener("click", () => showPage("profile"));
  updateHomeNotificationBadge();
}

initHomeUtilityButtons();
