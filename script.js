const ADMIN_PASS = "7w7";
const CIPHER_KEY = 3; 

let currentUser = null;
let isAdmin = false;
let currentChat = "group";
let isCipherActive = false;
let currentDailyCode = "";

if (!localStorage.getItem("sc_db_v2_init")) {
    localStorage.clear();
    localStorage.setItem("sc_db_v2_init", "true");
}

let db_users = JSON.parse(localStorage.getItem("sc_users")) || {};
let db_banned = JSON.parse(localStorage.getItem("sc_banned")) || {};
let db_chats = JSON.parse(localStorage.getItem("sc_chats")) || { group: [] };
let db_deleted = JSON.parse(localStorage.getItem("sc_deleted")) || {}; 
let db_config = JSON.parse(localStorage.getItem("sc_config")) || { email: "", lastCodeTime: 0, globalPass: "1914" };

window.onload = function() {
    checkDailyCode();
    
    document.getElementById("loginBtn").addEventListener("click", handleLogin);
    document.getElementById("sendBtn").addEventListener("click", sendMessage);
    document.getElementById("logoutBtn").addEventListener("click", () => { sessionStorage.removeItem("sc_session"); location.reload(); });
    document.getElementById("messageInput").addEventListener("keypress", (e) => { if(e.key === "Enter") sendMessage(); });
    document.getElementById("clearChatBtn").addEventListener("click", clearChat);
    
    document.querySelector(".close-btn").addEventListener("click", () => document.getElementById("adminPanel").style.display = "none");
    document.getElementById("adminIcon").addEventListener("click", openAdminPanel);
    document.getElementById("cipherToggleBtn").addEventListener("click", () => document.getElementById("cipherModal").style.display = "flex");

    let savedSession = sessionStorage.getItem("sc_session");
    if(savedSession) {
        let session = JSON.parse(savedSession);
        currentUser = session.user;
        isAdmin = session.isAdmin;
        showChatScreen();
    }
};

function copyToClipboard(text) {
    if(!text) return;
    navigator.clipboard.writeText(text).then(() => {
        alert("Copied: " + text);
    }).catch(err => {
        alert("Failed to copy");
    });
}

function checkDailyCode() {
    let now = Date.now();
    if(now - db_config.lastCodeTime > 86400000 || !db_config.lastCodeTime) {
        currentDailyCode = Math.floor(1000 + Math.random() * 9000).toString();
        db_config.lastCodeTime = now;
        db_config.dailyCode = currentDailyCode;
        localStorage.setItem("sc_config", JSON.stringify(db_config));
        if(db_config.email) alert(`SIMULATED EMAIL TO ${db_config.email}:\nDaily Code: ${currentDailyCode}`);
    } else {
        currentDailyCode = db_config.dailyCode;
    }
}

function handleLogin() {
    const name = document.getElementById("loginName").value.trim();
    const pass = document.getElementById("loginPin").value.trim();
    
    if(!name && pass === ADMIN_PASS) {
        currentUser = "ADMIN";
        isAdmin = true;
        sessionStorage.setItem("sc_session", JSON.stringify({user: currentUser, isAdmin: true}));
        showChatScreen();
        return;
    }

    if(!name) { document.getElementById("loginMsg").innerText = "Name required."; return; }
    
    if(db_banned[name] && Date.now() < db_banned[name]) {
        let minsLeft = Math.ceil((db_banned[name] - Date.now()) / 60000);
        document.getElementById("loginMsg").innerText = `You are banned for ${minsLeft} more minutes.`;
        return;
    }

    if(db_users[name] && db_users[name] === pass) {
        currentUser = name;
        isAdmin = false;
        sessionStorage.setItem("sc_session", JSON.stringify({user: currentUser, isAdmin: false}));
        showChatScreen();
    } 
    else if (!db_users[name] && pass === db_config.globalPass) {
        db_users[name] = pass;
        localStorage.setItem("sc_users", JSON.stringify(db_users));
        currentUser = name;
        isAdmin = false;
        sessionStorage.setItem("sc_session", JSON.stringify({user: currentUser, isAdmin: false}));
        showChatScreen();
    } 
    else {
        document.getElementById("loginMsg").innerText = "Incorrect Access Password.";
    }
}

