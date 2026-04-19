const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('studyai.html', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });

dom.window.document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded fired");
});

setTimeout(() => {
    console.log("toggleAuthMode:", typeof dom.window.toggleAuthMode);
    console.log("initHome:", typeof dom.window.initHome);
    console.log("Errors:", dom.window.document.errors);
}, 2000);

// We also listen to virtual console
dom.window._virtualConsole.on("jsdomError", (e) => {
    console.error("JSDOM Error:", e.message);
});
dom.window._virtualConsole.on("error", (e) => {
    console.error("JS Error:", e);
});
