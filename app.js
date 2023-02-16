const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const puppeteer = require('puppeteer');
const winston = require('winston');

const logger = winston.createLogger({
    format: winston.format.simple(),
    transports: [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'info.log', level: 'info' }),
      new winston.transports.Console({format: winston.format.simple()})
    ],
});
  
async function scrapeData() {
    const browser = await puppeteer.launch({ headless: false });
    let pageIndex = 1;
    let url = `https://boston.craigslist.org/search/boston-ma/cta#search=1~gallery~0~${pageIndex}`;

    const page = await browser.newPage();
    await page.goto(url);
    
    setTimeout(async () => {
        let json = await page.$$eval('li.cl-search-result', async (lis) => {
            let resultJSON = [];

            for (let i = 0; i < lis.length; i++) {
                const li = lis[i];
                if (li.querySelector("a.titlestring") != null
                    && li.querySelector("span.priceinfo") != null
                    && li.querySelector("a.main") != null) {
                    const title = li.querySelector("a.titlestring").innerText.replace(",", " ");
                    const price = li.querySelector("span.priceinfo").innerText.replace(",", ".");
                    const url = li.querySelector("a.main").getAttribute("href");
                    const date = li.querySelector("div.meta").innerText.split("·")[0];
        
                    resultJSON.push({
                        title,
                        price,
                        date,
                        url,
                    });
                };

            }
            return resultJSON;
        });

        json = await parseItem(browser, json, 0);
    }, 5000);
}
    
scrapeData();

function jsonToCSV(json) {
    let csv = "Title,Price,URL,Date,Odometer,Model,Drive,Transmission,Paint Color\n";
    json.forEach((item) => {
        item.title = item.title.replace(",", ".");
        item.price = item.price.replace(",", ".");
        item.date = item.date.replace(",", ".");
        item.odometer = item.odometer.replace(",", ".");
        item.model = item.model.replace(",", ".");
        item.drive = item.drive.replace(",", ".");
        item.transmission = item.transmission.replace(",", ".");
        item.paint_color = item.paint_color.replace(",", ".");
        csv += `${item.title},${item.price},${item.url},${item.date},${item.odometer},${item.model},${item.drive},${item.transmission},${item.paint_color}\n`;
    });
    return csv;
}

async function parseItem(browser, json, index) {
    const newPage = await browser.newPage();
    await newPage.goto(json[index]['url'], { waitUntil: 'domcontentloaded' });
        const subJson = await newPage.$$eval('section.userbody', async (divs) => {
            const div = divs[0];
            const attrgroups = div.querySelectorAll("p.attrgroup span");
    
            let odometer, model, drive, transmission, paint_color;
    
            for (let i = 0; i < attrgroups.length; i++) {
                const attrgroup = attrgroups[i];
                if (attrgroup.innerText.includes("odometer:")) {
                    odometer = attrgroup.innerText.replace("odometer:", "").replace(",", ".");
                }
                if (attrgroup.innerText.includes("model:")) {
                    model = attrgroup.innerText.replace("model:", "");
                }
                if (attrgroup.innerText.includes("drive:")) {
                    drive = attrgroup.innerText.replace("drive:", "");
                }
                if (attrgroup.innerText.includes("transmission:")) {
                    transmission = attrgroup.innerText.replace("transmission:", "");
                }
                if (attrgroup.innerText.includes("paint color:")) {
                    paint_color = attrgroup.innerText.replace("paint color:", "");
                }
            }
            return { odometer, model, drive, transmission, paint_color };
        });
        console.log(subJson);
        json[index].odometer = subJson != undefined ? subJson.odometer != undefined ? subJson.odometer : "vide" : "vide";
        json[index].model = subJson != undefined ? subJson.model != undefined ? subJson.modem : "vide" : "vide";
        json[index].drive = subJson != undefined ? subJson.drive != undefined ? subJson.drive : "vide" : "vide";
        json[index].transmission = subJson != undefined ? subJson.transmission != undefined ? subJson.transmission : "vide" : "vide";
        json[index].paint_color = subJson != undefined ? subJson.paint_color != undefined ? subJson.paint_color : "vide" : "vide";
        setTimeout(async () => {
            if (index < json.length - 1) {
                return await parseItem(browser, json, index + 1);
            } else {
                fs.createWriteStream('data.json').write(JSON.stringify(json));
                fs.createWriteStream('data.csv').write(jsonToCSV(json));
                await browser.close();
            }
        }, 100);
}