function showChatScreen() {
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("chatApp").classList.add("active");
    
    document.getElementById("myNameDisplay").innerText = currentUser;
    document.getElementById("myPinDisplay").innerText = isAdmin ? "System Administrator" : "User Access Granted";
    
    if(isAdmin) document.getElementById("adminIcon").style.display = "block";
    
    loadContacts();
    switchChat("group", "Group Chat");
}

function openAdminPanel() {
    document.getElementById("adminEmail").value = db_config.email || "";
    document.getElementById("adminDailyCode").innerText = currentDailyCode;
    document.getElementById("newGlobalPass").value = db_config.globalPass;
    
    const list = document.getElementById("userManagementList");
    list.innerHTML = "";
    
    let hasUsers = false;
    for(let user in db_users) {
        hasUsers = true;
        let div = document.createElement("div");
        div.className = "user-item";
        div.innerHTML = `<span>${user}</span>
            <div>
                <button class="btn-ban" onclick="banUser('${user}')">Ban 5m</button>
                <button class="btn-delete" onclick="deleteUser('${user}')">Del</button>
            </div>`;
        list.appendChild(div);
    }
    
    if(!hasUsers) list.innerHTML = "<p style='color:#888; font-size:12px;'>No users found.</p>";
    
    loadSpyOptions();
    document.getElementById("adminPanel").style.display = "flex";
}

function changeGlobalPass() {
    let newPass = document.getElementById("newGlobalPass").value.trim();
    if(newPass.length > 0) {
        db_config.globalPass = newPass;
        localStorage.setItem("sc_config", JSON.stringify(db_config));
        alert("Global Access Password updated!");
    }
}

function loadSpyOptions() {
    let select = document.getElementById("adminSpySelect");
    select.innerHTML = '<option value="">-- Select a Chat --</option>';
    select.innerHTML += `<option value="group">Group Chat</option>`;
    
    let users = Object.keys(db_users);
    for(let i=0; i<users.length; i++) {
        for(let j=i+1; j<users.length; j++) {
            let u1 = users[i];
            let u2 = users[j];
            let key = u1 < u2 ? u1 + "_" + u2 : u2 + "_" + u1;
            if(db_chats[key] && db_chats[key].length > 0) {
                select.innerHTML += `<option value="${key}">${u1} & ${u2}</option>`;
            }
        }
    }
}

function loadSpyChat() {
    let chatId = document.getElementById("adminSpySelect").value;
    let area = document.getElementById("adminSpyArea");
    area.innerHTML = "";
    if(!chatId) return;
    
    let messages = db_chats[chatId] || [];
    messages.forEach(msg => {
        let p = document.createElement("p");
        p.style.marginBottom = "5px";
        p.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
        area.appendChild(p);
    });
    area.scrollTop = area.scrollHeight;
}

function saveEmail() {
    db_config.email = document.getElementById("adminEmail").value.trim();
    localStorage.setItem("sc_config", JSON.stringify(db_config));
    alert("Email saved.");
}

function deleteUser(name) {
    if(confirm(`Delete user ${name}?`)) {
        delete db_users[name];
        localStorage.setItem("sc_users", JSON.stringify(db_users));
        openAdminPanel();
        loadContacts();
    }
}

function banUser(name) {
    let mins = prompt(`Ban ${name} for how many minutes?`, "5");
    if(mins && !isNaN(mins)) {
        db_banned[name] = Date.now() + (mins * 60000);
        localStorage.setItem("sc_banned", JSON.stringify(db_banned));
        alert(`${name} banned for ${mins} minutes.`);
    }
}

