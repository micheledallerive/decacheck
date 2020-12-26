const fs = require('fs');

function saveStatus(data){
    for(let key in data)
        data[key]=JSON.stringify(data[key]);
    let text = JSON.stringify(data);
    fs.writeFileSync("crash.dat", text);
    console.log("[CRASH MANAGER] Saving status...");
}

function restoreStatus(callback){
    let text = fs.readFileSync("crash.dat", "UTF-8");
    let dictionary = JSON.parse(text);
    callback(dictionary);
    console.log("[CRASH MANAGER] Status restored.");
    fs.unlinkSync("crash.dat");
}

function wasCrashed(){
    return fs.existsSync("crash.dat");
}

module.exports = {
    saveStatus,
    restoreStatus,
    wasCrashed
}