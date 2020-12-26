let TESTING = false;

const schedule = require('node-schedule');
const consts = require('./consts');
const express = require('express');
const app = express()
const port = 3000
const Telegrambot = require('node-telegram-bot-api');
const dataUtils = require('./dataUtils');
const logUtils = require('./logUtils');
const jsdom = require('jsdom');
const bot = (!TESTING?new Telegrambot(consts.BOT_TOKEN, {polling: true}):null);
const fetch = require('node-fetch');
const vipUtils = require('./vipUtils');
const crashManager = require('./crashManager');


// DATA VARIABLES

let reminder_id = -1;
let sentVIPMessages = {} // {nome: id_messaggio}
let sentDailyMessages = {};

function getVIPMessage(name, quantity, URL){
    return name+": "+quantity+" disponibili\n"+URL;
}

function getMessage(name, URL){
    return name+" disponibile ora.\n"+URL;
}

function getEsauritoMessage(name, URL){
    let options={
        timeZone: "Europe/Rome",
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    };
    let formatter = new Intl.DateTimeFormat("it-IT", options);
    let time = formatter.format(new Date());
    return name+": Esaurito alle "+time+"\n"+URL;
}


function editTelegramMessage(name, quantity, URL){
    let chatID = sentVIPMessages[name][0];
    let messageId = sentVIPMessages[name][1];
    let oldQuantity = sentVIPMessages[name][2];
    if(quantity!=oldQuantity){
        let mess = getVIPMessage(name, quantity, URL);
        if(quantity==0) mess=getEsauritoMessage(name, URL);
        try{
            bot.editMessageText(mess, {chat_id: chatID, message_id: messageId});
        }catch(err){};
        sentVIPMessages[name][2]=quantity;
    }
}

function onCheckError(error){
    console.error(error);
}


/**
 * Controlla che l'orario in cui checko il sito sia tra 07 e 00
 */
function isRightTime(){
    let options={
        timeZone: "Europe/Rome",
        hour: 'numeric',
        hour12: false
    };
    let formatter = new Intl.DateTimeFormat("it-IT", options);
    let isRight = formatter.format(new Date())>7;
    return isRight;
}

/**
 * Listener del prodotto disponibile
 * @param {string} URL 
 * @param {string} name 
 * @param {int} quantity 
 */
function productAvailable(URL, name, quantity){
    logUtils.addLog(name, quantity);
    console.log(name+": "+quantity);

    // gruppo VIP
    if(name in sentVIPMessages){
        editTelegramMessage(name, quantity, URL);
    }else{
        bot.sendMessage(consts.chatVipID, getVIPMessage(name, quantity, URL))
        .then((message)=>{
            sentVIPMessages[name]=[message.chat.id, message.message_id, quantity];
        });
    }

    // gruppo NON vip
    setTimeout(()=>{
        console.log("Prodotti inviati al gruppo non-VIP: "+Object.keys(sentDailyMessages).length);
        if((Object.keys(sentDailyMessages).length)<consts.DAILY_MAX_MESSAGES && !(name in sentDailyMessages) && isRightTime()){
            bot.sendMessage(consts.chatID, getMessage(name, URL))
            .then((message)=>{
                sentDailyMessages[name]=[message.chat.id, message.message_id];
            });
            sentDailyMessages[name]=[];
        }
    }, consts.NON_VIP_DELAY);
}

/**
 * Listener del prodotto non disponibile
 * @param {string} URL 
 * @param {string} name 
 */
function productNotAvailable(URL, name){
    if(name in sentVIPMessages){
        editTelegramMessage(name, 0, URL);
        delete sentVIPMessages[name];
    }
}

/**
 * Se il controllo sul sito ha successo...
 * @param {string} url 
 * @param {*} html 
 */