function loadContacts() {
    const container = document.getElementById("dynamicContacts");
    container.innerHTML = "";
    for(let user in db_users) {
        if(user !== currentUser) {
            let div = document.createElement("div");
            div.className = "contact";
            div.innerHTML = `<div class="avatar">${user[0]}</div><div class="info"><h4>${user}</h4></div>`;
            div.onclick = () => switchChat(user, user);
            container.appendChild(div);
        }
    }
}

function switchChat(chatId, title) {
    currentChat = chatId;
    document.getElementById("chatTitle").innerText = title;
    renderMessages();
}

function clearChat() {
    if(confirm("Are you sure you want to clear this chat?")) {
        let key = currentChat;
        if(currentChat !== "group") {
            key = currentUser < currentChat ? currentUser + "_" + currentChat : currentChat + "_" + currentUser;
        }
        if(!db_deleted[currentUser]) db_deleted[currentUser] = {};
        db_deleted[currentUser][key] = Date.now();
        localStorage.setItem("sc_deleted", JSON.stringify(db_deleted));
        renderMessages();
    }
}

function renderMessages() {
    const area = document.getElementById("messagesArea");
    area.innerHTML = "";
    let key = currentChat;
    if(currentChat !== "group") {
        key = currentUser < currentChat ? currentUser + "_" + currentChat : currentChat + "_" + currentUser;
    }
    let messages = db_chats[key] || [];
    if(db_deleted[currentUser] && db_deleted[currentUser][key]) {
        let clearTime = db_deleted[currentUser][key];
        messages = messages.filter(msg => msg.time > clearTime);
    }
    messages.forEach(msg => {
        let div = document.createElement("div");
        div.className = `message ${msg.sender === currentUser ? 'msg-mine' : 'msg-other'}`;
        div.innerHTML = `<small style="opacity:0.6; display:block; font-size:10px;">${msg.sender}</small>${msg.text}`;
        area.appendChild(div);
    });
    area.scrollTop = area.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById("messageInput");
    let text = input.value.trim();
    if(!text) return;

    let finalText = text;
    if(isCipherActive) {
        finalText = "[SECURE] " + applyCipher(text, true);
    }

    let msgObj = { sender: currentUser, text: finalText, time: Date.now() };
    let key = currentChat;
    if(currentChat !== "group") {
        key = currentUser < currentChat ? currentUser + "_" + currentChat : currentChat + "_" + currentUser;
    }
    if(!db_chats[key]) db_chats[key] = [];
    db_chats[key].push(msgObj);
    
    localStorage.setItem("sc_chats", JSON.stringify(db_chats));
    input.value = "";
    renderMessages();
}

function activateCipher() {
    let input = document.getElementById("dailyCodeInput").value;
    if(input === currentDailyCode) {
        isCipherActive = true;
        document.getElementById("cipherToggleBtn").innerText = "🔑 Cipher: ON";
        document.getElementById("cipherToggleBtn").style.background = "#00e676";
        document.getElementById("cipherToggleBtn").style.color = "#000";
        document.getElementById("cipherActiveArea").style.display = "block";
        alert("Cipher Activated!");
    } else {
        alert("Invalid Daily Code!");
    }
}

function doDecrypt() {
    let text = document.getElementById("decryptInput").value;
    document.getElementById("decryptOutput").innerText = applyCipher(text, false);
}

function applyCipher(text, isEncrypting) {
    let result = "";
    let upperText = text.toUpperCase();
    for(let i=0; i<upperText.length; i++) {
        let code = upperText.charCodeAt(i);
        if(code >= 65 && code <= 90) {
            let num = code - 65;
            let newNum;
            if (isEncrypting) {
                newNum = num + CIPHER_KEY;
            } else {
                newNum = num - CIPHER_KEY;
            }
            if(newNum > 25) newNum -= 26;
            if(newNum < 0) newNum += 26;
            result += String.fromCharCode(newNum + 65);
        } else {
            result += upperText[i];
        }
    }
    return result;
}
