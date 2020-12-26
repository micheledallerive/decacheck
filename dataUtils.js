const fs = require('fs');
function addURL(URL){
    fs.appendFileSync("urls.txt", URL+"\n");
}
function getURLs(){
    try{
        let data = fs.readFileSync("urls.txt", "UTF-8");
        let lines = data.split("\n");
        lines.pop();
        return lines;
    }catch(err){
        console.error(err);
    }
    return null;
}
function removeURL(URL){
    try{
        let lines = getURLs();
        let text = "";
        lines.forEach((line)=>{
            if(!line.includes(URL))
                text+=line+"\n";
        });

        console.log(text);
        fs.writeFileSync("urls.txt", text);
    }catch(err){
        console.error(err);
    }
}
function checkURL(URL){
    try{
        let data = fs.readFileSync("urls.txt", "UTF-8");
        let lines = data.split("\n");
        return lines.includes(URL);
    }catch(err){
        console.error(err);
    }
    return false;
}
module.exports={
    addURL,
    getURLs,
    removeURL,
    checkURL
}