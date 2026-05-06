import 'dotenv/config'; // 👈 1. 新增這一行，它會自動讀取 .env
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch'; // 如果 Node 版本夠新，可以直接用全域 fetch

// 在 ESM 中模擬 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, 'database.json');
const PREF_FILE = path.join(__dirname, 'user_preference.json');

const app = express();

// === 儲存資料 ===

// const fs = require('fs');
// const path = require('path');
// const DB_FILE = path.join(__dirname, 'database.json');
// const PREF_FILE = path.join(__dirname, 'user_preference.json');


// // ===================================

// const express = require('express');
// const cors = require('cors');
// const { GoogleGenerativeAI } = require("@google/generative-ai");

// const app = express();
app.use(cors());
app.use(express.json());
// 1. 讓伺服器能讀取同資料夾下的靜態檔案 (如 index.html)
app.use(express.static(__dirname));

// 設定根目錄路由，直接回傳 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

//  API Key
const API_KEY = process.env.GEMINI_API_KEY; 


if (!API_KEY) {
    console.error("❌ 錯誤：找不到 API Key！請檢查 .env 檔案是否存在。");
    process.exit(1); // 沒鑰匙就關閉伺服器，避免後續報錯
}


const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview"
        //  gemini-2.5-flash , gemini-2.5-flash-lite , gemini-3-flash , gemini-3-flash-preview
    });

// ---  自動重試函式 (對付 503 塞車用) ---
async function generateWithRetry(prompt, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            // 嘗試呼叫 AI
            const result = await model.generateContent(prompt);
            console.log("Token 使用量統計:", result.response.usageMetadata);
            return result; // 成功就回傳
        } catch (error) {
            // 如果是 503 (忙碌) 或 500 (錯誤)，就重試
            if (error.message.includes('503') || error.message.includes('Overloaded') || error.message.includes('500')) {
                console.log(`   ⚠️ Google 伺服器忙碌中 (503)，等待 3 秒後重試... (剩餘 ${retries - 1 - i} 次機會)`);
                await sleep(3000); // 休息 3 秒
            } else {
                throw error; // 其他錯誤 (如 400 格式錯) 直接報錯，不重試
            }
        }
    }
    throw new Error("Google AI 伺服器太忙碌，重試 3 次後宣告失敗，請稍後再試。");
    //const result = await generateWithRetry(prompt);
}

// 補上這個變數宣告，就不會報錯了
const locationCache = {};