function onCheckSuccess(url,html){
        // cerco se il prodotto è disponibile
        const dom = new jsdom.JSDOM(html);
        var jsonData = dom.window.document.getElementById("pdm_productdetailsmaincartridge").getAttribute("data-pdmjsmodels");
        jsonData = JSON.parse(jsonData);
        let skus = jsonData[0]["skus"];
        var maxLength = Object.keys(skus).length;
        // per ogni elemento della pagina guardo se è disponibile
        for(let i=0;i<maxLength;i++){
            let name = skus[i]["displayName"];
            if(maxLength>1)
                name+=" "+skus[i]["size"];
            let quantity = skus[i]["availableQuantity"];
            if(quantity>0) productAvailable(url, name, quantity);
            else productNotAvailable(url, name);
        }
}


function checkProducts(){
    //console.log("\nCHECKING...");
    let urls = dataUtils.getURLs();
    console.log("[CHECKING] CHECKING...");
    console.log();
    urls.forEach((url)=>{
        // per ogni url ottengo il codice HTML
        //console.log("[START CHECK] "+url);
        fetch(url).then(resp=>resp.text()).then(body=>onCheckSuccess(url, body)).catch(err=>onCheckError(err))
        //.finally(()=>console.log("[END CHECK] "+url));
    });
    //sendDailyReminder();
}

function resetMessage(){
    sentDailyMessages={};
}



/**
 * Manda il promemoria giornaliero sul gruppo non-vip
 */
function sendDailyReminder(){
    if(reminder_id!=-1){
        bot.deleteMessage(consts.chatID, reminder_id);
    }
    bot.sendMessage(consts.chatID, 
        "*PROMEMORIA*\nQuesto canale offre solo "+consts.DAILY_MAX_MESSAGES+" messaggi al giorno con un ritardo rispetto l'effettiva disponibilità di "+consts.NON_VIP_DELAY/1000+" secondi.\n"+
        "Con una donazione di "+consts.VIP_PRICE+"€ *(OFFERTA NATALIZIA)* è possibile accedere al canale VIP per avere notifiche senza ritardo con relative quantità disponibili aggiornate in tempo reale."+
        "\nPer diventare VIP o per qualsiasi domanda o suggerimento scrivi a @DecaInfoBot"+
        "\n(L'accesso al canale VIP non assicura al 100% di riuscire a comprare il prodott ma, con sufficiente rapidità, la probabilità è molto alta)"
        , {parse_mode: "Markdown"}
    ).then((message)=>reminder_id=message.message_id);
}

/**
 * Avvia e gestisce le funzionalità del bot
 */
