const { app, BrowserWindow, ipcMain } = require("electron");
const url = require("url");
const path = require("path");
const { WAConnection, MessageType } = require("@adiwajshing/baileys");
const storage = require("electron-json-storage");
const os = require("os");

let mainWindow;
let whatsappClient;

function listenEvents() {
  ipcMain.on("instantMessage", (event, message) => {
    console.log(message);

    message.targets.forEach((target, i) => {
      setTimeout(() => {
        whatsappClient.sendMessage(target, message.content, MessageType.text);
      }, i * 1000);
    });
  });
}

function createWindow() {
  storage.setDataPath(os.tmpdir());
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false,
      nativeWindowOpen: true,
    },
  });

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, `./dist/index.html`),
      protocol: "file:",
      slashes: true,
    })
  );
  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

async function connectToWhatsApp() {
  whatsappClient = new WAConnection();

  whatsappClient.logger.level = "warn";

  whatsappClient.on("contacts-received", () => {
    let contacts = whatsappClient.contacts;
    delete contacts["status@broadcast"];
    let mappedContacts = [];
    for (let key in contacts) {
      if (contacts[key]) {
        mappedContacts.push({
          name: contacts[key].name,
          phone: contacts[key].jid,
        });
      }
    }

    storage.set("contacts", mappedContacts, () =>
      console.log(whatsappClient.contacts)
    );
    mainWindow.webContents.send("contacts", mappedContacts);
  });

  whatsappClient.on("qr", (qr) => {
    mainWindow.webContents.send("qr", qr);
  });

  whatsappClient.on("open", () => {
    mainWindow.webContents.send("ready");
    const authInfo = whatsappClient.base64EncodedAuthInfo();
    storage.set("auth", authInfo, () => console.log("Session saved!"));
  });

  storage.has("auth", function (error, hasKey) {
    if (error) throw error;

    if (hasKey) {
      const authInfo = storage.getSync("auth");
      whatsappClient.loadAuthInfo(authInfo);
    }
  });

  await whatsappClient.connect();
}

app.on("ready", () => {
  createWindow();
  connectToWhatsApp();
  listenEvents();
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  if (mainWindow === null) createWindow();
});