// --- 強制鎖定在輸入的縣市 (含電話/網站抓取功能) ---
async function getRealCoordinates(keyword, region) {
    // 1. 先查記憶體快取 (如果有查過就不再查)
    if (locationCache[keyword]) return locationCache[keyword];

    // 清理關鍵字
    let cleanKeyword = keyword.replace(/\(.*\)/g, '').replace(/（.*）/g, '').trim();

    const queries = [
        `${cleanKeyword} ${region}`, // 例如 "宮原眼科 台中"
        cleanKeyword                 // 例如 "宮原眼科"
    ];

    for (const q of queries) {
        try {
            // ✨ 關鍵：網址最後面有加上 &extratags=1 來抓額外資料
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=tw&extratags=1`;
            
            const response = await fetch(url, {
                headers: { 'User-Agent': 'MyAcademicThesisProject/1.0' }
            });
            const data = await response.json();

            if (data && data.length > 0) {
                const resultData = data[0];
                const extras = resultData.extratags || {}; // 這裡就是藏電話跟網站的地方

                // ✨ 建立結果物件 (包含電話網站)
                const result = {
                    lat: parseFloat(resultData.lat),
                    lon: parseFloat(resultData.lon),
                    found: true,
                    src: q,
                    phone: extras.phone || extras['contact:phone'] || extras['contact:mobile'] || null,
                    website: extras.website || extras['contact:website'] || extras.facebook || null
                };

                // ✨ 把結果存回變數 (這樣下次問一樣的景點，開頭的第一行就會直接回傳，不用再連網)
                locationCache[keyword] = result;
                
                return result;
            }
        } catch (e) {
            console.error(`      ⚠️ OSM 連線跳過:`, e.message);
        }
        // 禮貌性延遲
        await new Promise(r => setTimeout(r, 800));
    }
    return { found: false };
}

// 延遲函式 (避免太快請求被 OSM 封鎖)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));



app.post('/generate', async (req, res) => {
    const { location, startDate, days, preference } = req.body; 
    
    console.log(`請求: ${location}, ${days}天`);


    // 1. 先把景點資料讀進來
    const pool = JSON.parse(fs.readFileSync('attractions81.json', 'utf-8')).result;

    try {
        // --- 呼叫 Gemini  ---
        const prompt = `
            你是一個嚴格執行規則的學術旅遊資料生成器。請基於真實地理數據回傳 JSON。
            
            【輸入條件】
            地點: ${location}
            日期: ${startDate}
            天數: ${days}
            偏好: ${preference}

            【規則一：嚴格路徑結構 (Topology)】(必須遵守)
            1. **Day 1 結構**：
               [景點/抵達點] -> [交通] -> [景點] -> ... -> [交通] -> [當日住宿飯店]
            
            2. **Day 2 (及之後) 結構**：
               **[出發飯店]** -> [交通] -> [景點] -> [交通] -> ... -> [交通] -> [當日住宿飯店]
               *(注意：除第一天外，每天的第一個節點必須是「飯店」，代表從住宿點出發)*

            3. **邊與節點交替**：
               兩個景點(Spot)之間必須插入一個交通(Transport)。

            【規則二：時間邏輯 (Time Logic)】(必須遵守)
            1. **每日第一站 (若為飯店)**：
               StartTime 必須是 "00:00"。
               EndTime 為出發時間 (例如 "09:00")。
            2. **每日最後一站 (若為飯店)**：
               StartTime 為抵達時間 (例如 "21:00")。
               EndTime 必須是 "24:00"。
            3. 其他景點的時間必須連續且合理。

            【規則三：欄位值限制 (Enum)】(只能從清單選擇)
            
            1. **IndoorOutdoor (室內外)**：
               - 只能是：["室內", "戶外", "半開放"]。
               - (半開放定義：如夜市、騎樓、涼亭、半露天餐廳)。

            2. **TransportType (交通方式)**：
               - 只能是：["步行", "腳踏車", "汽車", "公車", "火車", "高鐵"]。
               - (計程車請歸類為 "汽車")。

            3. **WeatherType (天氣)**：
               - 只能是：["陰天", "多雲", "晴到多雲", "晴天", "炎熱晴天", "雨天"]。

            4. **SpotType (景點類型)**：
               - 只能從此清單多選：["文化", "親子", "購物", "住宿", "美食", "古蹟", "風景", "藝術", "休閒", "宗教", "夜市"]。

            【規則四：資料完整性 (絕對不可留白)】 

            1. **Phone (電話)**：
               - 若資料庫有真實電話請填寫。
               - **若無資料，請務必根據「${location}」的區碼生成一個擬真的電話號碼** (例如台南用06開頭)，絕對禁止填寫 "無" 或 null。

            2. **Website (網址)**：
               - 若無真實網址，請填寫 "GoogleSearch" (後端會自動處理)，不要填 "無" 或 null。

            【規則五：強制全欄位定義】(不可省略任何欄位，若無資料請估算)

            1. **景點物件 (Spot) 必填**：
            {
                "DataType": "Spot",
                "Day": (數字),
                "Date": "YYYY-MM-DD",
                "SpotName": (字串),
                "Address": (字串, 請提供真實地址),       
                "Latitude": (數字, 例如 25.0339),   
                "Longitude": (數字, 例如 121.5644),
                "SpotType": (字串, 上述 Enum 多選, 例如 ["文化", "親子"] ),
                "Description": (字串, 50字簡介),
                "Phone": (字串, 必填，不可為空),
                "Website": (字串, 必填),
                "StartTime": "HH:MM",
                "EndTime": "HH:MM",
                "Rating": (數字, 例如 4.5),
                "Cost": (數字, 台幣),
                "WalkingLoad": (數字, 1-10),
                "InfoLoad": (數字, 1-10),
                "CrowdLevel": (數字, 1-10),
                "IndoorOutdoor": (字串, 上述 Enum),
                "WeatherType": (字串, 上述 Enum),
                "Temperature": (數字, 攝氏)
            }

            2. **交通物件 (Transport) 必填**：
            {
                "DataType": "Transport",
                "Day": (數字),
                "TransportType": (字串, 上述 Enum),
                "Distance": (字串, 例如 "5.2 km"),
                "Duration": (字串, 例如 "20 min"),
                "Speed": (字串, 例如 "40 km/h"),
                "Cost": (數字, 單位台幣。步行/腳踏車為0。汽機車估油錢。火車高鐵填票價) 
            }

            請直接回傳純 JSON Array，不要有 Markdown (\`\`\`)。
        `;

        const result = await model.generateContent(prompt);
        console.log("Token 使用量統計:", result.response.usageMetadata);
        const response = await result.response;
        let text = response.text();

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(text);



        // --- 🌍 V14 新增：真實座標修正流程 ---
        console.log("   🤖 AI 生成完畢，開始進行真實座標校正 (OSM)...");

        for (let item of data) {
            // 只修正「景點 (Spot)」且不是「出發/結束」這類虛擬節點
            if (item.DataType === "Spot") {
                // 為了讓搜尋更準，我們會加上使用者輸入的地點 (例如: "阿堂鹹粥" + "台南")
                const searchRegion = location.substring(0, 2); // 取前兩個字當區域，例如 "台南"
                
                // 呼叫 OSM API
                const realCoords = await getRealCoordinates(item.SpotName, searchRegion);

                if (realCoords.found) {
                    console.log(`   ✅ 修正座標: ${item.SpotName} -> (${realCoords.lat}, ${realCoords.lon})`);
                    item.Latitude = realCoords.lat;
                    item.Longitude = realCoords.lon;
                    item.IsRealCoordinate = true; // 標記這是真實數據

                   // 如果 OSM 有查到電話網址，優先使用
                    if (realCoords.phone) item.Phone = realCoords.phone;
                    if (realCoords.website) item.Website = realCoords.website;
                } else {
                    console.log(`   ⚠️ 維持預估: ${item.SpotName} (OSM 找不到)`);
                    item.IsRealCoordinate = false;
                }

                // 強制補全邏輯 (解決 "無" 的問題) 
                
                // (A) 處理網址：如果是 "無" 或 "GoogleSearch"，就改成 Google 搜尋連結
                if (!item.Website || item.Website === "無" || item.Website === "GoogleSearch") {
                    item.Website = `https://www.google.com/search?q=${encodeURIComponent(item.SpotName)}`;
                }

                // (B) 處理電話：如果還是 "無" (AI 失誤且 OSM 沒查到)，強制生成一個假的
                if (!item.Phone || item.Phone === "無") {
                    // 簡單的亂數生成，假裝是當地市話
                    // 這裡預設生成一個看起來像手機或市話的號碼，避免欄位空白
                    const randomNum = Math.floor(Math.random() * 8999999) + 1000000;
                    item.Phone = `(06) 2${randomNum.toString().substring(1, 4)}-${randomNum.toString().substring(4)}`;
                    // 註：這只是一個保險，通常 Prompt 裡的 AI 就會生成好了
                }

                
                // 休息 0.5 秒，禮貌性避免灌爆 OSM 伺服器
                await sleep(500);
            }
        }
        // ------------真實座標修正流程END------------------------


        //  === 儲存資料 === 
        
        try {
            // 1. 先讀取舊資料 (為了知道上一號是多少)
            let currentDB = [];
            if (fs.existsSync(DB_FILE)) {
                try {
                    const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
                    currentDB = JSON.parse(fileContent);
                } catch (e) {
                    currentDB = [];
                }
            }

            // 2. 計算新 ID (流水號邏輯)
            // 如果資料庫有東西，就抓最後一筆的 id + 1
            // 如果是空的，就從 1 開始
            const newId = currentDB.length > 0 ? currentDB[currentDB.length - 1].id + 1 : 1;

            // 3. 建立新資料包
            const record = {
                id: newId,   //  1, 2, 3...
                timestamp: new Date().toLocaleString(),
                input: { location, startDate, days, preference },
                result: data
            };

            // 4. 存檔
            currentDB.push(record);
            fs.writeFileSync(DB_FILE, JSON.stringify(currentDB, null, 2), 'utf-8');
            console.log(`資料已存檔 ID: ${newId} (目前共 ${currentDB.length} 筆)`);

        } catch (saveError) {
            console.error("存檔失敗:", saveError);
        }

        //  === 儲存資料end === 
        

        // --- 回傳給前端 ---
        res.json(data);

    } catch (error) {
        console.error("錯誤:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
//      偏好
// ==========================================
app.get('/api/attraction-preferences', (req, res) => {
    try {
        if (fs.existsSync(PREF_FILE)) {
            const data = fs.readFileSync(PREF_FILE, 'utf-8');
            res.json(JSON.parse(data)); // 回傳你那份 JSON
        } else {
            res.json({}); // 沒檔案就回傳空物件
        }
    } catch (e) {
        res.status(500).json({ error: "讀取偏好檔失敗" });
    }
});
app.post('/api/update-attraction-preference', (req, res) => {
    try {
        const { spotName, preference, physical, mental } = req.body;
        let prefs = {};
        
        // 1. 先讀取現有的檔案
        if (fs.existsSync(PREF_FILE)) {
            prefs = JSON.parse(fs.readFileSync(PREF_FILE, 'utf-8'));
        }

        // 2. 依照你 user_preference.json 的格式更新
        // 注意：這裡的 key 是景點名稱，value 包含 preference, phyFatigue (生理), menFatigue (心理)
        prefs[spotName] = {
            ...prefs[spotName], // 保留原本沒改到的欄位
            ...(preference !== undefined && { preference }),
            ...(physical !== undefined && { phyFatigue: physical }),
            ...(mental !== undefined && { menFatigue: mental })
        };

        // 3. 寫入檔案
        fs.writeFileSync(PREF_FILE, JSON.stringify(prefs, null, 2), 'utf-8');
        console.log(`   ✅ 已同步更新景點偏好: ${spotName}`);
        res.json({ success: true });
    } catch (e) {
        console.error("更新偏好檔失敗:", e);
        res.status(500).json({ error: "無法寫入偏好檔" });
    }
});
// ==========================================
//      修正行程 (含黑名單記憶功能)
// ==========================================
app.post('/modify', async (req, res) => {
    const { originalData, userFeedback, constraints } = req.body;
    
    console.log(`[Modify] 收到回饋，正在更新歷史偏好並修正...`);

    try {
        // --- 讀取並更新「歷史偏好紀錄」 ---
        let historyPref = {};
        if (fs.existsSync(PREF_FILE)) {
            try {
                historyPref = JSON.parse(fs.readFileSync(PREF_FILE, 'utf-8'));
            } catch (e) { historyPref = {}; }
        }

        // 把這次的新回饋合併進去 (New covers Old)
        // 結構 key: "景點名稱", value: { preference, phyFatigue, psyFatigue }
        for (const [spotName, feedback] of Object.entries(userFeedback)) {
            historyPref[spotName] = feedback;
        }

        // 存回檔案 (這樣下次就會記得了)
        fs.writeFileSync(PREF_FILE, JSON.stringify(historyPref, null, 2), 'utf-8');
        console.log(`   💾 歷史偏好已更新，目前共記錄 ${Object.keys(historyPref).length} 個景點`);


        // --- 準備 Prompt (加入歷史紀錄) ---
        const prompt = `
                    你是一個旅遊行程修復師。請根據使用者的「偏好、生理疲勞、心理疲勞」回饋調整行程。

                    【背景】地點:${constraints.location}, 日期:${constraints.startDate}, 天數:${constraints.days}, 原偏好:${constraints.preference}

                    【原始資料】
                    ${JSON.stringify(originalData)}
                    * 請根據原始資料，規劃出新的且符合背景的行程

                    【⚠️ 歷史黑名單資料 (History Blacklist)】
                    (請參考此處，若某景點曾被評為偏好 <= 3，絕對禁止再次加入！)
                    ${JSON.stringify(historyPref)}

                    【使用者回饋 (只包含使用者有填寫的項目)】
                    ${JSON.stringify(userFeedback)}
                    * 評分說明：1-10分。
                    * Preference (偏好): 分數越高越喜歡。
                    * PhyFatigue (生理疲勞): 分數越高越累 (如走路多)。
                    * PsyFatigue (心理疲勞): 分數越高越心累 (如人多、資訊量大)。

                    【修正邏輯 (請嚴格遵守)】
                    1. **黑名單檢查**：
                    - 優先檢查【歷史黑名單資料】，若景點歷史偏好 <= 3，**絕對禁止**再次加入行程。

                    2. **高偏好保留 (Preference >= 8)**：
                    - 即使疲勞很高，因為使用者超喜歡，**必須保留**。
                    - 若疲勞過高，請刪除當天其他「低偏好」或「未評分」的景點來保留體力 (Trade-off)。
                    
                    3. **高疲勞移除 (PhyFatigue >= 7 OR PsyFatigue >= 7)**：
                    - 若偏好不高 (< 8)，代表使用者覺得累又不值得，**必須移除**並替換成輕鬆的景點。
                    
                    4. **低偏好移除 (Preference <= 3)**：
                    - 直接移除並替換。

                    5. **重新順路**：
                    - 確保 Day 1 從景點開始，Day 2+ 從飯店出發，每日以飯店結束 (EndTime: 24:00)。
                    - 景點間必須有交通。

                    【輸出格式 - 非常重要】
                    1. **只回傳 JSON Array**。
                    2. **嚴禁**使用 Markdown (不要寫 \`\`\`json)。
                    3. **嚴禁**任何解釋性文字。
                    4. **所有欄位** (Address, Latitude, Cost, InfoLoad, WalkLoad 等) 都要保留，新景點請估算數值。
                `;

        const result = await model.generateContent(prompt);
        console.log("Token 使用量統計:", result.response.usageMetadata);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error("AI 回傳 JSON 格式錯誤");
        }

        // --- OSM 校正 (加入 Set 防跳針) ---
        console.log("   🌍 AI 生成完畢，檢查新景點座標 (智慧去重)...");
        const searchRegion = constraints.location.substring(0, 2); 
        const processedSpots = new Set(); // 記錄已處理過的

        for (let item of data) {
            if (item.DataType === "Spot") {
                // 如果已經查過，跳過
                if (processedSpots.has(item.SpotName)) continue;

                // 如果是新景點，就查座標
                if (!userFeedback[item.SpotName] && !historyPref[item.SpotName]) {
                    const realInfo = await getRealCoordinates(item.SpotName, searchRegion);
                    if (realInfo.found) {
                        item.Latitude = realInfo.lat;
                        item.Longitude = realInfo.lon;
                        if (realInfo.phone) item.Phone = realInfo.phone;
                        if (realInfo.website) item.Website = realInfo.website;
                        console.log(`      ✅ [OSM修正] ${item.SpotName}`);
                    }
                }

                // 強制補全 
                if (!item.Website || item.Website === "無" || item.Website === "GoogleSearch") {
                    item.Website = `https://www.google.com/search?q=${encodeURIComponent(item.SpotName)}`;
                }
                if (!item.Phone || item.Phone === "無") {
                     const randomNum = Math.floor(Math.random() * 8999999) + 1000000;
                     item.Phone = `(06) 2${randomNum.toString().substring(1, 4)}-${randomNum.toString().substring(4)}`;
                }

                processedSpots.add(item.SpotName);
            }
        }

        // --- 自動存檔行程 ---
        try {
            let currentDB = [];
            if (fs.existsSync(DB_FILE)) {
                try {
                    const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
                    currentDB = JSON.parse(fileContent);
                } catch (e) { currentDB = []; }
            }
            const newId = currentDB.length > 0 ? currentDB[currentDB.length - 1].id + 1 : 1;
            const record = {
                id: newId,
                type: "modified",
                timestamp: new Date().toLocaleString(),
                input: { ...constraints, feedbackGiven: userFeedback },
                result: data
            };
            currentDB.push(record);
            fs.writeFileSync(DB_FILE, JSON.stringify(currentDB, null, 2), 'utf-8');
            console.log(`   💾 修正版行程已存檔！(ID: ${newId})`);
            data.id = newId;
        } catch (saveError) { console.error("   ⚠️ 存檔失敗:", saveError); }

        res.json(data);

    } catch (error) {
        console.error("Modify Error:", error);
        res.status(500).json({ error: error.message });
    }
});

//前端
app.get('/api/all-itineraries', (req, res) => {
    if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        res.json(JSON.parse(fileContent));
    } else {
        res.json([]);
    }
});

// app.listen(3000, () => {
//     console.log('旅遊伺服器啟動中...');
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`旅遊伺服器已在連接埠 ${PORT} 啟動...`);
});