function setupBot(){
    bot.on("message", (message, metadata)=>{
        if(message.chat.type=="private"){
            switch(message.text){
                case "/start":
                case "/info":
                    let chat_id = message.chat.id;
                    let m = `
                    *Informazioni riguardo il VIP:*\nL'accesso per 30 giorni al canale DecaCheck VIP richiede una donazione di ${consts.VIP_PRICE}€ *(OFFERTA NATALIZIA)*.\nAll'interno del canale DecaCheck VIP sono presenti tutte le notifiche di disponibilità immediate con le relative quantità di prodotto disponibile aggiornate in tempo reale.\nIl canale VIP non assicura di acquistare i prodotti ma con sufficiente rapidità è molto probabile riuscire a comprare il prodotto.\nSe vuoi far parte del canale VIP o hai altre domande scrivi a @DecaInfoBot`;
                    bot.sendMessage(chat_id, m, {parse_mode: "Markdown"});
                    break;
            }
            // ADMIN COMMANDS
            if(message.chat.id==consts.ADMIN_CHAT_ID){
                if(message.text.includes("/addvip")){
                    let vipList = message.text.replace("/addvip ", "");
                    let vipNames = vipList.split(" ");
                    vipNames.forEach((vipName)=>{
                        vipUtils.addVIP(vipName, bot);
                    });
                }
                if(message.text=="/vips"){
                    let vips = vipUtils.getVIPs();
                    let message = "*VIPs*\n";
                    if(Object.keys(vips).length>0){
                        vips.forEach((vip)=>{
                            message+="@"+vip+"\n";
                        });
                    }else{
                        message+="Non c'è alcun vip al momento";
                    }
                    bot.sendMessage(consts.ADMIN_CHAT_ID, message, {parse_mode: "Markdown"});
                }
                if(message.text.includes('/removevip')){
                    let vipName = message.text.replace('/removevip ', '');
                    vipUtils.removeVIP(vipName, bot);
                }
                if(message.text.includes('/checkvip')){
                    if(message.text=="/checkvips"){
                        vipUtils.checkVIPs(bot );
                    }else{
                        let vipName = message.text.replace('/checkvip ', '');
                        let checkResult = vipUtils.checkVIP(vipName);
                        let isVIP = checkResult[0];
                        let m = "*CONTROLLO VIP*\n@"+vipName+(isVIP?"":" non")+" è VIP";
                        if(isVIP){
                            let date = checkResult[1];
                            let remainingDays = checkResult[2];
                            m+="\nIscritto il "+date;
                            m+="\nGiorni rimanenti: "+(30-remainingDays);
                        }
                        bot.sendMessage(consts.ADMIN_CHAT_ID, m, {parse_mode: "Markdown"});
                    }
                }
                if(message.text.includes('/addurl')){
                    let url = message.text.replace('/addurl ', '');
                    dataUtils.addURL(url);
                    bot.sendMessage(consts.ADMIN_CHAT_ID, "*[URLs]* Added URL "+url, {parse_mode: "Markdown"});
                }
                if(message.text.includes('/removeurl')){
                    let url = message.text.replace('/removeurl ', '');
                    dataUtils.removeURL(url);
                    bot.sendMessage(consts.ADMIN_CHAT_ID, "*[URLs]* Removed URL "+url, {parse_mode: "Markdown"});
                }
                if(message.text.includes('/urls')){
                    let urls = dataUtils.getURLs();
                    let message = "<b>URLs</b>\n";
                    urls.forEach((url)=>message+=url+"\n");
                    bot.sendMessage(consts.ADMIN_CHAT_ID, message, {parse_mode: "HTML", disable_web_page_preview: true});
                }
            }
        }
    });
}

let ciao = "prova";

function setupEvents(){
    process.on("SIGINT", ()=>{
        process.exit();
    });
    process.on("SIGHUP", ()=>{
        process.exit();
    });
    process.on("SIGTERM", ()=>{
        process.exit();
    })
    process.on("beforeExit", ()=>{

    });
    process.on("exit", (number)=>{
        console.log("Exiting with code "+number);
        crashManager.saveStatus({
            "reminder_id": reminder_id,
            "sentVIPMessages": sentVIPMessages,
            "sentDailyMessages": sentDailyMessages
        });
    });
    //process.emit("SIGHUP");
}

function setupCrash(){
    if(crashManager.wasCrashed()){
        crashManager.restoreStatus((dictionary)=>{
            console.log(dictionary);
            for(let [key, value] of Object.entries(dictionary)){
                eval(key+"=("+value+")");
            }
        });
    }
}

app.get('/', (req, res) => {
  res.send('')
})

// money box: https://paypal.me/pools/c/8vpWuT2VLr

app.listen(process.env.PORT || port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
    if(!TESTING){
        schedule.scheduleJob('*/20 * * * * *', checkProducts);
        schedule.scheduleJob('0 0 * * *', resetMessage);
        schedule.scheduleJob('0 0 * * *', ()=>{
            vipUtils.checkVIPs(bot);
        });
        schedule.scheduleJob('0 12,21 * * *', sendDailyReminder);
        setupBot();
        setupEvents();
        setupCrash();
    }
    console.log("p0rcod1o");
    // TODO REMEMBER TO REMOVE TESTING VARIABLE!!!!!!!!!
});