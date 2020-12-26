const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { brotliCompress } = require('zlib');
const {addedVipLog, removedVipLog} = require('./logUtils');
const consts = require('./consts');

const VIP_FILE = "./data/vips.dat";

function getTodayDate(){
    let options={
        timeZone: "Europe/Rome",
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour12: false
    };
    let formatter = new Intl.DateTimeFormat("it-IT", options);
    return formatter.format(new Date());
}
/**
 * 
 * @param {string} name 
 * @param {TelegramBot} bot 
 */
function addVIP(name, bot){
    let date = getTodayDate();
    fs.appendFileSync(VIP_FILE, name+" "+date+"\n");
    addedVipLog(name);
    console.log("[VIP] "+name+" aggiunto ai VIP");
    bot.sendMessage(consts.ADMIN_CHAT_ID, "*[VIP]* "+name+" aggiunto ai VIP", {parse_mode: "Markdown"});
}
/**
 * 
 * @param {string} name 
 * @param {TelegramBot} bot 
 */
function removeVIP(name, bot){
    removeVIPs([name], bot);
}
function removeVIPs(names, bot){
    try{
        let vips = getVIPs();
        let text = "";
        let found=false;
        let vipNames = {};
        vips.forEach((vipLine)=>{
            vipNames[vipLine.split(" ")[0]]=vipLine.split(" ")[1];
        });
        names.forEach((name)=>{
            if(name in vipNames){
                found=true;
                delete vipNames[name];
                console.log("[VIP] "+name+" rimosso dai VIP");
                bot.sendMessage(consts.ADMIN_CHAT_ID, "*[VIP]* "+name+" rimosso dai VIP", {parse_mode: "Markdown"});
                removedVipLog(name);
            }
        });
        Object.keys(vipNames).forEach((vipName)=>{
            text+=vipName+" "+vipNames[vipName]+"\n";
        });
        if(found)
            fs.writeFileSync(VIP_FILE, text);
    }catch(err){
        console.error(err);
    }
}
function getVIPs(){
    try{
        let data = fs.readFileSync(VIP_FILE, "UTF-8");
        let lines = data.split("\n");
        lines.pop();
        return lines;
    }catch(err){
        console.error(err);
    }
    return null;
}
function calcDifferenceDays(subDate){
    let tp = getTodayDate().split("/");
    let op = subDate.split("/");
    let todayDate = new Date(tp[2], tp[1]-1, tp[0]);
    let oldDate = new Date(op[2], op[1]-1, op[0]);
    let diffTime = Math.abs(todayDate-oldDate);
    let diffDays = Math.floor(diffTime/(1000*60*60*24));
    return diffDays;
}
function isVIPActive(subDate){
    return (calcDifferenceDays(subDate)<=30);
}
function checkVIP(name){
    try{
        let data = fs.readFileSync(VIP_FILE, "UTF-8");
        let lines = data.split("\r\n");
        lines.pop();
        let r = [false, null];
        lines.forEach((line)=>{
            let parts = line.split(" ");
            let subDate = parts[1];
            if(parts[0]==name){r= [isVIPActive(subDate), subDate, calcDifferenceDays(subDate)]; return true;}
        });
        return r;
    }catch(err){
        console.error(err);
    }
}
/**
 * 
 * @param {TelegramBot} bot 
 */
function checkVIPs(bot){
    let vips = getVIPs();
    let toRemove = [];
    if(bot!=null)bot.sendMessage(consts.ADMIN_CHAT_ID, "*[CONTROLLO VIP]* Inizio controllo...", {parse_mode: "Markdown"});
    console.log("[CONTROLLO VIP] Inizio controllo...")
    vips.forEach((vip)=>{
        let parts = vip.split(" ");
        let name = parts[0];
        let subDate = parts[1];
        if(!isVIPActive(subDate)){
            toRemove.push(name);
        }
    });
    removeVIPs(toRemove, bot);
    if(bot!=null)bot.sendMessage(consts.ADMIN_CHAT_ID, "*[CONTROLLO VIP]* Controllo terminato ✔️", {parse_mode: "Markdown"});
    console.log("[CONTROLLO VIP] Controllo terminato...");
}
module.exports = {
    addVIP,
    removeVIP,
    checkVIP,
    getVIPs,
    checkVIPs
}