const fs = require('fs');
const LOG_FILE = "./logs/log.txt";
const LOG_VIP_FILE = "./logs/logvip.txt";
function getDateString(){
    let options={
        timeZone: "Europe/Rome",
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    };
    let formatter = new Intl.DateTimeFormat("it-IT", options);
    return formatter.format(new Date());
}
function addLog(name, quantity){
    let dateString = getDateString();
    fs.appendFileSync(LOG_FILE, "["+dateString+"] "+name+" "+quantity+"\n");
}

function addedVipLog(name){
    let dateString = getDateString();
    fs.appendFileSync(LOG_VIP_FILE, "["+dateString+"] [ADDED] "+name+" aggiunto ai VIP\n");
}

function removedVipLog(name){
    let dateString = getDateString();
    fs.appendFileSync(LOG_VIP_FILE, "["+dateString+"] [REMOVED] "+name+" rimosso dai VIP\n");
}

module.exports={
    addLog,
    addedVipLog,
    removedVipLog
}